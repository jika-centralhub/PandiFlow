// Petits utilitaires de dessin SVG partagés par les objets et les costumes.
import { html } from '../vendor/preact-htm.js';

export function starPath(cx, cy, R, r = R * 0.45, n = 5) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 ? r : R;
    const a = (Math.PI / n) * i - Math.PI / 2;
    d += `${i ? 'L' : 'M'}${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)} `;
  }
  return d + 'Z';
}

export function heartPath(cx, cy, s) {
  return `M${cx} ${cy + s * 0.9} C${cx - s * 1.5} ${cy + s * 0.05} ${cx - s * 1.05} ${cy - s * 1.05} ${cx} ${cy - s * 0.35} C${cx + s * 1.05} ${cy - s * 1.05} ${cx + s * 1.5} ${cy + s * 0.05} ${cx} ${cy + s * 0.9} Z`;
}

// Symétrie gauche/droite d'un chemin en coordonnées absolues (axe x = 100)
export const mirror = (d) =>
  d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${200 - Number(x)} ${y}`);

export const grad = (id, stops, vertical = true) => html`<linearGradient id=${id} x1="0" y1="0" x2=${vertical ? 0 : 1} y2=${vertical ? 1 : 0}>
  ${stops.map((c, i) => html`<stop key=${i} offset=${`${(i / (stops.length - 1)) * 100}%`} stop-color=${c} />`)}
</linearGradient>`;

export const GOLD = ['#FFF3B0', '#FFD23F', '#E0A100'];
export const SILVER = ['#FFFFFF', '#D4DAE4', '#9AA6BA'];

export const sparkle = (x, y, s = 6, cls = 'tw', delay = 0) =>
  html`<path class=${cls} style=${{ animationDelay: `${delay}s` }} d=${`M${x} ${y - s} Q${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} Q${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} Q${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} Q${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s} Z`} fill="#FFF7C2" />`;
