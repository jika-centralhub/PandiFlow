// Petits composants d'interface réutilisés partout.
import { html, useEffect, useRef, useState } from '../vendor/preact-htm.js';
import { Coin } from './Coin.js';
import { useStore } from '../lib/store.js';
import { sfx } from '../lib/sounds.js';
import { prefersReducedMotion } from '../lib/util.js';

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

// Jauge de la soirée : un segment par tâche, coloré selon la note
export function Gauge({ segments, complete }) {
  const shine = useRef(null);
  const rated = segments.filter((s) => s.color).length;
  const prev = useRef(rated);
  useEffect(() => {
    if (rated > prev.current && shine.current) {
      shine.current.classList.remove('go');
      void shine.current.offsetWidth;
      shine.current.classList.add('go');
    }
    prev.current = rated;
  }, [rated]);
  return html`<div class="gauge" role="progressbar" aria-valuemin="0" aria-valuemax=${segments.length} aria-valuenow=${rated}>
    <div class="gauge-track">
      ${segments.map((s) => html`<div key=${s.task.id} class=${`gauge-seg ${s.color || ''}`}>${s.color && html`<i key=${s.color} />`}</div>`)}
      <div class="gauge-shine" ref=${shine} />
    </div>
    <span class=${`gauge-star ${complete ? 'lit' : ''}`}>⭐</span>
  </div>`;
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

export function Loading() {
  return html`<div class="loading"><${Coin} /></div>`;
}
