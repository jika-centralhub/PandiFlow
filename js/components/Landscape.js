// Sur le téléphone, Pandi propose le plein écran en paysage : l'écran dupliqué sur la télé est alors
// rempli, sans les barres du navigateur.
//   - Android : un bouton passe en plein écran et verrouille le paysage ;
//   - iPhone (une page n'y passe pas en plein écran) : on explique comment l'ouvrir depuis l'écran d'accueil,
//     puis de tourner le téléphone.
// « Plus tard » la cache jusqu'au prochain lancement de l'app.
import { html, useEffect, useState } from '../vendor/preact-htm.js';
import { useStore, inAccueil, visitPending } from '../lib/store.js';
import { sfx } from '../lib/sounds.js';
import { isPhone, isPortrait, isFullscreen, canFullscreen, isInstalled, enterLandscape } from '../lib/device.js';

const LATER = 'pandiflow-paysage-plus-tard';

export function LandscapeOffer() {
  const s = useStore();
  const [, refresh] = useState(0);
  const [later, setLater] = useState(() => sessionStorage.getItem(LATER) === '1');
  const [stuck, setStuck] = useState(false); // le paysage n'a pas pu être verrouillé : il faut tourner le téléphone

  // On se remet à jour quand le téléphone tourne ou quitte le plein écran
  useEffect(() => {
    const update = () => refresh((n) => n + 1);
    const mq = matchMedia('(orientation: portrait)');
    mq.addEventListener?.('change', update);
    document.addEventListener('fullscreenchange', update);
    document.addEventListener('webkitfullscreenchange', update);
    return () => {
      mq.removeEventListener?.('change', update);
      document.removeEventListener('fullscreenchange', update);
      document.removeEventListener('webkitfullscreenchange', update);
    };
  }, []);

  // Pas pendant la création de la famille (des formulaires, le téléphone en hauteur) ni pendant la visite
  if (later || s.status === 'loading' || s.status === 'setup' || inAccueil(s) || visitPending(s) || !isPhone()) return null;
  const full = isFullscreen() || isInstalled();
  const portrait = isPortrait();
  if (full && !portrait) return null;

  const close = () => {
    sfx.tap();
    sessionStorage.setItem(LATER, '1');
    setLater(true);
  };
  const go = async () => {
    sfx.tap();
    setStuck(!(await enterLandscape()));
  };

  let icon = '📺';
  let title = 'Plein écran en paysage';
  let text = 'Toute la place pour la télé, sans les barres du navigateur.';
  let action = html`<button class="btn btn-green btn-small" onClick=${go}>⛶ Plein écran</button>`;
  if (!canFullscreen() && !full) {
    // iPhone dans Safari : seule l'app ouverte depuis l'écran d'accueil s'affiche sans les barres
    icon = '📲';
    title = 'Plein écran sur iPhone';
    text = html`Touche <b>Partager</b> ⬆️ puis <b>« Sur l'écran d'accueil »</b>, ouvre Pandi depuis son icône${portrait ? ' et tourne le téléphone' : ''}.`;
    action = null;
  } else if (portrait && (stuck || (full && !(canFullscreen() && screen.orientation?.lock)))) {
    icon = '🔄';
    title = 'Tourne ton téléphone';
    text = 'Pandi est fait pour l’écran en largeur (coupe le verrou de rotation s’il ne tourne pas).';
    action = null;
  } else if (full) {
    title = 'Passer en paysage';
    text = 'L’écran de la télé sera rempli en largeur.';
    action = html`<button class="btn btn-green btn-small" onClick=${go}>🔄 Paysage</button>`;
  }

  return html`<div class="landscape-offer" role="dialog" aria-label=${title}>
    <span class="lo-icon" aria-hidden="true">${icon}</span>
    <div class="lo-text"><b>${title}</b><span>${text}</span></div>
    <div class="lo-actions">
      ${action}
      <button class="btn btn-ghost btn-small" onClick=${close}>${action ? 'Plus tard' : 'OK'}</button>
    </div>
  </div>`;
}
