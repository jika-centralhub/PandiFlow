// Le bandeau de chaque enfant sur l'écran de la routine : son décor derrière l'avatar et le prénom, et son
// véhicule et son compagnon en grand, qui se baladent d'un bout à l'autre du bandeau (seulement les objets
// qui ont leur image 3D). Seul transform est animé, sur des images HTML : le téléphone le fait sans
// redessiner (voir css/routine.css). Trois couches : le bouton se balade, son .kh-act joue le geste au
// toucher (le véhicule fonce, le compagnon saute, chacun avec son bruit), l'image respire ou rebondit.
import { html, useEffect, useState } from '../vendor/preact-htm.js';
import { CALME } from '../config.js';
import { MARCHE } from '../avatar/marche-list.js';
import { getItem } from '../avatar/items.js';
import { hasArt, artSrc, artSize } from '../avatar/art.js';
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

// Écran calme (CALME, js/config.js) : ils restent garés et ne font qu'une balade de temps en temps (une
// toutes les 2 à 3 minutes, à tour de rôle d'un enfant à l'autre), le reste du temps rien ne bouge.
// La balade est jouée comme dans un dessin animé (css/calme.css) : un élan au départ, des pas qui
// rebondissent (ou le moteur qui vibre et se cabre), un freinage, un coup d'œil, un demi-tour en sautant,
// puis le retour. Chaque étape pose une classe ; tout le mouvement est fait par la carte graphique.
function useBalade(index, on) {
  const [tour, setTour] = useState(0);
  useEffect(() => {
    if (!on) return undefined;
    let t = 0;
    const next = (ms) => { t = setTimeout(() => { setTour((n) => n + 1); next(120000 + Math.random() * 60000); }, ms); };
    next(20000 + index * 45000);
    // pour regarder une balade tout de suite (console) : pandiBalade()
    const now = () => setTour((n) => n + 1);
    (globalThis.pandiBaladeFns ||= new Set()).add(now);
    globalThis.pandiBalade = () => globalThis.pandiBaladeFns.forEach((fn) => fn());
    return () => {
      clearTimeout(t);
      globalThis.pandiBaladeFns.delete(now);
    };
  }, [index, on]);
  return tour;
}

// La façon de se déplacer : un animal marche, un vélo roule sans moteur, ce qui vole plane, ce qui flotte tangue
export function kindOf(item, slot) {
  if (item.id === 'hibou') return 'ciel'; // il vole, les ailes levées
  if (slot === 'pet' || item.act === 'gallop') return 'animal';
  if (item.zone === 'sky') return 'ciel';
  if (item.act === 'sail') return 'eau';
  if (item.sound === 'bell') return 'velo';
  return 'moteur';
}

// Les étapes de la balade : [nom, durée en ms]. « loin » : au bout du trajet ; le demi-tour se fait en l'air.
const STEPS = {
  animal: [['pret', 450], ['va', 5200], ['stop', 450], ['regarde', 1500], ['tourne', 560], ['vient', 5200], ['stop', 450], ['tourne', 560]],
  velo: [['pret', 500], ['va', 5000], ['stop', 600], ['regarde', 900], ['tourne', 600], ['vient', 5000], ['stop', 600], ['tourne', 600]],
  moteur: [['contact', 900], ['va', 5000], ['stop', 700], ['regarde', 900], ['tourne', 620], ['vient', 5000], ['stop', 700], ['tourne', 620]],
  ciel: [['pret', 700], ['va', 5600], ['stop', 900], ['regarde', 700], ['tourne', 800], ['vient', 5600], ['stop', 900], ['tourne', 800]],
  eau: [['pret', 600], ['va', 6200], ['stop', 800], ['regarde', 900], ['tourne', 800], ['vient', 6200], ['stop', 800], ['tourne', 800]],
};

// Ce qui tourne pendant la balade, mesuré sur chaque image (en pixels de l'image, voir artSize) :
//   roues : [x, y, rayon] des roues pleines vues de profil, découpées dans l'image et qui tournent
//   rayons : [x, y, rayon] des roues à rayons (le cadre passe devant) : un disque de flou qui tourne par-dessus
//   helices : { x, y, rx, ry, sens } le flou de l'hélice (v : verticale, h : à plat, disque : vue de face)
// Le kart et la voiture de course sont vus de trois quarts (roues ovales) : ils n'ont que la vibration.
const PARTS = {
  voiture_police: { roues: [[137.5, 293, 52], [505, 292.5, 52]] },
  camion_pompiers: { roues: [[137.5, 286, 52], [500.5, 286.5, 52]] },
  bus_fratrie: { roues: [[128.5, 260, 47], [505, 260, 47]] },
  tracteur: { roues: [[138, 243, 108], [546, 306, 58]] },
  velo: { rayons: [[108, 295, 88], [527, 295, 88]] },
  tandem: { rayons: [[92, 212, 70], [555, 212, 70]] },
  moto: { rayons: [[103, 296, 72], [548, 296, 68]] },
  avion: { helices: [{ x: 598, y: 155, rx: 18, ry: 128, sens: 'v' }] },
  helico: { helices: [{ x: 360, y: 24, rx: 285, ry: 10, sens: 'h' }, { x: 42, y: 122, rx: 44, ry: 44, sens: 'disque' }] },
  sous_marin: { helices: [{ x: 28, y: 248, rx: 20, ry: 75, sens: 'v' }] },
};
const pc = (v) => `${(v * 100).toFixed(2)}%`;
const disc = (W, H, x, y, rx, ry = rx) => ({ left: pc((x - rx) / W), top: pc((y - ry) / H), width: pc((2 * rx) / W), height: pc((2 * ry) / H) });

function Parts({ id, src }) {
  const p = PARTS[id];
  const size = p && artSize(id);
  if (!size) return null;
  const [W, H] = size;
  return html`${(p.roues || []).map(([x, y, r], i) => html`<span key=${`r${i}`} class="kr-roue" style=${disc(W, H, x, y, r)}>
      <img src=${src} alt="" draggable="false" style=${{ width: pc(W / (2 * r)), height: 'auto', maxWidth: 'none', left: pc(-(x - r) / (2 * r)), top: pc(-(y - r) / (2 * r)) }} />
    </span>`)}
    ${(p.rayons || []).map(([x, y, r], i) => html`<span key=${`s${i}`} class="kr-rayons" style=${disc(W, H, x, y, r)} />`)}
    ${(p.helices || []).map((h, i) => html`<span key=${`h${i}`} class=${`kr-helice ${h.sens}`} style=${disc(W, H, h.x, h.y, h.rx, h.ry)} />`)}`;
}

// Un animal qui a ses images de marche (assets/items/marche/, tests/local/pose_marche.py) : pendant la balade, il
// passe de profil et alterne ses deux temps du pas, au rythme des rebonds ; garé, il reprend son image habituelle
const walkSrc = (id, n) => new URL(`../../assets/items/marche/${id}_${n}.webp`, import.meta.url).href;
function Walk({ id, onReady }) {
  const n = MARCHE[id][2];
  return html`<img class="kr-f1" src=${walkSrc(id, 1)} alt="" draggable="false" onLoad=${onReady} />
    ${n > 1 && html`<img class="kr-f2" src=${walkSrc(id, 2)} alt="" draggable="false" />`}`;
}

function Rover({ cls, label, src, id, kind, tour, wait, onTap }) {
  const [at, setAt] = useState(-1); // l'étape en cours (-1 : garé)
  const [walkReady, setWalkReady] = useState(false);
  const walks = (kind === 'animal' || kind === 'ciel') && MARCHE[id] && tour > 0;
  useEffect(() => {
    if (!tour) return undefined;
    const steps = STEPS[kind];
    let i = -1, t = setTimeout(function step() {
      i++;
      setAt(i < steps.length ? i : -1);
      if (i < steps.length) t = setTimeout(step, steps[i][1]);
    }, wait);
    return () => clearTimeout(t);
  }, [tour]);
  const steps = STEPS[kind];
  const name = at >= 0 ? steps[at][0] : 'gare';
  // au bout du trajet de « va » jusqu'au premier demi-tour compris ; tourné vers la droite après lui
  const firstTurn = steps.findIndex((s) => s[0] === 'tourne');
  const loin = at >= 1 && at <= firstTurn;
  const droite = at >= firstTurn && at < steps.length - 1;
  const dur = at >= 0 ? steps[at][1] : 0;
  return html`<button class=${`${cls} kr kr-${kind} kr-${name} ${loin ? 'loin' : ''} ${droite ? 'droite' : 'gauche'} ${walks && walkReady ? `marche ${MARCHE[id][2] > 1 ? 'deux' : ''}` : ''}`}
    style=${{ '--dur': `${dur}ms` }} aria-label=${label} onClick=${onTap}>
    <span class="kr-dir"><span class="kh-act"><span class="kr-lean"><span class="kr-pas">
      <img class="kr-img" src=${src} alt="" draggable="false" /><${Parts} id=${id} src=${src} />
      ${walks && html`<${Walk} id=${id} onReady=${() => setWalkReady(true)} />`}
    </span></span></span>
    ${kind === 'moteur' && html`<i class="kr-fumee" /><i class="kr-fumee f2" /><i class="kr-fumee f3" />`}
    ${(kind === 'animal' || kind === 'velo') && html`<i class="kr-pouf" /><i class="kr-pouf p2" />`}</span>
  </button>`;
}

export function KidStuff({ child, index = 0 }) {
  const veh = getItem(child.equipped?.vehicle);
  const pet = getItem(child.equipped?.pet);
  const vImg = imgOf(veh);
  const pImg = imgOf(pet);
  const tour = useBalade(index, CALME && Boolean(vImg || pImg));
  if (!vImg && !pImg) return null;
  const sky = veh?.zone === 'sky';
  const tapVeh = (e) => { garageSfx[veh.sound]?.(); play(e, sky ? FLY : DRIVE, sky ? 2200 : 2400); };
  const tapPet = (e) => { sfx.pop?.(); play(e, HOP, 900); };
  if (CALME) {
    return html`<div class="kh-stuff">
      ${vImg && html`<${Rover} cls=${`kh-veh ${sky ? 'sky' : ''}`} label=${veh.name} src=${artSrc(vImg)} id=${vImg} kind=${kindOf(veh, 'vehicle')} tour=${tour} wait=${0} onTap=${tapVeh} />`}
      ${pImg && html`<${Rover} cls="kh-pet" label=${pet.name} src=${artSrc(pImg)} id=${pImg} kind=${kindOf(pet, 'pet')} tour=${tour} wait=${vImg ? 2600 : 0} onTap=${tapPet} />`}
    </div>`;
  }
  // les deux colonnes ne bougent pas en même temps
  const delay = { '--d': `${-index * 1.3}s`, '--w': `${-index * 7}s` };
  return html`<div class="kh-stuff" style=${delay}>
    ${vImg && html`<button class=${`kh-veh ${sky ? 'sky' : ''}`} aria-label=${veh.name} onClick=${tapVeh}>
      <span class="kh-act"><img src=${artSrc(vImg)} alt="" draggable="false" /></span>
    </button>`}
    ${pImg && html`<button class="kh-pet" aria-label=${pet.name} onClick=${tapPet}>
      <span class="kh-act"><img src=${artSrc(pImg)} alt="" draggable="false" /></span>
    </button>`}
  </div>`;
}
