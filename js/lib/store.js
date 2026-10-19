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
};

function loadPrefs() {
  const defaults = { sound: true, reducedMotion: false };
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
