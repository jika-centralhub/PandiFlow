// Trésors exclusifs des défis : des compagnons magiques animés (animations dans css/avatar.css).
// Avec leur image 3D (art.js), seul leur corps change : leurs mouvements, le dentifrice, les lettres,
// la lueur et les « z » restent dessinés par-dessus.
import { html } from '../vendor/preact-htm.js';
import { hasArt, artImage } from './art.js';

// Où se posent les images 3D (repère de chaque trésor, centré en 0, 0)
const ART_AT = {
  brossou: { cx: 0, bottom: 38, h: 80 },
  tube: { img: 'brossou_tube', cx: 3, bottom: 236, h: 44 },
  livre: { cx: 0, bottom: 28, w: 56 },
  veilleuse: { cx: 0, bottom: 22, h: 48 },
};

const sparkle = (x, y, s, cls, delay = 0) =>
  html`<path class=${cls} style=${{ animationDelay: `${delay}s` }} d=${`M${x} ${y - s} Q${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} Q${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} Q${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} Q${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s} Z`} fill="#FFF7C2" />`;

// Brossou : la brosse à dents super-héros. Elle vole autour de l'enfant,
// plonge vers le tube, se met du dentifrice toute seule, fait un looping et repart.
export function Brossou({ id, small = false }) {
  return html`<g class=${small ? 'brossou-static' : ''}>
    <defs>
      <linearGradient id=${`${id}-bh`} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#7FC4FF" /><stop offset="55%" stop-color="#3E8EF0" /><stop offset="100%" stop-color="#2A64C4" /></linearGradient>
      <linearGradient id=${`${id}-tube`} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#FFFFFF" /><stop offset="100%" stop-color="#D8E4F2" /></linearGradient>
    </defs>
    ${!small && html`<g class="brossou-tube">${hasArt(ART_AT.tube.img) ? artImage(ART_AT.tube.img, ART_AT.tube) : html`
      <path d="M-14 236 L-14 206 Q-14 200 -8 200 L14 200 Q20 200 20 206 L20 236 Z" fill=${`url(#${id}-tube)`} stroke="#9FB2C9" stroke-width="1.8" />
      <rect x="-3" y="192" width="10" height="9" rx="2" fill="#E8455A" />
      <path d="M-14 214 L20 214 M-14 222 L20 222" stroke="#5EC8FF" stroke-width="3" />`}
    </g>`}
    <g class="brossou-fly">
      ${hasArt('brossou') ? html`<g class="brossou-tilt">
        ${artImage('brossou', ART_AT.brossou, small)}
        <g class="brossou-paste">${PASTE}</g>
        ${sparkle(14, -30, 4, 'tw', 0.2)}${sparkle(-14, -20, 3, 'tw', 0.9)}
      </g>` : html`<g class="brossou-tilt">
        <path class="brossou-cape" d="M-5 -2 C-18 6 -28 22 -32 38 C-20 36 -10 32 -2 26 Z" fill="#E8455A" stroke="#B02A3C" stroke-width="1.6" stroke-linejoin="round" />
        <rect x="-6.5" y="-6" width="13" height="40" rx="6.5" fill=${`url(#${id}-bh)`} stroke="#2453A8" stroke-width="1.6" />
        <rect x="-8.5" y="-26" width="17" height="21" rx="5" fill="#EEF5FF" stroke="#AFC2E0" stroke-width="1.6" />
        <rect x="-7.5" y="-36" width="15" height="11" rx="2" fill="#fff" stroke="#AFC2E0" stroke-width="1.4" />
        <path d="M-4.5 -35 L-4.5 -26 M0 -35 L0 -26 M4.5 -35 L4.5 -26" stroke="#8FD0FF" stroke-width="2" />
        <g class="brossou-paste">${PASTE}</g>
        <path d="M-6.5 1 L6.5 1 L6.5 8 L-6.5 8 Z" fill="#1D3F8A" />
        <circle cx="-2.6" cy="4.5" r="2.4" fill="#fff" /><circle cx="2.6" cy="4.5" r="2.4" fill="#fff" />
        <circle cx="-2.2" cy="4.8" r="1.2" fill="#1D1D2B" /><circle cx="3" cy="4.8" r="1.2" fill="#1D1D2B" />
        <path d="M-3 12 Q0 15.5 3 12" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" />
        <path d="M0 18 L1.6 21.4 L5.2 21.8 L2.5 24.2 L3.3 27.8 L0 26 L-3.3 27.8 L-2.5 24.2 L-5.2 21.8 L-1.6 21.4 Z" fill="#FFD23F" />
        <circle cx="-9.5" cy="14" r="3.4" fill="#3E8EF0" stroke="#2453A8" stroke-width="1.2" />
        <circle cx="9.5" cy="8" r="3.4" fill="#3E8EF0" stroke="#2453A8" stroke-width="1.2" />
        ${sparkle(14, -30, 4, 'tw', 0.2)}${sparkle(-14, -20, 3, 'tw', 0.9)}
      </g>`}
    </g>
  </g>`;
}

// Le dentifrice que Brossou se met tout seul sur les poils
const PASTE = html`<path d="M-9 -37 C-6 -45 -1 -43 0 -40 C2 -46 8 -44 9 -37 C4 -35 -4 -35 -9 -37 Z" fill="#fff" stroke="#BFE7E0" stroke-width="1" />
  <path d="M-6 -38 Q0 -41 6 -38" stroke="#4FD6B8" stroke-width="2" fill="none" />
  <path d="M-4 -40 Q0 -42 4 -40" stroke="#FF6B8B" stroke-width="1.6" fill="none" />`;

export const REWARDS = [
  {
    id: 'brossou',
    name: 'Brossou, la brosse à dents super-héros',
    short: 'Brossou',
    hint: 'Elle vole toute seule et se met du dentifrice !',
    emoji: '🪥',
    render: ({ id, thumb }) => html`<${Brossou} id=${`${id}-br`} small=${thumb} />`,
  },
  {
    id: 'bulle',
    name: 'Bubulle, la bulle magique',
    short: 'Bubulle',
    hint: 'Une bulle de savon rigolote qui flotte autour de toi.',
    emoji: '🫧',
    render: ({ id }) => html`<g class="bulle-float">
      <defs><radialGradient id=${`${id}-bu`} cx="40%" cy="35%" r="65%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.15)" /><stop offset="65%" stop-color="rgba(150,220,255,0.35)" /><stop offset="100%" stop-color="rgba(255,150,230,0.55)" />
      </radialGradient></defs>
      <g class="bulle-wobble">
        <circle cx="0" cy="0" r="22" fill=${`url(#${id}-bu)`} stroke="rgba(255,255,255,0.85)" stroke-width="1.8" />
        <path d="M-14 -8 A16 16 0 0 1 -3 -17" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round" opacity="0.85" />
        <circle cx="-6.5" cy="1" r="2.4" fill="#2A2A40" /><circle cx="6.5" cy="1" r="2.4" fill="#2A2A40" />
        <circle cx="-5.8" cy="0.2" r="0.8" fill="#fff" /><circle cx="7.2" cy="0.2" r="0.8" fill="#fff" />
        <path d="M-4 7 Q0 11 4 7" stroke="#2A2A40" stroke-width="1.8" fill="none" stroke-linecap="round" />
        <circle cx="-12" cy="6" r="3" fill="#FF9EC7" opacity="0.6" /><circle cx="12" cy="6" r="3" fill="#FF9EC7" opacity="0.6" />
      </g>
      ${[[-28, 16, 4, 0], [26, 22, 3, 0.8], [18, -26, 2.6, 1.6]].map(([x, y, r, d], i) => html`<circle key=${i} class="bubble-up" style=${{ animationDelay: `${d}s` }} cx=${x} cy=${y} r=${r} fill="rgba(200,240,255,0.4)" stroke="#fff" stroke-width="1" />`)}
    </g>`,
  },
  {
    id: 'livre',
    name: 'Le livre enchanté',
    short: 'Livre enchanté',
    hint: 'Il bat des pages comme des ailes et sème des lettres magiques.',
    emoji: '📖',
    render: () => html`<g class="livre-fly">
      ${hasArt('livre') ? html`<g class="art-flap">${artImage('livre', ART_AT.livre)}</g>` : html`<g>
      <g class="livre-wing-l">
        <path d="M0 0 L-24 -8 L-24 18 L0 26 Z" fill="#8B5CF6" stroke="#5B32C4" stroke-width="1.6" stroke-linejoin="round" />
        <path d="M0 2 L-21 -4 L-21 16 L0 22 Z" fill="#FFFAF0" />
        <path d="M-4 6 L-17 2 M-4 11 L-17 7 M-4 16 L-14 13" stroke="#C9B8E8" stroke-width="1.4" />
      </g>
      <g class="livre-wing-r">
        <path d="M0 0 L24 -8 L24 18 L0 26 Z" fill="#7C4DDB" stroke="#5B32C4" stroke-width="1.6" stroke-linejoin="round" />
        <path d="M0 2 L21 -4 L21 16 L0 22 Z" fill="#FFF6E3" />
        <path d="M4 6 L17 2 M4 11 L17 7 M4 16 L14 13" stroke="#C9B8E8" stroke-width="1.4" />
      </g>
      <rect x="-1.5" y="-1" width="3" height="28" rx="1.5" fill="#5B32C4" /></g>`}
      ${['A', 'b', '★'].map((ch, i) => html`<text key=${i} class="letter-up" style=${{ animationDelay: `${i * 0.9}s` }} x=${-10 + i * 10} y="-8" font-size="10" font-weight="700" font-family="Fredoka, sans-serif" fill=${['#FFD23F', '#FF7EB6', '#5EC8FF'][i]} text-anchor="middle">${ch}</text>`)}
    </g>`,
  },
  {
    id: 'veilleuse',
    name: 'Lulu, la veilleuse étoilée',
    short: 'Veilleuse',
    hint: 'Une petite étoile qui brille doucement pour la nuit.',
    emoji: '⭐',
    render: ({ id }) => html`<g class="veilleuse-float">
      <defs><radialGradient id=${`${id}-glow`}><stop offset="0%" stop-color="rgba(255,236,150,0.85)" /><stop offset="100%" stop-color="rgba(255,236,150,0)" /></radialGradient>
        <linearGradient id=${`${id}-st`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFF3B0" /><stop offset="100%" stop-color="#FFC21F" /></linearGradient></defs>
      <circle class="glow-pulse" cx="0" cy="0" r="36" fill=${`url(#${id}-glow)`} />
      ${hasArt('veilleuse') ? artImage('veilleuse', ART_AT.veilleuse) : html`<g>
      <path d="M0 -24 L7 -8 L24 -7 L11 4 L15 21 L0 12 L-15 21 L-11 4 L-24 -7 L-7 -8 Z" fill=${`url(#${id}-st)`} stroke="#E0A100" stroke-width="2" stroke-linejoin="round" />
      <path d="M-8 -1 Q-5 2 -2 -1 M2 -1 Q5 2 8 -1" stroke="#7A4A10" stroke-width="1.8" fill="none" stroke-linecap="round" />
      <path d="M-3 6 Q0 8.5 3 6" stroke="#7A4A10" stroke-width="1.6" fill="none" stroke-linecap="round" />
      <circle cx="-10" cy="4" r="2.4" fill="#FF9EC7" opacity="0.7" /><circle cx="10" cy="4" r="2.4" fill="#FF9EC7" opacity="0.7" /></g>`}
      ${[0, 1, 2].map((i) => html`<text key=${i} class="zzz" style=${{ animationDelay: `${i * 1}s` }} x="18" y="-16" font-size=${8 + i * 2} font-weight="700" font-family="Fredoka, sans-serif" fill="#E8E4FF">z</text>`)}
    </g>`,
  },
];
