// Code parent à 4 chiffres (création la première fois, puis vérification).
import { html, useState } from '../vendor/preact-htm.js';
import { useStore } from '../lib/store.js';
import * as actions from '../lib/actions.js';
import { Modal } from './ui.js';
import { sfx } from '../lib/sounds.js';

export function PinPad({ onSuccess }) {
  const s = useStore();
  const creating = !s.settings.pinHash;
  const [digits, setDigits] = useState('');
  const [first, setFirst] = useState(null);
  const [error, setError] = useState(false);

  const title = creating ? (first ? 'Confirme le code' : 'Choisis un code parent') : 'Code parent';
  const hint = creating
    ? 'Ce code à 4 chiffres protège les notes et les réglages. Les enfants ne doivent pas le connaître 😉'
    : 'Seuls les parents peuvent noter et modifier les réglages.';

  async function complete(code) {
    if (creating) {
      if (!first) {
        setFirst(code);
        setDigits('');
        return;
      }
      if (first !== code) {
        fail();
        setFirst(null);
        return;
      }
      await actions.setPin(code);
      sfx.sparkle();
      onSuccess();
      return;
    }
    if (await actions.verifyPin(code)) {
      sfx.sparkle();
      onSuccess();
    } else fail();
  }

  function fail() {
    sfx.error();
    setError(true);
    setDigits('');
    setTimeout(() => setError(false), 500);
  }

  function press(k) {
    sfx.tap();
    if (k === '⌫') return setDigits((d) => d.slice(0, -1));
    if (digits.length >= 4) return;
    const next = digits + k;
    setDigits(next);
    if (next.length === 4) setTimeout(() => complete(next), 120);
  }

  return html`<div class="pin-pad">
    <h2>${title}</h2>
    <p class="hint" style="text-align:center;max-width:36ch;color:var(--ink-soft)">${hint}</p>
    <div class=${`pin-dots ${error ? 'error' : ''}`}>${[0, 1, 2, 3].map((i) => html`<i key=${i} class=${digits.length > i ? 'on' : ''} />`)}</div>
    <div class="pin-keys">
      ${['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) =>
        k ? html`<button key=${i} onClick=${() => press(k)}>${k}</button>` : html`<span key=${i} />`,
      )}
    </div>
  </div>`;
}

export function PinGate({ onSuccess, onCancel }) {
  return html`<${Modal} onClose=${onCancel} style="width:auto"><${PinPad} onSuccess=${onSuccess} /><//>`;
}
