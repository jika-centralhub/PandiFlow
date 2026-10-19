// Options du personnage. Les clés servent aussi de vocabulaire pour l'analyse
// photo par Claude (voir supabase/functions/analyze-photo/index.ts) : toute
// modification ici doit être reportée dans le schéma de l'Edge Function.

export const SKIN_TONES = {
  porcelaine: { label: 'Porcelaine', color: '#FCE6D8' },
  clair: { label: 'Clair', color: '#F8D5BE' },
  beige: { label: 'Beige', color: '#F1C4A3' },
  dore: { label: 'Doré', color: '#E8B48C' },
  miel: { label: 'Miel', color: '#DA9F74' },
  caramel: { label: 'Caramel', color: '#C68A5C' },
  cannelle: { label: 'Cannelle', color: '#AD7248' },
  brun: { label: 'Brun', color: '#8F5A37' },
  cacao: { label: 'Cacao', color: '#71452A' },
  ebene: { label: 'Ébène', color: '#55331F' },
};

export const HAIR_COLORS = {
  noir: { label: 'Noir', color: '#231C19' },
  brun_fonce: { label: 'Brun foncé', color: '#3D2A1F' },
  brun: { label: 'Brun', color: '#5A3A26' },
  chatain: { label: 'Châtain', color: '#7A5233' },
  chatain_clair: { label: 'Châtain clair', color: '#9E6E45' },
  blond_fonce: { label: 'Blond foncé', color: '#B98B4F' },
  blond: { label: 'Blond', color: '#DDB66C' },
  platine: { label: 'Blond platine', color: '#EEDCA8' },
  roux: { label: 'Roux', color: '#B4502A' },
  cuivre: { label: 'Cuivré', color: '#D27A3B' },
  bleu: { label: 'Bleu', color: '#4F7DF0', fun: true },
  rose: { label: 'Rose', color: '#F27CB8', fun: true },
  violet: { label: 'Violet', color: '#9B6CF0', fun: true },
  vert: { label: 'Vert', color: '#36BF8C', fun: true },
};

export const EYE_COLORS = {
  marron: { label: 'Marron', color: '#6B4226' },
  noisette: { label: 'Noisette', color: '#8C6532' },
  vert: { label: 'Vert', color: '#5C8E48' },
  bleu: { label: 'Bleu', color: '#4C86C9' },
  gris: { label: 'Gris', color: '#7A8896' },
  noir: { label: 'Noir', color: '#2A211C' },
};

export const OUTFIT_COLORS = {
  rouge: { label: 'Rouge', color: '#F2545B' },
  orange: { label: 'Orange', color: '#FF9F43' },
  jaune: { label: 'Jaune', color: '#FFD23F' },
  vert: { label: 'Vert', color: '#3DCC7E' },
  turquoise: { label: 'Turquoise', color: '#2EC4C9' },
  bleu: { label: 'Bleu', color: '#4D8DF7' },
  violet: { label: 'Violet', color: '#9B6CF0' },
  rose: { label: 'Rose', color: '#FF7EB6' },
};

export const GLASSES_COLORS = {
  noir: { label: 'Noir', color: '#2B2B33' },
  rouge: { label: 'Rouge', color: '#E0434B' },
  bleu: { label: 'Bleu', color: '#3C78E0' },
  rose: { label: 'Rose', color: '#F06AAE' },
  ecaille: { label: 'Écaille', color: '#8B5A2B' },
  dore: { label: 'Doré', color: '#D4A23A' },
};

export const FACE_SHAPES = {
  rond: 'Rond',
  ovale: 'Ovale',
  coeur: 'Cœur',
  carre: 'Carré',
};

export const HAIR_STYLES = {
  court: 'Court',
  herisse: 'Hérissé',
  frange: 'Frange',
  raie: 'Raie sur le côté',
  boucle: 'Bouclé',
  afro: 'Afro',
  ondule: 'Ondulé',
  long: 'Long lisse',
  carre: 'Carré',
  couettes: 'Couettes',
  queue: 'Queue de cheval',
  chignon: 'Chignon',
  tresses: 'Tresses',
  rase: 'Très court',
};

export const EYE_SHAPES = {
  rond: 'Ronds',
  amande: 'En amande',
  grand: 'Grands',
  rieur: 'Rieurs',
};

export const BROW_SHAPES = { arc: 'Arrondis', droit: 'Droits', haut: 'Hauts' };
export const BROW_THICKNESS = { fin: 'Fins', moyen: 'Moyens', epais: 'Épais' };
export const GLASSES_SHAPES = { aucune: 'Pas de lunettes', rondes: 'Rondes', rectangle: 'Rectangulaires', papillon: 'Papillon' };

export const DEFAULT_LOOK = {
  face: 'rond',
  skin: 'beige',
  hair: 'court',
  hairColor: 'chatain',
  eyes: 'rond',
  eyeColor: 'marron',
  brows: 'arc',
  browThickness: 'moyen',
  glasses: 'aucune',
  glassesColor: 'noir',
  freckles: false,
  dimples: false,
  missingTooth: false,
  outfit: 'bleu',
};

const ENUMS = {
  face: FACE_SHAPES,
  skin: SKIN_TONES,
  hair: HAIR_STYLES,
  hairColor: HAIR_COLORS,
  eyes: EYE_SHAPES,
  eyeColor: EYE_COLORS,
  brows: BROW_SHAPES,
  browThickness: BROW_THICKNESS,
  glasses: GLASSES_SHAPES,
  glassesColor: GLASSES_COLORS,
  outfit: OUTFIT_COLORS,
};
const BOOLS = ['freckles', 'dimples', 'missingTooth'];

// Valide un look venant de n'importe où (base, IA, ancienne version) :
// chaque valeur inconnue retombe sur la valeur par défaut.
export function normalizeLook(input) {
  const src = input && typeof input === 'object' ? input : {};
  const out = { ...DEFAULT_LOOK };
  for (const [key, options] of Object.entries(ENUMS)) {
    if (typeof src[key] === 'string' && Object.hasOwn(options, src[key])) out[key] = src[key];
  }
  for (const key of BOOLS) {
    if (typeof src[key] === 'boolean') out[key] = src[key];
  }
  return out;
}

export function randomLook(seed = Math.random) {
  const r = typeof seed === 'function' ? seed : Math.random;
  const pickKey = (obj, filter = () => true) => {
    const keys = Object.keys(obj).filter((k) => filter(obj[k]));
    return keys[Math.floor(r() * keys.length)];
  };
  return normalizeLook({
    face: pickKey(FACE_SHAPES),
    skin: pickKey(SKIN_TONES),
    hair: pickKey(HAIR_STYLES),
    hairColor: pickKey(HAIR_COLORS, (c) => !c.fun),
    eyes: pickKey(EYE_SHAPES),
    eyeColor: pickKey(EYE_COLORS),
    brows: pickKey(BROW_SHAPES),
    browThickness: pickKey(BROW_THICKNESS),
    glasses: r() < 0.2 ? pickKey(GLASSES_SHAPES, (v) => v !== 'Pas de lunettes') : 'aucune',
    glassesColor: pickKey(GLASSES_COLORS),
    freckles: r() < 0.25,
    dimples: r() < 0.3,
    missingTooth: r() < 0.3,
    outfit: pickKey(OUTFIT_COLORS),
  });
}

export const CHILD_COLORS = ['#FF7EB6', '#5EC8FF', '#9B7BFF', '#FFB84D', '#48E0A4', '#FF8A5C'];
