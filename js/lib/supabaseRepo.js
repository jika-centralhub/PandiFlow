// Stockage cloud : Supabase (base Postgres + connexion par code e-mail + Edge Function photo).
// Les règles RLS de supabase/schema.sql garantissent que chaque famille ne voit que ses données.
import { SUPABASE_URL, SUPABASE_ANON_KEY, APP_VERSION } from '../config.js';
import { PRIMARY_KEYS } from './tables.js';

function fail(error, status) {
  const e = new Error(error?.message || 'Erreur Supabase');
  e.status = status || error?.status || 0;
  e.code = error?.code;
  return e;
}

export class SupabaseRepo {
  constructor() {
    this.mode = 'cloud';
    // Flux PKCE : au retour de Google, l'adresse contient ?code=…, échangé contre une session
    this.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    });
  }

  // --- Compte ---------------------------------------------------------------
  async getUser() {
    // getSession attend la fin de l'échange du code de retour (Google ou lien « mot de passe oublié »)
    const { data } = await this.sb.auth.getSession();
    const params = new URLSearchParams(location.search);
    if (params.has('code') || params.has('error') || params.has('reset')) {
      this.recovery = params.get('reset') === '1' && Boolean(data.session);
      history.replaceState(null, '', `${location.pathname}${location.hash || '#/soiree'}`);
    }
    return data.session?.user ?? null;
  }

  // La connexion Google n'est proposée que si elle est activée dans Supabase
  async googleEnabled() {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } });
      return Boolean((await res.json())?.external?.google);
    } catch {
      return false;
    }
  }

  async signUp(email, password) {
    const { data, error } = await this.sb.auth.signUp({ email, password });
    if (error) throw fail(error);
    if (!data.session) throw new Error('Compte créé : connecte-toi maintenant.');
    return data.user;
  }

  async signIn(email, password) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw fail(error);
    return data.user;
  }

  async sendPasswordReset(email) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}${location.pathname}?reset=1` });
    if (error) throw fail(error);
  }

  async updatePassword(password) {
    const { data, error } = await this.sb.auth.updateUser({ password });
    if (error) throw fail(error);
    this.recovery = false;
    return data.user;
  }

  async signInWithGoogle() {
    const { error } = await this.sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}${location.pathname}`, queryParams: { prompt: 'select_account' } },
    });
    if (error) throw fail(error);
  }

  async signOut() {
    await this.sb.auth.signOut();
  }

  // --- Famille --------------------------------------------------------------
  async getFamily() {
    const user = await this.getUser();
    if (!user) return null;
    const { data, error } = await this.sb
      .from('family_members')
      .select('created_at, families(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1);
    if (error) throw fail(error);
    return data?.[0]?.families ?? null;
  }

  async createFamily(name) {
    const { data, error } = await this.sb.rpc('create_family', { p_name: name });
    if (error) throw fail(error);
    return data;
  }

  async joinFamily(code) {
    const { data, error } = await this.sb.rpc('join_family', { p_code: code });
    if (error) throw fail(error);
    if (!data?.ok) throw new Error(data?.error || "Ce code d'invitation ne fonctionne pas.");
    return data;
  }

  // --- Parents de la famille et invitations ------------------------------------
  async listMembers(familyId) {
    const { data, error } = await this.sb.from('family_members').select('user_id, role, email, created_at').eq('family_id', familyId).order('created_at');
    if (error) throw fail(error);
    return data;
  }

  async listInvites(familyId) {
    const { data, error } = await this.sb
      .from('family_invites')
      .select('code, expires_at, created_at')
      .eq('family_id', familyId)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    if (error) throw fail(error);
    return data;
  }

  async createInvite(familyId) {
    const { data, error } = await this.sb.rpc('create_invite', { p_family: familyId });
    if (error) throw fail(error);
    return data;
  }

  async revokeInvite(code) {
    const { error } = await this.sb.rpc('revoke_invite', { p_code: code });
    if (error) throw fail(error);
  }

  async removeMember(familyId, userId) {
    const { error } = await this.sb.rpc('remove_member', { p_family: familyId, p_user: userId });
    if (error) throw fail(error);
  }

  async updateFamily(familyId, patch) {
    const { error, status } = await this.sb.from('families').update(patch).eq('id', familyId);
    if (error) throw fail(error, status);
  }

  // Lit une table entière (par pages de 1000 lignes, la limite de Supabase)
  async fetchAll(table, familyId) {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.sb.from(table).select('*').eq('family_id', familyId).range(from, from + 999);
      if (error) throw fail(error);
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  }

  async loadAll(familyId) {
    const family = familyId ? (await this.sb.from('families').select('*').eq('id', familyId).single()).data : await this.getFamily();
    if (!family) throw new Error('Famille introuvable');
    const [children, tasks, childTasks, ratings, ledger, owned, challenges] = await Promise.all(
      ['children', 'tasks', 'child_tasks', 'ratings', 'ledger', 'owned_items', 'challenges'].map((t) => this.fetchAll(t, family.id)),
    );
    return { family, children, tasks, childTasks, ratings, ledger, owned, challenges };
  }

  // --- Écritures (utilisées par la file d'attente des actions) -------------------
  async put(table, rows) {
    const { error, status } = await this.sb.from(table).upsert(rows, { onConflict: PRIMARY_KEYS[table].join(',') });
    if (error) throw fail(error, status);
  }

  async del(table, match) {
    const { error, status } = await this.sb.from(table).delete().match(match);
    if (error) throw fail(error, status);
  }

  // --- Photo -> avatar (Edge Functions analyze-photo et make-portrait) ----------------
  async invoke(name, body) {
    const { data, error } = await this.sb.functions.invoke(name, { body });
    if (error) {
      let message = "La magie n'a pas marché cette fois-ci. Réessaie dans un instant.";
      try {
        const res = await error.context?.json?.();
        if (res?.error) message = res.error;
      } catch {
        /* message par défaut */
      }
      throw new Error(message);
    }
    return data;
  }

  analyzePhoto({ childId, image, mediaType }) {
    return this.invoke('analyze-photo', { childId, image, mediaType });
  }

  // Le personnage 3D dans une pose : { version, base, expr, marks, image (webp en base64) }
  makePortrait({ childId, expr, image, mediaType, version, fromFace, marksOnly }) {
    return this.invoke('make-portrait', { app: APP_VERSION, childId, expr, image, mediaType, version, fromFace, marksOnly });
  }

  async downloadPortrait(path) {
    const { data, error } = await this.sb.storage.from('portraits').download(path);
    if (error) throw fail(error);
    return data;
  }
}
