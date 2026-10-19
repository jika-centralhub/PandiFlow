import * as d from '../js/domain.js';
import { eveningDate, addDays, weekday } from '../js/lib/dates.js';
import { normalizeLook, DEFAULT_LOOK, randomLook } from '../js/avatar/palette.js';

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, error: e });
  }
}
function eq(actual, expected, msg = '') {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg} attendu ${b}, obtenu ${a}`);
}
function ok(cond, msg = 'condition fausse') {
  if (!cond) throw new Error(msg);
}

// --- Fixture : 1 enfant, 3 tâches (dont une seulement le lundi) -----------------
const MONDAY = '2026-10-19';
const TUESDAY = '2026-10-20';
function fixture() {
  return {
    settings: d.mergeSettings({}),
    children: [{ id: 'c1', name: 'Léa' }, { id: 'c2', name: 'Sacha' }],
    tasks: [
      { id: 't1', title: 'Dents', sort: 0, active: true, days: [0, 1, 2, 3, 4, 5, 6] },
      { id: 't2', title: 'Pyjama', sort: 1, active: true, days: [0, 1, 2, 3, 4, 5, 6] },
      { id: 't3', title: 'Cartable', sort: 2, active: true, days: [1] },
    ],
    childTasks: [
      { child_id: 'c1', task_id: 't1' },
      { child_id: 'c1', task_id: 't2' },
      { child_id: 'c1', task_id: 't3' },
      { child_id: 'c2', task_id: 't2' },
    ],
    ratings: [],
    ledger: [],
    owned: [],
    challenges: [{ id: 'ch1', task_id: 't1', target: 3, reward_item: 'brossou', bonus: 10, start_date: '2026-10-01', active: true, title: 'Brossou' }],
  };
}
function rateAll(state, list) {
  let s = state;
  let last = null;
  for (const [childId, taskId, date, color] of list) {
    const r = d.applyRating(s, { familyId: 'f', childId, taskId, date, color });
    s = { ...s, ratings: r.ratings, ledger: r.ledger, owned: r.owned };
    last = r.result;
  }
  return { state: s, result: last };
}

// --- Dates ---------------------------------------------------------------------
test('soirée : avant 4 h compte pour la veille', () => {
  eq(eveningDate(new Date(2026, 9, 20, 1, 30)), MONDAY);
  eq(eveningDate(new Date(2026, 9, 20, 4, 0)), TUESDAY);
  eq(eveningDate(new Date(2026, 9, 19, 20, 15)), MONDAY);
});
test('addDays et weekday', () => {
  eq(addDays(MONDAY, 1), TUESDAY);
  eq(addDays('2026-12-31', 1), '2027-01-01');
  eq(weekday(MONDAY), 1);
});

// --- Tâches et progression ---------------------------------------------------------
test('tâches filtrées par jour actif et par enfant', () => {
  const s = fixture();
  eq(d.tasksForChild('c1', MONDAY, s).map((t) => t.id), ['t1', 't2', 't3']);
  eq(d.tasksForChild('c1', TUESDAY, s).map((t) => t.id), ['t1', 't2']);
  eq(d.tasksForChild('c2', MONDAY, s).map((t) => t.id), ['t2']);
});
test('progression de la soirée', () => {
  const { state } = rateAll(fixture(), [['c1', 't1', TUESDAY, 'green']]);
  const p = d.eveningProgress('c1', TUESDAY, state);
  eq([p.rated, p.total, p.complete, p.perfect], [1, 2, false, false]);
});

// --- Points et bonus ------------------------------------------------------------------
test('barème vert 3 / orange 1 / rouge 0', () => {
  const { state } = rateAll(fixture(), [
    ['c1', 't1', MONDAY, 'green'],
    ['c1', 't2', MONDAY, 'orange'],
    ['c1', 't3', MONDAY, 'red'],
  ]);
  eq(d.balance('c1', state), 4);
});
test('soirée parfaite : +5 une seule fois', () => {
  const { state, result } = rateAll(fixture(), [
    ['c1', 't1', TUESDAY, 'green'],
    ['c1', 't2', TUESDAY, 'green'],
  ]);
  ok(result.perfectGained, 'bonus attendu');
  ok(result.becameComplete, 'soirée complète attendue');
  eq(d.balance('c1', state), 3 + 3 + 5);
  const again = rateAll(state, [['c1', 't2', TUESDAY, 'green']]);
  eq(d.balance('c1', again.state), 11, 'pas de double bonus');
});
test('bonus parfait retiré si une note est corrigée', () => {
  const first = rateAll(fixture(), [
    ['c1', 't1', TUESDAY, 'green'],
    ['c1', 't2', TUESDAY, 'green'],
  ]);
  const { state, result } = rateAll(first.state, [['c1', 't2', TUESDAY, 'orange']]);
  ok(result.perfectLost, 'bonus perdu attendu');
  eq(d.balance('c1', state), 3 + 1);
  eq(result.delta, -7);
});
test('effacer une note retire ses points', () => {
  const first = rateAll(fixture(), [['c1', 't1', MONDAY, 'green']]);
  const { state } = rateAll(first.state, [['c1', 't1', MONDAY, null]]);
  eq(d.balance('c1', state), 0);
  eq(state.ratings.length, 0);
});
test('points figés au moment de la note', () => {
  let s = fixture();
  ({ state: s } = rateAll(s, [['c1', 't1', MONDAY, 'green']]));
  s = { ...s, settings: d.mergeSettings({ points: { green: 10 } }) };
  ({ state: s } = rateAll(s, [['c1', 't2', MONDAY, 'green']]));
  eq(d.balance('c1', s), 13);
});

// --- Défis --------------------------------------------------------------------------------
test('défi cumulatif débloqué à la cible, même avec des oublis', () => {
  const { state, result } = rateAll(fixture(), [
    ['c1', 't1', '2026-10-10', 'green'],
    ['c1', 't1', '2026-10-11', 'red'],
    ['c1', 't1', '2026-10-12', 'green'],
    ['c1', 't1', '2026-10-14', 'green'],
  ]);
  eq(result.unlocked.map((c) => c.id), ['ch1']);
  ok(d.isOwned('c1', 'brossou', state.owned), 'récompense possédée');
  eq(d.balance('c1', state), 3 * 3 + 10, 'bonus du défi');
});
test('notes avant la date de début ignorées', () => {
  const { state } = rateAll(fixture(), [
    ['c1', 't1', '2026-09-20', 'green'],
    ['c1', 't1', '2026-09-21', 'green'],
    ['c1', 't1', '2026-10-02', 'green'],
  ]);
  eq(d.challengeProgress(state.challenges[0], 'c1', state.ratings), 1);
  ok(!d.isOwned('c1', 'brossou', state.owned));
});
test('défi non débloqué deux fois', () => {
  const { state } = rateAll(fixture(), [
    ['c1', 't1', '2026-10-10', 'green'],
    ['c1', 't1', '2026-10-11', 'green'],
    ['c1', 't1', '2026-10-12', 'green'],
  ]);
  const again = rateAll(state, [['c1', 't1', '2026-10-13', 'green']]);
  eq(again.result.unlocked.length, 0);
  eq(again.state.owned.length, 1);
});
test('défi ignoré pour un enfant sans la tâche', () => {
  const s = fixture();
  eq(d.challengesForChild('c2', s).length, 0);
  eq(d.challengesForChild('c1', s).length, 1);
});

// --- Boutique -------------------------------------------------------------------------------
test('achat : solde suffisant requis', () => {
  const s = fixture();
  const item = { id: 'couronne', name: 'Couronne', price: 5, slot: 'hat' };
  ok(d.applyPurchase(s, { familyId: 'f', childId: 'c1', item, id: 'x' }).error, 'refus attendu');
  const { state } = rateAll(s, [['c1', 't1', MONDAY, 'green'], ['c1', 't2', MONDAY, 'green']]);
  const res = d.applyPurchase(state, { familyId: 'f', childId: 'c1', item, id: 'x' });
  ok(!res.error, res.error);
  eq(d.balance('c1', { ...state, ledger: res.ledger }), 1);
  ok(d.applyPurchase({ ...state, owned: res.owned, ledger: res.ledger }, { familyId: 'f', childId: 'c1', item, id: 'y' }).error, 'pas de double achat');
});
test('objets exclusifs non achetables', () => {
  const s = { ...fixture(), ledger: [{ child_id: 'c1', amount: 999 }] };
  ok(d.applyPurchase(s, { familyId: 'f', childId: 'c1', item: { id: 'brossou', price: 0, exclusive: true }, id: 'x' }).error);
});

// --- Avatar ------------------------------------------------------------------------------------
test('look : valeurs inconnues remplacées par défaut', () => {
  const look = normalizeLook({ hair: 'crete-iroquoise', skin: 'miel', freckles: 'oui', eyeColor: 'vert', extra: 1 });
  eq(look.hair, DEFAULT_LOOK.hair);
  eq(look.skin, 'miel');
  eq(look.freckles, false);
  eq(look.eyeColor, 'vert');
  ok(!('extra' in look));
});
test('look : entrée invalide -> look par défaut', () => {
  eq(normalizeLook(null), DEFAULT_LOOK);
  eq(normalizeLook('texte'), DEFAULT_LOOK);
});
test('look aléatoire toujours valide', () => {
  for (let i = 0; i < 50; i++) {
    const l = randomLook();
    eq(normalizeLook(l), l);
  }
});

// --- Affichage ------------------------------------------------------------------------------------
const passed = results.filter((r) => r.ok).length;
document.getElementById('summary').textContent = `${passed} / ${results.length} tests réussis`;
document.getElementById('summary').className = passed === results.length ? 'ok' : 'ko';
document.getElementById('results').innerHTML = results
  .map((r) => `<li class="${r.ok ? 'ok' : 'ko'}">${r.ok ? '✔' : '✘'} ${r.name}${r.ok ? '' : `<pre>${r.error.message}</pre>`}</li>`)
  .join('');
window.__testResults = { passed, total: results.length, failed: results.filter((r) => !r.ok).map((r) => `${r.name}: ${r.error.message}`) };
