// Le câlin papillon : un grand papillon aux ailes bleu-violet irisées, avec un petit visage. Il arrive
// en voletant autour de Pandi, puis bat des ailes à chaque tapotement (une épaule, puis l'autre), et
// finit posé sur les pattes croisées de Pandi, avec des cœurs.
// ctx : { phase: 'croise' | 'tapote' | 'amour', step, secs, tap (nombre de tapotements) }
import { THREE, blob, mesh, joint, lerp, clamp, TAU, ease, memo, occlusion, updateOcc, skin, taperTube, slab, face, glide, hero, toLocal } from './kit.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function wingTex(top) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(0, 128, 10, 0, 128, 260);
  r.addColorStop(0, top ? '#7FE3FF' : '#FFB3E6');
  r.addColorStop(0.45, top ? '#5B7CFF' : '#C77DFF');
  r.addColorStop(0.85, top ? '#7A3CE0' : '#7A3CE0');
  r.addColorStop(1, '#3A1A70');
  g.fillStyle = r;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(255,255,255,.9)';
  (top ? [[170, 70, 14], [200, 110, 10], [150, 40, 8]] : [[150, 190, 12], [110, 215, 8]]).forEach(([x, y, s]) => {
    g.beginPath();
    g.arc(x, y, s, 0, TAU);
    g.fill();
  });
  g.strokeStyle = 'rgba(40,20,90,.35)';
  g.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.moveTo(0, 128);
    g.quadraticCurveTo(80, 128 - (i - 2) * 30, 230, 128 - (i - 2) * 70);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// Les ailes, dans le plan (x vers l'extérieur, y vers le haut), charnière en (0, 0)
function upperWing() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.08, 0.32, 0.36, 0.46, 0.5, 0.34);
  s.bezierCurveTo(0.56, 0.2, 0.42, 0.06, 0.02, -0.02);
  return s;
}
function lowerWing() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.01);
  s.bezierCurveTo(0.3, -0.02, 0.42, -0.2, 0.3, -0.34);
  s.bezierCurveTo(0.18, -0.4, 0.04, -0.2, 0, -0.01);
  return s;
}
// UV des ailes : la forme est dans [0 ; 0,56] x [-0,42 ; 0,48]
function wingGeo(shape) {
  const g = slab(shape, 0.008, 0.005);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 0.56, (p.getY(i) + 0.42) / 0.9);
  return g;
}

export function createPapillon() {
  return hero((H) => {
    const occ = occlusion();
    const root = H.root;
    H.shadow.visible = false;
    const fly = joint('fly', root, [0.9, 1.5, 0.4]);
    const bodyMat = skin(occ, '#4B2E7A', { rough: 0.6, sheen: '#C8B0FF', sheenK: 1 });
    const thorax = mesh(memo('pThorax', () => blob([0.06, 0.07, 0.06], [20, 16])), bodyMat);
    fly.add(thorax);
    fly.add(mesh(memo('pAbdo', () => new THREE.CapsuleGeometry(0.04, 0.16, 6, 12)), bodyMat, [0, -0.13, -0.01]));
    const head = joint('head', fly, [0, 0.1, 0.02]);
    const HE = { c: [0, 0, 0], r: [0.065, 0.06, 0.06] };
    const headMat = skin(occ, '#6A48A8', { rough: 0.55, sheen: '#E0D0FF', sheenK: 0.8, patches: [
      { c: [0.04, -0.02, 0.045], r: [0.015, 0.012, 0.02], color: '#FF8FC8', alpha: 0.6, soft: 0.5 },
      { c: [-0.04, -0.02, 0.045], r: [0.015, 0.012, 0.02], color: '#FF8FC8', alpha: 0.6, soft: 0.5 },
    ] });
    head.add(mesh(memo('pHead', () => blob(HE.r, [24, 18])), headMat));
    const pFace = face(head, occ, { E: HE, eye: { x: 0.026, y: 0.012, z: 0.042, r: 0.024, iris: '#3B2A6E', turn: 0.25 }, lid: headMat, mouth: { y: -0.025, k: 0.38, line: '#2A1640' } });
    const antMat = skin(occ, '#2E1A50', { rough: 0.6 });
    [1, -1].forEach((sx) => {
      const a = taperTube([[0, 0.04, 0], [0.03 * sx, 0.12, 0.02], [0.07 * sx, 0.17, 0.03]], 0.008, 0.005, 12, 6);
      head.add(mesh(a.geo, antMat));
      head.add(mesh(memo('pAntBall', () => new THREE.SphereGeometry(0.018, 10, 8)), skin(occ, '#FFD23F', { rough: 0.4 }), a.curve.getPointAt(1).toArray()));
    });
    const wingMat = (top) => {
      const m = new THREE.MeshPhysicalMaterial({ map: wingTex(top), roughness: 0.4, sheen: 0.6, sheenColor: new THREE.Color('#FFFFFF'), iridescence: 0.7, iridescenceIOR: 1.4, iridescenceThicknessRange: [200, 500], clearcoat: 0.4 });
      return m;
    };
    const mTop = wingMat(true), mLow = wingMat(false);
    const gTop = memo('pWingTop', () => wingGeo(upperWing())), gLow = memo('pWingLow', () => wingGeo(lowerWing()));
    const wings = [1, -1].map((sx) => {
      const hinge = joint('wing', fly, [0.02 * sx, 0.0, -0.01]);
      hinge.scale.x = sx;
      hinge.add(mesh(gTop, mTop), mesh(gLow, mLow));
      return { hinge, sx };
    });

    const S = { x: 0.9, y: 1.5, z: 0.4, flap: 0 };
    let tapT = -9;
    const _a = V(0, 0, 0);
    let heartAcc = 0;
    return {
      set(H, c, prev) {
        if (c.tap !== prev.tap) tapT = H.time;
      },
      update(H, dt, camera) {
        const { ctx, pt, time: T } = H;
        const ph = ctx.phase || 'croise';
        let x, y, z, flap, turn = 0, roll = 0;
        if (ph === 'croise') {
          // il arrive en voletant et fait le tour de Pandi
          const a = pt * 1.4;
          x = Math.cos(a) * 1.05;
          z = 0.2 + Math.sin(a) * 0.75;
          y = 1.7 + Math.sin(pt * 2.6) * 0.12;
          flap = 0.5 + 0.5 * Math.sin(T * TAU * 6);
          turn = -a + Math.PI;
          roll = Math.sin(pt * 2.6) * 0.2;
        } else if (ph === 'tapote') {
          // il plane à côté de Pandi et bat des ailes à chaque tapotement
          x = 0.8 + Math.sin(T * 0.7) * 0.05;
          y = 1.55 + Math.sin(T * 1.3) * 0.05;
          z = 0.35;
          const k = clamp((T - tapT) / 0.4, 0, 1);
          flap = 0.15 + 0.85 * Math.sin(k * Math.PI);
          turn = -0.5;
        } else {
          // posé sur les pattes croisées de Pandi, les ailes qui s'ouvrent tout doucement
          const top = H.actor ? toLocal(root, H.actor.rig.torso, [0.02, 0.66, 0.66], _a) : V(0, 1.2, 0.6);
          const k = ease(clamp(pt / 1.6, 0, 1));
          x = lerp(0.8, top.x, k);
          y = lerp(1.55, top.y, k) + Math.sin(k * Math.PI) * 0.25;
          z = lerp(0.35, top.z, k);
          flap = k < 1 ? 0.5 + 0.5 * Math.sin(T * TAU * 5) : 0.35 + 0.35 * Math.sin(T * 1.6);
          turn = -0.3;
          heartAcc += dt * 1.1 * k;
          if (H.fx && heartAcc >= 1) {
            heartAcc -= 1;
            H.fx.emoji(root.localToWorld(V(x + (Math.random() - 0.5) * 0.6, y + 0.2, z)), '💖', { size: 0.2 });
          }
        }
        glide(S, { x, y, z }, dt, ph === 'croise' ? 9 : 4);
        S.flap = flap;
        fly.position.set(S.x, S.y, S.z);
        fly.rotation.set(0.25, turn, roll);
        wings.forEach((w) => (w.hinge.rotation.y = S.flap * 1.25 * w.sx)); // les ailes se referment vers l'arrière
        pFace.update(dt, ph === 'amour' ? { smile: 1, lidUp: 0.6, lidLo: 0.9, open: 0.02, tongue: 0.5 } : { smile: 1, open: 0.03, tongue: 0.6, lidUp: 0.05, lidLo: 0.6, lookX: -0.3 });
        if (camera) updateOcc(occ, [[thorax, [0, 0, 0], 0.07]], camera);
      },
    };
  });
}
