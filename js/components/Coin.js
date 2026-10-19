// La pièce "pandi" (tête de panda dorée) et Pandi, la mascotte panda.
import { html } from '../vendor/preact-htm.js';

let n = 0;

export const COIN_SVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="pc-g" cx="38%" cy="32%" r="70%"><stop offset="0%" stop-color="#FFF6C4"/><stop offset="55%" stop-color="#FFD23F"/><stop offset="100%" stop-color="#E09A00"/></radialGradient></defs><circle cx="32" cy="32" r="30" fill="url(#pc-g)" stroke="#C98600" stroke-width="3"/><circle cx="32" cy="32" r="23" fill="none" stroke="#FFF0A0" stroke-width="2" opacity=".8"/><circle cx="20" cy="20" r="6.5" fill="#2B2B33"/><circle cx="44" cy="20" r="6.5" fill="#2B2B33"/><circle cx="32" cy="34" r="16" fill="#FFFDF5"/><ellipse cx="25.5" cy="32" rx="4.6" ry="5.6" fill="#2B2B33" transform="rotate(-25 25.5 32)"/><ellipse cx="38.5" cy="32" rx="4.6" ry="5.6" fill="#2B2B33" transform="rotate(25 38.5 32)"/><circle cx="26" cy="31.5" r="1.7" fill="#fff"/><circle cx="38" cy="31.5" r="1.7" fill="#fff"/><ellipse cx="32" cy="39" rx="2.8" ry="2" fill="#2B2B33"/><path d="M29 42 Q32 45 35 42" stroke="#2B2B33" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M14 18 Q20 9 30 8" stroke="#fff" stroke-width="3" fill="none" opacity=".7" stroke-linecap="round"/></svg>`;

export function Coin({ class: cls = 'coin' }) {
  return html`<span class=${cls} style="display:inline-block" dangerouslySetInnerHTML=${{ __html: COIN_SVG }} />`;
}

// Pandi, la mascotte : un panda tout rond qui fait coucou
export function Pandi({ class: cls = 'mascot', wave = true }) {
  const id = `pandi${++n}`;
  return html`<svg class=${cls} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-label="Pandi le panda">
    <defs>
      <radialGradient id=${`${id}-w`} cx="40%" cy="30%" r="75%"><stop offset="0%" stop-color="#FFFFFF" /><stop offset="100%" stop-color="#E4E2EE" /></radialGradient>
      <radialGradient id=${`${id}-b`} cx="40%" cy="30%" r="75%"><stop offset="0%" stop-color="#4A4A58" /><stop offset="100%" stop-color="#1E1E26" /></radialGradient>
    </defs>
    <ellipse cx="100" cy="188" rx="56" ry="8" fill="#000" opacity="0.18" />
    <ellipse cx="100" cy="150" rx="56" ry="40" fill=${`url(#${id}-b)`} />
    <ellipse cx="100" cy="156" rx="34" ry="28" fill=${`url(#${id}-w)`} />
    <ellipse cx="70" cy="182" rx="18" ry="11" fill=${`url(#${id}-b)`} /><ellipse cx="130" cy="182" rx="18" ry="11" fill=${`url(#${id}-b)`} />
    <g class=${wave ? 'pandi-wave' : ''} style="transform-box: fill-box; transform-origin: 20% 90%">
      <ellipse cx="160" cy="118" rx="14" ry="24" fill=${`url(#${id}-b)`} transform="rotate(-35 160 118)" />
    </g>
    <ellipse cx="44" cy="140" rx="14" ry="22" fill=${`url(#${id}-b)`} transform="rotate(20 44 140)" />
    <circle cx="56" cy="40" r="20" fill=${`url(#${id}-b)`} /><circle cx="144" cy="40" r="20" fill=${`url(#${id}-b)`} />
    <circle cx="100" cy="82" r="56" fill=${`url(#${id}-w)`} />
    <ellipse cx="78" cy="82" rx="14" ry="18" fill=${`url(#${id}-b)`} transform="rotate(-28 78 82)" />
    <ellipse cx="122" cy="82" rx="14" ry="18" fill=${`url(#${id}-b)`} transform="rotate(28 122 82)" />
    <g class="pandi-eyes" style="transform-box: fill-box; transform-origin: center">
      <circle cx="80" cy="80" r="6.5" fill="#fff" /><circle cx="120" cy="80" r="6.5" fill="#fff" />
      <circle cx="81" cy="81" r="3.4" fill="#1E1E26" /><circle cx="121" cy="81" r="3.4" fill="#1E1E26" />
    </g>
    <ellipse cx="100" cy="100" rx="8" ry="5.6" fill="#1E1E26" />
    <path d="M92 108 Q100 116 108 108" stroke="#1E1E26" stroke-width="3.4" fill="none" stroke-linecap="round" />
    <circle cx="66" cy="104" r="8" fill="#FF9EC7" opacity="0.55" /><circle cx="134" cy="104" r="8" fill="#FF9EC7" opacity="0.55" />
    <path d="M58 52 Q72 34 96 30" stroke="#fff" stroke-width="5" fill="none" opacity="0.7" stroke-linecap="round" />
  </svg>`;
}
