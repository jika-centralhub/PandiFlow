import { uid } from './util.js';
import { eveningDate } from './dates.js';
import { normalizeLook, CHILD_COLORS } from '../avatar/palette.js';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

// school : la tâche a lieu les veilles d'école (les jours suivent les jours d'école choisis au démarrage)
export const DEFAULT_TASKS = [
  { key: 'diner', title: 'Dîner', emoji: '🍽️', days: ALL_DAYS },
  { key: 'douche', title: 'Douche ou bain', emoji: '🛁', days: ALL_DAYS },
  { key: 'pyjama', title: 'Pyjama', emoji: '👕', days: ALL_DAYS },
  { key: 'dents', title: 'Brossage des dents', emoji: '🪥', days: ALL_DAYS },
  { key: 'cartable', title: 'Cartable prêt', emoji: '🎒', days: [0, 1, 2, 3, 4], school: true },
  { key: 'lecture', title: 'Lecture', emoji: '📖', days: ALL_DAYS },
  { key: 'chambre', title: 'Ranger la chambre', emoji: '🧸', days: ALL_DAYS },
  { key: 'lit', title: "Au lit à l'heure", emoji: '🛏️', days: ALL_DAYS },
];

// D'autres idées pour le soir, proposées décochées par l'assistant de démarrage. minAge / maxAge :
// seulement pour les enfants de cet âge (un enfant sans âge les reçoit toutes)
export const EXTRA_TASKS = [
  { key: 'devoirs', title: 'Devoirs', emoji: '📝', days: [0, 1, 2, 3, 4], school: true, minAge: 6 },
  { key: 'habits', title: 'Préparer ses habits', emoji: '👚', days: [0, 1, 2, 3, 4], school: true },
  { key: 'table', title: 'Mettre la table', emoji: '🍴', days: ALL_DAYS },
  { key: 'pipi', title: 'Pipi avant le lit', emoji: '🚽', days: ALL_DAYS, maxAge: 5 },
];

const SCHOOL_DAYS = [1, 2, 3, 4, 5];

export const DEFAULT_MORNING_TASKS = [
  { key: 'lever', title: 'Se lever', emoji: '⏰' },
  { key: 'toilettes', title: 'Toilettes', emoji: '🚽' },
  { key: 'habiller', title: "S'habiller", emoji: '👕' },
  { key: 'petitdej', title: 'Petit-déjeuner', emoji: '🥣' },
  { key: 'dents', title: 'Brossage des dents', emoji: '🪥' },
  { key: 'coiffer', title: 'Se coiffer', emoji: '🪮' },
  { key: 'chaussures', title: 'Chaussures et manteau', emoji: '👟' },
  { key: 'cartable', title: 'Cartable', emoji: '🎒' },
];

// La tâche convient-elle à l'âge de l'enfant ?
export function fitsAge(task, child) {
  const age = Number(child?.age);
  if (child?.age == null || child.age === '' || !(age > 0)) return true;
  return !(task.minAge && age < task.minAge) && !(task.maxAge && age > task.maxAge);
}

// Les veilles des jours d'école (lundi d'école → dimanche soir)
export const eveBefore = (days) => [...new Set(days.map((d) => (d + 6) % 7))].sort((a, b) => a - b);

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
    sex: 'fille',
    look: { face: 'ovale', skin: 'clair', hair: 'couettes', hairColor: 'chatain', eyes: 'grand', eyeColor: 'vert', freckles: true, missingTooth: true, outfit: 'rose' },
  },
  {
    name: 'Sacha',
    age: 5,
    sex: 'garcon',
    look: { face: 'rond', skin: 'caramel', hair: 'boucle', hairColor: 'brun_fonce', eyes: 'rieur', eyeColor: 'marron', dimples: true, outfit: 'turquoise' },
  },
];

export function makeChild(familyId, { name, age = null, sex = null, color, look }, index = 0) {
  return {
    id: uid(),
    family_id: familyId,
    name,
    age,
    sex,
    color: color || CHILD_COLORS[index % CHILD_COLORS.length],
    look: normalizeLook(look),
    equipped: {},
    sort: index,
    archived: false,
  };
}

// Tâches du matin par défaut (jours d'école), affectées à tous les enfants donnés.
// keys : seulement ces tâches (choix de l'assistant de démarrage) ; days : les jours d'école
export function buildMorningSeed(familyId, children, firstSort = 100, keys = null, days = SCHOOL_DAYS) {
  const tasks = DEFAULT_MORNING_TASKS.filter((t) => !keys || keys.includes(t.key)).map((t, i) => ({
    id: uid(),
    family_id: familyId,
    title: t.title,
    emoji: t.emoji,
    days,
    sort: firstSort + i,
    active: true,
    routine: 'matin',
  }));
  const childTasks = [];
  for (const c of children) for (const t of tasks) childTasks.push({ family_id: familyId, child_id: c.id, task_id: t.id });
  return { tasks, childTasks };
}

// Tâches (soir et matin) et défis par défaut d'une nouvelle famille, affectés à tous les enfants donnés.
// choice (assistant de démarrage) : { evening: [clés], morning: [clés] ou null (pas de matin), schoolDays }.
// Les tâches suivent alors l'âge des enfants, et les défis seulement les tâches gardées.
export function buildFamilySeed(familyId, children, choice = null) {
  const schoolDays = choice?.schoolDays?.length ? choice.schoolDays : SCHOOL_DAYS;
  const evening = choice ? [...DEFAULT_TASKS, ...EXTRA_TASKS].filter((t) => choice.evening.includes(t.key)) : DEFAULT_TASKS;
  const childTasks = [];
  const tasks = [];
  for (const t of evening) {
    const kids = choice ? children.filter((c) => fitsAge(t, c)) : children;
    if (!kids.length) continue;
    const task = {
      id: uid(),
      family_id: familyId,
      title: t.title,
      emoji: t.emoji,
      days: choice && t.school ? eveBefore(schoolDays) : t.days,
      sort: tasks.length,
      active: true,
      routine: 'soir',
      _key: t.key,
    };
    tasks.push(task);
    for (const c of kids) childTasks.push({ family_id: familyId, child_id: c.id, task_id: task.id });
  }
  const morning = choice?.morning === null ? { tasks: [], childTasks: [] } : buildMorningSeed(familyId, children, tasks.length, choice?.morning, schoolDays);
  const byKey = Object.fromEntries(tasks.map((t) => [t._key, t]));
  const challenges = DEFAULT_CHALLENGES.filter((c) => byKey[c.taskKey]).map((c) => ({
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
