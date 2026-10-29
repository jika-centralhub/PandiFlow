// La scène 3D d'un exercice du coin calme (le personnage de l'exercice et Pandi à côté de lui).
// Le moteur 3D n'est chargé qu'à l'ouverture de l'exercice ; sans WebGL, le coin calme garde ses dessins.
import { html, useEffect, useRef, useState } from '../vendor/preact-htm.js';
import { eveningDate } from '../lib/dates.js';
import { prefersReducedMotion } from '../lib/util.js';
import { has3D } from './Pandi3D.js';

let scene = null;
const loadScene = () => (scene ||= import('../mascot/calm/scene.js'));

// Les exercices qui ont leur personnage en 3D le disent dans js/lib/emotions.js (hero)
export const hasCalmHero = (hero) => Boolean(hero) && has3D();
// dès que l'exercice est proposé : la scène est prête quand l'enfant appuie sur « C'est parti ! »
export const preloadCalmStage = () => loadScene().catch(() => {});

// ctx : l'étape en cours ({ phase, secs, … }) ; chaque changement est transmis aux personnages
export function CalmStage({ hero, ctx = {}, label = 'Pandi et son ami font l’exercice' }) {
  const ref = useRef(null);
  const ctl = useRef(null);
  const [ready, setReady] = useState(false);
  const key = JSON.stringify(ctx);

  useEffect(() => {
    let alive = true;
    loadScene()
      .then((m) => {
        if (!alive || !ref.current) return;
        ctl.current = m.mountCalm(ref.current, {
          hero, ctx, date: eveningDate(), still: prefersReducedMotion(), className: 'cc-stage3d', label,
          onFirstDraw: () => ctl.current?.canvas.classList.add('ready'),
        });
        setReady(true);
      })
      .catch((e) => console.warn('Pandi : coin calme 3D indisponible', e?.message));
    return () => {
      alive = false;
      ctl.current?.destroy();
      ctl.current = null;
    };
  }, [hero]);
  useEffect(() => {
    if (ready) ctl.current?.set(ctx);
  }, [key]);

  // La surface 3D (canvas WebGL de classe cc-stage3d, voir stage.js) est posée dans ce support sans boîte
  return html`<span ref=${ref} class="cc-stage3d-host" style="display:contents" />`;
}
