// Actions de l'app : elles mettent à jour l'état tout de suite (interface instantanée)
// puis enregistrent les changements dans le stockage (localStorage ou Supabase).
import { getState, setState, toast } from './store.js';
import { LocalRepo } from './localRepo.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, APP_VERSION } from '../config.js';
import * as domain from '../domain.js';
import { STATE_KEYS, sameKey, matches } from './tables.js';
import { buildFamilySeed, buildMorningSeed, makeChild, DEMO_CHILDREN } from './seed.js';
import { uid, sleep, measure } from './util.js';
import { toISODate, nextRoutineStart } from './dates.js';
import { hashPin, checkPin } from './pin.js';
import { getItem } from '../avatar/items.js';
import { normalizeLook, randomLook } from '../avatar/palette.js';
import { setPortraitSource, primePortrait, portraitPath, loadPortrait, forgetPortrait, hasBody } from './portraits.js';

let repo = null;
export const getRepo = () => repo;

export const isCloudConfigured = () =>
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY) && !new URLSearchParams(location.search).has('demo');

// --- Démarrage ----------------------------------------------------------------
export async function boot() {
  performance.mark?.('pandiflow:boot');
  try {
    if (isCloudConfigured()) {
      const { SupabaseRepo } = await import('./supabaseRepo.js');
      repo = new SupabaseRepo();
      setPortraitSource((path) => repo.downloadPortrait(path));
      setState({ mode: 'cloud' });
      loadOutbox();
      const user = await repo.getUser();
      if (!user) return setState({ status: 'auth' });
      // Retour du lien « mot de passe oublié » : on choisit d'abord un nouveau mot de passe
      if (repo.recovery) return setState({ status: 'recovery', user });
      return afterLogin(user);
    }
    repo = new LocalRepo();
    setState({ mode: 'demo', user: await repo.getUser() });
    if (!(await repo.getFamily())) await createDemoFamily();
    await reload();
  } catch (e) {
    console.error(e);
    setState({ status: 'error', error: e.message || String(e) });
  }
}

async function afterLogin(user) {
  setState({ user });
  const family = await repo.getFamily();
  if (!family) return setState({ status: 'setup' });
  await flush();
  await reload();
  repairPortraits();
}

export async function reload() {
  const start = performance.now();
  const data = await repo.loadAll(getState().family?.id);
  setState({ ...data, settings: domain.mergeSettings(data.family?.settings), status: 'ready' });
  measure('pandiflow:reload', start, { ratings: data.ratings.length, ledger: data.ledger.length });
  ensureMorningTasks();
}

// Le mode matin est arrivé après coup : une famille existante reçoit une seule fois
// les tâches du matin par défaut (elle peut ensuite les modifier ou les supprimer).
function ensureMorningTasks() {
  const s = getState();
  if (!s.family || s.settings.morningSeeded) return;
  if (!s.tasks.some((t) => domain.routineOf(t) === 'matin')) {
    const kids = domain.activeChildren(s.children);
    const seed = buildMorningSeed(familyId(), kids, Math.max(-1, ...s.tasks.map((t) => t.sort ?? 0)) + 1);
    put('tasks', seed.tasks);
    if (seed.childTasks.length) put('child_tasks', seed.childTasks);
  }
  updateSettings({ morningSeeded: true });
}

// Une version plus récente de l'app est-elle en ligne ? (sur téléphone, rouvrir l'app la reprend
// souvent sans la recharger : l'ancien code reste en mémoire)
async function newerVersionOnline() {
  try {
    const res = await fetch(`./js/config.js?v=${Date.now()}`, { cache: 'no-store' });
    const online = res.ok ? (await res.text()).match(/APP_VERSION = '([^']+)'/)?.[1] : null;
    return Boolean(online && online !== APP_VERSION);
  } catch {
    return false;
  }
}

// Rafraîchit les données quand l'app revient au premier plan (synchro entre parents), et se recharge
// d'elle-même si une nouvelle version est en ligne (les notes en attente sont envoyées avant).
export function watchVisibility() {
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    if (await newerVersionOnline()) {
      if (getState().mode === 'cloud') await flush().catch(() => {});
      location.reload();
      return;
    }
    const s = getState();
    if (s.mode !== 'cloud' || s.status !== 'ready') return;
    await flush();
    if (!outbox.length) reload().catch(() => {});
  });
  window.addEventListener('online', () => flush());
}

// --- File d'attente d'écriture --------------------------------------------------
// En cloud, chaque écriture passe par une file conservée dans le localStorage :
// si le réseau coupe pendant la soirée, rien n'est perdu.
const OUTBOX_KEY = 'pandiflow-outbox';
let outbox = [];
let flushing = false;
let retryTimer = null;
let offlineWarned = false;

function loadOutbox() {
  try {
    outbox = JSON.parse(localStorage.getItem(OUTBOX_KEY)) || [];
  } catch {
    outbox = [];
  }
}
function saveOutbox() {
  if (getState().mode === 'cloud') localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
  setState({ pendingOps: outbox.length });
}

function commit(ops) {
  if (!ops.length) return;
  outbox.push(...ops);
  saveOutbox();
  flush();
}

async function flush() {
  if (flushing || !repo) return;
  flushing = true;
  setState({ syncing: true });
  try {
    while (outbox.length) {
      const op = outbox[0];
      try {
        if (op.op === 'put') await repo.put(op.table, op.rows);
        else if (op.op === 'del') await repo.del(op.table, op.match);
        else if (op.op === 'family') await writeSettings(op);
        else if (op.op === 'surprise') await writeSurprise(op);
      } catch (e) {
        const status = e?.status || 0;
        if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
          console.error('Écriture refusée, abandonnée', op, e);
          toast("Une modification n'a pas pu être enregistrée.", 'error');
        } else {
          throw e;
        }
      }
      outbox.shift();
      saveOutbox();
    }
    offlineWarned = false;
  } catch (e) {
    console.warn('Synchronisation reportée', e);
    if (!offlineWarned) {
      toast('Pas de connexion : les notes seront envoyées dès que possible.', 'warn', 4500);
      offlineWarned = true;
    }
    clearTimeout(retryTimer);
    retryTimer = setTimeout(flush, 6000);
  } finally {
    flushing = false;
    setState({ syncing: false, pendingOps: outbox.length });
  }
}

// Les réglages sont un seul objet partagé par les téléphones des parents : on relit la version du
// serveur et on n'y change que les clés modifiées ici, pour ne pas écraser ce que l'autre a fait.
// (Les anciennes écritures sans liste de clés envoient tout, comme avant.)
async function writeSettings(op) {
  if (!op.keys || !repo.getSettings) return repo.updateFamily(op.familyId, op.patch);
  const latest = await repo.getSettings(op.familyId);
  const settings = { ...latest };
  for (const k of op.keys) settings[k] = op.patch.settings[k];
  await repo.updateFamily(op.familyId, { settings });
}

// Une surprise de Pandi (préparée, ouverte, tenue) est rejouée sur la liste la plus récente
async function writeSurprise(op) {
  const latest = await repo.getSettings(op.familyId);
  const surprises = domain.applySurpriseOp(latest.surprises, op.desc);
  await repo.updateFamily(op.familyId, { settings: { ...latest, surprises } });
}

function statePut(table, rows) {
  const key = STATE_KEYS[table];
  const list = [...getState()[key]];
  for (const row of rows) {
    const i = list.findIndex((r) => sameKey(table, r, row));
    if (i >= 0) list[i] = { ...list[i], ...row };
    else list.push(row);
  }
  setState({ [key]: list });
}
function stateDel(table, match) {
  const key = STATE_KEYS[table];
  setState({ [key]: getState()[key].filter((r) => !matches(r, match)) });
}
function put(table, rows) {
  statePut(table, rows);
  commit([{ op: 'put', table, rows }]);
}
function del(table, match) {
  stateDel(table, match);
  commit([{ op: 'del', table, match }]);
}

const familyId = () => getState().family.id;

// --- Notes de la soirée -----------------------------------------------------------
export function rate(childId, taskId, date, color) {
  const s = getState();
  const treasureBefore = domain.treasureProgress(s);
  const { ratings, ledger, owned, ops, result } = domain.applyRating(s, {
    familyId: familyId(),
    childId,
    taskId,
    date,
    color,
  });
  setState({ ratings, ledger, owned });
  commit(ops);
  // Coffre de l'équipe : on note le jour où il est plein (la récompense en vrai)
  const treasureAfter = domain.treasureProgress(getState());
  if (!treasureBefore.reached && treasureAfter.reached && !treasureAfter.done) {
    updateSettings({ treasure: { ...getState().settings.treasure, done: date } });
    result.treasure = treasureAfter.reward;
  }
  return result;
}

// --- Carte d'équipe de fin de soirée (la même pour tous, versée dans la cagnotte commune) ------------
export function setTeamCard(date, level) {
  const s = getState();
  const res = domain.applyTeamCard(s, { familyId: familyId(), date, level });
  setState({ ledger: res.ledger });
  commit(res.ops);
  return res;
}

// --- Équipe ------------------------------------------------------------------------------
export function giveHelp(helperId, helpedId) {
  const s = getState();
  const helper = s.children.find((c) => c.id === helperId);
  const helped = s.children.find((c) => c.id === helpedId);
  if (!helper || !helped) return { amount: 0 };
  const res = domain.applyHelp(s, { familyId: familyId(), helper, helped, ids: [uid(), uid()] });
  setState({ ledger: res.ledger });
  commit(res.ops);
  return res;
}

export function giveGift(fromId, toId, amount) {
  const s = getState();
  const from = s.children.find((c) => c.id === fromId);
  const to = s.children.find((c) => c.id === toId);
  const res = domain.applyGift(s, { familyId: familyId(), from, to, amount, ids: [uid(), uid()] });
  if (res.amount) {
    setState({ ledger: res.ledger });
    commit(res.ops);
  }
  return res;
}

export function potDeposit(childId, amount) {
  const s = getState();
  const child = s.children.find((c) => c.id === childId);
  const res = domain.applyPotDeposit(s, { familyId: familyId(), child, amount, id: uid() });
  if (res.amount) {
    setState({ ledger: res.ledger });
    commit(res.ops);
  }
  return res;
}

export function potBuy(buyerId, itemId) {
  const s = getState();
  const buyer = s.children.find((c) => c.id === buyerId) || domain.activeChildren(s.children)[0];
  const res = domain.applyPotPurchase(s, { familyId: familyId(), buyer, item: getItem(itemId), id: uid() });
  if (res.error) return res;
  setState({ ledger: res.ledger, owned: res.owned });
  commit(res.ops);
  return { ok: true };
}

// --- Tsedaka ---------------------------------------------------------------------------
export function tsedakaGive(childId, amount, association) {
  const s = getState();
  const child = s.children.find((c) => c.id === childId);
  const res = domain.applyTsedaka(s, { familyId: familyId(), child, amount, association, id: uid() });
  if (res.amount) {
    setState({ ledger: res.ledger });
    commit(res.ops);
  }
  return res;
}

// Les parents ont versé les dons d'une association (to : l'association choisie pour « Les parents choisiront »)
export function tsedakaPaid(association, to = null) {
  const res = domain.applyTsedakaPaid(getState(), { familyId: familyId(), association, to });
  if (res.count) {
    setState({ ledger: res.ledger });
    commit(res.ops);
  }
  return res;
}

export function tsedakaCancel(id) {
  const res = domain.applyTsedakaCancel(getState(), { id });
  if (res.row) {
    setState({ ledger: res.ledger });
    commit(res.ops);
  }
  return res;
}

// Nouveau coffre de l'équipe (après en avoir rempli un, ou pour changer de récompense)
export function newTreasure({ goal, reward }) {
  updateSettings({ treasure: { goal, reward, start: toISODate(new Date()), done: null } });
}

// --- Boutique et avatar ------------------------------------------------------------
export function buy(childId, itemId) {
  const item = getItem(itemId);
  const res = domain.applyPurchase(getState(), { familyId: familyId(), childId, item, id: uid() });
  if (res.error) return { error: res.error };
  setState({ ledger: res.ledger, owned: res.owned });
  commit(res.ops);
  equip(childId, item.slot, item.id);
  return { ok: true };
}

export function equip(childId, slot, itemId) {
  const child = getState().children.find((c) => c.id === childId);
  if (!child) return;
  const equipped = { ...(child.equipped || {}) };
  if (itemId) equipped[slot] = itemId;
  else delete equipped[slot];
  put('children', [{ ...child, equipped }]);
}

export function saveLook(childId, look) {
  const child = getState().children.find((c) => c.id === childId);
  if (!child) return;
  put('children', [{ ...child, look: normalizeLook(look) }]);
}

// --- Enfants -------------------------------------------------------------------------
export function addChild({ name, age, sex = null, color, look }) {
  const s = getState();
  const child = makeChild(familyId(), { name, age, sex, color, look: look || randomLook() }, s.children.length);
  put('children', [child]);
  const links = s.tasks.filter((t) => !t.archived).map((t) => ({ family_id: familyId(), child_id: child.id, task_id: t.id }));
  if (links.length) put('child_tasks', links);
  return child;
}

export function saveChild(child) {
  put('children', [child]);
}

export function archiveChild(childId, archived = true) {
  const child = getState().children.find((c) => c.id === childId);
  if (child) put('children', [{ ...child, archived }]);
}

// --- Tâches ----------------------------------------------------------------------------
export function addTask({ title, emoji, days, childIds, routine = 'soir' }) {
  const s = getState();
  const task = {
    id: uid(),
    family_id: familyId(),
    title,
    emoji,
    days: days || [0, 1, 2, 3, 4, 5, 6],
    sort: Math.max(-1, ...s.tasks.map((t) => t.sort ?? 0)) + 1,
    active: true,
    archived: false,
    routine,
  };
  put('tasks', [task]);
  setTaskChildren(task.id, childIds || domain.activeChildren(s.children).map((c) => c.id));
  return task;
}

export function saveTask(task) {
  put('tasks', [task]);
}

// Une tâche n'est jamais supprimée pour de vrai : ses notes passées (et les pandi gagnés) restent.
export function archiveTask(taskId) {
  const task = getState().tasks.find((t) => t.id === taskId);
  if (task) put('tasks', [{ ...task, active: false, archived: true }]);
}

export function setTaskChildren(taskId, childIds) {
  const s = getState();
  const current = new Set(s.childTasks.filter((ct) => ct.task_id === taskId).map((ct) => ct.child_id));
  const wanted = new Set(childIds);
  const toAdd = [...wanted].filter((id) => !current.has(id)).map((child_id) => ({ family_id: familyId(), child_id, task_id: taskId }));
  if (toAdd.length) put('child_tasks', toAdd);
  for (const id of current) if (!wanted.has(id)) del('child_tasks', { child_id: id, task_id: taskId });
}

// Change l'ordre d'une tâche au sein de sa routine (cet ordre est celui du carrousel)
export function moveTask(taskId, dir) {
  const tasks = getState().tasks;
  const routine = domain.routineOf(tasks.find((t) => t.id === taskId));
  const list = tasks.filter((t) => !t.archived && domain.routineOf(t) === routine).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  const i = list.findIndex((t) => t.id === taskId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  const base = routine === 'matin' ? 100 : 0;
  put('tasks', list.map((t, k) => ({ ...t, sort: base + k })));
}

// --- Défis ------------------------------------------------------------------------------
export function saveChallenge(ch) {
  put('challenges', [{ family_id: familyId(), active: true, child_id: null, bonus: 0, ...ch, id: ch.id || uid() }]);
}

export function deleteChallenge(id) {
  del('challenges', { id });
}

// --- Pandi ---------------------------------------------------------------------------------
// Ajout (amount > 0) ou retrait (amount < 0) de pandi hors des routines.
// Renvoie { applied, before, after } : le retrait est plafonné au solde.
export function adjustPandi(childId, amount, note) {
  const res = domain.applyAdjust(getState(), { familyId: familyId(), childId, amount, note, id: uid() });
  if (res.applied) {
    setState({ ledger: res.ledger });
    commit(res.ops);
  }
  return { applied: res.applied, before: res.before, after: res.after };
}

// --- Réglages de la famille ------------------------------------------------------------------
export function updateSettings(patch) {
  const s = getState();
  const settings = domain.mergeSettings({ ...s.settings, ...patch });
  const family = { ...s.family, settings };
  setState({ settings, family });
  commit([{ op: 'family', familyId: family.id, patch: { settings }, keys: Object.keys(patch) }]);
}

// --- Surprise de Pandi (préparée par les parents, ouverte par l'enfant sur la télé) ---------------------
function surpriseOp(desc) {
  const s = getState();
  const settings = { ...s.settings, surprises: domain.applySurpriseOp(s.settings.surprises, desc) };
  setState({ settings, family: { ...s.family, settings } });
  commit([{ op: 'surprise', familyId: familyId(), desc }]);
}

// cards : [{ childId, cardId, emoji, text }] ; now : la surprise arrive tout de suite, sinon au début
// de la routine suivante (préparée le soir, elle attend le lendemain matin)
export function prepareSurprise({ cards, team = false, now = false }) {
  const created = new Date();
  const surprise = { id: uid(), created: created.toISOString(), from: (now ? created : nextRoutineStart(created)).toISOString(), team, cards };
  surpriseOp({ type: 'add', surprise });
  return surprise;
}
export const openSurprise = (id, childId) => surpriseOp({ type: 'open', id, childId, at: new Date().toISOString() });
export const keepSurprise = (id, childId = null) => surpriseOp({ type: 'keep', id, childId, at: new Date().toISOString() });
export const cancelSurprise = (id) => surpriseOp({ type: 'cancel', id });

export async function setPin(pin) {
  updateSettings({ pinHash: await hashPin(pin, familyId()) });
  unlockParent();
}

export async function verifyPin(pin) {
  const ok = await checkPin(pin, familyId(), getState().settings.pinHash);
  if (ok) unlockParent();
  return ok;
}

// L'espace parent reste ouvert 10 minutes après le code.
export function unlockParent() {
  setState({ parentUnlockedUntil: Date.now() + 10 * 60 * 1000 });
}
export function lockParent() {
  setState({ parentUnlockedUntil: 0 });
}
export const isParentUnlocked = () => getState().parentUnlockedUntil > Date.now();

// --- Photo -> avatar ----------------------------------------------------------------------------
export async function analyzePhoto(childId, imageBase64, mediaType = 'image/jpeg') {
  if (getState().mode !== 'cloud') {
    // Mode démo : pas d'appel à Claude, on imagine un avatar au hasard.
    await sleep(3500);
    return { look: randomLook(), demo: true };
  }
  const res = await repo.analyzePhoto({ childId, image: imageBase64, mediaType });
  return { look: normalizeLook(res.look), notes: res.notes };
}

export const canMakePortrait = () => getState().mode === 'cloud';

// Personnage 3D (tête et haut du corps) en 4 poses : d'abord le sourire mains sur les hanches, à partir
// de la photo ({ image, mediaType }) ou du visage 3D seul d'une ancienne version ({ fromFace: version }),
// puis l'encouragement, le bravo et la danse à partir de ce sourire (même personnage).
// onFace(expr, url) à chaque image prête. Renvoie le portrait à ranger dans le look ; seul le sourire
// est indispensable. missing : poses qui n'ont pas pu être créées ({ expr, message }) ; l'app les crée
// d'elle-même à un prochain lancement (completePoses).
const POSES = ['encourage', 'joy', 'dance'];
export async function makePortrait(childId, source, onFace) {
  const face = async (expr, body) => {
    const res = await repo.makePortrait({ childId, expr, ...body });
    const blob = await (await fetch(`data:image/webp;base64,${res.image}`)).blob();
    const entry = await primePortrait(portraitPath(res.base, expr), blob, res.marks);
    onFace?.(expr, entry.url);
    return res;
  };
  const first = await face('happy', source.fromFace ? { fromFace: true, version: source.fromFace } : { image: source.image, mediaType: source.mediaType });
  const exprs = { happy: first.marks };
  const others = await Promise.allSettled(POSES.map((expr) => face(expr, { version: first.version })));
  const missing = [];
  others.forEach((r, i) => {
    if (r.status === 'fulfilled') exprs[r.value.expr] = r.value.marks;
    else missing.push({ expr: POSES[i], message: r.reason?.message || '' });
  });
  return { base: first.base, exprs, body: true, missing };
}

// Au lancement, une fois par personnage :
//  - personnage 3D entier enregistré par une ancienne version de l'app (images avec le haut du corps,
//    mais sans le drapeau body ni les repères des bras) : Claude relit les images déjà créées (rien
//    n'est créé ni décompté) ;
//  - puis les poses qui manquent (limite du jour atteinte, erreur passagère) sont créées à partir du
//    sourire de la même version ; à la limite du jour, on s'arrête et on réessaiera au lancement suivant.
const repaired = new Set();
function repairPortraits() {
  for (const child of getState().children) {
    const p = normalizeLook(child.look).portrait;
    if (!p || p.off || repaired.has(p.base)) continue;
    repaired.add(p.base);
    (p.body ? completePoses(child.id, p) : repairPortrait(child.id, p)).catch((e) => console.warn('PandiFlow : personnage 3D pas complété', e?.message));
  }
}

// Ajoute des poses (ou de nouveaux repères) au personnage de l'enfant, s'il n'en a pas changé entre-temps.
// fresh : images déjà préparées avec d'anciens repères, à préparer de nouveau
function addPoses(childId, base, more, fresh) {
  const child = getState().children.find((c) => c.id === childId);
  const cur = child?.look?.portrait;
  if (cur?.base !== base) return false;
  if (fresh) for (const expr of Object.keys(more)) forgetPortrait(portraitPath(base, expr));
  saveLook(childId, { ...child.look, portrait: { ...cur, exprs: { ...cur.exprs, ...more }, body: true } });
  return true;
}

async function repairPortrait(childId, p) {
  const entry = await loadPortrait(portraitPath(p.base, 'happy'), p.exprs.happy);
  // Image carrée : visage seul d'avant la v1.4, rien à réparer (le bouton « Créer le corps 3D » s'en charge)
  if (!entry || entry.ratio < 1.2) return;
  const version = p.base.split('/')[2];
  const found = await Promise.all(Object.keys(p.exprs).map((expr) => repo.makePortrait({ childId, expr, version, marksOnly: true })));
  const exprs = Object.fromEntries(found.map((res) => [res.expr, res.marks]));
  if (!hasBody(exprs.happy) || !addPoses(childId, p.base, exprs, true)) return;
  await completePoses(childId, { ...p, exprs: { ...p.exprs, ...exprs } });
}

async function completePoses(childId, p) {
  const version = p.base.split('/')[2];
  for (const expr of POSES.filter((e) => !p.exprs[e])) {
    const res = await repo.makePortrait({ childId, expr, version });
    const blob = await (await fetch(`data:image/webp;base64,${res.image}`)).blob();
    await primePortrait(portraitPath(p.base, expr), blob, res.marks);
    if (!addPoses(childId, p.base, { [expr]: res.marks }, false)) return;
  }
}

// Version du visage 3D (tête seule) d'un enfant, à qui on peut créer le haut du corps sans nouvelle photo
export const faceOnlyVersion = (look) => (look?.portrait && !look.portrait.body ? look.portrait.base.split('/')[2] : null);

// --- Compte et famille (cloud) ------------------------------------------------------------------
// Redirige vers Google ; au retour, boot() retrouve la session
export async function signInWithGoogle() {
  await repo.signInWithGoogle();
}

export const googleEnabled = () => (repo?.googleEnabled ? repo.googleEnabled() : Promise.resolve(false));

export async function signUp(email, password) {
  await afterLogin(await repo.signUp(email, password));
}

export async function signIn(email, password) {
  await afterLogin(await repo.signIn(email, password));
}

export async function sendPasswordReset(email) {
  await repo.sendPasswordReset(email);
}

export async function updatePassword(password) {
  await afterLogin(await repo.updatePassword(password));
}

export async function signOut() {
  if (repo?.signOut) await repo.signOut();
  localStorage.removeItem(OUTBOX_KEY);
  outbox = [];
  setState({ status: 'auth', user: null, family: null, parentUnlockedUntil: 0 });
}

export async function createFamily({ name, children }) {
  const family = await repo.createFamily(name);
  setState({ family });
  const kids = children.map((c, i) => makeChild(family.id, c, i));
  const seed = buildFamilySeed(family.id, kids);
  await repo.put('children', kids);
  await repo.put('tasks', seed.tasks);
  await repo.put('child_tasks', seed.childTasks);
  await repo.put('challenges', seed.challenges);
  await reload();
}

export async function joinFamily(code) {
  await repo.joinFamily(code.replace(/[^a-z0-9]/gi, '').toUpperCase());
  await reload();
}

// --- Parents de la famille et invitations à usage unique ----------------------------
export const listMembers = () => repo.listMembers(familyId());
export const listInvites = () => repo.listInvites(familyId());
export const createInvite = () => repo.createInvite(familyId());
export const revokeInvite = (code) => repo.revokeInvite(code);

export async function removeMember(userId) {
  await repo.removeMember(familyId(), userId);
  // Si c'est moi qui quitte la famille, on repart à l'écran de bienvenue
  if (userId === getState().user?.id) setState({ status: 'setup', family: null, parentUnlockedUntil: 0 });
}

async function createDemoFamily() {
  const family = await repo.createFamily('Famille démo');
  const kids = DEMO_CHILDREN.map((c, i) => makeChild(family.id, c, i));
  const seed = buildFamilySeed(family.id, kids);
  await repo.put('children', kids);
  await repo.put('tasks', seed.tasks);
  await repo.put('child_tasks', seed.childTasks);
  await repo.put('challenges', seed.challenges);
  // Quelques pandi de départ pour pouvoir essayer la boutique tout de suite
  await repo.put(
    'ledger',
    kids.map((k) => ({ id: uid(), family_id: family.id, child_id: k.id, kind: 'manual', amount: 60, evening_date: null, note: 'Cadeau de bienvenue', created_at: new Date().toISOString() })),
  );
}

export async function resetDemo() {
  if (getState().mode !== 'demo') return;
  repo.reset();
  await createDemoFamily();
  await reload();
}

export function exportBackup() {
  const s = getState();
  const data = {
    app: 'PandiFlow',
    exported_at: new Date().toISOString(),
    family: s.family,
    children: s.children,
    tasks: s.tasks,
    child_tasks: s.childTasks,
    ratings: s.ratings,
    ledger: s.ledger,
    owned_items: s.owned,
    challenges: s.challenges,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pandiflow-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
