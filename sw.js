// Service worker Pandi : garde l'application en cache pour un démarrage instantané.
// Les données (Supabase) passent toujours par le réseau.
// Stratégie « réseau d'abord » : une nouvelle version en ligne est prise dès le prochain lancement.
// Changer VERSION seulement pour vider entièrement l'ancien cache.
const VERSION = 'pandiflow-v1.0.0';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './css/avatar.css',
  './css/routine.css',
  './css/calm.css',
  './css/team.css',
  './css/garage.css',
  './css/shop.css',
  './css/tsedaka.css',
  './css/magic.css',
  './css/surprise.css',
  './assets/fonts/fredoka.woff2',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './js/vendor/preact-htm.js',
  './js/vendor/supabase.js',
  './js/vendor/gsap.min.js',
  './js/vendor/confetti.js',
  './js/main.js',
  './js/relais.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Fichiers de l'app : réseau d'abord (pour avoir la dernière version), cache si hors ligne.
// « no-cache » : le navigateur revalide chaque fichier au lieu de garder sa copie 10 minutes,
// pour qu'une nouvelle version soit prise dès le rechargement.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // La page cachée du relais ne doit jamais recevoir l'app à sa place (voir js/relais.js)
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/relais/')) return;
  event.respondWith(
    // (une navigation ne peut pas recevoir d'options : la page elle-même est revalidée par défaut)
    (req.mode === 'navigate' ? fetch(req) : fetch(req, { cache: 'no-cache' }))
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))),
  );
});
