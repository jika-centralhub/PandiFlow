// Petits composants d'interface réutilisés partout.
import { html, useEffect, useRef, useState } from '../vendor/preact-htm.js';
import { Coin } from './Coin.js';
import { useStore } from '../lib/store.js';
import { sfx } from '../lib/sounds.js';
import { prefersReducedMotion } from '../lib/util.js';
import { KID_PALETTE } from '../avatar/palette.js';
import { SEXES } from '../domain.js';

// Compteur de pandi : le nombre défile comme un compteur kilométrique
export function PandiCounter({ value, big = false, counterRef, id }) {
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  const el = useRef(null);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (from === value) return;
    if (prefersReducedMotion() || !window.gsap) {
      setShown(value);
      return;
    }
    const obj = { v: from };
    const tween = window.gsap.to(obj, {
      v: value,
      duration: Math.min(1.2, 0.3 + Math.abs(value - from) * 0.05),
      ease: 'power2.out',
      onUpdate: () => setShown(Math.round(obj.v)),
    });
    el.current?.classList.remove('bump');
    void el.current?.offsetWidth;
    el.current?.classList.add('bump');
    return () => tween.kill();
  }, [value]);
  return html`<span class=${`pandi-counter ${big ? 'big' : ''}`} id=${id} ref=${(n) => { el.current = n; if (counterRef) counterRef.current = n; }}>
    <${Coin} />${shown}
  </span>`;
}

export function Modal({ onClose, children, class: cls = '', style, closable = true }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && closable && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, closable]);
  return html`<div class="overlay" onClick=${(e) => e.target === e.currentTarget && closable && onClose?.()}>
    <div class=${`sheet ${cls}`} style=${style} role="dialog" aria-modal="true">
      ${closable && html`<button class="close" aria-label="Fermer" onClick=${onClose}>✕</button>`}
      ${children}
    </div>
  </div>`;
}

export function Toast() {
  const { toast } = useStore();
  if (!toast) return null;
  return html`<div key=${toast.id} class=${`toast ${toast.kind}`} role="status">${toast.message}</div>`;
}

export function Toggle({ on, onChange, label }) {
  return html`<button class=${`toggle ${on ? 'on' : ''}`} role="switch" aria-checked=${on} aria-label=${label} onClick=${() => { sfx.tap(); onChange(!on); }} />`;
}

export function NumberInput({ value, onChange, min = 0, max = 999, step = 1 }) {
  const set = (v) => onChange(Math.max(min, Math.min(max, v)));
  return html`<span class="number-input">
    <button onClick=${() => set(value - step)} aria-label="Moins">−</button>
    <output>${value}</output>
    <button onClick=${() => set(value + step)} aria-label="Plus">+</button>
  </span>`;
}

// Couleur d'un enfant : 16 pastilles + un nuancier libre (🎨)
export function ColorPicker({ value, onChange }) {
  const custom = !KID_PALETTE.includes(value);
  const valid = /^#[0-9a-f]{6}$/i.test(value || '');
  return html`<div class="swatches">
    ${KID_PALETTE.map((c) => html`<button key=${c} class=${`swatch ${value === c ? 'on' : ''}`} style=${{ background: c }} aria-label=${`Couleur ${c}`} onClick=${() => { sfx.pop(); onChange(c); }} />`)}
    <label class=${`swatch swatch-custom ${custom ? 'on' : ''}`} style=${custom && valid ? { background: value } : null} title="Choisir une autre couleur">
      <span aria-hidden="true">🎨</span>
      <input type="color" aria-label="Choisir une autre couleur" value=${valid ? value : '#ff7eb6'} onChange=${(e) => { sfx.pop(); onChange(e.target.value); }} />
    </label>
  </div>`;
}

// Sexe de l'enfant : Garçon, Fille, ou rien (on retouche le choix pour l'enlever)
export function SexPicker({ value, onChange }) {
  return html`<span class="sex-picker">
    ${Object.entries(SEXES).map(([k, o]) => html`<button key=${k} class=${`p-btn ${value === k ? 'primary' : ''}`} aria-pressed=${value === k} onClick=${() => { sfx.pop(); onChange(value === k ? null : k); }}>${o.icon} ${o.label}</button>`)}
  </span>`;
}

export function Loading() {
  return html`<div class="loading"><${Coin} /></div>`;
}
