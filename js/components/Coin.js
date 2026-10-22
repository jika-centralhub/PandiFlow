// La pièce "pandi" (tête de panda dorée) et Pandi, la mascotte panda.
import { html } from '../vendor/preact-htm.js';
import { Pandi3D, has3D } from './Pandi3D.js';

let n = 0;

export const COIN_SVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="pc-g" cx="38%" cy="32%" r="70%"><stop offset="0%" stop-color="#FFF6C4"/><stop offset="55%" stop-color="#FFD23F"/><stop offset="100%" stop-color="#E09A00"/></radialGradient></defs><circle cx="32" cy="32" r="30" fill="url(#pc-g)" stroke="#C98600" stroke-width="3"/><circle cx="32" cy="32" r="23" fill="none" stroke="#FFF0A0" stroke-width="2" opacity=".8"/><circle cx="20" cy="20" r="6.5" fill="#2B2B33"/><circle cx="44" cy="20" r="6.5" fill="#2B2B33"/><circle cx="32" cy="34" r="16" fill="#FFFDF5"/><ellipse cx="25.5" cy="32" rx="4.6" ry="5.6" fill="#2B2B33" transform="rotate(-25 25.5 32)"/><ellipse cx="38.5" cy="32" rx="4.6" ry="5.6" fill="#2B2B33" transform="rotate(25 38.5 32)"/><circle cx="26" cy="31.5" r="1.7" fill="#fff"/><circle cx="38" cy="31.5" r="1.7" fill="#fff"/><ellipse cx="32" cy="39" rx="2.8" ry="2" fill="#2B2B33"/><path d="M29 42 Q32 45 35 42" stroke="#2B2B33" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M14 18 Q20 9 30 8" stroke="#fff" stroke-width="3" fill="none" opacity=".7" stroke-linecap="round"/></svg>`;

export function Coin({ class: cls = 'coin' }) {
  return html`<span class=${cls} style="display:inline-block" dangerouslySetInnerHTML=${{ __html: COIN_SVG }} />`;
}

// Pandi, la mascotte : en 3D quand le téléphone sait le faire, sinon le panda dessiné ci-dessous.
// mood : 'neutral' (coucou), 'happy' (sauts de joie), 'sad' (tête basse)
export function Pandi({ class: cls = 'mascot', wave = true, mood = 'neutral' }) {
  if (has3D()) return html`<${Pandi3D} class=${cls} act=${mood === 'happy' ? 'bravo' : mood === 'sad' ? 'triste' : wave ? 'coucou' : 'idle'} />`;
  return html`<${PandiFlat} class=${cls} wave=${wave} mood=${mood} />`;
}

// Le Pandi dessiné : un panda tout rond qui fait coucou
export function PandiFlat({ class: cls = 'mascot', wave = true, mood = 'neutral' }) {
  const id = `pandi${++n}`;
  const b = `url(#${id}-b)`;
  const happy = mood === 'happy';
  const sad = mood === 'sad';
  return html`<svg class=${`${cls} pandi-${mood}`} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-label="Pandi le panda">
    <defs>
      <radialGradient id=${`${id}-w`} cx="40%" cy="30%" r="75%"><stop offset="0%" stop-color="#FFFFFF" /><stop offset="100%" stop-color="#E4E2EE" /></radialGradient>
      <radialGradient id=${`${id}-b`} cx="40%" cy="30%" r="75%"><stop offset="0%" stop-color="#4A4A58" /><stop offset="100%" stop-color="#1E1E26" /></radialGradient>
    </defs>
    <ellipse cx="100" cy="188" rx="56" ry="8" fill="#000" opacity="0.18" />
    <ellipse cx="100" cy="150" rx="56" ry="40" fill=${b} />
    <ellipse cx="100" cy="156" rx="34" ry="28" fill=${`url(#${id}-w)`} />
    <ellipse cx="70" cy="182" rx="18" ry="11" fill=${b} /><ellipse cx="130" cy="182" rx="18" ry="11" fill=${b} />
    ${sad
      ? html`<g><ellipse cx="62" cy="150" rx="13" ry="22" fill=${b} transform="rotate(30 62 150)" /><ellipse cx="138" cy="150" rx="13" ry="22" fill=${b} transform="rotate(-30 138 150)" /></g>`
      : html`<g>
          <g class=${wave || happy ? 'pandi-wave' : ''} style="transform-box: fill-box; transform-origin: 20% 90%">
            <ellipse cx="160" cy="118" rx="14" ry="24" fill=${b} transform="rotate(-35 160 118)" />
          </g>
          ${happy
            ? html`<g class="pandi-wave-l" style="transform-box: fill-box; transform-origin: 80% 90%"><ellipse cx="40" cy="118" rx="14" ry="24" fill=${b} transform="rotate(35 40 118)" /></g>`
            : html`<ellipse cx="44" cy="140" rx="14" ry="22" fill=${b} transform="rotate(20 44 140)" />`}
        </g>`}
    <g transform=${sad ? 'rotate(-14 56 40) translate(4 10)' : ''}><circle cx="56" cy="40" r="20" fill=${b} /></g>
    <g transform=${sad ? 'rotate(14 144 40) translate(-4 10)' : ''}><circle cx="144" cy="40" r="20" fill=${b} /></g>
    <circle cx="100" cy="82" r="56" fill=${`url(#${id}-w)`} />
    <ellipse cx="78" cy="82" rx="14" ry="18" fill=${b} transform="rotate(-28 78 82)" />
    <ellipse cx="122" cy="82" rx="14" ry="18" fill=${b} transform="rotate(28 122 82)" />
    ${happy
      ? html`<g stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"><path d="M72 84 Q80 74 88 84" /><path d="M112 84 Q120 74 128 84" /></g>`
      : html`<g class="pandi-eyes" style="transform-box: fill-box; transform-origin: center">
          <circle cx="80" cy=${sad ? 84 : 80} r="6.5" fill="#fff" /><circle cx="120" cy=${sad ? 84 : 80} r="6.5" fill="#fff" />
          <circle cx=${sad ? 80 : 81} cy=${sad ? 87 : 81} r="3.4" fill="#1E1E26" /><circle cx=${sad ? 120 : 121} cy=${sad ? 87 : 81} r="3.4" fill="#1E1E26" />
        </g>`}
    ${sad && html`<g stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M70 70 L88 64" /><path d="M130 70 L112 64" /></g>`}
    <ellipse cx="100" cy="100" rx="8" ry="5.6" fill="#1E1E26" />
    ${happy
      ? html`<g><path d="M88 106 Q100 126 112 106 Q100 110 88 106 Z" fill="#7A2A36" stroke="#1E1E26" stroke-width="2.4" stroke-linejoin="round" /><ellipse cx="100" cy="115" rx="5" ry="3" fill="#FF7D8A" /></g>`
      : sad
        ? html`<path d="M90 116 Q100 106 110 116" stroke="#1E1E26" stroke-width="3.4" fill="none" stroke-linecap="round" />`
        : html`<path d="M92 108 Q100 116 108 108" stroke="#1E1E26" stroke-width="3.4" fill="none" stroke-linecap="round" />`}
    <circle cx="66" cy="104" r="8" fill="#FF9EC7" opacity=${happy ? 0.8 : sad ? 0.25 : 0.55} /><circle cx="134" cy="104" r="8" fill="#FF9EC7" opacity=${happy ? 0.8 : sad ? 0.25 : 0.55} />
    ${sad && html`<path class="pandi-tear" d="M78 96 C74 104 74 108 78 110 C82 108 82 104 78 96 Z" fill="#7FC4FF" stroke="#4C86C9" stroke-width="1" />`}
    <path d="M58 52 Q72 34 96 30" stroke="#fff" stroke-width="5" fill="none" opacity="0.7" stroke-linecap="round" />
  </svg>`;
}
