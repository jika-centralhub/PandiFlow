// Images 3D façon film d'animation des objets, dans le même style que les enfants : créées une fois
// (tools/item-art.json), détourées par tools/make_item_art.py et rangées dans assets/items/.
// Un objet qui a une place pour son image (art, ou sa ligne dans art-place.js) et dont l'image existe
// (ART) s'affiche en image ; sinon il garde son dessin (drawn).
//   art : { img, cx, bottom, w | h, cover, shadow, cls, ride, under, over }
//     img : nom de l'image (par défaut l'identifiant de l'objet)
//     cx, bottom : milieu et bas de l'image dans le repère du dessin (sol de la scène du garage à y = 178,
//       haut du crâne à y = 26 pour un chapeau)
//     w ou h : sa largeur ou sa hauteur, l'autre suit les proportions de l'image
//     cover : { x, y, w, h } que l'image couvre entièrement, rognée au besoin (décors)
//     shadow : l'ombre posée au sol sous l'objet (voir shadow ; 0 : pas d'ombre)
//     cls : son animation permanente (veh-bob…)
//     ride : la place de l'enfant dans le véhicule, dans le repère du dessin (voir RIDES dans KidScene.js)
//     under(ctx), over(ctx) : ce qui se dessine derrière ou par-dessus l'image (flammes, lettres qui s'envolent…)
import { html } from '../vendor/preact-htm.js';
import { ART } from './art-list.js';
import { PLACE } from './art-place.js';

export const hasArt = (id) => Boolean(ART[id]);
export const artSize = (id) => ART[id] || null;
export const artSrc = (id, thumb = false) => new URL(`../../assets/items/${thumb ? 'thumb/' : ''}${id}.webp`, import.meta.url).href;

// Rectangle de l'image dans le repère du dessin
export function artBox(id, art) {
  if (art.cover) return art.cover;
  const [pw, ph] = ART[id];
  const w = art.w ?? (art.h * pw) / ph;
  const h = art.h ?? (art.w * ph) / pw;
  return { x: art.cx - w / 2, y: art.bottom - h, w, h };
}

export const artImage = (id, art, thumb = false) => {
  const b = artBox(id, art);
  return html`<image class="art" href=${artSrc(id, thumb)} x=${b.x.toFixed(2)} y=${b.y.toFixed(2)} width=${b.w.toFixed(2)} height=${b.h.toFixed(2)}
    preserveAspectRatio=${art.cover ? 'xMidYMid slice' : 'none'} />`;
};

// Ombre au sol : demi-largeur seule, ou { rx, ry, dx, dy } pour un objet vu de trois quarts (roues
// arrière plus haut dans l'image)
function shadow({ cx, bottom, shadow: s }) {
  const { rx, ry = Math.max(2.4, rx * 0.08), dx = 0, dy = 0 } = typeof s === 'number' ? { rx: s } : s;
  return html`<ellipse cx=${cx + dx} cy=${bottom + 0.6 + dy} rx=${rx} ry=${ry} fill="#000" opacity="0.18" />`;
}

export const placeOf = (item) => item.art || PLACE[`${item.slot}/${item.id}`] || PLACE[item.id] || null;

export function withArt(item) {
  const art = placeOf(item);
  const img = art?.img || item.id;
  if (!art || !ART[img]) return item;
  const b = artBox(img, art);
  const pad = 4;
  return {
    ...item,
    art,
    drawn: item.render,
    // Les objets de la scène se cadrent (vignette, caméra) sur leur image
    box: item.garage ? [b.x - pad, b.y - pad, b.w + 2 * pad, b.h + 2 * pad].map((v) => Number(v.toFixed(1))).join(' ') : item.box,
    ride: art.ride || null,
    render: (ctx = {}) => html`<g class="art-item">
      ${art.shadow ? shadow(art) : null}
      ${art.under?.(ctx)}
      ${art.cls ? html`<g class=${art.cls}>${artImage(img, art, ctx.thumb)}</g>` : artImage(img, art, ctx.thumb)}
      ${art.over?.(ctx)}
    </g>`,
  };
}
