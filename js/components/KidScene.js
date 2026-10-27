// La scène de l'enfant : une seule carte où l'enfant vit dans son décor animé (le paysage du garage,
// le décor acheté, ou le décor 3D qu'apporte son objet principal : la caserne derrière le camion de
// pompiers, la synagogue autour de la Torah…), avec ses objets à côté de lui, à l'échelle :
//   - il monte dans son véhicule quand c'est possible (voiture, kart, avion, poney…) et part avec lui
//     pendant son numéro ; sinon (vélo, trottinette) le véhicule est garé derrière lui, sur la route ;
//   - ses livres, ses bougies de Chabbat ou sa Torah sont posés sur une petite table, à leur vraie taille ;
//   - le jardin de la fratrie, le drapeau et les accessoires gardent leur place dans le paysage.
// Une « caméra » cadre l'ensemble (ou le seul enfant, pendant qu'il choisit son look) et glisse
// doucement d'un cadrage à l'autre. On touche un objet pour son numéro, l'enfant pour qu'il saute de joie.
import { html, useEffect, useLayoutEffect, useMemo, useRef, useState } from '../vendor/preact-htm.js';
import { Avatar } from '../avatar/Avatar.js';
import { getItem } from '../avatar/items.js';
import { hasArt, artSize, artBox, artSrc, artImage } from '../avatar/art.js';
import { THEMES, FRAME } from '../avatar/art-place.js';
import { garageItems, Backdrop, ActFx, ACT_MS, ZONES, isDay } from './Garage.js';
import { garageSfx, sfx } from '../lib/sounds.js';
import { replay } from '../anim/fx.js';
import { prefersReducedMotion } from '../lib/util.js';

let n = 0;

// Repère de l'avatar : viewBox -20 -44 240 298, hanches (mains posées) en (100, 242), sommet du crâne vers y = 14.
// Un enfant d'environ 6 ans mesure 55 cm du haut de la tête aux hanches : 228 unités de l'avatar.
const AV_PER_CM = 228 / 55;
const HIPS = [100, 242];
// Place l'avatar pour que ses hanches tombent en (x, y), à l'échelle s (unités de la scène par unité de l'avatar)
const placeKid = (x, y, s) => ({ x: x - (HIPS[0] + 20) * s, y: y - (HIPS[1] + 44) * s, w: 240 * s, h: 298 * s });
// Partie visible de l'enfant (cheveux compris, jusqu'aux hanches), en unités de l'avatar
const KID_BOX = { x0: 22, y0: 0, x1: 178, y1: 254 };

// Véhicules où l'enfant monte, dans le repère de leur dessin (sol à y = 178) :
//   hips : où se posent ses hanches ; s : sa taille ; front : sous cette ligne, le véhicule repasse devant lui
//   (portières, flancs du poney) ; win : hublot, l'enfant n'est visible qu'à travers
const RIDES = {
  kart: { hips: [80, 147], s: 0.21, front: 137 },
  voiture_course: { hips: [112, 142], s: 0.2, front: 134 },
  voiture_police: { hips: [130, 146], s: 0.16, front: 128 },
  camion_pompiers: { hips: [180, 152], s: 0.15, front: 134 },
  moto: { hips: [80, 137], s: 0.2, front: 137 },
  tracteur: { hips: [91, 114], s: 0.15, front: 106 },
  bateau: { hips: [92, 160], s: 0.24, front: 150 },
  avion: { hips: [148, 107], s: 0.14, front: 97 },
  helico: { hips: [136, 115], s: 0.14, front: 104 },
  fusee: { hips: [100, 116], s: 0.17, win: { cx: 100, cy: 92, rx: 11.5, ry: 11.5 } },
  soucoupe: { hips: [100, 131], s: 0.21, front: 117, win: { cx: 100, cy: 106, rx: 29, ry: 23 } },
  poney: { hips: [99, 115], s: 0.23, front: 116 },
  licorne: { hips: [99, 115], s: 0.23, front: 116 },
  dragon_monture: { hips: [99, 117], s: 0.23, front: 118 },
  bus_fratrie: { hips: [75, 148], s: 0.15, front: 130 },
};
// (un véhicule en image 3D porte sa propre place : item.ride)
export const ridesIn = (itemId) => Boolean(getItem(itemId)?.ride || RIDES[itemId]);

// L'enfant debout (pas de véhicule où monter) : au premier plan, coupé aux hanches par le bas de la carte
const STAND = { x: 40, y: 300, s: 0.78 };
// … et les objets s'alignent à sa droite : la table, le vélo ou la trottinette garés juste à côté de lui, à sa
// taille (un vélo d'enfant arrive à ses hanches), puis l'accessoire un peu plus loin sur la route
const STAND_YARD = 'translate(150 82.5) scale(0.66)';
const STAND_VEHICLE = { c: 1.32, ground: 277 };
const STAND_GEAR = { c: 0.85, ground: 270 };
const GROUND = 266; // la route, là où roulent les véhicules (sol du dessin à y = 178)
const TABLE_CM = 58; // hauteur d'une table d'enfant (presque à ses hanches)
// La table en image 3D : là où se posent les objets, en part de la hauteur de l'image (le milieu du plateau)
const TABLE_TOP = 0.11;
const DEFAULT_BOX = { vehicle: '6 56 216 128', flag: '186 26 60 50', gear: '4 110 80 74', yard: '96 20 148 164' };

// « translate(a b) scale(c) » -> { a, b, c }
const parseZone = (z) => {
  const [a, b, c] = z.match(/-?\d+(\.\d+)?/g).map(Number);
  return { a, b, c };
};
const boxOf = (item, zone) => {
  const [x, y, w, h] = (item.box || DEFAULT_BOX[item.slot] || '0 0 240 200').split(/\s+/).map(Number);
  const { a, b, c } = parseZone(zone);
  return { x0: a + x * c, y0: b + y * c, x1: a + (x + w) * c, y1: b + (y + h) * c };
};
const union = (boxes) => boxes.filter(Boolean).reduce((u, b) => ({ x0: Math.min(u.x0, b.x0), y0: Math.min(u.y0, b.y0), x1: Math.max(u.x1, b.x1), y1: Math.max(u.y1, b.y1) }));
const pad = (b, px, top = px, bottom = px) => ({ x0: b.x0 - px, y0: b.y0 - top, x1: b.x1 + px, y1: b.y1 + bottom });

// Cadrage au format de la carte, sans couper le contenu ; le bas reste ancré (le sol ne bouge pas)
function fit(box, aspect) {
  let w = box.x1 - box.x0;
  let h = box.y1 - box.y0;
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  const cx = (box.x0 + box.x1) / 2;
  return { x: cx - w / 2, y: box.y1 - h, w, h };
}

// La petite table en bois des livres et des bougies : plateau en (x, top), largeur w, pieds jusqu'à ground (ou hors champ)
function Table({ x, top, w, ground = null }) {
  const legs = ground ?? top + 60;
  const t = Math.max(3, w * 0.07);
  return html`<g class="ks-table">
    <rect x=${x + w * 0.12} y=${top} width=${Math.max(2, w * 0.06)} height=${legs - top} fill="#8B5A2B" />
    <rect x=${x + w * 0.82} y=${top} width=${Math.max(2, w * 0.06)} height=${legs - top} fill="#7A4A26" />
    <rect x=${x} y=${top} width=${w} height=${t} rx=${t / 3} fill="#C98A5B" stroke="#7E4520" stroke-width=${t * 0.18} />
    <rect x=${x} y=${top + t * 0.65} width=${w} height=${t * 0.35} fill="#A86E3E" opacity="0.8" />
    ${ground != null && html`<ellipse cx=${x + w / 2} cy=${ground} rx=${w * 0.55} ry=${t * 0.8} fill="#000" opacity="0.15" />`}
  </g>`;
}

// La même table en image 3D, dans le rectangle box
function TableArt({ box, ground = null }) {
  return html`<g class="ks-table">
    ${ground != null && html`<ellipse cx=${box.x + box.w / 2} cy=${ground} rx=${box.w * 0.52} ry=${Math.max(2, box.w * 0.05)} fill="#000" opacity="0.16" />`}
    <image class="art" href=${artSrc('table')} x=${box.x.toFixed(2)} y=${box.y.toFixed(2)} width=${box.w.toFixed(2)} height=${box.h.toFixed(2)} preserveAspectRatio="none" />
  </g>`;
}

export function KidScene({ child, equipped = child.equipped, tryOn = null, expr = 'happy', pose = 'idle', focus = 'all', interactive = true, onEmpty = null, themeScene = null, class: cls = '' }) {
  const id = useMemo(() => `ks${++n}`, []);
  const svg = useRef(null);
  const bgLayer = useRef(null);
  const cam = useRef(null);
  const kidRef = useRef(null);
  const [aspect, setAspect] = useState(1.2);
  const [act, setAct] = useState(null); // { slot, act, n }
  const timer = useRef(null);
  const day = isDay();
  useEffect(() => () => clearTimeout(timer.current), []);

  // Format de la carte : la caméra s'y adapte
  useLayoutEffect(() => {
    const el = svg.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setAspect(Math.round((r.width / r.height) * 100) / 100);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const items = garageItems(equipped, tryOn);
  const bgId = tryOn?.slot === 'bg' ? tryOn.itemId : equipped?.bg;
  const bg = bgId ? getItem(bgId) : null;
  const vehicle = items.vehicle || null;
  const ride = vehicle ? vehicle.ride || RIDES[vehicle.id] : null;
  const book = items.judaica || null;
  const sky = vehicle?.zone === 'sky';
  // Sans décor acheté, le véhicule (sinon l'objet du Judaïsme, sinon le thème de la boutique en cours)
  // apporte son décor 3D, quand il en a un
  const themed = !bg && (THEMES[vehicle?.id] || THEMES[book?.id] || (themeScene && { img: themeScene }));
  const theme = themed && hasArt(themed.img) ? themed : null;
  const scenery = bg || (theme && {
    id: theme.img,
    art: { cover: FRAME },
    render: () => html`<g>${artImage(theme.img, { cover: FRAME })}
      ${theme.outdoor && !day && html`<rect x=${FRAME.x} y=${FRAME.y} width=${FRAME.w} height=${FRAME.h} fill="#1E1A5C" opacity="0.5" style="mix-blend-mode:multiply" />`}</g>`,
  });
  const xOf = (item) => Number((item.box || DEFAULT_BOX[item.slot]).split(/\s+/)[0]);
  const wOf = (item) => Number((item.box || DEFAULT_BOX[item.slot]).split(/\s+/)[2]);
  // L'enfant debout : la table, le véhicule et l'accessoire se rangent à sa droite, l'un après l'autre
  const standRight = STAND.x + (KID_BOX.x1 - HIPS[0]) * STAND.s;
  let cursor = standRight + 2;
  const tableW = book ? Math.max(70 * (((book.real || 20) * STAND.s * AV_PER_CM) / (book.drawH || 40)), 40 * STAND.s * AV_PER_CM) : 0;
  if (book && !ride) cursor += tableW + 4;
  let standVehicle = null;
  if (vehicle && !ride) {
    const { c, ground } = STAND_VEHICLE;
    standVehicle = `translate(${(cursor - xOf(vehicle) * c).toFixed(1)} ${(ground - 178 * c).toFixed(1)}) scale(${c})`;
    cursor += wOf(vehicle) * c + 2;
  }
  const standGear = items.gear && !ride
    ? `translate(${(cursor - xOf(items.gear) * STAND_GEAR.c).toFixed(1)} ${(STAND_GEAR.ground - 178 * STAND_GEAR.c).toFixed(1)}) scale(${STAND_GEAR.c})`
    : null;
  const vZone = sky ? ZONES.sky : ride ? ZONES.vehicle : standVehicle || ZONES.vehicle;
  const zoneOf = (slot) => (slot === 'vehicle' ? vZone : ride ? ZONES[slot] : slot === 'gear' ? standGear : slot === 'yard' ? STAND_YARD : ZONES[slot]);
  const acting = (slot) => (act?.slot === slot ? act : null);
  const kidActing = Boolean(ride && act?.slot === 'vehicle');
  const kidExpr = kidActing ? 'joy' : expr;
  const kidPose = kidActing ? 'cheer' : pose;

  // --- Mise en place : l'enfant (debout ou dans son véhicule) et la table ----------------------------
  const v = parseZone(vZone);
  // Échelle de l'enfant dans la scène, et donc des centimètres (pour la table et ses objets)
  const kidScale = ride ? ride.s * v.c : STAND.s;
  const cm = kidScale * AV_PER_CM;
  // Enfant dans la scène (pour le cadrage) : dans le véhicule, ses hanches suivent le siège
  const kidAt = ride ? [v.a + ride.hips[0] * v.c, v.b + ride.hips[1] * v.c] : [STAND.x, STAND.y];
  const kidBox = {
    x0: kidAt[0] + (KID_BOX.x0 - HIPS[0]) * kidScale,
    y0: kidAt[1] + (KID_BOX.y0 - HIPS[1]) * kidScale,
    x1: kidAt[0] + (KID_BOX.x1 - HIPS[0]) * kidScale,
    y1: kidAt[1] + (Math.min(KID_BOX.y1, ride?.front ? HIPS[1] : KID_BOX.y1) - HIPS[1]) * kidScale,
  };
  // Table : à droite de l'enfant debout (plateau à hauteur de ses hanches), ou à côté du véhicule, sur la route
  let table = null;
  if (book) {
    const bookScale = ((book.real || 20) * cm) / (book.drawH || 40);
    const w = ride ? Math.max(70 * bookScale, 40 * cm) : tableW;
    if (ride) {
      const vb = boxOf(vehicle, vZone);
      const ground = sky ? GROUND : v.b + 178 * v.c;
      table = { x: vb.x1 + 6 * cm, top: ground - TABLE_CM * cm, w, ground, k: bookScale };
    } else {
      table = { x: standRight + 2, top: STAND.y - 12, w, ground: null, k: bookScale };
    }
    table.box = { x0: table.x, y0: table.top - (book.drawH || 40) * bookScale, x1: table.x + table.w, y1: table.ground ?? STAND.y };
    // En image : ses pieds touchent la route (ou, l'enfant debout, sortent du cadre), le plateau reste à sa place
    if (hasArt('table')) {
      const [pw, ph] = artSize('table');
      const h = table.ground != null ? (table.ground - table.top) / (1 - TABLE_TOP) : (table.w * ph) / pw;
      table.art = artBox('table', { cx: table.x + table.w / 2, bottom: table.top + h * (1 - TABLE_TOP), h });
      table.box.x0 = Math.min(table.box.x0, table.art.x);
      table.box.x1 = Math.max(table.box.x1, table.art.x + table.art.w);
    }
  }

  // Rien à côté de lui : le panneau « Mon garage » se plante à sa droite (seulement en plan large :
  // en gros plan sur l'enfant, il serait coupé)
  const empty = interactive && onEmpty && focus !== 'kid' && !vehicle && !book && !items.gear && !items.yard && !items.flag;
  const signX = standRight + 6;
  const signBox = empty ? { x0: signX, y0: 204, x1: signX + 110, y1: STAND.y } : null;

  // --- Cadrage ----------------------------------------------------------------------------------
  // L'essentiel (l'enfant et son véhicule) d'abord ; la table et les accessoires seulement s'ils ne
  // rapetissent pas trop l'enfant (sinon ils dépassent du cadre, comme au cinéma)
  const target = useMemo(() => {
    if (focus === 'kid') return fit(pad(kidBox, (kidBox.x1 - kidBox.x0) * 0.22, (kidBox.y1 - kidBox.y0) * 0.14, 0), aspect);
    const frame = (b) => {
      const bottom = ride ? Math.max(b.y1 + 6, sky ? 210 : GROUND + 20) : STAND.y;
      return fit(pad({ ...b, y1: bottom }, 8, 12, 0), aspect);
    };
    let box = vehicle ? union([kidBox, boxOf(vehicle, vZone)]) : kidBox;
    let cam = frame(box);
    const extras = [table?.box, !ride && items.gear ? boxOf(items.gear, zoneOf('gear')) : null, signBox].filter(Boolean);
    for (const extra of extras) {
      const wider = union([box, extra]);
      const next = frame(wider);
      if (next.w <= cam.w * (ride ? 1.25 : 1.4)) {
        box = wider;
        cam = next;
      }
    }
    return cam;
  }, [focus, aspect, vehicle?.id, ride, book?.id, items.gear?.id, Boolean(signBox), kidBox.x0, kidBox.y0, kidBox.x1, kidBox.y1]);

  // La caméra glisse vers son nouveau cadrage (sans redessiner la scène à chaque image)
  useLayoutEffect(() => {
    const el = svg.current;
    if (!el) return;
    const apply = (c) => {
      el.setAttribute('viewBox', `${c.x.toFixed(2)} ${c.y.toFixed(2)} ${c.w.toFixed(2)} ${c.h.toFixed(2)}`);
      // Le décor couvre toujours tout le cadre ; en image 3D, il remonte un peu (sans découvrir le haut)
      // pour qu'on voie le bâtiment ou le paysage derrière l'enfant, pas seulement le sol
      if (bgLayer.current) {
        const k = Math.max(c.w / 240, c.h / 298);
        const lift = scenery?.art?.cover ? Math.max(0, Math.min(298 - c.h / k, 40)) : 0;
        bgLayer.current.setAttribute('transform', `translate(${(c.x + c.w / 2 - 100 * k).toFixed(2)} ${(c.y + c.h - (254 - lift) * k).toFixed(2)}) scale(${k.toFixed(4)})`);
      }
    };
    const from = cam.current;
    if (!from || prefersReducedMotion()) {
      cam.current = target;
      apply(target);
      return;
    }
    const start = performance.now();
    const ms = 750;
    let raf = 0;
    const step = (t) => {
      const p = Math.min(1, (t - start) / ms);
      const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      const c = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e };
      cam.current = c;
      apply(c);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target.x, target.y, target.w, target.h, scenery?.id]);

  function play(slot, item) {
    if (!interactive || !item.act || act?.slot === slot) return;
    garageSfx[item.sound]?.();
    setAct({ slot, act: item.act, n: (act?.n || 0) + 1 });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAct(null), ACT_MS[item.act] || 1500);
  }
  function hop() {
    if (!interactive) return;
    sfx.happy?.();
    replay(kidRef.current?.querySelector('.avatar'), 'av-jump', 900);
  }

  const kid = (box) => html`<g ref=${kidRef} class="ks-kid" role=${interactive ? 'button' : null} aria-label=${child.name} onClick=${hop}>
    <${Avatar} look=${child.look} equipped=${equipped} tryOn=${tryOn} expr=${kidExpr} pose=${kidPose} mode="bust" seed=${child.id} nest=${box} />
  </g>`;

  // Un objet dans sa zone, avec son arrivée et son numéro au toucher
  const piece = (slot, item, inner = null) => {
    const a = acting(slot);
    const arrive = slot === 'vehicle' ? (sky ? 'gs-arrive-sky' : 'gs-arrive') : 'gs-pop';
    return html`<g key=${`${slot}-${item.id}`} transform=${zoneOf(slot)}>
      <g class=${`gs-item gs-${slot} ${arrive}`} role=${interactive ? 'button' : null} tabIndex=${interactive ? 0 : null} aria-label=${item.name}
        onClick=${(e) => { e.stopPropagation(); play(slot, item); }} onKeyDown=${(e) => (e.key === 'Enter' || e.key === ' ') && play(slot, item)}>
        <g key=${a ? a.n : 'idle'} class=${a ? `gs-act act-${a.act}` : ''}>
          ${inner || item.render({ id: `${id}-${slot}` })}
          ${a && html`<${ActFx} act=${a.act} />`}
        </g>
      </g>
    </g>`;
  };

  // Le véhicule avec l'enfant dedans : véhicule, enfant, puis l'avant du véhicule par-dessus ses hanches
  const rideInner = vehicle && ride && html`<g>
    <defs>
      ${ride.front && html`<clipPath id=${`${id}-front`}><rect x="-60" y=${ride.front} width="360" height="140" /></clipPath>`}
      ${ride.win && html`<clipPath id=${`${id}-win`}><ellipse cx=${ride.win.cx} cy=${ride.win.cy} rx=${ride.win.rx} ry=${ride.win.ry} /></clipPath>`}
    </defs>
    ${vehicle.render({ id: `${id}-vehicle` })}
    <g clip-path=${ride.win ? `url(#${id}-win)` : undefined}>${kid(placeKid(ride.hips[0], ride.hips[1], ride.s))}</g>
    ${ride.front && html`<g clip-path=${`url(#${id}-front)`} aria-hidden="true">${vehicle.render({ id: `${id}-vfront` })}</g>`}
  </g>`;

  return html`<svg ref=${svg} class=${`garage-scene kid-scene ${day ? 'day' : 'night'} ${ride ? 'riding' : 'standing'} ${cls}`} viewBox="0 0 240 300"
    preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label=${`La scène de ${child.name}`}>
    ${scenery ? html`<g ref=${bgLayer} class="ks-bg">${scenery.render({ id: `${id}-bg`, crown: 26 })}</g>` : html`<${Backdrop} id=${id} day=${day} />`}
    ${items.yard && piece('yard', items.yard)}
    ${items.flag && piece('flag', items.flag)}
    ${vehicle && piece('vehicle', vehicle, rideInner)}
    ${items.gear && piece('gear', items.gear)}
    ${!ride && html`<g class="ks-stand">${kid(placeKid(STAND.x, STAND.y, STAND.s))}</g>`}
    ${table && html`<g>
      ${table.art ? html`<${TableArt} box=${table.art} ground=${table.ground} />` : html`<${Table} x=${table.x} top=${table.top} w=${table.w} ground=${table.ground} />`}
      <g transform=${`translate(${table.x + table.w / 2 - 40 * table.k} ${table.top - 178 * table.k}) scale(${table.k})`}>${piece('judaica', book)}</g>
    </g>`}
    ${empty && html`<g transform=${`translate(${(signX - 150).toFixed(1)} 0)`}><g class="gs-empty ks-empty" onClick=${onEmpty} role="button" aria-label="Voir les véhicules">
      <path d="M205 290 L205 250" stroke="#8B5A2B" stroke-width="5" />
      <rect x="150" y="204" width="110" height="48" rx="8" fill="#FFF6E5" stroke="#C47A3A" stroke-width="3" />
      <text x="205" y="225" text-anchor="middle" font-size="12" font-weight="700" font-family="Fredoka, sans-serif" fill="#7E4520">Mon garage</text>
      <text x="205" y="242" text-anchor="middle" font-size="9" font-family="Fredoka, sans-serif" fill="#7E4520">Bientôt ton véhicule ! 🚗</text>
    </g></g>`}
  </svg>`;
}
