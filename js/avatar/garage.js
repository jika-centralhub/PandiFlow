// L'espace à côté de l'avatar : véhicules, drapeaux, accessoires et objets du jardin.
// Tout se dessine dans une petite scène de 240 x 200 (sol à y = 178) :
//   jardin (yard) au fond, mât du drapeau à droite (x = 196), véhicule au centre,
//   accessoire (gear) devant à gauche.
// Les objets « pot » s'achètent avec la cagnotte commune (pour tous les enfants), les objets
// « team » se gagnaient avec l'ancien défi d'équipe de la semaine (ceux déjà gagnés restent).
import { html } from '../vendor/preact-htm.js';
import { starPath, heartPath, mirror, grad, GOLD, sparkle } from './draw.js';
import { shade } from '../lib/util.js';
import { JUDAICA_ITEMS, JUDAICA_SLOT } from './judaica.js';
import { hasArt, artImage } from './art.js';

export const GARAGE_SLOTS = {
  vehicle: { label: 'Véhicules et montures', icon: '🚗' },
  flag: { label: 'Drapeaux', icon: '🚩' },
  gear: { label: 'Accessoires', icon: '⚽' },
  yard: { label: 'Le jardin de la fratrie', icon: '🏡' },
  ...JUDAICA_SLOT,
};

// --- Pièces communes --------------------------------------------------------------------------
const wheel = (cx, cy, r, rim = '#C9D1DE') => html`<g class="wheel">
  <circle cx=${cx} cy=${cy} r=${r} fill="#2B2B33" />
  <circle cx=${cx} cy=${cy} r=${r * 0.55} fill=${rim} />
  <path d=${`M${cx - r * 0.5} ${cy} L${cx + r * 0.5} ${cy} M${cx} ${cy - r * 0.5} L${cx} ${cy + r * 0.5}`} stroke="#6B7486" stroke-width="2" />
</g>`;
const spokeWheel = (cx, cy, r) => html`<g class="wheel">
  <circle cx=${cx} cy=${cy} r=${r} fill="none" stroke="#2B2B33" stroke-width="4" />
  ${[0, 60, 120].map((a) => {
    const rad = (a * Math.PI) / 180;
    return html`<path key=${a} d=${`M${(cx - Math.cos(rad) * r).toFixed(1)} ${(cy - Math.sin(rad) * r).toFixed(1)} L${(cx + Math.cos(rad) * r).toFixed(1)} ${(cy + Math.sin(rad) * r).toFixed(1)}`} stroke="#9AA6BA" stroke-width="1.4" />`;
  })}
  <circle cx=${cx} cy=${cy} r="3" fill="#6B7486" />
</g>`;
const shadow = (cx = 110, rx = 80) => html`<ellipse cx=${cx} cy="179" rx=${rx} ry="5" fill="#000" opacity="0.16" />`;
const glass = '#BFE4FF';

// --- Véhicules ----------------------------------------------------------------------------------
function bike(id, frame, { tandem = false } = {}) {
  const back = tandem ? 46 : 62;
  const front = tandem ? 164 : 138;
  return html`<g class="veh-bob">
    ${shadow(105, 70)}
    ${spokeWheel(back, 158, 18)}${spokeWheel(front, 158, 18)}
    <g stroke=${frame} stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none">
      ${tandem
        ? html`<path d="M46 158 L72 128 L142 128 L164 158 M72 128 L84 158 L46 158 M84 158 L108 128 L120 158 L84 158 M120 158 L142 128" />`
        : html`<path d="M62 158 L92 128 L132 128 L138 158 M92 128 L104 158 L62 158 M104 158 L132 128" />`}
    </g>
    <g stroke="#2B2B33" stroke-width="4" stroke-linecap="round" fill="none">
      ${tandem
        ? html`<path d="M70 128 L68 118 M104 128 L102 118 M142 128 L138 110 L150 106 M102 116 L112 112" />`
        : html`<path d="M92 128 L90 120 M132 128 L128 112 L140 108" />`}
    </g>
    <g fill="#2B2B33">
      ${tandem ? html`<rect x="60" y="113" width="18" height="6" rx="3" /><rect x="94" y="113" width="18" height="6" rx="3" />` : html`<rect x="80" y="115" width="20" height="6" rx="3" />`}
    </g>
    ${tandem && html`<path d=${heartPath(108, 140, 7)} fill="#FF7EB6" stroke="#fff" stroke-width="1.5" />`}
  </g>`;
}

function pony(id, { body, mane, horn = false, saddle = '#E2363F' }) {
  return html`<g class="veh-bob">
    ${shadow(105, 64)}
    <g class="tail"><path d="M58 124 C40 126 34 146 40 160 C46 150 50 140 62 134 Z" fill=${mane} /></g>
    <g fill=${shade(body, -0.12)}><rect x="66" y="140" width="10" height="34" rx="5" /><rect x="130" y="140" width="10" height="34" rx="5" /></g>
    <ellipse cx="100" cy="132" rx="46" ry="24" fill=${body} stroke=${shade(body, -0.25)} stroke-width="2" />
    <g fill=${body} stroke=${shade(body, -0.25)} stroke-width="2"><rect x="80" y="144" width="10" height="34" rx="5" /><rect x="116" y="144" width="10" height="34" rx="5" /></g>
    <path d="M78 116 C88 108 112 108 120 116 L118 128 L80 128 Z" fill=${saddle} />
    <path d="M128 124 C134 108 140 96 148 90 L162 104 C154 112 146 124 142 136 Z" fill=${body} stroke=${shade(body, -0.25)} stroke-width="2" />
    <ellipse cx="160" cy="98" rx="20" ry="13" fill=${body} stroke=${shade(body, -0.25)} stroke-width="2" transform="rotate(20 160 98)" />
    <path d="M150 84 L148 72 L158 82 Z" fill=${body} stroke=${shade(body, -0.25)} stroke-width="1.6" />
    <circle cx="160" cy="94" r="2.6" fill="#2B2B33" /><circle cx="173" cy="104" r="1.6" fill=${shade(body, -0.4)} />
    <path d="M146 86 C136 92 132 108 128 122 C138 112 142 100 152 92 Z" fill=${mane} />
    ${horn && html`<g><path d="M156 82 L166 56 L164 84 Z" fill=${`url(#${id}-horn)`} stroke="#B8860B" stroke-width="1.2" />
      <defs>${grad(`${id}-horn`, GOLD)}</defs>${sparkle(176, 60, 6, 'tw', 0)}${sparkle(140, 70, 4, 'tw', 0.7)}</g>`}
  </g>`;
}

const VEHICLES = [
  { id: 'velo', act: 'drive', sound: 'bell', name: 'Vélo', price: 80, box: '30 96 140 88', render: ({ id }) => bike(id, '#E2363F') },
  {
    id: 'trottinette', act: 'drive', sound: 'bell', name: 'Trottinette', price: 60, box: '40 96 124 88',
    render: () => html`<g class="veh-bob">${shadow(96, 50)}
      <path d="M50 160 L136 160 L132 168 L54 168 Z" fill="#4D9BFF" stroke="#2F74D6" stroke-width="2" />
      ${wheel(58, 170, 8)}${wheel(132, 170, 8)}
      <path d="M132 160 L140 104" stroke="#9AA6BA" stroke-width="6" stroke-linecap="round" />
      <path d="M128 104 L152 104" stroke="#2B2B33" stroke-width="6" stroke-linecap="round" />
      <path d="M126 104 L130 104 M150 104 L154 104" stroke="#FF7EB6" stroke-width="7" stroke-linecap="round" /></g>`,
  },
  {
    id: 'kart', act: 'drive', sound: 'engine', name: 'Kart', price: 150,
    render: () => html`<g class="veh-bob">${shadow(100, 72)}
      <path d="M34 150 C40 136 70 132 96 136 L150 140 C162 142 168 152 164 160 L40 162 C34 160 32 156 34 150 Z" fill="#FFD23F" stroke="#C99A12" stroke-width="2" />
      <path d="M70 136 L66 116 L86 118 L90 136 Z" fill="#2B2B33" />
      <path d="M110 136 L122 120" stroke="#2B2B33" stroke-width="4" stroke-linecap="round" /><circle cx="123" cy="118" r="7" fill="none" stroke="#2B2B33" stroke-width="3" />
      <circle cx="132" cy="150" r="8" fill="#fff" /><text x="132" y="154" text-anchor="middle" font-size="11" font-weight="700" font-family="Fredoka, sans-serif" fill="#2B2B33">5</text>
      ${wheel(58, 162, 14)}${wheel(146, 162, 14)}</g>`,
  },
  {
    id: 'voiture_course', act: 'drive', sound: 'engine', name: 'Voiture de course', price: 250,
    render: () => html`<g class="veh-bob">${shadow(116, 96)}
      <path d="M14 120 L42 120 L42 127 L14 127 Z M26 127 L28 140" fill="#2B2B33" stroke="#2B2B33" stroke-width="3" />
      <path d="M20 156 C24 140 46 132 70 132 L96 120 C104 114 124 114 132 120 L150 132 L196 136 C210 138 214 150 210 160 L22 162 Z" fill="#E2363F" stroke="#A81C2C" stroke-width="2" />
      <circle cx="113" cy="118" r="10" fill="#FFD23F" stroke="#C99A12" stroke-width="1.6" /><path d="M110 115 L124 115 L124 120 L112 120 Z" fill="#2B2B33" />
      <circle cx="90" cy="148" r="9" fill="#fff" /><text x="90" y="152.5" text-anchor="middle" font-size="12" font-weight="700" font-family="Fredoka, sans-serif" fill="#E2363F">7</text>
      <path d="M150 148 L200 148" stroke="#fff" stroke-width="3" />
      ${wheel(52, 162, 16)}${wheel(176, 162, 16)}</g>`,
  },
  {
    id: 'voiture_police', act: 'drive', sound: 'siren', name: 'Voiture de police', price: 220,
    render: () => html`<g class="veh-bob">${shadow(115, 96)}
      <rect x="104" y="96" width="14" height="8" rx="2" fill="#E2363F" class="blink-light" /><rect x="118" y="96" width="14" height="8" rx="2" fill="#2F74D6" class="blink-light" style="animation-delay:.6s" />
      <path d="M24 150 C26 136 40 130 56 128 L74 112 C80 106 90 104 100 104 L140 104 C152 104 160 110 166 118 L178 128 C194 130 206 138 206 152 L206 162 L24 162 Z" fill="#FFFFFF" stroke="#2B2B33" stroke-width="2" />
      <path d="M24 146 L206 146 L206 162 L24 162 Z" fill="#1F3E8C" />
      <path d="M80 114 L98 110 L98 128 L72 128 Z M106 110 L138 110 C146 110 152 116 156 128 L106 128 Z" fill=${glass} stroke="#2B2B33" stroke-width="1.6" />
      <text x="118" y="141" text-anchor="middle" font-size="10" font-weight="700" font-family="Fredoka, sans-serif" fill="#1F3E8C">POLICE</text>
      ${wheel(64, 162, 15)}${wheel(170, 162, 15)}</g>`,
  },
  {
    id: 'camion_pompiers', act: 'drive', sound: 'siren', name: 'Camion de pompiers', price: 250,
    render: () => html`<g class="veh-bob">${shadow(115, 98)}
      <g stroke="#C9D1DE" stroke-width="3" stroke-linecap="round"><path d="M30 106 L146 96 M30 113 L146 103" />${[44, 64, 84, 104, 124].map((x) => html`<path key=${x} d=${`M${x} ${105 - (x - 30) * 0.086} L${x} ${112 - (x - 30) * 0.086}`} />`)}</g>
      <path d="M24 116 L150 116 L150 162 L24 162 Z" fill="#E2363F" stroke="#A81C2C" stroke-width="2" />
      <path d="M150 108 L190 108 C200 108 206 116 206 128 L206 162 L150 162 Z" fill="#E2363F" stroke="#A81C2C" stroke-width="2" />
      <path d="M162 116 L192 116 C196 116 198 120 198 126 L198 134 L162 134 Z" fill=${glass} stroke="#A81C2C" stroke-width="1.4" />
      <rect x="166" y="100" width="12" height="8" rx="2" fill="#2F74D6" class="blink-light" />
      <path d="M24 146 L206 146 L206 151 L24 151 Z" fill="#FFFFFF" />
      <circle cx="92" cy="132" r="10" fill="#FFD23F" stroke="#C99A12" stroke-width="2" /><circle cx="92" cy="132" r="4" fill="#C99A12" />
      ${wheel(60, 164, 15)}${wheel(172, 164, 15)}</g>`,
  },
  {
    id: 'moto', act: 'drive', sound: 'engine', name: 'Moto', price: 200,
    render: () => html`<g class="veh-bob">${shadow(102, 68)}
      ${wheel(54, 160, 17)}${wheel(150, 160, 17)}
      <path d="M66 148 L40 152" stroke="#9AA6BA" stroke-width="5" stroke-linecap="round" />
      <rect x="88" y="138" width="30" height="16" rx="4" fill="#6B7486" />
      <path d="M74 132 C84 118 112 118 126 128 L140 140 L100 148 L74 146 Z" fill="#E2363F" stroke="#A81C2C" stroke-width="2" />
      <path d="M58 132 C66 126 82 126 90 130 L86 138 L60 140 Z" fill="#2B2B33" />
      <path d="M140 140 L150 160" stroke="#9AA6BA" stroke-width="5" stroke-linecap="round" />
      <path d="M132 120 L144 116 L150 124" stroke="#2B2B33" stroke-width="4" fill="none" stroke-linecap="round" />
      <circle cx="152" cy="130" r="6" fill="#FFF3B0" stroke="#C99A12" stroke-width="1.4" /></g>`,
  },
  {
    id: 'tracteur', act: 'drive', sound: 'engine', name: 'Tracteur', price: 180,
    render: () => html`<g class="veh-bob">${shadow(118, 70)}
      <path d="M150 132 L150 96" stroke="#2B2B33" stroke-width="6" stroke-linecap="round" />
      <g class="puff"><circle cx="152" cy="86" r="6" fill="#D8D4E8" /><circle cx="160" cy="78" r="4" fill="#D8D4E8" /></g>
      <path d="M60 112 L120 112 L120 132 L170 132 C176 132 180 138 180 144 L180 156 L60 156 Z" fill="#3FAE5A" stroke="#23824A" stroke-width="2" />
      <path d="M64 74 L118 74 L120 112 L60 112 Z" fill="#3FAE5A" stroke="#23824A" stroke-width="2" />
      <path d="M70 82 L112 82 L114 106 L66 106 Z" fill=${glass} stroke="#23824A" stroke-width="1.6" />
      <rect x="58" y="70" width="64" height="7" rx="3" fill="#23824A" />
      ${wheel(84, 154, 26, '#FFD23F')}${wheel(162, 162, 15, '#FFD23F')}</g>`,
  },
  {
    id: 'bateau', act: 'sail', sound: 'horn', name: 'Voilier', price: 200,
    render: () => html`<g>
      <g class="veh-bob"><path d="M50 150 L190 150 L170 172 L70 172 Z" fill="#C47A3A" stroke="#7E4520" stroke-width="2" />
        <path d="M120 150 L120 64" stroke="#7A4A26" stroke-width="4" />
        <path d="M123 68 L123 146 L176 146 Z" fill="#FFFFFF" stroke="#C9D3E8" stroke-width="1.5" />
        <path d="M117 78 L117 146 L72 146 Z" fill="#FF7EB6" stroke="#E25D9A" stroke-width="1.5" />
        <path d="M120 64 L134 69 L120 74 Z" fill="#E2363F" /></g>
      <path class="wave" d="M-20 172 Q0 164 20 172 T60 172 T100 172 T140 172 T180 172 T220 172 T260 172 L260 200 L-20 200 Z" fill="#4DA3FF" opacity="0.85" />
    </g>`,
  },
  {
    id: 'avion', act: 'fly', sound: 'plane', zone: 'sky', name: 'Avion', price: 300, box: '20 50 200 110',
    render: () => html`<g class="veh-hover">
      <path d="M44 98 L28 68 L52 72 L68 96 Z" fill="#E2363F" stroke="#A81C2C" stroke-width="1.6" />
      <path d="M40 96 C60 84 150 82 186 92 C196 96 196 104 186 108 C150 116 60 114 40 104 Z" fill="#FFFFFF" stroke="#9AA6BA" stroke-width="2" />
      <path d="M44 102 C80 106 150 106 190 100" stroke="#4D9BFF" stroke-width="4" fill="none" />
      <path d="M160 90 C168 90 176 92 180 96 L162 96 Z" fill=${glass} />
      ${[80, 96, 112, 128, 144].map((x) => html`<circle key=${x} cx=${x} cy="96" r="3" fill=${glass} stroke="#9AA6BA" stroke-width="0.8" />`)}
      <path d="M96 104 L132 104 L120 138 L104 138 Z" fill="#2F74D6" stroke="#1E52A8" stroke-width="1.6" />
      <ellipse class="propeller" cx="194" cy="100" rx="3" ry="18" fill="#6B7486" opacity="0.8" /><circle cx="193" cy="100" r="4" fill="#FFD23F" />
    </g>`,
  },
  {
    id: 'helico', act: 'fly', sound: 'helico', zone: 'sky', name: 'Hélicoptère', price: 300, box: '10 50 200 110',
    render: () => html`<g class="veh-hover">
      <path d="M118 72 L118 64" stroke="#2B2B33" stroke-width="4" />
      <path class="rotor" d="M46 62 L190 62" stroke="#2B2B33" stroke-width="4" stroke-linecap="round" />
      <path d="M72 98 L24 92 L24 102 L72 108 Z" fill="#FFB84D" stroke="#D98B1A" stroke-width="1.6" />
      <g class="spin-fast"><path d="M22 86 L22 106 M12 96 L32 96" stroke="#2B2B33" stroke-width="3" stroke-linecap="round" /></g>
      <path d="M70 100 C70 82 90 74 112 74 C142 74 160 88 160 104 C160 118 146 126 124 126 L90 126 C78 126 70 116 70 100 Z" fill="#FFB84D" stroke="#D98B1A" stroke-width="2" />
      <path d="M120 80 C140 80 152 92 154 104 L120 104 Z" fill=${glass} stroke="#D98B1A" stroke-width="1.4" />
      <path d="M90 126 L86 140 M140 126 L144 140 M76 140 L156 140" stroke="#2B2B33" stroke-width="3.4" stroke-linecap="round" fill="none" />
    </g>`,
  },
  {
    id: 'fusee', act: 'launch', sound: 'rumble', zone: 'sky', name: 'Fusée', price: 400, box: '40 20 120 160',
    render: () => html`<g class="veh-hover">
      <g class="flame"><path d="M88 140 C90 156 96 166 100 176 C104 166 110 156 112 140 Z" fill="#FF8A2B" /><path d="M94 140 C96 150 98 158 100 166 C102 158 104 150 106 140 Z" fill="#FFF3B0" /></g>
      <path d="M100 36 C118 52 126 80 126 112 L126 140 L74 140 L74 112 C74 80 82 52 100 36 Z" fill="#FFFFFF" stroke="#9AA6BA" stroke-width="2" />
      <path d="M100 36 C110 45 116 56 120 66 L80 66 C84 56 90 45 100 36 Z" fill="#E2363F" />
      <circle cx="100" cy="92" r="12" fill="#4DA3FF" stroke="#9AA6BA" stroke-width="4" /><circle cx="96" cy="88" r="3.4" fill="#fff" opacity="0.7" />
      <path d="M74 112 L56 144 L74 140 Z" fill="#E2363F" stroke="#A81C2C" stroke-width="1.4" /><path d=${mirror('M74 112 L56 144 L74 140 Z')} fill="#E2363F" stroke="#A81C2C" stroke-width="1.4" />
      ${sparkle(150, 50, 6, 'tw', 0)}${sparkle(48, 70, 5, 'tw', 0.8)}
    </g>`,
  },
  {
    id: 'soucoupe', act: 'fly', sound: 'ufo', zone: 'sky', name: 'Soucoupe volante', price: 350, box: '20 70 180 110',
    render: () => html`<g>
      <path class="glow-pulse" d="M74 128 L126 128 L156 178 L44 178 Z" fill="#FFF3B0" opacity="0.35" />
      <g class="veh-hover">
        <ellipse cx="100" cy="106" rx="30" ry="24" fill=${glass} stroke="#9AA6BA" stroke-width="2" />
        <circle cx="100" cy="104" r="10" fill="#7BD35A" /><circle cx="96" cy="102" r="2.4" fill="#1B1B22" /><circle cx="104" cy="102" r="2.4" fill="#1B1B22" />
        <path d="M100 94 L100 86 M100 86 L96 82" stroke="#7BD35A" stroke-width="2" stroke-linecap="round" />
        <ellipse cx="100" cy="122" rx="70" ry="16" fill="#9AA6BA" stroke="#6B7486" stroke-width="2" />
        ${[46, 70, 100, 130, 154].map((x, i) => html`<circle key=${x} class="blink-light" style=${{ animationDelay: `${i * 0.25}s` }} cx=${x} cy=${x === 100 ? 132 : 126} r="4" fill=${['#FFD23F', '#FF7EB6', '#48E0A4', '#5EC8FF', '#FFD23F'][i]} />`)}
      </g>
    </g>`,
  },
  {
    id: 'poney', act: 'gallop', sound: 'neigh', name: 'Poney', price: 220,
    render: ({ id }) => pony(id, { body: '#C98A5B', mane: '#6B3E1E' }),
  },
  {
    id: 'licorne', act: 'gallop', sound: 'neigh', name: 'Licorne', price: 350,
    render: ({ id }) => html`<g>
      <defs><linearGradient id=${`${id}-mane`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FF6B6B" /><stop offset="33%" stop-color="#FFD23F" /><stop offset="66%" stop-color="#48D07F" /><stop offset="100%" stop-color="#9B6CF0" /></linearGradient></defs>
      ${pony(id, { body: '#FFF6FB', mane: `url(#${id}-mane)`, horn: true, saddle: '#9B6CF0' })}
    </g>`,
  },
  {
    id: 'dragon_monture', act: 'gallop', sound: 'roar', name: 'Dragon', price: 450,
    render: () => html`<g class="veh-bob">${shadow(104, 70)}
      <path d="M52 150 C24 156 10 140 18 122 C22 112 34 112 36 120 C30 122 28 132 38 136 C48 140 56 136 62 132 Z" fill="#3FAE5A" stroke="#23824A" stroke-width="2" />
      <g class="wing-l"><path d="M80 112 C56 76 30 78 22 90 C38 90 42 100 38 110 C52 104 60 114 58 124 Z" fill="#9B7BFF" stroke="#6A40C8" stroke-width="2" stroke-linejoin="round" /></g>
      <ellipse cx="96" cy="144" rx="46" ry="30" fill="#3FAE5A" stroke="#23824A" stroke-width="2.4" />
      <ellipse cx="104" cy="152" rx="24" ry="20" fill="#FFE7A3" />
      <path d="M78 116 C88 108 112 108 120 116 L118 128 L80 128 Z" fill="#E2363F" />
      <circle cx="140" cy="102" r="24" fill="#3FAE5A" stroke="#23824A" stroke-width="2.4" />
      <ellipse cx="164" cy="110" rx="20" ry="14" fill="#3FAE5A" stroke="#23824A" stroke-width="2.4" />
      <path d="M128 80 L124 64 L136 76 Z M146 78 L150 62 L156 80 Z" fill="#FFF1C8" stroke="#D9B85F" stroke-width="1.4" />
      <path d="M132 100 Q138 94 144 100" stroke="#1E3A28" stroke-width="3" fill="none" stroke-linecap="round" />
      <path d="M160 118 Q168 124 178 116" stroke="#1E3A28" stroke-width="2.4" fill="none" stroke-linecap="round" />
      <circle cx="176" cy="106" r="1.8" fill="#1E5A35" />
      <g class="puff"><circle cx="188" cy="102" r="5" fill="#D8D4E8" /><circle cx="196" cy="96" r="3.4" fill="#D8D4E8" /></g>
      <ellipse cx="78" cy="172" rx="13" ry="7" fill="#2FA65A" /><ellipse cx="118" cy="172" rx="13" ry="7" fill="#2FA65A" /></g>`,
  },
  { id: 'tandem', act: 'drive', sound: 'bell', name: 'Tandem de l’équipe', price: 0, exclusive: true, team: true, box: '18 96 176 88', render: ({ id }) => bike(id, '#9B6CF0', { tandem: true }) },
  {
    id: 'bus_fratrie', act: 'drive', sound: 'honk', name: 'Bus de la fratrie', price: 500, exclusive: true, pot: true,
    render: () => html`<g class="veh-bob">${shadow(117, 98)}
      <path d="M20 100 L200 100 C210 100 214 108 214 118 L214 162 L20 162 Z" fill="#FFD23F" stroke="#C99A12" stroke-width="2" />
      ${[30, 62, 94, 126, 158].map((x, i) => html`<g key=${x}><rect x=${x} y="108" width="26" height="22" rx="4" fill=${glass} stroke="#C99A12" stroke-width="1.4" /><path d=${heartPath(x + 13, 120, 4.4)} fill=${['#FF7EB6', '#5EC8FF', '#48E0A4', '#9B7BFF', '#FF8A5C'][i]} /></g>`)}
      <rect x="190" y="108" width="16" height="44" rx="3" fill=${glass} stroke="#C99A12" stroke-width="1.4" />
      <path d="M20 138 L200 138 L200 142 L20 142 Z" fill="#2B2B33" />
      <text x="96" y="156" text-anchor="middle" font-size="11" font-weight="700" font-family="Fredoka, sans-serif" fill="#2B2B33">FRATRIE</text>
      <circle cx="210" cy="152" r="4" fill="#FFF3B0" />
      ${wheel(56, 164, 15)}${wheel(172, 164, 15)}</g>`,
  },
];

// --- Drapeaux (sur un mât, à droite de la scène) ----------------------------------------------------
const FX = 198;
const FY = 38;
const FW = 40;
const FH = 28;
const vert3 = (a, b, c) => [a, b, c].map((col, i) => html`<rect key=${i} x=${FX + (i * FW) / 3} y=${FY} width=${FW / 3 + 0.4} height=${FH} fill=${col} />`);
const horiz = (bands) => {
  const total = bands.reduce((s, [, w]) => s + w, 0);
  let y = FY;
  return bands.map(([col, w], i) => {
    const h = (w / total) * FH;
    const el = html`<rect key=${i} x=${FX} y=${y} width=${FW} height=${h + 0.4} fill=${col} />`;
    y += h;
    return el;
  });
};
const CX = FX + FW / 2;
const CY = FY + FH / 2;

// Le mât en image 3D (le même pour tous) ; le tissu reste dessiné, pour garder les vraies couleurs de
// chaque drapeau et son ondulation, avec des plis de satin (ombre et lumière) par-dessus
const MAST = { img: 'drapeau_mat', cx: 196, bottom: 179, h: 149 };
const FOLDS = [[0, 'rgba(0,0,0,.14)'], [18, 'rgba(255,255,255,.22)'], [38, 'rgba(0,0,0,.16)'], [60, 'rgba(255,255,255,.16)'], [80, 'rgba(0,0,0,.14)'], [100, 'rgba(255,255,255,.1)']];

function flag(id, name, content) {
  return {
    id: `drapeau_${id}`, name, price: 30, box: '186 26 60 50', act: 'wave', sound: 'whoosh',
    render: (ctx) => html`<g>
      ${hasArt(MAST.img)
        ? artImage(MAST.img, MAST, ctx.thumb)
        : html`<path d="M196 36 L196 178" stroke="#9AA6BA" stroke-width="3.5" stroke-linecap="round" /><circle cx="196" cy="34" r="3.6" fill="#FFD23F" />`}
      <ellipse cx="196" cy="179" rx="8" ry="3" fill="#000" opacity="0.16" />
      <g class="flag">
        <defs><clipPath id=${`${ctx.id}-fl`}><rect x=${FX} y=${FY} width=${FW} height=${FH} rx="2" /></clipPath>
          <linearGradient id=${`${ctx.id}-fold`} x1="0" y1="0" x2="1" y2="0.18">${FOLDS.map(([o, c]) => html`<stop key=${o} offset=${`${o}%`} stop-color=${c} />`)}</linearGradient>
          <linearGradient id=${`${ctx.id}-sheen`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(255,255,255,.22)" /><stop offset="45%" stop-color="rgba(255,255,255,0)" /><stop offset="100%" stop-color="rgba(0,0,0,.16)" /></linearGradient></defs>
        <g clip-path=${`url(#${ctx.id}-fl)`}>${content(ctx)}
          <rect x=${FX} y=${FY} width=${FW} height=${FH} fill=${`url(#${ctx.id}-fold)`} />
          <rect x=${FX} y=${FY} width=${FW} height=${FH} fill=${`url(#${ctx.id}-sheen)`} /></g>
        <rect x=${FX} y=${FY} width=${FW} height=${FH} rx="2" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="1" />
      </g>
    </g>`,
  };
}

const crescent = (ctx, cx, cy, r, color, cut, key) => html`<g>
  <defs><mask id=${`${ctx.id}-${key}`}><rect x=${FX} y=${FY} width=${FW} height=${FH} fill="#fff" /><circle cx=${cx + r * 0.32} cy=${cy} r=${r * 0.8} fill="#000" /></mask></defs>
  <circle cx=${cx} cy=${cy} r=${r} fill=${color} mask=${`url(#${ctx.id}-${key})`} />
  ${cut}
</g>`;

const FLAGS = [
  flag('france', 'Drapeau de la France', () => vert3('#0055A4', '#FFFFFF', '#EF4135')),
  flag('israel', 'Drapeau d’Israël', () => html`<g>
    <rect x=${FX} y=${FY} width=${FW} height=${FH} fill="#FFFFFF" />
    <rect x=${FX} y=${FY + 3} width=${FW} height="4" fill="#0038B8" /><rect x=${FX} y=${FY + FH - 7} width=${FW} height="4" fill="#0038B8" />
    <path d=${`M${CX} ${CY - 6} L${CX + 5.2} ${CY + 3} L${CX - 5.2} ${CY + 3} Z M${CX} ${CY + 6} L${CX - 5.2} ${CY - 3} L${CX + 5.2} ${CY - 3} Z`} fill="none" stroke="#0038B8" stroke-width="1.4" stroke-linejoin="round" />
  </g>`),
  flag('espagne', 'Drapeau de l’Espagne', () => horiz([['#AA151B', 1], ['#F1BF00', 2], ['#AA151B', 1]])),
  flag('italie', 'Drapeau de l’Italie', () => vert3('#009246', '#FFFFFF', '#CE2B37')),
  flag('portugal', 'Drapeau du Portugal', () => html`<g><rect x=${FX} y=${FY} width="16" height=${FH} fill="#006600" /><rect x=${FX + 16} y=${FY} width="24" height=${FH} fill="#FF0000" />
    <circle cx=${FX + 16} cy=${CY} r="5.6" fill="#FFCC00" stroke="#C99A12" stroke-width="0.8" /><rect x=${FX + 13.6} y=${CY - 3} width="4.8" height="5.6" rx="1.4" fill="#FFFFFF" stroke="#FF0000" stroke-width="0.8" /></g>`),
  flag('belgique', 'Drapeau de la Belgique', () => vert3('#000000', '#FDDA24', '#EF3340')),
  flag('allemagne', 'Drapeau de l’Allemagne', () => horiz([['#000000', 1], ['#DD0000', 1], ['#FFCE00', 1]])),
  flag('royaume_uni', 'Drapeau du Royaume-Uni', () => html`<g>
    <rect x=${FX} y=${FY} width=${FW} height=${FH} fill="#012169" />
    <path d=${`M${FX} ${FY} L${FX + FW} ${FY + FH} M${FX + FW} ${FY} L${FX} ${FY + FH}`} stroke="#FFFFFF" stroke-width="5.6" />
    <path d=${`M${FX} ${FY} L${FX + FW} ${FY + FH} M${FX + FW} ${FY} L${FX} ${FY + FH}`} stroke="#C8102E" stroke-width="1.8" />
    <path d=${`M${CX} ${FY} L${CX} ${FY + FH} M${FX} ${CY} L${FX + FW} ${CY}`} stroke="#FFFFFF" stroke-width="8" />
    <path d=${`M${CX} ${FY} L${CX} ${FY + FH} M${FX} ${CY} L${FX + FW} ${CY}`} stroke="#C8102E" stroke-width="4.4" />
  </g>`),
  flag('etats_unis', 'Drapeau des États-Unis', () => html`<g>
    ${Array.from({ length: 13 }, (_, i) => html`<rect key=${i} x=${FX} y=${FY + (i * FH) / 13} width=${FW} height=${FH / 13 + 0.3} fill=${i % 2 ? '#FFFFFF' : '#B22234'} />`)}
    <rect x=${FX} y=${FY} width="17" height=${(FH * 7) / 13} fill="#3C3B6E" />
    ${Array.from({ length: 12 }, (_, i) => html`<circle key=${`s${i}`} cx=${FX + 2.6 + (i % 4) * 4} cy=${FY + 2.6 + Math.floor(i / 4) * 4.4} r="0.9" fill="#FFFFFF" />`)}
  </g>`),
  flag('bresil', 'Drapeau du Brésil', () => html`<g><rect x=${FX} y=${FY} width=${FW} height=${FH} fill="#009C3B" />
    <path d=${`M${FX + 3} ${CY} L${CX} ${FY + 3} L${FX + FW - 3} ${CY} L${CX} ${FY + FH - 3} Z`} fill="#FFDF00" />
    <circle cx=${CX} cy=${CY} r="6.4" fill="#002776" /><path d=${`M${CX - 6} ${CY - 1} Q${CX} ${CY - 3} ${CX + 6} ${CY + 1.4}`} stroke="#FFFFFF" stroke-width="1.2" fill="none" /></g>`),
  flag('japon', 'Drapeau du Japon', () => html`<g><rect x=${FX} y=${FY} width=${FW} height=${FH} fill="#FFFFFF" /><circle cx=${CX} cy=${CY} r="8" fill="#BC002D" /></g>`),
  flag('maroc', 'Drapeau du Maroc', () => html`<g><rect x=${FX} y=${FY} width=${FW} height=${FH} fill="#C1272D" />
    <path d=${starPath(CX, CY, 8, 3.1)} fill="none" stroke="#006233" stroke-width="1.5" stroke-linejoin="round" /></g>`),
  flag('algerie', 'Drapeau de l’Algérie', (ctx) => html`<g><rect x=${FX} y=${FY} width="20" height=${FH} fill="#006633" /><rect x=${FX + 20} y=${FY} width="20" height=${FH} fill="#FFFFFF" />
    ${crescent(ctx, CX - 1, CY, 7.4, '#D21034', html`<path d=${starPath(CX + 3, CY, 3.2)} fill="#D21034" />`, 'dz')}</g>`),
  flag('tunisie', 'Drapeau de la Tunisie', (ctx) => html`<g><rect x=${FX} y=${FY} width=${FW} height=${FH} fill="#E70013" /><circle cx=${CX} cy=${CY} r="9" fill="#FFFFFF" />
    ${crescent(ctx, CX - 0.6, CY, 6.4, '#E70013', html`<path d=${starPath(CX + 2.2, CY, 3)} fill="#E70013" />`, 'tn')}</g>`),
  flag('pirate', 'Drapeau pirate', () => html`<g><rect x=${FX} y=${FY} width=${FW} height=${FH} fill="#1B1B22" />
    <path d=${`M${CX - 11} ${CY + 10} L${CX + 11} ${CY + 2} M${CX + 11} ${CY + 10} L${CX - 11} ${CY + 2}`} stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" />
    <circle cx=${CX} cy=${CY - 3} r="7" fill="#FFFFFF" /><rect x=${CX - 4} y=${CY + 1} width="8" height="5" rx="1.4" fill="#FFFFFF" />
    <circle cx=${CX - 2.6} cy=${CY - 3.4} r="1.8" fill="#1B1B22" /><circle cx=${CX + 2.6} cy=${CY - 3.4} r="1.8" fill="#1B1B22" /></g>`),
  flag('arc_en_ciel', 'Drapeau arc-en-ciel', () => horiz([['#E40303', 1], ['#FF8C00', 1], ['#FFED00', 1], ['#008026', 1], ['#004DFF', 1], ['#750787', 1]])),
  flag('damier', 'Drapeau à damier', () => html`<g>${Array.from({ length: 48 }, (_, i) => {
    const c = i % 8;
    const r = Math.floor(i / 8);
    return html`<rect key=${i} x=${FX + c * 5} y=${FY + r * (FH / 6)} width="5" height=${FH / 6 + 0.2} fill=${(c + r) % 2 ? '#FFFFFF' : '#1B1B22'} />`;
  })}</g>`),
  flag('pandiflow', 'Drapeau PandiFlow', () => html`<g><rect x=${FX} y=${FY} width=${FW} height=${FH} fill="#7B6CFF" />
    <circle cx=${CX - 6} cy=${CY - 7} r="3.4" fill="#2B2B33" /><circle cx=${CX + 6} cy=${CY - 7} r="3.4" fill="#2B2B33" />
    <circle cx=${CX} cy=${CY} r="8.6" fill="#FFFFFF" />
    <ellipse cx=${CX - 3.2} cy=${CY - 0.6} rx="2.2" ry="2.8" fill="#2B2B33" /><ellipse cx=${CX + 3.2} cy=${CY - 0.6} rx="2.2" ry="2.8" fill="#2B2B33" />
    <ellipse cx=${CX} cy=${CY + 3.4} rx="1.6" ry="1.1" fill="#2B2B33" /></g>`),
];

// --- Accessoires (devant, à gauche) -----------------------------------------------------------------
const soccer = (cx, cy, r) => html`<g class="ball-bounce">
  <circle cx=${cx} cy=${cy} r=${r} fill="#fff" stroke="#2B2B33" stroke-width="1.8" />
  <path d=${starPath(cx, cy, r * 0.42, r * 0.42 * 0.81)} fill="#2B2B33" />
  ${[0, 72, 144, 216, 288].map((a) => {
    const rad = ((a - 90) * Math.PI) / 180;
    return html`<circle key=${a} cx=${(cx + Math.cos(rad) * r * 0.82).toFixed(1)} cy=${(cy + Math.sin(rad) * r * 0.82).toFixed(1)} r=${(r * 0.2).toFixed(1)} fill="#2B2B33" />`;
  })}
</g>`;

const GEAR = [
  { id: 'ballon_foot', act: 'bounce', sound: 'kick', name: 'Ballon de foot', price: 30, box: '10 130 60 54', render: () => html`<g>${shadow(40, 14)}${soccer(40, 164, 13)}</g>` },
  {
    id: 'ballon_basket', act: 'bounce', sound: 'kick', name: 'Ballon de basket', price: 30, box: '10 130 60 54',
    render: () => html`<g>${shadow(40, 14)}<g class="ball-bounce"><circle cx="40" cy="164" r="13" fill="#F28C28" stroke="#B85E12" stroke-width="1.8" />
      <path d="M27 164 L53 164 M40 151 L40 177 M31 154 C37 160 37 168 31 174 M49 154 C43 160 43 168 49 174" stroke="#7A3C0A" stroke-width="1.4" fill="none" /></g></g>`,
  },
  {
    id: 'skate', act: 'ollie', sound: 'skate', name: 'Skateboard', price: 50, box: '6 140 76 44',
    render: () => html`<g>${shadow(44, 30)}<path d="M12 164 C12 160 16 158 20 160 L68 160 C72 158 76 160 76 164 C76 168 72 170 68 168 L20 168 C16 170 12 168 12 164 Z" fill="#FF7EB6" stroke="#D94A8A" stroke-width="1.6" />
      <path d="M24 164 L64 164" stroke="#fff" stroke-width="2" stroke-dasharray="4 3" />${wheel(24, 173, 4.6, '#FFD23F')}${wheel(64, 173, 4.6, '#FFD23F')}</g>`,
  },
  {
    id: 'trophee', act: 'shine', sound: 'sparkle', name: 'Trophée', price: 120, box: '10 110 60 74',
    render: ({ id }) => html`<g>${shadow(40, 16)}<defs>${grad(`${id}-tr`, GOLD)}</defs>
      <rect x="28" y="166" width="24" height="10" rx="2" fill="#7A4A26" /><rect x="34" y="152" width="12" height="16" fill=${`url(#${id}-tr)`} />
      <path d="M24 124 L56 124 C56 142 50 152 40 154 C30 152 24 142 24 124 Z" fill=${`url(#${id}-tr)`} stroke="#B8860B" stroke-width="1.6" />
      <path d="M24 128 C14 128 14 142 26 144 M56 128 C66 128 66 142 54 144" stroke="#E0A100" stroke-width="3" fill="none" />
      <path d=${starPath(40, 136, 6)} fill="#FFF3B0" />${sparkle(60, 118, 5, 'tw', 0.3)}</g>`,
  },
  {
    id: 'guitare', act: 'strum', sound: 'strum', name: 'Guitare', price: 90, box: '8 96 64 88',
    render: () => html`<g>${shadow(38, 14)}<g transform="rotate(-14 38 150)">
      <rect x="35" y="100" width="6" height="44" fill="#7A4A26" /><rect x="33" y="96" width="10" height="8" rx="2" fill="#4E2E16" />
      <circle cx="38" cy="156" r="14" fill="#E2363F" stroke="#A81C2C" stroke-width="1.6" /><circle cx="38" cy="140" r="10" fill="#E2363F" stroke="#A81C2C" stroke-width="1.6" />
      <circle cx="38" cy="150" r="4" fill="#4E2E16" /><path d="M36 104 L36 162 M40 104 L40 162" stroke="#F2F2F2" stroke-width="0.6" /></g></g>`,
  },
  {
    id: 'cerf_volant', act: 'swoop', sound: 'whoosh', name: 'Cerf-volant', price: 60, box: '10 30 80 150',
    render: () => html`<g>
      <path d="M40 176 C30 140 60 110 52 76" stroke="#6B7486" stroke-width="1.2" fill="none" />
      <g class="sway" style="transform-origin: 50% 100%"><path d="M52 40 L70 62 L52 90 L34 62 Z" fill="#FF7EB6" stroke="#D94A8A" stroke-width="1.6" />
        <path d="M52 40 L52 90 M34 62 L70 62" stroke="#D94A8A" stroke-width="1.2" />
        <path d="M52 90 C46 100 58 106 50 116 C44 124 54 130 48 138" stroke="#9B6CF0" stroke-width="1.4" fill="none" />
        <path d="M46 101 L52 98 L50 104 Z M48 122 L54 120 L52 126 Z" fill="#FFD23F" /></g></g>`,
  },
  {
    id: 'robot', act: 'dance', sound: 'beep', name: 'Robot', price: 150, box: '12 112 60 72',
    render: () => html`<g>${shadow(42, 16)}
      <path d="M42 124 L42 116" stroke="#9AA6BA" stroke-width="2.4" /><circle class="blink-light" cx="42" cy="114" r="3.4" fill="#FF6B6B" />
      <rect x="28" y="124" width="28" height="22" rx="6" fill="#C9D1DE" stroke="#6B7486" stroke-width="1.8" />
      <g class="robot-eye"><circle cx="36" cy="134" r="3.6" fill="#48E0A4" /><circle cx="48" cy="134" r="3.6" fill="#48E0A4" /></g>
      <path d="M36 141 L48 141" stroke="#6B7486" stroke-width="2" stroke-linecap="round" />
      <rect x="30" y="148" width="24" height="20" rx="5" fill="#9AA6BA" stroke="#6B7486" stroke-width="1.8" />
      <circle cx="42" cy="158" r="4" fill="#FFD23F" /><rect x="30" y="168" width="8" height="9" rx="2" fill="#6B7486" /><rect x="46" y="168" width="8" height="9" rx="2" fill="#6B7486" /></g>`,
  },
  {
    id: 'telescope', act: 'star', sound: 'sparkle', name: 'Télescope', price: 100, box: '6 100 74 84',
    render: () => html`<g>${shadow(40, 18)}
      <path d="M40 140 L26 176 M40 140 L54 176 M40 140 L40 176" stroke="#7A4A26" stroke-width="3" stroke-linecap="round" />
      <g transform="rotate(-30 40 136)"><rect x="18" y="128" width="46" height="13" rx="4" fill="#2F74D6" stroke="#1E52A8" stroke-width="1.6" />
        <rect x="60" y="126" width="8" height="17" rx="2" fill="#1E52A8" /><circle cx="40" cy="134" r="4" fill="#FFD23F" /></g>
      ${sparkle(72, 104, 5, 'tw', 0)}</g>`,
  },
  {
    id: 'batterie', act: 'drum', sound: 'drum', name: 'Batterie', price: 120, box: '2 110 84 74',
    render: () => html`<g>${shadow(44, 30)}
      <path d="M64 130 L64 172 M56 128 L74 124" stroke="#9AA6BA" stroke-width="2.4" stroke-linecap="round" /><ellipse cx="64" cy="128" rx="14" ry="3.4" fill="#FFD23F" stroke="#C99A12" stroke-width="1.2" />
      <circle cx="38" cy="158" r="18" fill="#E2363F" stroke="#A81C2C" stroke-width="2" /><circle cx="38" cy="158" r="12" fill="#FFF6F0" />
      <ellipse cx="66" cy="152" rx="11" ry="5" fill="#FFF6F0" stroke="#9AA6BA" stroke-width="1.6" /><rect x="55" y="152" width="22" height="9" fill="#E2363F" />
      <path d="M58 142 L70 132 M72 144 L80 132" stroke="#C47A3A" stroke-width="2.4" stroke-linecap="round" /></g>`,
  },
  {
    id: 'talkie', act: 'beep', sound: 'beep', name: 'Talkies-walkies de l’équipe', price: 0, exclusive: true, team: true, box: '8 104 76 80',
    render: () => html`<g>${shadow(44, 26)}
      ${[[26, '#9B6CF0'], [56, '#FF7EB6']].map(([x, c]) => html`<g key=${x}>
        <path d=${`M${x + 8} 140 L${x + 8} 116`} stroke="#2B2B33" stroke-width="3" stroke-linecap="round" />
        <rect x=${x} y="138" width="18" height="36" rx="5" fill=${c} stroke=${shade(c, -0.3)} stroke-width="1.6" />
        <rect x=${x + 3} y="143" width="12" height="9" rx="2" fill=${glass} />
        ${[0, 1, 2].map((r) => html`<path key=${r} d=${`M${x + 4} ${158 + r * 4} L${x + 14} ${158 + r * 4}`} stroke=${shade(c, -0.35)} stroke-width="1.4" />`)}
      </g>`)}
      <path class="tw" d="M44 112 Q50 118 44 124 M50 108 Q60 118 50 128" stroke="#FFD23F" stroke-width="2" fill="none" stroke-linecap="round" /></g>`,
  },
];

// --- Le jardin de la fratrie : gros objets partagés, achetés avec la cagnotte commune -------------------
const YARD = [
  {
    id: 'cabane', act: 'bird', sound: 'tweet', name: 'Cabane dans les arbres', price: 400, exclusive: true, pot: true, box: '96 6 148 178',
    render: () => html`<g>
      <rect x="166" y="96" width="16" height="82" rx="4" fill="#8B5A2B" />
      <g class="sway" style="animation-duration:6s"><circle cx="150" cy="56" r="30" fill="#48B05E" /><circle cx="196" cy="50" r="32" fill="#3FA352" /><circle cx="174" cy="30" r="28" fill="#5CC46E" /></g>
      <path d="M134 92 L174 66 L214 92 Z" fill="#E2363F" stroke="#A81C2C" stroke-width="2" stroke-linejoin="round" />
      <rect x="140" y="92" width="68" height="34" rx="3" fill="#C98A5B" stroke="#7E4520" stroke-width="2" />
      <rect x="166" y="102" width="16" height="24" rx="2" fill="#7E4520" /><rect x="146" y="98" width="14" height="12" rx="2" fill=${glass} />
      <path d="M126 126 L126 178 M140 126 L140 178 M126 138 L140 138 M126 152 L140 152 M126 166 L140 166" stroke="#7E4520" stroke-width="3" />
    </g>`,
  },
  {
    id: 'trampoline', act: 'boing', sound: 'boing', name: 'Trampoline', price: 300, exclusive: true, pot: true, box: '100 60 140 124',
    render: () => html`<g>
      <path d="M128 150 L122 176 M210 150 L216 176 M168 154 L168 178" stroke="#6B7486" stroke-width="4" stroke-linecap="round" />
      <ellipse cx="168" cy="146" rx="50" ry="12" fill="#2B2B33" stroke="#2F74D6" stroke-width="6" />
      <g class="ball-bounce" style="animation-duration:1s"><path d=${starPath(168, 104, 12)} fill="#FFD23F" stroke="#E0A100" stroke-width="1.6" /></g>
    </g>`,
  },
  {
    id: 'piscine', act: 'splash', sound: 'splash', name: 'Piscine gonflable', price: 250, exclusive: true, pot: true, box: '100 110 140 74',
    render: () => html`<g>
      <ellipse cx="170" cy="164" rx="60" ry="16" fill="#FF7EB6" stroke="#D94A8A" stroke-width="2" />
      <ellipse cx="170" cy="156" rx="60" ry="16" fill="#5EC8FF" stroke="#FF7EB6" stroke-width="8" />
      <path class="wave" d="M126 156 Q138 150 150 156 T174 156 T198 156 T214 156" stroke="#BFF4FF" stroke-width="2" fill="none" />
      <g class="veh-bob"><ellipse cx="160" cy="150" rx="9" ry="6" fill="#FFD23F" /><circle cx="166" cy="143" r="5" fill="#FFD23F" /><path d="M170 143 L175 144 L170 146 Z" fill="#FF8A2B" /><circle cx="167" cy="142" r="1" fill="#2B2B33" /></g>
    </g>`,
  },
  {
    id: 'tente', act: 'crackle', sound: 'crackle', name: 'Tente de camping', price: 200, exclusive: true, pot: true, box: '96 80 148 104',
    render: () => html`<g>
      <path d="M118 176 L166 96 L214 176 Z" fill="#FF8A2B" stroke="#C25E12" stroke-width="2" stroke-linejoin="round" />
      <path d="M166 96 L152 176 L180 176 Z" fill="#7E3A0A" /><path d="M166 96 L166 86" stroke="#7E4520" stroke-width="3" />
      <g transform="translate(222 170)"><path d="M-10 6 L10 -2 M-10 -2 L10 6" stroke="#7E4520" stroke-width="4" stroke-linecap="round" />
        <g class="flame"><path d="M-6 0 C-6 -10 0 -16 0 -22 C4 -14 8 -10 6 0 Z" fill="#FF8A2B" /><path d="M-3 0 C-3 -6 0 -10 0 -14 C3 -8 4 -6 3 0 Z" fill="#FFF3B0" /></g></g>
    </g>`,
  },
  {
    id: 'chateau_gonflable', act: 'boing', sound: 'boing', name: 'Château gonflable', price: 450, exclusive: true, pot: true, box: '96 30 148 154',
    render: () => html`<g>
      <rect x="120" y="96" width="100" height="80" rx="12" fill="#5EC8FF" stroke="#2F74D6" stroke-width="2.4" />
      ${[120, 194].map((x) => html`<g key=${x}><rect x=${x - 4} y="72" width="30" height="104" rx="12" fill="#FF7EB6" stroke="#D94A8A" stroke-width="2.4" />
        <path d=${`M${x - 4} 76 L${x + 11} 54 L${x + 26} 76 Z`} fill="#FFD23F" stroke="#E0A100" stroke-width="2" stroke-linejoin="round" />
        <path d=${`M${x + 11} 54 L${x + 11} 40`} stroke="#6B7486" stroke-width="2" /><path class="flag" d=${`M${x + 12} 40 L${x + 24} 44 L${x + 12} 48 Z`} fill="#E2363F" /></g>`)}
      <path d="M150 176 L150 140 C150 128 190 128 190 140 L190 176 Z" fill="#FFD23F" stroke="#E0A100" stroke-width="2" />
      <path d="M124 104 C150 98 190 98 216 104" stroke="#fff" stroke-width="5" opacity="0.4" fill="none" stroke-linecap="round" />
    </g>`,
  },
];

const withSlot = (slot, list) => list.map((it) => ({ ...it, slot, garage: true }));

export const GARAGE_ITEMS = [...withSlot('vehicle', VEHICLES), ...withSlot('flag', FLAGS), ...withSlot('gear', GEAR), ...withSlot('yard', YARD), ...withSlot('judaica', JUDAICA_ITEMS)];

// Ordre de dessin de la scène (du fond vers l'avant)
export const SCENE_ORDER = ['yard', 'flag', 'vehicle', 'gear', 'judaica'];
