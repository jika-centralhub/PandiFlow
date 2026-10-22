// Écran de la routine (matin ou soir) : celui qui est projeté sur la télé.
// Chaque enfant a sa colonne avec un carrousel de ses tâches, dans l'ordre de la routine.
import { html, useEffect, useRef, useState } from '../vendor/preact-htm.js';
import { useStore, setPrefs, getState } from '../lib/store.js';
import * as actions from '../lib/actions.js';
import * as timers from '../lib/timers.js';
import { timerKey } from '../lib/countdown.js';
import { activeChildren, tasksForChild, routineProgress, findRating, pointsFor, COLOR_META, BEHAVIOR, findBehavior, behaviorLevel } from '../domain.js';
import { routineDate, currentRoutine, addDays, formatLong } from '../lib/dates.js';
import { Avatar } from '../avatar/Avatar.js';
import { Modal } from '../components/ui.js';
import { Coin } from '../components/Coin.js';
import { Pandi3D, has3D } from '../components/Pandi3D.js';
import { pandiFor } from '../mascot/tasks.js';
import { showOverlay } from '../components/Overlays.js';
import { TimerRing, TimerPicker, TimerStage, TimerResult, timerView, useClock } from '../components/Timer.js';
import { DepartureBar } from '../components/Departure.js';
import { CalmCorner } from '../components/CalmCorner.js';
import { TeamPill, TeamSheet } from '../components/Team.js';
import { flyCoins, burst, floatText, replay } from '../anim/fx.js';
import { sfx } from '../lib/sounds.js';
import { navigate } from '../router.js';
import { keepScreenOn, toggleFullscreen, isFullscreen } from '../lib/device.js';

// Matin ou soir : la routine change toute seule (à 4 h et à 13 h), on n'affiche que celle du moment
export function TopBar({ onCalm, chest = null }) {
  const s = useStore();
  const [fs, setFs] = useState(isFullscreen());
  return html`<header class="topbar">
    <div class="brand"><${Coin} /> <span>Pandi<b>Flow</b></span></div>
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

// Une carte du carrousel. d = écart avec la carte du centre (0 = au centre, -1 à gauche, 1 à droite…)
// Sur la carte du milieu, Pandi fait la tâche avec l'enfant (ou réagit à la note)
function CardPandi({ task, rating, view, color, active }) {
  const prev = useRef(rating);
  const [voice, setVoice] = useState(false);
  useEffect(() => {
    if (rating && rating !== prev.current) setVoice(true);
    prev.current = rating;
  }, [rating]);
  const { act, ctx } = pandiFor(task, { rating, timer: view });
  return html`<div class="cr-pandi"><${Pandi3D} act=${act} ctx=${{ ...ctx, color }} framing="auto" fps=${30} sound=${voice} active=${active} brushColor=${color} /></div>`;
}

function TaskCard({ task, index, total, d, rating, timer, canTime, cardRef, onClick, onTimer, color, pandiActive }) {
  const ad = Math.abs(d);
  const withPandi = d === 0 && has3D();
  const now = useClock(Boolean(timer));
  const v = timer ? timerView(timer, now) : null;
  const cls = ['cr-card', rating?.color || '', d === 0 ? 'center' : '', v ? `timing t-${v.look}` : '', ad > 2 ? 'far' : ''].filter(Boolean).join(' ');
  const status = rating ? ` : ${COLOR_META[rating.color].label}` : v ? ` : minuteur ${v.clock}` : '';
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
        ? html`<${CardPandi} task=${task} rating=${rating?.color} view=${v} color=${color} active=${pandiActive} />
          <span class="cr-badge">${v?.phase === 'over' ? '⏰' : task.emoji}</span>`
        : html`<span class="cr-emoji">${v?.phase === 'over' ? '⏰' : task.emoji}</span>`}
    </div>
    <div class="cr-title">${task.title}</div>
    ${v
      ? html`<div class="cr-clock" key=${v.phase === 'final' ? v.second : 'c'}>${v.look === 'paused' ? '⏸ ' : ''}${v.clock}</div>`
      : rating
        ? html`<div class="cr-status">${COLOR_META[rating.color].label}</div>`
        : d === 0 && html`<div class="cr-hint">Touche la carte pour noter</div>`}
    ${canTime && !rating && !timer && d === 0 && html`<button class="cr-timer-btn" onClick=${(e) => { e.stopPropagation(); onTimer(); }}>⏱️ Minuteur</button>`}
    ${rating && html`<span class="tile-badge" key=${rating.color}>${COLOR_META[rating.color].face}</span>`}
  </div>`;
}

// Dernière carte de la soirée : le comportement (😇 +5, 🙂 +2, 😕 0)
const BEHAVIOR_CARD = '__comportement';
const BEHAVIOR_CLASS = { super: 'gold', bien: 'green', non: 'red' };

function BehaviorCard({ index, total, d, level, points, cardRef, onClick }) {
  const ad = Math.abs(d);
  const cls = ['cr-card', 'behavior', level ? BEHAVIOR_CLASS[level] : '', d === 0 ? 'center' : '', ad > 2 ? 'far' : ''].filter(Boolean).join(' ');
  return html`<div class=${cls} role="button" tabIndex=${d === 0 ? 0 : -1} aria-label=${`Comportement${level ? ` : ${BEHAVIOR[level].label}` : ''}`}
    style=${{ '--d': d, '--ad': Math.min(ad, 3), zIndex: 10 - ad }} ref=${cardRef} onClick=${onClick}
    onKeyDown=${(e) => (e.key === 'Enter' || e.key === ' ') && onClick(e)}>
    <span class="cr-step">${index + 1} / ${total}</span>
    <div class="cr-emoji-wrap"><span class="cr-emoji">${level ? BEHAVIOR[level].face : '😇'}</span></div>
    <div class="cr-title">Comportement</div>
    ${level
      ? html`<div class="cr-status">${BEHAVIOR[level].label}${points ? ` · +${points}` : ''}</div>`
      : d === 0 && html`<div class="cr-hint">Comment s'est passée la soirée ?</div>`}
    ${level && html`<span class="tile-badge" key=${level}>${BEHAVIOR[level].face}</span>`}
  </div>`;
}

function BehaviorSheet({ child, current, settings, onPick, onClose }) {
  const pts = settings.behaviorPoints;
  const choices = [['super', 'gold', pts.super], ['bien', 'green', pts.bien], ['non', 'red', 0]];
  return html`<${Modal} onClose=${onClose} class="rate-sheet" style=${{ '--kid': child.color }}>
    <div class="rate-avatar"><${Avatar} look=${child.look} equipped=${child.equipped} expr="happy" mode="full" seed=${child.id} /></div>
    <div>
      <div class="rate-title"><span class="big-emoji">😇</span> Comportement</div>
      <p class="rate-sub">Comment s'est passée la soirée de ${child.name} ?</p>
      <div class="rate-choices">
        ${choices.map(([level, cls, p]) => html`<button key=${level} class=${`rate-choice ${cls} ${current === level ? 'current' : ''}`} onClick=${() => onPick(level)}>
          <span class="face">${BEHAVIOR[level].face}</span>${BEHAVIOR[level].label}
          <span class="pts">${p > 0 ? `+${p} pandi` : 'On fera mieux demain'}</span>
        </button>`)}
      </div>
      ${current && html`<button class="rate-clear" onClick=${() => onPick(null)}>Effacer</button>`}
    </div>
  <//>`;
}

// Le carrousel d'un enfant : la tâche du moment au centre, les voisines inclinées sur les côtés.
// On balaie, on touche une carte voisine, une flèche ou une pastille pour se déplacer.
function Carousel({ child, list, routine, date, focus, onFocus, canTime, timerFor, cards, onOpen, onTimer, behavior, onBehavior, paused }) {
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
  const ids = [...list.map((t) => t.id), ...(behavior ? [BEHAVIOR_CARD] : [])];
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
          cardRef=${(n) => (cards.current[key] = n)}
          onTimer=${() => onTimer(task)}
          onClick=${() => {
            if (swiped.current) return;
            if (i !== focus) return go(i);
            onOpen(task);
          }}
        />`;
      })}
      ${behavior && html`<${BehaviorCard}
        key=${BEHAVIOR_CARD}
        index=${list.length}
        total=${total}
        d=${list.length - focus}
        level=${behavior.level}
        points=${behavior.points}
        cardRef=${(n) => (cards.current[`${child.id}:${BEHAVIOR_CARD}`] = n)}
        onClick=${() => {
          if (swiped.current) return;
          if (list.length !== focus) return go(list.length);
          onBehavior();
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
          class=${`cr-dot ${r?.color || ''} ${i === focus ? 'on' : ''} ${t ? 'timing' : ''}`} onClick=${() => go(i)}>
          <span class="cr-dot-ico">${task.emoji}</span>${(r || t) && html`<i class="cr-dot-spark" />`}
        </button>`;
      })}
      ${behavior && html`<button key=${BEHAVIOR_CARD} role="tab" aria-selected=${focus === list.length} aria-label="Comportement" style=${{ '--i': list.length }}
        class=${`cr-dot ${behavior.level ? BEHAVIOR_CLASS[behavior.level] : ''} ${focus === list.length ? 'on' : ''}`} onClick=${() => go(list.length)}>
        <span class="cr-dot-ico">${behavior.level ? BEHAVIOR[behavior.level].face : '😇'}</span>${behavior.level && html`<i class="cr-dot-spark" />`}
      </button>`}
    </div>
  </div>`;
}

function RatingSheet({ child, task, current, settings, timerResult, onPick, onClose }) {
  const [expr, setExpr] = useState('happy');
  const preview = { green: 'joy', orange: 'encourage', red: 'focus' };
  return html`<${Modal} onClose=${onClose} class="rate-sheet" style=${{ '--kid': child.color }}>
    <div class="rate-avatar">
      <${Avatar} look=${child.look} equipped=${child.equipped} expr=${expr} mode="full" seed=${child.id} pose=${expr === 'joy' ? 'cheer' : 'idle'} />
    </div>
    <div>
      <div class="rate-title"><span class="big-emoji">${task.emoji}</span> ${task.title}</div>
      <p class="rate-sub">Comment ça s'est passé, ${child.name} ?</p>
      <${TimerResult} result=${timerResult} />
      <div class="rate-choices">
        ${['green', 'orange', 'red'].map((c) => html`<button
          key=${c}
          class=${`rate-choice ${c} ${current === c ? 'current' : ''}`}
          onPointerEnter=${() => setExpr(preview[c])}
          onPointerLeave=${() => setExpr('happy')}
          onClick=${() => onPick(c)}
        >
          <span class="face">${COLOR_META[c].face}</span>
          ${COLOR_META[c].label}
          <span class="pts">${pointsFor(c, settings) > 0 ? `+${pointsFor(c, settings)} pandi` : 'On fera mieux demain'}</span>
        </button>`)}
      </div>
      ${current && html`<button class="rate-clear" onClick=${() => onPick(null)}>Effacer la note</button>`}
    </div>
  <//>`;
}

// Routine choisie à la main : on la garde en revenant de l'espace parent ou du coin d'un enfant,
// jusqu'au prochain changement automatique (13 h ou 4 h).
let manualRoutine = null; // { routine, auto }
const startRoutine = () => (manualRoutine && manualRoutine.auto === currentRoutine() ? manualRoutine.routine : currentRoutine());

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
  const [behaviorFor, setBehaviorFor] = useState(null);
  const [moods, setMoods] = useState({});
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

  useEffect(() => setFocus({}), [date]);

  const kids = activeChildren(s.children);
  const today = routineDate(routine);
  const canTime = date === today;
  const timerFor = (childId, taskId) => s.timers.find((t) => t.key === timerKey(childId, taskId) && t.date === date && !t.finished) || null;

  // Une tâche notée (ici ou par l'autre parent) n'a plus besoin de son minuteur
  useEffect(() => {
    for (const t of s.timers) if (!t.finished && findRating(s.ratings, t.childId, t.taskId, t.date)) timers.removeTimer(t.key);
  }, [s.ratings, s.timers]);

  const stageTimer = stageKey && s.timers.find((t) => t.key === stageKey);
  useEffect(() => {
    if (stageKey && !stageTimer) setStageKey(null);
  }, [stageKey, stageTimer]);

  function focusIndex(child, list, withBehavior) {
    if (withBehavior && focus[child.id] === BEHAVIOR_CARD) return list.length;
    const i = list.findIndex((t) => t.id === focus[child.id]);
    if (i >= 0) return i;
    const first = list.findIndex((t) => !findRating(s.ratings, child.id, t.id, date));
    if (first >= 0) return first;
    if (withBehavior) return list.length;
    return Math.max(0, list.length - 1);
  }

  async function pickBehavior(child, level) {
    setBehaviorFor(null);
    const res = actions.setBehavior(child.id, date, level);
    const card = cards.current[`${child.id}:${BEHAVIOR_CARD}`];
    const head = heads.current[child.id];
    if (!level) return sfx.pop();
    if (level === 'super') {
      sfx.happy();
      replay(card, 'pop', 700);
      burst(card, { count: 16, chars: ['😇', '⭐', '✨'] });
      replay(head?.querySelector('.avatar'), 'av-jump', 900);
      setMood(child.id, 'joy', 2800);
    } else if (level === 'bien') {
      sfx.green();
      replay(card, 'pop', 700);
      burst(card, { count: 8, chars: ['🙂', '✨'] });
      setMood(child.id, 'happy', 2400);
    } else {
      sfx.red();
      replay(card, 'deflate', 800);
      setMood(child.id, 'focus', 2400);
    }
    if (res.delta > 0) {
      floatText(card, `+${res.delta}`);
      await flyCoins(card, head, Math.min(10, res.delta));
    }
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
    const points = pointsFor(color, s.settings);

    if (color === 'green') {
      sfx.green();
      replay(card, 'pop', 700);
      burst(card, { count: 14 });
      replay(head?.querySelector('.avatar'), 'av-jump', 900);
      setMood(child.id, 'joy', 2800);
    } else if (color === 'orange') {
      sfx.orange();
      replay(card, 'wobble', 700);
      burst(card, { count: 6, chars: ['✨', '💫'], spread: 90 });
      replay(head?.querySelector('.avatar'), 'av-wobble', 900);
      setMood(child.id, 'encourage', 2400);
    } else {
      sfx.red();
      replay(card, 'deflate', 800);
      setMood(child.id, 'focus', 2400);
    }

    // La carte suivante glisse au centre pendant que les pièces volent
    setTimeout(() => {
      const st = getState();
      const list = tasksForChild(child.id, date, st, routine);
      const from = list.findIndex((t) => t.id === task.id);
      const after = list.slice(from + 1).find((t) => !findRating(st.ratings, child.id, t.id, date));
      const next = nextOpen(list, from, (t) => findRating(st.ratings, child.id, t.id, date));
      const wantBehavior = routine === 'soir' && !findBehavior(st.ledger, child.id, date);
      const target = after ? after.id : wantBehavior ? BEHAVIOR_CARD : next >= 0 ? list[next].id : null;
      if (target) {
        sfx.slide();
        setFocus((f) => ({ ...f, [child.id]: target }));
      }
    }, 950);

    if (points > 0 && res.delta > 0) {
      floatText(card, `+${points}`);
      await flyCoins(card, head, Math.min(points, res.delta));
    }

    if (res.becameComplete) {
      await showOverlay('celebrate', { childId: child.id, perfect: res.after.perfect, bonus: res.perfectGained ? s.settings.perfectBonus : 0, routine });
    }
    for (const c of res.unlocked) {
      await showOverlay('reveal', { childId: child.id, itemId: c.reward_item, challengeTitle: c.title });
    }
    // Toute l'équipe a fini sa routine : « tape là ! »
    const st = getState();
    if (res.becameComplete && kids.length > 1 && kids.every((k) => routineProgress(k.id, date, st, routine).complete)) {
      await showOverlay('team', { kind: 'highfive', kids: kids.map((k) => k.id) });
    }
    if (res.team) await showOverlay('team', { kind: 'week', kids: res.team.kids, itemId: res.team.item, bonus: res.team.bonus });
    if (res.treasure) await showOverlay('team', { kind: 'treasure', kids: kids.map((k) => k.id), reward: res.treasure });
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

  return html`<div class=${`evening routine-${routine} page-enter`}>
    <${TopBar} onCalm=${() => setCalm(true)} chest=${kids.length > 1 && html`<${TeamPill} onOpen=${() => setTeam(true)} />`} />
    ${date !== today && html`<div class="past-banner">Tu modifies ${routine === 'matin' ? 'le matin' : 'la soirée'} du ${formatLong(date)}</div>`}
    <div class="strip">
      ${routine === 'matin' && date === today && html`<${DepartureBar} date=${date} />`}
    </div>
    <div class="columns" style=${{ '--n': Math.max(1, kids.length) }}>
      ${kids.length === 0 && html`<div class="empty-col">Ajoute un enfant dans l'espace parent ⚙️ pour commencer !</div>`}
      ${kids.map((child) => {
        const prog = routineProgress(child.id, date, s, routine);
        const list = tasksForChild(child.id, date, s, routine);
        const behaviorRow = routine === 'soir' && list.length ? findBehavior(s.ledger, child.id, date) : null;
        const behavior = routine === 'soir' && list.length ? { level: behaviorLevel(behaviorRow), points: behaviorRow?.amount || 0 } : null;
        return html`<section key=${child.id} class=${`kid-col ${prog.complete ? 'done' : ''}`} style=${{ '--kid': child.color }}>
          <div class="kid-head">
            <button class="kid-avatar" ref=${(n) => (heads.current[child.id] = n)} onClick=${() => navigate(`enfant/${child.id}`)} aria-label=${`Le coin de ${child.name}`}>
              <${Avatar} look=${child.look} equipped=${child.equipped} expr=${moods[child.id] || 'happy'} mode="head" seed=${child.id} />
            </button>
            <div class="kid-info">
              <span class="kid-name">${child.name}</span>
            </div>
          </div>
          <${Carousel}
            child=${child}
            list=${list}
            routine=${routine}
            date=${date}
            focus=${focusIndex(child, list, Boolean(behavior))}
            behavior=${behavior}
            onBehavior=${() => { sfx.tap(); setBehaviorFor(child.id); }}
            onFocus=${(taskId) => setFocus((f) => ({ ...f, [child.id]: taskId }))}
            canTime=${canTime}
            timerFor=${timerFor}
            cards=${cards}
            onOpen=${(task) => openTask(child, task)}
            onTimer=${(task) => { sfx.tap(); setPicker({ childId: child.id, taskId: task.id }); }}
            paused=${Boolean(stageTimer)}
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
      settings=${s.settings}
      timerResult=${open.timerResult}
      onPick=${(c) => pick(openChild, openTaskObj, c)}
      onClose=${closeRating}
    />`}
    ${calm && html`<${CalmCorner} kids=${kids} onClose=${() => setCalm(false)} />`}
    ${team && html`<${TeamSheet} onClose=${() => setTeam(false)} />`}
    ${behaviorFor && kids.some((k) => k.id === behaviorFor) && html`<${BehaviorSheet}
      child=${kids.find((k) => k.id === behaviorFor)}
      current=${behaviorLevel(findBehavior(s.ledger, behaviorFor, date))}
      settings=${s.settings}
      onPick=${(level) => pickBehavior(kids.find((k) => k.id === behaviorFor), level)}
      onClose=${() => setBehaviorFor(null)}
    />`}
  </div>`;
}
