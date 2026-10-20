// Relais http -> https : passer de http://pandiflow.com à https://pandiflow.com sans se reconnecter.
//
// Le navigateur range les données de http:// et de https:// dans deux tiroirs séparés : sans
// relais, chaque parent devrait se reconnecter une fois. Tant que l'app est ouverte en http,
// ce script vérifie si le https fonctionne ; dès que c'est le cas, il emporte la connexion
// Supabase et les réglages de l'appareil (minuteurs, notes pas encore envoyées…) dans l'adresse
// de la page https. Celle-ci les range avant le démarrage de l'app, puis efface l'adresse.
//
// Garde-fous : le relais n'est accepté que s'il arrive de http://pandiflow.com, a moins de
// 2 minutes, et n'écrase jamais ce que l'appareil a déjà en https. Les données passent après
// le « # » de l'adresse, qui n'est jamais envoyé au serveur.
//
// Script classique (pas un module) chargé en premier dans index.html, avant l'app.
(function () {
  var HOSTS = ['pandiflow.com', 'www.pandiflow.com'];
  var TARGET = 'https://pandiflow.com';
  var KEYS = /^(pandiflow-|sb-)/;
  var FROM = /^http:\/\/(www\.)?pandiflow\.com\//;
  var MAX_CHARS = 150000;
  var MAX_AGE_MS = 120000;

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
  function decode(code, now) {
    try {
      var data = JSON.parse(fromB64url(code));
      if (!data || typeof data.t !== 'number' || Math.abs(now - data.t) > MAX_AGE_MS || !data.items || typeof data.items !== 'object') return null;
      var out = {};
      for (var k in data.items) if (KEYS.test(k) && typeof data.items[k] === 'string') out[k] = data.items[k];
      return out;
    } catch (e) {
      return null;
    }
  }

  function collect(storage) {
    var items = {};
    for (var i = 0; i < storage.length; i++) {
      var k = storage.key(i);
      if (KEYS.test(k)) items[k] = storage.getItem(k);
    }
    return items;
  }

  // Côté https : on range ce qui arrive, sans jamais écraser ce que l'appareil a déjà
  function receive() {
    var m = /^#relais=([A-Za-z0-9_-]+)$/.exec(location.hash);
    if (!m) return 0;
    history.replaceState(null, '', location.pathname + location.search);
    if (location.protocol !== 'https:' || !FROM.test(document.referrer)) return 0;
    var items = decode(m[1], Date.now());
    if (!items) return 0;
    var n = 0;
    for (var k in items) {
      if (localStorage.getItem(k) === null) {
        localStorage.setItem(k, items[k]);
        n++;
      }
    }
    return n;
  }

  // Côté http : dès que le https répond, on y part avec nos données
  var sending = false;
  function send() {
    if (sending || location.protocol !== 'http:' || HOSTS.indexOf(location.hostname) < 0) return;
    if (!window.fetch || !window.AbortController) return;
    sending = true;
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 5000);
    fetch(TARGET + '/manifest.webmanifest?sonde=' + Date.now(), { mode: 'no-cors', cache: 'no-store', signal: ctrl.signal })
      .then(function () {
        var items = collect(localStorage);
        var code = encode(items, Date.now());
        if (code.length > MAX_CHARS) {
          delete items['pandiflow-demo-v1'];
          code = encode(items, Date.now());
        }
        if (code.length > MAX_CHARS) return;
        location.replace(TARGET + location.pathname + '#relais=' + code);
      })
      .catch(function () { /* pas encore de https : on reste en http */ })
      .then(function () {
        clearTimeout(timer);
        sending = false;
      });
  }

  window.PandiRelais = { encode: encode, decode: decode, collect: collect, receive: receive, send: send };
  receive();
  send();
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') send();
  });
})();
