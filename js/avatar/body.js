// Corps du personnage (haut du corps, vu de face, mains sur les hanches) : cou, buste, bras pliés
// en manches longues et mains à cinq doigts, avec une lumière de film d'animation
// (lumière en haut à gauche, ombres douces, chaque segment ombré comme un volume).
// Repère de l'avatar : tête centrée en (100, 100), encolure à y = 183, mains sur les hanches vers y = 240.
//
// Les bras sont construits à partir de leurs articulations (épaule, coude, poignet). Les costumes
// gardent leur repère d'origine : motifs du buste dans 50-150 x 180-264 (découpés à la forme du
// buste) et détails de manche dans x..x+20 x 188-234 (x = 43 à gauche, 137 à droite) : le haut de
// la manche (188-214) est posé sur le bras, le bas (214-234) sur l'avant-bras, puis découpé à leur forme.
import { html } from '../vendor/preact-htm.js';
import { mirror } from './draw.js';
import { shade } from '../lib/util.js';

export const TORSO =
  'M87 183 C80 184 72 185 64 187 C58 189 55 194 55 201 C55 213 59 226 61 238 C61.5 246 60 254 59 262 L59 272 ' +
  'L141 272 L141 262 C140 254 138.5 246 139 238 C141 226 145 213 145 201 C145 194 142 189 136 187 C128 185 120 184 113 183 Q100 193 87 183 Z';
export const NECKLINE = 'M87 183 Q100 193 113 183';
const NECK = 'M89 150 C90 164 89.5 177 88 192 L112 192 C110.5 177 110 164 111 150 Z';
const FOLD_L = 'M64 205 C67 214 68 222 66 232';

const f = (n) => Math.round(n * 10) / 10;

// Contour d'un segment arrondi, plus fin à un bout qu'à l'autre ; bulge arrondit les côtés (muscle)
function capsule(a, ra, b, rb, bulge = 0) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const v = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  const n = [-v[1], v[0]];
  const p = (c, r, s) => [c[0] + n[0] * r * s, c[1] + n[1] * r * s];
  const a1 = p(a, ra, 1);
  const b1 = p(b, rb, 1);
  const b2 = p(b, rb, -1);
  const a2 = p(a, ra, -1);
  const m1 = [(a1[0] + b1[0]) / 2 + n[0] * bulge, (a1[1] + b1[1]) / 2 + n[1] * bulge];
  const m2 = [(a2[0] + b2[0]) / 2 - n[0] * bulge, (a2[1] + b2[1]) / 2 - n[1] * bulge];
  const pt = (q) => `${f(q[0])} ${f(q[1])}`;
  return `M${pt(a1)} Q${pt(m1)} ${pt(b1)} A${f(rb)} ${f(rb)} 0 0 0 ${pt(b2)} Q${pt(m2)} ${pt(a2)} A${f(ra)} ${f(ra)} 0 0 0 ${pt(a1)} Z`;
}

// Dégradé en travers d'un segment, côté éclairé en haut à gauche
function across(a, b, r) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  let n = [-(b[1] - a[1]) / L, (b[0] - a[0]) / L];
  if (n[0] + n[1] > 0) n = [-n[0], -n[1]];
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  return { x1: f(m[0] + n[0] * r), y1: f(m[1] + n[1] * r), x2: f(m[0] - n[0] * r), y2: f(m[1] - n[1] * r) };
}

// Squelette du bras gauche (à gauche de l'image) ; le droit est son reflet
const ARM = {
  shoulder: [63, 196.5],
  elbow: [40, 223],
  wrist: [57.5, 237.5],
  hand: [63.5, 242],
  // Doigts posés sur la hanche, en éventail vers le ventre et le bas ; le pouce passe derrière
  fingers: [
    [[64, 237.6], [72.4, 241.2], 2.3, 2],
    [[65.2, 241.2], [73, 246.4], 2.4, 2.1],
    [[64.6, 244.8], [71, 250.8], 2.35, 2.05],
    [[62.8, 247.8], [67.4, 253], 2.15, 1.9],
  ],
  thumb: [[59.5, 239.5], [53.6, 241.6], 2.6, 2.3],
};
const flip = (q) => [200 - q[0], q[1]];
const CREASE_L = 'M44.4 218.6 Q49.6 222.4 47.2 227.6 M42.6 221.2 Q45.8 223.2 44.6 226';

function skeleton(side) {
  const m = side === 'l' ? (q) => q : flip;
  const s = m(ARM.shoulder);
  const e = m(ARM.elbow);
  const w = m(ARM.wrist);
  const h = m(ARM.hand);
  return {
    side,
    s,
    e,
    w,
    h,
    upper: capsule(s, 10.4, e, 7.9, 2.6),
    fore: capsule(e, 7.6, w, 6.2, 1.2),
    // Pli du tissu au creux du coude
    crease: side === 'l' ? CREASE_L : mirror(CREASE_L),
    palm: capsule(w, 6.6, h, 6.9, 0.8),
    fingers: ARM.fingers.map(([a, b, ra, rb]) => capsule(m(a), ra, m(b), rb, 0.3)),
    thumb: capsule(m(ARM.thumb[0]), ARM.thumb[2], m(ARM.thumb[1]), ARM.thumb[3], 0.3),
    oldX: side === 'l' ? 43 : 137,
  };
}
const SK = { l: skeleton('l'), r: skeleton('r') };

// Place un morceau de l'ancienne manche (x..x+20, y0..y1) sur le segment a -> b, de largeur width
function sleeveMatrix(oldX, y0, y1, a, b, width, side) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const v = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  let u = [-v[1], v[0]];
  if (side === 'r') u = [-u[0], -u[1]];
  const sx = width / 20;
  const sy = L / (y1 - y0);
  const ma = u[0] * sx;
  const mb = u[1] * sx;
  const mc = v[0] * sy;
  const md = v[1] * sy;
  const ox = oldX + 10;
  return `matrix(${[ma, mb, mc, md, a[0] - ox * ma - y0 * mc, a[1] - ox * mb - y0 * md].map(f).join(' ')})`;
}

// Dégradés et découpes partagés par le corps : à placer dans les <defs> de l'avatar
export function BodyDefs({ id }) {
  return html`
    <clipPath id=${`${id}-torso`}><path d=${TORSO} /></clipPath>
    ${['l', 'r'].map((side) => {
      const k = SK[side];
      return html`<g key=${side}>
        <clipPath id=${`${id}-up-${side}`}><path d=${k.upper} /></clipPath>
        <clipPath id=${`${id}-fo-${side}`}><path d=${k.fore} /></clipPath>
        <linearGradient id=${`${id}-gu-${side}`} gradientUnits="userSpaceOnUse" ...${across(k.s, k.e, 10)}>${CYL}</linearGradient>
        <linearGradient id=${`${id}-gf-${side}`} gradientUnits="userSpaceOnUse" ...${across(k.e, k.w, 7.5)}>${CYL}</linearGradient>
        <linearGradient id=${`${id}-gh-${side}`} gradientUnits="userSpaceOnUse" ...${across(k.w, k.h, 8)}>${CYL}</linearGradient>
      </g>`;
    })}
    <radialGradient id=${`${id}-gd`} cx="45%" cy="40%" r="60%">
      <stop offset="0" stop-color="#fff" stop-opacity=".2" />
      <stop offset="1" stop-color="#fff" stop-opacity="0" />
    </radialGradient>
    <linearGradient id=${`${id}-vx`} x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#000" stop-opacity=".3" />
      <stop offset=".15" stop-color="#000" stop-opacity=".1" />
      <stop offset=".35" stop-color="#fff" stop-opacity=".1" />
      <stop offset=".6" stop-color="#fff" stop-opacity="0" />
      <stop offset=".85" stop-color="#000" stop-opacity=".14" />
      <stop offset="1" stop-color="#000" stop-opacity=".36" />
    </linearGradient>
    <linearGradient id=${`${id}-vy`} x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".2" />
      <stop offset=".25" stop-color="#fff" stop-opacity="0" />
      <stop offset=".62" stop-color="#000" stop-opacity="0" />
      <stop offset="1" stop-color="#000" stop-opacity=".34" />
    </linearGradient>
    <radialGradient id=${`${id}-ao`}>
      <stop offset="0" stop-color="#000" stop-opacity=".4" />
      <stop offset="1" stop-color="#000" stop-opacity="0" />
    </radialGradient>
    <radialGradient id=${`${id}-chest`} cx="50%" cy="40%" r="55%">
      <stop offset="0" stop-color="#fff" stop-opacity=".09" />
      <stop offset="1" stop-color="#fff" stop-opacity="0" />
    </radialGradient>`;
}

// Tissu mat : reflet doux du côté de la lumière, ombre plus franche de l'autre côté
const CYL = html`
  <stop offset="0" stop-color="#000" stop-opacity=".12" />
  <stop offset=".25" stop-color="#fff" stop-opacity=".1" />
  <stop offset=".5" stop-color="#fff" stop-opacity="0" />
  <stop offset=".82" stop-color="#000" stop-opacity=".17" />
  <stop offset="1" stop-color="#000" stop-opacity=".34" />`;

function Arm({ id, side, sleeve, hand, handLine, costume, ctx }) {
  const k = SK[side];
  return html`<g class=${`av-arm av-arm-${side}`} style=${{ transformBox: 'view-box', transformOrigin: `${k.s[0]}px ${k.s[1] - 4}px` }}>
    <path d=${k.fore} fill=${shade(sleeve, -0.03)} />
    <g clip-path=${`url(#${id}-fo-${side})`}>
      ${costume?.sleeves && html`<g transform=${sleeveMatrix(k.oldX, 214, 234, k.e, k.w, 15, side)}>${costume.sleeves(ctx, k.oldX)}</g>`}
      <path d=${k.fore} fill=${`url(#${id}-gf-${side})`} />
    </g>
    <path d=${k.upper} fill=${sleeve} />
    <g clip-path=${`url(#${id}-up-${side})`}>
      ${costume?.sleeves && html`<g transform=${sleeveMatrix(k.oldX, 188, 214, [k.s[0], k.s[1] - 9], k.e, 21, side)}>${costume.sleeves(ctx, k.oldX)}</g>`}
      <path d=${k.upper} fill=${`url(#${id}-gu-${side})`} />
      <ellipse cx=${k.s[0] + (side === 'l' ? -2 : 2)} cy=${k.s[1] - 3} rx="8" ry="6" fill=${`url(#${id}-gd)`} />
    </g>
    <path d=${k.crease} stroke="#000" stroke-opacity=".2" stroke-width="1.6" fill="none" stroke-linecap="round" />
    <g class="av-hand">
      <path d=${k.thumb} fill=${hand} stroke=${handLine} stroke-width="0.7" />
      <path d=${k.thumb} fill="#000" opacity="0.14" />
      <path d=${k.palm} fill=${hand} stroke=${handLine} stroke-width="0.7" />
      ${[...k.fingers].reverse().map((p, i) => html`<g key=${i}>
        <path d=${p} fill=${hand} stroke=${handLine} stroke-width="0.7" />
        <path d=${p} fill=${`url(#${id}-gh-${side})`} opacity="0.8" />
      </g>`)}
      <path d=${k.palm} fill=${`url(#${id}-gh-${side})`} opacity="0.85" />
    </g>
  </g>`;
}

/**
 * <Body> : le haut du corps habillé.
 *  shirt / sleeve : couleurs du haut et des manches ; skin : peau (cou, mains sans gants)
 *  neck : haut du cou dessiné (y), ou false quand le visage 3D apporte le sien
 */
export function Body({ id, skin, shirt, sleeve, costume, outfit, neckItem, ctx, neck = 150 }) {
  const gloves = costume?.gloves;
  const hand = gloves || `url(#${id}-skin)`;
  const handLine = shade(gloves || skin, -0.3);
  return html`<g class="av-body">
    ${neck !== false && html`<g>
      <clipPath id=${`${id}-neck`}><rect x="80" y=${neck} width="40" height=${200 - neck} /></clipPath>
      <g clip-path=${`url(#${id}-neck)`}>
        <path d=${NECK} fill=${shade(skin, -0.08)} />
        <ellipse cx="100" cy=${Math.max(163, neck + 4)} rx="13" ry="6" fill="#000" opacity="0.16" />
      </g>
    </g>`}
    <path d=${TORSO} fill=${`url(#${id}-shirt)`} />
    <g clip-path=${`url(#${id}-torso)`}>
      ${costume ? costume.torso?.(ctx) : outfit?.render(ctx)}
      <g class="av-volume">
        <path d=${FOLD_L} stroke="#000" stroke-opacity=".07" stroke-width="3" fill="none" stroke-linecap="round" />
        <path d=${mirror(FOLD_L)} stroke="#000" stroke-opacity=".07" stroke-width="3" fill="none" stroke-linecap="round" />
        <ellipse cx="90" cy="212" rx="30" ry="24" fill=${`url(#${id}-chest)`} />
        <rect x="50" y="176" width="100" height="96" fill=${`url(#${id}-vx)`} />
        <rect x="50" y="176" width="100" height="96" fill=${`url(#${id}-vy)`} />
        <ellipse cx="100" cy="186" rx="28" ry="10" fill=${`url(#${id}-ao)`} />
        <ellipse cx="66" cy="244" rx="10" ry="12" fill=${`url(#${id}-ao)`} />
        <ellipse cx="134" cy="244" rx="10" ry="12" fill=${`url(#${id}-ao)`} />
      </g>
    </g>
    ${costume?.collar
      ? costume.collar(ctx)
      : html`<path d=${NECKLINE} fill="none" stroke=${shade(shirt, -0.16)} stroke-width="2.8" stroke-linecap="round" />
        <path d="M89.5 185 Q100 191.6 110.5 185" fill="none" stroke=${shade(shirt, 0.2)} stroke-width="0.8" opacity="0.5" />`}
    ${neckItem && html`<g class="av-neck">${neckItem.render(ctx)}</g>`}
    <${Arm} id=${id} side="l" sleeve=${sleeve} hand=${hand} handLine=${handLine} costume=${costume} ctx=${ctx} />
    <${Arm} id=${id} side="r" sleeve=${sleeve} hand=${hand} handLine=${handLine} costume=${costume} ctx=${ctx} />
    ${costume?.over && html`<g class="av-costume-over">${costume.over(ctx)}</g>`}
  </g>`;
}
