// Assistant de démarrage d'une nouvelle famille : 10 étapes guidées par Pandi, chacune passable,
// tout reste modifiable ensuite dans l'espace parent.
//   1 à 3, avant que la famille existe (AccueilDebut, depuis Setup) : comment ça marche, les enfants,
//     les routines du soir et du matin ; « Créer ma famille » à la fin.
//   4 à 10, une fois la famille créée (Accueil, repris sur cet appareil si l'app est fermée) : le code
//     parent, le personnage de chaque enfant (photo magique ou composé, ou plus tard), les règles des
//     notes avec une note d'essai, le coffre de l'équipe, l'autre parent, la télé, l'écran d'accueil.
import { html, useState } from '../vendor/preact-htm.js';
import { useStore } from '../lib/store.js';
import * as actions from '../lib/actions.js';
import { navigate } from '../router.js';
import { Pandi } from '../components/Coin.js';
import { Modal, NumberInput, SexPicker, Toggle } from '../components/ui.js';
import { PinPad } from '../components/PinGate.js';
import { PhotoAvatar } from '../components/PhotoAvatar.js';
import { LookEditor } from '../components/LookEditor.js';
import { InstallHelp } from '../components/Install.js';
import { Avatar } from '../avatar/Avatar.js';
import { shareInvite, fmtCode, fmtDate } from '../components/FamilyMembers.js';
import { CHILD_COLORS, KID_PALETTE } from '../avatar/palette.js';
import { COLOR_META, PETIT_AGE, activeChildren, scaleOf, pointsFor, weeklyStones, routineOf } from '../domain.js';
import { DEFAULT_TASKS, EXTRA_TASKS, DEFAULT_MORNING_TASKS, fitsAge } from '../lib/seed.js';
import { WEEKDAYS_SHORT } from '../lib/dates.js';
import { canFullscreen, isInstalled } from '../lib/device.js';
import { useInstallState } from '../lib/install.js';
import { sfx } from '../lib/sounds.js';

const STEPS = ['comment', 'enfants', 'routines', 'code', 'perso', 'notes', 'coffre', 'parent', 'tele', 'app'];
const LABELS = {
  comment: 'Comment ça marche',
  enfants: 'Les enfants',
  routines: 'Les routines',
  code: 'Le code parent',
  perso: 'Les personnages',
  notes: 'Les notes',
  coffre: 'Le coffre',
  parent: "L'autre parent",
  tele: 'La télé',
  app: "L'écran d'accueil",
};
const names = (kids) => kids.map((k) => k.name).join(', ').replace(/, ([^,]*)$/, ' et $1');

// Pandi qui parle, et la carte de l'étape (la barre d'avancement en haut, les boutons en bas)
function Shell({ step, progress = step, say, mood = 'neutral', children }) {
  const i = STEPS.indexOf(progress);
  return html`<div class="welcome accueil page-enter">
    <div class="ac-pandi">
      <${Pandi} mood=${mood} />
      <p class="ac-say" key=${step}>${say}</p>
    </div>
    <div class="card sheet ac-card" key=${step}>
      ${i >= 0 && html`<div class="ac-progress">
        <div class="ac-dots" aria-hidden="true">${STEPS.map((x, j) => html`<i key=${x} class=${j < i ? 'done' : j === i ? 'on' : ''} />`)}</div>
        <span>Étape ${i + 1} sur ${STEPS.length} · ${LABELS[progress]}</span>
      </div>`}
      ${children}
    </div>
  </div>`;
}

function Actions({ back, alt, altLabel, skip, skipLabel = 'Passer', next, nextLabel = 'Continuer', disabled, busy }) {
  return html`<div class="ac-actions">
    ${back && html`<button class="p-btn ac-back" aria-label="Retour" onClick=${() => { sfx.tap(); back(); }}>←<span> Retour</span></button>`}
    ${alt && html`<button class="p-btn" onClick=${alt}>${altLabel}</button>`}
    <span class="ac-gap" />
    ${skip && html`<button class="p-btn ac-skip" onClick=${() => { sfx.tap(); skip(); }}>${skipLabel}</button>`}
    ${next && html`<button class="btn btn-green ac-next" disabled=${disabled || busy} onClick=${next}>${nextLabel}</button>`}
  </div>`;
}

// Une tâche à garder ou non (une ligne avec un interrupteur)
function TaskToggle({ task, on, meta, onChange }) {
  return html`<div class=${`row ac-task ${on ? '' : 'off'}`}>
    <span class="emoji">${task.emoji}</span>
    <div class="grow"><div class="title">${task.title}</div>${meta && html`<div class="meta">${meta}</div>`}</div>
    <${Toggle} on=${on} label=${task.title} onChange=${onChange} />
  </div>`;
}

const toggleIn = (set, key, on) => {
  const next = new Set(set);
  if (on) next.add(key);
  else next.delete(key);
  return next;
};

// --- 1 à 3 : avant la famille ------------------------------------------------------------------
export function AccueilDebut({ onJoin }) {
  const [step, setStep] = useState('comment');
  const [familyName, setFamilyName] = useState('');
  const [kids, setKids] = useState([{ name: '', age: 6, sex: null, color: CHILD_COLORS[0] }]);
  const [evening, setEvening] = useState(() => new Set(DEFAULT_TASKS.map((t) => t.key)));
  const [morningOn, setMorningOn] = useState(true);
  const [morning, setMorning] = useState(() => new Set(DEFAULT_MORNING_TASKS.map((t) => t.key)));
  const [departure, setDeparture] = useState('08:15');
  const [schoolDays, setSchoolDays] = useState([1, 2, 3, 4, 5]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const go = (s) => {
    setError(null);
    setStep(s);
  };
  const setKid = (i, patch) => setKids((list) => list.map((k, j) => (j === i ? { ...k, ...patch } : k)));
  const nextColor = (c) => KID_PALETTE[(KID_PALETTE.indexOf(c) + 1) % KID_PALETTE.length];
  const validKids = kids.filter((k) => k.name.trim()).map((k) => ({ ...k, name: k.name.trim() }));
  // Une idée ne s'affiche que si elle convient à au moins un enfant
  const eveningList = [...DEFAULT_TASKS, ...EXTRA_TASKS].filter((t) => validKids.some((k) => fitsAge(t, k)));
  const chosenEvening = eveningList.filter((t) => evening.has(t.key));
  const chosenMorning = morningOn ? DEFAULT_MORNING_TASKS.filter((t) => morning.has(t.key)) : [];

  function eveningMeta(t) {
    const days = t.school ? "Les veilles d'école" : 'Tous les soirs';
    const fit = validKids.filter((k) => fitsAge(t, k));
    return fit.length < validKids.length ? `${days} · pour ${names(fit)}` : days;
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await actions.createFamily({
        name: familyName.trim() || 'Ma famille',
        children: validKids.map((k) => ({ name: k.name, age: k.age, sex: k.sex, color: k.color })),
        routines: {
          evening: chosenEvening.map((t) => t.key),
          morning: morningOn ? chosenMorning.map((t) => t.key) : null,
          schoolDays,
          departure,
        },
      });
      sfx.fanfare();
    } catch (e) {
      setError(e.message || 'Une erreur est survenue.');
      sfx.error();
      setBusy(false);
    }
  }

  if (step === 'comment') {
    return html`<${Shell} step="comment" say="Bonjour ! Je suis Pandi. On prépare tout ensemble : ça prend quelques minutes.">
      <h1>Bienvenue dans Pandi !</h1>
      <div class="row-list ac-how">
        <div class="row"><span class="emoji">📺</span><div class="grow"><div class="title">Ton téléphone, sur la télé</div><div class="meta">Tu ouvres Pandi sur ton téléphone et tu l'affiches sur la télé : les enfants voient leurs tâches, toi tu notes.</div></div></div>
        <div class="row"><span class="emoji">🌟</span><div class="grow"><div class="title">Tu notes la coopération</div><div class="meta">À chaque tâche, un geste : du premier coup, après un rappel, ou il a fallu répéter.</div></div></div>
        <div class="row"><span class="emoji">🛍️</span><div class="grow"><div class="title">Ils gagnent des pandi</div><div class="meta">Ils les dépensent dans la boutique : habits, objets et compagnons pour leur personnage.</div></div></div>
        <div class="row"><span class="emoji">🧰</span><div class="grow"><div class="title">En équipe</div><div class="meta">Chaque tâche faite remplit le coffre de l'équipe, qui mène à une vraie récompense en famille.</div></div></div>
      </div>
      <p class="ac-alt">L'autre parent a déjà créé la famille ? Choisis « J'ai un code » et entre le code de son invitation.</p>
      <${Actions} alt=${onJoin} altLabel="J'ai un code" next=${() => { sfx.tap(); go('enfants'); }} nextLabel="C'est parti !" />
      <p class="ac-alt"><button class="ac-link" onClick=${() => actions.signOut()}>Se déconnecter</button></p>
    <//>`;
  }

  if (step === 'enfants') {
    return html`<${Shell} step="enfants" say="Qui va jouer avec moi ?">
      <h1>Les enfants</h1>
      <div class="field"><label>Nom de la famille</label><input class="input" value=${familyName} onInput=${(e) => setFamilyName(e.target.value)} placeholder="Ex. : Famille Martin" /></div>
      <div class="field"><label>Les enfants</label>
        ${kids.map((k, i) => html`<div key=${i} class="row ac-kid" style=${{ '--kid': k.color }}>
          <button class="ac-color" aria-label=${`Changer la couleur de ${k.name || `l'enfant ${i + 1}`}`} title="Changer la couleur" onClick=${() => { sfx.pop(); setKid(i, { color: nextColor(k.color) }); }} />
          <input class="input grow" value=${k.name} maxLength="20" onInput=${(e) => setKid(i, { name: e.target.value })} placeholder=${`Prénom de l'enfant ${i + 1}`} />
          <span class="ac-age"><${NumberInput} value=${k.age} onChange=${(v) => setKid(i, { age: v })} min=${2} max=${14} /> ans</span>
          <${SexPicker} value=${k.sex} onChange=${(v) => setKid(i, { sex: v })} />
          ${kids.length > 1 && html`<button class="p-btn icon" onClick=${() => setKids((l) => l.filter((_, j) => j !== i))} aria-label="Retirer">✕</button>`}
        </div>`)}
        ${kids.length < 6 && html`<button class="p-btn" onClick=${() => setKids((l) => [...l, { name: '', age: 6, sex: null, color: CHILD_COLORS[l.length % CHILD_COLORS.length] }])}>+ Un autre enfant</button>`}
      </div>
      <p class="hint">L'âge choisit les tâches proposées et le barème (les moins de ${PETIT_AGE} ans ont un barème plus doux). « Garçon ou fille » est facultatif : il accorde les textes (« Bravo championne ! »). Touche la pastille pour changer la couleur de l'enfant.</p>
      <${Actions} back=${() => go('comment')} next=${() => { sfx.tap(); go('soir'); }} disabled=${!validKids.length} />
    <//>`;
  }

  if (step === 'soir') {
    return html`<${Shell} step="soir" progress="routines" say="Voici la routine du soir que je propose. Décoche ce que vous ne faites pas.">
      <h1>La routine du soir</h1>
      <div class="row-list">
        ${eveningList.filter((t) => DEFAULT_TASKS.includes(t)).map((t) => html`<${TaskToggle} key=${t.key} task=${t} meta=${eveningMeta(t)} on=${evening.has(t.key)} onChange=${(on) => setEvening(toggleIn(evening, t.key, on))} />`)}
      </div>
      <h3 class="section-title ac-sub">D'autres idées</h3>
      <div class="row-list">
        ${eveningList.filter((t) => !DEFAULT_TASKS.includes(t)).map((t) => html`<${TaskToggle} key=${t.key} task=${t} meta=${eveningMeta(t)} on=${evening.has(t.key)} onChange=${(on) => setEvening(toggleIn(evening, t.key, on))} />`)}
      </div>
      <p class="hint">L'histoire du soir et le câlin ne sont pas des tâches à noter : ils restent offerts, quoi qu'il arrive. Les tâches, leurs jours et leur ordre se changent ensuite dans Espace parent → Tâches.</p>
      <${Actions} back=${() => go('enfants')} next=${() => { sfx.tap(); go('matin'); }} />
    <//>`;
  }

  // Le matin, puis la création de la famille
  const total = chosenEvening.length + chosenMorning.length;
  return html`<${Shell} step="matin" progress="routines" say="Et le matin, avant l'école ?">
    <h1>La routine du matin</h1>
    <div class="row-list">
      <div class="row"><span class="emoji">☀️</span><div class="grow"><div class="title">Une routine du matin</div><div class="meta">L'app ouvre le matin jusqu'à 13 h, puis le soir</div></div>
        <${Toggle} on=${morningOn} label="Une routine du matin" onChange=${setMorningOn} /></div>
      ${morningOn && html`<div class="row"><span class="emoji">⏰</span><div class="grow"><div class="title">Heure du départ à l'école</div><div class="meta">L'écran affiche le temps qui reste, avec un rappel à 10 et à 5 minutes</div></div>
        <input class="input time-input" type="time" value=${departure} onChange=${(e) => e.target.value && setDeparture(e.target.value)} /></div>`}
      ${morningOn && html`<div class="row"><span class="emoji">📅</span><div class="grow"><div class="title">Jours d'école</div></div>
        <div class="days">${[1, 2, 3, 4, 5, 6, 0].map((d) => {
          const on = schoolDays.includes(d);
          return html`<button key=${d} class=${`day ${on ? 'on' : ''}`} aria-pressed=${on} onClick=${() => { sfx.tap(); setSchoolDays(on ? schoolDays.filter((x) => x !== d) : [...schoolDays, d].sort()); }}>${WEEKDAYS_SHORT[d]}</button>`;
        })}</div></div>`}
    </div>
    ${morningOn && html`<h3 class="section-title ac-sub">Les tâches du matin</h3>
      <div class="row-list">
        ${DEFAULT_MORNING_TASKS.map((t) => html`<${TaskToggle} key=${t.key} task=${t} on=${morning.has(t.key)} onChange=${(on) => setMorning(toggleIn(morning, t.key, on))} />`)}
      </div>`}
    ${!total && html`<p class="ac-error">Garde au moins une tâche, le soir ou le matin.</p>`}
    ${error && html`<p class="ac-error">${error}</p>`}
    <${Actions} back=${() => go('soir')} next=${create} nextLabel=${busy ? 'Préparation…' : 'Créer ma famille'} disabled=${!total || (morningOn && !schoolDays.length)} busy=${busy} />
  <//>`;
}

// --- 4 à 8 : la famille existe ------------------------------------------------------------------
const go = (step) => {
  sfx.tap();
  actions.accueilStep(step);
};

const SAY = {
  code: () => "Les enfants voient tout ce qui passe à l'écran : un code secret garde les notes pour les parents.",
  notes: () => "Le plus important : on note si l'enfant a écouté, pas s'il a tout fait seul.",
  coffre: (kids) => (kids.length > 1 ? 'Ensemble, les enfants remplissent un coffre. Au bout, une vraie récompense !' : 'Chaque tâche faite remplit un coffre. Au bout, une vraie récompense !'),
  parent: () => 'Vous êtes deux à coucher les enfants ? Chacun peut noter depuis son téléphone.',
  perso: (kids) => (kids.length > 1 ? 'Et si on créait le personnage de chaque enfant ?' : `Et si on créait le personnage de ${kids[0]?.name || "l'enfant"} ?`),
  tele: () => 'Maintenant, on me met sur la télé !',
  app: () => "Dernière étape : mets-moi sur l'écran d'accueil, je m'ouvrirai d'un geste !",
  pret: (kids) => `Bravo ! À ce soir${kids.length ? `, ${names(kids)}` : ''} !`,
};

// Pandi reste à l'écran d'une étape à l'autre : seule la carte change
export function Accueil() {
  const s = useStore();
  const kids = activeChildren(s.children);
  const steps = { code: StepCode, perso: StepPerso, notes: StepNotes, coffre: StepCoffre, parent: StepParent, tele: StepTele, app: StepApp, pret: StepPret };
  const step = steps[s.accueil?.step] ? s.accueil.step : 'code';
  const Step = steps[step];
  return html`<${Shell} step=${step} say=${SAY[step](kids)} mood=${step === 'pret' ? 'happy' : 'neutral'}><${Step} s=${s} kids=${kids} /><//>`;
}

function StepCode({ s }) {
  const has = Boolean(s.settings.pinHash);
  return html`
    ${has && html`<h1>Le code parent</h1>`}
    ${has
      ? html`<div class="ac-done-box"><span>🔐</span><p><b>Code parent choisi.</b> Il est demandé pour noter, donner des pandi et changer les réglages. Donne-le à l'autre parent, pas aux enfants 😉</p></div>`
      : html`<div class="ac-pin"><${PinPad} onSuccess=${() => sfx.sparkle()} /></div>`}
    <${Actions} skip=${has ? null : () => go('perso')} skipLabel="Plus tard" next=${has ? () => go('perso') : null} />`;
}

// Ce que veut dire chaque note, pour que les deux parents donnent un 🌟 pour les mêmes choses
const RATE_ORDER = ['green', 'orange', 'red', 'pause'];
const RULES = {
  green: 'Il a commencé après une seule demande, sans négocier ni traîner.',
  orange: "Il a fallu redemander une fois, puis il l'a fait.",
  red: "Plusieurs demandes, de la négociation ou de l'opposition.",
  pause: 'Une crise, un moment difficile : la tâche ne compte ni pour ni contre.',
};

function pointsText(color, settings, kids) {
  if (color === 'pause') return 'Aucune note';
  const scales = [...new Set(kids.map(scaleOf))];
  const pts = (scale) => pointsFor(color, settings, { age: scale === 'petit' ? PETIT_AGE - 1 : PETIT_AGE });
  if (scales.length === 2 && pts('petit') !== pts('grand')) return `${pts('petit')} pandi avant ${PETIT_AGE} ans, ${pts('grand')} après`;
  return `${pts(scales[0] || 'grand')} pandi`;
}

function StepNotes({ s, kids }) {
  const kid = kids[0];
  return html`
    <h1>Les notes : les mêmes règles pour les deux parents</h1>
    <div class="row-list ac-rules">
      ${RATE_ORDER.map((c) => html`<div key=${c} class=${`row ac-rule ${c}`}>
        <span class="emoji">${COLOR_META[c].face}</span>
        <div class="grow"><div class="title">${COLOR_META[c].label}</div><div class="meta">${RULES[c]}</div><span class="ac-pts">${pointsText(c, s.settings, kids)}</span></div>
      </div>`)}
    </div>
    <ul class="ac-list">
      <li>On note l'écoute, pas l'autonomie : être aidé ne compte pas contre l'enfant.</li>
      <li>Une note ne retire jamais de pandi.</li>
      <li>Sur la télé, une tâche notée devient simplement « faite » : personne ne voit de couleur ni de chiffre. Le détail est dans le coin de l'enfant.</li>
      <li>L'histoire du soir et le câlin ne se gagnent pas et ne se perdent pas.</li>
    </ul>
    ${kid && html`<${Trial} kid=${kid} settings=${s.settings} />`}
    <${Actions} back=${() => go('perso')} next=${() => go('coffre')} />`;
}

// La note d'essai : une fausse carte sur la « télé », les quatre notes sur le « téléphone ». Rien n'est enregistré.
function Trial({ kid, settings }) {
  const [pick, setPick] = useState(null);
  const pts = pick ? pointsFor(pick, settings, kid) : 0;
  let result = null;
  if (pick === 'green') result = `${kid.name} gagne ${pts} pandi et Pandi danse de joie. Sur la télé, la carte devient dorée : « fait ».`;
  else if (pick === 'orange') result = `${kid.name} gagne ${pts} pandi. Sur la télé, la carte devient dorée : « fait », comme pour un 🌟.`;
  else if (pick === 'red') result = `${pts ? `${kid.name} gagne ${pts} pandi (moins de ${PETIT_AGE} ans)` : `${kid.name} ne gagne pas de pandi, mais n'en perd pas`}. La télé montre aussi « fait » : « il a fallu répéter » se dit, il ne s'affiche pas.`;
  else if (pick === 'pause') result = 'Pas de note, pas de pandi, rien de perdu : la tâche est mise de côté pour ce soir.';
  return html`<div class="ac-trial" style=${{ '--kid': kid.color }}>
    <h3 class="section-title ac-sub">Essaie : note une tâche de ${kid.name}</h3>
    <div class="ac-trial-grid">
      <div class="ac-tv">
        <span class="ac-tag">📺 Sur la télé</span>
        <div class=${`ac-tv-card ${pick ? (pick === 'pause' ? 'paused' : 'done') : ''}`} key=${pick || 'none'}>
          <span class="em">🪥</span><b>Brossage des dents</b>
          <span class="st">${!pick ? 'En attente de la note' : pick === 'pause' ? 'Pas ce soir' : 'Fait ✓'}</span>
        </div>
      </div>
      <div class="ac-phone">
        <span class="ac-tag">📱 Sur ton téléphone</span>
        <div class="ac-rate">${RATE_ORDER.map((c) => html`<button key=${c} class=${`rate-choice ${c} ${pick === c ? 'current' : ''}`} onClick=${() => { sfx.pop(); setPick(c); }}>
          <span class="face">${COLOR_META[c].face}</span>${COLOR_META[c].label}
        </button>`)}</div>
      </div>
    </div>
    <p class="ac-trial-result" role="status">${result || 'Touche une des quatre notes pour voir ce qui se passe.'}</p>
    <p class="hint">C'est un essai : rien n'est enregistré.</p>
  </div>`;
}

const REWARD_IDEAS = [
  'Une sortie au cinéma 🎬',
  'Une soirée pizza en famille 🍕',
  'Un pique-nique au parc 🧺',
  'Une sortie à la piscine 🏊',
  'Une journée au zoo 🦁',
  'Un nouveau jeu de société 🎲',
  'Une soirée crêpes et film 🥞',
  'Une cabane dans le salon ⛺',
];
const SIZES = [200, 500, 1000];

function aboutWeeks(weeks) {
  if (!Number.isFinite(weeks) || weeks <= 0) return '';
  if (weeks < 1.5) return 'environ 1 semaine';
  if (weeks < 7) return `environ ${Math.round(weeks)} semaines`;
  return `environ ${Math.round(weeks / 4.3)} mois`;
}

function StepCoffre({ s, kids }) {
  const weekly = weeklyStones(s);
  const [goal, setGoal] = useState(() => SIZES.reduce((best, g) => (Math.abs(g / weekly - 4) < Math.abs(best / weekly - 4) ? g : best), 500));
  const [reward, setReward] = useState(s.settings.treasure.reward || REWARD_IDEAS[0]);
  const { step, bonus } = s.settings.team;
  const who = kids.length > 1 ? `n'importe quel enfant` : kids[0]?.name || "l'enfant";
  const save = () => {
    actions.newTreasure({ goal, reward: reward.trim() || REWARD_IDEAS[0] });
    sfx.sparkle();
    go('parent');
  };
  return html`
    <h1>Le coffre de l'équipe</h1>
    <p class="ac-text">Chaque tâche faite (🌟 ou 👍) par ${who} met une pierre dans le coffre. Tous les ${step} pierres, ${kids.length > 1 ? 'chaque enfant reçoit' : 'il reçoit'} ${bonus} pandi. Au bout du coffre : une récompense en vrai, à vivre en famille. Rien ne repart à zéro chaque semaine.</p>
    <div class="field"><label>La récompense au bout du coffre</label>
      <div class="chip-row ac-ideas">${REWARD_IDEAS.map((r) => html`<button key=${r} class=${`p-btn ${reward === r ? 'primary' : ''}`} onClick=${() => { sfx.pop(); setReward(r); }}>${r}</button>`)}</div>
      <input class="input" value=${reward} maxLength="60" placeholder="Ou une autre idée…" onInput=${(e) => setReward(e.target.value)} />
    </div>
    <div class="field"><label>La taille du coffre</label>
      <div class="ac-sizes">${SIZES.map((g) => html`<button key=${g} class=${`ac-size ${goal === g ? 'on' : ''}`} aria-pressed=${goal === g} onClick=${() => { sfx.pop(); setGoal(g); }}>
        <b>${g} pierres</b><span>${aboutWeeks(g / weekly)}</span>
      </button>`)}</div>
    </div>
    <p class="hint">La durée est une estimation, d'après vos tâches. La récompense et la taille se changent depuis le coffre 🧰 de l'écran de la soirée.</p>
    <${Actions} back=${() => go('notes')} next=${save} disabled=${!reward.trim()} />`;
}

function StepParent({ s }) {
  const [inv, setInv] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function create() {
    setBusy(true);
    setError(null);
    try {
      setInv(await actions.createInvite());
      sfx.sparkle();
    } catch (e) {
      setError(e.message || "Impossible de créer l'invitation.");
    } finally {
      setBusy(false);
    }
  }
  return html`
    <h1>L'autre parent</h1>
    <p class="ac-text">Invite l'autre parent : vous partagerez la même famille, les mêmes enfants et les mêmes notes, chacun sur son téléphone.</p>
    ${inv
      ? html`<div class="invite-box">
          <p><strong>Invitation créée !</strong> Envoie ce code à l'autre parent :</p>
          <span class="invite-code">${fmtCode(inv.code)}</span>
          <p class="meta">Valable jusqu'au ${fmtDate(inv.expires_at)} · une seule utilisation</p>
          <div class="sheet-actions" style="justify-content:flex-start"><button class="btn btn-blue" onClick=${() => shareInvite(inv)}>📤 Envoyer l'invitation</button></div>
        </div>`
      : html`<div class="sheet-actions" style="justify-content:flex-start"><button class="btn btn-blue" disabled=${busy} onClick=${create}>${busy ? 'Création…' : '+ Créer une invitation'}</button></div>`}
    ${error && html`<p class="ac-error">${error}</p>`}
    <p class="hint">Il crée son compte sur Pandi, puis choisit « Rejoindre une famille » avec ce code. Donne-lui aussi le code parent.${s.mode === 'demo' ? " En démo, l'invitation est factice." : ''} Plus tard : Espace parent → Réglages → Parents de la famille.</p>
    <${Actions} back=${() => go('coffre')} skip=${inv ? null : () => go('tele')} skipLabel="Plus tard" next=${inv ? () => go('tele') : null} />`;
}

function StepTele() {
  return html`
    <h1>Pandi sur la télé</h1>
    <p class="ac-text">Le téléphone qui note s'affiche sur la télé : les enfants voient leurs tâches en grand.</p>
    <div class="row-list">
      <div class="row"><span class="emoji">🤖</span><div class="grow"><div class="title">Android</div><div class="meta">Glisse du haut de l'écran, touche « Caster », « Diffuser » ou « Smart View » selon le téléphone, puis choisis la télé.</div></div></div>
      <div class="row"><span class="emoji">🍏</span><div class="grow"><div class="title">iPhone</div><div class="meta">Ouvre le centre de contrôle, touche « Recopie de l'écran », puis choisis l'Apple TV ou la télé compatible AirPlay.</div></div></div>
      <div class="row"><span class="emoji">🔌</span><div class="grow"><div class="title">Avec un câble</div><div class="meta">Un adaptateur HDMI branché au téléphone marche aussi, sans wifi.</div></div></div>
    </div>
    <h3 class="section-title ac-sub">Tout l'écran en largeur</h3>
    <p class="ac-text">${isInstalled()
      ? 'Tourne le téléphone : la télé est remplie en largeur.'
      : canFullscreen()
        ? "Tourne le téléphone et touche ⛶ en haut de l'écran de la soirée : la télé est remplie, sans les barres du navigateur. Encore mieux : l'app sur l'écran d'accueil (l'étape suivante)."
        : "Ouvre Pandi depuis son icône sur l'écran d'accueil (l'étape suivante) et tourne le téléphone : la télé est remplie, sans les barres du navigateur."}</p>
    <p class="hint">Pas de télé ? Pandi marche aussi sur une tablette ou sur le téléphone seul.</p>
    <${Actions} back=${() => go('parent')} next=${() => go('app')} />`;
}

// Le personnage de chaque enfant : la photo magique (façon film d'animation 3D), ou le composer soi-même,
// ou plus tard (le coin de l'enfant → Mon look)
function StepPerso({ kids }) {
  const [photoFor, setPhotoFor] = useState(null);
  const [lookFor, setLookFor] = useState(null);
  const [touched, setTouched] = useState([]); // les enfants dont le personnage a été réglé ici
  const touch = (id) => setTouched((t) => (t.includes(id) ? t : [...t, id]));
  const photoKid = kids.find((k) => k.id === photoFor);
  const lookKid = kids.find((k) => k.id === lookFor);
  const done = touched.length > 0 || kids.some((k) => k.look?.portrait);
  return html`
    <h1>${kids.length > 1 ? 'Le personnage de chaque enfant' : `Le personnage de ${kids[0]?.name || "l'enfant"}`}</h1>
    <p class="ac-text">📸 <b>La photo magique</b> : à partir d'une photo, Pandi crée un personnage façon film d'animation 3D qui ressemble à l'enfant (environ 2 minutes). La photo n'est jamais gardée.</p>
    <div class="row-list">${kids.map((k) => html`<div key=${k.id} class="row ac-perso" style=${{ '--kid': k.color }}>
      <span class="ac-head"><${Avatar} look=${k.look} equipped=${k.equipped} expr="happy" mode="head" seed=${k.id} /></span>
      <div class="grow"><div class="title">${k.name}</div><div class="meta">${k.look?.portrait ? 'Personnage 3D prêt ✨' : touched.includes(k.id) ? 'Personnage réglé ✓' : 'Personnage dessiné, pas encore réglé'}</div></div>
      <div class="ac-perso-btns">
        <button class="btn btn-pink btn-small" onClick=${() => { sfx.tap(); setPhotoFor(k.id); }}>📸 ${k.look?.portrait ? 'Refaire' : 'Photo magique'}</button>
        <button class="p-btn" onClick=${() => { sfx.tap(); setLookFor(k.id); }}>🎨 Composer</button>
      </div>
    </div>`)}</div>
    <p class="hint">🎨 <b>L'autre façon</b> : composer son personnage soi-même (coiffure, couleur de peau, yeux, lunettes, taches de rousseur…), sans photo. Pas le temps maintenant ? Tout se fait aussi plus tard : touche la tête de l'enfant sur l'écran de la soirée, puis 🪞 Mon look.</p>
    <${Actions} back=${() => go('code')} skip=${done ? null : () => go('notes')} skipLabel="Plus tard" next=${done ? () => go('notes') : null} />
    ${photoKid && html`<${PhotoAvatar} child=${photoKid} onClose=${() => { touch(photoKid.id); setPhotoFor(null); }} onEdit=${() => setLookFor(photoKid.id)} />`}
    ${lookKid && html`<${Modal} onClose=${() => setLookFor(null)} style=${{ '--kid': lookKid.color, width: 'min(100%, calc(var(--u) * 130))' }}>
      <h2>Le personnage de ${lookKid.name}</h2>
      <div class="ac-look">
        <div class="ac-look-preview"><${Avatar} look=${lookKid.look} equipped=${lookKid.equipped} expr="happy" mode="full" seed=${lookKid.id} /></div>
        <div class="ac-look-editor"><${LookEditor} look=${lookKid.look} onChange=${(look) => { actions.saveLook(lookKid.id, look); touch(lookKid.id); }} onPhoto=${() => { setLookFor(null); setPhotoFor(lookKid.id); }} /></div>
      </div>
      <div class="sheet-actions"><button class="btn btn-green" onClick=${() => { sfx.tap(); setLookFor(null); }}>C'est bon</button></div>
    <//>`}`;
}

function StepApp() {
  const state = useInstallState();
  const done = state === 'app' || state === 'done';
  // Sur iPhone et sur Android sans bouton, on ne sait pas si c'est fait : « C'est fait » et « Plus tard » mènent à la fin
  const guided = state === 'ios' || state === 'android';
  return html`
    <h1>Pandi sur l'écran d'accueil</h1>
    <p class="ac-text">Avec son icône, Pandi s'ouvre comme une vraie app : d'un geste, en plein écran, sans les barres du navigateur. C'est le mieux pour la télé.</p>
    <${InstallHelp} state=${state} />
    <${Actions} back=${() => go('tele')} skip=${done || state === 'computer' ? null : () => go('pret')} skipLabel="Plus tard"
      next=${done || guided || state === 'computer' ? () => go('pret') : null} nextLabel=${guided ? "C'est fait" : 'Continuer'} />`;
}

function StepPret({ s, kids }) {
  const installed = ['app', 'done'].includes(useInstallState());
  const portraits = kids.filter((k) => k.look?.portrait).length;
  const count = (routine) => s.tasks.filter((t) => t.active !== false && routineOf(t) === routine).length;
  const evening = count('soir');
  const morning = count('matin');
  const t = s.settings.treasure;
  const finish = () => {
    sfx.fanfare();
    actions.accueilStep(null);
    actions.startDecouverte();
    navigate('soiree', { replace: true });
  };
  return html`
    <h1>C'est prêt !</h1>
    <div class="row-list ac-summary">
      <div class="row"><span class="emoji">👧</span><div class="grow"><div class="title">${names(kids)}</div><div class="meta">${portraits === kids.length
        ? `${kids.length > 1 ? 'Leurs personnages 3D sont prêts' : 'Son personnage 3D est prêt'} ✨`
        : 'Le personnage de chacun se règle dans son coin (touche sa tête) → 🪞 Mon look : photo magique ou à composer'}</div></div></div>
      <div class="row"><span class="emoji">🌙</span><div class="grow"><div class="title">${evening} tâche${evening > 1 ? 's' : ''} le soir</div>
        <div class="meta">${morning ? `☀️ ${morning} le matin${s.settings.departure ? `, départ à ${s.settings.departure.replace(/^0/, '').replace(':', ' h ')}` : ''}` : 'Pas de routine du matin'}</div></div></div>
      <div class="row"><span class="emoji">🔐</span><div class="grow"><div class="title">${s.settings.pinHash ? 'Code parent choisi' : 'Pas encore de code parent'}</div>
        <div class="meta">${s.settings.pinHash ? 'Pour noter et changer les réglages' : 'Il sera demandé à la première note'}</div></div></div>
      <div class="row"><span class="emoji">🧰</span><div class="grow"><div class="title">${t.reward}</div><div class="meta">Au bout du coffre de l'équipe : ${t.goal} pierres</div></div></div>
      <div class="row"><span class="emoji">📲</span><div class="grow"><div class="title">${installed ? "Pandi est sur l'écran d'accueil" : "L'écran d'accueil : pas encore"}</div>
        <div class="meta">${installed ? "Il s'ouvre d'un geste, en plein écran" : "Plus tard : ⚙️ Espace parent → Réglages → « L'app sur l'écran d'accueil »"}</div></div></div>
    </div>
    <p class="ac-text"><b>Ce soir</b> : ouvre Pandi au début de la routine et mets-le sur la télé. Touche la carte d'une tâche pour la noter. Tout se change ensuite dans ⚙️ Espace parent.</p>
    <${Actions} back=${() => go('app')} next=${finish} nextLabel="Commencer 🎉" />`;
}
