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
  // L'astronaute (identifiant 'espace' gardé : c'est celui des thèmes déjà enregistrés par les familles)
  {
    id: 'espace',
    name: 'Astronaute',
    emoji: '🧑‍🚀',
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
  {
    id: 'magicien',
    name: 'Magicien',
    emoji: '🪄',
    color: '#8B5CF6',
    intro: 'Pandi vous invite dans la forêt des magiciens ! Un cadeau pour chacun, pour commencer.',
    items: ['baguette', 'sorcier', 'chaudron', 'etincelles', 'hibou', 'magicien', 'foret', 'licorne'],
    gifts: ['baguette', 'sorcier', 'chaudron'],
    pandi: { tete: 'chapeau_magicien' },
    scene: 'fond_foret',
    facts: {
      matin: [
        { emoji: '🦉', text: 'Le hibou peut tourner la tête presque jusque dans son dos ! Ses yeux ne bougent pas : c’est sa tête qui tourne pour regarder autour de lui.' },
        { emoji: '🌈', text: 'Un arc-en-ciel apparaît quand le soleil brille à travers les gouttes de pluie : chaque goutte sépare la lumière en couleurs.' },
        { emoji: '🍄', text: 'Les champignons ne sont ni des plantes ni des animaux : ils forment une famille à eux tout seuls !' },
        { emoji: '🧲', text: 'Un aimant attire le fer sans le toucher. On dirait de la magie, mais c’est une force invisible qui s’appelle le magnétisme.' },
        { emoji: '✨', text: 'Les lucioles fabriquent leur propre lumière, dans leur ventre ! Elles clignotent pour se parler entre elles.' },
        { emoji: '🎩', text: 'Les magiciens ne font pas de vraie magie : ils font des tours. Leur secret, c’est de s’entraîner encore et encore, jusqu’à ce que ce soit parfait.' },
        { emoji: '🌳', text: 'Certains arbres vivent plus de mille ans ! Ils étaient déjà là bien avant les châteaux et les chevaliers.' },
      ],
      soir: [
        { emoji: '🌙', text: 'Le hibou chasse la nuit. Il vole sans faire aucun bruit, grâce à ses plumes toutes douces.' },
        { emoji: '🥄', text: 'Mets une cuillère dans un verre d’eau : elle a l’air cassée ! C’est la lumière qui se tord en passant dans l’eau. Une vraie illusion.' },
        { emoji: '🦋', text: 'Une chenille s’enferme dans un cocon et en ressort papillon : la nature fait de vraies transformations !' },
        { emoji: '🃏', text: 'Pendant qu’une main du magicien attire ton regard, l’autre fait le tour en cachette : on appelle ça détourner l’attention.' },
        { emoji: '🌿', text: 'Les plantes boivent par leurs racines : l’eau monte dans la tige jusqu’aux feuilles, comme dans une paille.' },
        { emoji: '🍂', text: 'En automne, le vert des feuilles s’en va et laisse voir le jaune et l’orange qui étaient cachés dedans depuis le début.' },
        { emoji: '💤', text: 'Pendant que tu dors, ton cerveau range tout ce que tu as appris dans la journée, comme un magicien qui range ses tours dans sa malle.' },
      ],
    },
  },
  {
    id: 'plongeur',
    name: 'Plongeur',
    emoji: '🤿',
    color: '#1FA2C9',
    intro: 'Pandi vous emmène plonger au fond de la mer ! Un cadeau pour chacun, pour commencer.',
    items: ['masque_plongee', 'bouteille_plongee', 'tortue', 'ocean', 'bateau', 'sous_marin'],
    gifts: ['masque_plongee', 'bouteille_plongee', 'tortue'],
    pandi: { yeux: 'masque_plongee' },
    scene: 'fond_ocean',
    facts: {
      matin: [
        { emoji: '🐙', text: 'La pieuvre a huit bras et trois cœurs ! Quand elle a peur, elle lâche un nuage d’encre pour se cacher.' },
        { emoji: '🐢', text: 'Les tortues de mer existaient déjà au temps des dinosaures !' },
        { emoji: '🐋', text: 'La baleine bleue est le plus grand animal du monde : elle est plus longue que deux autobus mis bout à bout !' },
        { emoji: '🐠', text: 'Les poissons respirent sous l’eau avec leurs branchies : elles attrapent l’oxygène caché dans l’eau.' },
        { emoji: '🌊', text: 'La mer est salée parce que les rivières y apportent un tout petit peu de sel, depuis des millions d’années.' },
        { emoji: '🦈', text: 'Les requins perdent leurs dents tout le temps, mais une nouvelle dent repousse à chaque fois, toute leur vie !' },
        { emoji: '🤿', text: 'Sous l’eau, le plongeur respire grâce aux bouteilles qu’il porte sur le dos : elles sont remplies d’air.' },
      ],
      soir: [
        { emoji: '🐬', text: 'Les dauphins dorment avec un seul côté du cerveau à la fois : l’autre côté reste réveillé pour remonter respirer.' },
        { emoji: '⭐', text: 'L’étoile de mer n’est pas un poisson ! Et si elle perd un bras, il repousse.' },
        { emoji: '🐡', text: 'Tout au fond de la mer, il fait tout noir : certains poissons fabriquent leur propre lumière pour y voir.' },
        { emoji: '🦀', text: 'Le bernard-l’ermite habite dans une coquille vide. Quand il grandit, il déménage dans une coquille plus grande !' },
        { emoji: '🐳', text: 'Certaines baleines chantent ! Leurs chansons s’entendent très loin sous l’eau.' },
        { emoji: '🐚', text: 'Le coquillage est la maison d’un petit animal tout mou : c’est lui qui la fabrique, petit à petit.' },
        { emoji: '🌙', text: 'C’est la Lune qui fait monter et descendre la mer deux fois par jour : on appelle ça la marée.' },
      ],
    },
  },
  {
    id: 'chevalier',
    name: 'Chevalier',
    emoji: '🛡️',
    color: '#2F5FC4',
    intro: 'Pandi vous ouvre les portes de son château fort ! Un cadeau pour chacun, pour commencer.',
    items: ['epee_bouclier', 'casque_chevalier', 'cape', 'couronne', 'chevalier', 'chateau_fort', 'poney', 'dragon_monture'],
    gifts: ['epee_bouclier', 'casque_chevalier', 'cape'],
    pandi: { tete: 'heaume' },
    scene: 'fond_chateau_fort',
    facts: {
      matin: [
        { emoji: '🏰', text: 'Autour du château fort, il y avait souvent un fossé rempli d’eau, les douves, et un pont-levis qu’on relevait pour fermer l’entrée.' },
        { emoji: '🛡️', text: 'Les chevaliers peignaient des couleurs et des animaux sur leur bouclier : comme ça, on les reconnaissait même avec leur casque.' },
        { emoji: '🐴', text: 'Le grand cheval du chevalier s’appelait un destrier. Il était très fort, pour porter le chevalier et son armure.' },
        { emoji: '🧒', text: 'Pour devenir chevalier, un enfant commençait comme page, vers 7 ans : il apprenait à monter à cheval et à être poli avec tout le monde.' },
        { emoji: '⚔️', text: 'Une armure complète pesait à peu près autant qu’un enfant de 6 ans ! Les chevaliers s’entraînaient pour courir et sauter avec.' },
        { emoji: '🎺', text: 'Dans un tournoi, deux chevaliers galopaient l’un vers l’autre avec une longue lance en bois, pour faire tomber l’autre de son cheval : c’était la joute.' },
        { emoji: '🪨', text: 'Les châteaux forts étaient construits pierre après pierre : il fallait parfois des dizaines d’années pour en finir un !' },
      ],
      soir: [
        { emoji: '🕯️', text: 'Au temps des chevaliers, il n’y avait pas d’électricité : le soir, on s’éclairait avec des bougies et le feu de la cheminée.' },
        { emoji: '📜', text: 'Les chevaliers promettaient d’être courageux, de dire la vérité et de protéger les plus petits.' },
        { emoji: '👑', text: 'Pour faire de quelqu’un un chevalier, le seigneur lui touchait l’épaule avec son épée : on appelait ça l’adoubement.' },
        { emoji: '🐉', text: 'Les dragons des histoires n’ont jamais existé ! Mais il existe un vrai grand lézard qu’on appelle le dragon de Komodo.' },
        { emoji: '🍞', text: 'Au château, on mangeait souvent avec les doigts, sur une grosse tranche de pain qui servait d’assiette.' },
        { emoji: '🎶', text: 'Le soir au château, des musiciens et des conteurs venaient chanter et raconter des histoires à tout le monde.' },
        { emoji: '🌙', text: 'La nuit, des gardes veillaient en haut des tours, pour que tout le château dorme tranquille.' },
      ],
    },
  },
  {
    id: 'cowboy',
    name: 'Cow-boy',
    emoji: '🤠',
    color: '#C9773A',
    intro: 'Pandi vous emmène au Far West ! Un cadeau pour chacun, pour commencer.',
    items: ['etoile_sherif', 'lasso', 'chapeau_cowboy', 'cowboy', 'farwest', 'poney'],
    gifts: ['etoile_sherif', 'lasso', 'chapeau_cowboy'],
    pandi: { tete: 'cowboy' },
    scene: 'fond_farwest',
    facts: {
      matin: [
        { emoji: '🐄', text: 'Le travail des cow-boys, c’était de s’occuper des vaches : ils les guidaient à cheval sur de très, très longs chemins.' },
        { emoji: '🤠', text: 'Le grand chapeau du cow-boy le protégeait du soleil et de la pluie : ses grands bords faisaient de l’ombre sur ses yeux et sur son cou.' },
        { emoji: '🐴', text: 'Un cheval peut dormir debout ! Ses jambes se bloquent toutes seules pour qu’il ne tombe pas.' },
        { emoji: '🌵', text: 'Le cactus garde l’eau dans sa tige pour tenir longtemps sans pluie. Et ses piquants sont en fait ses feuilles !' },
        { emoji: '🪢', text: 'Avec son lasso, une longue corde avec une boucle au bout, le cow-boy attrapait les vaches qui s’échappaient.' },
        { emoji: '👢', text: 'Les bottes de cow-boy ont un talon : il empêche le pied de glisser de l’étrier quand on est à cheval.' },
        { emoji: '⭐', text: 'Le shérif faisait respecter la loi dans la ville. On le reconnaissait à l’étoile sur sa poitrine.' },
      ],
      soir: [
        { emoji: '🔥', text: 'Le soir, les cow-boys dormaient dehors, autour d’un feu de camp, sous les étoiles.' },
        { emoji: '🐺', text: 'Le soir dans le désert, on entend le coyote hurler de loin. C’est un cousin du chien !' },
        { emoji: '🎵', text: 'La nuit, les cow-boys chantaient doucement pour calmer les vaches et les aider à dormir.' },
        { emoji: '🐎', text: 'Un bébé cheval s’appelle un poulain. Il sait marcher quelques heures seulement après sa naissance !' },
        { emoji: '🌄', text: 'Dans le désert, il fait très chaud le jour, mais la nuit, il peut faire très froid.' },
        { emoji: '🦉', text: 'Dans le Far West vit une petite chouette qui habite dans un trou creusé dans la terre, au lieu d’un arbre !' },
        { emoji: '✨', text: 'Dans le désert, il n’y a pas de lampadaires : la nuit, on y voit des milliers d’étoiles.' },
      ],
    },
  },
  {
    id: 'cuisinier',
    name: 'Cuisinier',
    emoji: '🧑‍🍳',
    color: '#E2483A',
    intro: 'Pandi vous ouvre sa cuisine de chef ! Un cadeau pour chacun, pour commencer.',
    items: ['moustache', 'toque', 'ustensiles', 'gateau_etages', 'chef', 'cuisine'],
    gifts: ['toque', 'ustensiles', 'gateau_etages'],
    pandi: { tete: 'toque' },
    scene: 'fond_cuisine',
    facts: {
      matin: [
        { emoji: '🍞', text: 'Le pain gonfle grâce à la levure : de tout petits êtres vivants qui fabriquent des bulles dans la pâte.' },
        { emoji: '🍯', text: 'Le miel peut se garder des centaines d’années sans s’abîmer ! Les abeilles le fabriquent avec le nectar des fleurs.' },
        { emoji: '🥕', text: 'Il y a très longtemps, les carottes n’étaient pas orange : elles étaient surtout violettes ou jaunes !' },
        { emoji: '🍓', text: 'Les petits points jaunes sur la fraise sont ses graines : une fraise en a environ deux cents !' },
        { emoji: '🧑‍🍳', text: 'Le chef porte une toque : elle retient ses cheveux, pour qu’aucun ne tombe dans les plats !' },
        { emoji: '🥚', text: 'Mets un œuf dans un verre d’eau : s’il est frais, il coule au fond ; s’il est vieux, il flotte.' },
        { emoji: '🍫', text: 'Le chocolat est fait avec les graines d’un arbre, le cacaoyer. Elles poussent dans de gros fruits qu’on appelle des cabosses.' },
      ],
      soir: [
        { emoji: '🥛', text: 'Avec le lait de la vache, on fabrique aussi le beurre, les yaourts et le fromage !' },
        { emoji: '🍝', text: 'Les pâtes sont faites avec de la farine et de l’eau, et parfois des œufs. C’est tout !' },
        { emoji: '🍎', text: 'Une pomme coupée devient marron à l’air. Avec un peu de jus de citron dessus, elle reste toute claire !' },
        { emoji: '🧂', text: 'Une partie du sel vient de la mer : on laisse l’eau de mer sécher au soleil, et il ne reste que le sel.' },
        { emoji: '🍌', text: 'Les bananes poussent en grappes, la pointe vers le ciel ! Une grappe de bananes s’appelle un régime.' },
        { emoji: '🥄', text: 'Une cuillère en bois ne chauffe presque pas dans une casserole chaude : c’est pour ça que les cuisiniers l’aiment tant.' },
        { emoji: '🍪', text: 'Quand un gâteau cuit, sa bonne odeur remplit la maison : notre nez peut reconnaître des milliers d’odeurs différentes !' },
      ],
    },
  },
  {
    id: 'policier',
    name: 'Policier',
    emoji: '👮',
    color: '#1E3770',
    intro: 'Pandi vous fait entrer au commissariat ! Un cadeau pour chacun, pour commencer.',
    items: ['insigne', 'casquette_police', 'chien_policier', 'police', 'commissariat', 'voiture_police'],
    gifts: ['insigne', 'casquette_police', 'chien_policier'],
    pandi: { tete: 'casquette_police' },
    scene: 'fond_commissariat',
    facts: {
      matin: [
        { emoji: '🚓', text: 'Le gyrophare bleu et la sirène de la voiture de police disent aux autres voitures : « Laissez-moi passer, on a besoin de moi ! »' },
        { emoji: '🐕', text: 'Le chien policier a un flair incroyable : son nez sent les odeurs des milliers de fois mieux que le nôtre.' },
        { emoji: '📞', text: 'En France, on appelle la police avec le 17. On ne l’appelle que pour une vraie urgence.' },
        { emoji: '🚦', text: 'Au feu rouge, on s’arrête ; au feu vert, on peut passer. Les policiers aident tout le monde à respecter ces règles.' },
        { emoji: '🔍', text: 'Le bout de tes doigts laisse des traces : les empreintes. Chaque personne a les siennes, différentes de tout le monde, même des jumeaux !' },
        { emoji: '🐴', text: 'Dans certaines villes, des policiers patrouillent à cheval : de là-haut, ils voient bien plus loin !' },
        { emoji: '🦺', text: 'Les policiers portent des bandes qui brillent dans la lumière des phares : comme ça, les voitures les voient même la nuit.' },
      ],
      soir: [
        { emoji: '🌙', text: 'Pendant que tu dors, des policiers travaillent toute la nuit pour veiller sur la ville.' },
        { emoji: '🐾', text: 'Souvent, le chien policier vit à la maison avec son policier : ils sont partenaires au travail et copains le soir.' },
        { emoji: '🤝', text: 'Si un jour tu es perdu, tu peux demander de l’aide à un policier : son travail, c’est d’aider les gens.' },
        { emoji: '🚲', text: 'Certains policiers patrouillent à moto ou même à vélo, pour passer partout dans la ville.' },
        { emoji: '🕵️', text: 'Un enquêteur cherche des indices pour comprendre ce qui s’est passé, un peu comme dans un jeu de piste.' },
        { emoji: '👂', text: 'Un bon policier écoute beaucoup : pour comprendre une histoire, il pose des questions à tout le monde.' },
        { emoji: '😌', text: 'Les policiers apprennent à rester calmes, même quand c’est difficile : respirer doucement aide à bien réfléchir.' },
      ],
    },
  },
  {
    id: 'pompier',
    name: 'Pompier',
    emoji: '🚒',
    color: '#E2363F',
    intro: 'Pandi vous fait visiter la caserne des pompiers ! Un cadeau pour chacun, pour commencer.',
    items: ['extincteur', 'casque_pompier', 'dalmatien', 'pompier', 'caserne', 'camion_pompiers'],
    gifts: ['extincteur', 'casque_pompier', 'dalmatien'],
    pandi: { tete: 'casque_pompier' },
    scene: 'fond_caserne',
    facts: {
      matin: [
        { emoji: '📞', text: 'En France, on appelle les pompiers avec le 18. On ne les appelle que pour une vraie urgence.' },
        { emoji: '🚒', text: 'La grande échelle du camion des pompiers peut monter jusqu’en haut d’un immeuble de dix étages !' },
        { emoji: '🔥', text: 'Le feu a besoin d’air pour brûler : c’est pour ça qu’une couverture spéciale posée dessus peut l’éteindre.' },
        { emoji: '🚑', text: 'Les pompiers ne font pas qu’éteindre le feu : la plupart du temps, ils viennent aider des personnes blessées ou malades.' },
        { emoji: '🐱', text: 'Les pompiers aident aussi les animaux : il leur arrive de sauver un chat coincé tout en haut d’un arbre !' },
        { emoji: '💧', text: 'Le camion des pompiers emporte une grosse réserve d’eau, et ils peuvent aussi brancher leurs tuyaux sur les bouches d’incendie de la rue.' },
        { emoji: '🧑‍🚒', text: 'La tenue des pompiers les protège de la chaleur : elle ne brûle pas facilement.' },
      ],
      soir: [
        { emoji: '🛏️', text: 'La nuit, des pompiers dorment à la caserne, prêts à partir en quelques minutes si on a besoin d’eux.' },
        { emoji: '🐶', text: 'Autrefois, le dalmatien, le chien blanc à taches noires, courait devant les chevaux qui tiraient la voiture des pompiers.' },
        { emoji: '🔔', text: 'Avant les sirènes, les pompiers sonnaient une cloche pour que les gens s’écartent de leur chemin.' },
        { emoji: '💪', text: 'Les pompiers font du sport tous les jours, pour être forts et rapides le jour où on a besoin d’eux.' },
        { emoji: '🚨', text: 'Le détecteur de fumée, au plafond, sonne très fort s’il sent de la fumée : il réveille tout le monde à temps.' },
        { emoji: '🧯', text: 'Un extincteur envoie de la mousse, de la poudre ou de l’eau pour éteindre un petit feu. C’est un outil pour les grands.' },
        { emoji: '❤️', text: 'Beaucoup de pompiers ont un autre métier : ils sont volontaires, et viennent aider dès que leur bip sonne.' },
      ],
    },
  },
];

// Le thème à proposer en premier dans le menu des parents : le premier du catalogue qui n'a encore
// jamais été lancé (ni passé, ni programmé), sinon celui qui a eu lieu il y a le plus longtemps
export function suggestedTheme(themes) {
  const list = Array.isArray(themes) ? themes : [];
  const last = (id) => list.filter((t) => t.theme === id).reduce((m, t) => (String(t.start) > m ? String(t.start) : m), '');
  const never = THEME_CATALOG.find((t) => !last(t.id));
  if (never) return never.id;
  return [...THEME_CATALOG].sort((a, b) => last(a.id).localeCompare(last(b.id)))[0].id;
}

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
