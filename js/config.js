// Configuration publique de Pandi.
// L'URL Supabase et la clé "anon" sont publiques par conception : la sécurité
// repose sur les règles RLS de la base (voir supabase/schema.sql).
// Tant que ces deux valeurs sont vides, l'app tourne en mode démo (localStorage).

export const SUPABASE_URL = 'https://kyhhkhmwdostzdaksxzw.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable__E61F1zKiN431iU2AlKySQ_PZOsOtgi';

export const APP_VERSION = '1.32.0-labo.4';

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
