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

export async function toggleFullscreen() {
  try {
    if (isFullscreen()) {
      await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      return false;
    }
    const el = document.documentElement;
    await (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' });
    // Sur Android, on peut verrouiller le paysage une fois en plein écran
    await screen.orientation?.lock?.('landscape').catch(() => {});
    return true;
  } catch {
    return isFullscreen();
  }
}
