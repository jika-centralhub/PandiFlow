import { html, render, useEffect } from './vendor/preact-htm.js';
import { useStore, inAccueil } from './lib/store.js';
import * as actions from './lib/actions.js';
import { useRoute, navigate } from './router.js';
import { initSky } from './anim/sky.js';
import { unlockAudio } from './lib/sounds.js';
import { Toast, Loading } from './components/ui.js';
import { OverlayHost } from './components/Overlays.js';
import { LandscapeOffer } from './components/Landscape.js';
import { Evening } from './pages/Evening.js';
import { ChildPage } from './pages/Child.js';
import { ParentPage } from './pages/Parent.js';
import { Login, NewPassword } from './pages/Login.js';
import { Setup } from './pages/Setup.js';
import { Accueil } from './pages/Accueil.js';

function Router() {
  const s = useStore();
  const route = useRoute();
  const [page, id] = route.path;

  if (s.status === 'loading') return html`<${Loading} />`;
  if (s.status === 'error') {
    return html`<div class="welcome"><div class="card sheet"><h2>Oups !</h2><p>${s.error}</p>
      <div class="sheet-actions"><button class="btn" onClick=${() => location.reload()}>Réessayer</button></div></div></div>`;
  }
  if (s.status === 'auth') return html`<${Login} />`;
  if (s.status === 'recovery') return html`<${NewPassword} />`;
  if (s.status === 'setup') return html`<${Setup} />`;
  // L'assistant de démarrage continue après la création de la famille (sur cet appareil)
  if (inAccueil(s)) return html`<${Accueil} />`;

  if (page === 'enfant' && id) return html`<${ChildPage} key=${id} childId=${id} tab=${route.query.onglet} rayon=${route.query.rayon} />`;
  if (page === 'parent') return html`<${ParentPage} section=${id} />`;
  return html`<${Evening} />`;
}

// Écran de lancement (#splash dans index.html) : s'efface dès que l'app sait quoi afficher,
// mais reste au moins 0,9 s pour qu'on voie le panda
function hideSplash() {
  const el = document.getElementById('splash');
  if (!el || el.dataset.leaving) return;
  el.dataset.leaving = '1';
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 500);
  }, Math.max(0, 900 - performance.now()));
}

function App() {
  const s = useStore();
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', Boolean(s.prefs.reducedMotion));
  }, [s.prefs.reducedMotion]);
  useEffect(() => {
    if (s.status !== 'loading') hideSplash();
  }, [s.status]);
  return html`<${Router} /><${OverlayHost} /><${LandscapeOffer} /><${Toast} />`;
}

// Compteur de performance caché (js/lib/perf.js) : ?perf l'allume sur cet appareil, ?perf=0 l'éteint
const perf = new URLSearchParams(location.search).get('perf');
if (perf !== null) perf === '0' ? localStorage.removeItem('pandiflow-perf') : localStorage.setItem('pandiflow-perf', '1');
if (localStorage.getItem('pandiflow-perf')) {
  const appCode = performance.now();
  import('./lib/perf.js').then((m) => m.startPerf({ appCode })).catch((e) => console.warn('Pandi : compteur indisponible', e?.message));
}

initSky(document.getElementById('sky'));
unlockAudio();
render(html`<${App} />`, document.getElementById('app'));
// Le relais (js/relais.js) range d'abord une connexion venue d'une autre adresse (8 s au plus)
const relayed = window.PandiRelais?.ready || Promise.resolve();
Promise.race([relayed, new Promise((done) => setTimeout(done, 8000))])
  .then(() => actions.boot())
  .then(() => actions.watchVisibility());

if (!location.hash) navigate('soiree', { replace: true });

// Application installable (PWA) : uniquement en ligne, pas pendant le développement local
if ('serviceWorker' in navigator && location.protocol === 'https:' && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
