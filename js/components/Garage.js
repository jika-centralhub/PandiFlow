// Le garage de l'enfant : une carte à part, juste à côté de son avatar, avec un petit paysage
// vivant (ciel de jour ou de nuit, nuages, oiseaux, collines, herbe, route).
// Chaque objet a sa place : le jardin au fond à gauche, le drapeau sur la colline, le véhicule
// sur la route (ou dans le ciel s'il vole), l'accessoire devant. Le véhicule arrive en roulant ;
// on touche un objet pour le voir faire son numéro (tour de piste, décollage, galop…), avec un son.
import { html, useMemo, useState, useRef, useEffect } from '../vendor/preact-htm.js';
import { getItem } from '../avatar/items.js';
import { SCENE_ORDER } from '../avatar/garage.js';
import { garageSfx } from '../lib/sounds.js';
import { starPath, heartPath, sparkle } from '../avatar/draw.js';

let n = 0;

export function garageItems(equipped, tryOn = null) {
  const out = {};
  for (const slot of SCENE_ORDER) {
    const itemId = tryOn && tryOn.slot === slot ? tryOn.itemId : equipped?.[slot];
    const item = itemId ? getItem(itemId) : null;
    if (item && item.slot === slot) out[slot] = item;
  }
  return out;
}

export const hasGarage = (equipped, tryOn = null) => Object.keys(garageItems(equipped, tryOn)).length > 0;

// Où chaque objet se pose dans la scène (240 x 300, l'horizon de l'herbe à y = 200, la route de 248 à 282).
// Le décor déborde largement du cadre : la carte se remplit quel que soit son format.
const ZONES = {
  yard: 'translate(-61.4 82.5) scale(0.66)',
  flag: 'translate(38.4 14.7) scale(0.85)',
  vehicle: 'translate(15.5 96.9) scale(0.95)',
  sky: 'translate(26.5 14) scale(0.85)',
  gear: 'translate(-0.5 112.5) scale(0.75)',
};
const SUN = { x: 196, y: 46 };

// Durée du numéro de chaque objet (ms)
const ACT_MS = { drive: 2600, fly: 2600, launch: 3400, sail: 2000, gallop: 2400, bounce: 1600, ollie: 900, shine: 1400, strum: 1200, swoop: 2000, dance: 1600, star: 1800, drum: 1300, beep: 1200, wave: 1800, bird: 2200, boing: 1400, splash: 1200, crackle: 1600 };

const isDay = () => {
  const h = new Date().getHours();
  return h >= 7 && h < 20;
};

function Backdrop({ id, day }) {
  return html`<g class="gs-backdrop">
    <defs>
      <linearGradient id=${`${id}-sky`} gradientUnits="userSpaceOnUse" x1="0" y1="-160" x2="0" y2="210">
        ${day
          ? html`<stop offset="0%" stop-color="#5BB6FF" /><stop offset="70%" stop-color="#BFE6FF" /><stop offset="100%" stop-color="#FFF1D6" />`
          : html`<stop offset="0%" stop-color="#151545" /><stop offset="70%" stop-color="#3B2F7A" /><stop offset="100%" stop-color="#7A4C8E" />`}
      </linearGradient>
      <linearGradient id=${`${id}-grass`} gradientUnits="userSpaceOnUse" x1="0" y1="200" x2="0" y2="320">
        <stop offset="0%" stop-color=${day ? '#7AD36F' : '#3E7A55'} /><stop offset="100%" stop-color=${day ? '#46A452' : '#24503A'} />
      </linearGradient>
    </defs>
    <rect x="-400" y="-700" width="1040" height="1000" fill=${`url(#${id}-sky)`} />
    ${!day && html`<g>${[[20, 30], [70, 60], [120, 20], [160, 84], [96, 104], [30, 112], [150, 40], [230, 110], [-40, 60], [280, 40], [60, -40], [180, -30]].map(([x, y], i) => html`<g key=${i}>${sparkle(x, y, 3 + (i % 3), 'tw', i * 0.4)}</g>`)}</g>`}
    ${day
      ? html`<g class="gs-sun"><g class="gs-rays">${Array.from({ length: 12 }, (_, i) => html`<path key=${i} d=${`M${SUN.x} ${SUN.y - 34} L${SUN.x + 4} ${SUN.y - 48} L${SUN.x - 4} ${SUN.y - 48} Z`} fill="#FFE27A" transform=${`rotate(${i * 30} ${SUN.x} ${SUN.y})`} />`)}</g>
          <circle cx=${SUN.x} cy=${SUN.y} r="22" fill="#FFD23F" /><circle cx=${SUN.x} cy=${SUN.y} r="16" fill="#FFE680" /></g>`
      : html`<g class="gs-moon"><circle cx=${SUN.x} cy=${SUN.y} r="18" fill="#FFF3C4" /><circle cx=${SUN.x + 8} cy=${SUN.y - 6} r="16" fill="#151545" opacity="0.9" /></g>`}
    <g class="gs-cloud c1"><ellipse cx="40" cy="40" rx="26" ry="10" fill="#fff" opacity=${day ? 0.95 : 0.25} /><ellipse cx="56" cy="34" rx="16" ry="11" fill="#fff" opacity=${day ? 0.95 : 0.25} /></g>
    <g class="gs-cloud c2"><ellipse cx="140" cy="84" rx="22" ry="8" fill="#fff" opacity=${day ? 0.85 : 0.2} /><ellipse cx="152" cy="79" rx="13" ry="9" fill="#fff" opacity=${day ? 0.85 : 0.2} /></g>
    <g class="gs-cloud c3"><ellipse cx="90" cy="-10" rx="18" ry="7" fill="#fff" opacity=${day ? 0.8 : 0.2} /></g>
    ${day && html`<g class="gs-birds"><path d="M0 60 q5 -5 10 0 q5 -5 10 0 M18 50 q4 -4 8 0 q4 -4 8 0" stroke="#3A3F4D" stroke-width="1.6" fill="none" stroke-linecap="round" /></g>`}
    <path d="M-400 172 C-200 150 -100 160 -40 166 C20 140 70 150 110 166 C150 180 180 150 220 158 C260 166 300 150 400 156 L640 160 L640 214 L-400 214 Z" fill=${day ? '#9CDB8F' : '#3C6157'} />
    <path d="M140 214 C156 178 186 160 214 162 C240 164 270 176 300 186 L640 190 L640 214 Z" fill=${day ? '#6CC26E' : '#2F5A48'} />
    <rect x="-400" y="200" width="1040" height="140" fill=${`url(#${id}-grass)`} />
    <g class="gs-grass">${[-60, -20, 14, 52, 92, 128, 168, 226, 270, 310].map((x, i) => html`<path key=${x} style=${{ animationDelay: `${-i * 0.4}s` }} d=${`M${x} 206 q-2 -8 -6 -11 M${x} 206 q1 -9 3 -13 M${x} 206 q3 -7 8 -9`} stroke=${day ? '#2F8A43' : '#1C4A31'} stroke-width="1.6" fill="none" stroke-linecap="round" />`)}</g>
    <rect x="-400" y="248" width="1040" height="34" fill=${day ? '#6B7486' : '#4A5160'} />
    <rect x="-400" y="248" width="1040" height="3" fill=${day ? '#8A93A6' : '#5C6678'} /><rect x="-400" y="279" width="1040" height="3" fill=${day ? '#8A93A6' : '#5C6678'} />
    <path d="M-400 265 L640 265" stroke="#FFFFFF" stroke-width="2.4" stroke-dasharray="14 12" opacity="0.85" />
    ${[[-30, 292, '#FFD23F'], [20, 290, '#FF7EB6'], [80, 294, '#FFD23F'], [140, 289, '#FFFFFF'], [200, 293, '#FF7EB6'], [262, 290, '#FFFFFF'], [120, 212, '#FFFFFF'], [170, 222, '#FF7EB6']].map(([x, y, c], i) => html`<circle key=${i} cx=${x} cy=${y} r="2.6" fill=${c} />`)}
  </g>`;
}

// Petits effets qui accompagnent certains numéros
function ActFx({ act }) {
  if (act === 'star') return html`<g class="gs-shooting"><path d="M40 30 L70 44" stroke="#FFF7C2" stroke-width="2.4" stroke-linecap="round" /><path d=${starPath(72, 45, 5)} fill="#FFF7C2" /></g>`;
  if (act === 'splash') return html`<g class="gs-splash">${[0, 1, 2, 3, 4, 5].map((i) => html`<circle key=${i} style=${{ '--dx': `${(i - 2.5) * 10}px` }} cx="60" cy="182" r="3" fill="#7FD3FF" />`)}</g>`;
  if (act === 'bird') return html`<g class="gs-bird-out"><path d="M60 110 q6 -6 12 0 q6 -6 12 0" stroke="#3A3F4D" stroke-width="2" fill="none" stroke-linecap="round" /></g>`;
  if (act === 'shine' || act === 'beep') return html`<g class="gs-sparkles">${[[20, 180], [50, 170], [36, 160]].map(([x, y], i) => html`<g key=${i}>${sparkle(x, y, 6, 'tw', i * 0.2)}</g>`)}</g>`;
  if (act === 'gallop') return html`<g class="gs-hearts">${[[150, 190], [170, 180], [190, 195]].map(([x, y], i) => html`<path key=${i} style=${{ animationDelay: `${i * 0.25}s` }} d=${heartPath(x, y, 5)} fill="#FF7EB6" />`)}</g>`;
  return null;
}

export function GarageScene({ equipped, tryOn = null, interactive = true, onEmpty = null, class: cls = '' }) {
  const id = useMemo(() => `gs${++n}`, []);
  const items = garageItems(equipped, tryOn);
  const [act, setAct] = useState(null); // { slot, act, n }
  const timer = useRef(null);
  const day = isDay();
  useEffect(() => () => clearTimeout(timer.current), []);

  function play(slot, item) {
    if (!interactive || !item.act || act?.slot === slot) return;
    garageSfx[item.sound]?.();
    setAct({ slot, act: item.act, n: (act?.n || 0) + 1 });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAct(null), ACT_MS[item.act] || 1500);
  }

  const empty = !Object.keys(items).length;
  return html`<svg class=${`garage-scene ${day ? 'day' : 'night'} ${cls}`} viewBox="0 0 240 300" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Le garage">
    <${Backdrop} id=${id} day=${day} />
    ${SCENE_ORDER.map((slot) => {
      const item = items[slot];
      if (!item) return null;
      const zone = slot === 'vehicle' && item.zone === 'sky' ? 'sky' : slot;
      const acting = act?.slot === slot ? act : null;
      const arrive = slot === 'vehicle' ? (item.zone === 'sky' ? 'gs-arrive-sky' : 'gs-arrive') : 'gs-pop';
      return html`<g key=${`${slot}-${item.id}`} transform=${ZONES[zone]}>
        <g class=${`gs-item gs-${slot} ${arrive}`} role=${interactive ? 'button' : null} tabIndex=${interactive ? 0 : null} aria-label=${item.name}
          onClick=${() => play(slot, item)} onKeyDown=${(e) => (e.key === 'Enter' || e.key === ' ') && play(slot, item)}>
          <g key=${acting ? acting.n : 'idle'} class=${acting ? `gs-act act-${acting.act}` : ''}>
            ${item.render({ id: `${id}-${slot}` })}
            ${acting && html`<${ActFx} act=${acting.act} />`}
          </g>
        </g>
      </g>`;
    })}
    ${empty && html`<g class="gs-empty" onClick=${onEmpty} role=${onEmpty ? 'button' : null}>
      <path d="M120 246 L120 200" stroke="#8B5A2B" stroke-width="5" />
      <rect x="58" y="150" width="124" height="52" rx="8" fill="#FFF6E5" stroke="#C47A3A" stroke-width="3" />
      <text x="120" y="172" text-anchor="middle" font-size="13" font-weight="700" font-family="Fredoka, sans-serif" fill="#7E4520">Mon garage</text>
      <text x="120" y="191" text-anchor="middle" font-size="10" font-family="Fredoka, sans-serif" fill="#7E4520">Bientôt ton véhicule ici ! 🚗</text>
    </g>`}
  </svg>`;
}

// Ancien nom, gardé pour la galerie de tests
export const Garage = GarageScene;
