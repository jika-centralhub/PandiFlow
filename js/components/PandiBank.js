// La cagnotte d'un enfant : le parent offre ou retire des pandi en dehors des routines.
import { html, useState } from '../vendor/preact-htm.js';
import { useStore } from '../lib/store.js';
import * as actions from '../lib/actions.js';
import { balance } from '../domain.js';
import { Modal, NumberInput, PandiCounter } from './ui.js';
import { showOverlay } from './Overlays.js';
import { sfx } from '../lib/sounds.js';

const REASONS = {
  add: ['🤝 Aide à la maison', '💖 Gentillesse', '🧹 Rangement spontané', '📚 Effort à l’école', '🍽️ Bien mangé', '🦁 Courage', '🎁 Surprise des parents'],
  remove: ['🙉 N’a pas écouté', '😤 Colère', '🥊 Dispute', '💥 Bêtise', '🗣️ Gros mot', '📺 Trop d’écran'],
};
const AMOUNTS = [1, 2, 3, 5, 10, 20];

const shortDate = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '');

export function PandiBank({ child, onClose }) {
  const s = useStore();
  const bal = balance(child.id, s);
  const [mode, setMode] = useState('add');
  const [amount, setAmount] = useState(5);
  const [reason, setReason] = useState('');
  const [custom, setCustom] = useState('');
  const value = mode === 'remove' ? Math.min(amount, bal) : amount;
  const recent = s.ledger
    .filter((l) => l.child_id === child.id && l.kind === 'manual')
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .slice(0, 4);

  function switchMode(m) {
    sfx.tap();
    setMode(m);
    setReason('');
  }

  function confirm() {
    const note = custom.trim() || reason || null;
    const res = actions.adjustPandi(child.id, mode === 'add' ? value : -value, note);
    onClose();
    if (res.applied) showOverlay('pandi', { childId: child.id, amount: res.applied, note, before: res.before });
  }

  return html`<${Modal} onClose=${onClose} style=${{ '--kid': child.color }}>
    <div class="bank-head">
      <h2>La cagnotte de ${child.name}</h2>
      <${PandiCounter} value=${bal} big=${true} />
    </div>
    <div class="bank-modes">
      <button class=${`bank-mode add ${mode === 'add' ? 'on' : ''}`} onClick=${() => switchMode('add')}>😊 Offrir des pandi</button>
      <button class=${`bank-mode remove ${mode === 'remove' ? 'on' : ''}`} onClick=${() => switchMode('remove')}>😢 Retirer des pandi</button>
    </div>
    <div class="field">
      <label>Combien ?</label>
      <div class="chip-row" style="align-items:center">
        ${AMOUNTS.map((n) => html`<button key=${n} class=${`p-btn ${amount === n ? 'primary' : ''}`} onClick=${() => setAmount(n)}>${n}</button>`)}
        <${NumberInput} value=${amount} onChange=${setAmount} min=${1} max=${500} />
      </div>
      ${mode === 'remove' && amount > bal && html`<p class="hint" style="margin:6px 0 0">${bal > 0 ? `La cagnotte ne contient que ${bal} pandi : on en retirera ${bal}.` : 'La cagnotte est déjà vide.'}</p>`}
    </div>
    <div class="field">
      <label>Pourquoi ?</label>
      <div class="chip-row">
        ${REASONS[mode].map((r) => html`<button key=${r} class=${`p-btn ${reason === r && !custom ? 'primary' : ''}`} onClick=${() => { setReason(reason === r ? '' : r); setCustom(''); }}>${r}</button>`)}
      </div>
      <input class="input" style="margin-top:8px" value=${custom} maxLength="40" onInput=${(e) => setCustom(e.target.value)} placeholder="Ou écris une autre raison…" />
    </div>
    <div class="sheet-actions">
      <button class=${`btn btn-big ${mode === 'add' ? 'btn-green' : 'btn-danger'}`} disabled=${value <= 0} onClick=${confirm}>
        ${mode === 'add' ? `Offrir ${value} pandi` : `Retirer ${value} pandi`}
      </button>
    </div>
    ${recent.length > 0 && html`<div class="bank-history">
      <h3>Derniers bonus et retraits</h3>
      ${recent.map((l) => html`<div key=${l.id} class="bank-line">
        <strong class=${l.amount > 0 ? 'plus' : 'minus'}>${l.amount > 0 ? `+${l.amount}` : `−${-l.amount}`}</strong>
        <span>${l.note}</span>
        <em>${shortDate(l.created_at)}</em>
      </div>`)}
    </div>`}
  <//>`;
}
