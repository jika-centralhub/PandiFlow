// Règles du jeu PandiFlow : fonctions pures, sans accès au stockage ni au DOM.
// Elles prennent l'état (ou une partie) et renvoient des valeurs calculées,
// ce qui les rend testables (tests/index.html) et identiques en démo et en cloud.

import { weekday } from './lib/dates.js';

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
  };
}

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

export function balance(childId, { ratings, ledger }) {
  let sum = 0;
  for (const r of ratings) if (r.child_id === childId) sum += Number(r.points) || 0;
  for (const l of ledger) if (l.child_id === childId) sum += Number(l.amount) || 0;
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

  const finalState = { ...next, ledger, owned };
  return {
    ratings,
    ledger,
    owned,
    ops,
    result: {
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
