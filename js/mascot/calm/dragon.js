// Le bébé dragon du coin calme (le souffle du dragon) : un petit dragon vert tout rond, assis, façon film
// d'animation, construit en code comme Pandi. Il boude, fâché tout rouge ; il gonfle son ventre et ses
// joues en inspirant, crache un feu de plus en plus petit en soufflant, puis se calme et fait un grand
// sourire (et un câlin à Pandi).
// Repère : assis au sol (y = 0), il regarde vers +z, il mesure environ 1,75 unité cornes comprises.
// ctx : { phase: 'ready' | 'in' | 'hold' | 'out' | 'calm', secs, anger (1 très fâché -> 0 calme), next }
import { THREE, blob, mesh, joint, lerp, clamp, TAU, ease, damp, memo, occlusion, updateOcc, scaleBump, bands, skin, lathe, horn, taperTube, slab, eyes, setEyes, blinker, particles } from './kit.js';
import { mouthRig, onEllipsoid, reach, blobTexture } from '../pandi3d.js';

const SKIN = '#6CC85A', BELLY = '#FFE4A0', HORN = '#FFE6B0', SPIKE = '#3C9A4A', FRILL = '#9ADF86', BROW = '#2D6A35', PINK = '#FF8FA8';
const BLUSH = new THREE.Color(PINK), ANGRY = new THREE.Color('#FF3B4E');
const SNOUT = { c: [0, -0.15, 0.29], r: [0.28, 0.185, 0.215] };
const MOUTH = { y: -0.205, k: 1.6 };
const ARM = { L1: 0.2, L2: 0.19 };
const { smoothstep } = THREE.MathUtils;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wob = (t, s = 0) => Math.sin(t * 1.3 + s) * 0.6 + Math.sin(t * 0.71 + s * 2.1) * 0.4;

// Corps en poire, assis : bas aplati, ventre un peu bombé
const bodyGeo = () => blob([0.5, 0.47, 0.44], [64, 48], (x, y, z) => {
  const taper = 1 - 0.2 * smoothstep(y, -0.2, 1);
  let ny = y;
  if (y < -0.72) ny = -0.72 - (-0.72 - y) * 0.4;
  const bulge = z > 0 ? 1 + 0.07 * Math.exp(-(((y + 0.15) / 0.45) ** 2)) : 1;
  return [x * taper, ny, z * taper * bulge];
});
// Tête ronde, joues un peu plus larges vers le bas
const headGeo = () => blob([0.5, 0.43, 0.45], [96, 72], (x, y, z) => {
  const f = 1 - smoothstep(y, -0.6, 0.3);
  return [x * (1 + 0.08 * f), y, z * (1 + 0.03 * f)];
});

function wingShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(0.1, 0.3, 0.44, 0.44);
  s.quadraticCurveTo(0.36, 0.3, 0.42, 0.17);
  s.quadraticCurveTo(0.3, 0.16, 0.28, 0.03);
  s.quadraticCurveTo(0.18, 0.05, 0.12, -0.08);
  s.quadraticCurveTo(0.05, -0.05, 0, 0);
  return s;
}
function frillShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.08);
  s.quadraticCurveTo(0.12, -0.13, 0.2, -0.06);
  s.quadraticCurveTo(0.13, -0.02, 0.23, 0.04);
  s.quadraticCurveTo(0.14, 0.07, 0.19, 0.15);
  s.quadraticCurveTo(0.07, 0.12, 0, 0.08);
  s.lineTo(0, -0.08);
  return s;
}

export function createDragon() {
  const occ = occlusion();
  const skinMat = skin(occ, SKIN, { bump: scaleBump(12, 6), bumpScale: 0.55, sheen: '#E4FFD2' });
  const headMat = skin(occ, SKIN, {
    bump: scaleBump(9, 5), bumpScale: 0.35, sheen: '#E4FFD2',
    patches: [
      { c: [0.3, -0.15, 0.32], r: [0.12, 0.085, 0.2], color: PINK, alpha: 0.5, soft: 0.5 },
      { c: [-0.3, -0.15, 0.32], r: [0.12, 0.085, 0.2], color: PINK, alpha: 0.5, soft: 0.5 },
    ],
  });
  const lidMat = skin(occ, SKIN, { bump: scaleBump(9, 5), bumpScale: 0.35, sheen: '#E4FFD2' });
  const snoutMat = skin(occ, SKIN, { bump: scaleBump(6, 3), bumpScale: 0.25, sheen: '#E4FFD2' });
  const bellyTex = bands(9, BELLY, '#E9C277');
  const bellyMat = skin(occ, BELLY, { map: bellyTex.map, bump: bellyTex.bump, bumpScale: 1.2, rough: 0.6, sheen: '#FFFFFF', sheenK: 0.4 });
  const hornMat = skin(occ, HORN, { rough: 0.42, coat: 0.4, sheenK: 0.3 });
  const spikeMat = skin(occ, SPIKE, { rough: 0.5, coat: 0.3, sheen: '#C8FFB0' });
  const frillMat = skin(occ, FRILL, { rough: 0.5, sheen: '#F0FFE0', sheenK: 0.8 });
  const browMat = skin(occ, BROW, { rough: 0.7, sheenK: 0.2 });
  const darkMat = skin(occ, '#2A5E33', { rough: 0.6, sheenK: 0 });
  const cheekMat = skin(occ, SKIN, { sheen: '#E4FFD2', patches: [{ c: [0, -0.01, 0.07], r: [0.075, 0.055, 0.08], color: PINK, alpha: 0.55, soft: 0.45 }] });

  const root = new THREE.Group();
  root.name = 'dragon';
  const shadow = new THREE.Mesh(
    memo('dShadow', () => new THREE.PlaneGeometry(1.5, 1.25).rotateX(-Math.PI / 2)),
    new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, opacity: 0.36, depthWrite: false, color: '#2A1E3A' }),
  );
  shadow.position.set(0.05, 0.004, 0.05);
  root.add(shadow);
  const base = joint('base', root);

  // assis : grosses cuisses, pieds devant avec trois griffes
  const thighGeo = memo('dThigh', () => blob([0.21, 0.19, 0.27], [32, 24]));
  const footGeo = memo('dFoot', () => blob([0.14, 0.08, 0.2], [32, 20], (x, y, z) => [x, y < 0 ? y * 0.6 : y, z]));
  const claw = horn(0.032, 0.07, 0.25, 14);
  for (const sx of [1, -1]) {
    base.add(mesh(thighGeo, skinMat, [0.3 * sx, 0.19, 0.12], [0, 0.25 * sx, 0]));
    const foot = mesh(footGeo, skinMat, [0.33 * sx, 0.07, 0.38], [0, 0.18 * sx, 0]);
    base.add(foot);
    for (const cx of [-0.075, 0, 0.075]) {
      const c = mesh(claw, hornMat, [cx, 0.0, 0.17], [Math.PI / 2 - 0.15, 0, 0]);
      foot.add(c);
    }
  }

  // la queue, qui s'enroule sur le côté avec ses petites pointes
  const tail = joint('tail', base, [0.1, 0.12, -0.34]);
  const tailT = taperTube([[0, 0, 0], [0.2, -0.05, -0.22], [0.5, -0.07, -0.26], [0.74, -0.05, -0.06], [0.78, 0.02, 0.17], [0.66, 0.1, 0.3]], 0.14, 0.03, 56, 14);
  tail.add(mesh(memo('dTail', () => tailT.geo), skinMat));
  const tip = mesh(memo('dTailTip', () => new THREE.SphereGeometry(0.03, 12, 8)), skinMat, tailT.curve.getPointAt(1).toArray());
  tail.add(tip);
  const tspike = horn(0.045, 0.1, 0, 14);
  [0.25, 0.45, 0.65, 0.82].forEach((u, i) => {
    const p = tailT.curve.getPointAt(u), r = lerp(0.14, 0.03, u ** 0.85);
    const sp = mesh(tspike, spikeMat, [p.x, p.y + r * 0.8, p.z]);
    sp.scale.setScalar(1.1 - i * 0.18);
    tail.add(sp);
  });

  // le buste (il se penche et respire) : corps, ventre à bandes, pointes du dos
  const torso = joint('torso', base, [0, 0.3, 0]);
  const body = mesh(memo('dBody', bodyGeo), skinMat, [0, 0.16, 0]);
  torso.add(body);
  const belly = mesh(memo('dBelly', () => blob([0.33, 0.4, 0.2], [48, 36])), bellyMat, [0, -0.06, 0.28]);
  body.add(belly);
  const bspike = horn(0.06, 0.13, 0, 16);
  [[0.52, -0.3, -0.6, 1], [0.36, -0.4, -1.1, 1.05], [0.18, -0.44, -1.4, 0.95], [0.0, -0.43, -1.7, 0.8]].forEach(([y, z, rx, s]) => {
    const sp = mesh(bspike, spikeMat, [0, y, z], [rx, 0, 0]);
    sp.scale.setScalar(s);
    torso.add(sp);
  });

  // ailes : petite membrane festonnée et son os, qui battent
  const wingGeo = memo('dWing', () => slab(wingShape(), 0.012, 0.008));
  const wingBone = memo('dWingBone', () => taperTube([[0, 0, 0], [0.08, 0.2, 0.01], [0.22, 0.36, 0.01], [0.44, 0.44, 0]], 0.03, 0.012, 24, 10).geo);
  const wings = [1, -1].map((sx) => {
    const pivot = joint('wing', torso, [0.22 * sx, 0.44, -0.3]);
    pivot.scale.x = sx;
    const flap = joint('flap', pivot);
    flap.add(mesh(wingGeo, frillMat), mesh(wingBone, skinMat));
    return { pivot, flap, sx };
  });

  // bras courts et dodus, trois griffes
  const upperGeo = memo('dUpper', () => new THREE.CapsuleGeometry(0.085, ARM.L1, 8, 16).translate(0, -ARM.L1 / 2, 0));
  const foreGeo = memo('dFore', () => new THREE.CapsuleGeometry(0.08, ARM.L2, 8, 16).translate(0, -ARM.L2 / 2, 0));
  const handGeo = memo('dHand', () => blob([0.095, 0.09, 0.085], [24, 18]));
  const hclaw = horn(0.022, 0.05, 0.2, 12);
  const arms = {};
  for (const [side, sx] of [['R', 1], ['L', -1]]) {
    const shoulder = joint(`shoulder${side}`, torso, [0.33 * sx, 0.34, 0.2]);
    const upper = mesh(upperGeo, skinMat);
    shoulder.add(upper);
    const elbow = joint(`elbow${side}`, shoulder, [0, -ARM.L1, 0]);
    const fore = mesh(foreGeo, skinMat);
    elbow.add(fore);
    const hand = joint(`hand${side}`, elbow, [0, -ARM.L2, 0]);
    const paw = mesh(handGeo, skinMat);
    hand.add(paw);
    [-0.045, 0, 0.045].forEach((cx) => hand.add(mesh(hclaw, hornMat, [cx, -0.06, 0.05], [Math.PI * 0.75, 0, 0])));
    arms[side] = { shoulder, upper, elbow, fore, hand, paw, sx, L1: ARM.L1, L2: ARM.L2 };
  }

  // la tête : museau, narines, joues qui gonflent, yeux, sourcils, cornes, collerettes, pointes
  const neck = joint('neck', torso, [0, 0.56, 0.02]);
  const head = joint('head', neck, [0, 0.34, 0.05]);
  const skull = mesh(memo('dHead', headGeo), headMat);
  head.add(skull);
  const snout = mesh(memo('dSnout', () => blob(SNOUT.r, [48, 32])), snoutMat, SNOUT.c);
  head.add(snout);
  const mouth = mouthRig(occ, { surf: (x, y, l) => onEllipsoid(SNOUT, x, y, l), y: MOUTH.y, k: MOUTH.k, line: '#1E4E29' });
  head.add(mouth.group);
  const nostrilGeo = memo('dNostril', () => blob([0.03, 0.019, 0.02], [16, 12]));
  const nostrils = [1, -1].map((sx) => {
    const [x, y, z, n] = onEllipsoid(SNOUT, 0.072 * sx, -0.085, -0.004);
    const m = mesh(nostrilGeo, darkMat, [x, y, z]);
    m.quaternion.setFromUnitVectors(V(0, 0, 1), n);
    head.add(m);
    return m;
  });
  const cheekGeo = memo('dCheek', () => blob([0.1, 0.09, 0.09], [28, 20]));
  const cheeks = [1, -1].map((sx) => {
    const c = mesh(cheekGeo, cheekMat, [0.29 * sx, -0.17, 0.2], [0, 0.55 * sx, 0]);
    head.add(c);
    return c;
  });
  const eyeList = eyes(head, occ, { x: 0.2, y: 0.06, z: 0.31, r: 0.148, iris: '#58AE3A', lid: lidMat, turn: 0.16 });
  const browGeo = memo('dBrow', () => new THREE.CapsuleGeometry(0.03, 0.12, 6, 12).rotateZ(Math.PI / 2));
  const brows = [1, -1].map((sx) => {
    const b = joint('brow', head, [0.2 * sx, 0.245, 0.34]);
    b.rotation.y = 0.35 * sx;
    const m = mesh(browGeo, browMat);
    b.add(m);
    return { b, sx };
  });
  const hornGeo = horn(0.07, 0.26, -0.35, 24);
  for (const sx of [1, -1]) head.add(mesh(hornGeo, hornMat, [0.19 * sx, 0.33, -0.08], [-0.25, 0, -0.38 * sx]));
  const frillGeo = memo('dFrill', () => slab(frillShape(), 0.02, 0.012));
  for (const sx of [1, -1]) {
    const f = joint('frill', head, [0.44 * sx, 0.05, -0.05]);
    f.scale.x = sx;
    f.rotation.y = 0.5 * sx;
    f.add(mesh(frillGeo, frillMat));
  }
  const hspike = horn(0.05, 0.12, 0, 16);
  [[0.43, 0.04, 0.15, 1], [0.4, -0.13, -0.35, 1.15], [0.31, -0.29, -0.85, 0.95]].forEach(([y, z, rx, s]) => {
    const sp = mesh(hspike, spikeMat, [0, y, z], [rx, 0, 0]);
    sp.scale.setScalar(s);
    head.add(sp);
  });

  // le feu et la fumée (la lueur du feu colore le museau : une vraie lumière ferait recompiler toute la scène)
  const fire = particles(130, {
    additive: true, grow: [0.1, 0.46], drag: 2.2, lift: 1.4,
    ramp: [[0, 1, 0.92, 0.62, 0.7], [0.15, 1, 0.68, 0.16, 0.62], [0.42, 1, 0.38, 0.06, 0.5], [0.72, 0.8, 0.13, 0.04, 0.28], [1, 0.3, 0.04, 0.02, 0]],
  });
  const smoke = particles(70, {
    grow: [0.14, 0.6], drag: 1.6, lift: 0.45, order: 6,
    ramp: [[0, 1, 1, 1, 0], [0.1, 0.97, 0.97, 1, 0.92], [0.6, 0.9, 0.9, 0.96, 0.6], [1, 0.82, 0.8, 0.9, 0]],
  });
  root.add(fire.points, smoke.points);
  for (const m of [headMat, snoutMat, cheekMat]) m.emissive.set('#FF7A2A');

  const blink = blinker();
  const S = { b: 0, cheek: 0, flush: 1, brow: 1, browY: 0, turn: 0.3, headX: 0, headZ: 0, headY: 0, lean: 0, spread: 0, fire: 0, hop: 0 };
  const F = { open: 0, smile: -0.6, wide: 1.1, teeth: 0, tongue: 0, round: 0, lidUp: 0.3, lidLo: 0.4, lidTilt: 0.9, lookX: 0, lookY: 0 };
  const hand = { R: V(0.12, 0.28, 0.5), L: V(-0.12, 0.26, 0.46) };
  const pole = { R: V(1, -0.6, -0.4), L: V(-1, -0.6, -0.4) };
  let ctx = { phase: 'ready', secs: 3, anger: 1 };
  let pt = 0, time = 0, fireAcc = 0, smokeAcc = 0, heartAcc = 0, angerAcc = 0;
  let fx = null;
  const _a = V(0, 0, 0), _b = V(0, 0, 0), _q = new THREE.Quaternion(), _c = new THREE.Color();

  function emitFire(dt, rate, power) {
    fireAcc += dt * rate;
    if (fireAcc < 1) return;
    head.updateMatrixWorld(true);
    const from = head.localToWorld(_a.set(0, MOUTH.y - 0.03, 0.56));
    root.worldToLocal(from);
    const dir = _b.set(0, 0.2, 1).normalize().transformDirection(head.matrixWorld);
    _q.copy(root.quaternion).invert();
    dir.applyQuaternion(_q);
    while (fireAcc >= 1) {
      fireAcc -= 1;
      const sp = 0.3 + 0.2 * power;
      const v = dir.clone().multiplyScalar(2.2 + power * 1.8 + Math.random() * 0.5);
      v.x += (Math.random() - 0.5) * sp * 2;
      v.y += (Math.random() - 0.5) * sp * 2;
      v.z += (Math.random() - 0.5) * sp;
      fire.spawn(from, v, 0.3 + power * 0.32 + Math.random() * 0.12, 0.45 + power * 0.75);
    }
  }
  function puff(dt, rate, at, v0, k = 1) {
    smokeAcc += dt * rate;
    while (smokeAcc >= 1) {
      smokeAcc -= 1;
      const v = v0.clone();
      v.x += (Math.random() - 0.5) * 0.25;
      v.z += (Math.random() - 0.5) * 0.15;
      smoke.spawn(at, v, 0.9 + Math.random() * 0.6, k * (0.7 + Math.random() * 0.6));
    }
  }

  return {
    group: root,
    frame: null,
    parts: { fire, smoke },
    attach(actor) {
      fx = actor.fx;
    },
    place(x, z = 0, s = 1) {
      root.position.set(x, 0, z);
      root.scale.setScalar(s);
    },
    set(c) {
      if (c.phase !== ctx.phase || c.cycle !== ctx.cycle) pt = 0;
      ctx = { ...c };
    },
    update(dt, camera) {
      dt = clamp(dt, 0, 0.05);
      time += dt;
      pt += dt;
      const ph = ctx.phase;
      const secs = ctx.secs || 3;
      const p = clamp(pt / secs, 0, 1);
      const a = ctx.anger ?? 1;
      const next = ctx.next ?? Math.max(0, a - 0.25);
      const power = 0.18 + 0.82 * a;
      const T = time;

      // --- la pose voulue pour cette étape ---
      let b = 0, cheek = 0, flush = a, brow = a, browY = 0, turn = 0.3, headX = 0.06, headZ = wob(T * 0.8, 1) * 0.06, headY = 0, lean = 0, spread = 0.1, hop = 0;
      let flapHz = 1.2, flapAmp = 0.05, tailHz = 0.9, tailAmp = 0.12, fireRate = 0, steam = 0;
      const f = { open: 0, smile: -0.7, wide: 1.1, teeth: 0, tongue: 0, round: 0, lidUp: 0.32, lidLo: 0.45, lidTilt: 0.9, lookX: -0.25, lookY: -0.1 };
      hand.R.set(-0.13, 0.27, 0.53);
      hand.L.set(0.13, 0.24, 0.47);
      pole.R.set(1, -0.3, -0.6);
      pole.L.set(-1, -0.3, -0.6);
      if (ph === 'ready') {
        // il boude, les bras croisés, la queue qui fouette, de la fumée qui sort des narines
        headX = 0.1;
        headY = -0.12;
        b = 0.04 + Math.sin(T * 5) * 0.03;
        tailHz = 1.7;
        tailAmp = 0.32;
        steam = 2.4 * a;
        f.lookX = Math.sin(T * 0.9) > 0.3 ? 0.35 : -0.3;
        angerAcc += dt * 0.7 * a;
        if (fx && angerAcc >= 1) {
          angerAcc -= 1;
          head.updateMatrixWorld(true);
          fx.emoji(head.localToWorld(_a.set(0.32, 0.5, 0.1)), '💢', { size: 0.22, v: _b.set(0.05, 0.25, 0), life: 1.2 });
        }
      } else if (ph === 'in' || ph === 'hold') {
        // il prend de l'air : le ventre et les joues gonflent, les ailes s'ouvrent, les pattes sur le ventre
        const k = ph === 'in' ? ease(p) : 1;
        b = k;
        cheek = ph === 'in' ? 0.55 * k : 1;
        headX = -0.14 * k;
        headY = 0;
        turn = 0.22;
        spread = 0.2 + 0.8 * k;
        tailAmp = 0.08;
        flapAmp = 0.03;
        f.smile = -0.35 * a;
        f.lidUp = ph === 'hold' ? 0.82 : 0.4 + 0.25 * k;
        f.lidTilt = 0.6 * a;
        f.lookX = 0.1;
        f.lookY = 0.2;
        hand.R.set(0.22, 0.22 + 0.04 * b, 0.47 + 0.06 * b);
        hand.L.set(-0.22, 0.22 + 0.04 * b, 0.47 + 0.06 * b);
        pole.R.set(1, -0.5, -0.4);
        pole.L.set(-1, -0.5, -0.4);
        if (ph === 'hold') {
          headZ += Math.sin(T * 40) * 0.012; // il tient… tient…
          steam = 1.2 * a;
        }
      } else if (ph === 'out') {
        // il crache le feu vers le ciel ; le feu rapetisse à chaque souffle, puis il fume un peu
        const blow = 1 - ease(clamp((p - 0.82) / 0.18, 0, 1));
        b = 1 - ease(clamp(p / 0.85, 0, 1));
        cheek = 0.15 * blow;
        turn = 0.42;
        headX = -0.16 * blow + Math.sin(T * 30) * 0.01 * blow;
        lean = 0.07 * blow;
        spread = 1;
        flapHz = 5.5;
        flapAmp = 0.14 + 0.16 * power;
        tailHz = 1.4;
        tailAmp = 0.2;
        flush = lerp(a, next, p);
        brow = lerp(a, next, p);
        fireRate = (40 + 90 * power) * blow * ramp01(pt / 0.18);
        f.open = (0.032 + 0.018 * power) * blow;
        f.round = blow;
        f.smile = -0.3 * a;
        f.lidUp = 0.05;
        f.lidLo = 0.2;
        f.lidTilt = 0.4 * a;
        f.lookX = 0.2;
        f.lookY = 0.45;
        hand.R.set(0.46, 0.14, 0.12);
        hand.L.set(-0.46, 0.14, 0.12);
        pole.R.set(1, 0.4, -0.6);
        pole.L.set(-1, 0.4, -0.6);
        if (a < 0.3) steam = 3 * blow;
      } else if (ph === 'calm') {
        // tout calme : grand sourire, yeux rieurs, il se tourne vers Pandi pour un câlin et fait coucou
        const k = ease(clamp(pt / 0.8, 0, 1));
        flush = 0;
        brow = -0.25;
        browY = 0.02;
        turn = lerp(0.3, -0.3, k);
        headX = -0.06;
        headZ = -0.16 * k + Math.sin(T * 2.2) * 0.04;
        hop = Math.abs(Math.sin(T * TAU * 0.9)) * 0.035 * k;
        spread = 0.7;
        flapHz = 3;
        flapAmp = 0.16;
        tailHz = 2.6;
        tailAmp = 0.3;
        f.open = 0.032;
        f.smile = 1;
        f.teeth = 0.35;
        f.tongue = 1;
        f.wide = 1.2;
        f.lidUp = 0.12;
        f.lidLo = 0.92;
        f.lidTilt = -0.15;
        f.lookX = 0;
        f.lookY = 0.05;
        const w = Math.sin(T * TAU * 1.5);
        hand.R.set(0.42, 0.74 + w * 0.03, 0.3 + w * 0.06);
        pole.R.set(1, -1, -0.3);
        hand.L.set(-0.56, 0.42, 0.14);
        pole.L.set(-1, -0.7, -0.3);
        heartAcc += dt * 1.6;
        if (fx && heartAcc >= 1) {
          heartAcc -= 1;
          head.updateMatrixWorld(true);
          fx.emoji(head.localToWorld(_a.set((Math.random() - 0.5) * 0.8, 0.55, 0.2)), Math.random() < 0.5 ? '💚' : '💖', { size: 0.2 });
        }
      }
      if (ph !== 'calm') heartAcc = 0;

      // --- on glisse en douceur vers la pose voulue ---
      const k = damp(7, dt), ks = damp(3.5, dt);
      S.b += (b - S.b) * k;
      S.cheek += (cheek - S.cheek) * damp(ph === 'out' ? 14 : 6, dt);
      S.flush += (flush - S.flush) * ks;
      S.brow += (brow - S.brow) * ks;
      S.browY += (browY - S.browY) * k;
      S.turn += (turn - S.turn) * damp(3, dt);
      S.headX += (headX - S.headX) * k;
      S.headZ += (headZ - S.headZ) * k;
      S.headY += (headY - S.headY) * k;
      S.lean += (lean - S.lean) * k;
      S.spread += (spread - S.spread) * damp(4, dt);
      S.hop += (hop - S.hop) * damp(12, dt);
      for (const key in f) F[key] += (f[key] - F[key]) * damp(key === 'open' || key === 'round' ? 14 : 8, dt);

      // --- corps ---
      base.position.y = S.hop;
      base.rotation.y = S.turn;
      torso.rotation.x = S.lean;
      torso.rotation.z = Math.sin(T * 1.1) * 0.015;
      body.scale.set(1 + 0.06 * S.b, 1 + 0.035 * S.b, 1 + 0.1 * S.b);
      neck.rotation.set(S.headX * 0.4, S.headY * 0.3, S.headZ * 0.3);
      head.rotation.set(S.headX * 0.6, S.headY * 0.7, S.headZ * 0.7);
      for (const c of cheeks) c.scale.setScalar(1 + 0.7 * S.cheek);
      for (const n of nostrils) n.scale.setScalar(1 + 0.45 * Math.max(S.b * (ph === 'in' ? 1 : 0), steam > 0 ? 0.3 : 0));
      // fâché : les joues deviennent toutes rouges (le vert mélangé au rouge ferait kaki)
      for (const c of [...headMat.userData.patchColors.slice(0, 2), ...cheekMat.userData.patchColors]) {
        _c.copy(BLUSH).lerp(ANGRY, S.flush);
        c.set(_c.r, _c.g, _c.b, 0.5 + 0.42 * S.flush);
      }
      for (const br of brows) {
        br.b.position.y = 0.245 - 0.03 * Math.max(0, S.brow) + S.browY;
        br.b.rotation.z = br.sx * 0.5 * S.brow;
      }
      for (const w of wings) {
        w.pivot.rotation.set(0, 0.5 * w.sx, 0);
        w.flap.rotation.set(0, Math.sin(T * TAU * flapHz) * flapAmp, -0.25 + 0.45 * S.spread + Math.sin(T * TAU * flapHz + 1) * flapAmp * 0.6);
      }
      tail.rotation.set(0, Math.sin(T * TAU * tailHz) * tailAmp, Math.sin(T * TAU * tailHz + 1) * tailAmp * 0.25);
      root.updateMatrixWorld(true);
      reach(arms.R, hand.R, pole.R);
      reach(arms.L, hand.L, pole.L);

      // --- visage ---
      const bl = blink(dt);
      setEyes(eyeList, F, ph === 'hold' ? 0 : bl);
      mouth.set(F);

      // --- feu, fumée, lueur ---
      S.fire += (Math.min(1, fireRate / 80) - S.fire) * damp(10, dt);
      if (fireRate > 0) emitFire(dt, fireRate, power);
      else fireAcc = 0;
      if (steam > 0) {
        head.updateMatrixWorld(true);
        for (const n of nostrils) {
          const at = root.worldToLocal(n.getWorldPosition(_a));
          puff(dt, steam * 0.7, at, V(0.12 * Math.sign(n.position.x), 0.45, 0.3), 0.6);
        }
      }
      fire.update(dt, camera);
      smoke.update(dt, camera);
      const glow = S.fire * (0.4 + power * 0.6) * (0.85 + Math.sin(T * 37) * 0.15);
      snoutMat.emissiveIntensity = glow * 0.45;
      headMat.emissiveIntensity = cheekMat.emissiveIntensity = glow * 0.18;

      if (camera) {
        updateOcc(occ, [
          [skull, [0, -0.05, 0], 0.42],
          [body, [0, 0.05, 0], 0.42],
          [arms.R.paw, [0, 0, 0], 0.09],
          [arms.L.paw, [0, 0, 0], 0.09],
          [snout, [0, 0, 0], 0.18],
          [belly, [0, -0.3, 0.05], 0.2],
        ], camera);
      }
    },
    dispose() {
      fire.dispose();
      smoke.dispose();
    },
  };
}

const ramp01 = (x) => ease(clamp(x, 0, 1));
