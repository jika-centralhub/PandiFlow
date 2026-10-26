// Les numéros de Pandi : ce qu'il fait pour chaque tâche (il la fait avec l'enfant), ses réactions
// après la note, et ses humeurs pendant le minuteur.
// Chaque numéro remplit une pose à l'instant t (en secondes) : angles du corps, cibles des mains
// (repère du buste), expression, objets tenus, effets et petits bruits (cue).
// Repères utiles (buste) : épaules (±0,35 ; 0,5 ; 0,06), bouche (0 ; 0,81 ; 0,67), centre de la tête
// (0 ; 1,07 ; 0,05), poitrine (0 ; 0,35 ; 0,5), ventre (0 ; 0,05 ; 0,56). Le sol est 0,52 sous le buste.
import { THREE, neutralFace, lerp, clamp } from './pandi3d.js';

const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const ease = (x) => x * x * (3 - 2 * x);
// 1 entre a et b, avec des bords adoucis sur f secondes
const win = (c, a, b, f = 0.25) => ease(clamp((c - a) / f, 0, 1)) * ease(clamp((b - c) / f, 0, 1));
const ramp = (c, a, b) => ease(clamp((c - a) / (b - a), 0, 1));
const wob = (t, s = 0) => Math.sin(t * 1.3 + s) * 0.6 + Math.sin(t * 0.71 + s * 2.1) * 0.4;
const face = (P, f, w = 1) => {
  for (const k in f) P.face[k] = lerp(P.face[k], f[k], w);
};
const prop = (P, name, spec = {}) => (P.props[name] = { s: 1, ...spec });
const emit = (P, spec) => P.emit.push(spec);
const hideAll = (P, w = 1) => Object.keys(P.hide).forEach((k) => (P.hide[k] = w));

export function basePose() {
  return {
    rootY: 0, rootX: 0, turn: 0, lean: 0,
    bend: 0, side: 0, twist: 0, squash: 0,
    headX: -0.04, headY: 0, headZ: 0,
    handR: V(0.5, 0.1, 0.22), handL: V(-0.5, 0.1, 0.22),
    poleR: V(1, -0.2, -0.7), poleL: V(-1, -0.2, -0.7),
    anchorR: null, anchorL: null, // { bone: 'ankleR' | 'ankleL' | 'head', off: [x, y, z], w }
    legR: 0, legL: 0, toeR: 0, toeL: 0,
    face: neutralFace(),
    brush: 0, contact: V(0, 0, 0), handle: V(0.8, -0.45, 0.4),
    foam: 0, energy: 0.2,
    tuftFlat: 0, tuftScale: 1,
    props: {}, hide: { tete: 0, yeux: 0, cou: 0, dos: 0 }, emit: [],
    cue: null,
  };
}

// Les regards : il fixe un point quelques secondes, puis un autre (toujours un peu vers l'enfant)
function gaze(t, P, seed = 0) {
  const k = Math.floor(t / 2.2 + seed);
  const r = (n) => (Math.sin(k * 12.9898 + n * 78.233) * 43758.5453) % 1;
  P.face.lookX = r(1) * 0.5;
  P.face.lookY = r(2) * 0.25;
}

// Coucou de la patte droite (w : 0 -> 1)
function wave(P, c, w) {
  const s = Math.sin(c * TAU * 1.6);
  P.handR.lerp(V(0.62, 0.95 + s * 0.03, 0.3 + s * 0.07), w);
  P.poleR.lerp(V(1, -1, -0.3), w);
  face(P, { smile: 1, open: 0.035, tongue: 1 }, w);
  P.headZ += 0.08 * w;
}

// Les mains sur les hanches, fier de lui
function proud(P, w = 1) {
  P.handR.lerp(V(0.52, 0.02, 0.12), w);
  P.handL.lerp(V(-0.52, 0.02, 0.12), w);
  P.poleR.lerp(V(1, 0.3, -1), w);
  P.poleL.lerp(V(-1, 0.3, -1), w);
}

export const ACTS = {
  // Il attend, se balance, regarde autour de lui et fait parfois coucou
  idle: {
    pose(t, P) {
      P.side = wob(t * 0.6) * 0.035;
      P.headZ = wob(t * 0.5, 1) * 0.07;
      P.headY = wob(t * 0.35, 2) * 0.16;
      P.headX = -0.05 + wob(t * 0.4, 3) * 0.04;
      gaze(t, P);
      const c = t % 9;
      if (c > 6) wave(P, c, win(c, 6, 9, 0.4));
    },
  },

  // Bonjour ! (écran d'accueil, coin calme) : il fait coucou souvent
  coucou: {
    pose(t, P) {
      ACTS.idle.pose(t, P);
      const c = t % 4;
      if (c > 1.2) wave(P, c, win(c, 1.2, 4, 0.4));
    },
  },

  // Brossage des dents, en suivant les 4 coins de la bouche (un quart du minuteur chacun)
  dents: {
    pose(t, P, ctx) {
      const zone = ctx.zone ?? Math.floor(t / 8) % 4;
      const sx = zone % 2 ? -1 : 1; // 1 : côté droit de sa bouche
      const up = zone < 2;
      const scrub = Math.sin(t * TAU * 4.2);
      P.brush = 1;
      P.energy = 0.6;
      P.foam = 9;
      P.contact.set(0.045 * sx + scrub * 0.028, up ? -0.243 : -0.268, 0.615);
      P.handle.set(0.9, -0.3, sx > 0 ? 0.34 : 0.26).normalize();
      P.poleR.set(1, -0.8, -0.2);
      P.headZ = -0.09 * sx + scrub * 0.012;
      P.headY = -0.1 * sx + wob(t, 4) * 0.04;
      P.headX = up ? -0.1 : 0.07;
      P.side = 0.03 * sx;
      P.squash = Math.abs(Math.sin(t * TAU)) * 0.01;
      // il tape du pied en rythme
      const tap = Math.max(0, Math.sin(t * TAU * 1.6));
      P.toeR = -tap * 0.45;
      P.rootY = tap * 0.008;
      face(P, { open: 0.05, smile: 0.85, wide: 1.12, teeth: 0.9, tongue: 0.5, lidUp: 0.16, lookX: -0.12 * sx, lookY: 0.05 });
      // toutes les 7 s, coup d'œil complice et petit signe de la patte libre
      const c = t % 7;
      const w = c > 5 ? win(c, 5, 7, 0.35) : 0;
      const hi = Math.sin(c * TAU * 1.7);
      P.handL.lerpVectors(V(-0.36, 0.0, 0.42), V(-0.62 + hi * 0.04, 0.8, 0.3 + hi * 0.06), w);
      P.poleL.set(-1, -0.6, -0.4);
      face(P, { lookX: 0, lidLo: 0.75 }, w);
    },
  },

  // Dîner ou petit-déjeuner : le bol dans une patte, la cuillère dans l'autre, et ça mâche !
  manger: {
    pose(t, P, ctx) {
      const c = (t % 3.4) / 3.4;
      P.handL.set(-0.12, 0.2, 0.52);
      P.poleL.set(-1, -0.6, -0.2);
      prop(P, 'bol', { at: 'L', pos: [0.11, 0.06, 0.03], rot: [0.5, 0, 0], variant: ctx.variant === 'cereales' ? 'cereales' : 'soupe' });
      const toMouth = win(c, 0.3, 0.62, 0.12);
      const tip = V(0.0, 0.36, 0.6).lerp(V(0.02, 0.79, 0.7), toMouth);
      tip.x += Math.sin(c * TAU) * 0.02;
      P.handR.copy(tip).add(V(0.24, -0.1, 0.05));
      P.poleR.set(1, -1, -0.2);
      prop(P, 'cuillere', { at: 'R', aim: tip, full: c > 0.18 && c < 0.5 });
      const bite = toMouth > 0.6 && c < 0.52;
      const chew = c > 0.55 && c < 0.95 ? Math.abs(Math.sin((c - 0.55) * TAU * 3.4)) : 0;
      P.headX = lerp(0.2, -0.06, toMouth);
      P.headZ = wob(t, 1) * 0.05;
      P.squash = chew * 0.012;
      face(P, {
        lookY: lerp(-0.6, 0.05, toMouth), lookX: 0,
        open: bite ? 0.075 : chew * 0.026, round: bite ? 0.55 : 0, smile: 0.85,
        lidUp: c > 0.58 && c < 0.92 ? 0.5 : 0.08, lidLo: c > 0.55 ? 0.9 : 0.55,
      });
      // il se frotte le ventre : miam !
      if (c > 0.6 && c < 0.64) P.cue = 'miam';
    },
  },

  // Douche : bonnet de bain et canard, l'éponge qui frotte, des bulles partout, et il s'ébroue
  douche: {
    pose(t, P) {
      hideAll(P);
      prop(P, 'bonnetBain', { at: 'head' });
      const c = t % 6;
      const a = t * TAU * 0.9;
      const onArm = Math.floor(t / 6) % 2;
      const sp = onArm ? V(-0.42 + Math.cos(a) * 0.05, 0.3 + Math.sin(a) * 0.08, 0.42) : V(0.05 + Math.cos(a) * 0.13, 0.12 + Math.sin(a) * 0.1, 0.68);
      P.handR.copy(sp);
      P.poleR.set(1, -0.8, -0.3);
      prop(P, 'eponge', { at: 'R', pos: [-0.02, 0.02, 0.1], rot: [0.2, 0, Math.sin(a) * 0.3] });
      P.handL.set(onArm ? -0.6 : -0.48, onArm ? 0.45 : 0.42, onArm ? 0.28 : 0.34);
      P.poleL.set(-1, -0.5, -0.3);
      // il se dandine en chantonnant
      P.headZ = Math.sin(t * 1.6) * 0.1;
      P.side = Math.sin(t * 1.6 + 0.5) * 0.04;
      face(P, { open: 0.03 + Math.max(0, Math.sin(t * 5)) * 0.02, round: 0.75, smile: 0.6, lidUp: 0.5, lidLo: 0.8, lookY: 0.1 });
      emit(P, { kind: 'bulle', rate: 4, at: sp });
      emit(P, { kind: 'emoji', ch: '🎵', rate: 0.5, at: [0.35, 1.45, 0.35] });
      // il s'ébroue comme un petit chien
      const shake = win(c, 4.6, 5.5, 0.12);
      if (shake > 0) {
        P.turn = Math.sin(t * 42) * 0.22 * shake;
        P.headY = Math.sin(t * 42 + 1) * 0.35 * shake;
        P.headZ += Math.sin(t * 42 + 2) * 0.3 * shake;
        face(P, { lidUp: 0.95, lidLo: 0.9, open: 0.04, round: 0, smile: 1 }, shake);
        emit(P, { kind: 'emoji', ch: '💦', rate: 9 * shake, at: [0, 1.15, 0.2], spread: 0.6, size: 0.16 });
        if (c < 4.7) P.cue = 'splash';
      }
    },
  },

  // Pyjama (ou s'habiller le matin) : il enfile son haut… et reste coincé une seconde !
  habiller: {
    pose(t, P, ctx) {
      const pj = ctx.variant === 'pyjama';
      const c = t % 7.5;
      P.hide.cou = 1;
      P.hide.dos = 1;
      let y = 0, sc = 1, s = 1;
      if (c < 1.1) {
        y = 1.3 + Math.sin(c * 6) * 0.03;
        s = ramp(c, 0, 0.3);
      } else if (c < 2.2) {
        y = 0.8 + Math.sin(c * 22) * 0.02; // coincé sur la tête
        sc = 1.32;
      } else if (c < 2.6) {
        const k = ramp(c, 2.2, 2.6);
        y = lerp(0.8, 0, k);
        sc = lerp(1.32, 1, k);
      } else s = 1 - ramp(c, 6.9, 7.4);
      prop(P, 'haut', { at: 'torso', pos: [0, y, 0], scale: [sc, 1, sc], s, variant: pj ? 'pyjama' : 'tshirt', color: ctx.color });
      const hold = c < 1.1 ? 1 : 0;
      const stuck = win(c, 1.1, 2.25, 0.1);
      if (hold) {
        P.handR.set(0.42, 1.32, 0.3);
        P.handL.set(-0.42, 1.32, 0.3);
        P.poleR.set(1, -1, 0);
        P.poleL.set(-1, -1, 0);
        P.squash = -0.04 * ramp(c, 0.6, 1.0);
        face(P, { open: 0.05, smile: 1, lookY: 0.5, lidLo: 0.5 });
      } else if (stuck > 0.01) {
        const f = Math.sin(c * 14);
        P.handR.set(0.6 + f * 0.06, 1.0 + f * 0.12, 0.25);
        P.handL.set(-0.6 + f * 0.06, 1.0 - f * 0.12, 0.25);
        P.poleR.set(1, -1, 0);
        P.poleL.set(-1, -1, 0);
        P.side = Math.sin(c * 11) * 0.08;
        P.rootY = Math.abs(Math.sin(c * 9)) * 0.04;
        face(P, { open: 0.05, round: 1, smile: 0 });
        if (c < 1.2) P.cue = 'mmf';
      } else {
        // la tête ressort : surprise, puis grand sourire et mains sur les hanches
        const pop = win(c, 2.5, 3.1, 0.12);
        proud(P, ramp(c, 2.6, 3.0));
        P.rootY = pop * 0.08;
        P.squash = pop * 0.04;
        face(P, { open: 0.06 * pop + 0.04, round: 0.6 * pop, smile: 1, lidUp: 0, lidLo: 0.6 * (1 - pop) });
        if (c > 2.55 && c < 2.65) P.cue = 'pop';
        if (pj) {
          // le bonnet de nuit arrive, et un grand bâillement
          const cap = ramp(c, 3.1, 3.5) * (1 - ramp(c, 6.9, 7.4));
          prop(P, 'bonnetNuit', { at: 'head', s: cap });
          P.hide.tete = cap;
          const yawn = win(c, 4.4, 5.6, 0.35);
          face(P, { open: 0.1, round: 1, lidUp: 0.95, lidLo: 0.4 }, yawn);
          P.headX -= 0.18 * yawn;
          if (yawn > 0) {
            P.handL.lerp(V(-0.16, 0.72, 0.62), yawn);
            P.poleL.set(-1, -1, 0);
          }
          if (c > 4.45 && c < 4.55) P.cue = 'baille';
        } else {
          P.headZ = Math.sin(t * 2) * 0.08;
          gaze(t, P);
        }
      }
    },
  },

  // Cartable : le livre et la trousse dans le sac, le sac sur le dos, et en route !
  cartable: {
    pose(t, P, ctx) {
      P.hide.dos = 1;
      const c = t % 6.5;
      const back = ramp(c, 3.4, 4.1);
      const front = V(-0.3, 0.12, 0.66);
      const onBack = V(0, 0.28, -0.52);
      const bag = front.clone().lerp(onBack, back);
      bag.y += Math.sin(Math.PI * back) * 0.55;
      bag.x += Math.sin(Math.PI * back) * -0.35;
      prop(P, 'sac', { at: 'torso', pos: bag.toArray(), rot: [0, lerp(0.35, Math.PI, back), Math.sin(Math.PI * back) * 0.6], color: ctx.color });
      if (back < 0.98) {
        P.handL.copy(bag).add(V(0.02, 0.26, 0));
        P.poleL.set(-1, -0.4, -0.3);
      }
      // le livre (0,3–1,6) puis la trousse (1,8–3,0) passent de la patte droite au sac
      const into = (a, b) => {
        const k = ramp(c, a, b - 0.25);
        return { k, s: ramp(c, a - 0.2, a) * (1 - ramp(c, b - 0.2, b)) };
      };
      const book = into(0.3, 1.6), kit = into(1.8, 3.0);
      const item = c < 1.7 ? book : kit;
      if (c < 3.2) {
        const from = V(0.55, 0.38, 0.38), to = front.clone().add(V(0.02, 0.3, 0));
        const at = from.lerp(to, item.k);
        at.y += Math.sin(Math.PI * item.k) * 0.15;
        P.handR.copy(at);
        P.poleR.set(1, -0.6, -0.3);
        if (c < 1.7) prop(P, 'livre', { at: 'R', pos: [-0.02, 0.1, 0.02], rot: [0, 0, 0.3], s: book.s });
        else prop(P, 'trousse', { at: 'R', pos: [-0.04, 0.05, 0.02], rot: [0, 0, 0.4], s: kit.s });
        face(P, { lookX: -0.35, lookY: -0.45, smile: 0.9 });
        P.headX = 0.12;
        P.headY = -0.15;
      }
      if (c > 3.4 && c < 3.5) P.cue = 'hop';
      P.rootY = win(c, 3.4, 4.2, 0.2) * 0.12;
      if (back > 0.98) {
        // il tient les bretelles et marche sur place, tout fier
        P.handR.set(0.17, 0.45, 0.44);
        P.handL.set(-0.17, 0.45, 0.44);
        P.poleR.set(1, -1, -0.2);
        P.poleL.set(-1, -1, -0.2);
        const step = Math.sin(t * TAU * 1.6);
        P.legR = -Math.max(0, step) * 0.45;
        P.legL = -Math.max(0, -step) * 0.45;
        P.rootY += Math.abs(step) * 0.03;
        P.side = step * 0.04;
        P.turn = 0.75 * ramp(c, 4.1, 4.6) * (1 - ramp(c, 6.1, 6.5));
        P.headY = -0.5 * ramp(c, 4.1, 4.6) * (1 - ramp(c, 6.1, 6.5));
        face(P, { open: 0.04, smile: 1, tongue: 0.5, lidLo: 0.7 });
      }
    },
  },

  // Lecture : lunettes sur le nez, il tourne les pages et réagit à l'histoire
  lecture: {
    pose(t, P) {
      P.hide.yeux = 1;
      prop(P, 'lunettesLecture', { at: 'head' });
      const c = t % 4;
      const turn = win(c, 2.9, 3.75, 0.2);
      P.handL.set(-0.25, 0.36, 0.5);
      P.handR.set(0.25 - turn * 0.18, 0.37 + turn * 0.1, 0.5 + turn * 0.04);
      P.poleR.set(1, -1, -0.2);
      P.poleL.set(-1, -1, -0.2);
      prop(P, 'livreOuvert', { at: 'torso', pos: [0, 0.42, 0.6], rot: [-0.95, 0, 0], flip: ramp(c, 3.0, 3.7) });
      P.headX = 0.2;
      P.headZ = wob(t * 0.5, 2) * 0.05;
      face(P, { lookY: -0.65, lookX: Math.sin(t * 2.4) * 0.35, smile: 0.6, lidLo: 0.4 });
      // la réaction : surpris (une page sur deux) ou fou rire
      const r = win(c, 1.5, 2.6, 0.15);
      if (r > 0) {
        if (Math.floor(t / 4) % 2) {
          face(P, { open: 0.06, round: 0.9, lidUp: 0, lidLo: 0, lookY: -0.2, lookX: 0 }, r);
          P.headX -= 0.18 * r;
          if (c > 1.5 && c < 1.6) P.cue = 'oh';
        } else {
          face(P, { open: 0.055, smile: 1, tongue: 1, lidUp: 0.7, lidLo: 1 }, r);
          P.squash += Math.sin(t * 26) * 0.02 * r;
          P.headX -= 0.1 * r;
          if (c > 1.5 && c < 1.6) P.cue = 'rire';
        }
      }
    },
  },

  // Ranger la chambre : il ramasse ses jouets et les lance dans le coffre, comme au basket
  ranger: {
    frame: 'full',
    pose(t, P) {
      const c = t % 2.6;
      const toy = ['balle', 'cube', 'ours'][Math.floor(t / 2.6) % 3];
      const box = V(-0.95, 0, 0.3);
      const bump = win(c, 2.15, 2.4, 0.06);
      prop(P, 'coffre', { at: 'ground', pos: box.toArray(), rot: [0, 0.55, 0], bump });
      // 0–0,8 il se penche et ramasse ; 0,8–1,3 il se relève et prend son élan ; 1,3 il lance
      const down = win(c, 0.1, 0.8, 0.3);
      P.bend = 0.55 * down;
      P.headX = -0.25 * down;
      const wind = win(c, 0.85, 1.32, 0.2);
      const pick = V(0.38, -0.5, 0.42), windUp = V(0.62, 0.95, -0.05), release = V(0.05, 1.0, 0.55);
      if (c < 0.85) P.handR.lerpVectors(V(0.5, 0.1, 0.22), pick, down);
      else if (c < 1.32) P.handR.lerpVectors(pick, windUp, ramp(c, 0.85, 1.15));
      else P.handR.lerpVectors(windUp, release, ramp(c, 1.32, 1.45)).lerp(V(0.5, 0.1, 0.22), ramp(c, 1.6, 2.1));
      P.poleR.set(1, -0.4, -0.6);
      P.twist = -0.25 * wind + 0.15 * win(c, 1.32, 1.7, 0.1);
      if (c < 1.38) prop(P, toy, { at: 'R', pos: [0, 0.06, 0.06], s: ramp(c, 0.45, 0.6) });
      else {
        // le jouet vole en cloche jusqu'au coffre (repère du sol)
        const k = ramp(c, 1.38, 2.15);
        const from = V(0.0, 1.55, 0.5), to = box.clone().add(V(0, 0.22, 0));
        const at = from.lerp(to, k);
        at.y += Math.sin(Math.PI * k) * 0.45;
        prop(P, toy, { at: 'ground', pos: at.toArray(), rot: [k * 9, k * 6, 0], s: 1 - ramp(c, 2.2, 2.4) });
      }
      P.handL.set(-0.5, 0.12, 0.25);
      face(P, { lookX: c < 1.3 ? 0.3 : -0.5, lookY: c < 0.85 ? -0.6 : 0, smile: 0.9 });
      // panier !
      const yes = win(c, 2.2, 2.6, 0.1);
      if (yes > 0) {
        P.handL.lerp(V(-0.6, 1.0, 0.2), yes);
        P.poleL.set(-1, -1, 0);
        P.rootY = yes * 0.1;
        face(P, { open: 0.07, smile: 1, tongue: 1, lidLo: 0.8 }, yes);
        if (c < 2.3) P.cue = 'panier';
      }
    },
  },

  // Au lit : bonnet de nuit, il serre son oreiller, bâille, pique du nez… et se réveille en sursaut
  dodo: {
    pose(t, P) {
      P.hide.tete = 1;
      P.hide.yeux = 1;
      prop(P, 'bonnetNuit', { at: 'head' });
      P.handR.set(0.2, 0.34, 0.52);
      P.handL.set(-0.2, 0.34, 0.52);
      P.poleR.set(1, -0.7, -0.2);
      P.poleL.set(-1, -0.7, -0.2);
      prop(P, 'oreiller', { at: 'torso', pos: [0, 0.38, 0.64], rot: [0.1, 0, 0.12] });
      const c = t % 8;
      const yawn = win(c, 0.2, 2.0, 0.5);
      const doze = ramp(c, 2.4, 3.6) * (1 - ramp(c, 6.0, 6.15));
      const wake = win(c, 6.0, 6.9, 0.12);
      P.headX = -0.18 * yawn + doze * (0.3 + Math.sin(t * 1.4) * 0.05) - wake * 0.1;
      P.headZ = doze * 0.16 + Math.sin(t * 0.7) * 0.04;
      P.squash = Math.sin(t * 1.3) * 0.02;
      P.side = doze * Math.sin(t * 0.9) * 0.04;
      face(P, { open: 0.1 * yawn, round: yawn, lidUp: Math.max(0.35, yawn * 0.95, doze * 0.9), lidLo: 0.35, smile: 0.6 });
      face(P, { lidUp: 0, lidLo: 0, open: 0.03, round: 0.6 }, wake);
      P.rootY = wake * 0.06;
      emit(P, { kind: 'emoji', ch: '💤', rate: doze * 0.9, at: [0.4, 1.55, 0.3], size: 0.2 });
      if (c > 0.3 && c < 0.4) P.cue = 'baille';
    },
  },

  // Fin de soirée : bonnet de nuit et oreiller, un grand bâillement… et il s'endort pour de bon
  // (sans le réveil en sursaut de « dodo ») : il montre aux enfants que c'est l'heure de dormir
  endormi: {
    pose(t, P) {
      P.hide.tete = 1;
      P.hide.yeux = 1;
      prop(P, 'bonnetNuit', { at: 'head' });
      P.handR.set(0.2, 0.34, 0.52);
      P.handL.set(-0.2, 0.34, 0.52);
      P.poleR.set(1, -0.7, -0.2);
      P.poleL.set(-1, -0.7, -0.2);
      prop(P, 'oreiller', { at: 'torso', pos: [0, 0.38, 0.64], rot: [0.1, 0, 0.12] });
      const yawn = win(t, 0.3, 2.2, 0.5);
      const doze = ramp(t, 2.4, 4.2);
      const breathe = Math.sin(t * 1.1);
      P.headX = -0.18 * yawn + doze * (0.32 + breathe * 0.03);
      P.headZ = doze * 0.18;
      P.squash = breathe * 0.025 * (0.4 + doze);
      P.side = doze * Math.sin(t * 0.5) * 0.02;
      face(P, { open: 0.1 * yawn, round: yawn, lidUp: Math.max(0.35, yawn * 0.95, doze), lidLo: 0.35 + doze * 0.4, smile: 0.6 });
      emit(P, { kind: 'emoji', ch: '💤', rate: doze * 0.6, at: [0.4, 1.55, 0.3], size: 0.2 });
      if (t > 0.4 && t < 0.5) P.cue = 'baille';
    },
  },

  // Se lever : le réveil sonne, il sursaute, s'étire, éteint le réveil et saute « debout ! »
  lever: {
    frame: 'full',
    pose(t, P) {
      const c = t % 6.5;
      const ring = c < 3.3;
      prop(P, 'reveil', { at: 'ground', pos: [-0.72, 0, 0.42], rot: [0, 0.5, 0], ring });
      if (ring) emit(P, { kind: 'emoji', ch: '🔔', rate: 2, at: [-0.72, 0.5, 0.5], space: 'ground', size: 0.16 });
      const jump = win(c, 0, 0.7, 0.15);
      P.rootY = jump * 0.22;
      face(P, { lidUp: 0, lidLo: 0, open: 0.06, round: 1 }, jump);
      if (c < 0.1) P.cue = 'oh';
      // grand étirement en bâillant
      const st = win(c, 0.9, 2.8, 0.4);
      P.handR.lerp(V(0.66, 1.18, 0.26), Math.max(st, jump));
      P.handL.lerp(V(-0.66, 1.18, 0.26), Math.max(st, jump));
      P.poleR.set(1, -1, 0);
      P.poleL.set(-1, -1, 0);
      P.squash -= 0.06 * st;
      P.headX -= 0.2 * st;
      face(P, { open: 0.1, round: 1, lidUp: 0.95, lidLo: 0.5 }, st);
      if (c > 1.0 && c < 1.1) P.cue = 'baille';
      // il tape sur le réveil
      const slap = win(c, 2.9, 3.5, 0.15);
      P.side = 0.22 * slap;
      P.bend = 0.3 * slap;
      P.handL.lerp(V(-0.62, -0.05, 0.5), slap);
      P.poleL.set(-1, 0, -0.5);
      // debout !
      const go = ramp(c, 3.6, 3.9);
      if (go > 0) {
        const b = Math.abs(Math.sin(t * TAU * 1.4));
        P.rootY = b * 0.09 * go;
        P.handR.lerp(V(0.55, 0.9 + b * 0.2, 0.25), go);
        P.handL.lerp(V(-0.55, 0.9 + (1 - b) * 0.2, 0.25), go);
        face(P, { open: 0.06, smile: 1, tongue: 1, lidLo: 0.7, lidUp: 0 }, go);
        if (c > 3.6 && c < 3.7) P.cue = 'hop';
      }
    },
  },

  // Toilettes : on se lave les mains ! Le savon glisse, il le rattrape, puis il secoue ses pattes
  mains: {
    pose(t, P) {
      const c = t % 6;
      const rub = Math.sin(t * TAU * 2.2);
      const rubbing = 1 - win(c, 3.4, 4.6, 0.15) - win(c, 4.8, 6, 0.15);
      P.handR.set(0.07 + rub * 0.05, 0.3, 0.58);
      P.handL.set(-0.07 + rub * 0.05, 0.3 - rub * 0.02, 0.58);
      P.poleR.set(1, -0.8, -0.2);
      P.poleL.set(-1, -0.8, -0.2);
      face(P, { lookY: -0.45, smile: 0.85 });
      P.headX = 0.12;
      if (rubbing > 0.5) emit(P, { kind: 'bulle', rate: 5, at: [0, 0.36, 0.62] });
      // le savon s'échappe vers le haut… et il le rattrape
      const fly = ramp(c, 3.4, 4.3);
      const soap = V(rub * 0.04, 0.32, 0.64);
      if (c > 3.4 && c < 4.6) {
        soap.y += Math.sin(Math.PI * fly) * 0.9;
        P.handR.lerp(V(0.18, 0.62, 0.55), win(c, 3.5, 4.5, 0.2));
        P.handL.lerp(V(-0.18, 0.62, 0.55), win(c, 3.5, 4.5, 0.2));
        face(P, { lookY: 0.6 * Math.sin(Math.PI * fly), open: 0.05, round: 1, lidUp: 0, lidLo: 0 }, win(c, 3.4, 4.4, 0.1));
        if (c < 3.5) P.cue = 'oh';
      }
      prop(P, 'savon', { at: 'torso', pos: soap.toArray(), rot: [0.3, fly * 8, fly * 5], s: 1 - ramp(c, 4.6, 4.8) });
      // il secoue les pattes pour les sécher
      const dry = win(c, 4.8, 6, 0.15);
      if (dry > 0) {
        const f = Math.sin(t * 38);
        P.handR.lerp(V(0.5, 0.45 + f * 0.05, 0.4), dry);
        P.handL.lerp(V(-0.5, 0.45 - f * 0.05, 0.4), dry);
        face(P, { lidUp: 0.8, lidLo: 0.9, open: 0.04, smile: 1, lookY: 0 }, dry);
        emit(P, { kind: 'emoji', ch: '💦', rate: 6 * dry, at: [0, 0.5, 0.4], spread: 0.8, size: 0.14 });
      }
    },
  },

  // Se coiffer : il peigne sa mèche rebelle… qui se redresse à chaque fois, boing !
  coiffer: {
    pose(t, P) {
      P.hide.tete = 1;
      const c = t % 4;
      const combing = c < 2.4;
      const stroke = combing ? Math.sin(c * TAU * 1.25 - Math.PI / 2) * 0.5 + 0.5 : 0;
      P.headZ = -0.3;
      P.headX = 0.05;
      P.handR.lerpVectors(V(0.74, 0.98, 0.32), V(0.64, 1.3, 0.26), combing ? stroke : 0.2);
      P.poleR.set(1, -1, -0.2);
      prop(P, 'peigne', { at: 'R', aim: V(0.22, 1.66, 0.2) });
      P.tuftScale = 1.5;
      P.tuftFlat = combing ? Math.min(1, ramp(c, 0, 0.6) * (0.6 + stroke * 0.4)) : 0;
      P.handL.set(-0.52, 0.02, 0.12);
      P.poleL.set(-1, 0.3, -1);
      face(P, { lookY: 0.45, lookX: 0.25, smile: 0.7 });
      // boing ! la mèche se redresse : il boude, puis il éclate de rire
      const grr = win(c, 2.45, 3.2, 0.12), lol = win(c, 3.2, 4, 0.12);
      face(P, { lidTilt: 0.7, lidUp: 0.4, smile: -0.4, lookY: 0.8, lookX: 0 }, grr);
      face(P, { open: 0.06, smile: 1, tongue: 1, lidUp: 0.6, lidLo: 1 }, lol);
      P.squash += Math.sin(t * 24) * 0.018 * lol;
      if (c > 2.4 && c < 2.5) P.cue = 'boing';
    },
  },

  // Chaussures : il enfile une basket en sautillant sur un pied, puis l'autre, et tape des pieds
  chaussures: {
    frame: 'full',
    pose(t, P, ctx) {
      const c = t % 7.2;
      const vanish = 1 - ramp(c, 6.8, 7.15);
      for (const [side, a] of [['R', 0], ['L', 3]]) {
        const k = c - a;
        const lift = win(k, 0.2, 2.8, 0.4);
        const on = ramp(k, 1.4, 2.3);
        if (c > a) {
          P[`leg${side}`] = -0.85 * lift;
          P.bend = Math.max(P.bend, 0.4 * lift);
          P.rootY = Math.max(P.rootY, Math.abs(Math.sin(t * TAU * 2.2)) * 0.045 * lift);
          P.anchorR = lift > 0.01 ? { bone: `ankle${side}`, off: [0.13, 0.12, 0.26 - on * 0.12], w: lift } : P.anchorR;
          P.anchorL = lift > 0.01 ? { bone: `ankle${side}`, off: [-0.13, 0.12, 0.26 - on * 0.12], w: lift } : P.anchorL;
          if (lift > 0.05) face(P, { lookY: -0.7, lookX: side === 'R' ? 0.3 : -0.3, open: 0.02, smile: 0.5 }, lift);
        }
        prop(P, `basket${side}`, { model: 'basket', at: `ankle${side}`, pos: [0, (1 - on) * 0.12, 0.06 + (1 - on) * 0.3], s: (c > a + 0.2 ? ramp(k, 0.2, 0.5) : 0) * vanish, color: ctx.color });
      }
      // les deux sont mises : il tape des pieds, tout content
      const stomp = ramp(c, 6.0, 6.2) * vanish;
      if (stomp > 0) {
        const s = Math.sin(t * TAU * 2.4);
        P.legR = -Math.max(0, s) * 0.35 * stomp;
        P.legL = -Math.max(0, -s) * 0.35 * stomp;
        proud(P, stomp);
        face(P, { open: 0.05, smile: 1, tongue: 1, lidLo: 0.8 }, stomp);
        if (c > 6.0 && c < 6.1) P.cue = 'tada';
      }
    },
  },

  // Tâche inventée par les parents : il brandit une pancarte avec l'emoji et encourage l'enfant
  pancarte: {
    pose(t, P, ctx) {
      prop(P, 'pancarte', { at: 'R', rot: [0, 0, Math.PI / 2 + Math.sin(t * 2.5) * 0.15], emoji: ctx.emoji || '⭐' });
      P.handR.set(0.5, 0.72 + Math.sin(t * 5) * 0.04, 0.32);
      P.poleR.set(1, -1, 0);
      const pump = Math.max(0, Math.sin(t * TAU));
      P.handL.set(-0.5, 0.45 + pump * 0.4, 0.32);
      P.poleL.set(-1, -1, 0);
      P.rootY = pump * 0.05;
      P.headZ = Math.sin(t * 2.5) * 0.08;
      face(P, { open: 0.05, smile: 1, tongue: 0.6, lidLo: 0.7 });
    },
  },

  // --- Réactions après la note ---

  // Bravo ! sauts de joie, bras en l'air, sourire jusqu'aux oreilles
  bravo: {
    pose(t, P) {
      const c = (t % 0.9) / 0.9;
      // 0–0,25 : il s'écrase (élan) ; 0,25–0,8 : saut ; 0,8–1 : atterrissage
      const air = c > 0.25 && c < 0.8 ? Math.sin(((c - 0.25) / 0.55) * Math.PI) : 0;
      const crouch = c < 0.25 ? Math.sin((c / 0.25) * Math.PI) : c > 0.8 ? Math.sin(((c - 0.8) / 0.2) * Math.PI) * 0.7 : 0;
      P.rootY = air * 0.32;
      P.squash = -crouch * 0.09 + air * 0.05;
      P.energy = 1;
      P.headX = -0.12 + crouch * 0.1;
      P.headZ = Math.sin(t * 3.4) * 0.12;
      P.handR.set(0.6, 1.05 + air * 0.12, 0.2);
      P.handL.set(-0.6, 1.05 + air * 0.12, 0.2);
      P.poleR.set(1, -1, 0);
      P.poleL.set(-1, -1, 0);
      P.legR = -air * 0.3;
      P.legL = -air * 0.3;
      face(P, { open: 0.07, smile: 1, wide: 1.12, teeth: 0.45, tongue: 1, lidUp: 0.1, lidLo: 0.8 });
      if (t < 0.1) P.cue = 'rire';
      emit(P, { kind: 'emoji', ch: '⭐', rate: 2.5, at: [0, 1.6, 0.3], spread: 0.9, size: 0.18 });
    },
  },

  // Pas mal ! il applaudit et hoche la tête pour encourager
  ok: {
    pose(t, P) {
      const clap = Math.max(0, Math.sin(t * TAU * 2.4));
      P.handR.set(0.07 + clap * 0.16, 0.42, 0.56);
      P.handL.set(-0.07 - clap * 0.16, 0.42, 0.56);
      P.poleR.set(1, -0.8, -0.3);
      P.poleL.set(-1, -0.8, -0.3);
      P.headX = Math.sin(t * TAU * 1.2) * 0.12;
      P.rootY = clap * 0.015;
      face(P, { smile: 0.95, open: 0.03, lidLo: 0.75 });
      if (t < 0.1) P.cue = 'clap';
    },
  },

  // Raté : un gros câlin, « demain on y arrive »
  calin: {
    pose(t, P) {
      const c = t % 3.2;
      const close = ramp(c, 0.3, 1.3) * (1 - ramp(c, 2.5, 3.1));
      const a = V(0.62, 0.55, 0.45), b = V(0.2, 0.46, 0.62);
      P.handR.lerpVectors(a, b, close);
      P.handL.lerpVectors(a.clone().setX(-a.x), b.clone().setX(-b.x), close);
      P.poleR.set(1, -0.8, -0.3);
      P.poleL.set(-1, -0.8, -0.3);
      P.headZ = 0.2 * close;
      P.squash = close * 0.03;
      face(P, { lidUp: 0.15 + close * 0.8, lidLo: 0.6, smile: 0.75, lidTilt: -0.4 });
      emit(P, { kind: 'emoji', ch: '💖', rate: 0.9, at: [0.1, 1.6, 0.45], size: 0.2 });
      if (t < 0.1) P.cue = 'oh';
    },
  },

  // Triste (pandi retirés) : tête basse, bras ballants, sourcils inquiets
  triste: {
    pose(t, P) {
      P.headX = 0.26;
      P.headZ = Math.sin(t * 0.8) * 0.05;
      P.side = Math.sin(t * 0.8) * 0.03;
      P.squash = -0.03;
      P.handR.set(0.45, -0.06, 0.24);
      P.handL.set(-0.45, -0.06, 0.24);
      face(P, { smile: -0.9, lidUp: 0.42, lidLo: 0.15, lidTilt: -0.8, lookY: -0.4, lookX: 0 });
      emit(P, { kind: 'emoji', ch: '💧', rate: 0.35, at: [0.28, 1.08, 0.62], size: 0.12, v: [0.05, -0.25, 0.1] });
    },
  },

  // --- Humeurs du minuteur ---

  // Plus que quelques secondes : il panique, les pattes sur les joues
  panique: {
    pose(t, P) {
      P.rootX = Math.sin(t * 30) * 0.02;
      const s = Math.sin(t * TAU * 4);
      P.legR = -Math.max(0, s) * 0.3;
      P.legL = -Math.max(0, -s) * 0.3;
      P.anchorR = { bone: 'head', off: [0.5, -0.18, 0.3], w: 1 };
      P.anchorL = { bone: 'head', off: [-0.5, -0.18, 0.3], w: 1 };
      P.poleR.set(1, -1, 0);
      P.poleL.set(-1, -1, 0);
      face(P, { open: 0.07, round: 1, lidUp: 0, lidLo: 0 });
      emit(P, { kind: 'emoji', ch: '❗', rate: 1.5, at: [0.45, 1.75, 0.2], size: 0.2 });
    },
  },

  // Le temps est passé : il saute en agitant les bras
  alarme: {
    pose(t, P) {
      const b = Math.abs(Math.sin(t * TAU * 1.6));
      P.rootY = b * 0.2;
      P.squash = (b - 0.5) * 0.06;
      const w = Math.sin(t * TAU * 3);
      P.handR.set(0.6, 1.05 + w * 0.1, 0.3);
      P.handL.set(-0.6, 1.05 - w * 0.1, 0.3);
      P.poleR.set(1, -1, 0);
      P.poleL.set(-1, -1, 0);
      face(P, { open: 0.08, round: 0.4, smile: 0.3, lidUp: 0, lidLo: 0 });
      emit(P, { kind: 'emoji', ch: '⏰', rate: 1.2, at: [0, 1.75, 0.3], spread: 0.8, size: 0.2 });
    },
  },

  // Minuteur en pause : il pique un petit somme debout
  sieste: {
    pose(t, P) {
      P.headX = 0.28 + Math.sin(t * 1.2) * 0.05;
      P.headZ = 0.14;
      P.squash = Math.sin(t * 1.2) * 0.02;
      face(P, { lidUp: 1, lidLo: 0.4, open: 0.015, round: 1, smile: 0.5 });
      emit(P, { kind: 'emoji', ch: '💤', rate: 0.8, at: [0.4, 1.55, 0.3], size: 0.2 });
    },
  },
};

export { actForTask } from './tasks.js';
// pour les numéros du coin calme (js/mascot/calm/acts.js)
export { V, TAU, win, ramp, wob, face, prop, emit, gaze, wave, proud };
