// Coin calme : l'enfant choisit sa « météo » intérieure, puis Pandi le guide une à deux minutes
// avec une technique adaptée (respiration, tortue, citron, 5-4-3-2-1…). Rien n'est enregistré.
import { html, useEffect, useRef, useState } from '../vendor/preact-htm.js';
import { EMOTIONS, TECHNIQUES, PARENT_TIPS } from '../lib/emotions.js';
import { hush } from '../lib/timers.js';
import { Avatar } from '../avatar/Avatar.js';
import { Pandi } from './Coin.js';
import { sfx } from '../lib/sounds.js';
import { burst, confettiBurst } from '../anim/fx.js';
import { rand } from '../lib/util.js';
import { heartPath } from '../avatar/draw.js';
import { accordDeep } from '../domain.js';

function Bubble({ children, k }) {
  return html`<div class="cc-bubble" key=${k}>${children}</div>`;
}

// --- Le dragon : il gonfle ses joues, crache son feu (de plus en plus petit), puis sourit ----
// anger : 1 (très fâché) -> 0 (calme). Le feu, les sourcils et la rougeur suivent.
function Dragon({ phase, anger }) {
  const calm = phase === 'calm';
  const blowing = phase === 'out';
  const puffed = phase === 'in' || phase === 'hold';
  const brow = calm ? 0 : 4 + anger * 12;
  return html`<svg class=${`cc-dragon-svg d-${phase}`} viewBox="0 0 220 200" style=${{ '--fire': 0.35 + anger * 0.65 }} aria-hidden="true">
    <defs>
      <linearGradient id="dr-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7EE08A" /><stop offset="100%" stop-color="#2FA65A" /></linearGradient>
      <linearGradient id="dr-wing" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#B89BFF" /><stop offset="100%" stop-color="#7A55E0" /></linearGradient>
      <radialGradient id="dr-fire" cx="0%" cy="50%" r="100%"><stop offset="0%" stop-color="#FFF6B0" /><stop offset="35%" stop-color="#FFD23F" /><stop offset="70%" stop-color="#FF8A2B" /><stop offset="100%" stop-color="#E8392B" /></radialGradient>
    </defs>
    <ellipse cx="100" cy="186" rx="64" ry="8" fill="#000" opacity="0.2" />
    <g class="dr-all">
      <path class="dr-tail" d="M52 150 C24 156 10 140 18 122 C22 112 34 112 36 120 C30 122 28 132 38 136 C48 140 56 136 62 132 Z" fill="url(#dr-body)" stroke="#23824A" stroke-width="2" />
      <path d="M20 118 L14 106 L28 112 Z" fill="#FFD27A" />
      <g class="dr-wing"><path d="M70 96 C46 60 22 62 14 74 C30 74 34 84 30 94 C44 88 52 98 50 108 Z" fill="url(#dr-wing)" stroke="#5B3BBE" stroke-width="2" stroke-linejoin="round" /></g>
      <g class=${`dr-body ${puffed ? 'puff' : ''}`}>
        <ellipse cx="92" cy="136" rx="50" ry="42" fill="url(#dr-body)" stroke="#23824A" stroke-width="2.4" />
        <ellipse cx="100" cy="146" rx="28" ry="28" fill="#FFE7A3" />
        <path d="M80 136 Q100 130 120 136 M78 148 Q100 142 122 148 M82 160 Q100 155 118 160" stroke="#E6C46A" stroke-width="2" fill="none" />
        <ellipse cx="70" cy="176" rx="15" ry="9" fill="#2FA65A" stroke="#23824A" stroke-width="2" /><ellipse cx="116" cy="176" rx="15" ry="9" fill="#2FA65A" stroke="#23824A" stroke-width="2" />
        <path d="M60 176 v-3 M66 178 v-3 M106 176 v-3 M112 178 v-3" stroke="#fff" stroke-width="2" stroke-linecap="round" />
      </g>
      <g class="dr-head">
        <path d="M108 44 L102 22 L118 38 Z M132 40 L134 18 L144 38 Z" fill="#FFF1C8" stroke="#D9B85F" stroke-width="1.6" stroke-linejoin="round" />
        <path d="M92 64 L82 56 L94 52 Z M90 82 L78 78 L90 72 Z" fill="#FFD27A" />
        <circle cx="124" cy="78" r="36" fill="url(#dr-body)" stroke="#23824A" stroke-width="2.4" />
        <ellipse cx="160" cy="92" rx="30" ry="22" fill="url(#dr-body)" stroke="#23824A" stroke-width="2.4" />
        <circle cx="124" cy="78" r="35" fill="#FF4A4A" opacity=${calm ? 0 : anger * 0.32} class="dr-red" />
        <circle cx="178" cy="84" r="2.6" fill="#1E5A35" /><circle cx="170" cy="82" r="2.4" fill="#1E5A35" />
        <g class=${`dr-cheek ${puffed ? 'puff' : ''}`}><circle cx="146" cy="100" r=${puffed ? 12 : 8} fill="#FF8FA3" opacity=${calm ? 0.75 : 0.45} /></g>
        ${calm
          ? html`<g stroke="#1E3A28" stroke-width="3.6" fill="none" stroke-linecap="round"><path d="M110 76 Q118 68 126 76" /><path d="M136 74 Q143 67 150 74" /></g>`
          : html`<g class="dr-eyes"><circle cx="118" cy="76" r="8" fill="#fff" /><circle cx="143" cy="74" r="7" fill="#fff" />
              <circle cx="120" cy="77" r="4" fill="#1E3A28" /><circle cx="145" cy="75" r="3.6" fill="#1E3A28" />
              <circle cx="121.5" cy="75.5" r="1.4" fill="#fff" /><circle cx="146.3" cy="73.6" r="1.2" fill="#fff" /></g>`}
        ${!calm && html`<g stroke="#1E3A28" stroke-width="3.6" stroke-linecap="round"><path d=${`M108 ${64 - brow * 0.2} L128 ${64 + brow * 0.5}`} /><path d=${`M154 ${60 - brow * 0.2} L136 ${62 + brow * 0.5}`} /></g>`}
        ${calm
          ? html`<path d="M152 100 Q166 114 182 100" stroke="#1E3A28" stroke-width="3.4" fill="#C0485A" stroke-linecap="round" />`
          : blowing
            ? html`<ellipse cx="184" cy="100" rx="8" ry=${4 + anger * 6} fill="#7A1F2E" stroke="#1E3A28" stroke-width="2" />`
            : html`<path d=${puffed ? 'M166 104 Q176 106 186 102' : 'M164 104 Q176 100 186 104'} stroke="#1E3A28" stroke-width="3" fill="none" stroke-linecap="round" />`}
      </g>
      ${blowing && html`<g class="dr-fire" transform="translate(188 100)">
        <path class="f1" d="M0 0 C20 -26 60 -34 104 -18 C80 -10 96 0 112 4 C90 10 84 22 104 30 C64 36 24 26 0 0 Z" fill="url(#dr-fire)" />
        <path class="f2" d="M0 0 C16 -14 44 -18 72 -8 C58 -2 66 4 78 6 C60 12 30 14 0 0 Z" fill="#FFD23F" opacity="0.9" />
        <path class="f3" d="M0 0 C10 -6 26 -8 42 -3 C34 0 36 3 44 4 C30 8 14 6 0 0 Z" fill="#FFF6C4" />
        ${[0, 1, 2, 3, 4].map((i) => html`<circle key=${i} class="ember" style=${{ animationDelay: `${i * 0.18}s` }} cx=${30 + i * 12} cy=${-6 + (i % 3) * 6} r=${2 + (i % 2)} fill="#FFB627" />`)}
        ${anger < 0.45 && html`<g class="smoke">${[0, 1, 2].map((i) => html`<circle key=${i} style=${{ animationDelay: `${i * 0.3}s` }} cx=${40 + i * 18} cy="-8" r=${6 + i * 2} fill="#D8D4E8" opacity="0.6" />`)}</g>`}
      </g>`}
      ${calm && html`<g class="dr-hearts">${[[150, 40, 0], [190, 60, 0.6], [100, 30, 1.2], [200, 120, 1.8]].map(([x, y, d], i) => html`<path key=${i} style=${{ animationDelay: `${d}s` }} d=${heartPath(x, y, 7)} fill="#FF7EB6" />`)}</g>`}
    </g>
  </svg>`;
}

// --- Respiration guidée (fleur et bougie, ballon, dragon) ---------------------------------
function Breath({ tech, color, onDone }) {
  const [phase, setPhase] = useState('ready'); // ready | in | hold | out
  const [cycle, setCycle] = useState(0);
  const [count, setCount] = useState(3);

  useEffect(() => {
    let alive = true;
    const timers = [];
    const wait = (s) => new Promise((r) => timers.push(setTimeout(r, s * 1000)));
    const countdown = async (secs) => {
      for (let n = secs; n > 0 && alive; n--) {
        setCount(n);
        await wait(1);
      }
    };
    (async () => {
      await countdown(3);
      for (let c = 0; c < tech.cycles && alive; c++) {
        setCycle(c);
        setPhase('in');
        sfx.breathIn(tech.inhale);
        await countdown(tech.inhale);
        if (!alive) return;
        if (tech.hold) {
          setPhase('hold');
          await countdown(tech.hold);
        }
        if (!alive) return;
        setPhase('out');
        sfx.breathOut(tech.exhale);
        if (tech.visual === 'dragon') sfx.fire(1 - c / tech.cycles);
        await countdown(tech.exhale);
      }
      // Fin de l'exercice : le dragon se calme et sourit
      if (alive && tech.endText) {
        setPhase('calm');
        sfx.happy();
        await wait(4.5);
      }
      if (alive) onDone();
    })();
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
  }, []);

  const secs = phase === 'in' ? tech.inhale : phase === 'out' ? tech.exhale : 1;
  const big = phase === 'in' || phase === 'hold';
  const last = cycle === tech.cycles - 1;
  const anger = Math.max(0, 1 - cycle / Math.max(1, tech.cycles - 1));
  const text = phase === 'ready' ? tech.readyText || 'Prêt ? On commence dans…' : phase === 'calm' ? tech.endText : phase === 'in' ? tech.inText : phase === 'hold' ? tech.holdText : last && tech.lastOutText ? tech.lastOutText : tech.outText;
  return html`<div class=${`cc-breath v-${tech.visual} b-${phase}`} style=${{ '--c': color, '--secs': `${secs}s` }}>
    <div class="cc-visual">
      <div class=${`cc-orb ${big ? 'big' : ''}`} />
      ${tech.visual === 'balloon' && html`<div class=${`cc-balloon ${big ? 'big' : ''}`}><span /></div>`}
      ${tech.visual === 'flower' && html`<div class="cc-flower-candle">
        <span class=${`cc-flower ${phase === 'in' || phase === 'hold' ? 'smell' : ''}`}>🌸</span>
        <span class=${`cc-candle ${phase === 'out' ? 'blow' : ''}`}><i class="flame" /><b /></span>
      </div>`}
      ${tech.visual === 'dragon' && html`<${Dragon} phase=${phase} anger=${phase === 'ready' ? 1 : anger} />`}
    </div>
    <div class="cc-guide">
      ${phase === 'calm' ? html`<div class="cc-count cc-smile">😊</div>` : html`<div class="cc-count" key=${`${phase}${count}`}>${count}</div>`}
      <div class="cc-text" key=${phase}>${text}</div>
      <div class="cc-cycles">${Array.from({ length: tech.cycles }, (_, i) => html`<i key=${i} class=${phase === 'calm' || i < cycle || (i === cycle && phase === 'out') ? 'on' : ''} />`)}</div>
    </div>
  </div>`;
}

// --- Étapes guidées (tortue, citron, robot, papillon…) ---------------------------------------
function Steps({ tech, color, onDone }) {
  const [i, setI] = useState(0);
  const [side, setSide] = useState(0);
  const step = tech.steps[i];

  useEffect(() => {
    sfx.softChime();
    const t = setTimeout(() => (i + 1 < tech.steps.length ? setI(i + 1) : onDone()), step.secs * 1000);
    let beat = null;
    if (step.beat) {
      beat = setInterval(() => {
        setSide((x) => 1 - x);
        sfx.softTap();
      }, step.beat * 1000);
    }
    return () => {
      clearTimeout(t);
      clearInterval(beat);
    };
  }, [i]);

  return html`<div class="cc-steps" style=${{ '--c': color }}>
    <div class="cc-visual">
      <div class="cc-orb big pulse" />
      ${step.big
        ? html`<span class="cc-big-number" key=${i}>${step.big}</span>`
        : html`<span class=${`cc-icon a-${step.anim || 'pop'} ${step.beat ? `side-${side}` : ''}`} key=${i}>${step.icon}</span>`}
    </div>
    <div class="cc-guide">
      <div class="cc-text" key=${i}>${step.text}</div>
      <div class="cc-progress"><i key=${i} style=${{ animationDuration: `${step.secs}s` }} /></div>
      <div class="cc-cycles">${tech.steps.map((_, k) => html`<i key=${k} class=${k <= i ? 'on' : ''} />`)}</div>
    </div>
  </div>`;
}

// --- 5-4-3-2-1 : on touche le bouton à chaque trouvaille -------------------------------------
function Senses({ tech, color, onDone }) {
  const [i, setI] = useState(0);
  const [found, setFound] = useState(0);
  const btn = useRef(null);
  const step = tech.steps[i];
  function hit() {
    const n = found + 1;
    sfx.coin(n);
    burst(btn.current, { count: 6, chars: ['⭐', '✨'], spread: 90 });
    if (n < step.count) return setFound(n);
    sfx.sparkle();
    setTimeout(() => {
      if (i + 1 < tech.steps.length) {
        setI(i + 1);
        setFound(0);
      } else onDone();
    }, 500);
    setFound(n);
  }
  return html`<div class="cc-steps cc-senses" style=${{ '--c': color }}>
    <div class="cc-visual">
      <div class="cc-orb big" />
      <span class="cc-icon a-pop" key=${i}>${step.icon}</span>
    </div>
    <div class="cc-guide">
      <div class="cc-text" key=${i}>${step.text}</div>
      <div class="cc-found">${Array.from({ length: step.count }, (_, k) => html`<i key=${k} class=${k < found ? 'on' : ''}>${k < found ? '⭐' : ''}</i>`)}</div>
      <button class="btn btn-gold btn-big" ref=${btn} onClick=${hit} disabled=${found >= step.count}>J'ai trouvé !</button>
    </div>
  </div>`;
}

// --- Bocal à paillettes : on le secoue, puis on regarde tout retomber en respirant -----------
function Jar({ tech, color, onDone }) {
  const [shaken, setShaken] = useState(0);
  const [settle, setSettle] = useState(false);
  const flakes = useRef(Array.from({ length: 46 }, (_, k) => ({ k, x: rand(8, 92), y: rand(76, 94), hue: ['#FFD23F', '#FF7EB6', '#5EC8FF', '#B9A9FF', '#FFFFFF'][k % 5], s: rand(0.6, 1.3) })));
  const [pos, setPos] = useState(flakes.current.map((f) => ({ x: f.x, y: f.y, d: 0 })));

  function shake() {
    sfx.whoosh();
    sfx.sparkle();
    setSettle(false);
    setPos(flakes.current.map(() => ({ x: rand(6, 94), y: rand(6, 70), d: 0.4 })));
    setShaken((n) => n + 1);
    setTimeout(() => {
      setSettle(true);
      setPos(flakes.current.map((f) => ({ x: f.x + rand(-6, 6), y: rand(78, 95), d: rand(10, tech.secs - 4) })));
    }, 700);
  }

  useEffect(() => {
    if (!shaken) return;
    const t = setTimeout(onDone, tech.secs * 1000 + 800);
    return () => clearTimeout(t);
  }, [shaken]);

  return html`<div class="cc-steps cc-jar-wrap" style=${{ '--c': color }}>
    <div class="cc-visual">
      <button class=${`cc-jar ${shaken && !settle ? 'shaking' : ''}`} aria-label="Secouer le bocal" onClick=${shake}>
        <span class="lid" />
        ${flakes.current.map((f, k) => html`<i key=${f.k} style=${{ left: `${pos[k].x}%`, top: `${pos[k].y}%`, background: f.hue, transform: `scale(${f.s}) rotate(${pos[k].y * 7}deg)`, transitionDuration: `${pos[k].d}s` }} />`)}
      </button>
    </div>
    <div class="cc-guide">
      <div class="cc-text" key=${settle ? 's' : shaken ? 'w' : 'i'}>
        ${!shaken ? 'Touche le bocal pour le secouer très fort !' : settle ? 'Regarde les paillettes tomber tout doucement… Respire avec elles.' : 'Tourbillon !'}
      </div>
      ${shaken > 0 && html`<button class="btn btn-ghost" onClick=${onDone}>Mes paillettes sont tombées</button>`}
    </div>
  </div>`;
}

const RUNNERS = { breath: Breath, steps: Steps, senses: Senses, jar: Jar };

export function CalmCorner({ kids, onClose }) {
  const [child, setChild] = useState(kids.length === 1 ? kids[0] : null);
  const [emotion, setEmotion] = useState(null);
  const [techIndex, setTechIndex] = useState(0);
  const [step, setStep] = useState(kids.length > 1 ? 'who' : 'feel'); // who | feel | validate | do | after | end
  const [runId, setRunId] = useState(0);
  const [tips, setTips] = useState(false);
  const [ending, setEnding] = useState(null);
  const root = useRef(null);

  // La musique des minuteurs se tait pendant le moment calme
  useEffect(() => {
    hush(true);
    sfx.softChime();
    return () => hush(false);
  }, []);

  const color = emotion?.color || '#9b7bff';
  const techId = emotion ? emotion.techniques[techIndex % emotion.techniques.length] : null;
  // Textes accordés au sexe de l'enfant (« Prête ? », « Inquiète »…)
  const tech = techId ? accordDeep({ readyText: '{Prêt|Prête} ? On commence dans…', ...TECHNIQUES[techId] }, child) : null;
  const emotions = accordDeep(EMOTIONS, child);
  const emo = emotion ? emotions.find((e) => e.id === emotion.id) : null;
  const name = child?.name || '';
  const Runner = tech ? RUNNERS[tech.kind] : null;

  function chooseEmotion(e) {
    sfx.pop();
    setEmotion(e);
    setTechIndex(0);
    setStep('validate');
  }
  function another() {
    sfx.tap();
    setTechIndex((i) => i + 1);
  }
  function start() {
    sfx.tap();
    setRunId((n) => n + 1);
    setStep('do');
  }
  function feeling(result) {
    setEnding(result);
    if (result === 'better') {
      sfx.happy();
      confettiBurst(root.current?.querySelector('.cc-pandi'));
      setStep('end');
    } else {
      sfx.pop();
      setTechIndex((i) => i + 1);
      setStep('validate');
    }
  }

  const pandiMood = step === 'end' ? 'happy' : 'neutral';
  let bubble = '';
  if (step === 'who') bubble = 'Qui a besoin d’un moment calme ?';
  else if (step === 'feel') bubble = `Comment tu te sens, ${name || 'mon ami'} ?`;
  else if (step === 'validate') bubble = ending ? (ending === 'same' ? 'C’est d’accord, ça arrive. On essaie autre chose ensemble ?' : 'On continue un petit peu ? Encore une idée :') : emo.validate;
  else if (step === 'do') bubble = tech.intro;
  else if (step === 'after') bubble = 'Comment tu te sens maintenant ?';
  else if (step === 'end') bubble = `Bravo ${name} ! Tu as calmé ${emotion.id === 'colere' ? 'ton orage' : emotion.id === 'tristesse' ? 'ta pluie' : emotion.id === 'excite' ? 'ta tornade' : 'tes nuages'}. Tu veux un câlin ou en parler ?`;

  return html`<div class=${`calm-corner cc-step-${step}`} style=${{ '--c': color }} role="dialog" aria-modal="true" aria-label="Coin calme" ref=${root}>
    <div class="cc-sky" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => html`<span key=${i} style=${{ left: `${(i * 37) % 100}%`, animationDelay: `${-i * 1.7}s`, animationDuration: `${14 + (i % 5) * 3}s` }} />`)}</div>
    <header class="cc-top">
      <button class="btn btn-ghost btn-small" onClick=${() => { sfx.tap(); setTips(!tips); }}>💡 Conseils parents</button>
      <div class="cc-title">🌈 Coin calme</div>
      <button class="icon-btn" aria-label="Fermer le coin calme" onClick=${() => { sfx.tap(); onClose(); }}>✕</button>
    </header>

    <div class="cc-body">
      <div class="cc-pandi">
        <${Bubble} k=${`${step}${techIndex}${ending}`}>${bubble}<//>
        <${Pandi} mood=${pandiMood} wave=${step === 'who' || step === 'feel'} />
        ${child && html`<div class="cc-kid kid-avatar" style=${{ '--kid': child.color }}><${Avatar} look=${child.look} equipped=${child.equipped} mode="head" seed=${child.id} expr=${step === 'end' ? 'joy' : step === 'do' ? 'happy' : 'encourage'} /></div>`}
      </div>

      <div class="cc-main">
        ${step === 'who' && html`<div class="cc-kids">
          ${kids.map((k) => html`<button key=${k.id} class="cc-kid-btn" style=${{ '--kid': k.color }} onClick=${() => { sfx.pop(); setChild(k); setStep('feel'); }}>
            <div class="kid-avatar"><${Avatar} look=${k.look} equipped=${k.equipped} mode="head" seed=${k.id} /></div>${k.name}
          </button>`)}
        </div>`}

        ${step === 'feel' && html`<div class="cc-weather">
          ${emotions.map((e, i) => html`<button key=${e.id} class="cc-emotion" style=${{ '--e': e.color, '--i': i }} onClick=${() => chooseEmotion(e)}>
            <span class="sky">${e.sky}</span><span class="face">${e.face}</span><b>${e.label}</b><em>${e.weather}</em>
          </button>`)}
        </div>`}

        ${step === 'validate' && html`<div class="cc-choice">
          <div class="cc-tech-card" key=${techId}>
            <span class="emoji">${tech.emoji}</span>
            <div><b>${tech.title}</b><p>${tech.intro}</p></div>
          </div>
          <div class="sheet-actions">
            <button class="btn btn-green btn-big" onClick=${start}>C'est parti !</button>
            <button class="btn btn-ghost" onClick=${another}>🔄 Une autre idée</button>
          </div>
          <button class="ts-link" onClick=${() => { sfx.tap(); setEnding(null); setStep('feel'); }}>← Changer d'émotion</button>
        </div>`}

        ${step === 'do' && html`<div class="cc-run">
          <${Runner} key=${runId} tech=${tech} color=${color} onDone=${() => { sfx.sparkle(); setStep('after'); }} />
          <button class="ts-link" onClick=${() => setStep('after')}>Passer</button>
        </div>`}

        ${step === 'after' && html`<div class="cc-weather cc-after">
          <button class="cc-emotion" style=${{ '--e': '#2fcf74', '--i': 0 }} onClick=${() => feeling('better')}><span class="face">😊</span><b>Mieux !</b><em>Le soleil revient</em></button>
          <button class="cc-emotion" style=${{ '--e': '#ffd23f', '--i': 1 }} onClick=${() => feeling('bit')}><span class="face">🙂</span><b>Un peu mieux</b><em>Quelques nuages</em></button>
          <button class="cc-emotion" style=${{ '--e': color, '--i': 2 }} onClick=${() => feeling('same')}><span class="face">${emotion.face}</span><b>Toujours pareil</b><em>${emotion.weather}</em></button>
        </div>`}

        ${step === 'end' && html`<div class="cc-end">
          <div class="cc-sun">🌞</div>
          <div class="sheet-actions">
            <button class="btn btn-pink btn-big" onClick=${() => { sfx.happy(); onClose(); }}>🤗 Un câlin</button>
            <button class="btn btn-blue btn-big" onClick=${() => { sfx.tap(); onClose(); }}>💬 On en parle</button>
          </div>
          <button class="ts-link" onClick=${() => { sfx.tap(); setEnding(null); setEmotion(null); setStep('feel'); }}>Recommencer</button>
        </div>`}
      </div>
    </div>

    ${tips && html`<div class="cc-tips" onClick=${() => setTips(false)}>
      <div class="sheet" onClick=${(e) => e.stopPropagation()}>
        <button class="close" aria-label="Fermer" onClick=${() => setTips(false)}>✕</button>
        <h2>💡 Pendant la crise</h2>
        ${emo && html`<p class="cc-tip-emotion" style=${{ '--e': emo.color }}>${emo.face} <b>${emo.label} :</b> ${emo.tip}</p>`}
        <ul>${accordDeep(PARENT_TIPS, child).map((t) => html`<li key=${t}>${t}</li>`)}</ul>
        <p class="hint">Si les crises sont très fréquentes ou très fortes, parlez-en à votre médecin ou à un psychologue pour enfants.</p>
      </div>
    </div>`}
  </div>`;
}
