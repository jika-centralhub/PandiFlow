// Parents de la famille : liste, invitations à usage unique (48 h), retrait par le créateur.
import { html, useEffect, useState } from '../vendor/preact-htm.js';
import { useStore, toast } from '../lib/store.js';
import * as actions from '../lib/actions.js';
import { sfx } from '../lib/sounds.js';

// L'adresse du site telle que le parent l'utilise (https dès qu'il est actif)
const SITE = /(^|\.)pandiflow\.com$/.test(location.hostname) ? location.origin.replace('//pandiflow.com', '//www.pandiflow.com') : 'https://www.pandiflow.com';

const MAX_PARENTS = 6;
const fmtCode = (c) => `${c.slice(0, 4)}-${c.slice(4)}`;
const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

export function FamilyMembers() {
  const s = useStore();
  const [members, setMembers] = useState(null);
  const [invites, setInvites] = useState([]);
  const [fresh, setFresh] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const me = s.user?.id;
  const myRole = members?.find((m) => m.user_id === me)?.role;

  async function refresh() {
    try {
      const [m, i] = await Promise.all([actions.listMembers(), actions.listInvites()]);
      setMembers(m);
      setInvites(i);
    } catch (e) {
      setError(e.message || 'Impossible de charger les parents.');
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function invite() {
    setBusy(true);
    setError(null);
    try {
      const inv = await actions.createInvite();
      setFresh(inv);
      sfx.sparkle();
      refresh();
    } catch (e) {
      setError(e.message || "Impossible de créer l'invitation.");
    } finally {
      setBusy(false);
    }
  }

  async function share(inv) {
    const text = `Rejoins notre famille sur PandiFlow 🐼 : va sur ${SITE}, crée ton compte parent, puis choisis « Rejoindre une famille » avec le code ${fmtCode(inv.code)} (valable 48 h, une seule fois).`;
    try {
      if (navigator.share) await navigator.share({ title: 'Invitation PandiFlow', text });
      else {
        await navigator.clipboard.writeText(text);
        toast('Invitation copiée : colle-la dans un message.', 'success');
      }
    } catch {
      /* partage annulé */
    }
  }

  async function revoke(code) {
    await actions.revokeInvite(code);
    if (fresh?.code === code) setFresh(null);
    sfx.pop();
    refresh();
  }

  async function remove(m) {
    const self = m.user_id === me;
    if (!confirm(self ? "Quitter cette famille ? Tu n'auras plus accès à ses données." : `Retirer ${m.email || 'ce parent'} de la famille ?`)) return;
    try {
      await actions.removeMember(m.user_id);
      if (!self) refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  if (!members) return html`<p class="hint">${error || 'Chargement des parents…'}</p>`;
  const others = invites.filter((i) => i.code !== fresh?.code);

  return html`<div>
    <div class="row-list">
      ${members.map((m) => html`<div key=${m.user_id} class="row">
        <span class="emoji">${m.role === 'owner' ? '👑' : '🧑'}</span>
        <div class="grow">
          <div class="title">${m.email || 'Parent'}${m.user_id === me ? ' (toi)' : ''}</div>
          <div class="meta">${m.role === 'owner' ? 'Créateur de la famille' : 'Parent'}${m.created_at ? ` · depuis le ${fmtDay(m.created_at)}` : ''}</div>
        </div>
        ${m.user_id === me && m.role !== 'owner' && html`<button class="p-btn danger" onClick=${() => remove(m)}>Quitter la famille</button>`}
        ${m.user_id !== me && myRole === 'owner' && m.role !== 'owner' && html`<button class="p-btn danger" onClick=${() => remove(m)}>Retirer</button>`}
      </div>`)}
    </div>

    ${fresh && html`<div class="invite-box">
      <p><strong>Invitation créée !</strong> Donne ce code à l'autre parent :</p>
      <span class="invite-code">${fmtCode(fresh.code)}</span>
      <p class="meta">Valable jusqu'au ${fmtDate(fresh.expires_at)} · une seule utilisation</p>
      <div class="sheet-actions" style="justify-content:flex-start">
        <button class="btn btn-blue" onClick=${() => share(fresh)}>📤 Envoyer l'invitation</button>
        <button class="p-btn danger" onClick=${() => revoke(fresh.code)}>Annuler</button>
      </div>
    </div>`}

    ${others.length > 0 && html`<div class="row-list" style="margin-top:10px">
      ${others.map((i) => html`<div key=${i.code} class="row muted-row">
        <span class="emoji">✉️</span>
        <div class="grow"><div class="title">Invitation ${fmtCode(i.code)}</div><div class="meta">En attente · valable jusqu'au ${fmtDate(i.expires_at)}</div></div>
        <button class="p-btn" onClick=${() => share(i)}>Envoyer</button>
        <button class="p-btn danger" onClick=${() => revoke(i.code)}>Annuler</button>
      </div>`)}
    </div>`}

    ${error && html`<p style="color:#b42536;font-weight:600;margin-top:8px">${error}</p>`}
    <div class="sheet-actions" style="justify-content:flex-start">
      <button class="btn btn-blue" disabled=${busy || members.length >= MAX_PARENTS} onClick=${invite}>+ Inviter un parent</button>
    </div>
    <p class="hint" style="margin-top:8px">
      L'autre parent crée son compte sur PandiFlow, puis choisit « Rejoindre une famille » avec le code.
      Un code ne sert qu'une fois et expire au bout de 48 h ; ${MAX_PARENTS} parents au maximum par famille.
      Seul le créateur de la famille peut retirer un parent.
    </p>
  </div>`;
}
