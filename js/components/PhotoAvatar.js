// Photo -> avatar : Claude règle le personnage dessiné (Edge Function analyze-photo) et OpenAI crée
// le personnage façon film d'animation 3D, tête et haut du corps, en 4 poses (Edge Function make-portrait).
// Un enfant qui a déjà un visage 3D (tête seule) peut recevoir son corps sans nouvelle photo.
import { html, useEffect, useRef, useState } from '../vendor/preact-htm.js';
import { useStore } from '../lib/store.js';
import * as actions from '../lib/actions.js';
import { Modal } from './ui.js';
import { Avatar } from '../avatar/Avatar.js';
import { resizeImage } from '../lib/photo.js';
import { confettiBurst } from '../anim/fx.js';
import { sfx } from '../lib/sounds.js';

// Version du consentement : la 2 ajoute l'envoi de la photo à OpenAI pour le visage 3D
const CONSENT = 2;

const MESSAGES = [
  'Pandi sort sa baguette magique…',
  'On allume les projecteurs du studio…',
  'On sculpte ton visage en 3D…',
  'On dessine les cheveux un par un…',
  'On ajoute des étoiles dans les yeux…',
  'On répète les grimaces…',
  'Presque fini…',
];

// Les 4 poses créées, et comment l'avatar les montre
const FACES = [
  { expr: 'happy', label: 'Sourire', emoji: '😊', show: { expr: 'happy', pose: 'idle' } },
  { expr: 'encourage', label: 'Courage', emoji: '💪', show: { expr: 'encourage', pose: 'idle' } },
  { expr: 'joy', label: 'Bravo', emoji: '🙌', show: { expr: 'joy', pose: 'cheer' } },
  { expr: 'dance', label: 'Danse', emoji: '💃', show: { expr: 'joy', pose: 'dance' } },
];

export function PhotoAvatar({ child, onClose, onEdit }) {
  const s = useStore();
  const [step, setStep] = useState(s.settings.photoConsent === CONSENT ? 'capture' : 'consent');
  const [agree, setAgree] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [faces, setFaces] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(0);
  const camInput = useRef(null);
  const fileInput = useRef(null);
  const resultRef = useRef(null);
  const cloud = actions.canMakePortrait();
  const faceVersion = cloud ? actions.faceOnlyVersion(child.look) : null;

  useEffect(() => {
    if (step !== 'magic') return;
    const t = setInterval(() => setMsg((m) => Math.min(m + 1, MESSAGES.length - 1)), 6000);
    return () => clearInterval(t);
  }, [step]);

  // On efface la photo de la mémoire dès qu'on quitte l'écran
  useEffect(() => () => setPhoto(null), []);

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPhoto(await resizeImage(file));
      setError(null);
    } catch {
      setError("Impossible de lire cette photo. Essaie avec une autre.");
    }
  }

  // fromFace : corps créé à partir du visage 3D déjà enregistré, sans photo (l'avatar dessiné ne change pas)
  async function runMagic(fromFace = false) {
    setStep('magic');
    setMsg(0);
    setFaces({});
    sfx.whoosh();
    const onFace = (expr, url) => {
      setFaces((f) => ({ ...f, [expr]: url }));
      sfx.sparkle();
    };
    const source = fromFace ? { fromFace: faceVersion } : { image: photo.base64, mediaType: photo.mediaType };
    const [analysis, portrait] = await Promise.allSettled([
      fromFace ? Promise.resolve({ look: child.look }) : actions.analyzePhoto(child.id, photo.base64, photo.mediaType),
      cloud ? actions.makePortrait(child.id, source, onFace) : Promise.resolve(null),
      new Promise((r) => setTimeout(r, 2800)),
    ]);
    if (analysis.status === 'rejected' && portrait.status !== 'fulfilled') {
      setError(portrait.reason?.message || analysis.reason?.message || "La magie n'a pas marché cette fois-ci.");
      setStep('capture');
      return;
    }
    const drawn = analysis.status === 'fulfilled' ? analysis.value : { look: child.look };
    const face = portrait.status === 'fulfilled' ? portrait.value : null;
    // Le visage 3D a échoué : on le dit clairement, on garde la photo pour réessayer,
    // et l'avatar dessiné n'est proposé qu'en solution de secours
    const warning = cloud && !face ? portrait.reason?.message || "La magie n'a pas marché cette fois-ci." : null;
    if (!warning) setPhoto(null);
    const { portrait: _old, ...look } = drawn.look;
    // Corps à partir du visage qui échoue : l'enfant garde son visage 3D actuel
    const fallback = fromFace ? drawn.look : look;
    setResult({ ...drawn, look: face ? { ...look, portrait: face } : fallback, warning, in3d: Boolean(face), fromFace });
    setStep('result');
    if (warning) return;
    sfx.sparkle();
    setTimeout(() => confettiBurst(resultRef.current), 200);
  }

  function save(edit = false) {
    actions.saveLook(child.id, { ...result.look });
    sfx.green();
    onClose();
    if (edit) onEdit?.();
  }

  return html`<${Modal} onClose=${onClose} style=${{ '--kid': child.color, width: 'min(100%, calc(var(--u) * 120))' }}>
    <div class="photo-flow">
      ${step === 'consent' && html`
        <h2>Avatar magique 📸</h2>
        <div class="consent">
          <p>La photo de ${child.name} est envoyée une seule fois à deux IA : Claude (Anthropic) repère sa coiffure, ses couleurs et ses lunettes, et OpenAI crée son personnage façon film d'animation 3D (visage et haut du corps), en 4 poses.</p>
          <p style="margin-top:8px"><strong>La photo n'est jamais enregistrée</strong> : PandiFlow ne garde que le personnage créé (les 4 images, visibles seulement par votre famille), que tu peux remplacer ou retirer quand tu veux.</p>
          <label><input type="checkbox" checked=${agree} onChange=${(e) => setAgree(e.target.checked)} /> Je suis parent de ${child.name} et j'accepte l'envoi de la photo à Claude et à OpenAI.</label>
        </div>
        <div class="sheet-actions">
          <button class="btn btn-green" disabled=${!agree} onClick=${() => { actions.updateSettings({ photoConsent: CONSENT }); setStep('capture'); }}>Continuer</button>
        </div>`}

      ${step === 'capture' && html`
        <h2>${photo ? 'Belle photo !' : `Une photo de ${child.name}`}</h2>
        <div class="photo-frame">
          ${photo ? html`<img src=${photo.dataUrl} alt="" />` : html`<div style="display:grid;place-items:center;height:100%;font-size:calc(var(--u)*20)">🙂</div>`}
          <div class="guide" />
        </div>
        <p class="hint" style="color:var(--ink-soft)">Visage bien en face, avec de la lumière, sans chapeau.</p>
        ${error && html`<p style="color:#b42536;font-weight:600">${error}</p>`}
        <input ref=${camInput} type="file" accept="image/*" capture="user" hidden onChange=${onFile} />
        <input ref=${fileInput} type="file" accept="image/*" hidden onChange=${onFile} />
        <div class="sheet-actions">
          ${photo
            ? html`<button class="btn btn-ghost" style="color:var(--ink)" onClick=${() => setPhoto(null)}>Reprendre</button>
                <button class="btn btn-pink btn-big" onClick=${() => runMagic()}>✨ Lancer la magie</button>`
            : html`<button class="btn btn-blue" onClick=${() => camInput.current.click()}>📸 Prendre la photo</button>
                <button class="btn btn-ghost" style="color:var(--ink)" onClick=${() => fileInput.current.click()}>🖼️ Choisir une photo</button>`}
        </div>
        ${!photo && faceVersion && html`<div class="body-from-face">
          <p class="hint" style="color:var(--ink-soft)">${child.name} a déjà son visage 3D : Pandi peut lui créer son corps, sans nouvelle photo.</p>
          <button class="btn btn-pink" onClick=${() => runMagic(true)}>🧍 Créer le corps 3D</button>
        </div>`}`}

      ${step === 'magic' && html`
        <h2>Transformation en cours…</h2>
        <div class="photo-frame magic">
          ${photo ? html`<img src=${photo.dataUrl} alt="" />` : html`<${Avatar} look=${child.look} mode="head" seed=${child.id} />`}
          <div class="magic-swirl">${['✨', '⭐', '💫', '🌟', '✨', '⭐'].map((e, i) => html`<span key=${i} style=${{ animationDelay: `${-i * 0.4}s` }}>${e}</span>`)}</div>
        </div>
        <div class="magic-msg">${MESSAGES[msg]}</div>
        ${cloud && html`<div class="face-row">
          ${FACES.map((f) => html`<div key=${f.expr} class="face-slot">
            <div class=${`pic tall ${faces[f.expr] ? '' : 'wait'}`}>${faces[f.expr] ? html`<img src=${faces[f.expr]} alt="" />` : html`<span>${f.emoji}</span>`}</div>
            ${f.label}
          </div>`)}
        </div>
        <p class="hint" style="color:var(--ink-soft)">Le studio prend environ deux minutes.</p>`}`}

      ${step === 'result' && result?.warning && html`
        <h2>Pas de personnage 3D cette fois 😕</h2>
        <p style="color:#b42536;font-weight:600">${result.warning}</p>
        <p class="hint" style="color:var(--ink-soft)">${result.fromFace ? `${child.name} garde son personnage actuel en attendant :` : "En attendant, Pandi a réglé l'avatar dessiné d'après la photo :"}</p>
        <div class="photo-result" style="height:calc(var(--u) * 44)">
          <${Avatar} look=${result.look} equipped=${child.equipped} expr="happy" mode="full" seed=${child.id} />
        </div>
        <div class="sheet-actions">
          <button class="btn btn-ghost" style="color:var(--ink)" onClick=${() => (result.fromFace ? onClose() : save(false))}>${result.fromFace ? 'Plus tard' : 'Garder le dessin'}</button>
          ${photo || faceVersion
            ? html`<button class="btn btn-pink btn-big" onClick=${() => runMagic(!photo)}>✨ Réessayer la 3D</button>`
            : html`<button class="btn btn-pink btn-big" onClick=${() => { setResult(null); setStep('capture'); }}>📸 Une autre photo</button>`}
        </div>`}

      ${step === 'result' && result && !result.warning && html`
        <h2>Tadaaa ! 🎉</h2>
        <div class="photo-result" ref=${resultRef}>
          <${Avatar} look=${result.look} equipped=${child.equipped} expr="joy" pose="cheer" mode="full" seed=${child.id} />
        </div>
        ${result.in3d && html`<div class="face-row">
          ${FACES.filter((f) => result.look.portrait?.exprs[f.expr]).map((f) => html`<div key=${f.expr} class="face-slot">
            <div class="pic tall"><${Avatar} look=${result.look} equipped=${child.equipped} expr=${f.show.expr} pose=${f.show.pose} mode="full" seed=${child.id} /></div>
            ${f.label}
          </div>`)}
        </div>`}
        ${result.demo && html`<p class="hint" style="color:var(--ink-soft)">Mode démo : avatar imaginé au hasard. Avec Supabase, la photo devient un vrai personnage 3D.</p>`}
        ${result.notes && html`<p class="hint" style="color:var(--ink-soft)">${result.notes}</p>`}
        <div class="sheet-actions">
          <button class="btn btn-ghost" style="color:var(--ink)" onClick=${() => { setResult(null); setStep('capture'); }}>Reprendre une photo</button>
          <button class="btn btn-ghost" style="color:var(--ink)" onClick=${() => save(true)}>Retoucher</button>
          <button class="btn btn-green btn-big" onClick=${() => save(false)}>C'est moi !</button>
        </div>`}
    </div>
  <//>`;
}
