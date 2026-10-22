// Images 3D façon film d'animation des objets, dans le même style que les enfants : créées une fois par
// tools/make-item-art.ps1, détourées par tools/make_item_art.py et rangées dans assets/items/.
// Un objet qui a une place pour son image (art) et dont l'image existe (ART) s'affiche en image ;
// sinon il garde son dessin (drawn).
//   art : { cx, bottom, w | h, shadow, cls, ride, over }
//     cx, bottom : milieu et bas de l'image dans le repère du dessin (sol de la scène du garage à y = 178,
//       haut du crâne à y = 26 pour un chapeau)
//     w ou h : sa largeur ou sa hauteur, l'autre suit les proportions de l'image
//     shadow : l'ombre posée au sol sous l'objet (voir shadow ; 0 : pas d'ombre)
//     cls : son animation permanente (veh-bob…)
//     ride : la place de l'enfant dans le véhicule, dans le repère du dessin (voir RIDES dans KidScene.js)
//     over(ctx) : ce qui se dessine par-dessus l'image (lettres qui s'envolent…)
import { html } from '../vendor/preact-htm.js';
import { ART } from './art-list.js';

export const hasArt = (id) => Boolean(ART[id]);
export const artSize = (id) => ART[id] || null;
export const artSrc = (id, thumb = false) => new URL(`../../assets/items/${thumb ? 'thumb/' : ''}${id}.webp`, import.meta.url).href;

// Rectangle de l'image dans le repère du dessin
export function artBox(id, art) {
  const [pw, ph] = ART[id];
  const w = art.w ?? (art.h * pw) / ph;
  const h = art.h ?? (art.w * ph) / pw;
  return { x: art.cx - w / 2, y: art.bottom - h, w, h };
}

export const artImage = (id, art, thumb = false) => {
  const b = artBox(id, art);
  return html`<image class="art" href=${artSrc(id, thumb)} x=${b.x.toFixed(2)} y=${b.y.toFixed(2)} width=${b.w.toFixed(2)} height=${b.h.toFixed(2)} preserveAspectRatio="none" />`;
};

// Ombre au sol : demi-largeur seule, ou { rx, ry, dx, dy } pour un objet vu de trois quarts (roues
// arrière plus haut dans l'image)
function shadow({ cx, bottom, shadow: s }) {
  const { rx, ry = Math.max(2.4, rx * 0.08), dx = 0, dy = 0 } = typeof s === 'number' ? { rx: s } : s;
  return html`<ellipse cx=${cx + dx} cy=${bottom + 0.6 + dy} rx=${rx} ry=${ry} fill="#000" opacity="0.18" />`;
}

export function withArt(item) {
  const { art } = item;
  if (!art || !ART[item.id]) return item;
  const b = artBox(item.id, art);
  const pad = 4;
  return {
    ...item,
    drawn: item.render,
    // Les objets de la scène se cadrent (vignette, caméra) sur leur image
    box: item.garage ? [b.x - pad, b.y - pad, b.w + 2 * pad, b.h + 2 * pad].map((v) => Number(v.toFixed(1))).join(' ') : item.box,
    ride: art.ride || null,
    render: (ctx = {}) => html`<g class="art-item">
      ${art.shadow ? shadow(art) : null}
      ${art.cls ? html`<g class=${art.cls}>${artImage(item.id, art, ctx.thumb)}</g>` : artImage(item.id, art, ctx.thumb)}
      ${art.over?.(ctx)}
    </g>`,
  };
}
