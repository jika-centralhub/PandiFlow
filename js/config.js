// Configuration publique de Pandi.
// L'URL Supabase et la clé "anon" sont publiques par conception : la sécurité
// repose sur les règles RLS de la base (voir supabase/schema.sql).
// Tant que ces deux valeurs sont vides, l'app tourne en mode démo (localStorage).

export const SUPABASE_URL = 'https://kyhhkhmwdostzdaksxzw.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable__E61F1zKiN431iU2AlKySQ_PZOsOtgi';

export const APP_VERSION = '1.39.0-labo.14';

// Le labo (branche labo-boucles, publiée à part sur pandi-labo) et le site partagent le même code : le labo
// se reconnaît à son numéro de version (« …-labo.N »). Ce qui n'y est encore qu'un essai (le dragon du coin
// calme en images, les outils du labo dans Réglages) ne s'allume que là.
export const LABO = APP_VERSION.includes('labo');

// Adresse de contact des familles (page de confidentialité, demandes de suppression des données)
export const CONTACT_EMAIL = 'contact@pandiflow.com';

// Labo (branche labo-boucles, publiée à part) : les Pandi des cartes au repos rejouent une boucle
// enregistrée au lieu de recalculer la 3D (js/mascot/boucles.js). ?boucles=0 les coupe sur cet appareil
// pour comparer, ?boucles=1 les remet.
// Labo : Pandi en poses illustrées animées par calques sur les cartes et le minuteur (PandiPose.js), à la
// place de la 3D. ?poses=0 remet la 3D sur cet appareil pour comparer, ?poses=1 les poses.
export const POSES = (() => {
  try {
    const m = /[?&]poses=([01])/.exec(location.search);
    if (m) localStorage.setItem('pandiflow-poses', m[1]);
    return localStorage.getItem('pandiflow-poses') !== '0';
  } catch {
    return true;
  }
})();

// Labo : l'écran calme (26/11/2026). Le décor ne bouge plus (étoiles fixes, nuages arrêtés, lueurs fixes,
// voir css/calme.css), le véhicule et le compagnon ne se baladent que de temps en temps, et l'écran se met
// en veille au bout de 2 minutes sans qu'on le touche (js/lib/veille.js). ?calme=0 remet l'ancien écran
// sur cet appareil pour comparer, ?calme=1 l'écran calme.
export const CALME = (() => {
  try {
    const m = /[?&]calme=([01])/.exec(location.search);
    if (m) localStorage.setItem('pandiflow-calme', m[1]);
    return localStorage.getItem('pandiflow-calme') !== '0';
  } catch {
    return true;
  }
})();

export const BOUCLES = (() => {
  try {
    const m = /[?&]boucles=([01])/.exec(location.search);
    if (m) localStorage.setItem('pandiflow-boucles', m[1]);
    return localStorage.getItem('pandiflow-boucles') !== '0';
  } catch {
    return true;
  }
})();

// Une note donnée avant cette heure compte pour la soirée de la veille.
export const EVENING_CUTOFF_HOUR = 4;

// De 4 h jusqu'à cette heure-là, l'app ouvre la routine du matin ; ensuite celle du soir.
export const MORNING_END_HOUR = 13;

// Nombre maximum d'analyses photo par enfant et par jour (vérifié côté serveur).
export const PHOTO_DAILY_LIMIT = 5;
