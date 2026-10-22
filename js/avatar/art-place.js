// Où se pose l'image 3D de chaque objet, dans le repère de son dessin (voir art.js pour les champs).
// Clé : « rayon/identifiant » quand deux objets partagent un identifiant, sinon l'identifiant seul.
// Valeurs de départ mesurées sur les dessins, puis ajustées à l'œil sur chaque image.
import { html } from '../vendor/preact-htm.js';
import { sparkle } from './draw.js';
import { letters } from './judaica.js';

// Petits effets dessinés autour des images : gyrophares, fumée, flamme, faisceau, vague
const blink = (lights) => html`<g>${lights.map(([cx, cy, color, delay], i) => html`<ellipse key=${i} class="blink-light" style=${{ animationDelay: `${delay}s` }} cx=${cx} cy=${cy} rx="7" ry="4.6" fill=${color} opacity="0.55" />`)}</g>`;
const puff = (x, y) => html`<g class="puff"><circle cx=${x} cy=${y} r="5" fill="#D8D4E8" /><circle cx=${x + 7} cy=${y - 7} r="3.4" fill="#D8D4E8" /></g>`;
// Flamme qui danse (feu de camp, bougie) : sa base en (x, y)
const flame = (x, y, k = 1, cls = 'flame') => html`<g transform=${`translate(${x} ${y}) scale(${k})`}><g class=${cls}>
  <path d="M-6 0 C-6 -10 0 -16 0 -22 C4 -14 8 -10 6 0 Z" fill="#FF8A2B" /><path d="M-3 0 C-3 -6 0 -10 0 -14 C3 -8 4 -6 3 0 Z" fill="#FFF3B0" /></g></g>`;
// Les deux bougies de Chabbat : lueur et flamme au bout de chaque bougie, étincelles
const candles = (ctx, tips) => html`<g>
  <defs><radialGradient id=${`${ctx.id}-glow`}><stop offset="0%" stop-color="#FFE9A0" stop-opacity="0.85" /><stop offset="100%" stop-color="#FFE9A0" stop-opacity="0" /></radialGradient></defs>
  ${tips.map(([x, y]) => html`<g key=${x}><circle class="candle-glow" cx=${x} cy=${y - 6} r="9" fill=${`url(#${ctx.id}-glow)`} />${flame(x, y, 0.55, 'candle-flame')}</g>`)}
  <g class="chabbat-sparkles">${sparkle(14, 100, 4, 'tw', 0)}${sparkle(64, 96, 5, 'tw', 0.6)}${sparkle(40, 88, 3.4, 'tw', 1.1)}</g>
</g>`;
// Le fil du cerf-volant, du sol jusqu'à lui
const kiteString = html`<path d="M40 176 C30 140 62 108 54 62" stroke="#6B7486" stroke-width="1.2" fill="none" />`;

// Le cadre plein des décors (repère de l'avatar)
export const FRAME = { x: -20, y: -44, w: 240, h: 298 };

// Le décor 3D qu'apporte l'objet principal de la scène, quand l'enfant n'a pas acheté de décor
// (outdoor : assombri la nuit, comme le paysage)
const CASERNE = { img: 'fond_caserne', outdoor: true };
const COMMISSARIAT = { img: 'fond_commissariat', outdoor: true };
const FERME = { img: 'fond_ferme', outdoor: true };
const CIRCUIT = { img: 'fond_circuit', outdoor: true };
const SYNAGOGUE = { img: 'fond_synagogue' };
const CHABBAT = { img: 'fond_chabbat' };
const ESPACE = { img: 'fond_espace' };
const PLAGE = { img: 'fond_plage', outdoor: true };
export const THEMES = {
  camion_pompiers: CASERNE,
  voiture_police: COMMISSARIAT,
  tracteur: FERME,
  poney: FERME,
  kart: CIRCUIT,
  voiture_course: CIRCUIT,
  moto: CIRCUIT,
  fusee: ESPACE,
  soucoupe: ESPACE,
  bateau: PLAGE,
  sefer_torah: SYNAGOGUE,
  sidour: SYNAGOGUE,
  tehilim: SYNAGOGUE,
  houmash: SYNAGOGUE,
  bougies_chabbat: CHABBAT,
};

export const PLACE = {
  // --- Véhicules et montures (sol à y = 178) ---
  kart: { cx: 100, bottom: 178, w: 140, shadow: { rx: 62, ry: 7, dx: 2, dy: -4 }, cls: 'veh-bob', ride: { hips: [82, 147], s: 0.22, front: 141 } },
  poney: { cx: 105, bottom: 178, h: 108, shadow: 52, cls: 'veh-bob', ride: { hips: [99, 116], s: 0.22, front: 117 } },
  velo: { cx: 101, bottom: 178, w: 118, shadow: 60, cls: 'veh-bob' },
  trottinette: { cx: 104, bottom: 178, w: 90, shadow: 40, cls: 'veh-bob' },
  voiture_course: { cx: 112, bottom: 178, w: 186, shadow: { rx: 80, ry: 7, dy: -3 }, cls: 'veh-bob', ride: { hips: [97, 142], s: 0.2, front: 136 } },
  voiture_police: {
    cx: 115, bottom: 178, w: 176, shadow: 76, cls: 'veh-bob', ride: { hips: [126, 141], s: 0.17, front: 127 },
    over: () => blink([[108, 85, '#FF4D4D', 0], [123, 85, '#4D8BFF', 0.6]]),
  },
  camion_pompiers: {
    cx: 115, bottom: 178, w: 190, shadow: 82, cls: 'veh-bob', ride: { hips: [169, 134], s: 0.13, front: 123 },
    over: () => blink([[164, 79, '#4D8BFF', 0]]),
  },
  moto: { cx: 102, bottom: 178, w: 128, shadow: 52, cls: 'veh-bob', ride: { hips: [72, 124], s: 0.2, front: 125 } },
  tracteur: { cx: 115, bottom: 178, w: 150, shadow: 62, cls: 'veh-bob', ride: { hips: [94, 115], s: 0.17, front: 116 }, over: () => puff(165, 84) },
  bateau: {
    cx: 120, bottom: 174, w: 128, cls: 'veh-bob', ride: { hips: [95, 146], s: 0.2, front: 140 },
    over: () => html`<path class="wave" d="M-20 172 Q0 164 20 172 T60 172 T100 172 T140 172 T180 172 T220 172 T260 172 L260 200 L-20 200 Z" fill="#4DA3FF" opacity="0.85" />`,
  },
  avion: { cx: 112, bottom: 140, w: 172, cls: 'veh-hover', ride: { hips: [126, 93], s: 0.15, front: 90 } },
  helico: { cx: 104, bottom: 142, w: 180, cls: 'veh-hover', ride: { hips: [130, 113], s: 0.14, front: 116 } },
  fusee: {
    cx: 100, bottom: 146, h: 116, cls: 'veh-hover', ride: { hips: [100, 99], s: 0.17, win: { cx: 100, cy: 75, rx: 11.5, ry: 11.5 } },
    under: () => html`<g transform="translate(0 -7)"><g class="flame"><path d="M88 140 C90 156 96 166 100 176 C104 166 110 156 112 140 Z" fill="#FF8A2B" /><path d="M94 140 C96 150 98 158 100 166 C102 158 104 150 106 140 Z" fill="#FFF3B0" /></g></g>`,
  },
  soucoupe: {
    cx: 100, bottom: 140, w: 150, cls: 'veh-hover', ride: { hips: [100, 105], s: 0.21, front: 97, win: { cx: 100, cy: 79, rx: 29, ry: 19 } },
    under: () => html`<path class="glow-pulse" d="M78 132 L122 132 L152 178 L48 178 Z" fill="#FFF3B0" opacity="0.35" />`,
  },
  dragon_monture: { cx: 100, bottom: 178, h: 116, shadow: 60, cls: 'veh-bob', ride: { hips: [108, 113], s: 0.21, front: 116 }, over: () => puff(178, 90) },
  tandem: { cx: 105, bottom: 178, w: 160, shadow: 66, cls: 'veh-bob' },
  bus_fratrie: { cx: 117, bottom: 178, w: 200, shadow: 86, cls: 'veh-bob', ride: { hips: [98, 124], s: 0.12, front: 118 } },
  'vehicle/licorne': { cx: 105, bottom: 178, h: 112, shadow: 48, cls: 'veh-bob', ride: { hips: [95, 119], s: 0.21, front: 120 } },

  // --- Accessoires ---
  ballon_foot: { cx: 40, bottom: 178, w: 27, shadow: 13, cls: 'ball-bounce' },
  ballon_basket: { cx: 40, bottom: 178, w: 27, shadow: 13, cls: 'ball-bounce' },
  skate: { cx: 44, bottom: 178, w: 66, shadow: 28 },
  trophee: { cx: 40, bottom: 178, h: 56, shadow: 18, over: () => sparkle(62, 118, 5, 'tw', 0.3) },
  guitare: { cx: 36, bottom: 178, h: 82, shadow: 14 },
  cerf_volant: { cx: 54, bottom: 142, h: 104, cls: 'sway', under: () => kiteString },
  'gear/robot': { cx: 42, bottom: 178, h: 64, shadow: 16 },
  telescope: { cx: 40, bottom: 178, h: 66, shadow: 22, over: () => sparkle(72, 104, 5, 'tw', 0) },
  batterie: { cx: 44, bottom: 178, w: 66, shadow: 30 },
  talkie: { cx: 46, bottom: 178, h: 58, shadow: 24 },

  // --- Le jardin de la fratrie ---
  cabane: { cx: 170, bottom: 178, h: 178, shadow: 40 },
  trampoline: { cx: 168, bottom: 178, w: 110, shadow: 46 },
  piscine: { cx: 170, bottom: 178, w: 116, shadow: 50 },
  tente: { cx: 172, bottom: 178, w: 124, shadow: 52, over: () => flame(218, 166, 0.8) },
  chateau_gonflable: { cx: 170, bottom: 178, w: 116, shadow: 50 },

  // --- Judaïsme ---
  sidour: { cx: 40.5, bottom: 178, h: 31, shadow: 12, over: () => letters(41, 150, ['א', 'ב', 'ג']) },
  tehilim: { cx: 40, bottom: 178, h: 26, shadow: 9, over: () => letters(40, 152, ['♪', '♫', '♪']) },
  houmash: { cx: 40.5, bottom: 178, h: 40, shadow: 13, over: () => letters(42, 136, ['ב', 'ש', 'ת']) },
  bougies_chabbat: { cx: 40, bottom: 178, h: 64, shadow: 20, over: (ctx) => candles(ctx, [[34.4, 115], [45.2, 115]]) },
  sefer_torah: { cx: 40, bottom: 178, h: 120, shadow: 18, over: () => html`<g class="torah-sparkles">${sparkle(10, 74, 5, 'tw', 0.2)}${sparkle(70, 70, 4, 'tw', 0.9)}${sparkle(68, 120, 3.4, 'tw', 1.4)}</g>` },

  // --- Chapeaux (haut du crâne à y = 26) ---
  couronne: { cx: 100, bottom: 54, w: 96, over: () => html`<g>${sparkle(134, 14, 7, 'tw', 0)}${sparkle(64, 22, 5, 'tw', 0.8)}</g>` },
  casquette: { cx: 100, bottom: 76, w: 122, h: 92 },
  casquette_equipe: { cx: 100, bottom: 76, w: 122, h: 92 },
  sorcier: { cx: 100, bottom: 64, w: 140, h: 130, over: () => sparkle(132, -40, 6, 'tw', 0.3) },
  pirate: { cx: 100, bottom: 58, w: 150 },
  chat: { cx: 100, bottom: 74, w: 128, h: 70 },
  fleurs: { cx: 100, bottom: 82, w: 140 },
  bonnet: { cx: 126, bottom: 80, w: 176, h: 104 },
  'hat/licorne': { img: 'licorne_corne', cx: 100, bottom: 78, w: 90, over: () => html`<g>${sparkle(126, -30, 6, 'tw', 0.4)}${sparkle(72, -6, 4, 'tw', 1.1)}</g>` },
  // Kippas : la calotte posée sur le haut du crâne, un peu aplatie (vue de face, elle épouse la tête)
  kippa_velours: { cx: 100, bottom: 36, w: 74, h: 24 },
  kippa_srouga: { cx: 100, bottom: 36, w: 76, h: 25 },
  kippa_chabbat: { cx: 100, bottom: 36, w: 74, h: 24 },
  kippa_maguen: { cx: 100, bottom: 36, w: 74, h: 24 },
  kippa_foot: { cx: 100, bottom: 36, w: 74, h: 25 },

  // --- Lunettes et masques (yeux à y ≈ 104) ---
  soleil: { cx: 100, bottom: 123, w: 100 },
  coeurs: { cx: 100, bottom: 123.5, w: 100 },
  etoiles: { cx: 100, bottom: 128, w: 104 },
  masque: { cx: 100, bottom: 128, w: 132 },
  moustache: { cx: 100, bottom: 143, w: 80 },

  // --- Autour du cou (encolure à y ≈ 183) ---
  noeud: { cx: 100, bottom: 200, w: 46 },
  medaille: { cx: 100, bottom: 236, h: 60 },
  medaille_equipe: { cx: 100, bottom: 236, h: 60 },

  // --- Dans le dos (derrière le buste) ---
  fee: { cx: 100, bottom: 236, w: 196 },
  dragon: { cx: 100, bottom: 222, w: 216 },
  jetpack: {
    cx: 100, bottom: 244, w: 128,
    under: () => html`<g class="flame"><path d="M44 236 Q53 270 62 236 Z" fill="#FFB13B" /><path d="M138 236 Q147 270 156 236 Z" fill="#FFB13B" /></g>`,
  },

  // --- Compagnons (aux pieds de l'enfant, à sa gauche) ---
  chaton: { cx: 176, bottom: 247, h: 76 },
  chiot: { cx: 172, bottom: 247, h: 72 },
  pandi: { cx: 170, bottom: 247, h: 70 },
  bebe_dragon: { cx: 170, bottom: 246, h: 76 },
  'pet/robot': { img: 'robot_copain', cx: 170, bottom: 245, h: 80 },

  // --- Décors (plein cadre) ---
  chateau: { img: 'fond_chateau', cover: FRAME },
  ocean: { img: 'fond_ocean', cover: FRAME },
  chambre: { img: 'fond_chambre', cover: FRAME },
  espace: { img: 'fond_espace', cover: FRAME },
  foret: { img: 'fond_foret', cover: FRAME },
  plage: { img: 'fond_plage', cover: FRAME },
  arcenciel: { img: 'fond_arcenciel', cover: FRAME },
};
