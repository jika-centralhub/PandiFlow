// Robot, spaghetti : un petit robot tout rond (écran-visage aux yeux lumineux, antenne, cœur qui
// brille). « Robot ! » : il bouge tout raide, par à-coups ; « Spaghetti ! » : ses bras deviennent des
// nouilles et tout son corps se balance, tout mou ; à la fin il respire tranquillement.
// ctx : { phase: 'stiff' | 'wobbly' | 'breathe', step, secs }
import { THREE, blob, mesh, joint, lerp, clamp, TAU, ease, memo, occlusion, updateOcc, skin, glide, hero } from './kit.js';
import { heartShape } from '../gear.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rbox = (w, h, d, e = 0.3) => blob([w, h, d], [28, 20], (x, y, z) => [x, y, z].map((v) => Math.sign(v) * Math.abs(v) ** e));
const SEG = 5, SL = 0.085;
// les poses du robot, une toutes les 0,45 s : [bras droit (avant, côté), bras gauche, tête]
const ROBOT = [[[0, 0.1], [0, 0.1], 0], [[1.5, 0.1], [0, 0.1], 0.35], [[1.5, 0.1], [1.5, 0.1], 0], [[0, 1.5], [0, 1.5], -0.35], [[3, 0], [0, 0.1], 0.35], [[0, 0.1], [3, 0], -0.35]];

export function createRobot() {
  return hero((H) => {
    const occ = occlusion();
    const root = H.root;
    H.shadow.scale.set(0.9, 1, 0.7);
    const metal = skin(occ, '#D6E9F7', { rough: 0.3, coat: 0.8, sheen: '#FFFFFF', sheenK: 0.2 });
    metal.metalness = 0.25;
    const accent = skin(occ, '#5FA8E8', { rough: 0.35, coat: 0.7, sheenK: 0.1 });
    accent.metalness = 0.2;
    const dark = skin(occ, '#1B2433', { rough: 0.15, coat: 1, sheenK: 0 });
    const glow = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
    const eyeMat = glow('#6FF3FF'), heartMat = glow('#FF5C8A'), bulbMat = glow('#FFD84A');

    // pieds, jambes à ressort, corps, cœur lumineux
    const hips = joint('hips', root, [0, 0.3, 0]);
    const feet = [1, -1].map((sx) => {
      const f = mesh(memo('rFoot', () => rbox(0.1, 0.05, 0.14)), accent, [0.14 * sx, 0.05, 0.04]);
      root.add(f);
      return f;
    });
    const legGeo = memo('rLeg', () => new THREE.CylinderGeometry(0.04, 0.04, 0.24, 12).translate(0, -0.12, 0));
    const legs = [1, -1].map((sx) => {
      const l = mesh(legGeo, metal, [0.14 * sx, 0, 0]);
      hips.add(l);
      return l;
    });
    const torso = joint('torso', hips, [0, 0.0, 0]);
    const body = mesh(memo('rBody', () => rbox(0.27, 0.27, 0.21, 0.4)), metal, [0, 0.27, 0]);
    torso.add(body);
    torso.add(mesh(memo('rBelt', () => new THREE.TorusGeometry(0.25, 0.025, 10, 40).rotateX(Math.PI / 2).scale(1.05, 1, 0.82)), accent, [0, 0.1, 0]));
    const heart = mesh(memo('rHeart', () => new THREE.ShapeGeometry(heartShape(0.9)).translate(0, 0.01, 0)), heartMat, [0, 0.33, 0.215]);
    torso.add(heart);
    const bolts = [1, -1].map((sx) => mesh(memo('rBolt', () => new THREE.CylinderGeometry(0.05, 0.05, 0.05, 16).rotateZ(Math.PI / 2)), accent, [0.28 * sx, 0.42, 0]));
    bolts.forEach((b) => torso.add(b));

    // la tête : écran sombre, yeux et bouche lumineux, oreilles-boulons, antenne
    const neck = joint('neck', torso, [0, 0.56, 0]);
    neck.add(mesh(memo('rNeck', () => new THREE.CylinderGeometry(0.06, 0.07, 0.08, 12)), accent, [0, 0.02, 0]));
    const head = joint('head', neck, [0, 0.2, 0]);
    head.add(mesh(memo('rHead', () => rbox(0.25, 0.19, 0.2, 0.35)), metal));
    const screen = mesh(memo('rScreen', () => rbox(0.205, 0.14, 0.04, 0.35)), dark, [0, 0, 0.175]);
    head.add(screen);
    const eyeGeo = memo('rEye', () => new THREE.SphereGeometry(0.035, 16, 12).scale(1, 1.25, 0.35));
    const arcGeo = memo('rArc', () => new THREE.TorusGeometry(0.03, 0.009, 6, 16, Math.PI));
    const eyesR = [1, -1].map((sx) => {
      const g = joint('eye', head, [0.075 * sx, 0.025, 0.215]);
      const dot = mesh(eyeGeo, eyeMat);
      const arc = mesh(arcGeo, eyeMat);
      g.add(dot, arc);
      return { g, dot, arc };
    });
    const mouthSmile = mesh(memo('rSmile', () => new THREE.TorusGeometry(0.045, 0.009, 6, 20, Math.PI).rotateZ(Math.PI)), eyeMat, [0, -0.035, 0.215]);
    const mouthFlat = mesh(memo('rFlat', () => new THREE.CapsuleGeometry(0.008, 0.07, 4, 8).rotateZ(Math.PI / 2)), eyeMat, [0, -0.045, 0.215]);
    head.add(mouthSmile, mouthFlat);
    [1, -1].forEach((sx) => head.add(mesh(memo('rEar', () => new THREE.CylinderGeometry(0.05, 0.05, 0.06, 16).rotateZ(Math.PI / 2)), accent, [0.27 * sx, 0, 0])));
    const antenna = joint('antenna', head, [0, 0.19, 0]);
    const rod = joint('rod', antenna);
    rod.add(mesh(memo('rRod', () => new THREE.CylinderGeometry(0.01, 0.012, 0.16, 8).translate(0, 0.08, 0)), dark));
    const bulb = mesh(memo('rBulb', () => new THREE.SphereGeometry(0.04, 16, 12)), bulbMat, [0, 0.18, 0]);
    rod.add(bulb);

    // bras en chaînette : tout droits pour le robot, ondulants pour le spaghetti
    const segGeo = memo('rSeg', () => new THREE.CapsuleGeometry(0.042, SL - 0.02, 6, 12).translate(0, -SL / 2, 0));
    const mitt = memo('rMitt', () => blob([0.06, 0.06, 0.055], [16, 12]));
    const arms = [1, -1].map((sx) => {
      const sh = joint('shoulder', torso, [0.3 * sx, 0.43, 0]);
      let parent = sh;
      const segs = [];
      for (let i = 0; i < SEG; i++) {
        const j = joint('seg', parent, i ? [0, -SL, 0] : [0, 0, 0]);
        j.add(mesh(segGeo, i % 2 ? accent : metal));
        segs.push(j);
        parent = j;
      }
      const hand = mesh(mitt, accent, [0, -SL - 0.03, 0]);
      parent.add(hand);
      return { sh, segs, sx, hand };
    });

    const S = { stiff: 1, wobbly: 0, calm: 0, fa: 0, sa: 0.1, fb: 0, sb: 0.1, hy: 0 };
    return {
      update(H, dt, camera) {
        const { ctx, pt, time: T } = H;
        const ph = ctx.phase || 'stiff';
        const st = ph === 'stiff' ? 1 : 0, wb = ph === 'wobbly' ? 1 : 0, cm = ph === 'breathe' ? 1 : 0;
        // le robot passe d'une pose à l'autre d'un coup sec (avec un petit rebond)
        const q = Math.floor(pt / 0.45), qt = (pt % 0.45) / 0.45;
        const R = ROBOT[q % ROBOT.length];
        const snap = 1 - Math.exp(-qt * 14) * Math.cos(qt * 18);
        glide(S, { stiff: st, wobbly: wb, calm: cm }, dt, 6);
        if (st) {
          const P0 = ROBOT[(q + ROBOT.length - 1) % ROBOT.length];
          S.fa = lerp(P0[0][0], R[0][0], snap);
          S.sa = lerp(P0[0][1], R[0][1], snap);
          S.fb = lerp(P0[1][0], R[1][0], snap);
          S.sb = lerp(P0[1][1], R[1][1], snap);
          S.hy = lerp(P0[2], R[2], snap);
        } else {
          glide(S, { fa: wb ? 0.3 : 0.15, sa: wb ? 0.5 : 0.15, fb: wb ? 0.3 : 0.15, sb: wb ? 0.5 : 0.15, hy: 0 }, dt, 3);
        }
        const wob = S.wobbly;
        // corps : raide (à-coups) ou en spaghetti (balancement)
        hips.position.y = 0.3 - 0.05 * wob + Math.abs(Math.sin(T * 3)) * 0.03 * wob + (st ? Math.max(0, Math.sin(qt * Math.PI)) * 0.015 : 0);
        torso.rotation.set(Math.sin(T * 1.7) * 0.08 * wob, 0, Math.sin(T * 2.3) * 0.2 * wob);
        hips.rotation.z = Math.sin(T * 2.3 + 1) * 0.08 * wob;
        legs.forEach((l, i) => (l.scale.y = 1 - 0.18 * wob + Math.sin(T * 3 + i) * 0.04 * wob));
        neck.rotation.set(Math.sin(T * 2.1) * 0.2 * wob + 0.15 * S.calm, S.hy, Math.sin(T * 1.9) * 0.3 * wob);
        head.rotation.z = Math.sin(T * 2.6) * 0.15 * wob;
        rod.rotation.set(Math.sin(T * 5) * 0.4 * wob + Math.sin(T * 9) * 0.05, 0, Math.sin(T * 4) * 0.5 * wob + (st ? (snap - 1) * 0.3 : 0));
        arms.forEach((A, k) => {
          const fwd = k ? S.fb : S.fa, side = k ? S.sb : S.sa;
          A.sh.rotation.set(-fwd, 0, side * A.sx);
          A.segs.forEach((j, i) => {
            if (i === 0) return;
            const wave = Math.sin(T * 4.2 - i * 0.9 + k * 1.3) * 0.55 * wob;
            j.rotation.set(Math.sin(T * 3.1 - i * 0.8 + k) * 0.35 * wob, 0, wave * A.sx);
          });
        });
        // écran : yeux carrés tout raides, yeux rieurs en spaghetti, yeux mi-clos pour respirer
        const blinkK = Math.sin(T * 0.9) > 0.985 ? 0.1 : 1;
        eyesR.forEach((e) => {
          e.dot.visible = S.wobbly < 0.5;
          e.arc.visible = !e.dot.visible;
          e.dot.scale.set(1, (st ? 0.8 : lerp(1, 0.25, S.calm)) * blinkK, 1);
          e.g.position.y = 0.025 + Math.sin(T * 3) * 0.004 * wob;
        });
        mouthFlat.visible = S.stiff > 0.5;
        mouthSmile.visible = !mouthFlat.visible;
        const pulse = 0.5 + 0.5 * Math.sin((pt / (ctx.secs || 5)) * TAU * (cm ? 1 : 2.5));
        heart.scale.setScalar(1 + 0.15 * pulse);
        heartMat.color.set('#FF5C8A').multiplyScalar(0.7 + 0.5 * pulse);
        bulbMat.color.set(st ? (Math.floor(pt * 4) % 2 ? '#FF4A4A' : '#FFD84A') : wob > 0.5 ? '#7CFF8A' : '#9AD8FF');
        feet.forEach((f, i) => (f.rotation.z = Math.sin(T * 3 + i * 2) * 0.1 * wob));
        if (camera) updateOcc(occ, [[body, [0, 0, 0], 0.25], [head, [0, 0, 0], 0.2]], camera);
      },
    };
  }, { shadow: [0.9, 0.7] });
}
