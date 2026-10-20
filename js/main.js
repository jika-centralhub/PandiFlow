import { html, render, useEffect } from './vendor/preact-htm.js';
import { useStore } from './lib/store.js';
import * as actions from './lib/actions.js';
import { useRoute, navigate } from './router.js';
import { initSky } from './anim/sky.js';
import { unlockAudio } from './lib/sounds.js';
import { Toast, Loading } from './components/ui.js';
import { OverlayHost } from './components/Overlays.js';
import { Evening } from './pages/Evening.js';
import { ChildPage } from './pages/Child.js';
import { ParentPage } from './pages/Parent.js';
import { Login, NewPassword } from './pages/Login.js';
import { Setup } from './pages/Setup.js';

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

  if (page === 'enfant' && id) return html`<${ChildPage} key=${id} childId=${id} tab=${route.query.onglet} rayon=${route.query.rayon} />`;
  if (page === 'parent') return html`<${ParentPage} section=${id} />`;
  return html`<${Evening} />`;
}

function App() {
  const s = useStore();
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', Boolean(s.prefs.reducedMotion));
  }, [s.prefs.reducedMotion]);
  return html`<${Router} /><${OverlayHost} /><${Toast} />`;
}

initSky(document.getElementById('sky'));
unlockAudio();
render(html`<${App} />`, document.getElementById('app'));
actions.boot().then(() => actions.watchVisibility());

if (!location.hash) navigate('soiree', { replace: true });

// Application installable (PWA) : uniquement en ligne, pas pendant le développement local
if ('serviceWorker' in navigator && location.protocol === 'https:' && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
