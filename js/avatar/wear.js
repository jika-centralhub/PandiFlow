// Ce que l'enfant porte. Hors de la tête : un objet par emplacement, comme avant. Sur la tête, plusieurs
// objets à la fois tant qu'ils ne se gênent pas : chaque objet occupe des zones, et deux objets qui
// partagent une zone ne se portent pas ensemble (des lunettes et un masque sur les yeux ; une casquette et
// une kippa sur le sommet), alors qu'une kippa va avec des lunettes, ou des lunettes avec une moustache.
//
// Rangement (children.equipped) : equipped.hat et equipped.face gardent le dernier objet mis de chaque
// emplacement (ce que lisaient les anciennes versions de l'app), equipped.head les autres objets de la
// tête. À la lecture, le plus récent gagne en cas de conflit : une ancienne version qui change
// equipped.hat ne fait jamais porter deux objets incompatibles.
import { getItem } from './items.js';

export const HEAD_SLOTS = ['hat', 'face'];
export const HEAD_ZONES = ['serre-tete', 'sommet', 'yeux', 'bouche'];

// Zones par défaut : un chapeau couvre tout le dessus de la tête, un objet du visage les yeux.
// Les objets plus petits le précisent dans items.js (zones: [...]).
export function zonesOf(item) {
  if (!item) return [];
  if (item.zones) return item.zones;
  if (item.slot === 'hat') return ['sommet', 'serre-tete'];
  if (item.slot === 'face') return ['yeux'];
  return [];
}

export const isHead = (item) => Boolean(item && HEAD_SLOTS.includes(item.slot));

export function conflict(a, b) {
  if (!a || !b || a.id === b.id) return false;
  if (isHead(a) && isHead(b)) {
    const za = zonesOf(a);
    return zonesOf(b).some((z) => za.includes(z));
  }
  return a.slot === b.slot;
}

// Les objets de la tête portés, du plus récent au plus ancien, sans conflit entre eux
export function headItems(equipped) {
  const e = equipped || {};
  const ids = [e.hat, e.face, ...(Array.isArray(e.head) ? e.head : [])];
  const out = [];
  for (const id of ids) {
    const it = id && getItem(id);
    if (!isHead(it) || out.some((k) => k.id === it.id || conflict(k, it))) continue;
    out.push(it);
  }
  return out;
}

export function isWorn(equipped, item) {
  if (!item) return false;
  if (isHead(item)) return headItems(equipped).some((it) => it.id === item.id);
  return equipped?.[item.slot] === item.id;
}

// list : du plus ancien au plus récent
function pack(equipped, list) {
  const out = { ...(equipped || {}) };
  delete out.hat;
  delete out.face;
  delete out.head;
  const last = (slot) => [...list].reverse().find((it) => it.slot === slot);
  const hat = last('hat');
  const face = last('face');
  if (hat) out.hat = hat.id;
  if (face) out.face = face.id;
  const rest = list.filter((it) => it !== hat && it !== face).map((it) => it.id);
  if (rest.length) out.head = rest;
  return out;
}

// Mettre un objet : il retire seulement ce qui le gêne
export function wear(equipped, item) {
  if (!item) return { ...(equipped || {}) };
  if (!isHead(item)) return { ...(equipped || {}), [item.slot]: item.id };
  const keep = headItems(equipped).filter((it) => it.id !== item.id && !conflict(it, item)).reverse();
  return pack(equipped, [...keep, item]);
}

// Les objets qu'un objet retirerait si on le mettait (pour prévenir l'enfant)
export const wouldRemove = (equipped, item) => (isHead(item) ? headItems(equipped).filter((it) => conflict(it, item)) : []);

export function unwear(equipped, item) {
  if (!item) return { ...(equipped || {}) };
  if (!isHead(item)) {
    const out = { ...(equipped || {}) };
    if (out[item.slot] === item.id) delete out[item.slot];
    return out;
  }
  return pack(equipped, headItems(equipped).filter((it) => it.id !== item.id).reverse());
}

// Ce que l'avatar porte, essai de la boutique compris (tryOn : { slot, itemId })
export function withTryOn(equipped, tryOn) {
  const item = tryOn?.itemId ? getItem(tryOn.itemId) : null;
  return item ? wear(equipped, item) : equipped || {};
}
