/* Scene 3: close-up of one oar stroke at dawn, driven by scroll. */
import * as THREE from 'three';
import { View, TAU, lerp, clamp, seg, rand, lowPower } from './core.js';
import { toon, outline, canvasTex, glowTexture } from './toon.js';

export function createStroke(host) {
  const v = new View(host);
  const { scene, camera } = v;
  camera.fov = 50; camera.near = 0.05; camera.updateProjectionMatrix();
  const CAM = new THREE.Vector3(-0.25, 0.5, 1.45);
  camera.position.copy(CAM);

  /* ---------- colours: dusk (bar) → dawn (Oregon) ---------- */
  const C = (h) => new THREE.Color(h);
  const DUSK = { top: C(0x24121c), hor: C(0xe0703a), deep: C(0x1a1016), mid: C(0x5a2a2a), fog: C(0x6a3026) };
  const DAWN = { top: C(0x8fc3d8), hor: C(0xf4e3c6), deep: C(0x2a5a66), mid: C(0x5f9aa2), fog: C(0xdfe9e2) };
  const cur = { top: C(0), hor: C(0), deep: C(0), mid: C(0), fog: C(0) };

  /* ---------- sky ---------- */
  const skyU = { uTop: { value: cur.top }, uHor: { value: cur.hor } };
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(80, 32, 16), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uTop; uniform vec3 uHor; varying vec3 vP;
      void main(){ float h = normalize(vP).y; vec3 c = mix(uHor, uTop, smoothstep(0.0, 0.5, h));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`
  })));

  /* ---------- distant shoreline of firs (foreshadows Oregon) ---------- */
  const shoreTex = (seed, density) => canvasTex(1024, 256, (c, w, h) => {
    c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) c.lineTo(x, h - 30 - Math.sin(x * 0.006 + seed) * 10);
    c.lineTo(w, h); c.fill();
    for (let i = 0; i < density; i++) {
      const x = rand(0, w), base = h - 30 - Math.sin(x * 0.006 + seed) * 10 + 6, th = rand(35, 90), tw = th * 0.28;
      c.beginPath(); c.moveTo(x, base - th);
      for (let k = 1; k <= 6; k++) { const yy = base - th + (th * k) / 6; const ww = tw * (k / 6); c.lineTo(x + ww, yy); c.lineTo(x + ww * 0.55, yy); }
      for (let k = 6; k >= 1; k--) { const yy = base - th + (th * k) / 6; const ww = tw * (k / 6); c.lineTo(x - ww * 0.55, yy); c.lineTo(x - ww, yy); }
      c.closePath(); c.fill();
    }
  });
  const shoreMats = [];
  [[-34, 70, 0.55, 1.2, 110], [-22, 46, 0.8, 3.4, 140]].forEach(([z, w, shade, seed, dens]) => {
    const mat = new THREE.MeshBasicMaterial({ map: shoreTex(seed, dens), transparent: true, depthWrite: false, fog: false });
    mat.userData.shade = shade;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), mat);
    m.position.set(0, w / 8 - 1.6, z);
    scene.add(m);
    shoreMats.push(mat);
  });

  /* ---------- water ---------- */
  const rings = [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, -1, 0));
  const waterU = {
    uTime: { value: 0 }, uDeep: { value: cur.deep }, uMid: { value: cur.mid }, uSky: { value: cur.hor },
    uFoam: { value: C(0xfff8ee) }, uCam: { value: camera.position }, uRings: { value: rings },
    uBlade: { value: new THREE.Vector3(9, 0, 9) }, uChurn: { value: 0 }, uFog: { value: cur.fog }
  };
  const waterGeo = new THREE.PlaneGeometry(70, 70, lowPower ? 120 : 200, lowPower ? 120 : 200);
  waterGeo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(waterGeo, new THREE.ShaderMaterial({
    uniforms: waterU,
    vertexShader: `uniform float uTime; varying vec3 vW; varying float vH;
      float wave(vec2 p){ return sin(p.x*0.9 + uTime*1.1)*0.045 + sin(p.y*1.4 - uTime*0.8)*0.035 + sin((p.x+p.y)*2.6 + uTime*1.9)*0.014 + sin((p.x-p.y*0.7)*5.1 - uTime*2.3)*0.006; }
      void main(){ vec3 p = position; float h = wave(p.xz); p.y += h; vH = h;
        vec4 w = modelMatrix * vec4(p,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uDeep; uniform vec3 uMid; uniform vec3 uSky; uniform vec3 uFoam; uniform vec3 uCam; uniform vec3 uFog;
      uniform vec4 uRings[4]; uniform vec3 uBlade; uniform float uChurn; uniform float uTime;
      varying vec3 vW; varying float vH;
      void main(){
        vec3 V = normalize(uCam - vW);
        float fres = pow(1.0 - max(V.y, 0.0), 3.0);
        float dist0 = length(uCam.xz - vW.xz);
        vec3 col = mix(uDeep, uMid, smoothstep(1.0, 14.0, dist0) * 0.8 + smoothstep(-0.04, 0.06, vH) * 0.25);
        col = mix(col, uSky, clamp(fres * 0.85, 0.0, 1.0));
        // painted highlight streaks on the wave crests
        float streak = sin(vW.x * 2.3 + sin(vW.z * 7.0) * 0.8 + uTime * 0.6) * sin(vW.z * 46.0 + vW.x * 3.0 + uTime * 0.5);
        float glint = step(0.9, streak) * step(0.025, vH) * 0.5;
        float foam = 0.0;
        for (int i = 0; i < 4; i++) {
          vec4 r = uRings[i];
          if (r.z < 0.0) continue;
          float d = length((vW.xz - r.xy) * vec2(1.0, 1.6));
          float ring = 1.0 - smoothstep(0.0, 0.05 + r.z * 0.05, abs(d - r.z));
          float swirl = (1.0 - smoothstep(0.0, r.z * 0.8, d)) * 0.55 * (0.5 + 0.5 * sin(atan(vW.z - r.y, vW.x - r.x) * 3.0 + d * 14.0 - uTime * 2.0));
          foam += (ring + swirl) * r.w;
        }
        float db = length((vW.xz - uBlade.xz) * vec2(0.55, 1.5));
        foam += (1.0 - smoothstep(0.08, 0.5, db)) * uChurn * 1.4;
        float n = sin(vW.x * 23.0 + uTime * 2.0) * sin(vW.z * 19.0 - uTime * 1.7);
        foam = smoothstep(0.38, 0.55, foam + n * 0.18);
        col = mix(col, mix(col, uSky, 0.7) + 0.08, glint);
        col = mix(col, uFoam, foam);
        float dist = length(uCam - vW);
        col = mix(col, uFog, smoothstep(6.0, 34.0, dist));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`
  }));
  scene.add(water);

  /* ---------- boat side, rigger, oar ---------- */
  scene.add(new THREE.HemisphereLight(0xffe2c0, 0x2a3a40, 1.4));
  const sun = new THREE.DirectionalLight(0xffd2a0, 2.2); sun.position.set(-2, 3, -4); scene.add(sun);

  const hull = outline(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 7, 1, 1, 12), toon(0xf6f1e6)), 0.01);
  hull.position.set(-1.55, 0.05, 0.6); hull.rotation.y = 0.06;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.305, 0.03, 7), toon(0xb3342a)); stripe.position.y = 0.035; hull.add(stripe);
  scene.add(hull);
  const PIN = new THREE.Vector3(1.1, 1.45, 0.95);
  const placeBetween = (m, a, b) => {
    const d = b.clone().sub(a); const L = d.length();
    m.position.copy(a).addScaledVector(d, 0.5);
    m.scale.set(1, L, 1);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  };

  const shaft = outline(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 1, 12), toon(0xf4efe6)), 0.008);
  scene.add(shaft);
  const oar = new THREE.Group(); scene.add(oar);
  const feather = new THREE.Group(); oar.add(feather);
  const bs = new THREE.Shape();
  bs.moveTo(0, -0.03); bs.lineTo(0.12, -0.08); bs.quadraticCurveTo(0.42, -0.14, 0.56, -0.1);
  bs.quadraticCurveTo(0.6, 0.0, 0.56, 0.12); bs.quadraticCurveTo(0.4, 0.15, 0.12, 0.07); bs.lineTo(0, 0.03); bs.closePath();
  const bladeGeo = new THREE.ExtrudeGeometry(bs, { depth: 0.02, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 1, curveSegments: 16 });
  bladeGeo.translate(0, 0, -0.01);
  const blade = outline(new THREE.Mesh(bladeGeo, toon(0xb3342a)), 0.008);
  feather.add(blade);
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.25, 0.024), toon(0xf3e3c7)); tip.position.set(0.44, 0.01, 0); feather.add(tip);

  /* ---------- spray ---------- */
  const N = lowPower ? 300 : 600, glow = glowTexture();
  const sp = new Float32Array(N * 3).fill(-100), vel = new Float32Array(N * 3), life = new Float32Array(N);
  const sprayGeo = new THREE.BufferGeometry(); sprayGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sprayGeo, new THREE.PointsMaterial({ size: 0.05, map: glow, color: 0xffffff, transparent: true, depthWrite: false })));
  let next = 0;
  const emit = (pos, n, spread, up) => {
    for (let k = 0; k < n; k++) {
      const i = next = (next + 1) % N;
      sp.set([pos.x + rand(-spread, spread), pos.y, pos.z + rand(-spread, spread) * 0.5], i * 3);
      vel.set([rand(-0.8, 0.8), rand(up * 0.5, up), rand(-0.4, 0.6)], i * 3);
      life[i] = rand(0.6, 1.3);
    }
  };

  /* ---------- scroll-driven stroke ---------- */
  let target = 0, p = 0, lastP = 0, ringIdx = 0;
  v.setProgress = x => { target = x; };
  const bladeAt = new THREE.Vector3();
  const tmpD = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), basis = new THREE.Matrix4();

  function stroke(p) {
    // returns blade centre position + feather angle
    let x, y, z = -0.35, f = 0, churn = 0;
    if (p < 0.15) { x = lerp(2.6, 1.3, seg(p, 0, 0.12)); y = 0.42; f = 1 - seg(p, 0.07, 0.15); }
    else if (p < 0.22) { x = 1.3; y = lerp(0.42, 0.04, seg(p, 0.15, 0.21)); churn = seg(p, 0.18, 0.22); }
    else if (p < 0.55) { const d = seg(p, 0.22, 0.55); x = lerp(1.3, -1.25, d); y = 0.04; z = -0.35 + Math.sin(d * Math.PI) * 0.3; churn = 1; }
    else if (p < 0.63) { x = -1.25; y = lerp(0.04, 0.42, seg(p, 0.55, 0.62)); f = seg(p, 0.58, 0.63); churn = 1 - seg(p, 0.55, 0.6); }
    else { const d = seg(p, 0.63, 0.85); x = lerp(-1.25, -2.8, d); y = lerp(0.42, 0.95, d); f = 1; }
    return { x, y, z, f, churn };
  }

  v.update = (time, dt, rdt) => {
    p = lerp(p, target, 1 - Math.exp(-rdt * 7));
    const s = stroke(p);
    bladeAt.set(s.x, s.y, s.z);

    // orient: shaft runs from the pin to the blade root, blade continues outward
    tmpD.copy(bladeAt).sub(PIN).normalize();
    const root = bladeAt.clone().addScaledVector(tmpD, -0.28);
    placeBetween(shaft, PIN, root);
    const zA = new THREE.Vector3().crossVectors(tmpD, up).normalize();
    const yA = new THREE.Vector3().crossVectors(zA, tmpD).normalize();
    basis.makeBasis(tmpD, yA, zA);
    oar.position.copy(root);
    oar.quaternion.setFromRotationMatrix(basis);
    feather.rotation.x = s.f * Math.PI / 2;

    // splash events (forward scroll only)
    if (lastP < 0.2 && p >= 0.2) {
      emit(bladeAt, 140, 0.25, 2.2);
      rings[ringIdx % 4].set(bladeAt.x, bladeAt.z, 0.05, 1); ringIdx++;
    }
    if (p > 0.22 && p < 0.55 && p > lastP) emit(new THREE.Vector3(s.x - 0.25, 0.0, s.z), Math.ceil((p - lastP) * 900), 0.12, 1.2);
    if (lastP < 0.56 && p >= 0.56) {
      rings[ringIdx % 4].set(bladeAt.x, bladeAt.z, 0.08, 1); ringIdx++;
      emit(bladeAt, 80, 0.2, 0.6);
    }
    lastP = p;
    rings.forEach(r => { if (r.z >= 0) { r.z += rdt * 0.35; r.w = Math.max(0, r.w - rdt * 0.12); r.x += rdt * 0.4; if (r.w <= 0) r.z = -1; } });

    for (let i = 0; i < N; i++) {
      if (life[i] <= 0) continue;
      life[i] -= rdt;
      vel[i * 3 + 1] -= 6.5 * rdt;
      sp[i * 3] += vel[i * 3] * rdt; sp[i * 3 + 1] += vel[i * 3 + 1] * rdt; sp[i * 3 + 2] += vel[i * 3 + 2] * rdt;
      if (sp[i * 3 + 1] < -0.02 || life[i] <= 0) { life[i] = 0; sp[i * 3 + 1] = -100; }
    }
    sprayGeo.attributes.position.needsUpdate = true;

    // colour drift from dusk to dawn
    const k = seg(p, 0.1, 0.95);
    for (const key in cur) cur[key].copy(DUSK[key]).lerp(DAWN[key], k);
    shoreMats.forEach(m => m.color.copy(cur.fog).lerp(cur.deep, m.userData.shade * (1 - k * 0.6)));
    sun.color.set(0xffb27a).lerp(new THREE.Color(0xfff1d6), k);

    waterU.uTime.value = time;
    waterU.uBlade.value.copy(bladeAt);
    waterU.uChurn.value = s.churn;

    const P = v.pointer;
    camera.position.set(CAM.x + P.sx * 0.12, CAM.y + Math.sin(time * 0.9) * 0.02 + P.sy * 0.05, CAM.z);
    camera.lookAt(0.1 + P.sx * 0.1, 0.0, -0.6);
  };
  return v;
}
