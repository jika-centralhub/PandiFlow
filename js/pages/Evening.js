// Écran de la routine (matin ou soir) : celui qui est projeté sur la télé.
// Chaque enfant a sa colonne avec un carrousel de ses tâches, dans l'ordre de la routine.
// La télé ne compare pas les enfants : une tâche notée devient « faite » (dorée), sans couleur ni chiffre ;
// la note de coopération (🌟 👍 ✋ ⏸️) se voit dans le coin de l'enfant et dans l'historique des parents.
import { html, useEffect, useRef, useState } from '../vendor/preact-htm.js';
import { useStore, setPrefs, getState, visitPending } from '../lib/store.js';
import * as actions from '../lib/actions.js';
import * as timers from '../lib/timers.js';
import { timerKey } from '../lib/countdown.js';
import { activeChildren, tasksForChild, routineProgress, findRating, pointsFor, COLOR_META, TEAM_CARD, findTeamCard, teamCardLevel, pendingSurprise, promiseFor, firstEveningDue } from '../domain.js';
import { routineDate, currentRoutine, addDays, formatLong, eveningDate } from '../lib/dates.js';
import { Avatar } from '../avatar/Avatar.js';
import { Modal, Logo } from '../components/ui.js';
import { Pandi } from '../components/Coin.js';
import { Pandi3D, has3D } from '../components/Pandi3D.js';
import { pandiFor, storyIndex } from '../mascot/tasks.js';
import { showOverlay, GiftBox } from '../components/Overlays.js';
import { TimerRing, TimerPicker, TimerStage, TimerResult, timerView, useClock } from '../components/Timer.js';
import { DepartureBar } from '../components/Departure.js';
import { CalmCorner } from '../components/CalmCorner.js';
import { TeamPill, TeamSheet } from '../components/Team.js';
import { Visite, GreetBar, FirstEveningCard } from '../components/Decouverte.js';
import { flyCoins, burst, replay } from '../anim/fx.js';
import { sfx, setSoftSound } from '../lib/sounds.js';
import { navigate } from '../router.js';
import { keepScreenOn, releaseScreen, toggleFullscreen, isFullscreen } from '../lib/device.js';

// Matin ou soir : la routine change toute seule (à 4 h et à 13 h), on n'affiche que celle du moment
export function TopBar({ onCalm, chest = null }) {
  const s = useStore();
  const [fs, setFs] = useState(isFullscreen());
  return html`<header class="topbar">
    <div class="brand"><${Logo} /> <span>Pandi</span></div>
    ${s.mode === 'demo' && html`<span class="mode-badge">Démo</span>`}
    ${s.mode === 'cloud' && html`<span class=${`sync-dot ${s.pendingOps ? 'busy' : ''}`} title=${s.pendingOps ? 'Synchronisation…' : 'Synchronisé'} />`}
    <div class="spacer" />
    ${chest}
    <div class="spacer" />
    <button class="icon-btn calm-btn" aria-label="Coin calme : apaiser une émotion" title="Coin calme" onClick=${() => { sfx.sparkle(); onCalm(); }}>🌈</button>
    <button class="icon-btn" aria-label=${s.prefs.sound ? 'Couper le son' : 'Activer le son'} onClick=${() => setPrefs({ sound: !s.prefs.sound })}>${s.prefs.sound ? '🔊' : '🔇'}</button>
    <button class="icon-btn fs-btn" aria-label="Plein écran" onClick=${async () => setFs(await toggleFullscreen())}>${fs ? '🗗' : '⛶'}</button>
    <button class="icon-btn" aria-label="Espace parent" onClick=${() => navigate('parent')}>⚙️</button>
  </header>`;
}

// Ce que la télé garde d'une note : « fait » (doré) ou « pas ce soir », jamais la couleur
const doneClass = (r) => (!r ? '' : r.color === 'pause' ? 'pause' : 'done');

// Une carte du carrousel. d = écart avec la carte du centre (0 = au centre, -1 à gauche, 1 à droite…)
// Sur la carte du milieu, Pandi fait la tâche avec l'enfant (ou réagit à la note)
function CardPandi({ task, rating, view, color, active, night }) {
  const prev = useRef(rating);
  const [voice, setVoice] = useState(false);
  useEffect(() => {
    if (rating && rating !== prev.current) setVoice(true);
    prev.current = rating;
  }, [rating]);
  const { act, ctx } = pandiFor(task, { rating, timer: view, night });
  return html`<div class="cr-pandi"><${Pandi3D} act=${act} ctx=${{ ...ctx, color }} framing="auto" fps=${30} sound=${voice} active=${active} brushColor=${color} /></div>`;
}

function TaskCard({ task, index, total, d, rating, timer, canTime, cardRef, onClick, onTimer, color, pandiActive, night }) {
  const ad = Math.abs(d);
  const withPandi = d === 0 && has3D();
  const now = useClock(Boolean(timer));
  const v = timer ? timerView(timer, now) : null;
  const over = v?.phase === 'over';
  const cls = ['cr-card', doneClass(rating), d === 0 ? 'center' : '', v ? `timing t-${v.look}` : '', ad > 2 ? 'far' : ''].filter(Boolean).join(' ');
  const status = rating ? (rating.color === 'pause' ? ' : pas ce soir' : ' : fait') : v ? ` : minuteur ${v.clock}` : '';
  return html`<div
    class=${cls}
    role="button"
    tabIndex=${d === 0 ? 0 : -1}
    aria-label=${`${task.title}${status}`}
    style=${{ '--d': d, '--ad': Math.min(ad, 3), zIndex: 10 - ad, '--left': v ? 1 - v.progress : 1 }}
    ref=${cardRef}
    onClick=${onClick}
    onKeyDown=${(e) => (e.key === 'Enter' || e.key === ' ') && onClick(e)}
  >
    <span class="cr-step">${index + 1} / ${total}</span>
    <div class=${`cr-emoji-wrap ${withPandi ? 'has-pandi' : ''}`}>
      ${v && html`<${TimerRing} progress=${v.progress} />`}
      ${withPandi
        ? html`<${CardPandi} task=${task} rating=${rating?.color} view=${v} color=${color} active=${pandiActive} night=${night} />
          <span class="cr-badge">${over ? '🔔' : task.emoji}</span>`
        : html`<span class="cr-emoji">${over ? '🔔' : task.emoji}</span>`}
    </div>
    <div class="cr-title">${task.title}</div>
    ${v
      ? html`<div class="cr-clock">${v.look === 'paused' ? '⏸ ' : ''}${over ? 'On finit 🙂' : v.clock}</div>`
      : rating
        ? html`<div class="cr-status">${rating.color === 'pause' ? 'Pas ce soir' : 'Fait ✓'}</div>`
        : d === 0 && html`<div class="cr-hint">Touche la carte pour noter</div>`}
    ${canTime && !rating && !timer && d === 0 && html`<button class="cr-timer-btn" onClick=${(e) => { e.stopPropagation(); onTimer(); }}>⏱️ Minuteur</button>`}
    ${rating && html`<span class="tile-badge" key=${doneClass(rating)}>${rating.color === 'pause' ? '⏸️' : '✓'}</span>`}
  </div>`;
}

// Dernière carte de la soirée : l'enfant touche « Bonne nuit Pandi » quand toutes ses tâches sont notées
const NIGHT_CARD = '__bonnenuit';

function NightCard({ child, index, total, d, ready, asleep, cardRef, onClick, pandiActive }) {
  const ad = Math.abs(d);
  const withPandi = d === 0 && has3D();
  const cls = ['cr-card', 'night', ready ? '' : 'locked', asleep ? 'asleep' : '', d === 0 ? 'center' : '', ad > 2 ? 'far' : ''].filter(Boolean).join(' ');
  return html`<div class=${cls} role="button" tabIndex=${d === 0 ? 0 : -1} aria-label=${asleep ? `Pandi dort. Bonne nuit ${child.name} !` : 'Bonne nuit Pandi'}
    style=${{ '--d': d, '--ad': Math.min(ad, 3), zIndex: 10 - ad }} ref=${cardRef} onClick=${onClick}
    onKeyDown=${(e) => (e.key === 'Enter' || e.key === ' ') && onClick(e)}>
    <span class="cr-step">${index + 1} / ${total}</span>
    <div class=${`cr-emoji-wrap ${withPandi ? 'has-pandi' : ''}`}>
      ${withPandi
        ? html`<div class="cr-pandi"><${Pandi3D} act="endormi" framing="auto" fps=${20} active=${pandiActive} brushColor=${child.color} /></div><span class="cr-badge">🌙</span>`
        : html`<span class="cr-emoji">${asleep ? '😴' : '🌙'}</span>`}
    </div>
    <div class="cr-title">${asleep ? `Bonne nuit ${child.name} !` : 'Bonne nuit Pandi'}</div>
    ${d === 0 && html`<div class="cr-hint">${asleep ? 'Pandi dort… chut !' : ready ? 'Touche pour dire bonne nuit' : 'Après toutes les tâches'}</div>`}
  </div>`;
}

// Le carrousel d'un enfant : la tâche du moment au centre, les voisines inclinées sur les côtés.
// On balaie, on touche une carte voisine, une flèche ou une pastille pour se déplacer.
function Carousel({ child, list, routine, date, focus, onFocus, canTime, timerFor, cards, onOpen, onTimer, night, onNight, paused, doux }) {
  const s = useStore();
  const start = useRef(null);
  const swiped = useRef(false);
  const dots = useRef(null);

  // La pastille de la tâche du centre reste visible dans la frise
  useEffect(() => {
    const dot = dots.current?.children[focus];
    if (dot && dots.current.scrollWidth > dots.current.clientWidth) {
      dots.current.scrollTo({ left: dot.offsetLeft - dots.current.clientWidth / 2 + dot.offsetWidth / 2, behavior: 'smooth' });
    }
  }, [focus, list.length]);
  const ids = [...list.map((t) => t.id), ...(night ? [NIGHT_CARD] : [])];
  const total = ids.length;
  const go = (i) => {
    const j = Math.max(0, Math.min(total - 1, i));
    if (j === focus) return;
    sfx.slide();
    onFocus(ids[j]);
  };
  function down(e) {
    start.current = { x: e.clientX, y: e.clientY };
  }
  function up(e) {
    const st = start.current;
    start.current = null;
    if (!st) return;
    const dx = e.clientX - st.x;
    if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(e.clientY - st.y)) {
      swiped.current = true;
      setTimeout(() => (swiped.current = false), 80);
      go(focus + (dx < 0 ? 1 : -1));
    }
  }
  if (!list.length) return html`<div class="empty-col">Pas de tâche ${routine === 'matin' ? 'ce matin' : 'ce soir'} 🎉</div>`;
  return html`<div class="carousel">
    <div class="cr-stage" onPointerDown=${down} onPointerUp=${up} onPointerCancel=${() => (start.current = null)}>
      ${list.map((task, i) => {
        const key = `${child.id}:${task.id}`;
        return html`<${TaskCard}
          key=${task.id}
          task=${task}
          index=${i}
          total=${total}
          d=${i - focus}
          rating=${findRating(s.ratings, child.id, task.id, date)}
          timer=${timerFor(child.id, task.id)}
          canTime=${canTime}
          color=${child.color}
          pandiActive=${!paused}
          night=${doux}
          cardRef=${(n) => (cards.current[key] = n)}
          onTimer=${() => onTimer(task)}
          onClick=${() => {
            if (swiped.current) return;
            if (i !== focus) return go(i);
            onOpen(task);
          }}
        />`;
      })}
      ${night && html`<${NightCard}
        key=${NIGHT_CARD}
        child=${child}
        index=${list.length}
        total=${total}
        d=${list.length - focus}
        ready=${night.ready}
        asleep=${night.asleep}
        pandiActive=${!paused}
        cardRef=${(n) => (cards.current[`${child.id}:${NIGHT_CARD}`] = n)}
        onClick=${() => {
          if (swiped.current) return;
          if (list.length !== focus) return go(list.length);
          onNight();
        }}
      />`}
      <button class="cr-arrow prev" aria-label="Tâche précédente" disabled=${focus <= 0} onClick=${() => go(focus - 1)}>‹</button>
      <button class="cr-arrow next" aria-label="Tâche suivante" disabled=${focus >= total - 1} onClick=${() => go(focus + 1)}>›</button>
    </div>
    <div class="cr-dots" ref=${dots} role="tablist" aria-label=${`Tâches de ${child.name}`}>
      ${list.map((task, i) => {
        const r = findRating(s.ratings, child.id, task.id, date);
        const t = timerFor(child.id, task.id);
        return html`<button key=${task.id} role="tab" aria-selected=${i === focus} aria-label=${task.title} style=${{ '--i': i }}
          class=${`cr-dot ${doneClass(r)} ${i === focus ? 'on' : ''} ${t ? 'timing' : ''}`} onClick=${() => go(i)}>
          <span class="cr-dot-ico">${task.emoji}</span>${(r || t) && html`<i class="cr-dot-spark" />`}
        </button>`;
      })}
      ${night && html`<button key=${NIGHT_CARD} role="tab" aria-selected=${focus === list.length} aria-label="Bonne nuit Pandi" style=${{ '--i': list.length }}
        class=${`cr-dot ${night.asleep ? 'gold' : ''} ${focus === list.length ? 'on' : ''}`} onClick=${() => go(list.length)}>
        <span class="cr-dot-ico">🌙</span>${night.asleep && html`<i class="cr-dot-spark" />`}
      </button>`}
    </div>
  </div>`;
}

// La feuille de notation (elle passe sur la télé) : la coopération, sans prix
const RATE_ORDER = ['green', 'orange', 'red', 'pause'];
const PREVIEW = { green: 'joy', orange: 'encourage', red: 'encourage', pause: 'happy' };

function RatingSheet({ child, task, current, timerResult, onPick, onClose }) {
  const [expr, setExpr] = useState('happy');
  // L'enfant est la première tuile de la rangée, à la même hauteur que les quatre notes
  return html`<${Modal} onClose=${onClose} class="rate-sheet coop" style=${{ '--kid': child.color }}>
    <div>
      <div class="rate-title"><span class="big-emoji">${task.emoji}</span> ${task.title}</div>
      <${TimerResult} result=${timerResult} />
      <div class="rate-choices five">
        <div class="rate-avatar" aria-label=${child.name}>
          <${Avatar} look=${child.look} equipped=${child.equipped} expr=${expr} mode="full" seed=${child.id} pose=${expr === 'joy' ? 'cheer' : 'idle'} />
        </div>
        ${RATE_ORDER.map((c) => html`<button
          key=${c}
          class=${`rate-choice ${c} ${current === c ? 'current' : ''}`}
          onPointerEnter=${() => setExpr(PREVIEW[c])}
          onPointerLeave=${() => setExpr('happy')}
          onClick=${() => onPick(c)}
        >
          <span class="face">${COLOR_META[c].face}</span>
          ${COLOR_META[c].label}
          <span class="sub">${COLOR_META[c].sub}</span>
        </button>`)}
      </div>
      ${current && html`<button class="rate-clear" onClick=${() => onPick(null)}>Effacer la note</button>`}
    </div>
  <//>`;
}

// Carte d'équipe de fin de soirée : la même pour toute la fratrie, elle ne peut qu'ajouter
function TeamCardBar({ level, ready, onOpen }) {
  if (level) {
    return html`<button class=${`teamcard-bar ${level}`} onClick=${onOpen} aria-label=${`Carte d'équipe : ${TEAM_CARD[level].label}`}>
      <span class="tcb-ico">${TEAM_CARD[level].face}</span>${TEAM_CARD[level].label}
    </button>`;
  }
  if (!ready) return null;
  return html`<button class="teamcard-bar ask" onClick=${onOpen}><span class="tcb-ico">🤝</span>Carte d'équipe : comment s'est passée la soirée ensemble ?</button>`;
}

function TeamCardSheet({ kids, current, onPick, onClose }) {
  return html`<${Modal} onClose=${onClose} class="rate-sheet teamcard-sheet">
    <div>
      <div class="rate-title"><span class="big-emoji">🤝</span> La soirée de l'équipe</div>
      <p class="rate-sub">${kids.map((k) => k.name).join(', ').replace(/, ([^,]*)$/, ' et $1')}, ensemble ce soir :</p>
      <div class="rate-choices two">
        <button class=${`rate-choice top ${current === 'top' ? 'current' : ''}`} onClick=${() => onPick('top')}>
          <span class="face">${TEAM_CARD.top.face}</span>${TEAM_CARD.top.label}<span class="sub">Un trésor pour la cagnotte commune</span>
        </button>
        <button class=${`rate-choice demain ${current === 'demain' ? 'current' : ''}`} onClick=${() => onPick('demain')}>
          <span class="face">${TEAM_CARD.demain.face}</span>${TEAM_CARD.demain.label}<span class="sub">Rien de perdu, demain on réessaie</span>
        </button>
      </div>
      ${current && html`<button class="rate-clear" onClick=${() => onPick(null)}>Effacer</button>`}
    </div>
  <//>`;
}

// Tout le monde a dit bonne nuit : la télé s'endort avec Pandi. On touche l'écran pour la réveiller.
function NightScreen({ kids, onWake, mot = null, onMotClose }) {
  useEffect(() => {
    releaseScreen();
    return () => keepScreenOn();
  }, []);
  const names = kids.map((k) => k.name).join(', ').replace(/, ([^,]*)$/, ' et $1');
  return html`<div class="night-screen" role="dialog" aria-label="Bonne nuit" onClick=${onWake}>
    <div class="ns-stars" aria-hidden="true">${Array.from({ length: 28 }, (_, i) => html`<i key=${i} style=${{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 70}%`, animationDelay: `${(i % 7) * 0.6}s` }} />`)}</div>
    <div class="ns-pandi">${has3D() ? html`<${Pandi3D} act="endormi" framing="auto" base="full" fps=${12} />` : html`<${Pandi} mood="happy" wave=${false} />`}</div>
    <div class="ns-text">Bonne nuit ${names} 🌙</div>
    <div class="ns-hint">Touche l'écran pour réveiller Pandi</div>
    ${mot && html`<div class="ns-mot" onClick=${(e) => { e.stopPropagation(); onMotClose(); }}><${FirstEveningCard} date=${mot} onClose=${onMotClose} /></div>`}
  </div>`;
}

// Routine choisie à la main : on la garde en revenant de l'espace parent ou du coin d'un enfant,
// jusqu'au prochain changement automatique (13 h ou 4 h).
let manualRoutine = null; // { routine, auto }
const startRoutine = () => (manualRoutine && manualRoutine.auto === currentRoutine() ? manualRoutine.routine : currentRoutine());

// Les enfants qui ont dit bonne nuit, par soirée (gardé si on passe par l'espace parent)
const asleepByDate = {};

// « Plus tard » sur le bonjour de Pandi : on le repropose au prochain lancement de l'app
let greetLater = false;

// Prochaine tâche sans note après celle du centre (on boucle au début si besoin)
function nextOpen(list, from, isRated) {
  for (let k = 1; k <= list.length; k++) {
    const i = (from + k) % list.length;
    if (!isRated(list[i])) return i;
  }
  return -1;
}

export function Evening() {
  const s = useStore();
  const [routine, setRoutineState] = useState(startRoutine);
  const [date, setDate] = useState(() => routineDate(startRoutine()));
  const [focus, setFocus] = useState({}); // childId -> taskId au centre du carrousel
  const [open, setOpen] = useState(null); // { childId, taskId, timerResult?, timerKey? }
  const [picker, setPicker] = useState(null); // { childId, taskId }
  const [stageKey, setStageKey] = useState(null);
  const [calm, setCalm] = useState(false);
  const [team, setTeam] = useState(false);
  const [teamCardOpen, setTeamCardOpen] = useState(false);
  const [asleep, setAsleep] = useState(() => asleepByDate[date] || []);
  const [nightScreen, setNightScreen] = useState(false);
  const [moods, setMoods] = useState({});
  const [firstMot, setFirstMot] = useState(null); // la soirée dont le mot de première soirée est montré la nuit
  const [later, setLater] = useState(greetLater);
  const [, setTick] = useState(0); // redessine chaque minute : un paquet de Pandi arrive à son heure
  const cards = useRef({});
  const heads = useRef({});
  const moodTimers = useRef({});
  const lastAuto = useRef(currentRoutine());
  const routineRef = useRef(routine);
  routineRef.current = routine;

  function setRoutine(r, manual = true) {
    manualRoutine = manual ? { routine: r, auto: currentRoutine() } : null;
    setRoutineState(r);
    setDate(routineDate(r));
    setFocus({});
  }

  useEffect(() => {
    keepScreenOn();
  }, []);

  // Ciel du matin (lever de soleil) ou du soir (étoiles)
  useEffect(() => {
    document.getElementById('sky')?.classList.toggle('morning', routine === 'matin');
  }, [routine]);

  // Passage automatique matin <-> soir à 13 h et à 4 h, et suivi de la date (minuit passé…)
  useEffect(() => {
    const t = setInterval(() => {
      setTick((n) => n + 1);
      const auto = currentRoutine();
      if (auto !== lastAuto.current) {
        lastAuto.current = auto;
        setRoutine(auto, false);
        return;
      }
      const today = routineDate(routineRef.current);
      setDate((d) => (d === addDays(today, -1) || d === today ? d : today));
    }, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setFocus({});
    setAsleep(asleepByDate[date] || []);
    setNightScreen(false);
  }, [date]);

  const kids = activeChildren(s.children);
  const today = routineDate(routine);
  const canTime = date === today;
  const timerFor = (childId, taskId) => s.timers.find((t) => t.key === timerKey(childId, taskId) && t.date === date && !t.finished) || null;
  const evening = routine === 'soir';
  const progress = Object.fromEntries(kids.map((k) => [k.id, routineProgress(k.id, date, s, routine)]));
  const withTasks = kids.filter((k) => progress[k.id].total > 0);
  const allDone = withTasks.length > 0 && withTasks.every((k) => progress[k.id].complete);

  // Soirée douce : dès qu'un enfant arrive à l'histoire du soir, tout l'écran se calme
  // (ciel plus sombre, son plus bas, plus de fanfare ni de feu d'artifice)
  const isRated = (child, t) => Boolean(findRating(s.ratings, child.id, t.id, date));
  const doux = evening && withTasks.some((k) => {
    const list = tasksForChild(k.id, date, s, routine);
    return list.slice(0, storyIndex(list)).every((t) => isRated(k, t));
  });
  useEffect(() => {
    document.getElementById('sky')?.classList.toggle('doux', doux);
    setSoftSound(doux);
    return () => {
      document.getElementById('sky')?.classList.remove('doux');
      setSoftSound(false);
    };
  }, [doux]);

  // Une tâche notée (ici ou par l'autre parent) n'a plus besoin de son minuteur
  useEffect(() => {
    for (const t of s.timers) if (!t.finished && findRating(s.ratings, t.childId, t.taskId, t.date)) timers.removeTimer(t.key);
  }, [s.ratings, s.timers]);

  const stageTimer = stageKey && s.timers.find((t) => t.key === stageKey);
  useEffect(() => {
    if (stageKey && !stageTimer) setStageKey(null);
  }, [stageKey, stageTimer]);

  // Tous les enfants ont dit bonne nuit : la télé s'endort quelques secondes après
  useEffect(() => {
    if (!evening || !withTasks.length || !withTasks.every((k) => asleep.includes(k.id))) return;
    const t = setTimeout(() => setNightScreen(true), 3500);
    return () => clearTimeout(t);
  }, [asleep.join(','), evening, withTasks.length]);

  // Le mot de la première soirée : sur l'écran de la nuit, ou à l'ouverture suivante (soirée finie sans
  // « bonne nuit », vue ce soir ou hier soir). Il n'est montré qu'une fois pour la famille.
  useEffect(() => {
    if (!nightScreen || !evening || !firstEveningDue(getState(), date)) return;
    setFirstMot(date);
    actions.markFirstEvening(date);
  }, [nightScreen]);
  useEffect(() => {
    const tonight = eveningDate();
    const due = [tonight, addDays(tonight, -1)].find((d) => firstEveningDue(getState(), d));
    if (!due) return;
    actions.markFirstEvening(due);
    showOverlay('premiere', { date: due });
  }, []);

  function greet() {
    sfx.tap();
    actions.markGreeted();
    showOverlay('bonjour', {});
  }

  function focusIndex(child, list, withNight) {
    if (withNight && focus[child.id] === NIGHT_CARD) return list.length;
    const i = list.findIndex((t) => t.id === focus[child.id]);
    if (i >= 0) return i;
    const first = list.findIndex((t) => !findRating(s.ratings, child.id, t.id, date));
    if (first >= 0) return first;
    if (withNight) return list.length;
    return Math.max(0, list.length - 1);
  }

  function sayGoodNight(child) {
    if (!progress[child.id]?.complete) {
      sfx.tap();
      replay(cards.current[`${child.id}:${NIGHT_CARD}`], 'wobble', 600);
      return;
    }
    if (asleep.includes(child.id)) return;
    sfx.bonneNuit();
    burst(cards.current[`${child.id}:${NIGHT_CARD}`], { count: 8, chars: ['⭐', '✨', '🌙'], spread: 100, duration: 1.4 });
    const next = [...asleep, child.id];
    asleepByDate[date] = next;
    setAsleep(next);
  }

  // L'enfant ouvre le paquet de Pandi : c'est noté tout de suite (la carte devient une promesse à tenir)
  async function openGift(child, gift) {
    sfx.tap();
    actions.openSurprise(gift.surprise.id, child.id);
    await showOverlay('surprise', { childId: child.id, card: gift.card, team: Boolean(gift.surprise.team), soft: doux });
  }

  function wake() {
    sfx.tap();
    asleepByDate[date] = [];
    setAsleep([]);
    setNightScreen(false);
  }

  async function pickTeamCard(level) {
    setTeamCardOpen(false);
    const before = teamCardLevel(findTeamCard(s.ledger, date));
    actions.setTeamCard(date, level);
    if (!level) return sfx.pop();
    if (level === 'top' && before !== 'top') {
      await showOverlay('team', { kind: 'teamcard', kids: kids.map((k) => k.id), soft: true });
    } else sfx.pop();
  }

  function setMood(childId, expr, ms) {
    clearTimeout(moodTimers.current[childId]);
    setMoods((m) => ({ ...m, [childId]: expr }));
    moodTimers.current[childId] = setTimeout(() => setMoods((m) => ({ ...m, [childId]: undefined })), ms);
  }

  function closeRating() {
    if (open?.timerKey) timers.removeTimer(open.timerKey);
    setOpen(null);
  }

  function openTask(child, task) {
    sfx.tap();
    const t = timerFor(child.id, task.id);
    if (t) setStageKey(t.key);
    else setOpen({ childId: child.id, taskId: task.id });
  }

  function startTimer(child, task, minutes) {
    setPicker(null);
    setPrefs({ timerLast: { ...s.prefs.timerLast, [task.id]: minutes } });
    timers.startTimer({ childId: child.id, taskId: task.id, date, minutes });
    setTimeout(() => burst(cards.current[`${child.id}:${task.id}`], { count: 12, chars: ['⏱️', '✨', '💨'] }), 60);
  }

  async function pick(child, task, color) {
    closeRating();
    const res = actions.rate(child.id, task.id, date, color);
    if (!color) {
      sfx.pop();
      return;
    }
    const card = cards.current[`${child.id}:${task.id}`];
    const head = heads.current[child.id];
    const points = pointsFor(color, s.settings, child);

    // Le positif se voit, le négatif se dit (par le parent, pas par l'écran)
    if (color === 'green') {
      sfx.green();
      replay(card, 'pop', 700);
      burst(card, { count: doux ? 6 : 14 });
      replay(head?.querySelector('.avatar'), 'av-jump', 900);
      setMood(child.id, 'joy', 2800);
    } else if (color === 'orange') {
      sfx.orange();
      replay(card, 'pop', 700);
      burst(card, { count: 5, chars: ['👍', '✨'], spread: 90 });
      setMood(child.id, 'happy', 2200);
    } else if (color === 'red') {
      sfx.pop();
      setMood(child.id, 'encourage', 1800);
    } else {
      sfx.pause();
    }

    // La carte suivante glisse au centre pendant que les pièces volent
    setTimeout(() => {
      const st = getState();
      const list = tasksForChild(child.id, date, st, routine);
      const from = list.findIndex((t) => t.id === task.id);
      const after = list.slice(from + 1).find((t) => !findRating(st.ratings, child.id, t.id, date));
      const next = nextOpen(list, from, (t) => findRating(st.ratings, child.id, t.id, date));
      const target = after ? after.id : next >= 0 ? list[next].id : evening ? NIGHT_CARD : null;
      if (target) {
        sfx.slide();
        setFocus((f) => ({ ...f, [child.id]: target }));
      }
    }, 950);

    if (points > 0 && res.delta > 0) await flyCoins(card, head, Math.min(points, res.delta));

    if (res.becameComplete) {
      await showOverlay('celebrate', { childId: child.id, routine, soft: evening });
    }
    for (const c of res.unlocked) {
      await showOverlay('reveal', { childId: child.id, itemId: c.reward_item, challengeTitle: c.title });
    }
    // Toute l'équipe a fini sa routine : « tape là ! »
    const st = getState();
    if (res.becameComplete && kids.length > 1 && kids.every((k) => routineProgress(k.id, date, st, routine).complete)) {
      await showOverlay('team', { kind: 'highfive', kids: kids.map((k) => k.id), soft: evening });
    }
    if (res.palier) await showOverlay('team', { kind: 'palier', kids: res.palier.kids, soft: evening });
    if (res.treasure) await showOverlay('team', { kind: 'treasure', kids: kids.map((k) => k.id), reward: res.treasure, soft: evening });
  }

  const openChild = open && kids.find((k) => k.id === open.childId);
  const openTaskObj = open && s.tasks.find((t) => t.id === open.taskId);
  const openRating = open && findRating(s.ratings, open.childId, open.taskId, date);
  const pickerChild = picker && kids.find((k) => k.id === picker.childId);
  const pickerTask = picker && s.tasks.find((t) => t.id === picker.taskId);
  const stageChild = stageTimer && kids.find((k) => k.id === stageTimer.childId);
  const stageTask = stageTimer && s.tasks.find((t) => t.id === stageTimer.taskId);
  const otherTimers = s.timers
    .filter((t) => t.key !== stageKey && !t.finished && t.date === date)
    .map((t) => ({ timer: t, child: kids.find((k) => k.id === t.childId), task: s.tasks.find((x) => x.id === t.taskId) }))
    .filter((o) => o.child && o.task);
  const teamCard = evening && kids.length > 1 ? teamCardLevel(findTeamCard(s.ledger, date)) : null;
  const visiting = visitPending(s) && kids.length > 0 && !nightScreen;
  const showGreet = Boolean(s.settings.firstDay && !s.settings.greeted) && !visitPending(s) && !later && kids.length > 0 && date === today;

  return html`<div class=${`evening routine-${routine} ${doux ? 'soir-doux' : ''} page-enter`}>
    <${TopBar} onCalm=${() => setCalm(true)} chest=${kids.length > 1 && html`<${TeamPill} onOpen=${() => setTeam(true)} />`} />
    ${date !== today && html`<div class="past-banner">Tu modifies ${routine === 'matin' ? 'le matin' : 'la soirée'} du ${formatLong(date)}</div>`}
    <div class="strip">
      ${showGreet && html`<${GreetBar} onGreet=${greet} onLater=${() => { sfx.tap(); greetLater = true; setLater(true); }} />`}
      ${routine === 'matin' && date === today && html`<${DepartureBar} date=${date} />`}
      ${evening && kids.length > 1 && html`<${TeamCardBar} level=${teamCard} ready=${allDone} onOpen=${() => { sfx.tap(); setTeamCardOpen(true); }} />`}
    </div>
    <div class="columns" style=${{ '--n': Math.max(1, kids.length) }}>
      ${kids.length === 0 && html`<div class="empty-col">Ajoute un enfant dans l'espace parent ⚙️ pour commencer !</div>`}
      ${kids.map((child) => {
        const prog = progress[child.id];
        const list = tasksForChild(child.id, date, s, routine);
        const night = evening && list.length ? { ready: prog.complete, asleep: asleep.includes(child.id) } : null;
        // Surprise de Pandi : le paquet qui attend l'enfant, puis le rappel de la carte jusqu'à ce qu'elle soit tenue
        const gift = date === today && !night?.asleep ? pendingSurprise(s.settings, child.id, Date.now()) : null;
        const promise = !gift && date === today ? promiseFor(s.settings, child.id, Date.now()) : null;
        return html`<section key=${child.id} class=${`kid-col ${prog.complete ? 'done' : ''} ${night?.asleep ? 'asleep' : ''}`} style=${{ '--kid': child.color }}>
          <div class="kid-head">
            <button class="kid-avatar" ref=${(n) => (heads.current[child.id] = n)} onClick=${() => navigate(`enfant/${child.id}`)} aria-label=${`Le coin de ${child.name}`}>
              <${Avatar} look=${child.look} equipped=${child.equipped} expr=${moods[child.id] || 'happy'} mode="head" seed=${child.id} />
            </button>
            <div class="kid-info">
              <span class="kid-name">${child.name}</span>
              ${promise && html`<span class="kid-promise" title=${promise.card.text}><i>${promise.card.emoji}</i><span>${promise.card.text}</span></span>`}
            </div>
            ${gift && html`<button class="kid-gift" onClick=${() => openGift(child, gift)} aria-label=${`Une surprise de Pandi pour ${child.name} : touche pour l'ouvrir`}>
              <span class="kg-box"><${GiftBox} /></span><span class="kg-txt">Une surprise !</span>
            </button>`}
          </div>
          <${Carousel}
            child=${child}
            list=${list}
            routine=${routine}
            date=${date}
            focus=${focusIndex(child, list, Boolean(night))}
            night=${night}
            onNight=${() => sayGoodNight(child)}
            onFocus=${(taskId) => setFocus((f) => ({ ...f, [child.id]: taskId }))}
            canTime=${canTime}
            timerFor=${timerFor}
            cards=${cards}
            onOpen=${(task) => openTask(child, task)}
            onTimer=${(task) => { sfx.tap(); setPicker({ childId: child.id, taskId: task.id }); }}
            paused=${Boolean(stageTimer) || nightScreen}
            doux=${doux}
          />
        </section>`;
      })}
    </div>
    ${pickerChild && pickerTask && html`<${TimerPicker}
      child=${pickerChild}
      task=${pickerTask}
      last=${s.prefs.timerLast?.[pickerTask.id]}
      onPick=${(m) => startTimer(pickerChild, pickerTask, m)}
      onClose=${() => setPicker(null)}
    />`}
    ${stageTimer && stageChild && stageTask && html`<${TimerStage}
      key=${stageTimer.key}
      timer=${stageTimer}
      child=${stageChild}
      task=${stageTask}
      others=${otherTimers}
      onClose=${() => setStageKey(null)}
      onSwitch=${setStageKey}
      onRate=${(result) => {
        setStageKey(null);
        setOpen({ childId: stageChild.id, taskId: stageTask.id, timerResult: result, timerKey: stageTimer.key });
      }}
    />`}
    ${openChild && openTaskObj && html`<${RatingSheet}
      child=${openChild}
      task=${openTaskObj}
      current=${openRating?.color}
      timerResult=${open.timerResult}
      onPick=${(c) => pick(openChild, openTaskObj, c)}
      onClose=${closeRating}
    />`}
    ${calm && html`<${CalmCorner} kids=${kids} onClose=${() => setCalm(false)} />`}
    ${team && html`<${TeamSheet} onClose=${() => setTeam(false)} />`}
    ${teamCardOpen && html`<${TeamCardSheet} kids=${kids} current=${teamCard} onPick=${pickTeamCard} onClose=${() => setTeamCardOpen(false)} />`}
    ${nightScreen && html`<${NightScreen} kids=${withTasks} onWake=${wake} mot=${firstMot} onMotClose=${() => { sfx.tap(); setFirstMot(null); }} />`}
    ${visiting && html`<${Visite} kids=${kids} onDone=${() => actions.endVisit()} />`}
  </div>`;
}
