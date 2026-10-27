// Catalogue des thèmes de la boutique. Un thème met en vitrine des objets qui existent déjà dans leurs
// rayons (ils y restent, avant comme après) ; il habille Pandi (accessoires 3D de js/mascot/gear.js) et
// donne son décor à la scène de l'enfant quand il n'en a pas choisi.
// Règles du panel : pas de compte à rebours, pas de « dernier jour », pas de compteur de collection.
import { getItem, offeredTo, shopItems } from './items.js';
import { sexOf } from '../domain.js';

export const GIFT_MAX = 60; // le cadeau d'entrée vaut 60 pandi au plus, quel que soit l'âge
export const GIFT_CHOICES = 3;

export const THEME_CATALOG = [
  {
    id: 'espace',
    name: 'Espace',
    emoji: '🚀',
    color: '#5B6CFF',
    intro: 'Pandi vous invite dans l’espace ! Un cadeau pour chacun, pour commencer.',
    // du moins cher au plus cher : des objets à portée du petit, puis un « grand rêve »
    items: ['etoiles', 'pyjama_etoiles', 'pyjama_fusee', 'astronaute', 'telescope', 'espace', 'astronaute_combi', 'fusee'],
    gifts: ['etoiles', 'pyjama_etoiles', 'pyjama_fusee'],
    pandi: { tete: 'antennes', dos: 'jetpack' },
    scene: 'fond_espace',
  },
];

export const getTheme = (id) => THEME_CATALOG.find((t) => t.id === id) || null;

// Les objets de la vitrine que l'enfant peut voir (selon le sexe) ; ceux qu'il a déjà sont signalés
export const vitrineItems = (theme, child) => (theme?.items || []).map(getItem).filter((it) => it && offeredTo(it, sexOf(child)));

// Les trois cadeaux proposés : ceux du thème, sinon d'autres objets du thème, puis de la boutique,
// toujours à 60 pandi au plus, jamais un objet que l'enfant a déjà
export function giftOptions(theme, child, owned) {
  const sex = sexOf(child);
  const ok = (it) => it && !it.exclusive && it.price > 0 && it.price <= GIFT_MAX && offeredTo(it, sex) && !owned.has(it.id);
  const out = [];
  const add = (it) => ok(it) && !out.some((x) => x.id === it.id) && out.push(it);
  (theme?.gifts || []).map(getItem).forEach(add);
  (theme?.items || []).map(getItem).forEach(add);
  shopItems().filter(ok).sort((a, b) => b.price - a.price).forEach(add);
  return out.slice(0, GIFT_CHOICES);
}

// La tenue de Pandi pendant les thèmes, par période (pour js/mascot/themeLook.js)
export const themeLooks = (themes) => (themes || []).map((t) => ({ start: t.start, end: t.end, look: getTheme(t.theme)?.pandi })).filter((r) => r.look);
