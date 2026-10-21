// Personnage 3D avec le haut du corps (photo magique) : l'image de l'IA, en t-shirt blanc uni, sert de
// support. Le t-shirt prend la couleur du haut ou du costume, les motifs du costume s'y posent, puis la
// lumière du tissu (image shade de portraits.js) est remise par-dessus en « produit » : les plis, les
// ombres et le volume de l'image restent, le costume a l'air porté. Les gants passent de même sur les mains.
// Dans les poses bras levés, l'avant-bras et la main sont découpés et bougent autour du coude (avatar.css).
//
// Les costumes gardent leur repère d'origine (corps dessiné de body.js) : le buste est ramené sur celui
// de l'image par une transformation affine (encolure, épaules, hanches), les détails de manche sont posés
// sur le bras et l'avant-bras repérés dans l'image.
import { html } from '../vendor/preact-htm.js';
import { capsule, sleeveMatrix } from './body.js';

const f = (n) => Math.round(n * 100) / 100;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const unit = (v) => {
  const L = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / L, v[1] / L];
};

// Points du corps dessiné (body.js) et leurs repères dans l'image : encolure, épaules, hanches
const OLD = { collar: [100, 183], shoulderLeft: [63, 196.5], shoulderRight: [137, 196.5], waistLeft: [60.5, 244], waistRight: [139.5, 244] };

// Transformation affine (moindres carrés) qui amène les points src sur dst, en matrix(a b c d e f)
function affine(src, dst) {
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const rx = [0, 0, 0];
  const ry = [0, 0, 0];
  src.forEach(([x, y], i) => {
    const v = [x, y, 1];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) M[r][c] += v[r] * v[c];
      rx[r] += v[r] * dst[i][0];
      ry[r] += v[r] * dst[i][1];
    }
  });
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M);
  const solve = (rhs) => [0, 1, 2].map((k) => det(M.map((row, r) => row.map((v, c) => (c === k ? rhs[r] : v)))) / D);
  const [a, c, e] = solve(rx);
  const [b, d, g] = solve(ry);
  return `matrix(${[a, b, c, d, e, g].map(f).join(' ')})`;
}

/**
 * Géométrie du corps dans le repère de l'avatar, à partir de la place de l'image (pic : x, y, W, H),
 * des repères (m) et de l'épaisseur des bras mesurée sur l'image (arms, en fraction de la largeur).
 */
export function bodyGeometry(pic, m, arms) {
  const P = (k) => [pic.x + m[`${k}X`] * pic.W, pic.y + m[`${k}Y`] * pic.H];
  const waistLeft = [pic.x + m.waistLeftX * pic.W, pic.y + m.waistY * pic.H];
  const waistRight = [pic.x + m.waistRightX * pic.W, pic.y + m.waistY * pic.H];
  const dst = { collar: P('collar'), shoulderLeft: P('shoulderLeft'), shoulderRight: P('shoulderRight'), waistLeft, waistRight };
  const torso = affine(Object.values(OLD), Object.keys(OLD).map((k) => dst[k]));
  const side = (s, key) => {
    const S = P(`shoulder${s}`);
    const E = P(`elbow${s}`);
    const Wr = P(`wrist${s}`);
    const Hd = P(`hand${s}`);
    const ru = (arms?.[key]?.upper || 0.045) * pic.W;
    const rf = (arms?.[key]?.fore || 0.038) * pic.W;
    // La main va du poignet au bout des doigts, de part et d'autre de son centre
    const rh = Math.max(rf * 1.6, Math.hypot(Hd[0] - Wr[0], Hd[1] - Wr[1]) * 0.95);
    // Le haut de la manche couvre aussi l'épaule
    const v = unit(sub(E, S));
    const top = [S[0] - v[0] * ru * 0.9, S[1] - v[1] * ru * 0.9];
    // Manche : bras et avant-bras, un peu plus larges que mesurés pour ne rien laisser de blanc
    const upper = capsule(top, ru * 1.25, E, rf * 1.3);
    const lower = capsule(E, rf * 1.3, Wr, rf * 1.25);
    return {
      key,
      S, E, W: Wr, H: Hd, ru, rf, rh, top, upper, lower,
      sleeve: `${upper} ${lower}`,
      // Avant-bras et main découpés pour bouger autour du coude
      fore: `${capsule(E, rf * 1.5, Wr, rf * 1.5)} M${f(Hd[0] - rh * 1.25)} ${f(Hd[1])} a${f(rh * 1.25)} ${f(rh * 1.25)} 0 1 0 ${f(rh * 2.5)} 0 a${f(rh * 1.25)} ${f(rh * 1.25)} 0 1 0 ${f(-rh * 2.5)} 0 Z`,
    };
  };
  return { torso, arms: [side('Left', 'l'), side('Right', 'r')] };
}

/**
 * <HeadCover> : masque, cagoule, bandeau ou barbe d'un costume sur la tête de l'image.
 * Le dessin du costume est ajusté à la tête (pic.headFit) ; une cagoule (costume.hood) colore toute la
 * tête (hood.face) ou seulement les cheveux, à leur forme exacte ; puis la lumière du visage (headShade)
 * est remise par-dessus en « produit » : le masque prend le relief du nez, des joues et du front.
 */
export function HeadCover({ id, pic, img, costume, ctx }) {
  const box = { x: pic.x, y: pic.y, width: pic.W, height: pic.H };
  const region = { maskUnits: 'userSpaceOnUse', x: f(pic.x - 2), y: f(pic.y - 2), width: f(pic.W + 4), height: f(pic.H + 4), style: 'mask-type:alpha' };
  const maps = img.body;
  const hood = costume.hood;
  const fill = hood ? (hood.face ? maps.hood : maps.hair) : null;
  // Copie du dessin dans le masque de lumière, avec ses propres identifiants
  const drawing = (c) => costume.face && html`<g transform=${pic.headFit}>${costume.face(c)}</g>`;
  return html`<g class="av-costume-face">
    <defs>
      ${fill && html`<mask id=${`${id}-hc`} ...${region}><image href=${fill} ...${box} /></mask>`}
      <mask id=${`${id}-hl`} ...${region}>
        ${fill && html`<image href=${fill} ...${box} />`}
        ${drawing({ ...ctx, id: `${ctx.id}-hl` })}
      </mask>
    </defs>
    ${fill && html`<rect ...${box} fill=${hood.color} mask=${`url(#${id}-hc)`} />`}
    ${drawing(ctx)}
    <image href=${maps.headShade} ...${box} mask=${`url(#${id}-hl)`} style="mix-blend-mode:multiply" />
  </g>`;
}

/**
 * <Body3D> : le personnage de l'image, habillé.
 *  pic, geo : place de l'image et géométrie (bodyGeometry) ; img : image préparée (portraits.js)
 *  shirt / sleeve / gloves : couleurs ; costume, outfit : costume complet ou pyjama (motifs) ;
 *  backs : objets de dos (capes…) ; neckItem : objet autour du cou ; articulated : avant-bras animés ;
 *  cut : masque de découpe (tête seule, sans les bras) ; tint : filtre de teinte de peau (Hulk)
 */
export function Body3D({ id, pic, geo, img, shirt, sleeve, gloves, costume, outfit, backs = [], neckItem, ctx, articulated = false, cut, tint }) {
  const box = { x: pic.x, y: pic.y, width: pic.W, height: pic.H };
  const region = { maskUnits: 'userSpaceOnUse', x: f(pic.x - 2), y: f(pic.y - 2), width: f(pic.W + 4), height: f(pic.H + 4) };
  const maps = img.body;
  const sleeves = geo.arms.map((a) => a.sleeve).join(' ');
  const isRight = (a) => a.key === 'r';

  const stack = (k) => html`<g key=${k}>
    <image href=${img.url} ...${box} filter=${tint} />
    <g mask=${`url(#${id}-b3t)`}>
      <rect ...${box} fill=${shirt} />
      <g transform=${geo.torso}>${costume ? costume.torso?.(ctx) : outfit?.render?.(ctx)}</g>
    </g>
    <g mask=${`url(#${id}-b3a)`}>
      <rect ...${box} fill=${sleeve} />
      ${costume?.sleeves && geo.arms.map((a) => {
        const oldX = isRight(a) ? 137 : 43;
        const side = isRight(a) ? 'r' : 'l';
        // Aussi larges que la manche (le masque du tissu fait le bord exact), chaque moitié découpée à son segment
        return html`<g key=${a.key}>
          <g clip-path=${`url(#${id}-b3u${a.key})`}><g transform=${sleeveMatrix(oldX, 188, 214, a.top, a.E, a.ru * 2.5, side)}>${costume.sleeves(ctx, oldX)}</g></g>
          <g clip-path=${`url(#${id}-b3o${a.key})`}><g transform=${sleeveMatrix(oldX, 214, 234, a.E, a.W, a.rf * 2.6, side)}>${costume.sleeves(ctx, oldX)}</g></g>
        </g>`;
      })}
    </g>
    ${gloves && html`<g mask=${`url(#${id}-b3h)`}><rect ...${box} fill=${gloves} /></g>`}
    <image href=${maps.shade} ...${box} mask=${`url(#${id}-b3c)`} style="mix-blend-mode:multiply" />
    ${gloves && html`<image href=${maps.shade} ...${box} mask=${`url(#${id}-b3h)`} style="mix-blend-mode:multiply" />`}
  </g>`;

  return html`<g class="av-body3d">
    <defs>
      <mask id=${`${id}-b3c`} ...${region}><image href=${maps.cloth} ...${box} /></mask>
      <clipPath id=${`${id}-b3ac`}><path d=${sleeves} /></clipPath>
      ${costume?.sleeves && geo.arms.map((a) => html`<g key=${a.key}>
        <clipPath id=${`${id}-b3u${a.key}`}><path d=${a.upper} /></clipPath>
        <clipPath id=${`${id}-b3o${a.key}`}><path d=${a.lower} /></clipPath>
      </g>`)}
      <mask id=${`${id}-b3a`} ...${region}><g clip-path=${`url(#${id}-b3ac)`}><image href=${maps.cloth} ...${box} /></g></mask>
      <mask id=${`${id}-b3t`} ...${region}><image href=${maps.cloth} ...${box} /><path d=${sleeves} fill="#000" /></mask>
      ${gloves && html`<clipPath id=${`${id}-b3hc`}>${geo.arms.map((a) => html`<circle key=${a.key} cx=${f(a.H[0])} cy=${f(a.H[1])} r=${f(a.rh * 1.15)} />`)}</clipPath>
        <mask id=${`${id}-b3h`} ...${region}><g clip-path=${`url(#${id}-b3hc)`}><image href=${maps.skinMask} ...${box} /></g></mask>`}
      ${articulated && html`<mask id=${`${id}-b3base`} ...${region}>
          <rect ...${box} fill="#fff" />${geo.arms.map((a) => html`<path key=${a.key} d=${a.fore} fill="#000" />`)}
        </mask>
        ${geo.arms.map((a) => html`<clipPath key=${a.key} id=${`${id}-b3f${a.key}`}><path d=${a.fore} /></clipPath>`)}`}
    </defs>
    ${backs.map((b, i) => html`<g key=${i} class="av-back" transform=${geo.torso}>${b}</g>`)}
    <g mask=${cut}>
      ${articulated
        ? html`<g mask=${`url(#${id}-b3base)`}>${stack('base')}</g>
          ${geo.arms.map((a) => html`<g key=${a.key} class=${`av-fore3d av-fore3d-${a.key}`} style=${{ transformBox: 'view-box', transformOrigin: `${f(a.E[0])}px ${f(a.E[1])}px` }}>
            <g clip-path=${`url(#${id}-b3f${a.key})`}>${stack(a.key)}</g>
          </g>`)}`
        : stack('all')}
      <g transform=${geo.torso}>
        ${costume?.collar?.(ctx)}
        ${neckItem && html`<g class="av-neck">${neckItem.render(ctx)}</g>`}
        ${costume?.over && html`<g class="av-costume-over">${costume.over(ctx)}</g>`}
      </g>
    </g>
  </g>`;
}
