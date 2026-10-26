// Quelle tâche, quel numéro de Pandi ? (module léger : l'app s'en sert sans charger la 3D)
// On reconnaît d'abord un mot du titre, puis l'emoji ; sinon Pandi brandit une pancarte avec l'emoji.
const plain = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const RULES = [
  [/dent/, 'dents'],
  [/pyjama/, 'habiller', { variant: 'pyjama' }],
  [/habill|vetement|tenue|uniforme/, 'habiller'],
  [/douche|bain/, 'douche'],
  [/petit.?dej|cereale|gouter|\bbol\b/, 'manger', { variant: 'cereales' }],
  [/diner|dejeuner|repas|manger|souper/, 'manger'],
  [/cartable|\bsac\b/, 'cartable'],
  [/lecture|\blire\b|livre|histoire/, 'lecture'],
  [/range|chambre|jouet/, 'ranger'],
  [/\blit\b|dodo|coucher|dormir|sieste/, 'dodo'],
  [/lever|reveil/, 'lever'],
  [/toilette|pipi|\bwc\b|mains/, 'mains'],
  [/coiff|cheveux|peigne/, 'coiffer'],
  [/chaussure|manteau|veste|basket|blouson|bottes/, 'chaussures'],
];
const EMOJI = {
  '🪥': ['dents'], '🛁': ['douche'], '🚿': ['douche'], '🧼': ['mains'], '🍽': ['manger'], '🍝': ['manger'], '🍲': ['manger'],
  '🥣': ['manger', { variant: 'cereales' }], '👕': ['habiller'], '👚': ['habiller'], '🎒': ['cartable'], '📖': ['lecture'], '📚': ['lecture'],
  '🧸': ['ranger'], '🧹': ['ranger'], '🛏': ['dodo'], '😴': ['dodo'], '🌙': ['dodo'], '⏰': ['lever'], '🚽': ['mains'],
  '🪮': ['coiffer'], '💇': ['coiffer'], '👟': ['chaussures'], '🧥': ['chaussures'], '🥾': ['chaussures'],
};

export function actForTask(task) {
  if (!task) return { act: 'idle', ctx: {} };
  const title = plain(task.title);
  for (const [re, act, ctx] of RULES) if (re.test(title)) return { act, ctx: { ...ctx } };
  const e = String(task.emoji || '').replace(/️/g, '');
  if (EMOJI[e]) return { act: EMOJI[e][0], ctx: { ...(EMOJI[e][1] || {}) } };
  return { act: 'pancarte', ctx: { emoji: task.emoji || '⭐' } };
}

// Ce que fait Pandi sur une carte ou dans le minuteur : la tâche (au rythme calme du minuteur s'il
// tourne), ou sa réaction à la note. timer : { look, progress } (voir timerView dans Timer.js).
// night : la « soirée douce » est commencée, Pandi s'endort sur la carte du coucher.
export function pandiFor(task, { rating, timer, night = false } = {}) {
  if (night && actForTask(task).act === 'dodo') return { act: 'endormi', ctx: {} };
  if (rating) return { act: { green: 'bravo', orange: 'ok', red: 'calin', pause: 'sieste' }[rating] || 'idle', ctx: {} };
  if (timer?.look === 'won') return { act: 'bravo', ctx: {} };
  if (timer?.look === 'paused') return { act: 'sieste', ctx: {} };
  // Minuteur calme : Pandi garde son rythme jusqu'au bout, sans s'agiter ni paniquer
  const a = actForTask(task);
  // les dents : un quart du minuteur pour chaque coin de la bouche
  if (timer) Object.assign(a.ctx, { tempo: 1, zone: Math.min(3, Math.floor((timer.progress || 0) * 4)) });
  return a;
}

// La soirée douce commence à l'histoire du soir (ou, sans histoire, juste avant le coucher)
export function storyIndex(list) {
  const story = list.findIndex((t) => actForTask(t).act === 'lecture');
  if (story >= 0) return story;
  const bed = list.findIndex((t) => actForTask(t).act === 'dodo');
  return bed > 0 ? bed - 1 : Math.max(0, list.length - 1);
}
