import * as d from '../js/domain.js';
import { eveningDate, addDays, weekday, currentRoutine, routineDate, atTime, nextRoutineStart } from '../js/lib/dates.js';
import * as cd from '../js/lib/countdown.js';
import { sha256Bytes, hashPin } from '../js/lib/pin.js';
import { normalizeLook, DEFAULT_LOOK, randomLook } from '../js/avatar/palette.js';
import { getItem, offeredTo, starredFor, rayonOf } from '../js/avatar/items.js';

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

// --- Points (coopération) -------------------------------------------------------------
const withAge = (s, age) => ({ ...s, children: s.children.map((c) => (c.id === 'c1' ? { ...c, age } : c)) });
test('barème des grands : 🌟 3 / 👍 2 / ✋ 0', () => {
  const { state } = rateAll(withAge(fixture(), 7), [
    ['c1', 't1', MONDAY, 'green'],
    ['c1', 't2', MONDAY, 'orange'],
    ['c1', 't3', MONDAY, 'red'],
  ]);
  eq(d.balance('c1', state), 5);
});
test('barème des petits (moins de 6 ans) : 🌟 3 / 👍 2 / ✋ 1', () => {
  const { state } = rateAll(withAge(fixture(), 4), [
    ['c1', 't1', MONDAY, 'green'],
    ['c1', 't2', MONDAY, 'orange'],
    ['c1', 't3', MONDAY, 'red'],
  ]);
  eq(d.balance('c1', state), 6);
});
test('6 ans pile ou âge inconnu : barème des grands', () => {
  eq([d.scaleOf({ age: 5 }), d.scaleOf({ age: 6 }), d.scaleOf({ age: null }), d.scaleOf({}), d.scaleOf(null)], ['petit', 'grand', 'grand', 'grand', 'grand']);
});
test('⏸️ pas ce soir : 0 pandi, la routine compte comme notée', () => {
  const { state, result } = rateAll(withAge(fixture(), 4), [
    ['c1', 't1', TUESDAY, 'pause'],
    ['c1', 't2', TUESDAY, 'green'],
  ]);
  eq(d.balance('c1', state), 3);
  ok(result.becameComplete, 'routine finie');
});
test('plus de bonus de soirée parfaite', () => {
  const { state, result } = rateAll(fixture(), [
    ['c1', 't1', TUESDAY, 'green'],
    ['c1', 't2', TUESDAY, 'green'],
  ]);
  ok(result.becameComplete, 'soirée complète attendue');
  eq([d.balance('c1', state), state.ledger.length], [6, 0]);
});
test('un ancien bonus parfait déjà gagné reste acquis si on corrige une note', () => {
  const s = { ...fixture(), ledger: [{ id: 'perfect-c1-' + TUESDAY, child_id: 'c1', kind: 'perfect', amount: 5, evening_date: TUESDAY }] };
  const { state } = rateAll(s, [['c1', 't1', TUESDAY, 'orange']]);
  eq(d.balance('c1', state), 2 + 5);
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
  s = { ...s, settings: d.mergeSettings({ scales: { grand: { green: 10 } } }) };
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
test('look : visage 3D gardé seulement s\'il est valide', () => {
  const marks = { eyeLeftX: 0.4, eyeLeftY: 0.45, eyeRightX: 0.6, eyeRightY: 0.45, chinY: 0.74, topY: 0.08, headLeftX: 0.2, headRightX: 0.8 };
  const base = '11111111-2222-3333-4444-555555555555/66666666-7777-8888-9999-aaaaaaaaaaaa/mabc1234';
  const look = normalizeLook({ skin: 'miel', portrait: { base, exprs: { happy: marks, joy: { ...marks, chinY: 3 } }, skin: '#E0B090', off: false, x: 1 } });
  eq(look.portrait, { base, exprs: { happy: marks }, skin: '#E0B090' });
  ok(!('portrait' in normalizeLook({ portrait: { base: '../autre-famille', exprs: { happy: marks } } })));
  ok(!('portrait' in normalizeLook({ portrait: { base, exprs: { joy: marks } } })));
  eq(normalizeLook({ portrait: { base, exprs: { happy: marks }, off: true } }).portrait.off, true);
});
test('look : personnage 3D entier, repères du corps gardés seulement s\'ils sont tous valides', () => {
  const face = { eyeLeftX: 0.4, eyeLeftY: 0.25, eyeRightX: 0.6, eyeRightY: 0.25, chinY: 0.42, topY: 0.04, headLeftX: 0.24, headRightX: 0.76 };
  const body = {
    noseY: 0.31, mouthY: 0.36, collarX: 0.5, collarY: 0.48,
    shoulderLeftX: 0.32, shoulderLeftY: 0.51, shoulderRightX: 0.68, shoulderRightY: 0.51,
    elbowLeftX: 0.17, elbowLeftY: 0.68, elbowRightX: 0.83, elbowRightY: 0.68,
    wristLeftX: 0.31, wristLeftY: 0.84, wristRightX: 0.69, wristRightY: 0.84,
    handLeftX: 0.36, handLeftY: 0.86, handRightX: 0.64, handRightY: 0.86,
    waistLeftX: 0.33, waistRightX: 0.67, waistY: 0.86,
  };
  const base = '11111111-2222-3333-4444-555555555555/66666666-7777-8888-9999-aaaaaaaaaaaa/mabc1234';
  const all = { ...face, ...body };
  const look = normalizeLook({ portrait: { base, body: true, exprs: { happy: all, dance: all, joy: { ...all, elbowLeftX: 2 }, encourage: { ...face, noseY: 0.3 } } } });
  eq(look.portrait, { base, exprs: { happy: all, joy: face, encourage: face, dance: all }, body: true });
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
test('matin et soir le même jour : même barème, chaque routine se termine', () => {
  const { state, result } = rateAll(morningFixture(), [
    ['c1', 'm1', TUESDAY, 'green'],
    ['c1', 'm2', TUESDAY, 'green'],
  ]);
  ok(result.becameComplete, 'matin fini');
  eq(result.routine, 'matin');
  const evening = rateAll(state, [
    ['c1', 't1', TUESDAY, 'green'],
    ['c1', 't2', TUESDAY, 'green'],
  ]);
  ok(evening.result.becameComplete, 'soir fini aussi');
  eq(d.balance('c1', evening.state), 6 + 6);
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
test('musique : calme et régulière, même à la fin', () => {
  const a = cd.createTimer({ childId: 'c1', taskId: 't1', date: TUESDAY, minutes: 10, now: T0 });
  const b = cd.createTimer({ childId: 'c2', taskId: 't2', date: TUESDAY, minutes: 1, now: T0 });
  eq(cd.musicMood([a], T0).level, 0);
  eq(cd.musicMood([a, b], T0 + 55000).level, 0, 'pas d’emballement dans les dernières secondes');
  eq(cd.musicMood([cd.pauseTimer(a, T0)], T0 + 1000), null, 'rien quand tout est en pause');
  eq(cd.musicMood([b], T0 + 61000), null, 'rien après la fin');
  eq(cd.musicMood([a], T0 + 500000).bpm, cd.musicMood([a], T0).bpm, 'le tempo ne change pas');
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

// --- Carte d'équipe et équipe ------------------------------------------------------------------------------
test('carte d’équipe : +5 dans la cagnotte commune, une par soirée, rien sur les cagnottes des enfants', () => {
  let s = fixture();
  let r = d.applyTeamCard(s, { familyId: 'f', date: TUESDAY, level: 'top' });
  s = { ...s, ledger: r.ledger };
  eq([d.potBalance(s), d.balance('c1', s), d.balance('c2', s), r.amount, d.teamCardLevel(d.findTeamCard(s.ledger, TUESDAY))], [5, 0, 0, 5, 'top']);
  r = d.applyTeamCard(s, { familyId: 'f', date: TUESDAY, level: 'demain' });
  s = { ...s, ledger: r.ledger };
  eq([d.potBalance(s), s.ledger.length, d.teamCardLevel(d.findTeamCard(s.ledger, TUESDAY))], [0, 1, 'demain'], '« On fera mieux demain » ne retire rien');
  r = d.applyTeamCard(s, { familyId: 'f', date: TUESDAY, level: null });
  eq(r.ledger.length, 0);
});
test('carte d’équipe : un id propre à chaque famille, et l’ancien id du même soir est remplacé', () => {
  const s = fixture();
  const a = d.applyTeamCard(s, { familyId: 'famille-a', date: TUESDAY, level: 'top' }).ledger[0];
  const b = d.applyTeamCard(s, { familyId: 'famille-b', date: TUESDAY, level: 'top' }).ledger[0];
  ok(a.id !== b.id, 'deux familles, le même soir, deux lignes différentes');
  const old = { ...s, ledger: [{ id: `teamcard-${TUESDAY}`, family_id: 'f', child_id: 'c1', kind: 'teamcard', amount: 5, evening_date: TUESDAY, note: d.TEAM_CARD.top.label }] };
  eq(d.teamCardLevel(d.findTeamCard(old.ledger, TUESDAY)), 'top', 'l’ancienne carte est reconnue');
  const r = d.applyTeamCard(old, { familyId: 'f', date: TUESDAY, level: 'demain' });
  eq(r.ledger.map((l) => l.id), [d.teamCardId('f', TUESDAY)]);
  eq(r.ops.map((o) => o.op), ['del', 'put'], 'l’ancienne ligne est effacée, la nouvelle écrite');
  eq(d.applyTeamCard(old, { familyId: 'f', date: TUESDAY, level: null }).ops, [{ op: 'del', table: 'ledger', match: { id: `teamcard-${TUESDAY}` } }]);
});
test('coffre de l’équipe : 🌟 et 👍 font une pierre, ✋ et ⏸️ non, depuis le début choisi', () => {
  const { state } = rateAll(fixture(), [['c1', 't1', MONDAY, 'green'], ['c2', 't2', TUESDAY, 'green'], ['c1', 't2', TUESDAY, 'red']]);
  eq(d.treasureProgress(state).count, 2);
  eq(d.treasureProgress(rateAll(state, [['c1', 't2', MONDAY, 'orange'], ['c1', 't3', MONDAY, 'pause']]).state).count, 3, '👍 compte, ⏸️ non');
  const later = { ...state, settings: d.mergeSettings({ treasure: { goal: 2, start: TUESDAY } }) };
  eq([d.treasureProgress(later).count, d.treasureProgress(later).reached], [1, false]);
});
test('coffre de l’équipe : +10 pandi pour chacun à chaque palier, une seule fois, puis la récompense en vrai', () => {
  // Paliers de 3 pierres, coffre de 6 : deux paliers, et le coffre plein au bout
  let s = { ...fixture(), settings: d.mergeSettings({ team: { step: 3, bonus: 10 }, treasure: { goal: 6 } }) };
  const paliers = [];
  const list = [['c1', 't1', MONDAY, 'green'], ['c1', 't2', MONDAY, 'orange'], ['c2', 't2', MONDAY, 'red'], ['c2', 't2', TUESDAY, 'green'],
    ['c1', 't1', TUESDAY, 'green'], ['c1', 't2', TUESDAY, 'green'], ['c1', 't3', MONDAY, 'green']];
  for (const [childId, taskId, date, color] of list) {
    const r = d.applyRating(s, { familyId: 'f', childId, taskId, date, color });
    s = { ...s, ratings: r.ratings, ledger: r.ledger, owned: r.owned };
    if (r.result.palier) paliers.push(r.result.palier.n);
  }
  eq(paliers, [1, 2], 'un palier à 3 pierres, un autre à 6');
  eq(s.ledger.filter((l) => l.kind === 'team').map((l) => [l.child_id, l.amount]), [['c1', 10], ['c2', 10], ['c1', 10], ['c2', 10]]);
  const tp = d.treasureProgress(s);
  eq([tp.count, tp.reached, tp.paliers, tp.totalPaliers], [6, true, 2, 2]);
  // Une note corrigée en dessous d'un palier ne reprend rien, et le palier n'est pas redonné ensuite
  const down = d.applyRating(s, { familyId: 'f', childId: 'c1', taskId: 't3', date: MONDAY, color: 'red' });
  s = { ...s, ratings: down.ratings, ledger: down.ledger };
  const up = d.applyRating(s, { familyId: 'f', childId: 'c1', taskId: 't3', date: MONDAY, color: 'green' });
  eq([s.ledger.filter((l) => l.kind === 'team').length, up.result.palier], [4, null]);
});
test('coffre de l’équipe : pas de palier avec un seul enfant', () => {
  const solo = { ...fixture(), children: [{ id: 'c1', name: 'Léa' }], settings: d.mergeSettings({ team: { step: 1, bonus: 10 } }) };
  eq(d.applyRating(solo, { familyId: 'f', childId: 'c1', taskId: 't1', date: MONDAY, color: 'green' }).result.palier, null);
});
test('coup de main et cadeaux entre enfants', () => {
  let s = { ...fixture(), ledger: [{ id: 'l0', child_id: 'c1', kind: 'manual', amount: 10 }] };
  const h = d.applyHelp(s, { familyId: 'f', helper: { id: 'c1', name: 'Léa' }, helped: { id: 'c2', name: 'Sacha' }, ids: ['h1', 'h2'] });
  s = { ...s, ledger: h.ledger };
  eq([d.balance('c1', s), d.balance('c2', s)], [12, 2]);
  const g = d.applyGift(s, { familyId: 'f', from: { id: 'c2', name: 'Sacha' }, to: { id: 'c1', name: 'Léa' }, amount: 50, ids: ['g1', 'g2'] });
  eq(g.amount, 2, 'on n’offre pas plus que sa cagnotte');
  s = { ...s, ledger: g.ledger };
  eq([d.balance('c1', s), d.balance('c2', s)], [14, 0]);
});
test('cagnotte commune : on dépose, puis on achète un objet pour tous', () => {
  let s = { ...fixture(), ledger: [{ id: 'a', child_id: 'c1', kind: 'manual', amount: 100 }, { id: 'b', child_id: 'c2', kind: 'manual', amount: 50 }] };
  for (const [child, amount, id] of [['c1', 80, 'p1'], ['c2', 70, 'p2']]) {
    const r = d.applyPotDeposit(s, { familyId: 'f', child: { id: child }, amount, id });
    s = { ...s, ledger: r.ledger };
  }
  eq([d.potBalance(s), d.balance('c1', s), d.balance('c2', s)], [130, 20, 0], 'Sacha ne dépose que ce qu’il a');
  const item = { id: 'cabane', name: 'Cabane', price: 120, pot: true };
  eq(d.applyPotPurchase(s, { familyId: 'f', buyer: { id: 'c1' }, item: { ...item, price: 200 }, id: 'x' }).error !== undefined, true);
  const r = d.applyPotPurchase(s, { familyId: 'f', buyer: { id: 'c1' }, item, id: 'x' });
  s = { ...s, ledger: r.ledger, owned: r.owned };
  eq([d.potBalance(s), d.balance('c1', s), d.isOwned('c1', 'cabane', s.owned), d.isOwned('c2', 'cabane', s.owned)], [10, 20, true, true]);
});

// --- Relais http -> https ------------------------------------------------------------------------------
await import('../js/relais.js');
const R = window.PandiRelais;
test('relais : la connexion et les réglages passent intacts (accents, émojis)', () => {
  const items = { 'sb-kyhhkhmwdostzdaksxzw-auth-token': '{"access_token":"a.b.c","refresh_token":"r"}', 'pandiflow-prefs': '{"sound":true,"note":"Léa 🐼"}' };
  const now = Date.now();
  const code = R.encode(items, now);
  ok(/^[A-Za-z0-9_-]+$/.test(code), 'code utilisable dans une adresse');
  eq(R.decode(code, now + 1000), items);
});
test('relais : refusé s’il est trop vieux ou abîmé', () => {
  const now = Date.now();
  eq(R.decode(R.encode({ 'pandiflow-prefs': '{}' }, now - 5 * 60000), now), null);
  eq(R.decode('nimporte-quoi', now), null);
});
test('relais : seules les clés de Pandi et de Supabase passent', () => {
  const now = Date.now();
  eq(R.decode(R.encode({ 'pandiflow-timers': '[]', autre: 'x', 'sb-x-auth-token': 'y' }, now), now), { 'pandiflow-timers': '[]', 'sb-x-auth-token': 'y' });
});

// --- Pont pandiflow.com -> www (cookie /relais/) -------------------------------------------------------
function fakeStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}
const SESSION = 'sb-kyhhkhmwdostzdaksxzw-auth-token';
const sessionValue = JSON.stringify({ access_token: 'x'.repeat(1200), refresh_token: 'r1', expires_at: 1, user: { id: 'u', email: 'léa@exemple.fr' } });
function asCookies(parts) {
  return [`pf_pont=${parts.length}`, ...parts.map((p, i) => `pf_pont${i}=${p}`), 'autre=1'].join('; ');
}
test('pont : la connexion et les réglages passent par le cookie', () => {
  const from = fakeStorage({ [SESSION]: sessionValue, 'pandiflow-prefs': '{"sound":true}', 'pandiflow-outbox': '[]', 'pandiflow-demo-v1': '{}', autre: 'x' });
  const parts = R.bridgeParts(from, Date.now());
  ok(parts.length >= 1 && parts.every((p) => /^[A-Za-z0-9_-]+$/.test(p) && p.length <= 3000), 'morceaux utilisables dans un cookie');
  eq(R.readParts(asCookies(parts), Date.now()), { [SESSION]: sessionValue, 'pandiflow-outbox': '[]', 'pandiflow-prefs': '{"sound":true}' });
});
test('pont : rien sans connexion, rien si un morceau manque', () => {
  eq(R.bridgeParts(fakeStorage({ 'pandiflow-prefs': '{}' }), Date.now()), null);
  const parts = R.bridgeParts(fakeStorage({ [SESSION]: sessionValue }), Date.now());
  eq(R.readParts(asCookies(parts).replace('pf_pont0=', 'pf_pontX='), Date.now()), null);
  eq(R.readParts('pf_pont=9', Date.now()), null);
});
test('pont : un réglage trop gros reste, la connexion passe quand même', () => {
  const parts = R.bridgeParts(fakeStorage({ [SESSION]: sessionValue, 'pandiflow-timers': 'z'.repeat(20000) }), Date.now());
  eq(Object.keys(R.readParts(asCookies(parts), Date.now())), [SESSION]);
});
test('pont : refusé au-delà de 30 jours', () => {
  const parts = R.bridgeParts(fakeStorage({ [SESSION]: sessionValue }), Date.now() - 31 * 86400000);
  eq(R.readParts(asCookies(parts), Date.now()), null);
});

// Pour de vrai dans ce navigateur : cookie écrit, lu par la page cachée /relais/, rangé, effacé
const bridgeRun = await new Promise((resolve) => {
  const from = fakeStorage({ [SESSION]: sessionValue, 'pandiflow-email': 'léa@exemple.fr' });
  R.setBridge(R.bridgeParts(from, Date.now()), '');
  const hiddenHere = !document.cookie.includes('pf_pont');
  const to = fakeStorage({ 'pandiflow-email': 'deja@la.fr' });
  R.readBridge(to, '', (n) => {
    const probe = document.createElement('iframe');
    probe.style.display = 'none';
    probe.onload = () => {
      const left = probe.contentDocument.cookie;
      probe.remove();
      resolve({ n, hiddenHere, stored: to.dump(), left });
    };
    probe.src = '/relais/?verif';
    document.body.appendChild(probe);
  });
});
test('pont : la page cachée lit le cookie, range sans écraser, puis l’efface', () => {
  ok(bridgeRun.hiddenHere, 'le cookie ne doit pas être visible hors de /relais/');
  eq(bridgeRun.n, 1);
  eq(bridgeRun.stored, { 'pandiflow-email': 'deja@la.fr', [SESSION]: sessionValue });
  ok(!bridgeRun.left.includes('pf_pont'), `cookie encore là : ${bridgeRun.left}`);
});

// --- Sexe de l'enfant et boutique ------------------------------------------------------------------
test('accords : féminin pour une fille, masculin sinon', () => {
  eq(d.accorder('Tu étais très {heureux|heureuse}', { sex: 'fille' }), 'Tu étais très heureuse');
  eq(d.accorder('Tu étais très {heureux|heureuse}', { sex: 'garcon' }), 'Tu étais très heureux');
  eq(d.accorder('{Prêt|Prête} ?', {}), 'Prêt ?');
  eq(d.accordDeep({ a: ['{le|la}'], n: 3 }, { sex: 'fille' }), { a: ['la'], n: 3 });
});
test('boutique : kippas et talit katan proposés aux garçons seulement, mis en avant pour eux', () => {
  const kippa = getItem('kippa_velours');
  ok(kippa && rayonOf(kippa) === 'judaica' && kippa.slot === 'hat');
  ok(!offeredTo(kippa, 'fille') && offeredTo(kippa, 'garcon') && offeredTo(kippa, null));
  ok(starredFor(kippa, 'garcon') && !starredFor(kippa, null));
  ok(starredFor(getItem('bougies_chabbat'), 'fille') && offeredTo(getItem('bougies_chabbat'), 'garcon'));
});

// --- Tsedaka ----------------------------------------------------------------------------------------
function tsedakaFixture() {
  const s = { ...fixture(), ledger: [{ id: 'b1', child_id: 'c1', kind: 'manual', amount: 40 }, { id: 'b2', child_id: 'c2', kind: 'manual', amount: 10 }] };
  return s;
}
test('tsedaka : un don retire les pandi, sans dépasser la cagnotte', () => {
  const s = tsedakaFixture();
  const r = d.applyTsedaka(s, { familyId: 'f', child: { id: 'c1' }, amount: 25, association: 'Kollel', id: 'z1' });
  eq(r.amount, 25);
  eq(d.balance('c1', { ...s, ledger: r.ledger }), 15);
  eq(d.tsedakaGiven('c1', { ledger: r.ledger }), 25);
  eq(d.applyTsedaka({ ...s, ledger: r.ledger }, { familyId: 'f', child: { id: 'c1' }, amount: 99, id: 'z2' }).amount, 15);
});
test('tsedaka : à verser par association, en euros au taux des parents, puis versé', () => {
  let s = { ...tsedakaFixture(), settings: d.mergeSettings({ tsedaka: { rate: 10, associations: ['Kollel'] } }) };
  s = { ...s, ledger: d.applyTsedaka(s, { familyId: 'f', child: { id: 'c1' }, amount: 25, association: 'Kollel', id: 'z1' }).ledger };
  s = { ...s, ledger: d.applyTsedaka(s, { familyId: 'f', child: { id: 'c2' }, amount: 5, association: null, id: 'z2' }).ledger };
  const due = d.tsedakaDue(s);
  eq(due.map((g) => [g.association, g.pandi, g.euros]), [['Kollel', 25, 2.5], [d.TSEDAKA_LATER, 5, 0.5]]);
  const paid = d.applyTsedakaPaid(s, { familyId: 'f', association: d.TSEDAKA_LATER, to: 'Hôpital' });
  s = { ...s, ledger: paid.ledger };
  eq(d.tsedakaDue(s).map((g) => g.association), ['Kollel']);
  eq(d.tsedakaPaidTotals(s), { 'Hôpital': 5 });
  eq(d.balance('c2', s), 5, 'le versement ne touche pas la cagnotte');
  // Un don versé ne s'annule plus ; un don en attente, si
  eq(d.applyTsedakaCancel(s, { id: 'z2' }).ops.length, 0);
  eq(d.applyTsedakaCancel(s, { id: 'z1' }).ops.length, 1);
});
test('tsedaka : badges de mitsva accordés', () => {
  const s = { ledger: [{ id: 'z', child_id: 'c1', kind: 'tsedaka', amount: -260 }] };
  const b = d.tsedakaBadges({ id: 'c1', sex: 'fille' }, s);
  eq(b.filter((x) => x.got).length, 4);
  eq(b[3].label, 'Petite tsadéket');
});

// --- Surprise de Pandi ---------------------------------------------------------------------------------
const SRP_KIDS = [{ id: 'c1', name: 'Léa', age: 7, sex: 'fille' }, { id: 'c2', name: 'Sacha', age: 5 }];
function srpAdd(list, id, from, cards) {
  return d.applySurpriseOp(list, { type: 'add', surprise: { id, created: from, from, team: false, cards } });
}

test('surprise : préparée le soir, elle arrive le lendemain matin ; le matin, pour la routine du soir', () => {
  const at = (y, m, dd, h, mi = 0) => new Date(y, m - 1, dd, h, mi);
  const iso = (dt) => `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()} ${dt.getHours()}h`;
  eq(iso(nextRoutineStart(at(2026, 10, 27, 21, 30))), '2026-10-28 4h', 'le soir');
  eq(iso(nextRoutineStart(at(2026, 10, 27, 1, 0))), '2026-10-27 4h', 'après minuit');
  eq(iso(nextRoutineStart(at(2026, 10, 27, 7, 45))), '2026-10-27 13h', 'le matin');
  eq(iso(nextRoutineStart(at(2026, 10, 27, 13, 0))), '2026-10-28 4h', 'à 13 h pile');
});

test('surprise : le paquet attend son heure, s’ouvre une fois, puis devient une promesse à tenir', () => {
  const t0 = Date.parse('2026-10-28T04:00:00Z');
  let list = srpAdd([], 's1', '2026-10-28T04:00:00Z', [{ childId: 'c1', cardId: 'pv-histoire', emoji: '📖', text: 'Tu choisis l’histoire du soir' }, { childId: 'c2', cardId: 'pv-dessert', emoji: '🍰', text: 'Tu choisis le dessert de Chabbat' }]);
  const settings = () => ({ surprises: list });
  eq(d.pendingSurprise(settings(), 'c1', t0 - 1000), null, 'pas avant l’heure');
  eq(d.pendingSurprise(settings(), 'c1', t0).card.cardId, 'pv-histoire');
  list = d.applySurpriseOp(list, { type: 'open', id: 's1', childId: 'c1', at: '2026-10-28T06:30:00Z' });
  list = d.applySurpriseOp(list, { type: 'open', id: 's1', childId: 'c1', at: '2026-10-28T09:00:00Z' });
  eq(list[0].opened.c1, '2026-10-28T06:30:00Z', 'ouvert une seule fois');
  eq(d.pendingSurprise(settings(), 'c1', t0 + 3600e3), null);
  ok(d.pendingSurprise(settings(), 'c2', t0 + 3600e3), 'le paquet de Sacha attend toujours');
  eq(d.promiseFor(settings(), 'c1', t0 + 3600e3).card.text, 'Tu choisis l’histoire du soir');
  eq(d.surpriseBoard(settings(), t0).toKeep[0].cards.map((c) => c.childId), ['c1']);
  // Personne ne peut l'annuler une fois ouverte ; la promesse tenue disparaît de la télé
  eq(d.applySurpriseOp(list, { type: 'cancel', id: 's1' }).length, 1);
  list = d.applySurpriseOp(list, { type: 'keep', id: 's1', childId: 'c1', at: '2026-10-28T20:00:00Z' });
  eq(d.promiseFor(settings(), 'c1', t0 + 3600e3), null);
  eq(d.surpriseBoard(settings(), t0).kept.length, 1);
  // Le rappel s'arrête après une semaine, même sans « Tenu »
  const l2 = d.applySurpriseOp(srpAdd([], 's2', '2026-10-01T04:00:00Z', [{ childId: 'c1', emoji: '🎲', text: 'x' }]), { type: 'open', id: 's2', childId: 'c1', at: '2026-10-01T06:00:00Z' });
  eq(d.promiseFor({ surprises: l2 }, 'c1', Date.parse('2026-10-09T06:00:00Z')), null);
});

test('surprise : jamais de pandi, une surprise pas encore ouverte s’annule, l’historique reste court', () => {
  const base = fixture();
  const s = { ...base, settings: d.mergeSettings({ surprises: srpAdd([], 's1', '2026-10-28T04:00:00Z', [{ childId: 'c1', emoji: '🎁', text: 'x' }]) }) };
  eq(d.balance('c1', s), d.balance('c1', base), 'la cagnotte ne bouge pas');
  eq(d.applySurpriseOp(s.settings.surprises, { type: 'cancel', id: 's1' }).length, 0);
  let list = [];
  for (let i = 0; i < d.SURPRISE_HISTORY + 5; i++) {
    list = srpAdd(list, `s${i}`, '2026-10-01T04:00:00Z', [{ childId: 'c1', emoji: '🎁', text: 'x' }]);
    list = d.applySurpriseOp(list, { type: 'keep', id: `s${i}`, at: '2026-10-02T04:00:00Z' });
  }
  list = srpAdd(list, 'last', '2026-10-01T04:00:00Z', [{ childId: 'c1', emoji: '🎁', text: 'x' }]);
  eq(list.length, d.SURPRISE_HISTORY);
  ok(list.some((x) => x.id === 'last'), 'la surprise en attente reste');
  eq(d.mergeSettings({}).surprises, []);
  eq(d.mergeSettings({ surprises: 'abîmé' }).surprises, []);
});

test('surprise : les cartes suivent l’âge, l’équipe a les siennes, et chacun reçoit une carte différente', () => {
  const settings = d.mergeSettings({});
  const petit = d.privilegesFor(SRP_KIDS[1], settings).map((p) => p.id);
  const grand = d.privilegesFor(SRP_KIDS[0], settings).map((p) => p.id);
  ok(petit.includes('pv-plantes') && !petit.includes('pv-minuteur'), 'cartes des petits');
  ok(grand.includes('pv-minuteur') && !grand.includes('pv-plantes'), 'cartes des grands');
  ok(d.privilegesFor(null, settings, true).every((p) => p.family === 'equipe'), 'cartes de l’équipe');
  ok(!grand.some((id) => id.startsWith('pv-eq-')), 'pas de carte d’équipe pour un seul enfant');
  const first = d.suggestPrivilege(SRP_KIDS[0], settings);
  const second = d.suggestPrivilege(SRP_KIDS[1], settings, { avoid: [first.id] });
  ok(first.id !== second.id, 'deux cartes différentes');
  // La carte déjà reçue passe après les autres
  const used = { ...settings, surprises: srpAdd([], 's1', '2026-10-01T04:00:00Z', [d.privilegeCard(first, SRP_KIDS[0])]) };
  ok(d.suggestPrivilege(SRP_KIDS[0], used).id !== first.id, 'on ne repropose pas la même tout de suite');
  eq(d.privilegeCard(d.DEFAULT_PRIVILEGES.find((p) => p.id === 'pv-chef'), SRP_KIDS[0]).text, 'Tu es la cheffe : tu aides à préparer le dîner');
});

test('surprise : une carte qui mettrait en jeu le câlin ou « le droit à l’histoire » est signalée', () => {
  ok(d.privilegeWarning('Tu as droit à une histoire'));
  ok(d.privilegeWarning('Un câlin en plus'));
  eq(d.privilegeWarning('Tu choisis l’histoire du soir'), null);
  ok(d.DEFAULT_PRIVILEGES.every((p) => !d.privilegeWarning(p.text)), 'aucune carte de départ ne met le temps de base en jeu');
});

// --- Affichage ------------------------------------------------------------------------------------
const passed = results.filter((r) => r.ok).length;
document.getElementById('summary').textContent = `${passed} / ${results.length} tests réussis`;
document.getElementById('summary').className = passed === results.length ? 'ok' : 'ko';
document.getElementById('results').innerHTML = results
  .map((r) => `<li class="${r.ok ? 'ok' : 'ko'}">${r.ok ? '✔' : '✘'} ${r.name}${r.ok ? '' : `<pre>${r.error.message}</pre>`}</li>`)
  .join('');
window.__testResults = { passed, total: results.length, failed: results.filter((r) => !r.ok).map((r) => `${r.name}: ${r.error.message}`) };
