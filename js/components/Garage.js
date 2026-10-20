// La scène à côté de l'avatar : jardin, drapeau, véhicule et accessoire que l'enfant a choisis.
import { html, useMemo } from '../vendor/preact-htm.js';
import { getItem } from '../avatar/items.js';
import { SCENE_ORDER } from '../avatar/garage.js';

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

export function Garage({ equipped, tryOn = null, class: cls = '' }) {
  const id = useMemo(() => `ga${++n}`, []);
  const items = garageItems(equipped, tryOn);
  if (!Object.keys(items).length) return null;
  return html`<svg class=${`garage ${cls}`} viewBox="0 0 240 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Véhicules et accessoires">
    ${SCENE_ORDER.map((slot) => items[slot] && html`<g key=${`${slot}-${items[slot].id}`} class=${`ga-item ga-${slot}`}>${items[slot].render({ id: `${id}-${slot}` })}</g>`)}
  </svg>`;
}
