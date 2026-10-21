// Costumes complets : un seul objet habille tout le personnage (haut, manches, chapeau, masque,
// accessoire…). Repère de l'avatar : tête centrée en (100, 100), buste de y = 180 à 264,
// bras en x 43-63 et 137-157. Les chapeaux sont dessinés pour un haut de crâne à y = 26.
//
// Champs possibles d'un costume :
//   shirt, sleeve, gloves : couleurs du haut, des manches, des mains (gants) ; bareArms : bras nus (manches couleur de peau)
//   torso(ctx)    motif sur le buste (découpé à sa forme)
//   collar(ctx)   col (remplace le col par défaut)
//   sleeves(ctx,x) détail sur chaque manche (x = bord gauche de la manche)
//   over(ctx)     par-dessus le buste et les bras (stéthoscope, épaulettes…)
//   back(ctx)     derrière le personnage (cape, carapace, sac à dos)
//   face(ctx)     sur le visage (masque, barbe), sous les cheveux
//   faceTop(ctx)  par-dessus les cheveux (péot)
//   hat(ctx)      couvre-chef recalé selon la coiffure ; headFree(ctx) : sans recalage
//   prop(ctx)     objet tenu en bas à gauche
//   hideHair, hidesGlasses
// Les maillots reprennent les couleurs des équipes, sans logo officiel.
import { html } from '../vendor/preact-htm.js';
import { starPath, mirror, grad, GOLD, SILVER, sparkle } from './draw.js';
import { shade } from '../lib/util.js';

// --- Pièces réutilisées ---------------------------------------------------------------
const vNeck = (fill = '#FFFFFF') => html`<path d="M84 180 L100 210 L116 180 Z" fill=${fill} />`;
const lapels = (fill, stroke = 'none') => {
  const left = 'M85 181 L100 212 L86 252 L68 210 Z';
  return html`<g fill=${fill} stroke=${stroke} stroke-width="1.5" stroke-linejoin="round"><path d=${left} /><path d=${mirror(left)} /></g>`;
};
const buttons = (x, ys, fill, r = 2.8) => ys.map((y, i) => html`<circle key=${`${x}-${i}`} cx=${x} cy=${y} r=${r} fill=${fill} />`);
const shirtCollar = (fill = '#FFFFFF', line = '#D5DCE6') =>
  html`<path d="M84 180 L100 194 L116 180 L118 189 L100 201 L82 189 Z" fill=${fill} stroke=${line} stroke-width="1.5" stroke-linejoin="round" />`;
const bowTie = (fill) =>
  html`<g><path d="M100 190 L87 183 L87 197 Z M100 190 L113 183 L113 197 Z" fill=${fill} stroke=${shade(fill, -0.3)} stroke-width="1.4" stroke-linejoin="round" /><circle cx="100" cy="190" r="3.6" fill=${shade(fill, -0.2)} /></g>`;
const cuff = (fill, y = 224, h = 6) => (_ctx, x) => html`<rect x=${x} y=${y} width="20" height=${h} fill=${fill} />`;
const epaulettes = (fill) => html`<g>
  ${[42, 136].map((x) => html`<g key=${x}><rect x=${x} y="183" width="22" height="7" rx="3.5" fill=${fill} stroke=${shade(fill, -0.3)} stroke-width="1" />
    <path d=${`M${x + 3} 190 v7 M${x + 7} 190 v8 M${x + 11} 190 v8 M${x + 15} 190 v8 M${x + 19} 190 v7`} stroke=${fill} stroke-width="1.8" stroke-linecap="round" /></g>`)}
</g>`;
const domino = (fill) => {
  const d = 'M44 98 C66 84 134 84 156 98 C160 114 146 124 128 120 C116 118 108 112 100 112 C92 112 84 118 72 120 C54 124 40 114 44 98 Z M64 105 a14 10 0 1 0 28 0 a14 10 0 1 0 -28 0 Z M108 105 a14 10 0 1 0 28 0 a14 10 0 1 0 -28 0 Z';
  return html`<path fill-rule="evenodd" d=${d} fill=${fill} stroke=${shade(fill, -0.3)} stroke-width="2" />`;
};
const capeBack = (id, stops, cls = 'flutter') => html`<g class=${cls}>
  <defs>${grad(`${id}-cape`, stops)}</defs>
  <path d="M56 184 C30 206 12 236 2 262 C60 270 140 270 198 262 C188 236 170 206 144 184 Z" fill=${`url(#${id}-cape)`} stroke=${shade(stops[stops.length - 1], -0.3)} stroke-width="2" />
</g>`;
const topHat = (band, extra = null) => html`<g>
  <ellipse cx="100" cy="54" rx="50" ry="9" fill="#15151B" />
  <path d="M68 52 L72 -14 L128 -14 L132 52 Z" fill="#1E1E26" stroke="#000" stroke-width="1.5" stroke-linejoin="round" />
  <ellipse cx="100" cy="-14" rx="28" ry="5" fill="#2B2B33" />
  <path d="M70 36 L130 36 L131 49 L69 49 Z" fill=${band} />
  <path d="M78 -6 C78 10 77 26 76 34" stroke="#fff" stroke-width="3" opacity="0.15" fill="none" stroke-linecap="round" />
  ${extra}
</g>`;

// Ballon de foot
const pentagon = (cx, cy, R) =>
  [0, 1, 2, 3, 4].map((i) => {
    const a = ((i * 72 - 90) * Math.PI) / 180;
    return `${i ? 'L' : 'M'}${(cx + R * Math.cos(a)).toFixed(1)} ${(cy + R * Math.sin(a)).toFixed(1)}`;
  }).join(' ') + ' Z';
const ball = (cx = 16, cy = 224, r = 13) => html`<g class="spin-slow" style="animation-duration:6s">
  <circle cx=${cx} cy=${cy} r=${r} fill="#fff" stroke="#2B2B33" stroke-width="1.8" />
  <path d=${pentagon(cx, cy, r * 0.42)} fill="#2B2B33" />
  ${[0, 72, 144, 216, 288].map((a) => {
    const rad = ((a - 90) * Math.PI) / 180;
    const x = cx + Math.cos(rad) * r * 0.82;
    const y = cy + Math.sin(rad) * r * 0.82;
    return html`<circle key=${a} cx=${x.toFixed(1)} cy=${y.toFixed(1)} r=${(r * 0.2).toFixed(1)} fill="#2B2B33" />`;
  })}
</g>`;

// --- Métiers ----------------------------------------------------------------------------
const pompier = {
  id: 'pompier', name: 'Pompier', price: 150, shirt: '#25345C', gloves: '#2B2B33',
  torso: () => html`<g>
    <path d="M100 184 L100 264" stroke="#121A33" stroke-width="2.4" />
    <rect x="40" y="214" width="120" height="6" fill="#F5C518" /><rect x="40" y="221" width="120" height="4" fill="#D9DEE6" /><rect x="40" y="226" width="120" height="6" fill="#F5C518" />
    <path d="M116 194 L128 194 L128 202 Q128 208 122 210 Q116 208 116 202 Z" fill="#D7262E" stroke="#fff" stroke-width="1" />
  </g>`,
  collar: () => html`<path d="M84 180 L100 192 L116 180 L118 189 L100 199 L82 189 Z" fill="#1B2648" stroke="#121A33" stroke-width="1.4" />`,
  sleeves: (_c, x) => html`<g><rect x=${x} y="214" width="20" height="5" fill="#F5C518" /><rect x=${x} y="220" width="20" height="3" fill="#D9DEE6" /></g>`,
  hat: ({ id }) => html`<g>
    <defs>${grad(`${id}-fh`, ['#FFE27A', '#F2B600', '#C98B00'])}</defs>
    <path d="M36 72 C34 26 64 6 100 6 C136 6 166 26 164 72 C150 66 50 66 36 72 Z" fill=${`url(#${id}-fh)`} stroke="#A07000" stroke-width="2" />
    <path d="M100 8 C102 30 102 50 100 66" stroke="#FFE9A6" stroke-width="5" opacity="0.7" fill="none" />
    <path d="M42 66 Q100 54 158 66 L156 76 Q100 64 44 76 Z" fill="rgba(255,190,60,0.55)" stroke="#C98B00" stroke-width="1.5" />
    <path d="M90 28 L110 28 L110 40 Q110 50 100 54 Q90 50 90 40 Z" fill="#D7262E" stroke="#fff" stroke-width="1.5" />
    <path d="M100 32 C96 38 104 40 99 47 C104 45 106 40 103 36 Z" fill="#FFD23F" />
  </g>`,
  prop: () => html`<g transform="translate(14 206)">
    <path d="M4 -4 C16 -8 18 6 12 14" stroke="#2B2B33" stroke-width="3" fill="none" stroke-linecap="round" />
    <rect x="-9" y="0" width="18" height="34" rx="7" fill="#E23B3B" stroke="#A82323" stroke-width="1.6" />
    <rect x="-4" y="-7" width="8" height="8" rx="2" fill="#2B2B33" />
    <rect x="-9" y="12" width="18" height="7" fill="#fff" opacity="0.85" />
    <path d="M-5 4 C-5 10 -5 22 -5 30" stroke="#fff" stroke-width="2" opacity="0.35" stroke-linecap="round" />
  </g>`,
};

const police = {
  id: 'police', name: 'Tenue de police', price: 150, shirt: '#1E3770',
  torso: () => html`<g>
    <path d="M100 184 L100 264" stroke="#142856" stroke-width="2" />
    <path d="M66 200 L88 200 M112 200 L134 200" stroke="#142856" stroke-width="2" />
    <path d=${starPath(78, 210, 7, 3.4, 5)} fill="#F2C230" stroke="#B8860B" stroke-width="1" />
    <text x="100" y="240" text-anchor="middle" font-size="13" font-weight="700" letter-spacing="1" font-family="Fredoka, sans-serif" fill="#fff">POLICE</text>
  </g>`,
  collar: () => html`<path d="M84 180 L100 194 L116 180 L120 188 L100 201 L80 188 Z" fill="#162A57" stroke="#0F1F45" stroke-width="1.4" />`,
  over: () => html`<g>
    <rect x="44" y="184" width="18" height="6" rx="3" fill="#162A57" /><rect x="138" y="184" width="18" height="6" rx="3" fill="#162A57" />
    <path d="M47 187 h12 M141 187 h12" stroke="#C9D1DE" stroke-width="1.5" />
    <path d="M90 186 C84 200 86 214 94 220" stroke="#E9EEF5" stroke-width="1.6" fill="none" />
    <rect x="92" y="218" width="10" height="5" rx="2" fill="#C9D1DE" stroke="#8A96AC" stroke-width="1" />
  </g>`,
  hat: () => html`<g>
    <path d="M40 60 C40 30 68 16 100 16 C132 16 160 30 160 60 Z" fill="#1E3770" stroke="#0F1F45" stroke-width="2" />
    <path d="M40 52 L160 52 L160 64 L40 64 Z" fill="#0F1F45" />
    <path d="M40 53 L160 53 M40 63 L160 63" stroke="#C9D1DE" stroke-width="1.6" />
    <circle cx="100" cy="40" r="8" fill="#F2C230" stroke="#B8860B" stroke-width="1.5" />
    <path d=${starPath(100, 40, 4.5, 2)} fill="#fff" />
    <path d="M44 62 Q100 80 156 62 Q152 74 100 84 Q48 74 44 62 Z" fill="#111" />
    <path d="M60 70 Q100 80 140 70" stroke="#fff" stroke-width="2" opacity="0.25" fill="none" />
  </g>`,
};

const medecin = {
  id: 'medecin', name: 'Médecin', price: 150, shirt: '#F7F9FC',
  torso: () => html`<g>
    <path d="M84 180 L100 214 L116 180 Z" fill="#79C2EE" />
    ${lapels('#FFFFFF', '#D5DCE6')}
    ${buttons(100, [226, 242], '#C5CEDA')}
    <path d="M118 214 h18 v14 h-18 Z" stroke="#D5DCE6" stroke-width="1.5" fill="none" />
    <rect x="122" y="206" width="3" height="11" rx="1" fill="#3C78E0" /><rect x="127" y="207" width="3" height="10" rx="1" fill="#E0434B" />
    <rect x="66" y="208" width="16" height="10" rx="2" fill="#5EC8FF" /><path d="M69 213 h10" stroke="#fff" stroke-width="1.5" />
  </g>`,
  collar: () => null,
  over: () => html`<g fill="none" stroke-linecap="round">
    <path d="M84 186 C76 206 82 224 98 228" stroke="#3A3F4A" stroke-width="3.4" />
    <path d="M116 186 C122 200 120 214 110 224" stroke="#3A3F4A" stroke-width="3.4" />
    <circle cx="104" cy="229" r="6.5" fill="#C9D1DE" stroke="#3A3F4A" stroke-width="2" />
    <circle cx="104" cy="229" r="2.4" fill="#8A96AC" stroke="none" />
  </g>`,
  hat: ({ id }) => html`<g>
    <defs><radialGradient id=${`${id}-mir`} cx="40%" cy="35%" r="70%"><stop offset="0%" stop-color="#FFFFFF" /><stop offset="100%" stop-color="#9AA6BA" /></radialGradient></defs>
    <path d="M38 74 C58 60 142 60 162 74" stroke="#E3E7EE" stroke-width="6" fill="none" stroke-linecap="round" />
    <circle cx="100" cy="52" r="14" fill=${`url(#${id}-mir)`} stroke="#8A96AC" stroke-width="2" />
    <circle cx="100" cy="52" r="3" fill="#4A5160" />
    <path d="M92 46 Q96 42 101 42" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" />
  </g>`,
  prop: () => html`<g transform="translate(18 216)">
    <circle cx="-8" cy="-12" r="4.5" fill="#C68A4E" /><circle cx="8" cy="-12" r="4.5" fill="#C68A4E" />
    <ellipse cx="0" cy="12" rx="12" ry="11" fill="#C68A4E" />
    <circle cx="0" cy="-4" r="10" fill="#D49A5E" />
    <ellipse cx="0" cy="0" rx="4.5" ry="3.4" fill="#F0D2AE" />
    <circle cx="-3.6" cy="-6" r="1.5" fill="#2A1D1D" /><circle cx="3.6" cy="-6" r="1.5" fill="#2A1D1D" />
    <circle cx="0" cy="-1" r="1.3" fill="#2A1D1D" />
    <g transform="rotate(-30 5 -11)"><rect x="-2" y="-14" width="14" height="6" rx="2" fill="#FFF6E5" stroke="#E5D9BF" stroke-width="0.8" /><path d="M5 -13 v4 M3 -11 h4" stroke="#E0434B" stroke-width="1.2" /></g>
  </g>`,
};

const superheros = {
  id: 'superheros', name: 'Super-héros', price: 160, shirt: '#2D6CDF', gloves: '#E23B4B', hidesGlasses: true,
  back: ({ id }) => capeBack(id, ['#FF5E6C', '#D92A40', '#A81C30']),
  torso: () => html`<g>
    <circle cx="100" cy="214" r="15" fill="#FFD23F" stroke="#E0A100" stroke-width="2" />
    <path d="M104 201 L92 216 L100 216 L95 228 L109 211 L101 211 Z" fill="#E23B4B" stroke="#B02A3C" stroke-width="1" stroke-linejoin="round" />
    <rect x="40" y="246" width="120" height="8" fill="#FFD23F" /><rect x="94" y="244" width="12" height="12" rx="2" fill="#E0A100" />
  </g>`,
  collar: () => html`<g><path d="M86 181 Q100 194 114 181" fill="#2D6CDF" stroke="#1D4FA8" stroke-width="3" />
    <circle cx="82" cy="185" r="4.5" fill="#FFD23F" stroke="#E0A100" stroke-width="1" /><circle cx="118" cy="185" r="4.5" fill="#FFD23F" stroke="#E0A100" stroke-width="1" /></g>`,
  sleeves: cuff('#E23B4B', 222, 8),
  face: () => domino('#E23B4B'),
};

// --- Tortues ninja (quatre couleurs de bandeau) ------------------------------------------
function turtle(color, colorName) {
  return {
    id: `tortue_${colorName}`,
    name: `Tortue ninja ${colorName}`,
    price: 140,
    shirt: '#58B947',
    gloves: '#58B947',
    hidesGlasses: true,
    back: () => html`<g>
      <ellipse cx="100" cy="222" rx="64" ry="48" fill="#6B8E23" stroke="#4A6418" stroke-width="3" />
      <ellipse cx="100" cy="222" rx="56" ry="40" fill="none" stroke="#8DB33A" stroke-width="3" />
    </g>`,
    torso: () => html`<g>
      <path d="M72 196 C80 188 120 188 128 196 L124 256 C116 266 84 266 76 256 Z" fill="#F0CF6E" stroke="#C9A23E" stroke-width="2" />
      <path d="M74 212 L126 212 M75 228 L125 228 M77 244 L123 244 M100 190 L100 262" stroke="#C9A23E" stroke-width="1.8" />
      <rect x="40" y="236" width="120" height="8" fill="#8B5A2B" />
      <circle cx="100" cy="240" r="6.5" fill="#D9B26A" stroke="#8B5A2B" stroke-width="1.5" />
    </g>`,
    collar: () => html`<path d="M86 181 Q100 194 114 181" fill="#58B947" stroke="#3E8A31" stroke-width="3" />`,
    sleeves: (_c, x) => html`<rect x=${x} y="204" width="20" height="8" rx="3" fill=${color} />`,
    face: () => html`<g>
      <path d="M158 100 C172 104 182 112 190 124 L184 128 C178 118 168 110 156 108 Z" fill=${color} />
      <path d="M156 106 C168 114 174 124 178 138 L172 140 C168 128 162 118 154 112 Z" fill=${shade(color, -0.15)} />
      <path fill-rule="evenodd" d="M40 96 C70 87 130 87 160 96 L160 116 C130 108 70 108 40 116 Z M65 106 a13 9 0 1 0 26 0 a13 9 0 1 0 -26 0 Z M109 106 a13 9 0 1 0 26 0 a13 9 0 1 0 -26 0 Z"
        fill=${color} stroke=${shade(color, -0.3)} stroke-width="1.6" />
    </g>`,
    prop: () => html`<g transform="translate(16 218) rotate(-15)">
      <path d="M0 -15 L15 18 L-15 18 Z" fill="#FFCF5C" stroke="#D9962B" stroke-width="2" stroke-linejoin="round" />
      <path d="M-15 18 L15 18" stroke="#C47A3A" stroke-width="5" stroke-linecap="round" />
      <circle cx="-2" cy="4" r="3" fill="#E2483A" /><circle cx="5" cy="11" r="2.6" fill="#E2483A" /><circle cx="-7" cy="12" r="2.4" fill="#E2483A" />
    </g>`,
  };
}

// --- Maillots de foot -------------------------------------------------------------------------
function kit({ id, name, shirt, sleeve = shirt, collar, trim, number, pattern = null, price = 100 }) {
  return {
    id,
    name,
    price,
    shirt,
    sleeve,
    torso: () => html`<g>
      ${pattern}
      <text x="100" y="242" text-anchor="middle" font-size="24" font-weight="700" font-family="Fredoka, sans-serif" fill=${number} stroke=${shade(number, -0.35)} stroke-width="0.8">10</text>
    </g>`,
    collar: ({ skin }) => html`<path d="M86 181 Q100 196 114 181" fill=${shade(skin, -0.06)} stroke=${collar} stroke-width="4" />`,
    sleeves: cuff(trim, 226, 6),
    prop: () => ball(),
  };
}

const stripes = (colors, width = 15) => {
  const out = [];
  for (let x = 40, i = 0; x < 160; x += width, i++) out.push(html`<rect key=${x} x=${x} y="170" width=${width} height="100" fill=${colors[i % colors.length]} />`);
  return out;
};

const KITS = [
  kit({
    id: 'maillot_psg', name: 'Maillot PSG', price: 500, shirt: '#0B1E4B', collar: '#D6202E', trim: '#D6202E', number: '#FFFFFF',
    pattern: html`<g><rect x="84" y="170" width="32" height="100" fill="#FFFFFF" /><rect x="88" y="170" width="24" height="100" fill="#D6202E" /></g>`,
  }),
  kit({ id: 'maillot_om', name: 'Maillot OM', shirt: '#FFFFFF', collar: '#2FAEE0', trim: '#2FAEE0', number: '#2FAEE0' }),
  kit({
    id: 'maillot_ol', name: 'Maillot OL', shirt: '#FFFFFF', collar: '#1E3A8A', trim: '#D6202E', number: '#1E3A8A',
    pattern: html`<g><path d="M40 212 L160 198 L160 206 L40 220 Z" fill="#D6202E" /><path d="M40 220 L160 206 L160 212 L40 226 Z" fill="#1E3A8A" /></g>`,
  }),
  kit({
    id: 'maillot_france', name: 'Maillot de France', price: 500, shirt: '#1C2D6B', collar: '#FFFFFF', trim: '#E0434B', number: '#FFFFFF',
    pattern: html`<g><rect x="64" y="196" width="5" height="9" fill="#2B4BB0" /><rect x="69" y="196" width="5" height="9" fill="#FFFFFF" /><rect x="74" y="196" width="5" height="9" fill="#E0434B" /></g>`,
  }),
  kit({ id: 'maillot_real', name: 'Maillot Real Madrid', shirt: '#FFFFFF', collar: '#B7932F', trim: '#3A2A6B', number: '#B7932F' }),
  kit({ id: 'maillot_barca', name: 'Maillot FC Barcelone', shirt: '#A50044', sleeve: '#A50044', collar: '#FFD23F', trim: '#004D98', number: '#FFD23F', pattern: stripes(['#A50044', '#004D98']) }),
  kit({ id: 'maillot_bresil', name: 'Maillot du Brésil', shirt: '#FFDC02', collar: '#009C3B', trim: '#009C3B', number: '#0A3C8C' }),
  kit({
    id: 'maillot_israel', name: "Maillot d'Israël", price: 500, shirt: '#FFFFFF', collar: '#0038B8', trim: '#0038B8', number: '#0038B8',
    pattern: html`<g>
      <path d="M40 180 L160 180 L160 190 L40 190 Z" fill="#0038B8" />
      <rect x="62" y="196" width="18" height="13" rx="1.5" fill="#FFFFFF" stroke="#C9D3E8" stroke-width="0.8" />
      <rect x="62" y="197.5" width="18" height="1.8" fill="#0038B8" /><rect x="62" y="205.7" width="18" height="1.8" fill="#0038B8" />
      <path d="M71 199.6 L73.4 203.8 L68.6 203.8 Z M71 205.2 L68.6 201 L73.4 201 Z" fill="none" stroke="#0038B8" stroke-width="0.7" stroke-linejoin="round" />
    </g>`,
  }),
];

// --- Rabbin --------------------------------------------------------------------------------------
const rabbin = {
  id: 'rabbin', name: 'Rabbin', price: 180, shirt: '#1C1C22',
  torso: () => html`<g>
    ${vNeck('#FFFFFF')}
    <path d="M86 182 L100 214 L94 264 M114 182 L100 214 L106 264" stroke="#2C2C36" stroke-width="2" fill="none" />
    ${buttons(100, [226, 240, 254], '#3A3A46', 2.6)}
    <g stroke="#F4F1E6" stroke-width="1.6" stroke-linecap="round">
      <path d="M58 236 L57 264 M62 236 L62 264 M66 236 L67 264" />
      <path d="M134 236 L133 264 M138 236 L138 264 M142 236 L143 264" />
    </g>
  </g>`,
  collar: () => html`<path d="M86 181 L100 196 L114 181" fill="#FFFFFF" stroke="#D5DCE6" stroke-width="2.4" stroke-linejoin="round" />`,
  face: ({ hairFill, hairLine }) => html`<g fill=${hairFill} stroke=${hairLine} stroke-width="1.2" stroke-linejoin="round">
    <path d="M47 116 C49 150 72 178 100 180 C128 178 151 150 153 116 C147 132 133 140 123 142 L119 150 C111 157 89 157 81 150 L77 142 C67 140 53 132 47 116 Z" />
    <path d="M86 132 C92 127 98 129 100 132 C102 129 108 127 114 132 C108 137 92 137 86 132 Z" />
  </g>`,
  faceTop: ({ hairFill }) => {
    const left = 'M46 98 C36 108 52 114 44 124 C36 134 52 140 44 150 C38 158 46 166 52 160';
    return html`<g stroke=${hairFill} stroke-width="5.5" fill="none" stroke-linecap="round"><path d=${left} /><path d=${mirror(left)} /></g>`;
  },
  hat: () => html`<g>
    <ellipse cx="100" cy="56" rx="72" ry="13" fill="#15151B" stroke="#000" stroke-width="1.5" />
    <path d="M60 56 C58 34 66 14 100 12 C134 14 142 34 140 56 Z" fill="#1E1E26" stroke="#000" stroke-width="1.5" />
    <path d="M86 18 Q100 28 114 18" stroke="#3A3A46" stroke-width="2" fill="none" />
    <path d="M60 46 C86 50 114 50 140 46 L140 55 C114 59 86 59 60 55 Z" fill="#2E2E38" />
    <path d="M70 28 C76 19 88 15 98 15" stroke="#fff" stroke-width="3" opacity="0.15" fill="none" stroke-linecap="round" />
  </g>`,
  prop: () => html`<g transform="translate(16 218) rotate(-8)">
    <rect x="-13" y="-16" width="26" height="33" rx="3" fill="#1F4E9C" stroke="#163A75" stroke-width="2" />
    <rect x="-10" y="-13" width="3" height="27" fill="#163A75" />
    <g transform="translate(2 0)" stroke="#FFD23F" stroke-width="1.6" fill="none" stroke-linejoin="round">
      <path d="M0 -7 L6.5 4 L-6.5 4 Z" /><path d="M0 7.5 L6.5 -3.5 L-6.5 -3.5 Z" />
    </g>
  </g>`,
};

// --- Dresseurs d'animaux ----------------------------------------------------------------------------
const dompteur = {
  id: 'dompteur', name: 'Dompteur de lions', price: 170, shirt: '#C8102E',
  torso: () => html`<g>
    ${vNeck('#FFFFFF')}
    ${[206, 218, 230, 242].map((y) => html`<g key=${y}><path d=${`M80 ${y} L120 ${y}`} stroke="#F2C230" stroke-width="2.6" />
      <circle cx="80" cy=${y} r="2.6" fill="#F2C230" /><circle cx="120" cy=${y} r="2.6" fill="#F2C230" /><circle cx="100" cy=${y} r="3" fill="#FFE27A" /></g>`)}
  </g>`,
  collar: () => html`<g>${shirtCollar()}${bowTie('#1E1E26')}</g>`,
  over: () => epaulettes('#F2C230'),
  sleeves: cuff('#F2C230', 226, 5),
  hat: () => topHat('#C8102E', html`<path d=${starPath(100, 43, 5, 2.3)} fill="#F2C230" />`),
  prop: () => html`<g transform="translate(18 212) scale(1.15)">
    ${[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => {
      const r = (a * Math.PI) / 180;
      return html`<circle key=${a} cx=${(Math.cos(r) * 11).toFixed(1)} cy=${(Math.sin(r) * 11 - 4).toFixed(1)} r="6" fill="#C8752B" />`;
    })}
    <ellipse cx="0" cy="16" rx="12" ry="9" fill="#F2B45A" />
    <circle cx="0" cy="-4" r="10.5" fill="#F2B45A" />
    <circle cx="-8" cy="-12" r="3.6" fill="#F2B45A" /><circle cx="8" cy="-12" r="3.6" fill="#F2B45A" />
    <ellipse cx="0" cy="0" rx="5" ry="3.6" fill="#FFE0B0" />
    <circle cx="-4" cy="-6" r="1.6" fill="#2A1D1D" /><circle cx="4" cy="-6" r="1.6" fill="#2A1D1D" />
    <path d="M-1.6 -1.6 L1.6 -1.6 L0 0.4 Z" fill="#7A3A2A" />
    <path d="M-2.6 2 Q0 4 2.6 2" stroke="#7A3A2A" stroke-width="1.1" fill="none" stroke-linecap="round" />
  </g>`,
};

const dresseurDragons = {
  id: 'dresseur_dragons', name: 'Dresseur de dragons', price: 200, shirt: '#3E7D4F', gloves: '#7A4A26',
  torso: () => {
    const left = 'M50 264 C50 210 60 190 86 182 L94 264 Z';
    return html`<g>
      <path d=${left} fill="#7A4A26" /><path d=${mirror(left)} fill="#7A4A26" />
      <path d="M88 190 L92 262 M112 190 L108 262" stroke="#5C3A1E" stroke-width="1.6" stroke-dasharray="3 3" />
      <rect x="40" y="240" width="120" height="8" fill="#4A2E17" />
      <rect x="94" y="238" width="12" height="12" rx="2" fill="#D9B26A" stroke="#8B5A2B" stroke-width="1.2" />
      <rect x="112" y="248" width="18" height="14" rx="3" fill="#5C3A1E" />
    </g>`;
  },
  sleeves: cuff('#7A4A26', 220, 14),
  hat: () => html`<g>
    <path d="M40 66 C38 26 66 10 100 10 C134 10 162 26 160 66 Q100 54 40 66 Z" fill="#7A4A26" stroke="#4A2E17" stroke-width="2" />
    <path d="M44 52 Q100 40 156 52" stroke="#4A2E17" stroke-width="5" fill="none" />
    <circle cx="82" cy="48" r="11" fill="#9AD0FF" stroke="#5C3A1E" stroke-width="4" />
    <circle cx="118" cy="48" r="11" fill="#9AD0FF" stroke="#5C3A1E" stroke-width="4" />
    <path d="M76 44 Q80 40 85 41 M112 44 Q116 40 121 41" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" />
  </g>`,
  prop: () => html`<g transform="translate(18 210) scale(1.2)">
    <g class="wing-l"><path d="M-10 4 C-26 -10 -34 -6 -32 6 C-26 4 -20 8 -12 12 Z" fill="#C4A6FF" stroke="#6B3FD0" stroke-width="1.5" /></g>
    <g class="wing-r"><path d="M10 4 C26 -10 34 -6 32 6 C26 4 20 8 12 12 Z" fill="#C4A6FF" stroke="#6B3FD0" stroke-width="1.5" /></g>
    <ellipse cx="0" cy="14" rx="14" ry="12" fill="#8A5CF6" />
    <ellipse cx="0" cy="17" rx="7" ry="7" fill="#FFE08A" />
    <path d="M-7 -19 L-9 -28 L-3 -20 Z M7 -19 L9 -28 L3 -20 Z" fill="#FFD23F" />
    <circle cx="0" cy="-7" r="13" fill="#8A5CF6" />
    <circle cx="-5" cy="-9" r="3" fill="#fff" /><circle cx="5" cy="-9" r="3" fill="#fff" />
    <circle cx="-4.5" cy="-9" r="1.7" fill="#1F1A2E" /><circle cx="5.5" cy="-9" r="1.7" fill="#1F1A2E" />
    <path d="M-4 2 Q0 5 4 2" stroke="#4B2A9A" stroke-width="1.5" fill="none" stroke-linecap="round" />
  </g>`,
};

// --- Aventures -------------------------------------------------------------------------------------------
const astronaute = {
  id: 'astronaute_combi', name: 'Astronaute', price: 220, shirt: '#EEF2F8', sleeve: '#E3E8F0', gloves: '#C9D1DE',
  back: () => html`<rect x="34" y="174" width="132" height="72" rx="14" fill="#C9D1DE" stroke="#8A96AC" stroke-width="2" />`,
  torso: () => html`<g>
    <rect x="82" y="204" width="36" height="24" rx="4" fill="#3A4660" />
    <circle cx="90" cy="212" r="3" fill="#FF5D6C" /><circle cx="100" cy="212" r="3" fill="#2FCF74" /><circle cx="110" cy="212" r="3" fill="#FFD23F" />
    <rect x="87" y="219" width="26" height="4" rx="2" fill="#5EC8FF" />
    <circle cx="130" cy="198" r="7" fill="#4D8DF7" /><ellipse cx="130" cy="198" rx="11" ry="3" fill="none" stroke="#FFD23F" stroke-width="1.6" transform="rotate(-20 130 198)" />
    <path d="M66 236 L134 236" stroke="#D0D7E2" stroke-width="2" />
  </g>`,
  collar: () => html`<ellipse cx="100" cy="182" rx="24" ry="7" fill="#C9D1DE" stroke="#8A96AC" stroke-width="2" />`,
  sleeves: cuff('#E8455A', 208, 5),
  headFree: () => html`<g>
    <circle cx="100" cy="98" r="80" fill="rgba(170,215,255,0.16)" stroke="#EAF2FF" stroke-width="6" />
    <circle cx="100" cy="98" r="74" fill="none" stroke="rgba(120,160,220,0.45)" stroke-width="2" />
    <path d="M46 62 C58 40 80 27 104 25" stroke="#fff" stroke-width="7" fill="none" opacity="0.65" stroke-linecap="round" />
  </g>`,
};

const chef = {
  id: 'chef', name: 'Chef cuisinier', price: 110, shirt: '#FFFFFF',
  torso: () => html`<g>
    <path d="M94 184 C96 210 96 240 94 264" stroke="#E3E7EE" stroke-width="2" fill="none" />
    ${buttons(86, [206, 222, 238], '#C5CEDA', 3)}${buttons(112, [206, 222, 238], '#C5CEDA', 3)}
    <path d="M116 244 h18 v12 h-18 Z" stroke="#E3E7EE" stroke-width="1.6" fill="none" />
  </g>`,
  collar: () => html`<g><path d="M84 180 Q100 196 116 180 L112 190 Q100 200 88 190 Z" fill="#E8455A" /><path d="M96 192 L104 192 L100 207 Z" fill="#C83246" /></g>`,
  hat: () => html`<g>
    <path d="M60 54 L64 20 C48 16 52 -8 72 -4 C76 -18 98 -24 108 -8 C120 -20 146 -12 140 6 C156 8 154 28 136 24 L140 54 Z" fill="#FFFFFF" stroke="#D5DCE6" stroke-width="2" stroke-linejoin="round" />
    <path d="M80 22 L80 44 M100 18 L100 44 M120 22 L120 44" stroke="#E6EAF0" stroke-width="2" />
    <path d="M60 44 L140 44 L140 54 L60 54 Z" fill="#F4F6FA" stroke="#D5DCE6" stroke-width="1.5" />
  </g>`,
  prop: () => html`<g transform="translate(16 222)">
    <path d="M-11 0 L11 0 L8 16 L-8 16 Z" fill="#FF8FC8" stroke="#E0569E" stroke-width="1.5" stroke-linejoin="round" />
    <path d="M-6 0 L-4 16 M0 0 L0 16 M6 0 L4 16" stroke="#E0569E" stroke-width="1" />
    <path d="M-13 1 C-16 -8 -6 -10 -4 -12 C-2 -18 6 -18 7 -12 C12 -12 16 -6 13 1 Z" fill="#FFF3E0" stroke="#E5D3B8" stroke-width="1.4" />
    <circle cx="0" cy="-17" r="3.6" fill="#E2483A" />
    ${[[-7, -4], [3, -7], [8, -2], [-2, -2]].map(([x, y], i) => html`<rect key=${i} x=${x} y=${y} width="3" height="1.4" rx="0.7" fill=${['#5EC8FF', '#FFD23F', '#2FCF74', '#FF7EB6'][i]} />`)}
  </g>`,
};

const chevalier = {
  id: 'chevalier', name: 'Chevalier', price: 180, shirt: '#C9D1DE', sleeve: '#B7C1D2', gloves: '#9AA6BA', hideHair: true,
  torso: () => html`<g>
    <path d="M74 184 L126 184 L122 264 L78 264 Z" fill="#2F5FC4" />
    <rect x="96" y="198" width="8" height="42" fill="#FFD23F" /><rect x="84" y="210" width="32" height="8" fill="#FFD23F" />
    <path d="M58 200 C62 230 64 250 66 264 M142 200 C138 230 136 250 134 264" stroke="#fff" stroke-width="3" opacity="0.35" fill="none" />
  </g>`,
  collar: () => html`<path d="M82 180 Q100 194 118 180 L118 189 Q100 203 82 189 Z" fill="#B7C1D2" stroke="#8A96AC" stroke-width="1.5" />`,
  sleeves: (_c, x) => html`<path d=${`M${x} 202 h20 M${x} 216 h20`} stroke="#8A96AC" stroke-width="2" />`,
  headFree: ({ id }) => html`<g>
    <defs>${grad(`${id}-hm`, SILVER)}</defs>
    <path d="M100 26 C96 6 110 -14 130 -14 C118 -6 114 8 112 26 Z" fill="#E23B4B" stroke="#B02A3C" stroke-width="1.5" />
    <path d="M34 114 C30 54 60 26 100 26 C140 26 170 54 166 114 L150 118 L150 92 C150 76 130 66 100 66 C70 66 50 76 50 92 L50 118 Z" fill=${`url(#${id}-hm)`} stroke="#6B778C" stroke-width="2" stroke-linejoin="round" />
    <path d="M46 72 Q100 52 154 72 L154 84 Q100 66 46 84 Z" fill="#9AA6BA" stroke="#6B778C" stroke-width="1.5" />
    <path d="M70 72 h8 M86 68 h8 M106 68 h8 M122 72 h8" stroke="#4A5160" stroke-width="2.4" stroke-linecap="round" />
    <path d="M58 46 C70 34 86 30 100 30" stroke="#fff" stroke-width="4" opacity="0.6" fill="none" stroke-linecap="round" />
  </g>`,
  prop: () => html`<g>
    <path d="M2 194 L32 194 L32 212 Q32 232 17 240 Q2 232 2 212 Z" fill="#2F5FC4" stroke="#C9D1DE" stroke-width="3" stroke-linejoin="round" />
    <rect x="14.5" y="200" width="5" height="30" fill="#FFD23F" /><rect x="7" y="208" width="20" height="5" fill="#FFD23F" />
  </g>`,
};

const capitaine = {
  id: 'capitaine', name: 'Capitaine pirate', price: 160, shirt: '#8E1F2F', hidesGlasses: true,
  torso: () => html`<g>
    ${vNeck('#FFFFFF')}
    ${[188, 196, 204].map((y) => html`<ellipse key=${y} cx="100" cy=${y} rx=${14 - (y - 188) / 3} ry="4" fill="#FFFFFF" stroke="#E3E7EE" stroke-width="1" />`)}
    <path d="M84 182 L100 214 L90 264 M116 182 L100 214 L110 264" stroke="#F2C230" stroke-width="2.4" fill="none" />
    ${buttons(82, [222, 236, 250], '#F2C230', 3)}${buttons(118, [222, 236, 250], '#F2C230', 3)}
  </g>`,
  collar: () => null,
  sleeves: cuff('#F2C230', 222, 7),
  face: () => html`<g>
    <path d="M42 90 C70 98 110 104 158 98" stroke="#1E1E26" stroke-width="2.6" fill="none" />
    <ellipse cx="78" cy="106" rx="13.5" ry="11.5" fill="#1E1E26" />
    <path d="M70 101 Q74 98 78 99" stroke="#fff" stroke-width="1.5" opacity="0.3" fill="none" />
  </g>`,
  hat: () => html`<g>
    <path d="M22 58 C30 20 66 0 100 12 C134 0 170 20 178 58 C150 42 50 42 22 58 Z" fill="#1E1E26" stroke="#000" stroke-width="2" stroke-linejoin="round" />
    <path d="M22 58 C50 42 150 42 178 58" stroke="#F2C230" stroke-width="3.5" fill="none" />
    <circle cx="100" cy="28" r="9" fill="#fff" /><rect x="95" y="32" width="10" height="7" rx="2" fill="#fff" />
    <circle cx="96.5" cy="27.5" r="2.4" fill="#1E1E26" /><circle cx="103.5" cy="27.5" r="2.4" fill="#1E1E26" />
    <path d="M86 38 L114 48 M114 38 L86 48" stroke="#fff" stroke-width="3" stroke-linecap="round" />
  </g>`,
  prop: () => html`<g transform="translate(156 168)"><g class="wiggle">
    <path d="M2 14 L6 30 L-2 30 Z" fill="#2E7FD8" />
    <ellipse cx="0" cy="6" rx="9" ry="13" fill="#E8303F" />
    <path d="M4 0 C14 6 12 16 6 20 C4 12 2 8 4 0 Z" fill="#2E7FD8" />
    <circle cx="-1" cy="-8" r="7.5" fill="#E8303F" />
    <circle cx="1" cy="-10" r="2.6" fill="#fff" /><circle cx="1.6" cy="-10" r="1.4" fill="#1E1E26" />
    <path d="M-7 -9 C-13 -8 -13 -1 -8 -2 C-9 -4 -8 -7 -6 -7 Z" fill="#FFC21F" stroke="#C98B00" stroke-width="0.8" />
  </g></g>`,
};

const magicien = {
  id: 'magicien', name: 'Magicien', price: 130, shirt: '#1E1E26',
  back: ({ id }) => capeBack(id, ['#9B6CF0', '#6A40C8', '#4B2A9A']),
  torso: () => html`<g>${vNeck('#FFFFFF')}${lapels('#8B5CF6', '#6A40C8')}${buttons(100, [230, 246], '#E3E7EE', 2.6)}</g>`,
  collar: () => bowTie('#8B5CF6'),
  hat: () => topHat('#8B5CF6', html`<g><path d=${starPath(100, 43, 5, 2.3)} fill="#FFD23F" />${sparkle(124, 4, 6, 'tw', 0.3)}</g>`),
  prop: () => html`<g>
    <path d="M8 238 L30 204" stroke="#15151B" stroke-width="4.5" stroke-linecap="round" />
    <path d="M26 210 L30 204" stroke="#fff" stroke-width="4.5" stroke-linecap="round" />
    ${sparkle(34, 198, 6, 'tw', 0)}${sparkle(24, 192, 4, 'tw', 0.6)}${sparkle(40, 210, 3.5, 'tw', 1.1)}
  </g>`,
};

const princesse = {
  id: 'princesse', name: 'Tenue de princesse', price: 160, shirt: '#FF8FC8', sleeve: '#FFB6DA',
  torso: () => html`<g>
    <path d="M84 182 L100 208 L116 182" fill="#FFE3F1" stroke="#FFFFFF" stroke-width="2" />
    <path d="M70 230 Q100 244 130 230" stroke="#FFFFFF" stroke-width="3" fill="none" />
    ${[[74, 210], [126, 210], [100, 224], [86, 248], [114, 248], [62, 244], [138, 244]].map(([x, y], i) => html`<path key=${i} d=${starPath(x, y, 3.6, 1.6)} fill="#FFFFFF" opacity="0.9" />`)}
    <circle cx="100" cy="230" r="4" fill="#B490FF" stroke="#fff" stroke-width="1" />
  </g>`,
  collar: () => html`<g>${[86, 91, 96, 100, 104, 109, 114].map((x, i) => html`<circle key=${x} cx=${x} cy=${184 + [0, 3.5, 6, 6.5, 6, 3.5, 0][i]} r="2" fill="#FFF8F0" stroke="#E5D3B8" stroke-width="0.6" />`)}</g>`,
  // Manches bouffantes posées sur les épaules (épaules du corps vers (61, 195) et (139, 195))
  over: () => html`<g>${[[60, 194, -35], [140, 194, 35]].map(([cx, cy, a]) => html`<g key=${cx} transform=${`rotate(${a} ${cx} ${cy})`}>
    <ellipse cx=${cx} cy=${cy} rx="12.5" ry="9.5" fill="#FFB6DA" stroke="#F27CB8" stroke-width="1.2" />
    <path d=${`M${cx - 6} ${cy - 7.5} Q${cx - 3.5} ${cy} ${cx - 6} ${cy + 7.5} M${cx} ${cy - 9.3} L${cx} ${cy + 9.3} M${cx + 6} ${cy - 7.5} Q${cx + 3.5} ${cy} ${cx + 6} ${cy + 7.5}`} stroke="#F27CB8" stroke-width="1" fill="none" opacity="0.7" />
    <ellipse cx=${cx - 3} cy=${cy - 3.5} rx="5" ry="3" fill="#fff" opacity="0.35" />
  </g>`)}</g>`,
  hat: ({ id }) => html`<g>
    <defs>${grad(`${id}-tia`, ['#FFFFFF', '#E3E7F0', '#B9C3D3'])}</defs>
    <path d="M64 58 L70 40 L82 50 L100 28 L118 50 L130 40 L136 58 Z" fill=${`url(#${id}-tia)`} stroke="#9AA6BA" stroke-width="1.6" stroke-linejoin="round" />
    <circle cx="100" cy="44" r="5" fill="#FF5DA2" stroke="#fff" stroke-width="1.2" />
    <circle cx="70" cy="40" r="2.6" fill="#B490FF" /><circle cx="130" cy="40" r="2.6" fill="#B490FF" />
    ${sparkle(116, 30, 5, 'tw', 0.4)}
  </g>`,
};

const prince = {
  id: 'prince', name: 'Tenue de prince', price: 160, shirt: '#2F5FC4',
  torso: () => html`<g>
    <path d="M60 186 L150 250 L150 262 L56 198 Z" fill="#D7262E" />
    ${buttons(100, [204, 218, 232], '#FFD23F', 3)}
  </g>`,
  collar: () => html`<path d="M84 180 L100 194 L116 180 L118 188 L100 200 L82 188 Z" fill="#FFD23F" stroke="#E0A100" stroke-width="1.4" />`,
  over: () => epaulettes('#FFD23F'),
  sleeves: cuff('#FFD23F', 226, 5),
  hat: ({ id }) => html`<g>
    <defs>${grad(`${id}-cr`, GOLD)}</defs>
    <path d="M70 56 L72 34 L86 46 L100 28 L114 46 L128 34 L130 56 Z" fill=${`url(#${id}-cr)`} stroke="#B8860B" stroke-width="1.8" stroke-linejoin="round" />
    <circle cx="100" cy="48" r="3.6" fill="#E8455A" /><circle cx="84" cy="50" r="2.6" fill="#3FA9F5" /><circle cx="116" cy="50" r="2.6" fill="#45D18A" />
  </g>`,
};

// --- Super-héros Marvel et DC ------------------------------------------------------------------
// Reconnaissables à leurs couleurs et à leurs formes ; emblèmes simplifiés dessinés maison
// (pas les logos officiels), comme pour les maillots.
const HEAD_MASK = 'M100 32 C142 32 172 62 172 102 C172 142 140 170 100 170 C60 170 28 142 28 102 C28 62 58 32 100 32 Z';
const headMask = (fill, stroke) => html`<path d=${HEAD_MASK} fill=${fill} stroke=${stroke} stroke-width="2.4" />`;

// Toile d'araignée : rayons + anneaux légèrement creusés
function webRing(cx, cy, r, n) {
  let d = '';
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (!i) d += `M${x.toFixed(1)} ${y.toFixed(1)}`;
    else {
      const m = ((i - 0.5) / n) * Math.PI * 2;
      d += ` Q${(cx + Math.cos(m) * r * 0.86).toFixed(1)} ${(cy + Math.sin(m) * r * 0.86).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
  }
  return d;
}
const web = (cx, cy, stroke, rings, spokes = 12, reach = 90) => html`<g stroke=${stroke} stroke-width="1.2" fill="none" opacity="0.85">
  ${Array.from({ length: spokes }, (_, i) => {
    const a = (i / spokes) * Math.PI * 2;
    return html`<path key=${`s${i}`} d=${`M${cx} ${cy} L${(cx + Math.cos(a) * reach).toFixed(1)} ${(cy + Math.sin(a) * reach).toFixed(1)}`} />`;
  })}
  ${rings.map((r) => html`<path key=${`r${r}`} d=${webRing(cx, cy, r, spokes)} />`)}
</g>`;

// Chauve-souris générique (pas l'emblème officiel)
const BAT = 'M-50 -6 C-40 -10 -26 -14 -14 -12 C-10 -16 -8 -20 -6 -22 L-3 -14 L3 -14 L6 -22 C8 -20 10 -16 14 -12 C26 -14 40 -10 50 -6 C44 -2 42 4 44 10 C36 4 28 6 24 12 C18 6 10 8 6 14 L0 20 L-6 14 C-10 8 -18 6 -24 12 C-28 6 -36 4 -44 10 C-42 4 -44 -2 -50 -6 Z';
const bat = (cx, cy, w, fill) => html`<path d=${BAT} transform=${`translate(${cx} ${cy}) scale(${w / 100})`} fill=${fill} />`;
const bolt = (fill = '#F2C230', stroke = '#C99A12') => html`<path d="M104 197 L92 212 L100 212 L95 225 L110 208 L102 208 Z" fill=${fill} stroke=${stroke} stroke-width="1" stroke-linejoin="round" />`;
const belt = (fill, y = 246, h = 7, buckle = null) => html`<g><rect x="40" y=${y} width="120" height=${h} fill=${fill} />${buckle && html`<rect x="93" y=${y - 2} width="14" height=${h + 4} rx="2" fill=${buckle} />`}</g>`;
const plainCollar = (fill, stroke) => () => html`<path d="M86 181 Q100 194 114 181" fill=${fill} stroke=${stroke} stroke-width="3" />`;

const spiderman = {
  id: 'spiderman', name: 'Spider-Man', price: 300, shirt: '#D62B2B', sleeve: '#2253B5', gloves: '#D62B2B', hideHair: true, hidesGlasses: true,
  torso: () => html`<g>
    <path d="M40 196 C56 206 64 232 62 270 L40 270 Z" fill="#2253B5" /><path d=${mirror('M40 196 C56 206 64 232 62 270 L40 270 Z')} fill="#2253B5" />
    ${web(100, 206, '#7A1414', [12, 24, 38, 54])}
    <g fill="#1B1B22"><ellipse cx="100" cy="210" rx="4.5" ry="8" /><circle cx="100" cy="199" r="3.4" />
      <path d="M97 205 L86 196 L84 188 M97 209 L84 206 L80 200 M97 213 L84 216 L80 224 M97 216 L88 226 L86 234 M103 205 L114 196 L116 188 M103 209 L116 206 L120 200 M103 213 L116 216 L120 224 M103 216 L112 226 L114 234" stroke="#1B1B22" stroke-width="1.8" fill="none" stroke-linecap="round" /></g>
  </g>`,
  collar: plainCollar('#D62B2B', '#9E1C1C'),
  sleeves: (_c, x) => html`<g><rect x=${x} y="188" width="20" height="22" rx="9" fill="#D62B2B" /><path d=${`M${x + 4} 192 L${x + 16} 206 M${x + 16} 192 L${x + 4} 206 M${x} 199 L${x + 20} 199`} stroke="#7A1414" stroke-width="1" /></g>`,
  face: ({ id }) => html`<g>
    <defs><clipPath id=${`${id}-spm`}><path d=${HEAD_MASK} /></clipPath></defs>
    ${headMask('#D62B2B', '#9E1C1C')}
    <g clip-path=${`url(#${id}-spm)`}>${web(100, 112, '#7A1414', [18, 34, 50, 66], 14, 110)}</g>
    <g class="robot-eye"><path d="M56 104 C56 84 76 78 94 96 C90 114 70 120 56 104 Z" fill="#FFFFFF" stroke="#1B1B22" stroke-width="5" stroke-linejoin="round" />
      <path d=${mirror('M56 104 C56 84 76 78 94 96 C90 114 70 120 56 104 Z')} fill="#FFFFFF" stroke="#1B1B22" stroke-width="5" stroke-linejoin="round" /></g>
  </g>`,
};

const ironman = {
  id: 'ironman', name: 'Iron Man', price: 300, shirt: '#B3202A', sleeve: '#B3202A', gloves: '#E3B341', hideHair: true, hidesGlasses: true,
  torso: () => html`<g>
    <path d="M58 200 C76 192 124 192 142 200" stroke="#7E1119" stroke-width="2.4" fill="none" />
    <path d="M82 226 L118 226 L114 258 L86 258 Z" fill="#E3B341" stroke="#B8860B" stroke-width="1.6" />
    <path d="M84 236 L116 236 M85 247 L115 247 M100 226 L100 258" stroke="#B8860B" stroke-width="1.4" />
    <circle cx="100" cy="207" r="12" fill="#4A5160" stroke="#2B2F3A" stroke-width="2" />
    <circle class="glow-pulse" cx="100" cy="207" r="9" fill="#BFF4FF" />
    <circle cx="100" cy="207" r="5" fill="#FFFFFF" />
  </g>`,
  collar: () => html`<path d="M84 181 Q100 193 116 181" fill="#E3B341" stroke="#B8860B" stroke-width="2.4" />`,
  sleeves: cuff('#E3B341', 220, 9),
  face: ({ id }) => html`<g>
    <defs>${grad(`${id}-im`, ['#FFE38A', '#E3B341', '#B8860B'])}</defs>
    ${headMask('#B3202A', '#7E1119')}
    <path d="M62 84 C62 68 80 62 100 62 C120 62 138 68 138 84 L136 130 C130 148 116 158 100 158 C84 158 70 148 64 130 Z" fill=${`url(#${id}-im)`} stroke="#B8860B" stroke-width="2" />
    <g class="robot-eye"><path d="M68 100 L92 104 L90 111 L70 107 Z" fill="#DFFBFF" stroke="#7FE7FF" stroke-width="1.5" /><path d=${mirror('M68 100 L92 104 L90 111 L70 107 Z')} fill="#DFFBFF" stroke="#7FE7FF" stroke-width="1.5" /></g>
    <path d="M84 140 L116 140 M76 124 L82 140 M124 124 L118 140" stroke="#B8860B" stroke-width="2" stroke-linecap="round" />
  </g>`,
};

const captainAmerica = {
  id: 'captain_america', name: 'Captain America', price: 300, shirt: '#1F3E8C', sleeve: '#1F3E8C', gloves: '#C8102E',
  torso: () => html`<g>
    ${[64, 76, 88, 100, 112, 124, 136].map((x, i) => html`<rect key=${x} x=${x - 6} y="228" width="12" height="42" fill=${i % 2 ? '#FFFFFF' : '#C8102E'} />`)}
    <path d=${starPath(100, 208, 17)} fill="#FFFFFF" stroke="#C9D3E8" stroke-width="1.4" />
    ${belt('#6B4A2B', 244, 6, '#8E6A3F')}
  </g>`,
  collar: plainCollar('#1F3E8C', '#14295E'),
  hat: () => html`<g>
    <path d="M44 64 C44 26 70 10 100 10 C130 10 156 26 156 64 C140 56 120 52 100 52 C80 52 60 56 44 64 Z" fill="#1F3E8C" stroke="#14295E" stroke-width="2" />
    <path d="M44 56 L26 42 L32 56 L22 58 L38 66 Z" fill="#FFFFFF" stroke="#C9D3E8" stroke-width="1.4" stroke-linejoin="round" />
    <path d=${mirror('M44 56 L26 42 L32 56 L22 58 L38 66 Z')} fill="#FFFFFF" stroke="#C9D3E8" stroke-width="1.4" stroke-linejoin="round" />
    <path d="M70 22 C80 16 90 14 100 14" stroke="#fff" stroke-width="4" opacity="0.25" fill="none" stroke-linecap="round" />
  </g>`,
  prop: () => html`<g transform="translate(18 222)">
    <circle r="19" fill="#C8102E" stroke="#8E0B20" stroke-width="1.6" /><circle r="14.5" fill="#FFFFFF" /><circle r="10.5" fill="#C8102E" /><circle r="7" fill="#1F3E8C" />
    <path d=${starPath(0, 0, 6)} fill="#FFFFFF" />
  </g>`,
};

const hulk = {
  id: 'hulk', name: 'Hulk', price: 300, shirt: '#5BB33B', sleeve: '#5BB33B', gloves: '#4E9E32',
  // Sur le visage 3D : peau teintée en vert (le relief reste), à la place du visage dessiné
  tint3d: '#A2EC7E',
  torso: () => html`<g>
    <path d="M64 202 Q82 214 98 204 M102 204 Q118 214 136 202 M90 222 L110 222 M90 232 L110 232" stroke="#3E8A2A" stroke-width="2.6" fill="none" stroke-linecap="round" />
    <path d="M40 240 L52 234 L60 246 L70 234 L80 248 L92 236 L102 248 L114 236 L124 248 L134 234 L146 246 L160 236 L160 270 L40 270 Z" fill="#6A3D9A" stroke="#4B2A70" stroke-width="1.6" stroke-linejoin="round" />
  </g>`,
  collar: ({ in3d }) => html`<g>${!in3d && html`<rect x="88" y="150" width="24" height="34" rx="8" fill="#5BB33B" />`}<path d="M86 181 Q100 194 114 181" fill="#5BB33B" stroke="#3E8A2A" stroke-width="2" /></g>`,
  sleeves: (_c, x) => html`<path d=${`M${x} 188 L${x + 20} 188 L${x + 20} 198 L${x + 15} 193 L${x + 10} 200 L${x + 5} 193 L${x} 199 Z`} fill="#6A3D9A" />`,
  face: ({ id }) => html`<g>
    <rect x="20" y="20" width="160" height="160" fill="#7BD35A" clip-path=${`url(#${id}-head)`} style="mix-blend-mode:multiply" />
    <circle cx="42" cy="110" r="12" fill="#7BD35A" style="mix-blend-mode:multiply" /><circle cx="158" cy="110" r="12" fill="#7BD35A" style="mix-blend-mode:multiply" />
    <path d="M64 84 L90 94 M136 84 L110 94" stroke="#2F5E1F" stroke-width="6" stroke-linecap="round" />
  </g>`,
};

const thor = {
  id: 'thor', name: 'Thor', price: 300, shirt: '#2B2F3A', sleeve: '#3A3F4D', gloves: '#2B2F3A',
  back: ({ id }) => capeBack(id, ['#E2363F', '#B71C2A', '#8A1420']),
  torso: ({ id }) => html`<g>
    <defs>${grad(`${id}-th`, SILVER)}</defs>
    <path d="M100 186 L100 262" stroke="#1E2129" stroke-width="2" />
    ${[[82, 204], [118, 204], [82, 222], [118, 222], [82, 240], [118, 240]].map(([x, y]) => html`<circle key=${`${x}-${y}`} cx=${x} cy=${y} r="6.5" fill=${`url(#${id}-th)`} stroke="#6B7486" stroke-width="1.2" />`)}
    ${belt('#1E2129', 250, 6)}
  </g>`,
  collar: () => html`<g><path d="M86 181 Q100 194 114 181" fill="#3A3F4D" stroke="#1E2129" stroke-width="3" />
    <circle cx="76" cy="187" r="5.5" fill="#D4DAE4" stroke="#6B7486" stroke-width="1.2" /><circle cx="124" cy="187" r="5.5" fill="#D4DAE4" stroke="#6B7486" stroke-width="1.2" /></g>`,
  hat: ({ id }) => html`<g>
    <defs>${grad(`${id}-thh`, SILVER)}</defs>
    <path d="M50 58 C50 26 72 12 100 12 C128 12 150 26 150 58 Z" fill=${`url(#${id}-thh)`} stroke="#6B7486" stroke-width="2" />
    <rect x="46" y="52" width="108" height="9" rx="4.5" fill="#B7C1D2" stroke="#6B7486" stroke-width="1.6" />
    <path d="M52 48 C40 38 30 22 34 6 C42 16 46 20 52 28 C46 16 46 8 50 0 C56 12 58 24 58 38 Z" fill="#FFFFFF" stroke="#9AA6BA" stroke-width="1.4" stroke-linejoin="round" />
    <path d=${mirror('M52 48 C40 38 30 22 34 6 C42 16 46 20 52 28 C46 16 46 8 50 0 C56 12 58 24 58 38 Z')} fill="#FFFFFF" stroke="#9AA6BA" stroke-width="1.4" stroke-linejoin="round" />
  </g>`,
  prop: () => html`<g transform="translate(18 214) rotate(-20)">
    <rect x="-3" y="0" width="6" height="28" rx="2" fill="#7A4A26" />
    <path d="M-3 8 L3 11 M-3 14 L3 17 M-3 20 L3 23" stroke="#4E2E16" stroke-width="1.2" />
    <rect x="-15" y="-15" width="30" height="17" rx="3" fill="#9AA6BA" stroke="#5C6678" stroke-width="1.8" />
    <path d="M-12 -11 L12 -11" stroke="#D4DAE4" stroke-width="2" stroke-linecap="round" />
    <path class="tw" d="M16 -22 L10 -12 L15 -12 L9 -2" stroke="#7FE7FF" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
  </g>`,
};

const blackPanther = {
  id: 'black_panther', name: 'Black Panther', price: 300, shirt: '#1B1B22', sleeve: '#1B1B22', gloves: '#1B1B22', hideHair: true, hidesGlasses: true,
  torso: () => html`<g fill="none" stroke-linejoin="round">
    <path d="M64 184 L100 214 L136 184 M74 184 L100 206 L126 184" stroke="#C9C6E8" stroke-width="2" />
    <path d="M84 194 L88 200 L92 194 M108 194 L112 200 L116 194" stroke="#C9C6E8" stroke-width="1.6" />
    <path d="M70 226 Q100 236 130 226 M74 242 Q100 250 126 242" stroke="#9B7BFF" stroke-width="1.6" opacity="0.7" />
  </g>`,
  collar: () => html`<path d="M84 181 Q100 194 116 181" fill="#1B1B22" stroke="#C9C6E8" stroke-width="3" />`,
  sleeves: (_c, x) => html`<path d=${`M${x + 10} 192 L${x + 10} 228 M${x + 4} 200 L${x + 10} 206 L${x + 16} 200`} stroke="#C9C6E8" stroke-width="1.4" fill="none" />`,
  face: () => html`<g>
    <path d="M58 50 L50 22 L76 40 Z" fill="#1B1B22" stroke="#C9C6E8" stroke-width="1.6" stroke-linejoin="round" />
    <path d=${mirror('M58 50 L50 22 L76 40 Z')} fill="#1B1B22" stroke="#C9C6E8" stroke-width="1.6" stroke-linejoin="round" />
    ${headMask('#1B1B22', '#000000')}
    <path d="M92 100 L100 66 L108 100 M76 132 Q100 146 124 132" stroke="#C9C6E8" stroke-width="1.6" fill="none" />
    <g class="robot-eye"><path d="M60 102 C68 90 86 90 93 102 C84 108 68 108 60 102 Z" fill="#F2F2FF" stroke="#C9C6E8" stroke-width="2" />
      <path d=${mirror('M60 102 C68 90 86 90 93 102 C84 108 68 108 60 102 Z')} fill="#F2F2FF" stroke="#C9C6E8" stroke-width="2" /></g>
  </g>`,
};

const captainMarvel = {
  id: 'captain_marvel', name: 'Captain Marvel', price: 300, shirt: '#C8102E', sleeve: '#1F3E8C', gloves: '#1F3E8C',
  torso: ({ id }) => html`<g>
    <defs>${grad(`${id}-cm`, GOLD)}</defs>
    <path d="M40 180 L68 180 C72 210 74 240 72 270 L40 270 Z" fill="#1F3E8C" /><path d=${mirror('M40 180 L68 180 C72 210 74 240 72 270 L40 270 Z')} fill="#1F3E8C" />
    <path d="M66 182 L100 228 L134 182" stroke=${`url(#${id}-cm)`} stroke-width="3.4" fill="none" />
    <circle cx="100" cy="210" r="13" fill=${`url(#${id}-cm)`} stroke="#B8860B" stroke-width="1.4" />
    <path d=${starPath(100, 210, 10)} fill="#C8102E" />
    ${belt('#E3B341', 246, 6)}
  </g>`,
  collar: () => html`<path d="M85 181 Q100 193 115 181" fill="#E3B341" stroke="#B8860B" stroke-width="2.4" />`,
  sleeves: cuff('#E3B341', 222, 6),
};

const batman = {
  id: 'batman', name: 'Batman', price: 300, shirt: '#525866', sleeve: '#525866', gloves: '#1B1B22', hideHair: true, hidesGlasses: true,
  back: ({ id }) => capeBack(id, ['#3A3D47', '#22242B', '#111216']),
  torso: () => html`<g>
    ${bat(100, 206, 46, '#1B1B22')}
    <rect x="40" y="244" width="120" height="9" fill="#F2C230" stroke="#C99A12" stroke-width="1" />
    ${[56, 72, 128, 144].map((x) => html`<rect key=${x} x=${x - 5} y="242" width="10" height="13" rx="2" fill="#D9A21E" />`)}
    <rect x="93" y="242" width="14" height="13" rx="2" fill="#C99A12" />
  </g>`,
  collar: plainCollar('#22242B', '#111216'),
  face: () => html`<g>
    <path d="M54 48 L56 10 L74 40 Z" fill="#1B1B22" /><path d=${mirror('M54 48 L56 10 L74 40 Z')} fill="#1B1B22" />
    <path d="M28 106 C28 60 60 32 100 32 C140 32 172 60 172 106 L172 118 C152 118 140 124 132 134 C124 128 112 126 100 126 C88 126 76 128 68 134 C60 124 48 118 28 118 Z" fill="#1B1B22" stroke="#000000" stroke-width="2" />
    <path d="M64 100 L90 104 L88 109 L66 107 Z" fill="#FFFFFF" /><path d=${mirror('M64 100 L90 104 L88 109 L66 107 Z')} fill="#FFFFFF" />
  </g>`,
};

const superman = {
  id: 'superman', name: 'Superman', price: 300, shirt: '#2357C9', sleeve: '#2357C9',
  back: ({ id }) => capeBack(id, ['#FF4D5E', '#D61F30', '#A0141F']),
  torso: () => html`<g>
    <path d="M76 194 L124 194 L132 205 L100 238 L68 205 Z" fill="#D61F30" stroke="#A0141F" stroke-width="2" stroke-linejoin="round" />
    <path d="M80 198 L120 198 L126 205 L100 231 L74 205 Z" fill="#FFD23F" />
    <path d="M84 207 C92 200 104 214 116 205" stroke="#D61F30" stroke-width="4.4" fill="none" stroke-linecap="round" />
    ${belt('#D61F30', 246, 7, '#FFD23F')}
  </g>`,
  collar: plainCollar('#2357C9', '#173E94'),
  faceTop: ({ hairColor }) => html`<path d="M100 50 C90 54 92 66 100 64 C106 62 103 55 99 58" stroke=${hairColor} stroke-width="4" fill="none" stroke-linecap="round" />`,
};

const wonderWoman = {
  id: 'wonder_woman', name: 'Wonder Woman', price: 300, shirt: '#C8102E', bareArms: true,
  torso: ({ id, skin }) => html`<g>
    <defs>${grad(`${id}-ww`, GOLD)}</defs>
    <path d="M40 176 L160 176 L160 196 C130 188 70 188 40 196 Z" fill=${skin} />
    <path d="M58 198 C72 190 88 196 100 206 C112 196 128 190 142 198 C132 206 116 208 100 216 C84 208 68 206 58 198 Z" fill=${`url(#${id}-ww)`} stroke="#B8860B" stroke-width="1.4" />
    <rect x="40" y="238" width="120" height="32" fill="#1F3E8C" />
    ${[[64, 252], [84, 260], [116, 260], [136, 252], [100, 250]].map(([x, y]) => html`<path key=${x} d=${starPath(x, y, 4)} fill="#FFFFFF" />`)}
    <rect x="40" y="234" width="120" height="6" fill=${`url(#${id}-ww)`} />
  </g>`,
  collar: ({ skin }) => html`<path d="M86 181 Q100 196 114 181" fill=${shade(skin, -0.06)} stroke="none" />`,
  sleeves: ({ skin }, x) => html`<g><rect x=${x} y="188" width="20" height="46" rx="10" fill=${skin} stroke=${shade(skin, -0.2)} stroke-width="1.2" />
    <rect x=${x - 0.5} y="212" width="21" height="13" rx="3" fill="#D4DAE4" stroke="#8A93A6" stroke-width="1.2" /></g>`,
  hat: ({ id }) => html`<g>
    <defs>${grad(`${id}-wwt`, GOLD)}</defs>
    <path d="M56 56 C76 46 124 46 144 56 L142 64 C122 55 78 55 58 64 Z" fill=${`url(#${id}-wwt)`} stroke="#B8860B" stroke-width="1.4" />
    <path d="M90 52 L100 30 L110 52 Z" fill=${`url(#${id}-wwt)`} stroke="#B8860B" stroke-width="1.4" stroke-linejoin="round" />
    <path d=${starPath(100, 44, 6)} fill="#C8102E" />
  </g>`,
  prop: () => html`<g fill="none" stroke="#F2C230" stroke-width="3" class="glow-lasso">
    <ellipse cx="18" cy="226" rx="13" ry="9" /><ellipse cx="18" cy="226" rx="9" ry="6" /><path d="M31 226 C40 232 40 242 34 250" stroke-linecap="round" />
  </g>`,
};

const flash = {
  id: 'flash', name: 'Flash', price: 300, shirt: '#D61F26', sleeve: '#D61F26', gloves: '#D61F26', hideHair: true,
  torso: () => html`<g>
    <circle cx="100" cy="211" r="15" fill="#FFFFFF" stroke="#F2C230" stroke-width="3" />
    ${bolt()}
    ${belt('#F2C230', 246, 6)}
  </g>`,
  collar: plainCollar('#D61F26', '#9E1419'),
  sleeves: cuff('#F2C230', 224, 5),
  face: () => html`<g>
    <path fill-rule="evenodd" d=${`${HEAD_MASK} M100 80 C124 80 140 96 140 118 C140 142 122 160 100 160 C78 160 60 142 60 118 C60 96 76 80 100 80 Z`} fill="#D61F26" stroke="#9E1419" stroke-width="2.4" />
    <path d="M32 94 L16 84 L24 98 L12 100 L32 110 Z" fill="#F2C230" stroke="#C99A12" stroke-width="1.2" stroke-linejoin="round" />
    <path d=${mirror('M32 94 L16 84 L24 98 L12 100 L32 110 Z')} fill="#F2C230" stroke="#C99A12" stroke-width="1.2" stroke-linejoin="round" />
  </g>`,
};

const aquaman = {
  id: 'aquaman', name: 'Aquaman', price: 300, shirt: '#E8892B', sleeve: '#2E8B57', gloves: '#2E8B57',
  torso: () => {
    const rows = [];
    for (let y = 186, r = 0; y < 244; y += 9, r++) {
      for (let x = 44 + (r % 2) * 6; x < 156; x += 12) rows.push(html`<path key=${`${x}-${y}`} d=${`M${x} ${y} q6 8 12 0`} stroke="#B8621B" stroke-width="1.4" fill="none" />`);
    }
    return html`<g>${rows}${belt('#E3B341', 246, 8)}<circle cx="100" cy="250" r="6" fill="#E3B341" stroke="#B8860B" stroke-width="1.4" /></g>`;
  },
  collar: plainCollar('#E8892B', '#B8621B'),
  sleeves: cuff('#E3B341', 222, 5),
  prop: () => html`<g transform="translate(18 238) rotate(-12)" stroke="#E3B341" stroke-linecap="round" fill="none">
    <path d="M0 18 L0 -40" stroke-width="4" />
    <path d="M-10 -38 L10 -38 M-10 -38 L-10 -52 M0 -40 L0 -58 M10 -38 L10 -52" stroke-width="3" />
    <path d="M-13 -50 L-10 -56 L-7 -50 M-3 -56 L0 -62 L3 -56 M7 -50 L10 -56 L13 -50" stroke-width="2.4" stroke-linejoin="round" />
  </g>`,
};

const HEROES = [spiderman, ironman, captainAmerica, hulk, thor, blackPanther, captainMarvel, batman, superman, wonderWoman, flash, aquaman];

export const COSTUMES = [
  pompier,
  police,
  medecin,
  superheros,
  ...HEROES,
  turtle('#2F6FE0', 'bleue'),
  turtle('#E2363F', 'rouge'),
  turtle('#8A4FD8', 'violette'),
  turtle('#FF8C1A', 'orange'),
  ...KITS,
  rabbin,
  dompteur,
  dresseurDragons,
  astronaute,
  chef,
  chevalier,
  capitaine,
  magicien,
  princesse,
  prince,
];

// Familles de costumes, pour ranger le rayon de la boutique
export const COSTUME_GROUPS = [
  { id: 'heros', label: 'Super-héros', icon: '🦸', ids: ['superheros', ...HEROES.map((h) => h.id)] },
  { id: 'foot', label: 'Maillots de foot', icon: '⚽', ids: KITS.map((k) => k.id) },
  { id: 'metiers', label: 'Métiers', icon: '🧑‍🚒', ids: ['pompier', 'police', 'medecin', 'chef', 'astronaute_combi', 'rabbin'] },
  { id: 'aventure', label: 'Contes et aventures', icon: '🏰', ids: ['chevalier', 'capitaine', 'magicien', 'princesse', 'prince', 'dompteur', 'dresseur_dragons'] },
  { id: 'tortues', label: 'Tortues ninja', icon: '🐢', ids: COSTUMES.filter((c) => c.id.startsWith('tortue_')).map((c) => c.id) },
];
