// Fonctions liées à l'appareil : écran toujours allumé, plein écran, orientation.
let wakeLock = null;

export async function keepScreenOn() {
  try {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    wakeLock = await navigator.wakeLock.request('screen');
  } catch {
    wakeLock = null;
  }
}

export function releaseScreen() {
  wakeLock?.release?.();
  wakeLock = null;
}

// Le verrou saute quand l'app passe en arrière-plan : on le reprend au retour.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wakeLock !== null) keepScreenOn();
});

export const isFullscreen = () => Boolean(document.fullscreenElement || document.webkitFullscreenElement);
// Une page peut passer en plein écran (Android, ordinateur ; pas sur iPhone)
export const canFullscreen = () => Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);
// Ouverte depuis son icône sur l'écran d'accueil : déjà sans les barres du navigateur
export const isInstalled = () =>
  matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
// Téléphone (écran tactile étroit), pas une tablette ni la télé
export const isPhone = () => matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) <= 600;
export const isPortrait = () => matchMedia('(orientation: portrait)').matches;

// Plein écran puis paysage verrouillé (Android le permet une fois en plein écran).
// Renvoie vrai si l'écran est bien en paysage à la fin.
export async function enterLandscape() {
  try {
    if (!isFullscreen() && canFullscreen()) {
      const el = document.documentElement;
      await (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' });
    }
  } catch {
    // plein écran refusé : on tente quand même le paysage
  }
  try {
    if (!screen.orientation?.lock) return !isPortrait();
    await screen.orientation.lock('landscape');
    return true;
  } catch {
    return !isPortrait();
  }
}

export async function toggleFullscreen() {
  try {
    if (isFullscreen()) {
      await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      return false;
    }
    await enterLandscape();
    return isFullscreen();
  } catch {
    return isFullscreen();
  }
}
