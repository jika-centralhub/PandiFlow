// Catalogue des accessoires. Chaque objet sait se dessiner (render) dans le repère de l'avatar.
// Les chapeaux sont dessinés pour un haut de crâne à y = 26, puis recalés selon la coiffure.
import { html } from '../vendor/preact-htm.js';
import { REWARDS } from './rewards.js';
import { COSTUMES } from './costumes.js';
import { GARAGE_ITEMS, GARAGE_SLOTS } from './garage.js';
import { starPath, heartPath, grad, GOLD, sparkle, mirror } from './draw.js';
import { JUDAICA_WEAR } from './judaica.js';
import { withArt } from './art.js';

export { starPath, heartPath };

export const SLOTS = {
  skin: { label: 'Costumes complets', icon: '🎭' },
  hat: { label: 'Chapeaux', icon: '🎩' },
  face: { label: 'Lunettes et masques', icon: '🕶️' },
  neck: { label: 'Autour du cou', icon: '🎀' },
  back: { label: 'Capes et ailes', icon: '🦸' },
  outfit: { label: 'Pyjamas', icon: '👕' },
  pet: { label: 'Compagnons', icon: '🐾' },
  bg: { label: 'Décors', icon: '🏞️' },
  fx: { label: 'Effets magiques', icon: '✨' },
  ...GARAGE_SLOTS,
  magic: { label: 'Trésors des défis', icon: '🏆' },
};

// --- Cadeaux du défi d'équipe (à porter) ---------------------------------------------------
const teamWear = [
  {
    id: 'medaille_equipe', name: 'Médaille de l’équipe', slot: 'neck',
    render: ({ id }) => html`<g>
      <defs>${grad(`${id}-tm`, GOLD)}</defs>
      <path d="M84 182 L100 204 L116 182" stroke="#9B6CF0" stroke-width="7" fill="none" stroke-linejoin="round" />
      <path d="M88 182 L100 200 L112 182" stroke="#FF7EB6" stroke-width="2.4" fill="none" stroke-linejoin="round" />
      <circle cx="100" cy="213" r="13" fill=${`url(#${id}-tm)`} stroke="#B8860B" stroke-width="2" />
      <path d=${heartPath(100, 213, 6.4)} fill="#FF7EB6" stroke="#fff" stroke-width="1.2" />
      ${sparkle(118, 204, 4, 'tw', 0.4)}
    </g>`,
  },
  {
    id: 'capes_jumelles', name: 'Capes jumelles', slot: 'back',
    render: ({ id }) => html`<g class="flutter">
      <defs>${grad(`${id}-cj`, ['#C59BFF', '#9B6CF0', '#6A40C8'])}</defs>
      <path d="M56 184 C30 206 12 236 2 262 C60 270 140 270 198 262 C188 236 170 206 144 184 Z" fill=${`url(#${id}-cj)`} stroke="#4B2A9A" stroke-width="2" />
      ${[[40, 240], [100, 254], [160, 240], [70, 222], [130, 222]].map(([x, y]) => html`<path key=${x} d=${heartPath(x, y, 6)} fill="#FF9EC7" opacity="0.9" />`)}
    </g>`,
  },
  {
    id: 'casquette_equipe', name: 'Casquette de l’équipe', slot: 'hat',
    render: ({ id }) => html`<g>
      <defs>${grad(`${id}-tc`, ['#C59BFF', '#9B6CF0', '#6A40C8'])}</defs>
      <path d="M40 64 C38 28 66 12 100 12 C134 12 162 28 160 64 Z" fill=${`url(#${id}-tc)`} stroke="#4B2A9A" stroke-width="2" />
      <path d="M100 13 L100 62" stroke="rgba(0,0,0,.14)" stroke-width="2" />
      <path d=${heartPath(100, 40, 10)} fill="#FF7EB6" stroke="#fff" stroke-width="1.6" />
      <path d="M46 60 C70 54 130 54 154 60 C162 66 162 72 154 76 C130 70 70 70 46 76 C38 72 38 66 46 60 Z" fill="#FF7EB6" stroke="#D94A8A" stroke-width="1.6" />
      <circle cx="100" cy="13" r="5" fill="#FF9EC7" />
    </g>`,
  },
].map((it) => ({ ...it, price: 0, exclusive: true, team: true }));

// --- Chapeaux -------------------------------------------------------------------------
const hats = [
  {
    id: 'casquette', name: 'Casquette', price: 20,
    render: ({ id }) => html`<g>
      <defs>${grad(`${id}-cap`, ['#FF7A7A', '#E23B3B', '#B92B2B'])}</defs>
      <path d="M40 64 C38 28 66 12 100 12 C134 12 162 28 160 64 Z" fill=${`url(#${id}-cap)`} stroke="#9E2323" stroke-width="2" />
      <path d="M100 13 L100 62" stroke="rgba(0,0,0,.14)" stroke-width="2" />
      <path d=${starPath(100, 40, 10)} fill="#fff" />
      <path d="M46 60 C70 54 130 54 154 60 C162 66 162 72 154 76 C130 70 70 70 46 76 C38 72 38 66 46 60 Z" fill="#C42F2F" stroke="#9E2323" stroke-width="1.6" />
      <circle cx="100" cy="13" r="5" fill="#FF9A9A" />
      <path d="M60 30 C72 21 88 17 100 17" stroke="#fff" stroke-width="4" opacity="0.3" fill="none" stroke-linecap="round" />
    </g>`,
  },
  {
    id: 'couronne', name: 'Couronne royale', price: 60,
    render: ({ id }) => html`<g>
      <defs>${grad(`${id}-gold`, GOLD)}</defs>
      <path d="M56 48 L60 10 L80 30 L100 0 L120 30 L140 10 L144 48 Z" fill=${`url(#${id}-gold)`} stroke="#B8860B" stroke-width="2" stroke-linejoin="round" />
      <rect x="54" y="40" width="92" height="13" rx="6" fill=${`url(#${id}-gold)`} stroke="#B8860B" stroke-width="2" />
      <circle cx="100" cy="46.5" r="5" fill="#E8455A" /><circle cx="76" cy="46.5" r="4" fill="#3FA9F5" /><circle cx="124" cy="46.5" r="4" fill="#45D18A" />
      <circle cx="60" cy="10" r="4.5" fill="#FFF3B0" /><circle cx="100" cy="0" r="5" fill="#FFF3B0" /><circle cx="140" cy="10" r="4.5" fill="#FFF3B0" />
      ${sparkle(132, 20, 7, 'tw', 0)}${sparkle(66, 26, 5, 'tw', 0.8)}
    </g>`,
  },
  {
    id: 'sorcier', name: 'Chapeau de sorcier', price: 50,
    render: ({ id }) => html`<g>
      <defs>${grad(`${id}-wiz`, ['#9B6CF0', '#6A40C8', '#4B2A9A'])}</defs>
      <ellipse cx="100" cy="54" rx="70" ry="13" fill="#4B2A9A" stroke="#341C72" stroke-width="2" />
      <path d="M58 52 C70 30 84 -4 104 -40 C110 -50 124 -48 128 -40 C116 -34 112 -22 112 -4 C114 18 128 36 142 52 Z" fill=${`url(#${id}-wiz)`} stroke="#341C72" stroke-width="2" stroke-linejoin="round" />
      <path d="M61 46 C86 40 116 40 139 46 L142 53 C116 47 86 47 58 53 Z" fill="#FFD23F" />
      <path d=${starPath(92, 14, 7)} fill="#FFD23F" /><path d=${starPath(110, 30, 5)} fill="#FFD23F" />
      <path d="M98 -16 a9 9 0 1 0 6 14 a7 7 0 1 1 -6 -14 Z" fill="#FFF3B0" />
      ${sparkle(128, -36, 6, 'tw', 0.3)}
    </g>`,
  },
  {
    id: 'pirate', name: 'Chapeau de pirate', price: 45,
    render: () => html`<g>
      <path d="M26 56 C32 22 66 2 100 14 C134 2 168 22 174 56 C150 44 50 44 26 56 Z" fill="#2B2B38" stroke="#111" stroke-width="2" stroke-linejoin="round" />
      <path d="M26 56 C50 44 150 44 174 56" stroke="#FFD23F" stroke-width="3.5" fill="none" />
      <circle cx="100" cy="30" r="9" fill="#fff" /><rect x="95" y="34" width="10" height="7" rx="2" fill="#fff" />
      <circle cx="96.5" cy="29.5" r="2.4" fill="#2B2B38" /><circle cx="103.5" cy="29.5" r="2.4" fill="#2B2B38" />
      <path d="M86 40 L114 50 M114 40 L86 50" stroke="#fff" stroke-width="3" stroke-linecap="round" />
    </g>`,
  },
  {
    id: 'chat', name: 'Oreilles de chat', price: 25,
    render: () => html`<g>
      <path d="M38 72 C44 32 156 32 162 72" stroke="#3B3B48" stroke-width="7" fill="none" stroke-linecap="round" />
      <g class="ear-l"><path d="M50 46 L54 6 L84 30 Z" fill="#3B3B48" stroke="#22222c" stroke-width="2" stroke-linejoin="round" /><path d="M57 38 L59 17 L75 31 Z" fill="#FF9EC7" /></g>
      <g class="ear-r"><path d="M150 46 L146 6 L116 30 Z" fill="#3B3B48" stroke="#22222c" stroke-width="2" stroke-linejoin="round" /><path d="M143 38 L141 17 L125 31 Z" fill="#FF9EC7" /></g>
    </g>`,
  },
  {
    id: 'fleurs', name: 'Couronne de fleurs', price: 35,
    render: () => {
      const pts = [[42, 72], [54, 52], [74, 38], [100, 33], [126, 38], [146, 52], [158, 72]];
      const cols = ['#FF7EB6', '#FFD23F', '#B490FF', '#FF7EB6', '#5EC8FF', '#FFD23F', '#B490FF'];
      return html`<g>
        <path d="M38 76 C50 38 150 38 162 76" stroke="#3DBE6A" stroke-width="5" fill="none" />
        ${pts.map(([x, y], i) => html`<g key=${i}>
          <ellipse cx=${x + 7} cy=${y + 4} rx="6" ry="3" fill="#3DBE6A" transform=${`rotate(30 ${x + 7} ${y + 4})`} />
          ${[0, 72, 144, 216, 288].map((a) => html`<circle key=${a} cx=${x + 6 * Math.cos((a * Math.PI) / 180)} cy=${y + 6 * Math.sin((a * Math.PI) / 180)} r="5" fill=${cols[i]} />`)}
          <circle cx=${x} cy=${y} r="3.6" fill="#FFF3B0" />
        </g>`)}
      </g>`;
    },
  },
  {
    id: 'bonnet', name: 'Bonnet de nuit', price: 20,
    render: ({ id }) => html`<g>
      <defs>${grad(`${id}-nc`, ['#7C9BFF', '#5A73E8', '#4458C4'])}</defs>
      <path d="M38 64 C38 26 70 8 104 10 C138 12 162 32 178 60 C186 72 190 82 190 94 C178 80 166 70 150 62 Z" fill=${`url(#${id}-nc)`} stroke="#33449E" stroke-width="2" stroke-linejoin="round" />
      <path d=${starPath(80, 30, 5)} fill="#FFD23F" /><path d=${starPath(120, 26, 4)} fill="#FFD23F" /><path d=${starPath(156, 54, 4)} fill="#FFD23F" />
      <path d="M34 62 C60 52 140 52 166 62 L166 74 C140 64 60 64 34 74 Z" fill="#FFF6E5" stroke="#E5D9BF" stroke-width="1.6" />
      <g class="pompom"><circle cx="190" cy="96" r="11" fill="#FFF6E5" stroke="#E5D9BF" stroke-width="1.6" /></g>
    </g>`,
  },
  {
    id: 'licorne', name: 'Corne de licorne', price: 55,
    render: ({ id }) => html`<g>
      <defs>${grad(`${id}-horn`, ['#FFF6C2', '#FFD23F', '#FF9EC7'])}</defs>
      <path d="M90 50 L100 -18 L110 50 Z" fill=${`url(#${id}-horn)`} stroke="#E79BC1" stroke-width="2" stroke-linejoin="round" />
      <path d="M92 40 L108 33 M94 26 L106 20 M96 12 L104 8" stroke="#E79BC1" stroke-width="2.2" stroke-linecap="round" />
      <circle cx="86" cy="50" r="6" fill="#B490FF" /><circle cx="114" cy="50" r="6" fill="#5EC8FF" /><circle cx="100" cy="54" r="6" fill="#FF7EB6" />
      ${sparkle(118, -8, 6, 'tw', 0.4)}${sparkle(80, 6, 4, 'tw', 1.1)}
    </g>`,
  },
  {
    id: 'astronaute', name: "Casque d'astronaute", price: 90, free: true,
    render: () => html`<g>
      <path d="M44 162 C70 178 130 178 156 162 L160 174 C130 192 70 192 40 174 Z" fill="#CFD8E6" stroke="#9AA8BD" stroke-width="2" />
      <circle cx="100" cy="98" r="80" fill="rgba(170,215,255,0.16)" stroke="#EAF2FF" stroke-width="6" />
      <circle cx="100" cy="98" r="74" fill="none" stroke="rgba(120,160,220,0.45)" stroke-width="2" />
      <path d="M46 62 C58 40 80 27 104 25" stroke="#fff" stroke-width="7" fill="none" opacity="0.65" stroke-linecap="round" />
      <path d="M150 140 C156 130 160 120 161 110" stroke="#fff" stroke-width="4" fill="none" opacity="0.4" stroke-linecap="round" />
    </g>`,
  },
];

// --- Lunettes et masques -----------------------------------------------------------------
const faces = [
  {
    id: 'soleil', name: 'Lunettes de soleil', price: 20,
    render: ({ id }) => html`<g>
      <defs>${grad(`${id}-sun`, ['#3B3B5C', '#1D1D2B'])}</defs>
      <path d="M58 96 Q58 92 64 92 L92 92 Q96 92 95 97 L93 110 Q91 120 80 120 L72 120 Q60 120 59 108 Z" fill=${`url(#${id}-sun)`} stroke="#111" stroke-width="2.5" />
      <path d="M142 96 Q142 92 136 92 L108 92 Q104 92 105 97 L107 110 Q109 120 120 120 L128 120 Q140 120 141 108 Z" fill=${`url(#${id}-sun)`} stroke="#111" stroke-width="2.5" />
      <path d="M95 98 Q100 95 105 98 M59 98 L44 96 M141 98 L156 96" stroke="#111" stroke-width="3" fill="none" />
      <path d="M66 101 L76 96 M112 101 L122 96" stroke="#fff" stroke-width="3" opacity="0.55" stroke-linecap="round" />
    </g>`,
  },
  {
    id: 'coeurs', name: 'Lunettes cœur', price: 30,
    render: () => html`<g fill="rgba(255,80,150,0.5)" stroke="#E0287A" stroke-width="3" stroke-linejoin="round">
      <path d=${heartPath(78, 104, 15)} /><path d=${heartPath(122, 104, 15)} />
      <path d="M94 100 Q100 96 106 100 M62 100 L44 96 M138 100 L156 96" fill="none" />
    </g>`,
  },
  {
    id: 'masque', name: 'Masque de super-héros', price: 40,
    render: () => html`<g>
      <path d="M46 102 L28 92 L32 110 Z M154 102 L172 92 L168 110 Z" fill="#2457B8" />
      <path fill-rule="evenodd" d="M44 98 C66 84 134 84 156 98 C160 114 146 124 128 120 C116 118 108 112 100 112 C92 112 84 118 72 120 C54 124 40 114 44 98 Z M64 105 a14 10 0 1 0 28 0 a14 10 0 1 0 -28 0 Z M108 105 a14 10 0 1 0 28 0 a14 10 0 1 0 -28 0 Z" fill="#2D6CDF" stroke="#1D4FA8" stroke-width="2" />
    </g>`,
  },
  {
    id: 'etoiles', name: 'Lunettes étoiles', price: 35,
    render: () => html`<g fill="rgba(255,210,63,0.35)" stroke="#FFB300" stroke-width="3" stroke-linejoin="round">
      <path d=${starPath(78, 106, 19, 10)} /><path d=${starPath(122, 106, 19, 10)} />
      <path d="M95 102 Q100 98 105 102 M60 100 L44 96 M140 100 L156 96" fill="none" />
    </g>`,
  },
  {
    id: 'moustache', name: 'Moustache rigolote', price: 15, anchor: 'nose',
    render: () => html`<path class="wiggle" d="M100 127 C92 121 80 123 74 131 C70 137 62 135 60 129 C62 141 76 143 86 135 C92 131 96 131 100 133 C104 131 108 131 114 135 C124 143 138 141 140 129 C138 135 130 137 126 131 C120 123 108 121 100 127 Z" fill="#3A2A22" />`,
  },
];

// --- Autour du cou --------------------------------------------------------------------------
const necks = [
  {
    id: 'noeud', name: 'Nœud papillon', price: 15,
    render: () => html`<g>
      <path d="M100 188 L78 177 L78 199 Z M100 188 L122 177 L122 199 Z" fill="#E8455A" stroke="#B02A3C" stroke-width="2" stroke-linejoin="round" />
      <circle cx="100" cy="188" r="5.5" fill="#C83246" />
    </g>`,
  },
  {
    id: 'medaille', name: "Médaille d'or", price: 40,
    render: ({ id }) => html`<g>
      <defs>${grad(`${id}-med`, GOLD)}</defs>
      <path d="M86 182 L100 204 L114 182" stroke="#3FA9F5" stroke-width="7" fill="none" stroke-linejoin="round" />
      <circle cx="100" cy="212" r="12" fill=${`url(#${id}-med)`} stroke="#B8860B" stroke-width="2" />
      <path d=${starPath(100, 212, 6.5)} fill="#fff" opacity="0.9" />
      ${sparkle(110, 202, 4, 'tw', 0.2)}
    </g>`,
  },
  {
    id: 'echarpe', name: 'Écharpe rayée', price: 25,
    render: () => html`<g>
      <path d="M68 178 C86 192 114 192 132 178 L134 191 C114 204 86 204 66 191 Z" fill="#FF9F43" stroke="#E07B1E" stroke-width="1.6" />
      <path d="M116 192 L127 228 L112 230 L106 196 Z" fill="#FF9F43" stroke="#E07B1E" stroke-width="1.6" />
      <path d="M80 186 L80 198 M100 190 L100 202 M120 186 L120 198 M109 206 L121 204 M111 216 L124 214" stroke="#fff" stroke-width="4" />
    </g>`,
  },
];

// --- Capes et ailes (derrière le personnage) -----------------------------------------------------
const backs = [
  {
    id: 'cape', name: 'Cape de super-héros', price: 60,
    render: ({ id }) => html`<g class="flutter">
      <defs>${grad(`${id}-cape`, ['#FF5E6C', '#D92A40', '#A81C30'])}</defs>
      <path d="M56 184 C30 206 12 236 2 262 C60 270 140 270 198 262 C188 236 170 206 144 184 Z" fill=${`url(#${id}-cape)`} stroke="#8E1726" stroke-width="2" />
    </g>`,
  },
  {
    id: 'fee', name: 'Ailes de fée', price: 80,
    render: ({ id }) => {
      const wing = (side) => html`<g class=${side < 0 ? 'wing-l' : 'wing-r'}>
        <ellipse cx=${100 + side * 50} cy="170" rx="36" ry="22" transform=${`rotate(${side * 32} ${100 + side * 50} 170)`} fill=${`url(#${id}-fw)`} stroke="#fff" stroke-width="2" />
        <ellipse cx=${100 + side * 44} cy="212" rx="25" ry="15" transform=${`rotate(${-side * 26} ${100 + side * 44} 212)`} fill=${`url(#${id}-fw)`} stroke="#fff" stroke-width="2" />
      </g>`;
      return html`<g>
        <defs><linearGradient id=${`${id}-fw`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="rgba(180,235,255,0.9)" /><stop offset="100%" stop-color="rgba(255,160,230,0.8)" />
        </linearGradient></defs>
        ${wing(-1)}${wing(1)}
        ${sparkle(30, 150, 5, 'tw', 0.2)}${sparkle(172, 160, 5, 'tw', 0.9)}
      </g>`;
    },
  },
  {
    id: 'dragon', name: 'Ailes de dragon', price: 100,
    render: ({ id }) => {
      const left = 'M72 192 C42 160 14 150 -6 156 C6 166 8 178 3 188 C14 186 22 192 24 202 C32 196 42 198 48 208 C54 200 62 198 72 202 Z';
      const right = mirror(left);
      return html`<g>
        <defs>${grad(`${id}-dw`, ['#9D6BFF', '#6B3FD0', '#47258F'])}</defs>
        <g class="wing-l"><path d=${left} fill=${`url(#${id}-dw)`} stroke="#341C72" stroke-width="2" stroke-linejoin="round" />
          <path d="M70 194 L8 160 M68 196 L24 200 M68 198 L48 206" stroke="#C4A6FF" stroke-width="1.6" opacity="0.7" /></g>
        <g class="wing-r"><path d=${right} fill=${`url(#${id}-dw)`} stroke="#341C72" stroke-width="2" stroke-linejoin="round" />
          <path d="M130 194 L192 160 M132 196 L176 200 M132 198 L152 206" stroke="#C4A6FF" stroke-width="1.6" opacity="0.7" /></g>
      </g>`;
    },
  },
  {
    id: 'jetpack', name: 'Jetpack', price: 120,
    render: ({ id }) => html`<g>
      <defs>${grad(`${id}-jp`, ['#F2F5FA', '#B9C3D3', '#8794AB'], false)}
        <linearGradient id=${`${id}-fl`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFF3B0" /><stop offset="50%" stop-color="#FFB13B" /><stop offset="100%" stop-color="rgba(255,90,60,0)" /></linearGradient>
      </defs>
      <g class="flame"><path d="M22 222 Q32 262 42 222 Z" fill=${`url(#${id}-fl)`} /><path d="M158 222 Q168 262 178 222 Z" fill=${`url(#${id}-fl)`} /></g>
      <rect x="20" y="170" width="24" height="54" rx="11" fill=${`url(#${id}-jp)`} stroke="#6B778C" stroke-width="2" />
      <rect x="156" y="170" width="24" height="54" rx="11" fill=${`url(#${id}-jp)`} stroke="#6B778C" stroke-width="2" />
      <rect x="20" y="190" width="24" height="6" fill="#E8455A" /><rect x="156" y="190" width="24" height="6" fill="#E8455A" /><path d="M44 186 L60 194 M156 186 L140 194" stroke="#6B778C" stroke-width="5" stroke-linecap="round" />
    </g>`,
  },
];

// --- Pyjamas (motifs sur le haut) -----------------------------------------------------------------
const outfits = [
  {
    id: 'pyjama_etoiles', name: 'Pyjama étoilé', price: 40, color: '#4A5BD6',
    render: () => html`<g fill="#FFD23F">
      ${[[66, 206], [90, 224], [122, 200], [138, 230], [104, 244], [74, 238], [112, 216], [58, 226]].map(([x, y], i) => html`<path key=${i} d=${starPath(x, y, 5.5)} />`)}
    </g>`,
  },
  {
    id: 'pyjama_dino', name: 'Pyjama dino', price: 50, color: '#48C47A',
    render: () => html`<g>
      <ellipse cx="100" cy="232" rx="30" ry="28" fill="#9BE7B4" />
      ${[[64, 212], [138, 208], [70, 244], [132, 240]].map(([x, y], i) => html`<circle key=${i} cx=${x} cy=${y} r="6" fill="#2E9A5B" />`)}
      <path d="M86 214 L92 204 L98 214 L104 204 L110 214" fill="#FFB84D" stroke="#E5962A" stroke-width="1.5" stroke-linejoin="round" />
    </g>`,
  },
  {
    id: 'pyjama_fusee', name: 'Pyjama fusée', price: 50, color: '#2B3A7A',
    render: () => html`<g>
      ${[[64, 204], [140, 214], [72, 236], [130, 242], [118, 196]].map(([x, y], i) => html`<circle key=${i} cx=${x} cy=${y} r="1.8" fill="#fff" />`)}
      <path d="M92 236 L84 246 L92 244 Z M108 236 L116 246 L108 244 Z" fill="#E8455A" />
      <path d="M100 196 C111 206 113 222 108 238 L92 238 C87 222 89 206 100 196 Z" fill="#F4F6FB" stroke="#C5CCDA" stroke-width="1.5" />
      <circle cx="100" cy="214" r="5" fill="#5EC8FF" stroke="#2E7FB8" stroke-width="1.5" />
      <path d="M95 239 Q100 252 105 239 Z" fill="#FFB13B" />
    </g>`,
  },
  {
    id: 'tenue_heros', name: 'Tenue de super-héros', price: 70, color: '#2D6CDF',
    render: () => html`<g>
      <path d="M82 200 L118 200 L114 224 L100 234 L86 224 Z" fill="#FFD23F" stroke="#E0A100" stroke-width="2" stroke-linejoin="round" />
      <text x="100" y="224" text-anchor="middle" font-size="20" font-weight="700" font-family="Fredoka, sans-serif" fill="#D93A3A">P</text>
      <rect x="50" y="240" width="100" height="7" fill="#FFD23F" />
    </g>`,
  },
];

// --- Compagnons (en bas à droite, ils flottent un peu) ---------------------------------------------
const pets = [
  {
    id: 'chaton', name: 'Chaton', price: 70,
    render: () => html`<g transform="translate(168 210) scale(1.32)">
      <path class="tail" d="M14 12 C32 8 36 -12 26 -22" stroke="#E8893A" stroke-width="7" fill="none" stroke-linecap="round" />
      <ellipse cx="0" cy="13" rx="17" ry="14" fill="#F6A04D" />
      <ellipse cx="-7" cy="25" rx="5" ry="3.5" fill="#FFF1E0" /><ellipse cx="7" cy="25" rx="5" ry="3.5" fill="#FFF1E0" />
      <path d="M-13 -12 L-11 -29 L-1 -18 Z M13 -12 L11 -29 L1 -18 Z" fill="#F6A04D" />
      <path d="M-10 -15 L-9.5 -24 L-4 -18 Z M10 -15 L9.5 -24 L4 -18 Z" fill="#FF9EC7" />
      <circle cx="0" cy="-7" r="14.5" fill="#F6A04D" />
      <path d="M-4 -20 L-3 -15 M0 -21 L0 -15 M4 -20 L3 -15" stroke="#D9762A" stroke-width="2" stroke-linecap="round" />
      <ellipse cx="-5.5" cy="-8" rx="2.4" ry="3.2" fill="#2A1D1D" /><ellipse cx="5.5" cy="-8" rx="2.4" ry="3.2" fill="#2A1D1D" />
      <circle cx="-4.8" cy="-9.2" r="0.9" fill="#fff" /><circle cx="6.2" cy="-9.2" r="0.9" fill="#fff" />
      <path d="M-2 -3 L2 -3 L0 -1 Z" fill="#FF7B9C" />
      <path d="M-6 -2 L-17 -4 M-6 0 L-17 1 M6 -2 L17 -4 M6 0 L17 1" stroke="#7A4A2A" stroke-width="1" opacity="0.6" />
    </g>`,
  },
  {
    id: 'chiot', name: 'Chiot', price: 70,
    render: () => html`<g transform="translate(168 210) scale(1.32)">
      <path class="tail" d="M14 14 C26 10 30 0 28 -8" stroke="#B9824F" stroke-width="6" fill="none" stroke-linecap="round" />
      <ellipse cx="0" cy="14" rx="17" ry="14" fill="#C9935D" />
      <ellipse cx="0" cy="18" rx="9" ry="8" fill="#F1D6B4" />
      <circle cx="0" cy="-7" r="15" fill="#C9935D" />
      <g class="ear-l"><ellipse cx="-15" cy="-6" rx="6" ry="12" fill="#8C5A32" transform="rotate(16 -15 -6)" /></g>
      <g class="ear-r"><ellipse cx="15" cy="-6" rx="6" ry="12" fill="#8C5A32" transform="rotate(-16 15 -6)" /></g>
      <ellipse cx="0" cy="-1" rx="8" ry="6" fill="#F1D6B4" />
      <circle cx="-5.5" cy="-9" r="2.6" fill="#2A1D1D" /><circle cx="5.5" cy="-9" r="2.6" fill="#2A1D1D" />
      <circle cx="-4.6" cy="-10" r="0.9" fill="#fff" /><circle cx="6.4" cy="-10" r="0.9" fill="#fff" />
      <ellipse cx="0" cy="-3" rx="3.2" ry="2.3" fill="#2A1D1D" />
      <path d="M-1.5 3 Q0 9 1.5 3 Z" fill="#FF7B9C" />
    </g>`,
  },
  {
    id: 'pandi', name: 'Mini-panda Pandi', price: 90,
    render: () => html`<g transform="translate(168 210) scale(1.32)">
      <ellipse cx="0" cy="14" rx="17" ry="14" fill="#2B2B33" />
      <ellipse cx="0" cy="16" rx="10" ry="9" fill="#F8F8F8" />
      <circle cx="-12" cy="-19" r="6.5" fill="#2B2B33" /><circle cx="12" cy="-19" r="6.5" fill="#2B2B33" />
      <circle cx="0" cy="-7" r="15.5" fill="#F8F8F8" stroke="#DADAE2" stroke-width="1" />
      <ellipse cx="-6.5" cy="-8" rx="4.6" ry="5.8" fill="#2B2B33" transform="rotate(-25 -6.5 -8)" />
      <ellipse cx="6.5" cy="-8" rx="4.6" ry="5.8" fill="#2B2B33" transform="rotate(25 6.5 -8)" />
      <circle cx="-6" cy="-8.5" r="1.8" fill="#fff" /><circle cx="6" cy="-8.5" r="1.8" fill="#fff" />
      <ellipse cx="0" cy="-1" rx="2.8" ry="2" fill="#2B2B33" />
      <path d="M-3 2 Q0 5 3 2" stroke="#2B2B33" stroke-width="1.4" fill="none" stroke-linecap="round" />
      <circle cx="-11" cy="0" r="2.6" fill="#FF9EC7" opacity="0.6" /><circle cx="11" cy="0" r="2.6" fill="#FF9EC7" opacity="0.6" />
    </g>`,
  },
  {
    id: 'bebe_dragon', name: 'Bébé dragon', price: 120,
    render: () => html`<g transform="translate(168 208) scale(1.32)">
      <g class="wing-l"><path d="M-10 4 C-26 -10 -34 -6 -32 6 C-26 4 -20 8 -12 12 Z" fill="#7BE0A8" stroke="#2E9A5B" stroke-width="1.5" /></g>
      <g class="wing-r"><path d="M10 4 C26 -10 34 -6 32 6 C26 4 20 8 12 12 Z" fill="#7BE0A8" stroke="#2E9A5B" stroke-width="1.5" /></g>
      <path class="tail" d="M10 22 C24 26 28 18 30 10 L34 14 L32 6 Z" fill="#48C47A" />
      <ellipse cx="0" cy="14" rx="15" ry="13" fill="#48C47A" />
      <ellipse cx="0" cy="17" rx="8" ry="8" fill="#FFE08A" />
      <path d="M-8 -20 L-10 -30 L-3 -21 Z M8 -20 L10 -30 L3 -21 Z" fill="#FFD23F" />
      <circle cx="0" cy="-8" r="14" fill="#48C47A" />
      <circle cx="-5.5" cy="-10" r="3.2" fill="#fff" /><circle cx="5.5" cy="-10" r="3.2" fill="#fff" />
      <circle cx="-5" cy="-10" r="1.8" fill="#1F2A1F" /><circle cx="6" cy="-10" r="1.8" fill="#1F2A1F" />
      <circle cx="-3" cy="-1" r="1" fill="#1F7A45" /><circle cx="3" cy="-1" r="1" fill="#1F7A45" />
      <path d="M-4 2 Q0 5 4 2" stroke="#1F7A45" stroke-width="1.5" fill="none" stroke-linecap="round" />
      <g class="puff"><circle cx="-16" cy="-2" r="3.5" fill="#E9EEF5" /><circle cx="-22" cy="-6" r="2.5" fill="#E9EEF5" /></g>
    </g>`,
  },
  {
    id: 'robot', name: 'Robot copain', price: 110,
    render: ({ id }) => html`<g transform="translate(168 208) scale(1.32)">
      <defs>${grad(`${id}-rb`, ['#EEF2F8', '#B7C1D2', '#8A96AC'])}</defs>
      <line x1="0" y1="-24" x2="0" y2="-33" stroke="#8A96AC" stroke-width="2.5" />
      <circle class="blink-light" cx="0" cy="-35" r="3.6" fill="#FF5D6C" />
      <rect x="-15" y="2" width="30" height="24" rx="6" fill=${`url(#${id}-rb)`} stroke="#6B778C" stroke-width="1.6" />
      <circle cx="0" cy="14" r="4" fill="#FFD23F" />
      <rect x="-16" y="-24" width="32" height="26" rx="8" fill=${`url(#${id}-rb)`} stroke="#6B778C" stroke-width="1.6" />
      <rect x="-11" y="-19" width="22" height="16" rx="5" fill="#1F2B45" />
      <circle class="robot-eye" cx="-5" cy="-11" r="2.6" fill="#5EF0FF" /><circle class="robot-eye" cx="5" cy="-11" r="2.6" fill="#5EF0FF" />
      <path d="M-4 -6 Q0 -3 4 -6" stroke="#5EF0FF" stroke-width="1.5" fill="none" stroke-linecap="round" />
    </g>`,
  },
];

// --- Décors (fond plein cadre : x -20..220, y -36..254) ---------------------------------------------
const FRAME = { x: -20, y: -44, w: 240, h: 298 };
const frameRect = (fill) => html`<rect x=${FRAME.x} y=${FRAME.y} width=${FRAME.w} height=${FRAME.h} fill=${fill} />`;

const backgrounds = [
  {
    id: 'chambre', name: 'Chambre douillette', price: 60,
    render: ({ id }) => html`<g>
      <defs>${grad(`${id}-wall`, ['#7B6BE0', '#5B4BC4'])}</defs>
      ${frameRect(`url(#${id}-wall)`)}
      <rect x="132" y="-14" width="70" height="80" rx="10" fill="#22205A" stroke="#F3E6C8" stroke-width="5" />
      <path d="M167 -14 L167 66 M132 26 L202 26" stroke="#F3E6C8" stroke-width="3" />
      <path d="M182 4 a10 10 0 1 0 8 16 a8 8 0 1 1 -8 -16 Z" fill="#FFF3B0" />
      <path d="M-20 4 Q20 22 60 4 Q100 22 140 4" stroke="#3B2F8C" stroke-width="1.5" fill="none" />
      ${[[-4, 11], [20, 14], [44, 9], [76, 11], [100, 14], [124, 9]].map(([x, y], i) => html`<circle key=${i} class="tw" style=${{ animationDelay: `${i * 0.35}s` }} cx=${x} cy=${y} r="4" fill=${['#FFD23F', '#FF7EB6', '#5EC8FF'][i % 3]} />`)}
      <rect x="-20" y="214" width="240" height="40" fill="#4A3BA8" />
    </g>`,
  },
  {
    id: 'espace', name: 'Espace', price: 150,
    render: ({ id }) => html`<g>
      <defs><radialGradient id=${`${id}-sp`} cx="30%" cy="20%" r="90%"><stop offset="0%" stop-color="#3B2A8C" /><stop offset="100%" stop-color="#0B1036" /></radialGradient>
        ${grad(`${id}-pl`, ['#FFB37A', '#FF6B8B'])}</defs>
      ${frameRect(`url(#${id}-sp)`)}
      ${[[-6, -20], [30, 6], [60, -24], [150, -4], [198, 30], [12, 60], [190, 120], [-8, 150], [204, 190], [26, 200], [164, 70]].map(([x, y], i) => html`<circle key=${i} class="tw" style=${{ animationDelay: `${(i * 0.37) % 2}s` }} cx=${x} cy=${y} r=${i % 3 ? 1.6 : 2.6} fill="#fff" />`)}
      <circle cx="176" cy="6" r="18" fill=${`url(#${id}-pl)`} />
      <ellipse cx="176" cy="6" rx="30" ry="7" fill="none" stroke="#FFE3A8" stroke-width="3" transform="rotate(-18 176 6)" />
      <g class="drift"><circle cx="0" cy="96" r="7" fill="#9AD0FF" opacity="0.8" /><circle cx="-2" cy="94" r="2" fill="#fff" opacity="0.7" /></g>
    </g>`,
  },
  {
    id: 'foret', name: 'Forêt enchantée', price: 150,
    render: ({ id }) => html`<g>
      <defs>${grad(`${id}-fo`, ['#1C3F4A', '#2B6B55', '#3F8F5F'])}</defs>
      ${frameRect(`url(#${id}-fo)`)}
      ${[[-10, 150, 1.2], [30, 160, 0.9], [170, 150, 1.2], [210, 166, 1]].map(([x, y, s], i) => html`<path key=${i} d=${`M${x} ${y - 90 * s} L${x - 30 * s} ${y} L${x + 30 * s} ${y} Z M${x} ${y - 60 * s} L${x - 36 * s} ${y + 40 * s} L${x + 36 * s} ${y + 40 * s} Z`} fill="#174034" opacity="0.85" />`)}
      <rect x="-20" y="214" width="240" height="40" fill="#1F5A3E" />
      ${[[20, 40], [160, 30], [190, 100], [6, 120], [130, -10], [60, 0]].map(([x, y], i) => html`<circle key=${i} class="firefly" style=${{ animationDelay: `${i * 0.6}s` }} cx=${x} cy=${y} r="3" fill="#FFF59D" />`)}
    </g>`,
  },
  {
    id: 'chateau', name: 'Château de princesse', price: 200,
    render: ({ id }) => html`<g>
      <defs>${grad(`${id}-ch`, ['#FFB3D1', '#FFD9C2', '#FFE9B8'])}</defs>
      ${frameRect(`url(#${id}-ch)`)}
      <g fill="#E7B5F2" stroke="#C78ADB" stroke-width="2">
        <rect x="-16" y="60" width="36" height="160" /><rect x="180" y="60" width="36" height="160" />
        <path d="M-20 62 L2 20 L24 62 Z M176 62 L198 20 L220 62 Z" fill="#B983E8" />
      </g>
      <g class="flag"><path d="M2 20 L2 0 L18 6 L2 12" fill="#FF7EB6" stroke="#E0287A" stroke-width="1.5" /></g>
      <g class="flag"><path d="M198 20 L198 0 L214 6 L198 12" fill="#5EC8FF" stroke="#2E7FB8" stroke-width="1.5" /></g>
      <g class="drift" fill="#fff" opacity="0.9"><ellipse cx="70" cy="-14" rx="20" ry="8" /><ellipse cx="84" cy="-20" rx="12" ry="9" /></g>
    </g>`,
  },
  {
    id: 'ocean', name: 'Fond de la mer', price: 200,
    render: ({ id }) => html`<g>
      <defs>${grad(`${id}-oc`, ['#2E8FD8', '#1B5FA8', '#0B2D63'])}</defs>
      ${frameRect(`url(#${id}-oc)`)}
      <path d="M-20 -36 L60 -36 L20 254 L-20 254 Z" fill="#fff" opacity="0.05" />
      ${[[0, 1], [196, 0.8], [180, 1.1]].map(([x, s], i) => html`<path key=${i} class="sway" style=${{ animationDelay: `${i * 0.7}s` }} d=${`M${x} 254 C${x - 12} ${220 - 10 * s} ${x + 12} ${190 - 20 * s} ${x} ${150 - 30 * s}`} stroke="#3DCC7E" stroke-width="7" fill="none" stroke-linecap="round" />`)}
      ${[[16, 0], [40, 1.2], [176, 0.5], [196, 1.8], [150, 2.4]].map(([x, d], i) => html`<circle key=${i} class="bubble-up" style=${{ animationDelay: `${d}s` }} cx=${x} cy="230" r=${3 + (i % 3) * 2} fill="none" stroke="#BFE8FF" stroke-width="1.6" />`)}
      <g class="swim"><path d="M150 40 Q164 30 176 40 Q164 50 150 40 Z M176 40 L186 32 L186 48 Z" fill="#FFB84D" /><circle cx="156" cy="38" r="1.6" fill="#1D1D2B" /></g>
      <rect x="-20" y="232" width="240" height="22" fill="#E8C98A" />
    </g>`,
  },
  {
    id: 'plage', name: 'Plage ensoleillée', price: 120,
    render: ({ id }) => html`<g>
      <defs>${grad(`${id}-sk`, ['#7CD0FF', '#C6ECFF', '#FFF1C1'])}</defs>
      ${frameRect(`url(#${id}-sk)`)}
      <g class="spin-slow">
        ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => html`<rect key=${a} x="174" y="-30" width="4" height="12" rx="2" fill="#FFC93C" transform=${`rotate(${a} 176 2)`} />`)}
      </g>
      <circle cx="176" cy="2" r="16" fill="#FFD23F" />
      <path class="wave" d="M-20 196 Q0 188 20 196 T60 196 T100 196 T140 196 T180 196 T220 196 L220 222 L-20 222 Z" fill="#3FA9F5" />
      <rect x="-20" y="218" width="240" height="36" fill="#F7DC9C" />
    </g>`,
  },
  {
    id: 'arcenciel', name: 'Arc-en-ciel', price: 180,
    render: ({ id }) => html`<g>
      <defs>${grad(`${id}-ac`, ['#CBB8FF', '#FFD6F0', '#FFF0D6'])}</defs>
      ${frameRect(`url(#${id}-ac)`)}
      ${['#FF6B6B', '#FFA53A', '#FFD23F', '#48D07F', '#4DA3FF', '#9B6CF0'].map((c, i) => html`<path key=${i} d=${`M${-10 + i * 9} 150 A${110 - i * 9} ${110 - i * 9} 0 0 1 ${210 - i * 9} 150`} stroke=${c} stroke-width="9" fill="none" />`)}
      <g fill="#fff"><ellipse cx="-4" cy="150" rx="26" ry="12" /><ellipse cx="204" cy="150" rx="26" ry="12" /></g>
    </g>`,
  },
];

// --- Effets ---------------------------------------------------------------------------------------
const effects = [
  {
    id: 'etincelles', name: 'Étincelles', price: 60,
    render: () => html`<g>${[[14, 40, 8], [186, 60, 7], [24, 170, 6], [180, 170, 8], [100, -20, 7], [196, 120, 5]].map(([x, y, s], i) => sparkle(x, y, s, 'tw', i * 0.35))}</g>`,
  },
  {
    id: 'aureole', name: 'Auréole dorée', price: 80, free: true,
    render: ({ crown }) => html`<g class="halo"><ellipse cx="100" cy=${crown - 16} rx="34" ry="8" fill="none" stroke="#FFD23F" stroke-width="5" />
      <ellipse cx="100" cy=${crown - 16} rx="34" ry="8" fill="none" stroke="#FFF3B0" stroke-width="1.6" /></g>`,
  },
  {
    id: 'coeurs_volants', name: "Cœurs d'amour", price: 70,
    render: () => html`<g>${[[20, 200, 0], [184, 210, 1.2], [36, 190, 2.4], [170, 196, 0.6]].map(([x, y, d], i) => html`<path key=${i} class="float-up" style=${{ animationDelay: `${d}s` }} d=${heartPath(x, y, 7)} fill="#FF7EB6" />`)}</g>`,
  },
];

const withSlot = (slot, list) => list.map((it) => ({ ...it, slot }));

export const ITEMS = [
  ...withSlot('skin', COSTUMES),
  ...withSlot('hat', [...hats, ...JUDAICA_WEAR.hats]),
  ...withSlot('face', faces),
  ...withSlot('neck', necks),
  ...withSlot('back', backs),
  ...withSlot('outfit', [...outfits, ...JUDAICA_WEAR.outfits]),
  ...withSlot('pet', pets),
  ...withSlot('bg', backgrounds),
  ...withSlot('fx', effects),
  ...teamWear,
  ...GARAGE_ITEMS,
  ...REWARDS.map((r) => ({ ...r, slot: 'magic', exclusive: true, price: 0 })),
].map(withArt);

const BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
// Deux objets peuvent partager un identifiant dans des rayons différents (la licorne : monture et
// corne ; le robot : accessoire et compagnon) : avec le rayon, on trouve toujours le bon
const BY_SLOT = Object.fromEntries(ITEMS.map((i) => [`${i.slot}/${i.id}`, i]));
export const getItem = (id, slot = null) => (slot && BY_SLOT[`${slot}/${id}`]) || BY_ID[id] || null;
export const shopItems = () => ITEMS.filter((i) => !i.exclusive);
export const rewardItems = () => ITEMS.filter((i) => i.exclusive && !i.pot);
export const potItems = () => ITEMS.filter((i) => i.pot);
export const isGarageSlot = (slot) => slot in GARAGE_SLOTS;
// Rayon de la boutique où se range un objet (les kippas et le talit katan vont au rayon Judaïsme)
export const rayonOf = (item) => item?.rayon || item?.slot;
// Boutique adaptée au sexe de l'enfant : certains objets ne sont proposés qu'aux garçons (only),
// d'autres sont mis en avant (star). Sans sexe précisé, tout est proposé, rien n'est mis en avant.
export const offeredTo = (item, sex) => !item.only || !sex || item.only === sex;
export const starredFor = (item, sex) => Boolean(sex) && (item.star === sex || item.only === sex);
