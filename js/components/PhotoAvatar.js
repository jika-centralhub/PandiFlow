// Photo -> avatar : la photo est analysée par Claude (Edge Function), qui règle le personnage.
import { html, useEffect, useRef, useState } from '../vendor/preact-htm.js';
import { useStore } from '../lib/store.js';
import * as actions from '../lib/actions.js';
import { Modal } from './ui.js';
import { Avatar } from '../avatar/Avatar.js';
import { resizeImage } from '../lib/photo.js';
import { confettiBurst } from '../anim/fx.js';
import { sfx } from '../lib/sounds.js';

const MESSAGES = [
  'Pandi sort sa baguette magique…',
  'On mélange les couleurs…',
  'On dessine les cheveux un par un…',
  'On ajoute des étoiles dans les yeux…',
  'Presque fini…',
];

export function PhotoAvatar({ child, onClose, onEdit }) {
  const s = useStore();
  const [step, setStep] = useState(s.settings.photoConsent ? 'capture' : 'consent');
  const [agree, setAgree] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(0);
  const camInput = useRef(null);
  const fileInput = useRef(null);
  const resultRef = useRef(null);

  useEffect(() => {
    if (step !== 'magic') return;
    const t = setInterval(() => setMsg((m) => (m + 1) % MESSAGES.length), 1600);
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

  async function runMagic() {
    setStep('magic');
    sfx.whoosh();
    try {
      const [res] = await Promise.all([actions.analyzePhoto(child.id, photo.base64, photo.mediaType), new Promise((r) => setTimeout(r, 2800))]);
      setPhoto(null);
      setResult(res);
      setStep('result');
      sfx.sparkle();
      setTimeout(() => confettiBurst(resultRef.current), 200);
    } catch (e) {
      setError(e.message || "La magie n'a pas marché cette fois-ci.");
      setStep('capture');
    }
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
          <p>La photo de ${child.name} est envoyée une seule fois à Claude (l'IA d'Anthropic) pour repérer sa coiffure, la couleur de ses cheveux et de ses yeux, sa couleur de peau ou ses lunettes.</p>
          <p style="margin-top:8px"><strong>La photo n'est jamais enregistrée</strong> : PandiFlow ne garde que les réglages du personnage dessiné, que tu peux retoucher ensuite.</p>
          <label><input type="checkbox" checked=${agree} onChange=${(e) => setAgree(e.target.checked)} /> Je suis parent de ${child.name} et j'accepte l'envoi de la photo pour l'analyse.</label>
        </div>
        <div class="sheet-actions">
          <button class="btn btn-green" disabled=${!agree} onClick=${() => { actions.updateSettings({ photoConsent: true }); setStep('capture'); }}>Continuer</button>
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
                <button class="btn btn-pink btn-big" onClick=${runMagic}>✨ Lancer la magie</button>`
            : html`<button class="btn btn-blue" onClick=${() => camInput.current.click()}>📸 Prendre la photo</button>
                <button class="btn btn-ghost" style="color:var(--ink)" onClick=${() => fileInput.current.click()}>🖼️ Choisir une photo</button>`}
        </div>`}

      ${step === 'magic' && html`
        <h2>Transformation en cours…</h2>
        <div class="photo-frame magic">
          ${photo && html`<img src=${photo.dataUrl} alt="" />`}
          <div class="magic-swirl">${['✨', '⭐', '💫', '🌟', '✨', '⭐'].map((e, i) => html`<span key=${i} style=${{ animationDelay: `${-i * 0.4}s` }}>${e}</span>`)}</div>
        </div>
        <div class="magic-msg">${MESSAGES[msg]}</div>`}

      ${step === 'result' && result && html`
        <h2>Tadaaa ! 🎉</h2>
        <div class="photo-result" ref=${resultRef}>
          <${Avatar} look=${result.look} equipped=${child.equipped} expr="joy" pose="cheer" mode="full" seed=${child.id} />
        </div>
        ${result.demo && html`<p class="hint" style="color:var(--ink-soft)">Mode démo : avatar imaginé au hasard. Avec Supabase, Claude analysera vraiment la photo.</p>`}
        ${result.notes && html`<p class="hint" style="color:var(--ink-soft)">${result.notes}</p>`}
        <div class="sheet-actions">
          <button class="btn btn-ghost" style="color:var(--ink)" onClick=${() => { setResult(null); setStep('capture'); }}>Reprendre une photo</button>
          <button class="btn btn-ghost" style="color:var(--ink)" onClick=${() => save(true)}>Retoucher</button>
          <button class="btn btn-green btn-big" onClick=${() => save(false)}>C'est moi !</button>
        </div>`}
    </div>
  <//>`;
}
