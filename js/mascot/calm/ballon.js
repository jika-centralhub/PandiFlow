// Le ballon dans le ventre : un ballon rouge tout brillant avec un visage, attaché à un petit cube en
// bois. Il gonfle quand on inspire, retient son air (les yeux plissés), puis se dégonfle doucement en
// soufflant de petites bouffées d'air.
// ctx : { phase: 'ready' | 'in' | 'hold' | 'out', secs }
import { THREE, blob, mesh, joint, lerp, clamp, ease, memo, occlusion, updateOcc, skin, face, glide, hero, particles, toLocal } from './kit.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const R = [0.38, 0.43, 0.38];
const UP = V(0, 1, 0);

export function createBallon() {
  return hero((H) => {
    const occ = occlusion();
    const root = H.root;
    H.shadow.scale.set(0.8, 1, 0.6);
    H.shadow.position.set(-0.2, 0.004, 0.1);

    // le petit cube en bois qui retient le ballon
    const woodMat = skin(occ, '#F2B661', { rough: 0.7, sheen: '#FFF2D8', sheenK: 0.4 });
    const block = mesh(memo('bBlock', () => blob([0.11, 0.11, 0.11], [20, 16], (x, y, z) => [x, y, z].map((v) => Math.sign(v) * Math.abs(v) ** 0.35))), woodMat, [-0.2, 0.11, 0.1]);
    block.rotation.y = 0.4;
    root.add(block);

    // le ballon : une goutte brillante, son nœud, son visage
    const float = joint('float', root, [0, 1.35, 0]);
    const body = joint('body', float);
    const latex = skin(occ, '#FF4A5A', { rough: 0.2, coat: 1, sheen: '#FFC8D0', sheenK: 0.3, patches: [
      { c: [0.2, -0.08, 0.3], r: [0.07, 0.05, 0.08], color: '#FF8FA8', alpha: 0.55, soft: 0.5 },
      { c: [-0.2, -0.08, 0.3], r: [0.07, 0.05, 0.08], color: '#FF8FA8', alpha: 0.55, soft: 0.5 },
    ] });
    latex.clearcoatRoughness = 0.08;
    const ball = mesh(memo('bBall', () => blob(R, [56, 40], (x, y, z) => {
      const k = 1 - 0.28 * Math.max(0, -y) ** 1.6; // plus étroit en bas
      return [x * k, y, z * k];
    })), latex);
    body.add(ball);
    const knot = joint('knot', body, [0, -R[1] - 0.01, 0]);
    knot.add(mesh(memo('bKnot', () => new THREE.ConeGeometry(0.05, 0.07, 16).rotateX(Math.PI)), latex));
    knot.add(mesh(memo('bKnotRing', () => new THREE.TorusGeometry(0.03, 0.014, 8, 20).rotateX(Math.PI / 2)), latex, [0, -0.04, 0]));
    const E = { c: [0, 0, 0], r: R };
    const bFace = face(body, occ, { E, eye: { x: 0.12, y: 0.09, z: 0.32, r: 0.07, iris: '#3F6FD8', turn: 0.2 }, lid: latex, mouth: { y: -0.1, k: 1.25, line: '#7A1E2A' } });

    // la ficelle : de petits bouts de fil posés sur une courbe qui suit le ballon
    const N = 14;
    const thread = skin(occ, '#FFFFFF', { rough: 0.7, sheenK: 0.3 });
    const seg = memo('bSeg', () => new THREE.CylinderGeometry(0.007, 0.007, 1, 6).translate(0, 0.5, 0));
    const bits = Array.from({ length: N }, () => {
      const m = mesh(seg, thread);
      root.add(m);
      return m;
    });
    const curve = new THREE.QuadraticBezierCurve3(V(0, 0, 0), V(0, 0, 0), V(0, 0, 0));

    const puffs = particles(50, { grow: [0.05, 0.2], drag: 1.6, lift: 0.1, ramp: [[0, 1, 1, 1, 0], [0.15, 0.96, 0.98, 1, 0.55], [1, 0.9, 0.95, 1, 0]] });
    root.add(puffs.points);
    const S = { b: 0.2, lift: 0, spin: 0 };
    let acc = 0;
    const _a = V(0, 0, 0), _b = V(0, 0, 0), _c = V(0, 0, 0), _q = new THREE.Quaternion();
    return {
      parts: { puffs },
      update(H, dt, camera) {
        const { ctx, p, time: T } = H;
        const ph = ctx.phase || 'ready';
        let b = 0.2, lift = 0, puff = 0;
        const f = { smile: 0.95, open: 0.03, tongue: 0.6, lidUp: 0.08, lidLo: 0.6, lookX: -0.3, lookY: -0.1, round: 0 };
        if (ph === 'in') {
          b = 0.2 + 0.8 * ease(p);
          lift = 0.12 * ease(p);
          Object.assign(f, { open: 0, tongue: 0, smile: 0.7, lidUp: 0, lidLo: 0.3, lookY: 0.2 });
        } else if (ph === 'hold') {
          b = 1;
          lift = 0.12;
          Object.assign(f, { open: 0, tongue: 0, smile: 0.6, lidUp: 0.8, lidLo: 0.8 });
        } else if (ph === 'out') {
          const k = ease(clamp(p / 0.9, 0, 1));
          b = 1 - 0.8 * k;
          lift = 0.12 * (1 - k);
          puff = Math.sin(clamp(p / 0.9, 0, 1) * Math.PI);
          Object.assign(f, { open: 0.04, round: 1, tongue: 0, smile: 0.5, lidUp: 0.02, lidLo: 0.45, lookX: -0.2 });
        }
        glide(S, { b, lift }, dt, 5);
        const s = lerp(0.6, 1.12, S.b);
        body.scale.set(s, s * (1 + 0.04 * Math.sin(T * 2.3)), s);
        float.position.set(Math.sin(T * 0.7) * 0.05, 1.2 + S.lift + Math.sin(T * 1.2) * 0.04 + s * 0.12, Math.sin(T * 0.5) * 0.03);
        float.rotation.set(Math.sin(T * 0.8) * 0.04, -0.25 + Math.sin(T * 0.6) * 0.1, Math.sin(T * 1.1) * 0.06 + (ph === 'out' ? Math.sin(T * 7) * 0.04 * puff : 0));
        if (ph === 'hold') body.position.x = Math.sin(T * 40) * 0.006;
        else body.position.x = 0;
        bFace.update(dt, f, { noBlink: ph === 'hold' });
        // l'air qui sort de la bouche
        acc += dt * 18 * puff;
        if (acc >= 1) {
          body.updateWorldMatrix(true, false);
          const from = root.worldToLocal(body.localToWorld(_a.set(0, -0.12, 0.42)));
          const dir = _b.set(0, -0.05, 1).transformDirection(body.matrixWorld).multiplyScalar(0.9);
          while (acc >= 1) {
            acc -= 1;
            puffs.spawn(from, _c.copy(dir).add(V((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.2, 0)), 0.8, 0.8);
          }
        }
        puffs.update(dt, camera);
        // la ficelle, du nœud au cube
        const top = toLocal(root, knot, [0, -0.06, 0], _a);
        const bottom = _b.set(-0.2, 0.22, 0.1);
        curve.v0.copy(top);
        curve.v2.copy(bottom);
        curve.v1.set(lerp(top.x, bottom.x, 0.5) + 0.12 + Math.sin(T * 1.3) * 0.05, lerp(top.y, bottom.y, 0.5), lerp(top.z, bottom.z, 0.5));
        for (let i = 0; i < N; i++) {
          const a = curve.getPoint(i / N, _c), c = curve.getPoint((i + 1) / N);
          const d = c.clone().sub(a);
          bits[i].position.copy(a);
          bits[i].scale.set(1, d.length() + 0.002, 1);
          bits[i].quaternion.copy(_q.setFromUnitVectors(UP, d.normalize()));
        }
        if (camera) updateOcc(occ, [[ball, [0, 0, 0], 0.36 * s], [block, [0, 0, 0], 0.1]], camera);
      },
      dispose() {
        puffs.dispose();
      },
    };
  }, { shadow: [0.8, 0.6] });
}
