// Règles du jeu PandiFlow : fonctions pures, sans accès au stockage ni au DOM.
// Elles prennent l'état (ou une partie) et renvoient des valeurs calculées,
// ce qui les rend testables (tests/index.html) et identiques en démo et en cloud.

import { weekday, addDays } from './lib/dates.js';

export const COLORS = ['green', 'orange', 'red'];

export const COLOR_META = {
  green: { label: 'Bravo !', face: '😄', css: 'var(--green)' },
  orange: { label: 'Presque !', face: '😐', css: 'var(--orange)' },
  red: { label: 'À retravailler', face: '😟', css: 'var(--red)' },
};

export const DEFAULT_SETTINGS = {
  points: { green: 3, orange: 1, red: 0 },
  perfectBonus: 5,
  pinHash: null,
  photoConsent: false,
  // Routine du matin : heure du départ à l'école (null = pas de compte à rebours) et jours d'école
  departure: '08:15',
  departureDays: [1, 2, 3, 4, 5],
  morningSeeded: false,
  // Comportement de fin de soirée (carte du carrousel)
  behaviorPoints: { super: 5, bien: 2 },
  // Équipe : défi de la semaine, coup de main, trésor de la fratrie
  team: { threshold: 80, bonus: 10 },
  helpBonus: 2,
  treasure: { goal: 60, reward: 'Une sortie au cinéma 🎬', start: null, done: null },
  // Tsedaka : combien de pandi font 1 € à verser, et les associations proposées aux enfants
  tsedaka: { rate: 10, associations: [] },
};

// Deux routines : le soir et le matin avant l'école. Même barème, même cagnotte, mêmes défis.
export const ROUTINES = {
  matin: { label: 'Matin', icon: '☀️', today: 'Ce matin', yesterday: 'Hier matin', perfect: 'Matinée parfaite', done: 'Toute ta routine du matin est faite. En route pour l’école !' },
  soir: { label: 'Soir', icon: '🌙', today: 'Ce soir', yesterday: 'Hier soir', perfect: 'Soirée parfaite', done: 'Toute ta soirée est faite. Quelle belle réussite !' },
};

export const routineOf = (task) => (task?.routine === 'matin' ? 'matin' : 'soir');

export function mergeSettings(settings) {
  const s = settings && typeof settings === 'object' ? settings : {};
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    points: { ...DEFAULT_SETTINGS.points, ...(s.points || {}) },
    behaviorPoints: { ...DEFAULT_SETTINGS.behaviorPoints, ...(s.behaviorPoints || {}) },
    team: { ...DEFAULT_SETTINGS.team, ...(s.team || {}) },
    treasure: { ...DEFAULT_SETTINGS.treasure, ...(s.treasure || {}) },
    tsedaka: { ...DEFAULT_SETTINGS.tsedaka, ...(s.tsedaka || {}) },
  };
}

// Sexe de l'enfant (facultatif) : accorde les textes, aide le personnage 3D, adapte la boutique
export const SEXES = { garcon: { label: 'Garçon', icon: '👦' }, fille: { label: 'Fille', icon: '👧' } };
export const sexOf = (child) => (child?.sex === 'fille' || child?.sex === 'garcon' ? child.sex : null);
// accord(enfant, 'champion', 'championne') ; sans sexe précisé : le masculin, comme avant
export const accord = (child, masc, fem) => (sexOf(child) === 'fille' ? fem : masc);
// Texte avec des accords « {masculin|féminin} » : « Tu étais très {heureux|heureuse} »
// Même chose dans tout un objet (textes d'une technique du coin calme…)
export function accordDeep(value, child) {
  if (typeof value === 'string') return accorder(value, child);
  if (Array.isArray(value)) return value.map((v) => accordDeep(v, child));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, accordDeep(v, child)]));
  return value;
}
export const accorder = (text, child) => String(text ?? '').replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (_, m, f) => accord(child, m, f));

const bySort = (a, b) => (a.sort ?? 0) - (b.sort ?? 0) || String(a.title || a.name).localeCompare(String(b.title || b.name));

export function activeChildren(children) {
  return children.filter((c) => !c.archived).sort(bySort);
}

// Tâches d'un enfant pour une routine et un jour donnés (en tenant compte des jours actifs).
// Sans date : toutes les tâches actives de la routine affectées à l'enfant.
export function tasksForChild(childId, date, { tasks, childTasks }, routine = 'soir') {
  const assigned = new Set(childTasks.filter((ct) => ct.child_id === childId).map((ct) => ct.task_id));
  const wd = date ? weekday(date) : null;
  return tasks
    .filter((t) => t.active !== false && assigned.has(t.id) && routineOf(t) === routine)
    .filter((t) => wd === null || !Array.isArray(t.days) || t.days.includes(wd))
    .sort(bySort);
}

export function findRating(ratings, childId, taskId, date) {
  return ratings.find((r) => r.child_id === childId && r.task_id === taskId && r.evening_date === date) || null;
}

export function pointsFor(color, settings) {
  const s = mergeSettings(settings);
  return Number(s.points[color]) || 0;
}

// Avancement d'une routine (soir ou matin) d'un enfant : sert à la jauge et aux célébrations.
export function routineProgress(childId, date, state, routine = 'soir') {
  const list = tasksForChild(childId, date, state, routine);
  const counts = { green: 0, orange: 0, red: 0 };
  let points = 0;
  const segments = list.map((task) => {
    const r = findRating(state.ratings, childId, task.id, date);
    if (r) {
      counts[r.color] = (counts[r.color] || 0) + 1;
      points += Number(r.points) || 0;
    }
    return { task, color: r ? r.color : null };
  });
  const rated = counts.green + counts.orange + counts.red;
  const total = list.length;
  return {
    segments,
    total,
    rated,
    counts,
    points,
    ratio: total ? rated / total : 0,
    complete: total > 0 && rated === total,
    perfect: total > 0 && counts.green === total,
  };
}

export const eveningProgress = (childId, date, state) => routineProgress(childId, date, state, 'soir');

// Les achats faits avec la cagnotte commune (potbuy) ne touchent pas la cagnotte de l'enfant.
export function balance(childId, { ratings, ledger }) {
  let sum = 0;
  for (const r of ratings) if (r.child_id === childId) sum += Number(r.points) || 0;
  for (const l of ledger) if (l.child_id === childId && l.kind !== 'potbuy') sum += Number(l.amount) || 0;
  return sum;
}

// Total gagné sur une soirée (notes + bonus de soirée parfaite).
export function earnedOn(childId, date, { ratings, ledger }) {
  let sum = 0;
  for (const r of ratings) if (r.child_id === childId && r.evening_date === date) sum += Number(r.points) || 0;
  for (const l of ledger) if (l.child_id === childId && l.kind === 'perfect' && l.evening_date === date) sum += Number(l.amount) || 0;
  return sum;
}

export const perfectBonusId = (childId, date, routine = 'soir') => (routine === 'matin' ? `perfect-matin-${childId}-${date}` : `perfect-${childId}-${date}`);
export const challengeBonusId = (challengeId, childId) => `challenge-${challengeId}-${childId}`;

export function isOwned(childId, itemId, owned) {
  return owned.some((o) => o.child_id === childId && o.item_id === itemId);
}

export function challengeAppliesTo(challenge, childId, state) {
  if (challenge.active === false) return false;
  if (challenge.child_id && challenge.child_id !== childId) return false;
  return state.childTasks.some((ct) => ct.child_id === childId && ct.task_id === challenge.task_id);
}

// Défis cumulatifs : nombre de notes vertes sur la tâche depuis le début du défi.
export function challengeProgress(challenge, childId, ratings) {
  let n = 0;
  for (const r of ratings) {
    if (r.child_id !== childId || r.task_id !== challenge.task_id || r.color !== 'green') continue;
    if (challenge.start_date && r.evening_date < challenge.start_date) continue;
    n++;
  }
  return n;
}

export function challengesForChild(childId, state) {
  return state.challenges
    .filter((c) => challengeAppliesTo(c, childId, state))
    .map((c) => {
      const count = challengeProgress(c, childId, state.ratings);
      const target = Math.max(1, Number(c.target) || 1);
      return {
        challenge: c,
        count: Math.min(count, target),
        target,
        done: isOwned(childId, c.reward_item, state.owned) || count >= target,
      };
    })
    .sort((a, b) => Number(a.done) - Number(b.done) || b.count / b.target - a.count / a.target);
}

// Défis dont la cible est atteinte mais dont la récompense n'est pas encore donnée.
export function newlyUnlocked(childId, state) {
  return state.challenges.filter(
    (c) =>
      challengeAppliesTo(c, childId, state) &&
      challengeProgress(c, childId, state.ratings) >= Math.max(1, Number(c.target) || 1) &&
      !isOwned(childId, c.reward_item, state.owned),
  );
}

// Calcule toutes les écritures à faire quand une note change (ou est effacée).
// Renvoie { ratings, ledger, owned, ops, result } : le nouvel état et les opérations de stockage.
export function applyRating(state, { familyId, childId, taskId, date, color, now = new Date().toISOString() }) {
  const settings = mergeSettings(state.settings);
  const routine = routineOf(state.tasks.find((t) => t.id === taskId));
  const before = routineProgress(childId, date, state, routine);
  const balanceBefore = balance(childId, state);
  const ops = [];

  let ratings = state.ratings.filter((r) => !(r.child_id === childId && r.task_id === taskId && r.evening_date === date));
  if (color) {
    const rating = {
      family_id: familyId,
      child_id: childId,
      task_id: taskId,
      evening_date: date,
      color,
      points: pointsFor(color, settings),
      updated_at: now,
    };
    ratings = [...ratings, rating];
    ops.push({ op: 'put', table: 'ratings', rows: [rating] });
  } else {
    ops.push({ op: 'del', table: 'ratings', match: { child_id: childId, task_id: taskId, evening_date: date } });
  }

  let ledger = state.ledger;
  let owned = state.owned;
  const next = { ...state, ratings, ledger, owned };
  const after = routineProgress(childId, date, next, routine);

  // Bonus de soirée (ou matinée) parfaite : ajouté quand tout est vert, retiré si une note est corrigée.
  const bonusId = perfectBonusId(childId, date, routine);
  const hasBonus = ledger.some((l) => l.id === bonusId);
  let perfectGained = false;
  let perfectLost = false;
  if (after.perfect && !hasBonus && settings.perfectBonus > 0) {
    const row = { id: bonusId, family_id: familyId, child_id: childId, kind: 'perfect', amount: settings.perfectBonus, evening_date: date, note: ROUTINES[routine].perfect, created_at: now };
    ledger = [...ledger, row];
    ops.push({ op: 'put', table: 'ledger', rows: [row] });
    perfectGained = true;
  } else if (!after.perfect && hasBonus) {
    ledger = ledger.filter((l) => l.id !== bonusId);
    ops.push({ op: 'del', table: 'ledger', match: { id: bonusId } });
    perfectLost = true;
  }

  // Défis : une récompense acquise reste acquise, même si une note est corrigée ensuite.
  const unlocked = newlyUnlocked(childId, { ...next, ledger, owned });
  for (const c of unlocked) {
    const ownedRow = { family_id: familyId, child_id: childId, item_id: c.reward_item, source: 'challenge', created_at: now };
    owned = [...owned, ownedRow];
    ops.push({ op: 'put', table: 'owned_items', rows: [ownedRow] });
    const bonus = Number(c.bonus) || 0;
    if (bonus > 0) {
      const row = { id: challengeBonusId(c.id, childId), family_id: familyId, child_id: childId, kind: 'challenge', amount: bonus, evening_date: date, note: c.title, created_at: now };
      ledger = [...ledger, row];
      ops.push({ op: 'put', table: 'ledger', rows: [row] });
    }
  }

  // Défi d'équipe de la semaine : accordé une seule fois, quand l'objectif est atteint
  let team = null;
  const week = teamWeek({ ...next, ledger, owned }, date);
  if (week.done && !teamGranted(ledger, week.start)) {
    const grant = teamRewardRows({ ...next, ledger, owned }, { familyId, week, now });
    ledger = [...ledger, ...grant.ledgerRows];
    owned = [...owned, ...grant.ownedRows];
    if (grant.ledgerRows.length) ops.push({ op: 'put', table: 'ledger', rows: grant.ledgerRows });
    if (grant.ownedRows.length) ops.push({ op: 'put', table: 'owned_items', rows: grant.ownedRows });
    team = { item: grant.item, bonus: grant.bonus, kids: week.kids.map((k) => k.id) };
  }

  const finalState = { ...next, ledger, owned };
  return {
    ratings,
    ledger,
    owned,
    ops,
    result: {
      team,
      delta: balance(childId, finalState) - balanceBefore,
      before,
      after,
      routine,
      becameComplete: !before.complete && after.complete,
      perfectGained,
      perfectLost,
      unlocked,
    },
  };
}

// Ajout ou retrait de pandi par un parent, hors des routines.
// Un retrait ne peut pas faire passer la cagnotte sous zéro.
export function applyAdjust(state, { familyId, childId, amount, note, id, now = new Date().toISOString() }) {
  const before = balance(childId, state);
  const value = Math.round(Number(amount) || 0);
  const applied = value < 0 ? -Math.min(-value, Math.max(0, before)) : value;
  if (!applied) return { applied: 0, before, after: before, ledger: state.ledger, ops: [] };
  const row = {
    id,
    family_id: familyId,
    child_id: childId,
    kind: 'manual',
    amount: applied,
    evening_date: null,
    note: note || (applied > 0 ? 'Bonus des parents' : 'Retrait des parents'),
    created_at: now,
  };
  return { applied, before, after: before + applied, ledger: [...state.ledger, row], ops: [{ op: 'put', table: 'ledger', rows: [row] }] };
}

// Achat en boutique : vérifie le solde et renvoie les écritures.
export function applyPurchase(state, { familyId, childId, item, now = new Date().toISOString(), id }) {
  if (!item || item.exclusive) return { error: 'Cet objet ne se trouve pas en boutique.' };
  if (isOwned(childId, item.id, state.owned)) return { error: 'Déjà dans tes affaires !' };
  const bal = balance(childId, state);
  if (bal < item.price) return { error: `Il manque encore ${item.price - bal} pandi.` };
  const ledgerRow = { id, family_id: familyId, child_id: childId, kind: 'purchase', amount: -item.price, evening_date: null, note: item.name, created_at: now };
  const ownedRow = { family_id: familyId, child_id: childId, item_id: item.id, source: 'shop', created_at: now };
  return {
    ledger: [...state.ledger, ledgerRow],
    owned: [...state.owned, ownedRow],
    ops: [
      { op: 'put', table: 'ledger', rows: [ledgerRow] },
      { op: 'put', table: 'owned_items', rows: [ownedRow] },
    ],
  };
}

// --- Comportement de fin de soirée --------------------------------------------------------------
export const BEHAVIOR = {
  super: { label: 'Super comportement', face: '😇' },
  bien: { label: 'Bon comportement', face: '🙂' },
  non: { label: 'Comportement à revoir', face: '😕' },
};
export const behaviorId = (childId, date) => `behavior-${childId}-${date}`;
export const findBehavior = (ledger, childId, date) => ledger.find((l) => l.id === behaviorId(childId, date)) || null;
export function behaviorLevel(row) {
  if (!row) return null;
  return Object.keys(BEHAVIOR).find((k) => BEHAVIOR[k].label === row.note) || (row.amount > 0 ? 'bien' : 'non');
}

// level : 'super' | 'bien' | 'non' | null (effacer). Une seule note de comportement par soirée.
export function applyBehavior(state, { familyId, childId, date, level, now = new Date().toISOString() }) {
  const settings = mergeSettings(state.settings);
  const id = behaviorId(childId, date);
  const before = balance(childId, state);
  let ledger = state.ledger.filter((l) => l.id !== id);
  const ops = [];
  if (level) {
    const amount = level === 'super' ? Number(settings.behaviorPoints.super) || 0 : level === 'bien' ? Number(settings.behaviorPoints.bien) || 0 : 0;
    const row = { id, family_id: familyId, child_id: childId, kind: 'behavior', amount, evening_date: date, note: BEHAVIOR[level].label, created_at: now };
    ledger = [...ledger, row];
    ops.push({ op: 'put', table: 'ledger', rows: [row] });
  } else {
    ops.push({ op: 'del', table: 'ledger', match: { id } });
  }
  return { ledger, ops, delta: balance(childId, { ...state, ledger }) - before };
}

// --- Équipe : défi de la semaine ---------------------------------------------------------------------
// Cadeaux « duo » du défi d'équipe, donnés dans cet ordre (puis seulement des pandi)
export const TEAM_REWARDS = ['medaille_equipe', 'talkie', 'capes_jumelles', 'tandem', 'casquette_equipe'];

// La semaine va du lundi au dimanche
export function weekStart(date) {
  return addDays(date, -((weekday(date) + 6) % 7));
}

// Tous les enfants, matin et soir, sur toute la semaine : on compte les verts sur le total prévu.
export function teamWeek(state, date) {
  const settings = mergeSettings(state.settings);
  const kids = activeChildren(state.children);
  const start = weekStart(date);
  let total = 0;
  let greens = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    for (const k of kids) {
      for (const routine of ['matin', 'soir']) {
        for (const t of tasksForChild(k.id, d, state, routine)) {
          total++;
          if (findRating(state.ratings, k.id, t.id, d)?.color === 'green') greens++;
        }
      }
    }
  }
  const goal = Math.ceil((total * Math.min(100, Math.max(1, Number(settings.team.threshold) || 80))) / 100);
  return { start, end: addDays(start, 6), total, greens, goal, ratio: goal ? Math.min(1, greens / goal) : 0, done: kids.length > 1 && total > 0 && greens >= goal, kids };
}

export const teamRewardId = (weekStartDate, childId) => `team-${weekStartDate}-${childId}`;
export const teamGranted = (ledger, weekStartDate) => ledger.some((l) => l.kind === 'team' && l.id.startsWith(`team-${weekStartDate}-`));

function teamRewardRows(state, { familyId, week, now }) {
  const settings = mergeSettings(state.settings);
  const bonus = Math.max(0, Number(settings.team.bonus) || 0);
  const item = TEAM_REWARDS.find((id) => week.kids.some((k) => !isOwned(k.id, id, state.owned))) || null;
  const ledgerRows = week.kids.map((k) => ({ id: teamRewardId(week.start, k.id), family_id: familyId, child_id: k.id, kind: 'team', amount: bonus, evening_date: null, note: 'Défi d’équipe réussi', created_at: now }));
  const ownedRows = item ? week.kids.filter((k) => !isOwned(k.id, item, state.owned)).map((k) => ({ family_id: familyId, child_id: k.id, item_id: item, source: 'team', created_at: now })) : [];
  return { item, bonus, ledgerRows, ownedRows };
}

// --- Équipe : trésor de la fratrie --------------------------------------------------------------------
// Une grande jauge que chaque note verte (de n'importe quel enfant) remplit.
export function treasureProgress(state) {
  const t = mergeSettings(state.settings).treasure;
  const kids = new Set(activeChildren(state.children).map((c) => c.id));
  let count = 0;
  for (const r of state.ratings) if (r.color === 'green' && kids.has(r.child_id) && (!t.start || r.evening_date >= t.start)) count++;
  const goal = Math.max(1, Number(t.goal) || 1);
  return { ...t, goal, count: Math.min(count, goal), reached: count >= goal };
}

// --- Équipe : coup de main ----------------------------------------------------------------------------
export function applyHelp(state, { familyId, helper, helped, ids, now = new Date().toISOString() }) {
  const amount = Math.max(0, Number(mergeSettings(state.settings).helpBonus) || 0);
  if (!amount || helper.id === helped.id) return { ledger: state.ledger, ops: [], amount: 0 };
  const rows = [
    { id: ids[0], family_id: familyId, child_id: helper.id, kind: 'help', amount, evening_date: null, note: `A aidé ${helped.name}`, created_at: now },
    { id: ids[1], family_id: familyId, child_id: helped.id, kind: 'help', amount, evening_date: null, note: `Aidé par ${helper.name}`, created_at: now },
  ];
  return { ledger: [...state.ledger, ...rows], ops: [{ op: 'put', table: 'ledger', rows }], amount };
}

// --- Équipe : cadeaux entre enfants -------------------------------------------------------------------
export function applyGift(state, { familyId, from, to, amount, ids, now = new Date().toISOString() }) {
  const value = Math.min(Math.max(0, Math.round(Number(amount) || 0)), Math.max(0, balance(from.id, state)));
  if (!value || from.id === to.id) return { error: 'Il n’y a rien à offrir.', ledger: state.ledger, ops: [], amount: 0 };
  const rows = [
    { id: ids[0], family_id: familyId, child_id: from.id, kind: 'gift', amount: -value, evening_date: null, note: `Cadeau pour ${to.name}`, created_at: now },
    { id: ids[1], family_id: familyId, child_id: to.id, kind: 'gift', amount: value, evening_date: null, note: `Cadeau de ${from.name}`, created_at: now },
  ];
  return { ledger: [...state.ledger, ...rows], ops: [{ op: 'put', table: 'ledger', rows }], amount: value };
}

// --- Équipe : cagnotte commune -----------------------------------------------------------------------
// On y met des pandi (kind 'pot', montant négatif pour l'enfant) ; on y achète des objets partagés
// (kind 'potbuy', ignoré dans la cagnotte de l'enfant) que tous les enfants reçoivent.
export function potBalance({ ledger }) {
  let sum = 0;
  for (const l of ledger) {
    if (l.kind === 'pot') sum -= Number(l.amount) || 0;
    else if (l.kind === 'potbuy') sum -= Number(l.amount) || 0;
  }
  return sum;
}

export function potContributions({ ledger, children }) {
  const by = {};
  for (const l of ledger) if (l.kind === 'pot') by[l.child_id] = (by[l.child_id] || 0) - (Number(l.amount) || 0);
  return activeChildren(children).map((c) => ({ child: c, amount: by[c.id] || 0 }));
}

export function applyPotDeposit(state, { familyId, child, amount, id, now = new Date().toISOString() }) {
  const value = Math.min(Math.max(0, Math.round(Number(amount) || 0)), Math.max(0, balance(child.id, state)));
  if (!value) return { error: 'Il n’y a pas assez de pandi.', ledger: state.ledger, ops: [], amount: 0 };
  const row = { id, family_id: familyId, child_id: child.id, kind: 'pot', amount: -value, evening_date: null, note: 'Cagnotte commune', created_at: now };
  return { ledger: [...state.ledger, row], ops: [{ op: 'put', table: 'ledger', rows: [row] }], amount: value };
}

export function applyPotPurchase(state, { familyId, buyer, item, id, now = new Date().toISOString() }) {
  const kids = activeChildren(state.children);
  if (!item || !item.pot) return { error: 'Cet objet ne s’achète pas avec la cagnotte commune.' };
  if (kids.every((k) => isOwned(k.id, item.id, state.owned))) return { error: 'Vous l’avez déjà !' };
  const pot = potBalance(state);
  if (pot < item.price) return { error: `Il manque encore ${item.price - pot} pandi dans la cagnotte commune.` };
  const ledgerRow = { id, family_id: familyId, child_id: buyer.id, kind: 'potbuy', amount: item.price, evening_date: null, note: item.name, created_at: now };
  const ownedRows = kids.filter((k) => !isOwned(k.id, item.id, state.owned)).map((k) => ({ family_id: familyId, child_id: k.id, item_id: item.id, source: 'pot', created_at: now }));
  return {
    ledger: [...state.ledger, ledgerRow],
    owned: [...state.owned, ...ownedRows],
    ops: [{ op: 'put', table: 'ledger', rows: [ledgerRow] }, { op: 'put', table: 'owned_items', rows: ownedRows }],
  };
}

// --- Tsedaka ----------------------------------------------------------------------------------------
// L'enfant donne des pandi (kind 'tsedaka', montant négatif, note = association choisie) ; les parents
// versent l'équivalent en euros à l'association, puis le notent (kind 'tsedakapaid', montant 0,
// id = 'tsedakapaid-' + id du don). Sans association choisie, ce sont les parents qui décideront.
export const TSEDAKA_LATER = 'Les parents choisiront';
export const tsedakaPaidId = (donationId) => `tsedakapaid-${donationId}`;

export function tsedakaRate(settings) {
  return Math.max(1, Math.round(Number(mergeSettings(settings).tsedaka.rate) || 10));
}

// Montant en euros (nombre) de pandi donnés, au taux actuel
export const tsedakaEuros = (pandi, settings) => Math.round((pandi / tsedakaRate(settings)) * 100) / 100;
export const formatEuros = (n) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: n % 1 ? 2 : 0 });

export function tsedakaGiven(childId, { ledger }) {
  let sum = 0;
  for (const l of ledger) if (l.child_id === childId && l.kind === 'tsedaka') sum -= Number(l.amount) || 0;
  return sum;
}

export function applyTsedaka(state, { familyId, child, amount, association, id, now = new Date().toISOString() }) {
  const value = Math.min(Math.max(0, Math.round(Number(amount) || 0)), Math.max(0, balance(child.id, state)));
  if (!value) return { error: 'Il n’y a pas assez de pandi.', ledger: state.ledger, ops: [], amount: 0 };
  const note = String(association || '').trim().slice(0, 60) || TSEDAKA_LATER;
  const row = { id, family_id: familyId, child_id: child.id, kind: 'tsedaka', amount: -value, evening_date: null, note, created_at: now };
  return { ledger: [...state.ledger, row], ops: [{ op: 'put', table: 'ledger', rows: [row] }], amount: value, row };
}

// Dons pas encore versés, regroupés par association : { association, pandi, euros, rows, kids: { childId: pandi } }
export function tsedakaDue(state) {
  const paid = new Set(state.ledger.filter((l) => l.kind === 'tsedakapaid').map((l) => l.id));
  const by = new Map();
  for (const l of state.ledger) {
    if (l.kind !== 'tsedaka' || paid.has(tsedakaPaidId(l.id))) continue;
    const key = l.note || TSEDAKA_LATER;
    const g = by.get(key) || { association: key, pandi: 0, rows: [], kids: {} };
    const p = -(Number(l.amount) || 0);
    g.pandi += p;
    g.kids[l.child_id] = (g.kids[l.child_id] || 0) + p;
    g.rows.push(l);
    by.set(key, g);
  }
  return [...by.values()].map((g) => ({ ...g, euros: tsedakaEuros(g.pandi, state.settings) })).sort((a, b) => b.pandi - a.pandi);
}

// Total déjà versé par association (en pandi), pour l'historique des parents
export function tsedakaPaidTotals(state) {
  const paid = new Set(state.ledger.filter((l) => l.kind === 'tsedakapaid').map((l) => l.id));
  const by = {};
  for (const l of state.ledger) if (l.kind === 'tsedaka' && paid.has(tsedakaPaidId(l.id))) by[l.note || TSEDAKA_LATER] = (by[l.note || TSEDAKA_LATER] || 0) - (Number(l.amount) || 0);
  return by;
}

// Les parents ont versé les dons de cette association (to : autre association si l'enfant a laissé choisir)
export function applyTsedakaPaid(state, { familyId, association, to = null, now = new Date().toISOString() }) {
  const group = tsedakaDue(state).find((g) => g.association === association);
  if (!group) return { ledger: state.ledger, ops: [], count: 0 };
  const name = String(to || '').trim().slice(0, 60);
  const moved = name && name !== association ? group.rows.map((l) => ({ ...l, note: name })) : [];
  const paidRows = group.rows.map((l) => ({ id: tsedakaPaidId(l.id), family_id: familyId, child_id: l.child_id, kind: 'tsedakapaid', amount: 0, evening_date: null, note: name || association, created_at: now }));
  const movedIds = new Set(moved.map((l) => l.id));
  const ledger = [...state.ledger.map((l) => (movedIds.has(l.id) ? moved.find((m) => m.id === l.id) : l)), ...paidRows];
  const ops = [...(moved.length ? [{ op: 'put', table: 'ledger', rows: moved }] : []), { op: 'put', table: 'ledger', rows: paidRows }];
  return { ledger, ops, count: paidRows.length };
}

// Un don pas encore versé peut être annulé par les parents : les pandi reviennent à l'enfant
export function applyTsedakaCancel(state, { id }) {
  const row = state.ledger.find((l) => l.id === id && l.kind === 'tsedaka');
  if (!row || state.ledger.some((l) => l.id === tsedakaPaidId(id))) return { ledger: state.ledger, ops: [] };
  return { ledger: state.ledger.filter((l) => l.id !== id), ops: [{ op: 'del', table: 'ledger', match: { id } }], row };
}

// Badges de mitsva, selon le total donné (en pandi)
export const TSEDAKA_BADGES = [
  { min: 1, icon: '🌱', label: 'Première mitsva' },
  { min: 30, icon: '💛', label: 'Cœur généreux' },
  { min: 100, icon: '🤲', label: 'Main tendue' },
  { min: 250, icon: '⭐', label: '{Petit tsadik|Petite tsadéket}' },
  { min: 500, icon: '🕯️', label: 'Lumière du monde' },
];
export const tsedakaBadges = (child, state) => {
  const given = tsedakaGiven(child.id, state);
  return TSEDAKA_BADGES.map((b) => ({ ...b, label: accorder(b.label, child), got: given >= b.min }));
};
