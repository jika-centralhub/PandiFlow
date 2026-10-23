// La bulle magique : Pandi souffle une grande bulle irisée qui l'entoure ; elle prend la couleur préférée
// de l'enfant ; trois petits nuages gris grognons viennent la cogner et rebondissent (boing !) sans
// pouvoir entrer ; puis on respire dedans, et des cœurs y flottent.
// ctx : { phase: 'souffle' | 'couleur' | 'protege' | 'respire' | 'amour', step, secs, color }
import { THREE, blob, mesh, joint, lerp, clamp, TAU, ease, memo, occlusion, updateOcc, skin, face, glide, hero, particles } from './kit.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const C = V(0, 1.2, 0.05), R = 1.3;
// les trois nuages : direction d'arrivée et instant du choc (secondes dans l'étape « protège »)
const CLOUDS = [[V(-1, 0.25, 0.3), 0.9], [V(1, 0.45, 0.25), 2.3], [V(0.35, 1, 0.3), 3.7]];

// liseré lumineux de la bulle, de la couleur choisie (plus fort sur les bords)
function rimMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color('#FFFFFF') }, k: { value: 0.5 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 color; uniform float k; varying vec3 vN; varying vec3 vV; void main() { float f = pow(1.0 - abs(dot(vN, vV)), 2.6); gl_FragColor = vec4(color * f * k, f * k); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

function cloud(occ) {
  const g = new THREE.Group();
  const mat = skin(occ, '#9AA0B4', { rough: 0.9, sheen: '#E0E4F0', sheenK: 1 });
  const puff = memo('bulPuff', () => new THREE.SphereGeometry(1, 24, 16));
  [[0, 0, 0, 0.2], [0.18, -0.03, -0.02, 0.15], [-0.18, -0.03, -0.02, 0.15], [0.08, 0.12, -0.03, 0.14], [-0.09, 0.1, -0.04, 0.13]].forEach(([x, y, z, r]) => {
    const m = mesh(puff, mat, [x, y, z]);
    m.scale.setScalar(r);
    g.add(m);
  });
  const f = face(g, occ, { E: { c: [0, 0, 0], r: [0.2, 0.2, 0.2] }, eye: { x: 0.065, y: 0.03, z: 0.165, r: 0.04, iris: '#3A3F55', turn: 0.25 }, lid: mat, mouth: { y: -0.07, k: 0.7, line: '#3A3F55' } });
  return { g, f };
}

export function createBulle() {
  return hero((H) => {
    const occ = occlusion();
    const root = H.root;
    H.shadow.visible = false;
    const bubble = joint('bubble', root, C.toArray());
    const film = new THREE.MeshPhysicalMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.2, roughness: 0.02, metalness: 0, iridescence: 1, iridescenceIOR: 1.33, iridescenceThicknessRange: [180, 680], clearcoat: 1, depthWrite: false, envMapIntensity: 1.4 });
    const ball = new THREE.Mesh(memo('bulSphere', () => new THREE.SphereGeometry(R, 64, 40)), film);
    ball.renderOrder = 9;
    const rim = rimMaterial();
    const rimBall = new THREE.Mesh(memo('bulSphere', () => new THREE.SphereGeometry(R, 64, 40)), rim);
    rimBall.scale.setScalar(1.005);
    rimBall.renderOrder = 10;
    bubble.add(ball, rimBall);
    const clouds = CLOUDS.map(() => {
      const c = cloud(occ);
      c.g.visible = false;
      root.add(c.g);
      return c;
    });
    const spark = particles(90, { additive: true, grow: [0.06, 0.02], drag: 1.5, lift: 0.1, ramp: [[0, 1, 1, 1, 0], [0.1, 1, 0.95, 0.8, 1], [1, 1, 0.8, 0.9, 0]] });
    spark.points.renderOrder = 11;
    root.add(spark.points);
    const kid = new THREE.Color('#FFFFFF');
    const S = { size: 0.05, tint: 0, glow: 0.4, wob: 0 };
    let hits = new Set(), heartAcc = 0, lastHit = -9;
    const burst = (at, n = 18) => {
      for (let i = 0; i < n; i++) spark.spawn(at, V((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6), 0.8, 0.8 + Math.random() * 0.8);
    };
    return {
      parts: { spark },
      set(H, c) {
        if (c.color) kid.set(c.color);
        if (c.phase !== 'protege') hits = new Set();
      },
      update(H, dt, camera) {
        const { ctx, pt, p, time: T } = H;
        const ph = ctx.phase || 'souffle';
        const grown = ph === 'souffle' ? ease(clamp(pt / 3.2, 0, 1)) : 1;
        const tint = ph === 'souffle' ? 0 : 1;
        const glow = ph === 'amour' ? 1 : ph === 'couleur' ? 0.9 : 0.55;
        glide(S, { tint, glow }, dt, 2.5);
        S.size = grown;
        // la bulle grandit depuis les pattes de Pandi jusqu'à l'entourer
        const from = V(0, 1.05, 0.65);
        bubble.position.lerpVectors(from, C, grown);
        const breathe = ph === 'respire' ? Math.sin((pt / (ctx.secs || 8)) * TAU * 2 - Math.PI / 2) * 0.03 : 0;
        S.wob *= Math.exp(-dt * 3);
        const w = S.wob * Math.sin((T - lastHit) * 16);
        bubble.scale.set((0.05 + 0.95 * grown) * (1 + breathe + w * 0.06), (0.05 + 0.95 * grown) * (1 + breathe - w * 0.05), (0.05 + 0.95 * grown) * (1 + breathe + w * 0.04));
        bubble.rotation.y = T * 0.15;
        film.iridescenceThicknessRange = [180 + Math.sin(T * 0.7) * 60, 680 + Math.sin(T * 0.5) * 120];
        film.color.set('#FFFFFF').lerp(kid, S.tint * 0.6);
        rim.uniforms.color.value.set('#FFFFFF').lerp(kid, S.tint);
        rim.uniforms.k.value = S.glow * (0.9 + Math.sin(T * 2) * 0.1) * Math.min(1, grown * 2);
        // les nuages grognons arrivent, cognent la bulle, rebondissent et s'en vont
        clouds.forEach((c, i) => {
          const [dir0, tHit] = CLOUDS[i];
          const dir = dir0.clone().normalize();
          const active = ph === 'protege';
          const u = pt - tHit;
          c.g.visible = active && u > -1.4 && u < 2.2;
          if (!c.g.visible) return;
          const contact = R + 0.2;
          const dist = u < 0 ? lerp(contact, 3.2, ease(clamp(-u / 1.4, 0, 1))) : contact + u * 1.1 + Math.sin(clamp(u / 0.3, 0, 1) * Math.PI) * 0.1;
          c.g.position.copy(C).addScaledVector(dir, dist);
          c.g.position.y += Math.sin(T * 2 + i) * 0.04;
          c.g.scale.setScalar(u > 1.2 ? 1 - ease((u - 1.2) / 1) : 1);
          c.g.lookAt(camera ? camera.position : V(0, 1, 8));
          c.g.rotation.z += Math.sin(T * 3 + i) * 0.1;
          if (u >= 0 && !hits.has(i)) {
            hits.add(i);
            lastHit = T;
            S.wob = 1;
            burst(C.clone().addScaledVector(dir, R));
          }
          c.f.update(dt, u < 0 ? { smile: -0.6, lidUp: 0.3, lidLo: 0.3, lidTilt: 0.8, open: 0, lookX: -dir.x * 0.4 } : u < 0.6 ? { smile: 0, open: 0.05, round: 1, lidUp: 0, lidLo: 0, lidTilt: 0 } : { smile: -0.3, open: 0.02, round: 0, lidUp: 0.5, lidLo: 0.4, lidTilt: -0.6 });
        });
        // des cœurs qui flottent dans la bulle
        if (ph === 'amour' && H.fx) {
          heartAcc += dt * 2;
          if (heartAcc >= 1) {
            heartAcc -= 1;
            const a = Math.random() * TAU;
            H.fx.emoji(root.localToWorld(V(Math.cos(a) * 0.8, 0.5 + Math.random() * 0.6, 0.3 + Math.sin(a) * 0.3)), Math.random() < 0.6 ? '💖' : '✨', { size: 0.2, v: V(0, 0.3, 0) });
          }
        }
        // petites étincelles sur la bulle quand elle prend sa couleur
        if (ph === 'couleur' && Math.random() < dt * 10) burst(C.clone().addScaledVector(V(Math.random() - 0.5, Math.random() - 0.4, 0.7).normalize(), R), 4);
        spark.update(dt, camera);
        if (camera) updateOcc(occ, clouds.map((c) => [c.g, [0, 0, 0], 0.2]), camera);
      },
      dispose() {
        spark.dispose();
        rim.dispose();
      },
    };
  });
}
