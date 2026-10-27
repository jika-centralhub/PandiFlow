import { useLayoutEffect, useReducer } from '../vendor/preact-htm.js';
import { DEFAULT_SETTINGS } from '../domain.js';

// État global de l'app. Petit store maison : setState notifie les composants abonnés.
let state = {
  status: 'loading', // loading | auth | setup | ready | error
  mode: 'demo', // demo | cloud
  user: null,
  error: null,
  family: null,
  settings: DEFAULT_SETTINGS,
  children: [],
  tasks: [],
  childTasks: [],
  ratings: [],
  ledger: [],
  owned: [],
  challenges: [],
  syncing: false,
  pendingOps: 0,
  parentUnlockedUntil: 0,
  toast: null,
  // Préférences propres à cet appareil (pas synchronisées)
  prefs: loadPrefs(),
  // Minuteurs des tâches en cours sur cet appareil (celui dont l'écran est dupliqué sur la télé)
  timers: loadTimers(),
  // Assistant de démarrage en cours sur cet appareil, après la création de la famille : { familyId, step }
  accueil: loadAccueil(),
  // Visite de l'écran de la routine à montrer sur cet appareil : l'identifiant de la famille, ou null
  visite: localStorage.getItem('pandiflow-visite') || null,
  // La famille dont la visite a déjà été vue (ou passée) sur cet appareil
  visiteVue: localStorage.getItem('pandiflow-visite-vue') || null,
};

export function setVisiteVue(familyId) {
  if (familyId) localStorage.setItem('pandiflow-visite-vue', familyId);
  setState({ visiteVue: familyId || null });
}

export function setVisite(familyId) {
  if (familyId) localStorage.setItem('pandiflow-visite', familyId);
  else localStorage.removeItem('pandiflow-visite');
  setState({ visite: familyId || null });
}

// Demandée sur cet appareil (fin de l'assistant, parent qui rejoint, « Revoir »), ou une famille toute neuve
// (avant sa première soirée) qui ne l'a pas encore vue ici : l'app installée sur iPhone a sa propre mémoire
export const visitPending = (s) =>
  Boolean(s.family) &&
  ((s.visite === s.family.id) || Boolean(s.settings?.firstDay && !s.settings.firstEvening && s.visiteVue !== s.family.id && !inAccueil(s)));

function loadAccueil() {
  try {
    const a = JSON.parse(localStorage.getItem('pandiflow-accueil'));
    return a?.familyId ? a : null;
  } catch {
    return null;
  }
}

// null : l'assistant est fini (ou abandonné)
export function setAccueil(accueil) {
  if (accueil) localStorage.setItem('pandiflow-accueil', JSON.stringify(accueil));
  else localStorage.removeItem('pandiflow-accueil');
  setState({ accueil });
}

// L'assistant de démarrage de la famille ouverte est-il en cours ?
export const inAccueil = (s) => Boolean(s.accueil && s.family && s.accueil.familyId === s.family.id);

function loadPrefs() {
  const defaults = { sound: true, reducedMotion: false, timerMusic: true, timerLast: {} };
  try {
    return { ...defaults, ...(JSON.parse(localStorage.getItem('pandiflow-prefs')) || {}) };
  } catch {
    return defaults;
  }
}

export function setPrefs(patch) {
  const prefs = { ...state.prefs, ...patch };
  localStorage.setItem('pandiflow-prefs', JSON.stringify(prefs));
  setState({ prefs });
}

function loadTimers() {
  try {
    const list = JSON.parse(localStorage.getItem('pandiflow-timers'));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function setTimers(timers) {
  localStorage.setItem('pandiflow-timers', JSON.stringify(timers));
  setState({ timers });
}

const listeners = new Set();

export const getState = () => state;

export function setState(patch) {
  const next = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...next };
  for (const l of listeners) l(state);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useStore() {
  const [, force] = useReducer((x) => x + 1, 0);
  const seen = state;
  useLayoutEffect(() => {
    const unsubscribe = subscribe(() => force());
    // L'état a pu changer entre le rendu et l'abonnement (les effets sont différés)
    if (state !== seen) force();
    return unsubscribe;
  }, []);
  return state;
}

let toastTimer = null;
export function toast(message, kind = 'info', ms = 3200) {
  clearTimeout(toastTimer);
  setState({ toast: { message, kind, id: Date.now() } });
  toastTimer = setTimeout(() => setState({ toast: null }), ms);
}
