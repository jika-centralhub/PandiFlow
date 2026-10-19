// Actions de l'app : elles mettent à jour l'état tout de suite (interface instantanée)
// puis enregistrent les changements dans le stockage (localStorage ou Supabase).
import { getState, setState, toast } from './store.js';
import { LocalRepo } from './localRepo.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';
import * as domain from '../domain.js';
import { STATE_KEYS, sameKey, matches } from './tables.js';
import { buildFamilySeed, makeChild, DEMO_CHILDREN } from './seed.js';
import { uid, sleep } from './util.js';
import { hashPin, checkPin } from './pin.js';
import { getItem } from '../avatar/items.js';
import { normalizeLook, randomLook } from '../avatar/palette.js';

let repo = null;
export const getRepo = () => repo;

export const isCloudConfigured = () =>
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY) && !new URLSearchParams(location.search).has('demo');

// --- Démarrage ----------------------------------------------------------------
export async function boot() {
  try {
    if (isCloudConfigured()) {
      const { SupabaseRepo } = await import('./supabaseRepo.js');
      repo = new SupabaseRepo();
      setState({ mode: 'cloud' });
      loadOutbox();
      const user = await repo.getUser();
      if (!user) return setState({ status: 'auth' });
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
}

export async function reload() {
  const data = await repo.loadAll(getState().family?.id);
  setState({ ...data, settings: domain.mergeSettings(data.family?.settings), status: 'ready' });
}

// Rafraîchit les données quand l'app revient au premier plan (synchro entre parents).
export function watchVisibility() {
  document.addEventListener('visibilitychange', async () => {
    const s = getState();
    if (document.visibilityState !== 'visible' || s.mode !== 'cloud' || s.status !== 'ready') return;
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
        else if (op.op === 'family') await repo.updateFamily(op.familyId, op.patch);
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
  const { ratings, ledger, owned, ops, result } = domain.applyRating(s, {
    familyId: familyId(),
    childId,
    taskId,
    date,
    color,
  });
  setState({ ratings, ledger, owned });
  commit(ops);
  return result;
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
export function addChild({ name, age, color, look }) {
  const s = getState();
  const child = makeChild(familyId(), { name, age, color, look: look || randomLook() }, s.children.length);
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
export function addTask({ title, emoji, days, childIds }) {
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

export function moveTask(taskId, dir) {
  const list = getState().tasks.filter((t) => !t.archived).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  const i = list.findIndex((t) => t.id === taskId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  put('tasks', list.map((t, k) => ({ ...t, sort: k })));
}

// --- Défis ------------------------------------------------------------------------------
export function saveChallenge(ch) {
  put('challenges', [{ family_id: familyId(), active: true, child_id: null, bonus: 0, ...ch, id: ch.id || uid() }]);
}

export function deleteChallenge(id) {
  del('challenges', { id });
}

// --- Pandi ---------------------------------------------------------------------------------
export function manualAdjust(childId, amount, note) {
  if (!amount) return;
  put('ledger', [{ id: uid(), family_id: familyId(), child_id: childId, kind: 'manual', amount, evening_date: null, note: note || 'Ajustement', created_at: new Date().toISOString() }]);
}

// --- Réglages de la famille ------------------------------------------------------------------
export function updateSettings(patch) {
  const s = getState();
  const settings = domain.mergeSettings({ ...s.settings, ...patch });
  const family = { ...s.family, settings };
  setState({ settings, family });
  commit([{ op: 'family', familyId: family.id, patch: { settings } }]);
}

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

// --- Compte et famille (cloud) ------------------------------------------------------------------
export async function sendCode(email) {
  await repo.sendCode(email);
}

export async function verifyCode(email, code) {
  const user = await repo.verifyCode(email, code);
  await afterLogin(user);
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
  await repo.joinFamily(code.trim().toUpperCase());
  await reload();
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
