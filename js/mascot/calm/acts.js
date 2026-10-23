// Les numéros de Pandi dans le coin calme : il fait l'exercice à côté du personnage de l'exercice et
// encourage l'enfant. Le coin calme lui passe l'étape en cours dans ctx : { phase, secs, … } ; chaque
// changement d'étape relance son horloge d'étape (since).
import { V, TAU, wob, face, emit, gaze, proud } from '../acts.js';
import { lerp, clamp } from '../pandi3d.js';

const ease = (x) => x * x * (3 - 2 * x);
// secondes écoulées depuis le début de l'étape (l'acteur recopie ctx à chaque changement)
const since = (t, ctx) => {
  if (ctx._t0 === undefined) ctx._t0 = t;
  return t - ctx._t0;
};

// Grande respiration : les pattes montent du ventre vers le ciel (k : 0 -> 1), les yeux se ferment
function inhale(P, k) {
  P.handR.lerpVectors(V(0.24, 0.12, 0.56), V(0.62, 0.86, 0.32), k);
  P.handL.lerpVectors(V(-0.24, 0.12, 0.56), V(-0.62, 0.86, 0.32), k);
  P.poleR.set(1, -0.8, -0.3);
  P.poleL.set(-1, -0.8, -0.3);
  P.squash = -0.05 * k;
  P.headX = -0.04 - 0.12 * k;
  face(P, { smile: 0.75, lidUp: 0.15 + 0.6 * k, lidLo: 0.6, open: 0 });
}

// Coucou à l'enfant pendant le compte à rebours
function hello(t, P) {
  const s = Math.sin(t * TAU * 1.6);
  P.handR.set(0.62, 0.95 + s * 0.03, 0.3 + s * 0.07);
  P.poleR.set(1, -1, -0.3);
  P.headZ = 0.06 + wob(t * 0.5, 1) * 0.04;
  face(P, { smile: 1, open: 0.035, tongue: 1, lidLo: 0.7 });
}

// Bras croisés sur la poitrine, les pattes sur les épaules (tortue, câlin papillon) ; k : 0 -> 1
function crossArms(P, k, tapR = 0, tapL = 0) {
  P.handR.lerp(V(-0.2, 0.5 + tapR * 0.07, 0.42), k);
  P.handL.lerp(V(0.2, 0.47 + tapL * 0.07, 0.47), k);
  P.poleR.lerp(V(1, -0.6, -0.1), k);
  P.poleL.lerp(V(-1, -0.6, -0.1), k);
}

// Les poses de Pandi-robot, une toutes les 0,45 s : [patte droite, patte gauche, tête]
const ROBO = [[[0.5, 0.1, 0.3], [-0.5, 0.1, 0.3], 0], [[0.42, 0.55, 0.75], [-0.5, 0.1, 0.3], 0.3], [[0.42, 0.55, 0.75], [-0.42, 0.55, 0.75], 0], [[0.8, 0.52, 0.1], [-0.8, 0.52, 0.1], -0.3], [[0.5, 1.15, 0.2], [-0.5, 0.1, 0.3], 0.3], [[0.5, 0.1, 0.3], [-0.5, 1.15, 0.2], -0.3]];

export const CALM_ACTS = {
  // Le bocal à paillettes : il montre le bocal (« touche-le ! »), s'agite avec le tourbillon, puis regarde tout retomber en respirant
  calmeBocal: {
    pose(t, P, ctx) {
      const pt = since(t, ctx), secs = ctx.secs || 35;
      const ph = ctx.phase || 'wait';
      if (ph === 'wait') {
        const s = Math.sin(t * TAU * 0.8);
        P.handR.set(0.7, 0.4 + s * 0.04, 0.45);
        P.poleR.set(1, -0.6, -0.4);
        P.handL.set(-0.52, 0.02, 0.12);
        P.poleL.set(-1, 0.3, -1);
        P.headY = 0.15 + Math.sin(t * 0.9) * 0.15;
        face(P, { smile: 1, open: 0.04, tongue: 0.7, lidLo: 0.7, lookX: Math.sin(t * 0.9) > 0 ? 0.5 : 0, lookY: 0 });
      } else if (ph === 'shake') {
        // tourbillon ! il agite les bras, tout excité
        const w = Math.sin(t * TAU * 3);
        P.handR.set(0.6, 1.0 + w * 0.08, 0.3);
        P.handL.set(-0.6, 1.0 - w * 0.08, 0.3);
        P.poleR.set(1, -1, 0);
        P.poleL.set(-1, -1, 0);
        P.rootY = Math.abs(Math.sin(t * TAU * 1.8)) * 0.08;
        face(P, { open: 0.07, smile: 1, tongue: 1, lidUp: 0, lidLo: 0.5, lookX: 0.5 });
      } else {
        // tout doucement : il respire et suit les paillettes qui tombent
        const u = clamp(pt / secs, 0, 1);
        const b = Math.sin(pt * TAU / 6 - Math.PI / 2) * 0.5 + 0.5;
        P.handR.set(0.2, 0.1, 0.56);
        P.handL.set(-0.2, 0.1, 0.56);
        P.squash = -0.04 * b;
        P.headY = 0.28;
        P.headX = lerp(-0.05, 0.15, u);
        face(P, { smile: 0.85, lidUp: 0.35, lidLo: 0.6, lookX: 0.5, lookY: lerp(0.3, -0.5, u) });
      }
    },
  },
  // 5-4-3-2-1 avec le hibou : il regarde (la patte en visière), touche, écoute, renifle, goûte ; un saut à chaque trouvaille
  calmeHibou: {
    pose(t, P, ctx) {
      const pt = since(t, ctx);
      const ph = ctx.phase || 'voir';
      if (ctx.found !== ctx._found) {
        if ((ctx.found || 0) > (ctx._found || 0)) ctx._foundT = t;
        ctx._found = ctx.found;
      }
      const hop = Math.sin(clamp((t - (ctx._foundT ?? -9)) / 0.45, 0, 1) * Math.PI);
      P.rootY = hop * 0.1;
      const k = ease(clamp(pt / 0.6, 0, 1));
      if (ph === 'voir') {
        P.anchorR = { bone: 'head', off: [0.12, 0.3, 0.5], w: k };
        P.poleR.set(1, -1, 0);
        P.handL.set(-0.5, 0.05, 0.25);
        P.headY = Math.sin(pt * 1.1) * 0.4;
        face(P, { smile: 0.9, lidUp: 0, lidLo: 0.45, lookX: Math.sin(pt * 1.1) * 0.5, lookY: 0.1 });
      } else if (ph === 'toucher') {
        const s = Math.sin(t * 4);
        P.handR.set(0.16, 0.12 + s * 0.04, 0.56 + Math.max(0, s) * 0.03);
        P.handL.set(-0.16, 0.12 - s * 0.04, 0.56 + Math.max(0, -s) * 0.03);
        P.poleR.set(1, -0.5, -0.3);
        P.poleL.set(-1, -0.5, -0.3);
        P.headX = 0.15;
        face(P, { smile: 1, lidUp: 0.5, lidLo: 0.9, lookY: -0.5 });
      } else if (ph === 'entendre') {
        P.anchorR = { bone: 'head', off: [0.46, -0.02, 0.12], w: k };
        P.poleR.set(1, -1, 0);
        P.handL.set(-0.5, 0.05, 0.25);
        P.headZ = -0.15;
        face(P, { smile: 0.9, lidUp: 0.92, lidLo: 0.8 });
      } else if (ph === 'sentir') {
        P.handR.set(0.2, 0.1, 0.56);
        P.handL.set(-0.2, 0.1, 0.56);
        P.headX = -0.2 + Math.sin(t * 9) * 0.015;
        face(P, { smile: 1, lidUp: 0.9, lidLo: 0.9 });
      } else {
        // miam : il se lèche les babines et se frotte le ventre
        const s = Math.sin(t * 3.2);
        P.handR.set(0.1 + s * 0.08, 0.15 + Math.cos(t * 3.2) * 0.06, 0.58);
        P.handL.set(-0.2, 0.1, 0.56);
        P.poleR.set(1, -0.5, -0.3);
        P.poleL.set(-1, -0.5, -0.3);
        face(P, { smile: 1, open: 0.045, tongue: 1, lidUp: 0.3, lidLo: 1 });
      }
      if (hop > 0.05) face(P, { smile: 1, open: 0.05, tongue: 1, lidUp: 0, lidLo: 0.8 }, hop);
    },
  },
  // La bulle magique : il souffle la bulle, la regarde briller, ne craint rien des nuages, respire dedans
  calmeBulle: {
    pose(t, P, ctx) {
      const pt = since(t, ctx), secs = ctx.secs || 6;
      const ph = ctx.phase || 'souffle';
      if (ph === 'souffle') {
        // les pattes en rond devant la bouche, il souffle… puis il admire
        const blow = 1 - ease(clamp((pt - 3) / 0.8, 0, 1));
        P.handR.lerpVectors(V(0.5, 0.2, 0.3), V(0.08, 0.72, 0.62), blow);
        P.handL.lerpVectors(V(-0.5, 0.2, 0.3), V(-0.08, 0.72, 0.62), blow);
        P.poleR.set(1, -1, -0.2);
        P.poleL.set(-1, -1, -0.2);
        P.squash = 0.03 * blow * Math.sin(Math.min(1, pt / 3) * Math.PI);
        face(P, blow > 0.5 ? { open: 0.035, round: 1, smile: 0.5, lidUp: 0.2, lidLo: 0.5, lookY: -0.1 } : { open: 0.06, round: 0.6, smile: 1, lidUp: 0, lidLo: 0.4, lookY: 0.6, lookX: Math.sin(t) * 0.4 });
      } else if (ph === 'couleur') {
        // il touche la paroi de la bulle, émerveillé
        const s = Math.sin(t * 1.5);
        P.handR.set(0.68, 0.75 + s * 0.05, 0.45);
        P.handL.set(-0.68, 0.75 - s * 0.05, 0.45);
        P.poleR.set(1, -0.8, -0.3);
        P.poleL.set(-1, -0.8, -0.3);
        P.headY = s * 0.25;
        face(P, { open: 0.05, smile: 1, tongue: 0.8, lidUp: 0, lidLo: 0.6, lookY: 0.3, lookX: s * 0.5 });
      } else if (ph === 'protege') {
        // rien ne peut entrer : les mains sur les hanches, il rigole quand un nuage rebondit
        proud(P);
        P.rootY = Math.abs(Math.sin(t * 2.5)) * 0.015;
        face(P, { smile: 1, open: 0.04, tongue: 0.6, lidLo: 0.8, lookX: Math.sin(t * 0.8) * 0.6, lookY: 0.2 });
      } else if (ph === 'respire') {
        const b = Math.sin((pt / secs) * TAU * 2 - Math.PI / 2) * 0.5 + 0.5;
        P.handR.set(0.2, 0.1, 0.56);
        P.handL.set(-0.2, 0.1, 0.56);
        P.squash = -0.05 * b;
        P.rootY = 0.06 + Math.sin(t * 1.2) * 0.03;
        face(P, { smile: 0.9, lidUp: 0.92, lidLo: 0.8 });
      } else {
        crossArms(P, ease(clamp(pt / 0.8, 0, 1)));
        P.rootY = 0.05 + Math.sin(t * 1.2) * 0.03;
        P.headZ = 0.12;
        face(P, { smile: 1, lidUp: 0.8, lidLo: 0.95, open: 0.02, tongue: 0.4 });
      }
    },
  },
  // Un souvenir : les yeux fermés, les pattes sur le cœur ; il écoute, il sent, il garde le souvenir, puis le raconte
  calmeSouvenir: {
    pose(t, P, ctx) {
      const pt = since(t, ctx);
      const ph = ctx.phase || 'yeux';
      P.side = Math.sin(t * 0.9) * 0.025;
      const heart = () => {
        P.handR.set(0.1, 0.42, 0.56);
        P.handL.set(-0.1, 0.4, 0.58);
        P.poleR.set(1, -0.8, -0.2);
        P.poleL.set(-1, -0.8, -0.2);
      };
      if (ph === 'yeux' || ph === 'ou') {
        heart();
        P.headZ = ph === 'ou' ? 0.12 : 0.05;
        P.headX = -0.06;
        face(P, { smile: ph === 'ou' ? 1 : 0.8, lidUp: 0.95, lidLo: 0.8, open: ph === 'ou' ? 0.02 : 0, tongue: 0.3 });
      } else if (ph === 'sens') {
        // une patte derrière l'oreille pour écouter, le nez qui hume
        P.anchorR = { bone: 'head', off: [0.46, -0.02, 0.12], w: ease(clamp(pt / 0.8, 0, 1)) };
        P.poleR.set(1, -1, 0);
        P.handL.set(-0.1, 0.4, 0.58);
        P.poleL.set(-1, -0.8, -0.2);
        P.headZ = -0.15;
        P.headX = -0.1 + Math.sin(t * 4) * 0.02;
        face(P, { smile: 0.9, lidUp: 0.9, lidLo: 0.8 });
      } else if (ph === 'coeur') {
        crossArms(P, ease(clamp(pt / 0.8, 0, 1)));
        P.squash = 0.03;
        P.headZ = 0.15;
        face(P, { smile: 1, lidUp: 0.8, lidLo: 0.95, open: 0.02, tongue: 0.4 });
      } else {
        // il ouvre les yeux et les pattes : « tu me racontes ? »
        const k = ease(clamp(pt / 0.8, 0, 1));
        P.handR.lerpVectors(V(0.1, 0.42, 0.56), V(0.58, 0.45, 0.45), k);
        P.handL.lerpVectors(V(-0.1, 0.4, 0.58), V(-0.58, 0.45, 0.45), k);
        P.poleR.set(1, -0.6, -0.4);
        P.poleL.set(-1, -0.6, -0.4);
        P.headZ = Math.sin(t * 1.5) * 0.06;
        face(P, { smile: 1, open: 0.03 + Math.max(0, Math.sin(t * 9)) * 0.03, tongue: 0.6, lidUp: 0, lidLo: 0.7, lookX: 0, lookY: 0 });
        emit(P, { kind: 'emoji', ch: '💬', rate: 0.5 * k, at: [0.45, 1.5, 0.4], size: 0.22 });
      }
    },
  },

  // Le câlin papillon : bras croisés, il tapote une épaule puis l'autre ; à la fin il se fait un câlin
  calmePapillon: {
    pose(t, P, ctx) {
      const pt = since(t, ctx);
      const ph = ctx.phase || 'croise';
      if (ctx.tap !== ctx._tap) {
        ctx._tap = ctx.tap;
        ctx._tapT = t;
      }
      if (ph === 'croise') {
        crossArms(P, ease(clamp((pt - 0.4) / 1.2, 0, 1)));
        P.headY = Math.sin(pt * 1.4) * 0.35;
        face(P, { smile: 1, open: 0.03, tongue: 0.5, lidLo: 0.65, lookX: Math.sin(pt * 1.4) * 0.6, lookY: 0.3 });
      } else if (ph === 'tapote') {
        // la patte du côté du tapotement se lève puis retombe sur l'épaule
        const k = clamp((t - (ctx._tapT ?? -9)) / 0.32, 0, 1);
        const up = Math.sin(k * Math.PI);
        const side = (ctx.tap || 0) % 2;
        crossArms(P, 1, side ? up : 0, side ? 0 : up);
        P.side = (side ? 1 : -1) * 0.03 * up + Math.sin(t * 1.2) * 0.02;
        P.headZ = Math.sin(t * 1.2) * 0.06;
        face(P, { smile: 0.95, lidUp: 0.8, lidLo: 0.8, open: 0 });
      } else {
        crossArms(P, 1);
        P.squash = 0.03 + Math.sin(t * 2) * 0.01;
        P.headZ = 0.15;
        P.headX = -0.05;
        face(P, { smile: 1, lidUp: 0.75, lidLo: 0.95, open: 0.02, tongue: 0.4 });
      }
    },
  },
  // Compter jusqu'à 10 : il respire à chaque mouton (inspire, souffle) et le suit des yeux ; au 10, bravo
  calmeMoutons: {
    pose(t, P, ctx) {
      const pt = since(t, ctx), secs = ctx.secs || 3, u = clamp(pt / secs, 0, 1);
      if (ctx.n === 10 && u > 0.6) {
        const clap = Math.max(0, Math.sin(t * TAU * 2.4));
        P.handR.set(0.07 + clap * 0.16, 0.42, 0.56);
        P.handL.set(-0.07 - clap * 0.16, 0.42, 0.56);
        P.poleR.set(1, -0.8, -0.3);
        P.poleL.set(-1, -0.8, -0.3);
        P.rootY = clap * 0.02;
        face(P, { smile: 1, open: 0.05, tongue: 1, lidLo: 0.8, lookX: 0.4 });
        return;
      }
      const b = Math.sin(u * Math.PI); // inspire puis souffle, une fois par nombre
      P.handR.set(0.2, 0.1 + 0.08 * b, 0.56 + 0.04 * b);
      P.handL.set(-0.2, 0.1 + 0.08 * b, 0.56 + 0.04 * b);
      P.poleR.set(1, -0.6, -0.3);
      P.poleL.set(-1, -0.6, -0.3);
      P.squash = -0.04 * b;
      P.headX = -0.04 - 0.05 * b;
      // il suit le mouton qui saute, et hoche la tête quand il passe la barrière
      P.headY = lerp(0.05, 0.45, ease(u));
      P.headZ = -Math.sin(clamp((u - 0.3) / 0.32, 0, 1) * Math.PI) * 0.08;
      face(P, { smile: 0.9, lidUp: 0.3, lidLo: 0.65, open: u > 0.5 ? 0.02 : 0, round: u > 0.5 ? 0.8 : 0, lookX: lerp(0.1, 0.6, u), lookY: 0.1 });
    },
  },

  // Robot, spaghetti : tout raide par à-coups, puis tout mou qui se balance, puis il respire
  calmeRobot: {
    pose(t, P, ctx) {
      const pt = since(t, ctx), secs = ctx.secs || 5;
      const ph = ctx.phase || 'stiff';
      if (ph === 'stiff') {
        const q = Math.floor(pt / 0.45), qt = (pt % 0.45) / 0.45;
        const snap = 1 - Math.exp(-qt * 14) * Math.cos(qt * 18);
        const A = ROBO[(q + ROBO.length - 1) % ROBO.length], B = ROBO[q % ROBO.length];
        P.handR.lerpVectors(V(...A[0]), V(...B[0]), snap);
        P.handL.lerpVectors(V(...A[1]), V(...B[1]), snap);
        P.poleR.set(1, 0, -1);
        P.poleL.set(-1, 0, -1);
        P.headY = lerp(A[2], B[2], snap);
        P.rootY = Math.max(0, Math.sin(qt * Math.PI)) * 0.012;
        face(P, { smile: 0.25, open: 0.02, wide: 1.2, teeth: 0.6, lidUp: 0, lidLo: 0.2, lookX: 0, lookY: 0 });
      } else if (ph === 'wobbly') {
        // spaghetti : les bras flottent comme des nouilles, il ondule de partout
        const w = (a) => Math.sin(t * 3.4 + a);
        P.handR.set(0.55 + w(0) * 0.12, 0.05 + w(1.2) * 0.18, 0.3 + w(2) * 0.1);
        P.handL.set(-0.55 + w(3) * 0.12, 0.05 + w(4.2) * 0.18, 0.3 + w(5) * 0.1);
        P.poleR.set(1, 0.3, -0.8);
        P.poleL.set(-1, 0.3, -0.8);
        P.side = Math.sin(t * 2.3) * 0.12;
        P.lean = Math.sin(t * 2.3 + 1) * 0.06;
        P.squash = -0.03 + Math.sin(t * 4.6) * 0.02;
        P.headZ = Math.sin(t * 1.9) * 0.25;
        P.headX = 0.1 + Math.sin(t * 2.1) * 0.1;
        P.rootY = Math.abs(Math.sin(t * 3)) * 0.02;
        face(P, { smile: 1, open: 0.04, tongue: 1, lidUp: 0.45, lidLo: 0.9, lookX: Math.sin(t * 1.3) * 0.3 });
      } else {
        // reste un spaghetti et respire : tout calme
        const b = Math.sin((pt / secs) * TAU * 1.4 - Math.PI / 2) * 0.5 + 0.5;
        P.handR.set(0.46, 0.02, 0.3);
        P.handL.set(-0.46, 0.02, 0.3);
        P.squash = -0.04 * b;
        P.headZ = 0.08 + Math.sin(t * 0.8) * 0.04;
        P.side = Math.sin(t * 0.8) * 0.02;
        face(P, { smile: 0.9, lidUp: 0.85, lidLo: 0.7, open: 0 });
      }
    },
  },

  // Presser le citron : un citron dans chaque patte ; il serre très fort (tout tremblant), puis il lâche tout
  calmeCitron: {
    pose(t, P, ctx) {
      const pt = since(t, ctx);
      const ph = ctx.phase || 'squeeze';
      if (ph === 'squeeze') {
        const k = ease(clamp((pt - 0.2) / 0.8, 0, 1));
        const sh = Math.sin(t * 38) * 0.012 * k;
        P.handR.set(0.3 + sh, 0.42, 0.52);
        P.handL.set(-0.3 - sh, 0.42, 0.52);
        P.poleR.set(1, -0.9, -0.1);
        P.poleL.set(-1, -0.9, -0.1);
        P.squash = 0.03 * k;
        P.headX = 0.06 * k;
        P.rootX = sh * 0.6;
        face(P, { lidUp: 0.88 * k + 0.05, lidLo: 0.9, smile: lerp(0.8, 0.15, k), open: 0.025 * k, wide: 1.1 + 0.25 * k, teeth: 0.8 * k, lookY: 0 });
      } else {
        // tout mou : les bras pendent et se balancent, il sourit, les yeux mi-clos
        const k = ease(clamp(pt / 0.6, 0, 1));
        const sw = Math.sin(t * 2.2) * 0.05;
        P.handR.lerpVectors(V(0.3, 0.42, 0.52), V(0.46 + sw, 0.0, 0.32), k);
        P.handL.lerpVectors(V(-0.3, 0.42, 0.52), V(-0.46 + sw, 0.0, 0.32), k);
        P.poleR.set(1, 0.2, -0.6);
        P.poleL.set(-1, 0.2, -0.6);
        P.squash = -0.015 * k;
        P.headZ = Math.sin(t * 1.1) * 0.08;
        P.side = Math.sin(t * 1.1 + 0.5) * 0.03;
        face(P, { lidUp: 0.5, lidLo: 0.85, smile: 1, open: 0.02, tongue: 0.5 }, k);
      }
    },
  },

  // La tortue (à sa droite) : stop, bras croisés et tête rentrée comme dans une carapace, respire, ressort, une idée !
  calmeTortue: {
    pose(t, P, ctx) {
      const pt = since(t, ctx), secs = ctx.secs || 5;
      const ph = ctx.phase || 'stop';
      P.side = wob(t * 0.6) * 0.015;
      if (ph === 'stop') {
        // la patte levée bien droite : stop !
        const k = ease(clamp(pt / 0.5, 0, 1));
        P.handR.lerpVectors(V(0.5, 0.1, 0.22), V(0.42, 0.95, 0.5), k);
        P.poleR.set(1, -1, -0.2);
        P.handL.set(-0.52, 0.02, 0.12);
        P.poleL.set(-1, 0.3, -1);
        P.headY = 0.12;
        face(P, { smile: 0.3, open: 0.03, round: 0.3, lidUp: 0, lidLo: 0.35, lidTilt: 0.15 });
      } else if (ph === 'carapace' || ph === 'respire') {
        const k = ph === 'carapace' ? ease(clamp((pt - 0.3) / 1.5, 0, 1)) : 1;
        crossArms(P, k);
        P.headX = 0.32 * k;
        P.bend = 0.12 * k;
        P.squash = 0.04 * k;
        if (ph === 'respire') P.squash += Math.sin((pt / secs) * TAU - Math.PI / 2) * 0.025;
        face(P, { smile: 0.7, lidUp: lerp(0.1, 1, k), lidLo: 0.6 });
      } else if (ph === 'sort') {
        const k = 1 - ease(clamp((pt - 0.4) / 2, 0, 1));
        crossArms(P, k);
        P.headX = 0.32 * k;
        P.bend = 0.12 * k;
        P.headY = 0.2 * (1 - k);
        face(P, { smile: 1, lidUp: k > 0.5 ? 0.9 : 0.05, lidLo: 0.65, lookX: 0.4 });
      } else {
        // une idée ! la patte en l'air, tout content
        const s = Math.sin(t * TAU * 1.2);
        P.handR.set(0.5, 1.02 + s * 0.04, 0.35);
        P.poleR.set(1, -1, -0.2);
        P.handL.set(-0.52, 0.02, 0.12);
        P.poleL.set(-1, 0.3, -1);
        P.rootY = Math.max(0, s) * 0.04;
        P.headY = 0.2;
        face(P, { smile: 1, open: 0.05, tongue: 1, lidLo: 0.8, lookX: 0.3, lookY: 0.3 });
      }
    },
  },

  // Sentir la fleur (à sa droite), puis souffler la bougie (plus loin à droite)
  calmeFleur: {
    pose(t, P, ctx) {
      const pt = since(t, ctx), secs = ctx.secs || 4, p = clamp(pt / secs, 0, 1);
      const ph = ctx.phase || 'ready';
      P.side = wob(t * 0.6) * 0.02;
      if (ph === 'ready') hello(t, P);
      else if (ph === 'in' || ph === 'hold') {
        // il se penche vers la fleur, les pattes jointes, le nez en l'air, les yeux fermés : hmm !
        const k = ph === 'in' ? ease(p) : 1;
        P.handR.set(0.09, 0.42 + 0.04 * k, 0.58);
        P.handL.set(-0.09, 0.42 + 0.04 * k, 0.58);
        P.poleR.set(1, -0.8, -0.2);
        P.poleL.set(-1, -0.8, -0.2);
        P.lean = -0.07 * k;
        P.headZ = -0.16 * k;
        P.headX = -0.1 * k;
        P.headY = 0.2;
        P.squash = -0.03 * k;
        face(P, { smile: 1, lidUp: 0.1 + 0.8 * k, lidLo: 0.9, open: 0.01 });
        if (ph === 'hold') P.headZ += Math.sin(t * 3) * 0.03;
      } else {
        // il souffle tout doucement vers la bougie
        const b = Math.sin(clamp(p / 0.9, 0, 1) * Math.PI);
        P.handR.set(0.22, 0.12, 0.55);
        P.handL.set(-0.22, 0.12, 0.55);
        P.poleR.set(1, -0.5, -0.3);
        P.poleL.set(-1, -0.5, -0.3);
        P.lean = -0.04 * b;
        P.headY = 0.32;
        P.headX = 0.02;
        P.squash = 0.03 * b;
        face(P, { open: 0.03, round: 1, smile: 0.4, lidUp: 0.1, lidLo: 0.45, lookX: 0.55, lookY: 0 });
      }
    },
  },

  // Le ballon dans le ventre : les pattes sur le ventre qui gonfle, le regard sur le ballon (à sa droite)
  calmeBallon: {
    pose(t, P, ctx) {
      const pt = since(t, ctx), secs = ctx.secs || 4, p = clamp(pt / secs, 0, 1);
      const ph = ctx.phase || 'ready';
      if (ph === 'ready') {
        hello(t, P);
        P.handL.set(-0.26, 0.12, 0.56);
        return;
      }
      const k = ph === 'in' ? ease(p) : ph === 'hold' ? 1 : 1 - ease(clamp(p / 0.9, 0, 1));
      P.squash = -0.11 * k;
      P.handR.set(0.2 + 0.1 * k, 0.08, 0.56 + 0.1 * k);
      P.handL.set(-0.2 - 0.1 * k, 0.08, 0.56 + 0.1 * k);
      P.poleR.set(1, -0.5, -0.3);
      P.poleL.set(-1, -0.5, -0.3);
      P.headX = -0.04 - 0.08 * k;
      P.headY = 0.22;
      P.side = wob(t * 0.6) * 0.02;
      if (ph === 'out') face(P, { open: 0.035, round: 1, smile: 0.4, lidUp: 0.15, lidLo: 0.5, lookX: 0.45, lookY: 0.3 });
      else face(P, { smile: 0.8, lidUp: ph === 'hold' ? 0.6 : 0.25, lidLo: 0.6, lookX: 0.45, lookY: 0.35 });
    },
  },

  // Le souffle du dragon : Pandi respire avec le bébé dragon (à sa droite), puis lui prend la patte
  calmeDragon: {
    pose(t, P, ctx) {
      const pt = since(t, ctx), secs = ctx.secs || 3, p = clamp(pt / secs, 0, 1);
      const ph = ctx.phase || 'ready';
      P.side = wob(t * 0.6) * 0.02;
      if (ph === 'ready') {
        // « doucement, doucement » : les pattes à plat qui descendent, un regard gentil vers le dragon
        const s = Math.sin(t * TAU * 0.55);
        P.handR.set(0.36, 0.3 + s * 0.06, 0.5);
        P.handL.set(-0.36, 0.3 + s * 0.06, 0.5);
        P.poleR.set(1, -0.6, -0.4);
        P.poleL.set(-1, -0.6, -0.4);
        P.headY = 0.28;
        P.headZ = -0.06 + wob(t * 0.5, 1) * 0.04;
        face(P, { smile: 0.55, lidTilt: -0.35, lidLo: 0.55, lookX: 0.45, lookY: -0.05 });
      } else if (ph === 'in') {
        inhale(P, ease(p));
      } else if (ph === 'hold') {
        inhale(P, 1);
        P.squash -= Math.sin(t * 6) * 0.004;
      } else if (ph === 'out') {
        // il souffle tout doucement, les pattes redescendent, et il regarde le feu du dragon
        const k = 1 - ease(clamp(p / 0.9, 0, 1));
        inhale(P, k);
        P.headY = 0.25 * (1 - k);
        face(P, { open: 0.03, round: 1, smile: 0.4, lidUp: 0.1, lidLo: 0.45, lookX: 0.5, lookY: 0.35 });
      } else {
        // c'est fini : il prend la patte du dragon, fait coucou à l'enfant de l'autre patte, et sautille
        const k = ease(clamp(pt / 0.9, 0, 1));
        const w = Math.sin(t * TAU * 1.6);
        P.handR.lerpVectors(V(0.5, 0.1, 0.22), V(0.62, 0.36, 0.5), k);
        P.poleR.set(1, -0.6, -0.3);
        P.handL.lerpVectors(V(-0.5, 0.1, 0.22), V(-0.62, 0.95 + w * 0.03, 0.3 + w * 0.07), k);
        P.poleL.set(-1, -1, -0.3);
        P.side = -0.05 * k;
        P.headY = 0.05 * k;
        P.headZ = -0.1 * k + Math.sin(t * 2.2) * 0.04;
        P.rootY = Math.abs(Math.sin(t * TAU * 0.9)) * 0.03 * k;
        face(P, { smile: 1, open: 0.045, tongue: 0.8, lidUp: 0.12, lidLo: 0.85, lookX: 0, lookY: 0 }, k);
        emit(P, { kind: 'emoji', ch: '💖', rate: 0.6 * k, at: [0.2, 1.65, 0.4], size: 0.2 });
      }
    },
  },
};

export { since, inhale, lerp, gaze };
