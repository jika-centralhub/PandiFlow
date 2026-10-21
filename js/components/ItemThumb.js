// Vignette d'un objet seul (boutique, affaires, défis).
import { html, useMemo } from '../vendor/preact-htm.js';
import { DEFAULT_LOOK, SKIN_TONES, OUTFIT_COLORS } from '../avatar/palette.js';
import { Avatar } from '../avatar/Avatar.js';
import { TORSO } from '../avatar/body.js';
import { shade } from '../lib/util.js';

let n = 0;

const GARAGE_BOX = { vehicle: '6 56 216 128', flag: '186 26 60 50', gear: '4 110 80 74', yard: '96 20 148 164', judaica: '4 90 80 92' };

const BOX = {
  hat: '24 -48 176 140',
  face: '36 76 128 56',
  neck: '58 166 84 72',
  back: '-14 140 228 130',
  outfit: '48 176 104 90',
  pet: '128 158 84 84',
  bg: '-20 -44 240 298',
  fx: '-20 -44 240 298',
  magic: '-44 -54 88 100',
};

export function ItemThumb({ item, look = DEFAULT_LOOK }) {
  const id = useMemo(() => `th${++n}`, []);
  if (!item) return null;
  // Un costume complet se montre porté par l'enfant
  if (item.slot === 'skin') return html`<${Avatar} look=${look} equipped=${{ skin: item.id }} mode="bust" seed=${item.id} />`;
  // Petit objet sur la tête (kippa) : il se montre porté, sinon il paraîtrait perdu dans la vignette
  if (item.wornThumb === 'head') return html`<${Avatar} look=${look} equipped=${{ [item.slot]: item.id }} mode="head" still=${true} seed=${item.id} />`;
  if (item.garage) {
    return html`<svg class="item-thumb garage-thumb" viewBox=${item.box || GARAGE_BOX[item.slot]} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${item.render({ id, thumb: true })}</svg>`;
  }
  const ctx = {
    id,
    look,
    skin: SKIN_TONES[look.skin]?.color || '#F1C4A3',
    outfit: OUTFIT_COLORS[look.outfit]?.color || '#4D8DF7',
    crown: 26,
    hatScale: 1,
    thumb: true,
  };
  const box = item.slot === 'hat' && item.free ? '14 14 172 172' : item.id === 'aureole' ? '50 -10 100 40' : BOX[item.slot];
  return html`<svg class="item-thumb avatar overflow" viewBox=${box} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${item.slot === 'outfit' && html`<defs><clipPath id=${`${id}-t`}><path d=${TORSO} /></clipPath></defs>
      <path d=${TORSO} fill=${item.color || '#7FA8D9'} stroke=${shade(item.color || '#7FA8D9', -0.3)} stroke-width="2" />`}
    ${item.slot === 'fx' && item.id !== 'aureole' && html`<circle cx="100" cy="105" r="70" fill="#2b2368" opacity="0.85" />`}
    ${item.slot === 'outfit' ? html`<g clip-path=${`url(#${id}-t)`}>${item.render(ctx)}</g>` : item.render(ctx)}
  </svg>`;
}
