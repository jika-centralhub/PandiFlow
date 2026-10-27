// Pandi sur l'écran d'accueil (la web app). Android et les ordinateurs proposent l'installation par un
// événement du navigateur, qui n'arrive qu'une fois au chargement : on le garde pour notre bouton.
// L'iPhone et l'iPad n'ont pas de bouton possible : on y explique le geste (Partager → Sur l'écran d'accueil).
import { useEffect, useState } from '../vendor/preact-htm.js';
import { isInstalled } from './device.js';

let deferred = null;
// Installée depuis ce navigateur (gardé : le navigateur ne le redit pas après un rechargement)
const KEY = 'pandiflow-installee';
let installed = localStorage.getItem(KEY) === '1';
const remember = (on) => {
  installed = on;
  if (on) localStorage.setItem(KEY, '1');
  else localStorage.removeItem(KEY);
};
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // notre bouton remplace la petite barre du navigateur
  deferred = e;
  remember(false); // le navigateur la propose : elle n'est pas (ou plus) installée
  notify();
});
addEventListener('appinstalled', () => {
  deferred = null;
  remember(true);
  notify();
});

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = () => /Android/i.test(navigator.userAgent);

// 'app' : on est déjà dans l'app ; 'done' : installée à l'instant ; 'prompt' : notre bouton peut l'installer ;
// 'ios', 'android' : le geste à faire dans le navigateur ; 'computer' : sur un ordinateur, sans bouton
export function installState() {
  if (isInstalled()) return 'app';
  if (installed) return 'done';
  if (deferred) return 'prompt';
  if (isIOS()) return 'ios';
  if (isAndroid()) return 'android';
  return 'computer';
}

// Ouvre la fenêtre d'installation du navigateur ; vrai si le parent a accepté
export async function promptInstall() {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  e.prompt();
  const choice = await e.userChoice.catch(() => null);
  if (choice?.outcome === 'accepted') remember(true);
  notify();
  return installed;
}

// L'état d'installation, tenu à jour (l'événement du navigateur peut arriver après l'affichage)
export function useInstallState() {
  const [state, setState] = useState(installState);
  useEffect(() => {
    const update = () => setState(installState());
    listeners.add(update);
    update();
    return () => listeners.delete(update);
  }, []);
  return state;
}
