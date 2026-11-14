/* Scene 4: an Oregon forest behind the projects. Firs sway in the wind; scrolling walks you down the trail. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { View, TAU, lerp, clamp, rand, lowPower, sectionProgress } from './core.js';
import { toon, canvasTex, cumulusTexture, glowTexture } from './toon.js';

export function createForest(host, section) {
  const v = new View(host, { dprMax: 1.5 });
  const { scene, camera } = v;
  camera.fov = 50; camera.far = 400; camera.updateProjectionMatrix();
  scene.fog = new THREE.Fog(0xdce9e3, 30, 170);

  const U = { time: { value: 0 }, wind: { value: 0.4 } };

  /* ---------- sky ---------- */
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color(0x6fa9cf) }, uMid: { value: new THREE.Color(0xb9dbe8) }, uHor: { value: new THREE.Color(0xeef3e6) } },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHor; varying vec3 vP;
      void main(){ float h = normalize(vP).y; vec3 c = mix(uHor, uMid, smoothstep(0.0, 0.18, h)); c = mix(c, uTop, smoothstep(0.18, 0.7, h));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`
  })));

  const cloudTexs = [cumulusTexture(), cumulusTexture(), cumulusTexture()];
  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexs[i % 3], transparent: true, depthWrite: false, fog: false }));
    const w = rand(70, 130);
    s.scale.set(w, w / 2, 1);
    s.position.set(rand(-200, 200), rand(40, 90), rand(-240, -170));
    s.userData.speed = rand(0.6, 1.4);
    scene.add(s);
    clouds.push(s);
  }

  /* ---------- mountains ---------- */
  const mountain = (r, h, x, z, snowLine, rock) => {
    const geo = new THREE.ConeGeometry(r, h, 56, 10);
    const pos = geo.attributes.position, cols = [];
    const cRock = new THREE.Color(rock), cSnow = new THREE.Color(0xf4f6f4), cSnowShade = new THREE.Color(0xc9d6e2);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i), t = (y + h / 2) / h;
      const a = Math.atan2(pos.getZ(i), pos.getX(i));
      if (t < 0.98) {
        const n = 1 + Math.sin(a * 7 + t * 9) * 0.06 + Math.sin(a * 17) * 0.03;
        pos.setX(i, pos.getX(i) * n); pos.setZ(i, pos.getZ(i) * n);
      }
      const line = snowLine + Math.sin(a * 9) * 0.06 + Math.sin(a * 23) * 0.03;
      const shade = Math.cos(a - 2.2) * 0.5 + 0.5;
      const c = t > line ? cSnow.clone().lerp(cSnowShade, shade * 0.7) : cRock.clone().multiplyScalar(0.75 + shade * 0.25);
      cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
    m.position.set(x, h / 2 - 2, z);
    scene.add(m);
  };
  mountain(46, 62, 40, -200, 0.58, 0x7b8fa6);   // a Hood-like peak
  mountain(30, 34, -90, -210, 0.7, 0x8a9db0);
  mountain(24, 26, 130, -190, 0.74, 0x8a9db0);

  const ridgeTex = (seed, amp) => canvasTex(2048, 256, (c, w, h) => {
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, h);
    for (let x = 0; x <= w; x += 6) c.lineTo(x, h * 0.45 + Math.sin(x * 0.004 + seed) * amp + Math.sin(x * 0.013 + seed * 2) * amp * 0.4);
    c.lineTo(w, h); c.fill();
    for (let i = 0; i < 500; i++) {
      const x = rand(0, w), y = h * 0.45 + Math.sin(x * 0.004 + seed) * amp + Math.sin(x * 0.013 + seed * 2) * amp * 0.4, th = rand(10, 26);
      c.beginPath(); c.moveTo(x, y - th); c.lineTo(x + th * 0.3, y + 4); c.lineTo(x - th * 0.3, y + 4); c.fill();
    }
  });
  [[-150, 0x86a7b4, 1.2, 30], [-115, 0x6f9497, 2.6, 26], [-85, 0x557f78, 4.1, 22]].forEach(([z, col, seed, amp]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(520, 65), new THREE.MeshBasicMaterial({ map: ridgeTex(seed, amp), color: col, transparent: true, depthWrite: false, fog: false }));
    m.position.set(0, 18, z);
    scene.add(m);
  });

  /* ---------- ground, trail, river ---------- */
  const groundGeo = new THREE.PlaneGeometry(260, 260, 120, 120);
  groundGeo.rotateX(-Math.PI / 2);
  const gp = groundGeo.attributes.position, gcols = [];
  const g1 = new THREE.Color(0x6f9a4f), g2 = new THREE.Color(0x4f7d43), g3 = new THREE.Color(0x8aa95c);
  const height = (x, z) => Math.sin(x * 0.05) * 1.4 + Math.cos(z * 0.04 + x * 0.02) * 1.6 + Math.sin(x * 0.13 + z * 0.11) * 0.4 - Math.exp(-x * x / 40) * 0.8;
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i);
    gp.setY(i, height(x, z));
    const n = Math.sin(x * 0.3) * Math.cos(z * 0.27);
    const c = g1.clone().lerp(n > 0 ? g3 : g2, Math.abs(n));
    gcols.push(c.r, c.g, c.b);
  }
  groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(gcols, 3));
  groundGeo.computeVertexNormals();
  scene.add(new THREE.Mesh(groundGeo, toon(0xffffff, { vertexColors: true })));

  // a dirt trail winding ahead of the camera
  const trailCurve = new THREE.CatmullRomCurve3([[0, 30], [0.5, 15], [-1.5, 0], [1.2, -15], [-1, -30], [2, -50], [0, -70]].map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const ribbon = (curve, width, col, yOff, segs = 200) => {
    const pts = curve.getSpacedPoints(segs), verts = [], idx = [];
    pts.forEach((p, i) => {
      const t = curve.getTangentAt(i / segs); const n = new THREE.Vector3(-t.z, 0, t.x).normalize();
      const w = width * (0.85 + Math.sin(i * 0.7) * 0.15);
      [-1, 1].forEach(s => { const q = p.clone().addScaledVector(n, (w / 2) * s); verts.push(q.x, height(q.x, q.z) + yOff, q.z); });
      if (i < segs) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, toon(col, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    scene.add(m);
    return m;
  };
  ribbon(trailCurve, 2.2, 0x9c7a55, 0.05);
  const riverCurve = new THREE.CatmullRomCurve3([[-60, 10], [-30, -10], [-12, -40], [10, -60], [40, -80], [80, -95]].map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const riverTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#4f8fb5'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 3; c.lineCap = 'round';
    for (let i = 0; i < 30; i++) { const x = rand(0, w), y = rand(0, h); c.beginPath(); c.moveTo(x, y); c.lineTo(x + rand(10, 30), y); c.stroke(); }
  });
  riverTex.wrapS = riverTex.wrapT = THREE.RepeatWrapping; riverTex.repeat.set(1, 12);
  const river = ribbon(riverCurve, 9, 0xffffff, 0.15, 160);
  river.material = new THREE.MeshBasicMaterial({ map: riverTex, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  {
    // UVs along the river so the ripples flow downstream
    const n = river.geometry.attributes.position.count, uv = [];
    for (let i = 0; i < n; i++) uv.push(i % 2, Math.floor(i / 2) / (n / 2));
    river.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  }

  /* ---------- Douglas firs ---------- */
  function firGeometry() {
    const parts = [];
    const tiers = 11, H = 10;
    for (let i = 0; i < tiers; i++) {
      const t = i / (tiers - 1);
      const r = lerp(2.1, 0.35, Math.pow(t, 0.9));
      const h = lerp(2.3, 1.2, t);
      const y = 1.4 + t * (H - 2.6);
      const g = new THREE.ConeGeometry(r, h, 13, 1, true);
      const p = g.attributes.position, cols = [];
      for (let k = 0; k < p.count; k++) {
        const yy = p.getY(k);
        if (yy < 0) { // base ring: ragged, drooping branch tips
          const j = 0.82 + Math.random() * 0.32;
          p.setX(k, p.getX(k) * j); p.setZ(k, p.getZ(k) * j); p.setY(k, yy - Math.random() * 0.35);
        }
        const shade = 0.55 + 0.45 * ((yy + h / 2) / h);
        cols.push(shade, shade, shade);
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      g.translate(0, y + h / 2, 0);
      parts.push(g);
    }
    const top = new THREE.ConeGeometry(0.22, 1.4, 6, 1, true);
    top.setAttribute('color', new THREE.Float32BufferAttribute(new Array(top.attributes.position.count * 3).fill(1), 3));
    top.translate(0, H + 0.3, 0);
    parts.push(top);
    const merged = mergeGeometries(parts);
    merged.computeVertexNormals();
    return merged;
  }
  const swayPatch = (mat, strength) => {
    mat.onBeforeCompile = s => {
      s.uniforms.uTime = U.time; s.uniforms.uWind = U.wind;
      s.vertexShader = 'uniform float uTime; uniform float uWind;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        #else
          vec2 ip = vec2(0.0);
        #endif
        float hgt = max(position.y, 0.0) / 10.0;
        float bend = hgt * hgt * ${strength.toFixed(2)};
        float ph = ip.x * 0.21 + ip.y * 0.13;
        float sw = sin(uTime * 1.1 + ph) * 0.6 + sin(uTime * 2.3 + ph * 1.7) * 0.25;
        transformed.x += sw * bend * uWind;
        transformed.z += cos(uTime * 0.9 + ph) * bend * uWind * 0.45;`);
    };
    mat.customProgramCacheKey = () => 'sway' + strength;
    return mat;
  };
  const firGeo = firGeometry();
  const trunkGeo = new THREE.CylinderGeometry(0.1, 0.3, 4, 7); trunkGeo.translate(0, 2, 0);
  const firMat = swayPatch(toon(0xffffff, { vertexColors: true, side: THREE.DoubleSide }), 1.2);
  const trunkMat = swayPatch(toon(0x6b4a33), 0.3);

  const spots = [];
  const tryAdd = (x, z, s, clear) => {
    const tx = trailCurve.getPointAt(clamp((30 - z) / 100, 0, 1)).x;
    if (Math.abs(x - tx) < clear + s) return; // keep a meadow open around the trail
    spots.push([x, z, s]);
  };
  const scale = lowPower ? 0.55 : 1;
  for (let i = 0; i < 90 * scale; i++) tryAdd(rand(-30, 30), rand(-40, 26), rand(0.9, 1.7), 9);    // near, framing the meadow
  for (let i = 0; i < 300 * scale; i++) tryAdd(rand(-80, 80), rand(-90, -40), rand(0.8, 1.7), 14); // mid forest
  for (let i = 0; i < 420 * scale; i++) tryAdd(rand(-170, 170), rand(-150, -90), rand(1.0, 2.2), 0); // far hillsides
  const firs = new THREE.InstancedMesh(firGeo, firMat, spots.length);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const greens = [0x2f5d3f, 0x3a6b45, 0x2a5238, 0x46774a, 0x355e44, 0x2c4f3c].map(c => new THREE.Color(c));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  spots.forEach(([x, z, s], i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, TAU));
    sc.set(s * rand(0.85, 1.1), s * rand(0.9, 1.25), s * rand(0.85, 1.1));
    ps.set(x, height(x, z) - 0.2, z);
    m4.compose(ps, q, sc);
    firs.setMatrixAt(i, m4); trunks.setMatrixAt(i, m4);
    firs.setColorAt(i, greens[i % greens.length].clone().multiplyScalar(rand(0.9, 1.12)));
  });
  scene.add(firs, trunks);

  /* ---------- light + floating seeds ---------- */
  scene.add(new THREE.HemisphereLight(0xd6ecf5, 0x4f6a40, 1.3));
  const sun = new THREE.DirectionalLight(0xfff0d2, 2.4); sun.position.set(-30, 50, 20); scene.add(sun);

  const SN = lowPower ? 80 : 160, glow = glowTexture();
  const seeds = new Float32Array(SN * 3), so = new Float32Array(SN);
  for (let i = 0; i < SN; i++) { seeds.set([rand(-12, 12), rand(0.5, 7), rand(-20, 25)], i * 3); so[i] = rand(0, 100); }
  const seedGeo = new THREE.BufferGeometry(); seedGeo.setAttribute('position', new THREE.BufferAttribute(seeds, 3));
  scene.add(new THREE.Points(seedGeo, new THREE.PointsMaterial({ size: 0.09, map: glow, color: 0xfff6dc, transparent: true, depthWrite: false })));

  /* ---------- scroll + wind ---------- */
  let lastY = window.scrollY, gust = 0, prog = 0;
  v.update = (time, dt, rdt) => {
    const y = window.scrollY;
    const vel = Math.abs(y - lastY) / Math.max(rdt, 0.001);
    lastY = y;
    gust = lerp(gust, clamp(vel / 1600, 0, 1.4), 1 - Math.exp(-rdt * (vel > gust * 1600 ? 3 : 0.8)));
    U.wind.value = 0.35 + gust + Math.sin(time * 0.3) * 0.08;
    U.time.value = time;

    prog = lerp(prog, sectionProgress(section), 1 - Math.exp(-rdt * 4));
    const t = clamp(0.02 + prog * 0.62, 0, 1);
    const p = trailCurve.getPointAt(t), ahead = trailCurve.getPointAt(Math.min(1, t + 0.08));
    const P = v.pointer;
    const camY = height(p.x, p.z) + 3.4 + Math.sin(time * 0.8) * 0.04 + prog * 1.6;
    camera.position.set(p.x + P.sx * 0.8, camY, p.z);
    camera.lookAt(ahead.x + P.sx * 2, camY + 0.9 + P.sy * 1.2, ahead.z);

    clouds.forEach(c => { c.position.x += dt * c.userData.speed; if (c.position.x > 230) c.position.x = -230; });
    riverTex.offset.y -= dt * 0.05;
    for (let i = 0; i < SN; i++) {
      seeds[i * 3] += Math.sin(time * 0.5 + so[i]) * dt * 0.3 + U.wind.value * dt * 0.4;
      seeds[i * 3 + 1] += Math.cos(time * 0.4 + so[i]) * dt * 0.15;
      if (seeds[i * 3] > 14) seeds[i * 3] = -14;
    }
    seedGeo.attributes.position.needsUpdate = true;
  };
  return v;
}
