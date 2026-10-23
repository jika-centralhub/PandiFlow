export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  }));

// Mesure nommée, lue par le compteur de performance caché (js/lib/perf.js) ; sans effet sinon
export function measure(name, start, detail) {
  try {
    performance.measure(name, { start, detail });
  } catch {
    /* navigateur sans mesures nommées */
  }
}

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const rand = (min, max) => min + Math.random() * (max - min);

// --- Couleurs ---------------------------------------------------------------
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
// amount > 0 éclaircit vers le blanc, amount < 0 assombrit vers le noir (-1..1)
export function shade(hex, amount) {
  const rgb = hexToRgb(hex);
  const target = amount >= 0 ? 255 : 0;
  const a = Math.abs(amount);
  return rgbToHex(rgb.map((v) => v + (target - v) * a));
}
export function mix(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return rgbToHex(a.map((v, i) => v + (b[i] - v) * t));
}
export function withAlpha(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Petit hash déterministe (pour des variations stables par enfant)
export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const prefersReducedMotion = () =>
  document.documentElement.classList.contains('reduce-motion') ||
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
