// La pièce "pandi" (une pièce d'or avec le visage de Pandi) et Pandi, la mascotte panda.
import { html } from '../vendor/preact-htm.js';
import { Pandi3D, has3D } from './Pandi3D.js';
import { PandiPose } from './PandiPose.js';
import { POSES } from '../config.js';

let n = 0;

// La pièce en image façon film d'animation, le même Pandi que ses poses (faite par tests/local/piece_art.py)
export const COIN_SRC = new URL('../../assets/pandi/piece.webp', import.meta.url).href;
// pour les pièces qui volent (js/anim/fx.js), créées hors de Preact
export const COIN_HTML = `<img src="${COIN_SRC}" alt="" draggable="false">`;

export function Coin({ class: cls = 'coin' }) {
  return html`<span class=${cls} style="display:inline-block"><img src=${COIN_SRC} alt="" draggable="false" /></span>`;
}

// Pandi, la mascotte : en poses illustrées (labo), sinon en 3D quand le téléphone sait le faire, sinon le
// panda dessiné ci-dessous. mood : 'neutral' (coucou), 'happy' (sauts de joie)
export function Pandi({ class: cls = 'mascot', wave = true, mood = 'neutral' }) {
  const act = mood === 'happy' ? 'bravo' : wave ? 'coucou' : 'idle';
  // la pose garde ses proportions dans la place (carrée) prévue pour la mascotte
  if (POSES) return html`<div class=${`${cls} pp-box`}><${PandiPose} act=${act} /></div>`;
  if (has3D()) return html`<${Pandi3D} class=${cls} act=${act} />`;
  return html`<${PandiFlat} class=${cls} wave=${wave} mood=${mood} />`;
}

// Le Pandi dessiné : un panda tout rond qui fait coucou
export function PandiFlat({ class: cls = 'mascot', wave = true, mood = 'neutral' }) {
  const id = `pandi${++n}`;
  const b = `url(#${id}-b)`;
  const happy = mood === 'happy';
  return html`<svg class=${`${cls} pandi-${mood}`} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-label="Pandi le panda">
    <defs>
      <radialGradient id=${`${id}-w`} cx="40%" cy="30%" r="75%"><stop offset="0%" stop-color="#FFFFFF" /><stop offset="100%" stop-color="#E4E2EE" /></radialGradient>
      <radialGradient id=${`${id}-b`} cx="40%" cy="30%" r="75%"><stop offset="0%" stop-color="#4A4A58" /><stop offset="100%" stop-color="#1E1E26" /></radialGradient>
    </defs>
    <ellipse cx="100" cy="188" rx="56" ry="8" fill="#000" opacity="0.18" />
    <ellipse cx="100" cy="150" rx="56" ry="40" fill=${b} />
    <ellipse cx="100" cy="156" rx="34" ry="28" fill=${`url(#${id}-w)`} />
    <ellipse cx="70" cy="182" rx="18" ry="11" fill=${b} /><ellipse cx="130" cy="182" rx="18" ry="11" fill=${b} />
    <g>
          <g class=${wave || happy ? 'pandi-wave' : ''} style="transform-box: fill-box; transform-origin: 20% 90%">
            <ellipse cx="160" cy="118" rx="14" ry="24" fill=${b} transform="rotate(-35 160 118)" />
          </g>
          ${happy
            ? html`<g class="pandi-wave-l" style="transform-box: fill-box; transform-origin: 80% 90%"><ellipse cx="40" cy="118" rx="14" ry="24" fill=${b} transform="rotate(35 40 118)" /></g>`
            : html`<ellipse cx="44" cy="140" rx="14" ry="22" fill=${b} transform="rotate(20 44 140)" />`}
        </g>
    <circle cx="56" cy="40" r="20" fill=${b} />
    <circle cx="144" cy="40" r="20" fill=${b} />
    <circle cx="100" cy="82" r="56" fill=${`url(#${id}-w)`} />
    <ellipse cx="78" cy="82" rx="14" ry="18" fill=${b} transform="rotate(-28 78 82)" />
    <ellipse cx="122" cy="82" rx="14" ry="18" fill=${b} transform="rotate(28 122 82)" />
    ${happy
      ? html`<g stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"><path d="M72 84 Q80 74 88 84" /><path d="M112 84 Q120 74 128 84" /></g>`
      : html`<g class="pandi-eyes" style="transform-box: fill-box; transform-origin: center">
          <circle cx="80" cy="80" r="6.5" fill="#fff" /><circle cx="120" cy="80" r="6.5" fill="#fff" />
          <circle cx="81" cy="81" r="3.4" fill="#1E1E26" /><circle cx="121" cy="81" r="3.4" fill="#1E1E26" />
        </g>`}
    <ellipse cx="100" cy="100" rx="8" ry="5.6" fill="#1E1E26" />
    ${happy
      ? html`<g><path d="M88 106 Q100 126 112 106 Q100 110 88 106 Z" fill="#7A2A36" stroke="#1E1E26" stroke-width="2.4" stroke-linejoin="round" /><ellipse cx="100" cy="115" rx="5" ry="3" fill="#FF7D8A" /></g>`
      : html`<path d="M92 108 Q100 116 108 108" stroke="#1E1E26" stroke-width="3.4" fill="none" stroke-linecap="round" />`}
    <circle cx="66" cy="104" r="8" fill="#FF9EC7" opacity=${happy ? 0.8 : 0.55} /><circle cx="134" cy="104" r="8" fill="#FF9EC7" opacity=${happy ? 0.8 : 0.55} />
    <path d="M58 52 Q72 34 96 30" stroke="#fff" stroke-width="5" fill="none" opacity="0.7" stroke-linecap="round" />
  </svg>`;
}
