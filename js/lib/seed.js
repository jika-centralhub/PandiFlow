import { uid } from './util.js';
import { eveningDate } from './dates.js';
import { normalizeLook, CHILD_COLORS } from '../avatar/palette.js';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export const DEFAULT_TASKS = [
  { key: 'diner', title: 'Dîner', emoji: '🍽️', days: ALL_DAYS },
  { key: 'douche', title: 'Douche ou bain', emoji: '🛁', days: ALL_DAYS },
  { key: 'pyjama', title: 'Pyjama', emoji: '👕', days: ALL_DAYS },
  { key: 'dents', title: 'Brossage des dents', emoji: '🪥', days: ALL_DAYS },
  { key: 'cartable', title: 'Cartable prêt', emoji: '🎒', days: [0, 1, 2, 3, 4] },
  { key: 'lecture', title: 'Lecture', emoji: '📖', days: ALL_DAYS },
  { key: 'chambre', title: 'Ranger la chambre', emoji: '🧸', days: ALL_DAYS },
  { key: 'lit', title: "Au lit à l'heure", emoji: '🛏️', days: ALL_DAYS },
];

const SCHOOL_DAYS = [1, 2, 3, 4, 5];

export const DEFAULT_MORNING_TASKS = [
  { title: 'Se lever', emoji: '⏰' },
  { title: 'Toilettes', emoji: '🚽' },
  { title: "S'habiller", emoji: '👕' },
  { title: 'Petit-déjeuner', emoji: '🥣' },
  { title: 'Brossage des dents', emoji: '🪥' },
  { title: 'Se coiffer', emoji: '🪮' },
  { title: 'Chaussures et manteau', emoji: '👟' },
  { title: 'Cartable', emoji: '🎒' },
];

export const DEFAULT_CHALLENGES = [
  { taskKey: 'dents', title: 'Brossou le super-héros', target: 10, reward_item: 'brossou', bonus: 10 },
  { taskKey: 'douche', title: 'La bulle magique', target: 10, reward_item: 'bulle', bonus: 10 },
  { taskKey: 'lecture', title: 'Le livre enchanté', target: 10, reward_item: 'livre', bonus: 10 },
  { taskKey: 'lit', title: 'La veilleuse étoilée', target: 10, reward_item: 'veilleuse', bonus: 10 },
];

export const DEMO_CHILDREN = [
  {
    name: 'Léa',
    age: 7,
    look: { face: 'ovale', skin: 'clair', hair: 'couettes', hairColor: 'chatain', eyes: 'grand', eyeColor: 'vert', freckles: true, missingTooth: true, outfit: 'rose' },
  },
  {
    name: 'Sacha',
    age: 5,
    look: { face: 'rond', skin: 'caramel', hair: 'boucle', hairColor: 'brun_fonce', eyes: 'rieur', eyeColor: 'marron', dimples: true, outfit: 'turquoise' },
  },
];

export function makeChild(familyId, { name, age = null, color, look }, index = 0) {
  return {
    id: uid(),
    family_id: familyId,
    name,
    age,
    color: color || CHILD_COLORS[index % CHILD_COLORS.length],
    look: normalizeLook(look),
    equipped: {},
    sort: index,
    archived: false,
  };
}

// Tâches du matin par défaut (jours d'école), affectées à tous les enfants donnés.
export function buildMorningSeed(familyId, children, firstSort = 100) {
  const tasks = DEFAULT_MORNING_TASKS.map((t, i) => ({
    id: uid(),
    family_id: familyId,
    title: t.title,
    emoji: t.emoji,
    days: SCHOOL_DAYS,
    sort: firstSort + i,
    active: true,
    routine: 'matin',
  }));
  const childTasks = [];
  for (const c of children) for (const t of tasks) childTasks.push({ family_id: familyId, child_id: c.id, task_id: t.id });
  return { tasks, childTasks };
}

// Tâches (soir et matin) et défis par défaut d'une nouvelle famille, affectés à tous les enfants donnés.
export function buildFamilySeed(familyId, children) {
  const tasks = DEFAULT_TASKS.map((t, i) => ({
    id: uid(),
    family_id: familyId,
    title: t.title,
    emoji: t.emoji,
    days: t.days,
    sort: i,
    active: true,
    routine: 'soir',
    _key: t.key,
  }));
  const childTasks = [];
  for (const c of children) for (const t of tasks) childTasks.push({ family_id: familyId, child_id: c.id, task_id: t.id });
  const morning = buildMorningSeed(familyId, children, tasks.length);
  const byKey = Object.fromEntries(tasks.map((t) => [t._key, t]));
  const challenges = DEFAULT_CHALLENGES.map((c) => ({
    id: uid(),
    family_id: familyId,
    child_id: null,
    task_id: byKey[c.taskKey].id,
    title: c.title,
    target: c.target,
    reward_item: c.reward_item,
    bonus: c.bonus,
    start_date: eveningDate(),
    active: true,
  }));
  for (const t of tasks) delete t._key;
  return { tasks: [...tasks, ...morning.tasks], childTasks: [...childTasks, ...morning.childTasks], challenges };
}
