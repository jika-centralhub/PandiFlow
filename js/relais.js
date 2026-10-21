// Relais de connexion : changer d'adresse sans que personne n'ait à se reconnecter.
//
// Le navigateur range les données de chaque adresse dans un tiroir séparé : http://pandiflow.com,
// https://pandiflow.com, http://www.pandiflow.com et https://www.pandiflow.com ne voient pas ce que
// les autres ont rangé. Deux passerelles font suivre la connexion Supabase et les réglages de
// l'appareil (minuteurs, notes pas encore envoyées…) :
//
// 1. http -> https, même nom. Tant que l'app est ouverte en http, ce script vérifie si le https
//    sert bien PandiFlow ; dès que c'est le cas, il emporte les données dans l'adresse de la page https (après
//    le « # », jamais envoyé au serveur), qui les range avant le démarrage de l'app. Ensuite
//    l'appareil ne relance plus jamais l'app en http : Supabase n'accepte chaque jeton de
//    connexion qu'une fois, une connexion utilisée des deux côtés finirait refusée partout.
//    Garde-fous : accepté seulement depuis http://(www.)pandiflow.com, moins de 2 minutes,
//    n'écrase jamais ce que l'appareil a déjà.
//
// 2. pandiflow.com -> www.pandiflow.com. Quand www devient l'adresse principale, GitHub renvoie
//    pandiflow.com vers www avant même de charger la page : la passerelle 1 ne peut pas jouer.
//    Alors, tant que l'app tourne sur pandiflow.com, elle tient à jour un cookie commun aux deux
//    noms (domain=pandiflow.com), limité au dossier /relais/ pour qu'il ne parte pas avec chaque
//    fichier de l'app. Sur www, si l'appareil n'a pas encore de connexion, une page cachée
//    /relais/ lit ce cookie ; on range les données, puis on l'efface : il ne sert qu'une fois.
//    Chaque connexion qui a écrit son cookie le signale à Supabase (table relay_pings), pour
//    savoir quand tous les appareils sont prêts à changer d'adresse.
//
// Script classique (pas un module) chargé en premier dans index.html ; l'app attend
// PandiRelais.ready avant de démarrer.
(function () {
  var APEX = 'pandiflow.com';
  var WWW = 'www.pandiflow.com';
  var HOSTS = [APEX, WWW];
  var KEYS = /^(pandiflow-|sb-)/;
  var AUTH = /^sb-(.+)-auth-token$/;
  var FROM = /^http:\/\/(www\.)?pandiflow\.com\//;
  var MOVED = 'pandiflow-relais-parti';
  var SIGNALED = 'pandiflow-relais-signale';
  var MAX_CHARS = 150000;
  var MAX_AGE_MS = 120000;

  var BRIDGE = 'pf_pont';
  var BRIDGE_PATH = '/relais/';
  // Emportés avec la connexion tant que ça tient, par ordre d'importance
  var BRIDGE_KEYS = ['pandiflow-outbox', 'pandiflow-email', 'pandiflow-prefs', 'pandiflow-timers'];
  var CHUNK = 3000;
  var MAX_PARTS = 3;
  var BRIDGE_MS = 30 * 86400000;
  var ANON_KEY = 'sb_publishable__E61F1zKiN431iU2AlKySQ_PZOsOtgi';

  function toB64url(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromB64url(code) {
    var bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function encode(items, now) {
    return toB64url(JSON.stringify({ t: now, items: items }));
  }

  // Les éléments à ranger, ou null si le relais est invalide ou trop vieux
  function decode(code, now, maxAge) {
    try {
      var data = JSON.parse(fromB64url(code));
      if (!data || typeof data.t !== 'number' || Math.abs(now - data.t) > (maxAge || MAX_AGE_MS) || !data.items || typeof data.items !== 'object') return null;
      var out = {};
      for (var k in data.items) if (KEYS.test(k) && k !== MOVED && typeof data.items[k] === 'string') out[k] = data.items[k];
      return out;
    } catch (e) {
      return null;
    }
  }

  function collect(storage) {
    var items = {};
    for (var i = 0; i < storage.length; i++) {
      var k = storage.key(i);
      if (KEYS.test(k) && k !== MOVED) items[k] = storage.getItem(k);
    }
    return items;
  }

  function authKey(storage) {
    for (var i = 0; i < storage.length; i++) if (AUTH.test(storage.key(i))) return storage.key(i);
    return null;
  }

  // On range ce qui arrive, sans jamais écraser ce que l'appareil a déjà
  function store(storage, items) {
    var n = 0;
    for (var k in items) {
      if (storage.getItem(k) === null) {
        storage.setItem(k, items[k]);
        n++;
      }
    }
    return n;
  }

  // --- Passerelle 1 : http -> https -------------------------------------------------------------

  function receive() {
    var m = /^#relais=([A-Za-z0-9_-]+)$/.exec(location.hash);
    if (!m) return 0;
    history.replaceState(null, '', location.pathname + location.search);
    if (location.protocol !== 'https:' || !FROM.test(document.referrer)) return 0;
    var items = decode(m[1], Date.now());
    return items ? store(localStorage, items) : 0;
  }

  var sending = false;
  var leaving = false;
  function send() {
    if (sending || leaving || location.protocol !== 'http:' || HOSTS.indexOf(location.hostname) < 0) return;
    var target = 'https://' + location.host;
    // Déjà passé en https : on y retourne tout de suite, l'app ne redémarre pas ici
    if (localStorage.getItem(MOVED)) {
      leaving = true;
      location.replace(target + location.pathname + location.search + location.hash);
      return;
    }
    if (!window.fetch || !window.AbortController) return;
    sending = true;
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 5000);
    // On lit le manifeste pour de vrai (GitHub Pages l'autorise) : un filtre d'entreprise ou un
    // portail wifi répond lui aussi en https, mais avec sa propre page, pas avec PandiFlow
    fetch(target + '/manifest.webmanifest?sonde=' + Date.now(), { cache: 'no-store', signal: ctrl.signal })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (manifest) {
        if (!manifest || manifest.short_name !== 'PandiFlow') return;
        var items = collect(localStorage);
        var code = encode(items, Date.now());
        if (code.length > MAX_CHARS) {
          delete items['pandiflow-demo-v1'];
          code = encode(items, Date.now());
        }
        if (code.length > MAX_CHARS) return;
        leaving = true;
        // La connexion part en https : elle ne doit plus jamais servir ici
        for (var k in items) if (/^sb-/.test(k)) localStorage.removeItem(k);
        localStorage.setItem(MOVED, String(Date.now()));
        location.replace(target + location.pathname + '#relais=' + code);
      })
      .catch(function () { /* pas encore de https : on reste en http */ })
      .then(function () {
        clearTimeout(timer);
        sending = false;
      });
  }

  // --- Passerelle 2 : pandiflow.com -> www.pandiflow.com ----------------------------------------

  // Les morceaux du cookie : la connexion d'abord, puis le reste tant que ça tient. null sans connexion.
  function bridgeParts(storage, now) {
    var key = authKey(storage);
    if (!key) return null;
    var items = {};
    items[key] = storage.getItem(key);
    var code = encode(items, now);
    for (var i = 0; i < BRIDGE_KEYS.length; i++) {
      var v = storage.getItem(BRIDGE_KEYS[i]);
      if (v === null) continue;
      items[BRIDGE_KEYS[i]] = v;
      var next = encode(items, now);
      if (next.length > CHUNK * MAX_PARTS) delete items[BRIDGE_KEYS[i]];
      else code = next;
    }
    if (code.length > CHUNK * MAX_PARTS) return null;
    var parts = [];
    for (var p = 0; p < code.length; p += CHUNK) parts.push(code.slice(p, p + CHUNK));
    return parts;
  }

  // Le contenu du cookie lu dans la page /relais/, ou null s'il manque, est abîmé ou sans connexion
  function readParts(cookies, now) {
    var jar = {};
    cookies.split(/;\s*/).forEach(function (c) {
      var i = c.indexOf('=');
      if (i > 0) jar[c.slice(0, i)] = c.slice(i + 1);
    });
    var n = parseInt(jar[BRIDGE], 10);
    if (!(n >= 1 && n <= MAX_PARTS)) return null;
    var code = '';
    for (var i = 0; i < n; i++) {
      if (!jar[BRIDGE + i]) return null;
      code += jar[BRIDGE + i];
    }
    var items = decode(code, now, BRIDGE_MS);
    if (!items) return null;
    for (var k in items) if (AUTH.test(k)) return items;
    return null;
  }

  // parts = null efface le cookie
  function setBridge(parts, domain) {
    var attrs = (domain ? '; domain=' + domain : '') + '; path=' + BRIDGE_PATH + '; SameSite=Lax';
    var keep = attrs + '; max-age=' + Math.round(BRIDGE_MS / 1000);
    var drop = attrs + '; max-age=0';
    for (var i = 0; i < MAX_PARTS; i++) document.cookie = BRIDGE + i + '=' + (parts && i < parts.length ? parts[i] + keep : drop);
    document.cookie = BRIDGE + '=' + (parts ? parts.length + keep : drop);
  }

  // Sur pandiflow.com : le cookie suit chaque renouvellement de la connexion
  var written = null;
  function writeBridge(storage, domain) {
    var key = authKey(storage);
    var sig = key ? storage.getItem(key) + '|' + BRIDGE_KEYS.map(function (k) { return storage.getItem(k); }).join('|') : '';
    if (sig === written) return false;
    written = sig;
    setBridge(bridgeParts(storage, Date.now()), domain);
    return true;
  }

  // Sur www : lire le cookie dans la page cachée /relais/, ranger, effacer. done(nombre rangé)
  function readBridge(storage, domain, done) {
    var frame = document.createElement('iframe');
    var over = false;
    var timer = setTimeout(function () { finish(0); }, 6000);
    function finish(n) {
      if (over) return;
      over = true;
      clearTimeout(timer);
      if (frame.parentNode) frame.parentNode.removeChild(frame);
      done(n);
    }
    frame.onload = function () {
      var doc = null;
      try {
        doc = frame.contentDocument;
        if (doc && doc.location.pathname !== BRIDGE_PATH) return; // page vide du début : on attend la vraie
      } catch (e) {
        doc = null; // page d'erreur (hors ligne…) : le cookie reste pour la prochaine fois
      }
      if (!doc) return finish(0);
      var items = readParts(doc.cookie, Date.now());
      if (items) setBridge(null, domain);
      finish(items ? store(storage, items) : 0);
    };
    frame.style.display = 'none';
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.src = BRIDGE_PATH + '?t=' + Date.now();
    (document.body || document.documentElement).appendChild(frame);
  }

  // Un signe par connexion, une fois son cookie écrit (le jeton doit être encore valable)
  function signal(storage) {
    var key = authKey(storage);
    if (!key || !window.fetch) return;
    try {
      var s = JSON.parse(storage.getItem(key));
      var claims = JSON.parse(fromB64url(s.access_token.split('.')[1]));
      if (!claims.session_id || storage.getItem(SIGNALED) === claims.session_id) return;
      if (!(s.expires_at * 1000 > Date.now() + 60000)) return;
      fetch('https://' + AUTH.exec(key)[1] + '.supabase.co/rest/v1/relay_pings', {
        method: 'POST',
        headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify({ session_id: claims.session_id, host: location.protocol + '//' + location.host }),
      })
        .then(function (res) { if (res.ok) storage.setItem(SIGNALED, claims.session_id); })
        .catch(function () {});
    } catch (e) { /* pas de connexion lisible : rien à signaler */ }
  }

  var signaledAt = 0;
  function keepBridge() {
    if (leaving || localStorage.getItem(MOVED)) return;
    var changed = writeBridge(localStorage, APEX);
    if (changed || Date.now() - signaledAt > 60000) {
      signaledAt = Date.now();
      signal(localStorage);
    }
  }

  // --- Démarrage ------------------------------------------------------------------------------------

  var ours = HOSTS.indexOf(location.hostname) >= 0 && window.top === window;
  var ready = new Promise(function (resolve) {
    if (!ours) return resolve();
    receive();
    if (location.protocol === 'http:' && localStorage.getItem(MOVED)) return send(); // part tout de suite en https
    if (location.hostname === WWW) {
      if (!authKey(localStorage)) {
        readBridge(localStorage, APEX, function () {
          resolve();
          send();
        });
        return;
      }
      // Déjà connecté ici : un vieux cookie ne doit pas ressusciter une connexion après une déconnexion
      setBridge(null, APEX);
    }
    resolve();
    send();
  });

  if (ours && location.hostname === APEX) {
    keepBridge();
    setInterval(keepBridge, 3000);
    window.addEventListener('pagehide', keepBridge);
  }
  if (ours) {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') send();
      else if (location.hostname === APEX) keepBridge();
    });
  }

  window.PandiRelais = {
    ready: ready,
    encode: encode,
    decode: decode,
    collect: collect,
    receive: receive,
    send: send,
    bridgeParts: bridgeParts,
    readParts: readParts,
    writeBridge: writeBridge,
    readBridge: readBridge,
    setBridge: setBridge,
  };
})();
