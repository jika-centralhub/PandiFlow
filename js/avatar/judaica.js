// Rayon « Judaïsme » de la boutique : kippas (sur la tête), talit katan (sur le haut) et objets de la
// maison juive posés à côté de l'enfant dans sa scène (sidour, tehilim, houmash, bougies de Chabbat,
// Sefer Torah). Les kippas et le talit katan ne sont proposés qu'aux garçons (only: 'garcon').
// Repères : kippas dessinées pour un haut de crâne à y = 26 (comme les chapeaux), talit katan dans le
// repère du buste (encolure à y = 183, mains sur les hanches vers y = 240), objets dans la scène du
// garage (sol à y = 178), avec leur hauteur réelle en cm (real) pour être à l'échelle de l'enfant.
import { html } from '../vendor/preact-htm.js';
import { starPath, grad, GOLD, SILVER, sparkle } from './draw.js';

// Étoile de David (hexagramme plein) ; r = rayon des pointes
export const davidStar = (cx, cy, r) => starPath(cx, cy, r, r * 0.577, 6);
// Étoile de David en deux triangles entrelacés (contour)
const davidLines = (cx, cy, r) => {
  const p = (a) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  const t = (a0) => `M${p(a0)} L${p(a0 + (2 * Math.PI) / 3)} L${p(a0 + (4 * Math.PI) / 3)} Z`;
  return `${t(-Math.PI / 2)} ${t(Math.PI / 2)}`;
};

// --- Kippas -------------------------------------------------------------------------------------
// Calotte vue de face, posée sur le haut du crâne : le bord suit l'arrondi de la tête
const DOME = 'M64 35 C65 13 135 13 136 35 C116 28.5 84 28.5 64 35 Z';
const RIM = 'M64 35 C84 28.5 116 28.5 136 35';

function kippa({ id, fill, rim, pattern = null, sheen = 0.28 }) {
  return html`<g>
    <defs><clipPath id=${`${id}-kc`}><path d=${DOME} /></clipPath></defs>
    <path d=${DOME} fill=${fill} />
    ${pattern && html`<g clip-path=${`url(#${id}-kc)`}>${pattern}</g>`}
    <path d=${DOME} fill="none" stroke=${rim} stroke-width="1.6" stroke-linejoin="round" />
    <path d=${RIM} fill="none" stroke=${rim} stroke-width="2.6" stroke-linecap="round" />
    <path d="M80 21 C90 16.5 108 16 120 20" stroke="#fff" stroke-width="3" fill="none" opacity=${sheen} stroke-linecap="round" />
  </g>`;
}

const zigzag = (y, h, step, color, width = 2.4) => {
  let d = `M58 ${y}`;
  for (let x = 58, up = true; x <= 142; x += step, up = !up) d += ` L${x} ${up ? y - h : y}`;
  return html`<path d=${d} stroke=${color} stroke-width=${width} fill="none" stroke-linejoin="round" />`;
};

const KIPPAS = [
  {
    id: 'kippa_velours', name: 'Kippa en velours noir', short: 'Kippa velours', price: 25,
    render: ({ id }) => html`<g><defs>${grad(`${id}-kv`, ['#4A4A5C', '#22222C', '#0E0E14'])}</defs>${kippa({ id, fill: `url(#${id}-kv)`, rim: '#08080C', sheen: 0.22 })}</g>`,
  },
  {
    id: 'kippa_srouga', name: 'Kippa srouga au crochet', short: 'Kippa srouga', price: 30,
    render: ({ id }) => kippa({
      id, fill: '#F6F2E8', rim: '#2F5FC4', sheen: 0.4,
      pattern: html`<g>${zigzag(31, 4, 5, '#2F74D6')}${zigzag(25, 3.4, 5, '#FF8A2B', 2)}${zigzag(19.5, 3, 5, '#2F74D6', 1.8)}
        <circle cx="100" cy="15.5" r="3" fill="#FF8A2B" /></g>`,
    }),
  },
  {
    id: 'kippa_chabbat', name: 'Kippa blanche de Chabbat', short: 'Kippa de Chabbat', price: 35,
    render: ({ id }) => html`<g><defs>${grad(`${id}-kb`, ['#FFFFFF', '#F1F3F8', '#CDD3E0'])}${grad(`${id}-kg`, GOLD)}</defs>
      ${kippa({
        id, fill: `url(#${id}-kb)`, rim: '#B8C0D0', sheen: 0.6,
        pattern: html`<g><path d="M62 31.5 C84 25 116 25 138 31.5" stroke=${`url(#${id}-kg)`} stroke-width="2.4" fill="none" />
          ${[72, 86, 100, 114, 128].map((x) => html`<path key=${x} d=${`M${x} ${x === 100 ? 22 : 24} l2.6 -2.6 l2.6 2.6 l-2.6 2.6 Z`} transform="translate(-2.6 0)" fill="#E0A100" />`)}</g>`,
      })}</g>`,
  },
  {
    id: 'kippa_maguen', name: 'Kippa bleue Maguen David', short: 'Kippa Maguen David', price: 35,
    render: ({ id }) => html`<g><defs>${grad(`${id}-km`, ['#3C6FE0', '#1F45A8', '#132E75'])}</defs>
      ${kippa({
        id, fill: `url(#${id}-km)`, rim: '#0E2259',
        pattern: html`<g><path d="M62 32 C84 25.5 116 25.5 138 32" stroke="#fff" stroke-width="1.8" fill="none" />
          <path d=${davidLines(100, 21.5, 5.6)} stroke="#fff" stroke-width="1.5" fill="none" stroke-linejoin="round" /></g>`,
      })}</g>`,
  },
  {
    id: 'kippa_foot', name: 'Kippa ballon de foot', short: 'Kippa foot', price: 40,
    render: ({ id }) => kippa({
      id, fill: '#FFFFFF', rim: '#2B2B33', sheen: 0.5,
      pattern: html`<g fill="#2B2B33">
        <path d=${starPath(100, 21, 6, 4.9, 5)} />
        <path d=${starPath(80, 27, 5, 4.1, 5)} /><path d=${starPath(120, 27, 5, 4.1, 5)} />
        <path d=${starPath(66, 33, 4, 3.3, 5)} /><path d=${starPath(134, 33, 4, 3.3, 5)} />
      </g><path d="M100 27 L86 26 M100 27 L114 26 M100 15 L92 11 M100 15 L108 11" stroke="#2B2B33" stroke-width="0.9" />`,
    }),
  },
].map((k) => ({ ...k, slot: 'hat', rayon: 'judaica', only: 'garcon', wornThumb: 'head' }));

// --- Talit katan (sur le haut, sous la veste comme par-dessus le t-shirt) -----------------------
// Les quatre coins portent les tsitsit : on voit les deux de devant, qui se balancent
const tsitsit = (x) => html`<g class="tsitsit" style=${{ animationDelay: x < 100 ? '0s' : '-.7s' }}>
  <circle cx=${x} cy="239" r="1.9" fill="#F4F4F0" stroke="#C9CCD4" stroke-width="0.6" />
  ${[-2.4, -0.8, 0.8, 2.4].map((dx) => html`<path key=${dx} d=${`M${x} 240 C${x + dx} 248 ${x + dx * 1.3} 256 ${x + dx * 1.6} 266`} stroke="#F4F4F0" stroke-width="1.15" fill="none" stroke-linecap="round" />`)}
  ${[246, 251].map((y) => html`<path key=${y} d=${`M${x - 2} ${y} L${x + 2} ${y}`} stroke="#DADDE4" stroke-width="2.4" stroke-linecap="round" />`)}
</g>`;

const TALIT = {
  id: 'talit_katan', name: 'Talit katan', short: 'Talit katan', price: 120, slot: 'outfit', rayon: 'judaica', only: 'garcon',
  render: ({ id }) => html`<g>
    <defs>${grad(`${id}-tk`, ['#FFFFFF', '#F3F3EE', '#DCDDD6'])}</defs>
    <path d="M64 190 C78 196 88 199 100 199 C112 199 122 196 136 190 L139 238 L61 238 Z" fill=${`url(#${id}-tk)`} stroke="#C7C9C2" stroke-width="1.4" stroke-linejoin="round" />
    <path d="M64 190 C78 196 88 199 100 199 C112 199 122 196 136 190" stroke="#B9BBB3" stroke-width="2.2" fill="none" />
    ${[222, 227.5, 231.5].map((y, i) => html`<path key=${y} d=${`M61.6 ${y} L138.4 ${y}`} stroke="#1F2440" stroke-width=${i === 0 ? 2.8 : 1.6} />`)}
    <path d="M70 204 C74 214 74 226 72 236" stroke="#fff" stroke-width="3" opacity="0.5" fill="none" stroke-linecap="round" />
    ${tsitsit(63.5)}${tsitsit(136.5)}
  </g>`,
};

// --- Objets de la maison juive (dans la scène, à côté de l'enfant) -----------------------------------
const shadow = (cx, rx) => html`<ellipse cx=${cx} cy="179" rx=${rx} ry="3.4" fill="#000" opacity="0.16" />`;

// Livre debout, couverture de face ; sa couverture s'ouvre pendant le numéro (act-page)
function book({ id, x, w, h, cover, edge = '#F6E7B8', title = null, emblem }) {
  const y = 178 - h;
  return html`<g>
    ${shadow(x + w / 2, w * 0.7)}
    <defs>${grad(`${id}-bc`, cover, false)}</defs>
    <rect x=${x + 3} y=${y + 1.5} width=${w - 3} height=${h - 3} rx="1.5" fill=${edge} />
    ${[0.3, 0.55, 0.8].map((k) => html`<path key=${k} d=${`M${x + 4} ${y + 1.5 + (h - 3) * k} L${x + w - 1} ${y + 1.5 + (h - 3) * k}`} stroke="#D9C68E" stroke-width="0.6" />`)}
    <g class="bk-pages">${[0, 1, 2].map((i) => html`<rect key=${i} class=${`bk-page p${i}`} x=${x + 1.5} y=${y + 2} width=${w - 3} height=${h - 4} rx="1" fill="#FFFDF4" stroke="#E3D7B5" stroke-width="0.6" />`)}</g>
    <g class="bk-cover">
      <rect x=${x} y=${y} width=${w} height=${h} rx="2.2" fill=${`url(#${id}-bc)`} stroke="rgba(0,0,0,.35)" stroke-width="1" />
      <rect x=${x} y=${y} width="3.4" height=${h} rx="1.5" fill="rgba(0,0,0,.22)" />
      <rect x=${x + 3.2} y=${y + 2.6} width=${w - 5.8} height=${h - 5.2} rx="1.4" fill="none" stroke="#E8C25A" stroke-width="0.9" />
      ${emblem}
      ${title && html`<text x=${x + w / 2 + 1.6} y=${y + h - 6} text-anchor="middle" font-size=${Math.max(4.2, w * 0.2)} font-weight="700" fill="#F2CE62" direction="rtl" font-family="'Frank Ruhl Libre', 'David', 'Arial Hebrew', 'Noto Sans Hebrew', serif">${title}</text>`}
    </g>
  </g>`;
}

// Lettres hébraïques qui s'envolent du livre ouvert
const letters = (x, y, list) => html`<g class="bk-letters">${list.map((l, i) => html`<text key=${i} class="bk-letter" style=${{ '--dx': `${(i - 1) * 9}px`, animationDelay: `${i * 0.22}s` }} x=${x} y=${y} text-anchor="middle" font-size="9" font-weight="700" fill="#E0A100" font-family="'Frank Ruhl Libre', 'David', 'Arial Hebrew', 'Noto Sans Hebrew', serif">${l}</text>`)}</g>`;

// Petite harpe (kinor) du roi David, sur la couverture du Tehilim
const harp = (cx, cy, s) => html`<g transform=${`translate(${cx} ${cy}) scale(${s})`}>
  <path d="M-5 6 L-5 -6 C-2 -8 3 -6 5 -2 C6 1 5 4 3 6 Z" fill="none" stroke="#F2CE62" stroke-width="1.4" stroke-linejoin="round" />
  <path d="M-3 5.4 L-3 -5.6 M-1 5.6 L-1 -6 M1 5.6 L1 -5.2 M3 5.2 L3 -3.6" stroke="#F2CE62" stroke-width="0.6" />
</g>`;

const JUDAICA = [
  {
    id: 'sidour', act: 'page', sound: 'page', name: 'Sidour', price: 60, real: 16, drawH: 31, box: '12 128 56 54',
    render: ({ id }) => html`<g>
      ${book({ id, x: 29, w: 23, h: 31, cover: ['#2A3F8F', '#1C2D6B', '#13204D'], title: 'סידור', emblem: html`<path d=${davidLines(41.6, 160, 5.4)} stroke="#F2CE62" stroke-width="1.2" fill="none" stroke-linejoin="round" />` })}
      ${letters(41, 150, ['א', 'ב', 'ג'])}
    </g>`,
  },
  {
    id: 'tehilim', act: 'page', sound: 'harp', name: 'Tehilim', price: 60, real: 14, drawH: 26, box: '12 132 56 50',
    render: ({ id }) => html`<g>
      ${book({ id, x: 30, w: 20, h: 26, cover: ['#9A2340', '#7A1530', '#560C20'], title: 'תהלים', emblem: harp(40.6, 162, 0.85) })}
      <g class="bk-letters">${['♪', '♫', '♪'].map((n, i) => html`<text key=${i} class="bk-letter" style=${{ '--dx': `${(i - 1) * 10}px`, animationDelay: `${i * 0.25}s` }} x="40" y="152" text-anchor="middle" font-size="9" fill="#E0A100">${n}</text>`)}</g>
    </g>`,
  },
  {
    id: 'houmash', act: 'page', sound: 'page', name: 'Houmash', price: 90, real: 22, drawH: 40, box: '8 118 64 64',
    render: ({ id }) => html`<g>
      ${book({ id, x: 25, w: 31, h: 40, cover: ['#7A4A26', '#5A3418', '#3E220E'], title: 'חומש', emblem: html`<g>
        <path d="M33 146 L48 146 L48 160 C48 164 33 164 33 160 Z" fill="none" stroke="#F2CE62" stroke-width="1" />
        <path d="M37 150 L44 150 M37 153.5 L44 153.5 M37 157 L42 157" stroke="#F2CE62" stroke-width="0.9" />
        <path d="M36 146 C36 142 45 142 45 146" fill="none" stroke="#F2CE62" stroke-width="1" /></g>` })}
      ${letters(42, 136, ['ב', 'ש', 'ת'])}
    </g>`,
  },
  {
    id: 'bougies_chabbat', act: 'light', sound: 'chime', name: 'Bougies de Chabbat', short: 'Bougies de Chabbat', price: 50, real: 30, drawH: 76, box: '6 86 68 96',
    star: 'fille',
    render: ({ id }) => {
      const stick = (x) => html`<g>
        <ellipse cx=${x} cy="172" rx="7" ry="2.6" fill=${`url(#${id}-sv)`} stroke="#8994A8" stroke-width="0.8" />
        <path d=${`M${x - 2} 171 C${x - 2.4} 160 ${x - 1.4} 150 ${x - 1.6} 141 L${x + 1.6} 141 C${x + 1.4} 150 ${x + 2.4} 160 ${x + 2} 171 Z`} fill=${`url(#${id}-sv)`} stroke="#8994A8" stroke-width="0.7" />
        <ellipse cx=${x} cy="157" rx="3.4" ry="1.6" fill=${`url(#${id}-sv)`} stroke="#8994A8" stroke-width="0.6" />
        <path d=${`M${x - 6} 139 C${x - 5} 143 ${x + 5} 143 ${x + 6} 139 Z`} fill=${`url(#${id}-sv)`} stroke="#8994A8" stroke-width="0.8" />
        <rect x=${x - 2.8} y="118" width="5.6" height="21.5" rx="1.2" fill="#FFFBF0" stroke="#E6DEC8" stroke-width="0.6" />
        <path d=${`M${x} 118 L${x} 115.5`} stroke="#3A2A22" stroke-width="0.8" />
        <circle class="candle-glow" cx=${x} cy="110" r="9" fill=${`url(#${id}-glow)`} />
        <g class="candle-flame"><path d=${`M${x} 103 C${x + 3.6} 108 ${x + 3.4} 113 ${x} 115.5 C${x - 3.4} 113 ${x - 3.6} 108 ${x} 103 Z`} fill="#FFB13B" />
          <path d=${`M${x} 107 C${x + 1.8} 110 ${x + 1.6} 113 ${x} 114.6 C${x - 1.6} 113 ${x - 1.8} 110 ${x} 107 Z`} fill="#FFF6C8" /></g>
      </g>`;
      return html`<g>
        <defs>${grad(`${id}-sv`, SILVER, false)}
          <radialGradient id=${`${id}-glow`}><stop offset="0%" stop-color="#FFE9A0" stop-opacity="0.85" /><stop offset="100%" stop-color="#FFE9A0" stop-opacity="0" /></radialGradient></defs>
        ${shadow(40, 26)}
        <ellipse cx="40" cy="175" rx="27" ry="4" fill=${`url(#${id}-sv)`} stroke="#8994A8" stroke-width="0.8" />
        ${stick(29)}${stick(51)}
        <g class="chabbat-sparkles">${sparkle(18, 104, 4, 'tw', 0)}${sparkle(62, 98, 5, 'tw', 0.6)}${sparkle(40, 92, 3.4, 'tw', 1.1)}</g>
      </g>`;
    },
  },
  {
    id: 'sefer_torah', act: 'bells', sound: 'bells', name: 'Sefer Torah', price: 500, real: 34, drawH: 118, box: '0 52 80 130',
    render: ({ id }) => {
      // Rimon (couronne d'argent à clochettes) au sommet de chaque rouleau
      const rimon = (x) => html`<g class="rimon" style=${{ animationDelay: x < 40 ? '0s' : '-.3s' }}>
        <path d=${`M${x} 94 L${x} 80`} stroke="#8B5A2B" stroke-width="2.6" />
        <path d=${`M${x - 6} 80 C${x - 7} 70 ${x - 3} 64 ${x} 62 C${x + 3} 64 ${x + 7} 70 ${x + 6} 80 Z`} fill=${`url(#${id}-sv)`} stroke="#7D889C" stroke-width="0.8" />
        <path d=${`M${x - 7} 80 L${x + 7} 80`} stroke="#7D889C" stroke-width="1.6" stroke-linecap="round" />
        <circle cx=${x} cy="60" r="2" fill="#FFD23F" />
        ${[-5, 0, 5].map((dx) => html`<circle key=${dx} class="bell" cx=${x + dx} cy="84" r="1.8" fill=${`url(#${id}-gd)`} />`)}
      </g>`;
      return html`<g>
        <defs>${grad(`${id}-sv`, SILVER, false)}${grad(`${id}-gd`, GOLD)}${grad(`${id}-mt`, ['#3546A8', '#1E2A6B', '#121A48'], false)}
          <linearGradient id=${`${id}-wd`} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#A8743E" /><stop offset="50%" stop-color="#D19A5E" /><stop offset="100%" stop-color="#7E4F24" /></linearGradient></defs>
        ${shadow(40, 24)}
        <rect x="27" y="164" width="4" height="14" rx="1.6" fill=${`url(#${id}-wd)`} /><rect x="49" y="164" width="4" height="14" rx="1.6" fill=${`url(#${id}-wd)`} />
        <ellipse cx="29" cy="165" rx="6" ry="2" fill="#8B5A2B" /><ellipse cx="51" cy="165" rx="6" ry="2" fill="#8B5A2B" />
        ${rimon(29)}${rimon(51)}
        <path d="M18 98 C18 92 28 91 40 91 C52 91 62 92 62 98 L63 162 C52 166 28 166 17 162 Z" fill=${`url(#${id}-mt)`} stroke="#0C1236" stroke-width="1.2" />
        <path d="M40 92 L40 164" stroke="rgba(0,0,0,.25)" stroke-width="1.2" />
        <path d="M18.6 152 C30 156 50 156 62.4 152" stroke=${`url(#${id}-gd)`} stroke-width="2.4" fill="none" />
        <path d="M18 100 C30 96.5 50 96.5 62 100" stroke=${`url(#${id}-gd)`} stroke-width="2" fill="none" />
        <g transform="translate(40 116)">
          <path d="M-9 4 L-10 -6 L-5 -1.5 L0 -9 L5 -1.5 L10 -6 L9 4 Z" fill=${`url(#${id}-gd)`} stroke="#B8860B" stroke-width="0.8" stroke-linejoin="round" />
          <circle cx="-10" cy="-6.6" r="1.3" fill="#FFF3B0" /><circle cx="0" cy="-9.6" r="1.4" fill="#FFF3B0" /><circle cx="10" cy="-6.6" r="1.3" fill="#FFF3B0" />
        </g>
        <path d=${davidLines(40, 136, 8)} stroke=${`url(#${id}-gd)`} stroke-width="1.8" fill="none" stroke-linejoin="round" />
        <path d="M24 104 C26 120 26 140 24 156" stroke="#fff" stroke-width="2.6" opacity="0.2" fill="none" stroke-linecap="round" />
        <g class="torah-sparkles">${sparkle(10, 74, 5, 'tw', 0.2)}${sparkle(70, 70, 4, 'tw', 0.9)}${sparkle(68, 120, 3.4, 'tw', 1.4)}</g>
      </g>`;
    },
  },
].map((it) => ({ ...it, slot: 'judaica', rayon: 'judaica', garage: true }));

export const JUDAICA_WEAR = { hats: KIPPAS, outfits: [TALIT] };
export const JUDAICA_ITEMS = JUDAICA;
export const JUDAICA_SLOT = { judaica: { label: 'Judaïsme', icon: '✡️' } };
