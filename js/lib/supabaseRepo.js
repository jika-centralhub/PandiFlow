// Stockage cloud : Supabase (base Postgres + connexion par code e-mail + Edge Function photo).
// Les règles RLS de supabase/schema.sql garantissent que chaque famille ne voit que ses données.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';
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
    this.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }

  // --- Compte ---------------------------------------------------------------
  async getUser() {
    const { data } = await this.sb.auth.getSession();
    return data.session?.user ?? null;
  }

  async sendCode(email) {
    const { error } = await this.sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) throw fail(error);
  }

  async verifyCode(email, token) {
    const { data, error } = await this.sb.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw fail(error);
    return data.user;
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
    if (error) throw fail({ ...error, message: error.message?.includes('inconnu') ? "Ce code d'invitation n'existe pas." : error.message });
    return data;
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

  // --- Photo -> avatar (Edge Function analyze-photo) ------------------------------
  async analyzePhoto({ childId, image, mediaType }) {
    const { data, error } = await this.sb.functions.invoke('analyze-photo', { body: { childId, image, mediaType } });
    if (error) {
      let message = "La magie n'a pas marché cette fois-ci. Réessaie dans un instant.";
      try {
        const body = await error.context?.json?.();
        if (body?.error) message = body.error;
      } catch {
        /* message par défaut */
      }
      throw new Error(message);
    }
    return data;
  }
}
