// Pandi en 3D dans un écran. Le moteur 3D (three.js) n'est chargé qu'au premier Pandi affiché ;
// sans WebGL, l'app garde le Pandi dessiné (Coin.js).
import { html, useEffect, useRef, useState } from '../vendor/preact-htm.js';
import { eveningDate } from '../lib/dates.js';
import { prefersReducedMotion } from '../lib/util.js';
import { pandiVoice } from '../lib/sounds.js';

let stage = null;
const loadStage = () => (stage ||= import('../mascot/stage.js'));

let gl = null;
export function has3D() {
  if (gl === null) {
    try {
      const c = document.createElement('canvas');
      const ctx = c.getContext('webgl2') || c.getContext('webgl');
      gl = Boolean(ctx);
      ctx?.getExtension('WEBGL_lose_context')?.loseContext(); // un contexte de moins pour iOS, qui en limite le nombre
    } catch {
      gl = false;
    }
  }
  return gl;
}

// act : le numéro (voir js/mascot/acts.js) ; ctx : ses réglages (zone des dents, tempo, variante…)
// framing : 'full', 'bust' ou 'auto' ; sound : Pandi fait ses petits bruits ; active : false = en pause
export function Pandi3D({ act = 'idle', ctx = {}, framing = 'full', base = 'bust', class: cls = '', fps = 0, sound = false, active = true, brushColor, label = 'Pandi le panda' }) {
  const ref = useRef(null);
  const ctl = useRef(null);
  const [ready, setReady] = useState(false);
  const voice = useRef(sound);
  voice.current = sound;
  const ctxKey = JSON.stringify(ctx);
  const className = `pandi3d ${cls}`.trim();

  useEffect(() => {
    let alive = true;
    loadStage()
      .then((m) => {
        if (!alive || !ref.current) return;
        const still = prefersReducedMotion();
        ctl.current = m.mountPandi(ref.current, {
          act, ctx, framing, base, brushColor, still, fps: still ? 4 : fps, className, label,
          date: eveningDate(),
          onCue: (cue) => voice.current && pandiVoice(cue),
          // apparition en douceur une fois la première image dessinée (canvas.pandi3d.ready, app.css)
          onFirstDraw: () => ctl.current?.canvas.classList.add('ready'),
        });
        setReady(true);
      })
      .catch((e) => console.warn('Pandi : Pandi 3D indisponible', e?.message));
    return () => {
      alive = false;
      ctl.current?.destroy();
      ctl.current = null;
    };
  }, []);
  useEffect(() => {
    ctl.current?.play(act, ctx);
  }, [act, ctxKey, ready]);
  useEffect(() => {
    ctl.current?.setActive(active);
  }, [active, ready]);
  useEffect(() => {
    ctl.current?.setFraming(framing);
  }, [framing, ready]);
  useEffect(() => {
    const c = ctl.current?.canvas;
    if (c) c.className = `${className}${c.classList.contains('ready') ? ' ready' : ''}`;
  }, [className, ready]);

  // La surface 3D (un <canvas> WebGL réutilisé d'un Pandi à l'autre, voir stage.js) est posée dans ce
  // support sans boîte : pour la mise en page, c'est comme si le canvas était directement à sa place
  return html`<span ref=${ref} class="pandi3d-host" style="display:contents" />`;
}
