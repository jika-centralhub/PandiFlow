// Le bandeau de chaque enfant sur l'écran de la routine : son décor derrière l'avatar et le prénom, et son
// véhicule et son compagnon en grand, qui se baladent d'un bout à l'autre du bandeau (seulement les objets
// qui ont leur image 3D). Seul transform est animé, sur des images HTML : le téléphone le fait sans
// redessiner (voir css/routine.css). Trois couches : le bouton se balade, son .kh-act joue le geste au
// toucher (le véhicule fonce, le compagnon saute, chacun avec son bruit), l'image respire ou rebondit.
import { html } from '../vendor/preact-htm.js';
import { getItem } from '../avatar/items.js';
import { hasArt, artSrc } from '../avatar/art.js';
import { garageSfx, sfx } from '../lib/sounds.js';

const imgOf = (item) => {
  const img = item?.art?.img || item?.id;
  return item?.art && hasArt(img) ? img : null;
};

// La bande du décor (image en hauteur) que montre le bandeau, très large : la hauteur où se trouve ce
// qui le rend reconnaissable (bâtiment, horizon), réglée à l'œil sur chaque image
const BANNER_Y = {
  fond_chambre: '35%', fond_espace: '42%', fond_foret: '45%', fond_chateau: '38%', fond_ocean: '45%', fond_plage: '47%',
  fond_arcenciel: '35%', fond_chateau_fort: '38%', fond_farwest: '33%', fond_cuisine: '36%', fond_commissariat: '45%', fond_caserne: '55%',
};

// Le décor acheté par l'enfant, s'il a son image (pendant un thème, seuls les décors du thème restent portés)
export function sceneOf(child) {
  const bg = getItem(child?.equipped?.bg);
  const img = bg?.art?.img;
  return img && hasArt(img) ? { img, y: BANNER_Y[img] || '42%' } : null;
}

export const hasStuff = (child) => Boolean(imgOf(getItem(child?.equipped?.vehicle)) || imgOf(getItem(child?.equipped?.pet)));

// Le véhicule roule jusqu'au bord du bandeau et revient de l'autre côté ; ce qui vole fait un tour en l'air
const DRIVE = [
  { transform: 'translateX(0)' },
  { transform: 'translateX(-6%)', offset: 0.08 },
  { transform: 'translateX(160%)', offset: 0.45 },
  { transform: 'translateX(-260%)', offset: 0.46 },
  { transform: 'translateX(0)' },
];
const FLY = [
  { transform: 'translate(0, 0) rotate(0)' },
  { transform: 'translate(30%, -30%) rotate(-8deg)', offset: 0.3 },
  { transform: 'translate(-30%, -40%) rotate(8deg)', offset: 0.7 },
  { transform: 'translate(0, 0) rotate(0)' },
];
const HOP = [
  { transform: 'translateY(0) scale(1, 1)' },
  { transform: 'translateY(0) scale(1.12, .86)', offset: 0.15 },
  { transform: 'translateY(-55%) scale(.92, 1.1) rotate(-6deg)', offset: 0.45 },
  { transform: 'translateY(0) scale(1.1, .9)', offset: 0.75 },
  { transform: 'translateY(0) scale(1, 1)' },
];

function play(e, frames, duration) {
  e.stopPropagation();
  const el = e.currentTarget.querySelector('.kh-act');
  if (el.getAnimations?.().length) return;
  el.animate?.(frames, { duration, easing: 'ease-in-out' });
}

export function KidStuff({ child, index = 0 }) {
  const veh = getItem(child.equipped?.vehicle);
  const pet = getItem(child.equipped?.pet);
  const vImg = imgOf(veh);
  const pImg = imgOf(pet);
  if (!vImg && !pImg) return null;
  const sky = veh?.zone === 'sky';
  // les deux colonnes ne bougent pas en même temps
  const delay = { '--d': `${-index * 1.3}s`, '--w': `${-index * 7}s` };
  return html`<div class="kh-stuff" style=${delay}>
    ${vImg && html`<button class=${`kh-veh ${sky ? 'sky' : ''}`} aria-label=${veh.name}
      onClick=${(e) => { garageSfx[veh.sound]?.(); play(e, sky ? FLY : DRIVE, sky ? 2200 : 2400); }}>
      <span class="kh-act"><img src=${artSrc(vImg)} alt="" draggable="false" /></span>
    </button>`}
    ${pImg && html`<button class="kh-pet" aria-label=${pet.name}
      onClick=${(e) => { sfx.pop?.(); play(e, HOP, 900); }}>
      <span class="kh-act"><img src=${artSrc(pImg)} alt="" draggable="false" /></span>
    </button>`}
  </div>`;
}
