// Catalogue des thèmes de la boutique. Un thème met en vitrine des objets qui existent déjà dans leurs
// rayons ; pendant le thème, la boutique ne montre que cette vitrine, puis tous les rayons reviennent
// (les objets du thème y restent) ; il habille Pandi (accessoires 3D de js/mascot/gear.js) et
// donne son décor à la scène de l'enfant (son décor à lui revient à la fin, avec la tenue qu'il avait
// au début du thème).
// Règles du panel : pas de compte à rebours, pas de « dernier jour », pas de compteur de collection.
import { getItem, offeredTo, shopItems } from './items.js';
import { sexOf, themeOn, themeDay } from '../domain.js';

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
    // « Le savais-tu ? » à la fin de chaque routine, le même pour tous les enfants : un par jour du thème
    facts: {
      matin: [
        { emoji: '☀️', text: 'Le Soleil est une étoile ! C’est l’étoile la plus proche de nous : c’est pour ça qu’elle nous paraît si grosse et qu’elle nous éclaire le jour.' },
        { emoji: '🌍', text: 'La Terre tourne sur elle-même comme une toupie : un tour complet prend une journée. Quand notre côté de la Terre regarde le Soleil, c’est le jour !' },
        { emoji: '🚀', text: 'Une fusée va très, très vite : il lui faut moins de 10 minutes pour monter dans l’espace.' },
        { emoji: '🧑‍🚀', text: 'La Station spatiale fait le tour de la Terre en une heure et demie. Ses astronautes voient le Soleil se lever 16 fois par jour !' },
        { emoji: '🪐', text: 'Jupiter est la plus grosse planète autour du Soleil : on pourrait mettre plus de 1 000 Terres dedans !' },
        { emoji: '🔴', text: 'Mars est rouge parce que son sol est couvert de poussière de rouille, comme un vieux clou resté sous la pluie.' },
        { emoji: '👣', text: 'Sur la Lune, il n’y a ni vent ni pluie : les traces de pas des astronautes sont toujours là, plus de 50 ans après.' },
      ],
      soir: [
        { emoji: '🌙', text: 'La Lune ne brille pas toute seule : c’est le Soleil qui l’éclaire, et elle nous renvoie sa lumière.' },
        { emoji: '⭐', text: 'Les étoiles sont aussi là pendant la journée ! On ne les voit pas parce que le Soleil éclaire trop le ciel.' },
        { emoji: '💤', text: 'Dans la Station spatiale, les astronautes dorment attachés dans un sac de couchage. Sinon, ils flotteraient partout pendant la nuit !' },
        { emoji: '🌌', text: 'Notre galaxie s’appelle la Voie lactée. Elle a des milliards d’étoiles, et notre Soleil n’est que l’une d’elles.' },
        { emoji: '🪐', text: 'Les anneaux de Saturne sont faits de milliards de morceaux de glace et de cailloux : certains sont petits comme des grains de sable, d’autres grands comme une maison.' },
        { emoji: '🌠', text: 'Une étoile filante n’est pas une étoile : c’est un petit caillou venu de l’espace qui brûle en entrant dans l’air, et ça fait un trait de lumière.' },
        { emoji: '🔭', text: 'Quand tu regardes une étoile, tu vois une lumière partie d’elle il y a très longtemps, parfois avant même la naissance de tes grands-parents !' },
      ],
    },
  },
];

export const getTheme = (id) => THEME_CATALOG.find((t) => t.id === id) || null;

// Les objets de la vitrine que l'enfant peut voir (selon le sexe) ; ceux qu'il a déjà sont signalés
export const vitrineItems = (theme, child) => (theme?.items || []).map(getItem).filter((it) => it && offeredTo(it, sexOf(child)));

// Pendant le thème, la scène garde le décor du thème : les autres décors attendent la fin du thème
export const waitsForTheme = (theme, item) => Boolean(theme && item?.slot === 'bg' && !theme.items.includes(item.id));

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

// La tenue de Pandi pendant les thèmes, par période (pour js/mascot/themeLook.js) : seulement ceux qui ont lieu
export const themeLooks = (themes) => (themes || []).filter(themeOn).map((t) => ({ start: t.start, end: t.end, look: getTheme(t.theme)?.pandi })).filter((r) => r.look);

// Le « Le savais-tu ? » de cette routine (matin ou soir) ce jour-là du thème
export function funFact(entry, routine, date) {
  const list = getTheme(entry?.theme)?.facts?.[routine];
  return list?.length ? list[themeDay(entry, date) % list.length] : null;
}
