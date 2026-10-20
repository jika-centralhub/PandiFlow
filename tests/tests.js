import * as d from '../js/domain.js';
import { eveningDate, addDays, weekday, currentRoutine, routineDate, atTime } from '../js/lib/dates.js';
import * as cd from '../js/lib/countdown.js';
import { sha256Bytes, hashPin } from '../js/lib/pin.js';
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

// --- Cagnotte hors routines ------------------------------------------------------------------------
test('cagnotte : ajout de pandi', () => {
  const s = { ...fixture(), ledger: [{ child_id: 'c1', amount: 4 }] };
  const r = d.applyAdjust(s, { familyId: 'f', childId: 'c1', amount: 5, note: 'Aide', id: 'a' });
  eq([r.applied, r.before, r.after], [5, 4, 9]);
  eq(d.balance('c1', { ...s, ledger: r.ledger }), 9);
  eq(r.ledger.at(-1).kind, 'manual');
});
test('cagnotte : un retrait ne passe jamais sous zéro', () => {
  const s = { ...fixture(), ledger: [{ child_id: 'c1', amount: 3 }] };
  const r = d.applyAdjust(s, { familyId: 'f', childId: 'c1', amount: -10, id: 'b' });
  eq([r.applied, r.after], [-3, 0]);
  const empty = d.applyAdjust({ ...s, ledger: r.ledger }, { familyId: 'f', childId: 'c1', amount: -2, id: 'c' });
  eq([empty.applied, empty.ops.length], [0, 0]);
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

// --- Routine du matin ------------------------------------------------------------------------------
function morningFixture() {
  const s = fixture();
  return {
    ...s,
    tasks: [...s.tasks, { id: 'm1', title: 'Se lever', sort: 100, active: true, days: [1, 2, 3, 4, 5], routine: 'matin' }, { id: 'm2', title: 'Habits', sort: 101, active: true, days: [1, 2, 3, 4, 5], routine: 'matin' }],
    childTasks: [...s.childTasks, { child_id: 'c1', task_id: 'm1' }, { child_id: 'c1', task_id: 'm2' }],
  };
}
test('routine : matin entre 4 h et 13 h, soir sinon', () => {
  eq(currentRoutine(new Date(2026, 9, 20, 7, 0)), 'matin');
  eq(currentRoutine(new Date(2026, 9, 20, 12, 59)), 'matin');
  eq(currentRoutine(new Date(2026, 9, 20, 13, 0)), 'soir');
  eq(currentRoutine(new Date(2026, 9, 20, 2, 0)), 'soir');
  eq(routineDate('matin', new Date(2026, 9, 20, 7, 0)), TUESDAY);
  eq(routineDate('soir', new Date(2026, 9, 20, 1, 0)), MONDAY);
});
test('tâches séparées entre matin et soir', () => {
  const s = morningFixture();
  eq(d.tasksForChild('c1', TUESDAY, s, 'matin').map((t) => t.id), ['m1', 'm2']);
  eq(d.tasksForChild('c1', TUESDAY, s, 'soir').map((t) => t.id), ['t1', 't2']);
  eq(d.tasksForChild('c1', TUESDAY, s).map((t) => t.id), ['t1', 't2'], 'le soir par défaut');
  eq(d.tasksForChild('c1', '2026-10-24', s, 'matin').length, 0, 'pas d’école le samedi');
});
test('matinée parfaite et soirée parfaite le même jour : deux bonus distincts', () => {
  const { state, result } = rateAll(morningFixture(), [
    ['c1', 'm1', TUESDAY, 'green'],
    ['c1', 'm2', TUESDAY, 'green'],
  ]);
  ok(result.perfectGained, 'bonus du matin attendu');
  eq(result.routine, 'matin');
  ok(state.ledger.some((l) => l.id === d.perfectBonusId('c1', TUESDAY, 'matin') && l.note === 'Matinée parfaite'));
  const evening = rateAll(state, [
    ['c1', 't1', TUESDAY, 'green'],
    ['c1', 't2', TUESDAY, 'green'],
  ]);
  ok(evening.result.perfectGained, 'bonus du soir attendu aussi');
  eq(d.balance('c1', evening.state), 6 + 5 + 6 + 5);
});
test('heure du départ à une date donnée', () => {
  eq(atTime(TUESDAY, '08:15'), new Date(2026, 9, 20, 8, 15).getTime());
});

// --- Minuteur --------------------------------------------------------------------------------------
const T0 = 1000000;
test('minuteur : temps restant et phases', () => {
  const t = cd.createTimer({ childId: 'c1', taskId: 't1', date: TUESDAY, minutes: 2, now: T0 });
  eq(cd.remainingMs(t, T0 + 30000), 90000);
  eq(cd.phaseOf(t, T0 + 10000), 'calm');
  eq(cd.phaseOf(t, T0 + 70000), 'hurry');
  eq(cd.phaseOf(t, T0 + 100000), 'rush');
  eq(cd.phaseOf(t, T0 + 112000), 'final');
  eq(cd.phaseOf(t, T0 + 120000), 'over');
  eq(cd.clockText(t, T0), '2:00');
  eq(cd.clockText(t, T0 + 500), '2:00');
  eq(cd.clockText(t, T0 + 1000), '1:59');
  eq(cd.clockText(t, T0 + 132000), '+0:12');
});
test('minuteur : la pause ne compte pas', () => {
  let t = cd.createTimer({ childId: 'c1', taskId: 't1', date: TUESDAY, minutes: 1, now: T0 });
  t = cd.pauseTimer(t, T0 + 10000);
  eq(cd.remainingMs(t, T0 + 50000), 50000, 'figé pendant la pause');
  t = cd.resumeTimer(t, T0 + 50000);
  eq(cd.remainingMs(t, T0 + 60000), 40000);
});
test('minuteur : +1 min avant et après la sonnerie', () => {
  const t = cd.createTimer({ childId: 'c1', taskId: 't1', date: TUESDAY, minutes: 1, now: T0 });
  eq(cd.remainingMs(cd.addTime(t, 60000, T0 + 30000), T0 + 30000), 90000);
  const late = cd.addTime({ ...t, alarmed: true }, 60000, T0 + 90000);
  eq(cd.remainingMs(late, T0 + 90000), 60000, 'la minute part de maintenant');
  eq(late.alarmed, false);
});
test('minuteur : résultat à temps ou en retard', () => {
  const t = cd.createTimer({ childId: 'c1', taskId: 't1', date: TUESDAY, minutes: 5, now: T0 });
  const ok1 = cd.timerResult(cd.finishTimer(t, T0 + 192000), T0 + 999999);
  eq([ok1.elapsedMs, ok1.inTime, ok1.extended], [192000, true, false]);
  const late = cd.timerResult(cd.finishTimer(t, T0 + 345000), T0 + 345000);
  eq([late.inTime, late.elapsedMs - late.durationMs], [false, 45000]);
});
test('musique : suit le minuteur le plus proche de la fin', () => {
  const a = cd.createTimer({ childId: 'c1', taskId: 't1', date: TUESDAY, minutes: 10, now: T0 });
  const b = cd.createTimer({ childId: 'c2', taskId: 't2', date: TUESDAY, minutes: 1, now: T0 });
  eq(cd.musicMood([a], T0).level, 0);
  eq(cd.musicMood([a, b], T0 + 55000).level, 3, 'dernières secondes de b');
  eq(cd.musicMood([cd.pauseTimer(a, T0)], T0 + 1000), null, 'rien quand tout est en pause');
  eq(cd.musicMood([b], T0 + 61000), null, 'rien après la sonnerie');
  ok(cd.musicMood([a], T0 + 500000).bpm > cd.musicMood([a], T0).bpm, 'le tempo accélère');
});

// --- Code parent ------------------------------------------------------------------------------------
const hex = (u8) => Array.from(u8, (x) => x.toString(16).padStart(2, '0')).join('');
const utf8 = (str) => new TextEncoder().encode(str);
test('SHA-256 de secours (pages en http) : vecteurs officiels', () => {
  eq(hex(sha256Bytes(utf8(''))), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  eq(hex(sha256Bytes(utf8('abc'))), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  eq(hex(sha256Bytes(utf8('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))), '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  eq(hex(sha256Bytes(utf8('a'.repeat(1000)))), '41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3');
});
// Un code créé en HTTPS (crypto.subtle) doit rester valable en http (calcul de secours), et inversement
if (globalThis.crypto?.subtle) {
  const data = utf8('pandiflow:famille-test:1234');
  const viaBrowser = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', data)));
  const viaPin = await hashPin('1234', 'famille-test');
  test('code parent : même hash avec et sans crypto.subtle', () => {
    eq(hex(sha256Bytes(data)), viaBrowser);
    eq(viaPin, viaBrowser);
  });
}

// --- Affichage ------------------------------------------------------------------------------------
const passed = results.filter((r) => r.ok).length;
document.getElementById('summary').textContent = `${passed} / ${results.length} tests réussis`;
document.getElementById('summary').className = passed === results.length ? 'ok' : 'ko';
document.getElementById('results').innerHTML = results
  .map((r) => `<li class="${r.ok ? 'ok' : 'ko'}">${r.ok ? '✔' : '✘'} ${r.name}${r.ok ? '' : `<pre>${r.error.message}</pre>`}</li>`)
  .join('');
window.__testResults = { passed, total: results.length, failed: results.filter((r) => !r.ok).map((r) => `${r.name}: ${r.error.message}`) };
