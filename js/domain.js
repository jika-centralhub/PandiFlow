// Règles du jeu PandiFlow : fonctions pures, sans accès au stockage ni au DOM.
// Elles prennent l'état (ou une partie) et renvoient des valeurs calculées,
// ce qui les rend testables (tests/index.html) et identiques en démo et en cloud.

import { weekday } from './lib/dates.js';

// La note d'une tâche dit si l'enfant a coopéré. Les valeurs green/orange/red restent celles de la base
// (et de l'historique) ; « pause » = pas ce soir (une crise, un moment difficile), sans note.
export const COLORS = ['green', 'orange', 'red', 'pause'];

export const COLOR_META = {
  green: { label: 'Du premier coup !', face: '🌟', sub: 'Tu as écouté tout de suite' },
  orange: { label: 'Après un rappel', face: '👍', sub: 'Il a fallu redemander une fois' },
  red: { label: 'Il a fallu répéter', face: '✋', sub: 'Demain, du premier coup ?' },
  pause: { label: 'Pas ce soir', face: '⏸️', sub: 'On met en pause, sans note' },
};

// Une tâche « faite » pour l'équipe (défi de la semaine, trésor) : du premier coup ou après un rappel
export const isDone = (color) => color === 'green' || color === 'orange';

export const DEFAULT_SETTINGS = {
  // Barème selon l'âge (petit = moins de 6 ans) ; « pas ce soir » ne rapporte jamais rien
  scales: { petit: { green: 3, orange: 2, red: 1 }, grand: { green: 3, orange: 2, red: 0 } },
  pinHash: null,
  photoConsent: false,
  // Routine du matin : heure du départ à l'école (null = pas de compte à rebours) et jours d'école
  departure: '08:15',
  departureDays: [1, 2, 3, 4, 5],
  morningSeeded: false,
  // Carte d'équipe de fin de soirée : « La meilleure équipe ! » met ces pandi dans la cagnotte commune
  teamCard: { top: 5 },
  // Équipe : le coffre (un palier toutes les `step` tâches faites, `bonus` pandi pour chaque enfant,
  // puis la récompense en vrai au bout du trésor), coup de main
  team: { step: 100, bonus: 10 },
  helpBonus: 2,
  treasure: { goal: 500, reward: 'Une sortie au cinéma 🎬', start: null, done: null },
  // Tsedaka : combien de pandi font 1 € à verser, et les associations proposées aux enfants
  tsedaka: { rate: 10, associations: [] },
  // Surprises de Pandi préparées par les parents, et leurs cartes privilège (null = les cartes de départ)
  surprises: [],
  privileges: null,
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
    scales: {
      petit: { ...DEFAULT_SETTINGS.scales.petit, ...(s.scales?.petit || {}) },
      grand: { ...DEFAULT_SETTINGS.scales.grand, ...(s.scales?.grand || {}) },
    },
    teamCard: { ...DEFAULT_SETTINGS.teamCard, ...(s.teamCard || {}) },
    team: { ...DEFAULT_SETTINGS.team, ...(s.team || {}) },
    treasure: { ...DEFAULT_SETTINGS.treasure, ...(s.treasure || {}) },
    tsedaka: { ...DEFAULT_SETTINGS.tsedaka, ...(s.tsedaka || {}) },
    surprises: Array.isArray(s.surprises) ? s.surprises : [],
    privileges: Array.isArray(s.privileges) ? s.privileges : null,
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

// Le barème des petits va jusqu'à 5 ans ; âge inconnu = barème des grands
export const PETIT_AGE = 6;
export function scaleOf(child) {
  const age = Number(child?.age);
  return child?.age != null && child.age !== '' && age > 0 && age < PETIT_AGE ? 'petit' : 'grand';
}

export function pointsFor(color, settings, child = null) {
  if (!color || color === 'pause') return 0;
  return Math.max(0, Number(mergeSettings(settings).scales[scaleOf(child)][color]) || 0);
}

// Avancement d'une routine (soir ou matin) d'un enfant : sert à la jauge et aux célébrations.
export function routineProgress(childId, date, state, routine = 'soir') {
  const list = tasksForChild(childId, date, state, routine);
  const counts = { green: 0, orange: 0, red: 0, pause: 0 };
  let points = 0;
  const segments = list.map((task) => {
    const r = findRating(state.ratings, childId, task.id, date);
    if (r) {
      counts[r.color] = (counts[r.color] || 0) + 1;
      points += Number(r.points) || 0;
    }
    return { task, color: r ? r.color : null };
  });
  const rated = counts.green + counts.orange + counts.red + counts.pause;
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

// Les achats faits avec la cagnotte commune (potbuy) et la carte d'équipe (teamcard, versée dans la
// cagnotte commune) ne touchent pas la cagnotte de l'enfant.
const SHARED_KINDS = new Set(['potbuy', 'teamcard']);
export function balance(childId, { ratings, ledger }) {
  let sum = 0;
  for (const r of ratings) if (r.child_id === childId) sum += Number(r.points) || 0;
  for (const l of ledger) if (l.child_id === childId && !SHARED_KINDS.has(l.kind)) sum += Number(l.amount) || 0;
  return sum;
}

// Total gagné sur une soirée (notes, et les anciens bonus de soirée parfaite).
export function earnedOn(childId, date, { ratings, ledger }) {
  let sum = 0;
  for (const r of ratings) if (r.child_id === childId && r.evening_date === date) sum += Number(r.points) || 0;
  for (const l of ledger) if (l.child_id === childId && l.kind === 'perfect' && l.evening_date === date) sum += Number(l.amount) || 0;
  return sum;
}

export const challengeBonusId = (challengeId, childId) => `challenge-${challengeId}-${childId}`;

export function isOwned(childId, itemId, owned) {
  return owned.some((o) => o.child_id === childId && o.item_id === itemId);
}

export function challengeAppliesTo(challenge, childId, state) {
  if (challenge.active === false) return false;
  if (challenge.child_id && challenge.child_id !== childId) return false;
  return state.childTasks.some((ct) => ct.child_id === childId && ct.task_id === challenge.task_id);
}

// Défis cumulatifs : nombre de 🌟 « du premier coup » (green) sur la tâche depuis le début du défi.
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
  const child = state.children?.find((c) => c.id === childId) || null;
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
      points: pointsFor(color, settings, child),
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
  // (Plus de bonus « soirée parfaite » : les anciens bonus déjà gagnés restent dans la cagnotte.)

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

  // Coffre de l'équipe : chaque palier atteint donne des pandi à chaque enfant, une seule fois
  let palier = null;
  const grant = palierRows({ ...next, ledger, owned }, { familyId, now });
  if (grant.rows.length) {
    ledger = [...ledger, ...grant.rows];
    ops.push({ op: 'put', table: 'ledger', rows: grant.rows });
    palier = { n: grant.n, bonus: grant.bonus, kids: grant.kids };
  }

  const finalState = { ...next, ledger, owned };
  return {
    ratings,
    ledger,
    owned,
    ops,
    result: {
      palier,
      delta: balance(childId, finalState) - balanceBefore,
      before,
      after,
      routine,
      becameComplete: !before.complete && after.complete,
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

// --- Carte d'équipe de fin de soirée ------------------------------------------------------------
// La même pour tous les enfants (elle remplace l'ancienne carte Comportement de chacun, dont les
// pandi déjà gagnés restent). Elle ne peut qu'ajouter : « La meilleure équipe ! » verse
// settings.teamCard.top pandi dans la cagnotte commune, « On fera mieux demain » ne retire rien.
export const TEAM_CARD = {
  top: { label: 'La meilleure équipe !', face: '🏆' },
  demain: { label: 'On fera mieux demain', face: '🌙' },
};
export const teamCardId = (date) => `teamcard-${date}`;
export const findTeamCard = (ledger, date) => ledger.find((l) => l.id === teamCardId(date)) || null;
export const teamCardLevel = (row) => (!row ? null : row.note === TEAM_CARD.demain.label ? 'demain' : 'top');

// level : 'top' | 'demain' | null (effacer). Une carte par soirée pour toute la fratrie.
export function applyTeamCard(state, { familyId, date, level, now = new Date().toISOString() }) {
  const kids = activeChildren(state.children);
  const id = teamCardId(date);
  let ledger = state.ledger.filter((l) => l.id !== id);
  const ops = [];
  let amount = 0;
  if (level && TEAM_CARD[level] && kids.length) {
    amount = level === 'top' ? Math.max(0, Math.round(Number(mergeSettings(state.settings).teamCard.top) || 0)) : 0;
    // La table rattache chaque ligne à un enfant : le premier, sans effet sur sa cagnotte (voir balance)
    const row = { id, family_id: familyId, child_id: kids[0].id, kind: 'teamcard', amount, evening_date: date, note: TEAM_CARD[level].label, created_at: now };
    ledger = [...ledger, row];
    ops.push({ op: 'put', table: 'ledger', rows: [row] });
  } else {
    ops.push({ op: 'del', table: 'ledger', match: { id } });
  }
  return { ledger, ops, amount };
}

// --- Équipe : le coffre de l'équipe ------------------------------------------------------------------
// Une seule jauge pour toute la fratrie (il remplace le défi de la semaine et le trésor) : chaque
// tâche faite (🌟 ou 👍, de n'importe quel enfant) y met une pierre. Tous les settings.team.step
// pierres, un palier : chaque enfant reçoit settings.team.bonus pandi. Au bout (settings.treasure.goal),
// la récompense en vrai choisie par les parents. Rien ne repart à zéro chaque semaine : un nouveau
// coffre commence quand les parents le décident (settings.treasure.start).
export function treasureProgress(state) {
  const s = mergeSettings(state.settings);
  const t = s.treasure;
  const kids = new Set(activeChildren(state.children).map((c) => c.id));
  let count = 0;
  for (const r of state.ratings) if (isDone(r.color) && kids.has(r.child_id) && (!t.start || r.evening_date >= t.start)) count++;
  const goal = Math.max(1, Number(t.goal) || 1);
  const step = Math.max(1, Math.min(goal, Math.round(Number(s.team.step) || 100)));
  const bonus = Math.max(0, Math.round(Number(s.team.bonus) || 0));
  const capped = Math.min(count, goal);
  const paliers = Math.floor(capped / step);
  return { ...t, goal, step, bonus, count: capped, reached: count >= goal, paliers, totalPaliers: Math.floor(goal / step), nextAt: Math.min(goal, (paliers + 1) * step) };
}

export const palierId = (start, n, childId) => `palier-${start || 'debut'}-${n}-${childId}`;

// Les pandi des paliers atteints et pas encore donnés (un palier n'est donné qu'une fois, et reste
// acquis même si une note est corrigée ensuite)
function palierRows(state, { familyId, now }) {
  const kids = activeChildren(state.children);
  const tp = treasureProgress(state);
  const rows = [];
  let n = 0;
  if (kids.length < 2 || !tp.bonus) return { rows, n, bonus: tp.bonus, kids: [] };
  const have = new Set(state.ledger.map((l) => l.id));
  for (let p = 1; p <= tp.paliers; p++) {
    for (const k of kids) {
      const id = palierId(tp.start, p, k.id);
      if (have.has(id)) continue;
      rows.push({ id, family_id: familyId, child_id: k.id, kind: 'team', amount: tp.bonus, evening_date: null, note: `Palier ${p} du coffre de l’équipe`, created_at: now });
      n = p;
    }
  }
  return { rows, n, bonus: tp.bonus, kids: kids.map((k) => k.id) };
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
// (kind 'potbuy', ignoré dans la cagnotte de l'enfant) que tous les enfants reçoivent. La carte
// d'équipe de fin de soirée (kind 'teamcard') l'alimente aussi.
export function potBalance({ ledger }) {
  let sum = 0;
  for (const l of ledger) {
    if (l.kind === 'pot') sum -= Number(l.amount) || 0;
    else if (l.kind === 'potbuy') sum -= Number(l.amount) || 0;
    else if (l.kind === 'teamcard') sum += Number(l.amount) || 0;
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

// --- La surprise de Pandi -----------------------------------------------------------------------------
// Une récompense rare et inattendue, jamais en pandi et jamais tirée au sort : ce sont les parents qui la
// préparent, quand ils le veulent. Elle arrive au début de la routine suivante : un paquet cadeau dans la
// colonne de chaque enfant, qui l'ouvre et découvre une carte privilège (« Tu choisis l'histoire du
// soir »). Le temps de base avec les parents n'est jamais en jeu : on choisit l'histoire, on n'y a pas
// « droit ». Tout est rangé dans settings.surprises :
//   [{ id, created, from, team, cards: [{ childId, cardId, emoji, text }], opened: { childId: iso }, kept: { childId: iso } }]
export const PRIVILEGE_FAMILIES = {
  choix: { label: 'Je choisis', icon: '🎨' },
  mission: { label: 'Une mission d’honneur', icon: '🎖️' },
  ensemble: { label: 'En plus, ensemble', icon: '🤗' },
  equipe: { label: 'Pour toute l’équipe', icon: '🤝' },
};

// Ce qui ne se gagne jamais : on le reçoit, quoi qu'il arrive
export const NEVER_AT_STAKE = [
  { emoji: '📖', text: 'L’histoire du soir : une carte peut faire choisir laquelle, jamais décider s’il y en a une' },
  { emoji: '🤗', text: 'Le câlin et le bisou du soir' },
  { emoji: '💞', text: 'Le temps de base avec Papa et Maman' },
];

// age : 'tous', 'petit' (moins de 6 ans) ou 'grand'
export const DEFAULT_PRIVILEGES = [
  { id: 'pv-histoire', family: 'choix', emoji: '📖', text: 'Tu choisis l’histoire du soir', age: 'tous' },
  { id: 'pv-dessert', family: 'choix', emoji: '🍰', text: 'Tu choisis le dessert de Chabbat', age: 'tous' },
  { id: 'pv-petitdej', family: 'choix', emoji: '🥐', text: 'Tu choisis le petit-déjeuner du dimanche', age: 'tous' },
  { id: 'pv-musique', family: 'choix', emoji: '🎵', text: 'Tu choisis la musique dans la voiture', age: 'tous' },
  { id: 'pv-jeu', family: 'choix', emoji: '🎲', text: 'Tu choisis le jeu de société de la famille', age: 'tous' },
  { id: 'pv-place', family: 'choix', emoji: '🪑', text: 'Tu choisis ta place à table ce soir', age: 'tous' },
  { id: 'pv-depart', family: 'mission', emoji: '🚦', text: 'Tu donnes le signal du départ pour l’école', age: 'tous' },
  { id: 'pv-table', family: 'mission', emoji: '🍽️', text: 'Tu aides à mettre la table de Chabbat', age: 'tous' },
  { id: 'pv-tsedaka', family: 'mission', emoji: '🪙', text: 'Tu mets la pièce dans la boîte de tsedaka', age: 'tous' },
  { id: 'pv-lumiere', family: 'mission', emoji: '💡', text: 'Tu éteins la lumière du salon ce soir', age: 'tous' },
  { id: 'pv-plantes', family: 'mission', emoji: '🪴', text: 'Tu arroses les plantes avec l’arrosoir', age: 'petit' },
  { id: 'pv-minuteur', family: 'mission', emoji: '⏱️', text: 'Tu lances toi-même ton minuteur', age: 'grand' },
  { id: 'pv-chef', family: 'mission', emoji: '🧑‍🍳', text: 'Tu es {le chef|la cheffe} : tu aides à préparer le dîner', age: 'grand' },
  { id: 'pv-crepes', family: 'ensemble', emoji: '🥞', text: 'Des crêpes ensemble dimanche', age: 'tous' },
  { id: 'pv-jeuplus', family: 'ensemble', emoji: '🧩', text: 'Un jeu de société en plus avec Papa ou Maman', age: 'tous' },
  { id: 'pv-velo', family: 'ensemble', emoji: '🚲', text: 'Une balade à vélo ensemble', age: 'tous' },
  { id: 'pv-gateau', family: 'ensemble', emoji: '🎂', text: 'On fait le gâteau de Chabbat ensemble', age: 'tous' },
  { id: 'pv-parc', family: 'ensemble', emoji: '🛝', text: 'Un détour par le parc en rentrant', age: 'tous' },
  { id: 'pv-eq-dessert', family: 'equipe', emoji: '🍰', text: 'Vous choisissez ensemble le dessert de Chabbat', age: 'tous' },
  { id: 'pv-eq-cabane', family: 'equipe', emoji: '⛺', text: 'On construit une cabane dans le salon, tous ensemble', age: 'tous' },
  { id: 'pv-eq-piquenique', family: 'equipe', emoji: '🧺', text: 'Un pique-nique sur le tapis du salon', age: 'tous' },
  { id: 'pv-eq-chasse', family: 'equipe', emoji: '🗺️', text: 'Une chasse au trésor dans la maison', age: 'tous' },
  { id: 'pv-eq-boum', family: 'equipe', emoji: '💃', text: 'Une boum dans le salon avant le dîner', age: 'tous' },
];

export const privilegeDeck = (settings) => (Array.isArray(settings?.privileges) ? settings.privileges : DEFAULT_PRIVILEGES);

// Les cartes qui conviennent : celles de l'équipe pour une surprise d'équipe, sinon celles de l'âge de l'enfant
export function privilegesFor(child, settings, team = false) {
  const scale = child ? scaleOf(child) : null;
  return privilegeDeck(settings).filter(
    (p) => (team ? p.family === 'equipe' : p.family !== 'equipe') && (!p.age || p.age === 'tous' || !scale || p.age === scale),
  );
}

// La carte proposée aux parents (ils peuvent en choisir une autre) : celle que l'enfant a eue le moins
// récemment, et pas déjà prise pour un autre enfant dans la même surprise (avoid)
export function suggestPrivilege(child, settings, { team = false, avoid = [] } = {}) {
  const deck = privilegesFor(child, settings, team).filter((p) => !avoid.includes(p.id));
  if (!deck.length) return null;
  const last = {};
  (settings?.surprises || []).forEach((x, i) => x.cards?.forEach((c) => {
    if (team || !child || c.childId === child.id) last[c.cardId] = i;
  }));
  return [...deck].sort((a, b) => (last[a.id] ?? -1) - (last[b.id] ?? -1))[0];
}

// Ce que garde la surprise : une copie de la carte, accordée pour l'enfant
export const privilegeCard = (p, child) => ({ childId: child.id, cardId: p.id || null, emoji: p.emoji || '🎁', text: accorder(String(p.text || '').trim(), child).slice(0, 80) });

// Une carte écrite par les parents qui mettrait en jeu le temps de base (« droit à l'histoire », un câlin…)
export function privilegeWarning(text) {
  const t = String(text || '').toLowerCase();
  if (/droit|c[aâ]lin|bisou/.test(t)) return 'Le câlin, le bisou et l’histoire du soir ne se gagnent pas : une carte peut faire choisir, jamais donner « droit à ».';
  return null;
}

const surprisesOf = (settings) => (Array.isArray(settings?.surprises) ? settings.surprises : []);
const timeOf = (iso) => new Date(iso).getTime() || 0;
export const SURPRISE_HISTORY = 40;
// Rappel d'une promesse sur la télé, jusqu'à ce qu'elle soit tenue (au plus une semaine)
export const PROMISE_DAYS = 7;

// Change la liste des surprises : add, open (l'enfant ouvre son paquet), keep (la promesse est tenue ;
// sans childId, pour toutes les cartes), cancel (seulement si personne ne l'a encore ouverte).
// Fonction pure : elle sert aussi à rejouer le changement sur les réglages les plus récents du serveur.
export function applySurpriseOp(list, desc) {
  const out = Array.isArray(list) ? [...list] : [];
  const id = desc.type === 'add' ? desc.surprise?.id : desc.id;
  const i = out.findIndex((x) => x.id === id);
  const x = out[i];
  if (desc.type === 'add') {
    if (i < 0 && desc.surprise?.cards?.length) out.push({ opened: {}, kept: {}, ...desc.surprise });
  } else if (x && desc.type === 'open') {
    if (!x.opened?.[desc.childId] && x.cards.some((c) => c.childId === desc.childId)) out[i] = { ...x, opened: { ...(x.opened || {}), [desc.childId]: desc.at } };
  } else if (x && desc.type === 'keep') {
    const kept = { ...(x.kept || {}) };
    for (const c of x.cards) if (!desc.childId || c.childId === desc.childId) kept[c.childId] = desc.at;
    out[i] = { ...x, kept };
  } else if (x && desc.type === 'cancel') {
    if (!Object.keys(x.opened || {}).length) out.splice(i, 1);
  }
  // Un historique court : les plus anciennes surprises tenues partent d'abord
  while (out.length > SURPRISE_HISTORY) {
    const j = out.findIndex((s) => s.cards.every((c) => s.kept?.[c.childId]));
    out.splice(j >= 0 ? j : 0, 1);
  }
  return out;
}

// Le paquet qui attend l'enfant : arrivé (from passé) et pas encore ouvert
export function pendingSurprise(settings, childId, now = Date.now()) {
  for (const x of surprisesOf(settings)) {
    const card = x.cards?.find((c) => c.childId === childId);
    if (card && !x.opened?.[childId] && timeOf(x.from) <= now) return { surprise: x, card };
  }
  return null;
}

// La carte ouverte dont la promesse n'est pas encore tenue (la plus récente)
export function promiseFor(settings, childId, now = Date.now()) {
  const list = surprisesOf(settings);
  for (let i = list.length - 1; i >= 0; i--) {
    const x = list[i];
    const opened = x.opened?.[childId];
    if (!opened || x.kept?.[childId] || now - timeOf(opened) > PROMISE_DAYS * 864e5) continue;
    const card = x.cards.find((c) => c.childId === childId);
    if (card) return { surprise: x, card };
  }
  return null;
}

// Le tableau des parents : paquets pas encore ouverts, promesses à tenir, dernières promesses tenues,
// et depuis quand date la dernière surprise (pour qu'elle reste rare)
export function surpriseBoard(settings, now = Date.now()) {
  const list = surprisesOf(settings);
  const waiting = list.filter((x) => x.cards.some((c) => !x.opened?.[c.childId]));
  const toKeep = list
    .map((x) => ({ surprise: x, cards: x.cards.filter((c) => x.opened?.[c.childId] && !x.kept?.[c.childId]) }))
    .filter((g) => g.cards.length);
  const kept = list
    .flatMap((x) => x.cards.filter((c) => x.kept?.[c.childId]).map((c) => ({ surprise: x, card: c, at: x.kept[c.childId] })))
    .sort((a, b) => timeOf(b.at) - timeOf(a.at))
    .slice(0, 6);
  const last = list.reduce((m, x) => Math.max(m, timeOf(x.created)), 0);
  return { waiting, toKeep, kept, last: last || null, daysSince: last ? Math.floor((now - last) / 864e5) : null };
}
