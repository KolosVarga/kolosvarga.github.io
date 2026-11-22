/* Manga-page scenes: a meshing gear train, and a circuit board laid out like a night city. */
import * as THREE from 'three';
import { View, TAU, rand, lowPower } from './core.js';
import { toon, outline, canvasTex, glowTexture } from './toon.js';

/* ================= Gears ================= */
function gearShape(teeth, r) {
  const d = r * 0.12, root = r - d, tip = r + d * 0.25, q = TAU / teeth / 4;
  const s = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * TAU;
    const pts = [[root, a], [tip, a + q * 1.1], [tip, a + q * 1.9], [root, a + q * 3]];
    pts.forEach(([rr, aa], k) => { const x = Math.cos(aa) * rr, y = Math.sin(aa) * rr; i === 0 && k === 0 ? s.moveTo(x, y) : s.lineTo(x, y); });
  }
  s.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, r * 0.18, 0, TAU, true); s.holes.push(hole);
  const n = teeth > 14 ? 5 : 4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, c = new THREE.Path();
    c.absarc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.17, 0, TAU, true);
    s.holes.push(c);
  }
  return s;
}

export function createGears(host) {
  const v = new View(host);
  const { scene, camera } = v;
  scene.background = new THREE.Color(0x130b0e);
  scene.fog = new THREE.Fog(0x130b0e, 7, 18);
  camera.fov = 38; camera.updateProjectionMatrix();

  scene.add(new THREE.AmbientLight(0x5a2a30, 1.4));
  scene.add(new THREE.HemisphereLight(0xffb27a, 0x140808, 0.6));
  const warm = new THREE.PointLight(0xff7a3d, 40, 16, 2); warm.position.set(3, 3, 4); scene.add(warm);
  const cool = new THREE.PointLight(0x3de0d0, 26, 16, 2); cool.position.set(-4, 1, 3); scene.add(cool);

  const group = new THREE.Group();
  group.rotation.x = -0.4;
  scene.add(group);

  const defs = [
    { t: 24, r: 1.3, col: 0x3a2a2e, edge: 0xff8a3d },
    { t: 12, r: 0.68, col: 0x4a2a24, edge: 0xffb46b, parent: 0, ang: 0.25 },
    { t: 16, r: 0.9, col: 0x2e2a34, edge: 0x3de0d0, parent: 0, ang: 2.5 },
    { t: 10, r: 0.56, col: 0x3a2a2e, edge: 0xff8a3d, parent: 1, ang: -1.1 },
  ];
  const gears = [];
  defs.forEach((d, i) => {
    const geo = new THREE.ExtrudeGeometry(gearShape(d.t, d.r), { depth: 0.22, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1, curveSegments: 10 });
    geo.translate(0, 0, -0.11);
    const m = outline(new THREE.Mesh(geo, toon(d.col)), 0.012, 0x050203);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: d.edge, transparent: true, opacity: 0.9 }));
    m.add(edges);
    const g = { mesh: m, ...d, pos: new THREE.Vector2() };
    if (d.parent !== undefined) {
      const p = gears[d.parent];
      const dist = (p.r + d.r) * 0.9;
      g.pos.set(p.pos.x + Math.cos(d.ang) * dist, p.pos.y + Math.sin(d.ang) * dist);
      g.z = (i % 2) * 0.05;
    }
    m.position.set(g.pos.x, g.pos.y, g.z || 0);
    group.add(m);
    gears.push(g);
  });
  // centre the assembly
  const box = new THREE.Box3().setFromObject(group);
  const c = box.getCenter(new THREE.Vector3());
  group.children.forEach(ch => ch.position.sub(new THREE.Vector3(c.x, c.y, 0)));
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.2, 16), toon(0x8a8078));
  axle.rotation.x = Math.PI / 2; gears[0].mesh.add(axle);

  // holographic rings + grid floor
  const ringMat = c2 => new THREE.MeshBasicMaterial({ color: c2, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.008, 6, 120), ringMat(0x3de0d0));
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.006, 6, 120), ringMat(0xff8a3d));
  scene.add(ring1, ring2);
  const grid = new THREE.GridHelper(40, 40, 0xff7a3d, 0x5a2a1e);
  grid.position.y = -2.4;
  grid.material.transparent = true; grid.material.opacity = 0.35;
  scene.add(grid);

  // sparks
  const N = 160, glow = glowTexture();
  const sp = new Float32Array(N * 3), seeds = new Float32Array(N);
  for (let i = 0; i < N; i++) { sp[i * 3] = rand(-5, 5); sp[i * 3 + 1] = rand(-2, 3); sp[i * 3 + 2] = rand(-3, 2); seeds[i] = rand(0, 10); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.06, map: glow, color: 0xffb46b, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));

  v.update = (time, dt) => {
    const w0 = time * 0.35;
    gears.forEach(g => {
      if (g.parent === undefined) g.angle = w0;
      else {
        const p = gears[g.parent];
        g.angle = g.ang + Math.PI + Math.PI / g.t - (p.t / g.t) * (p.angle - g.ang);
      }
      g.mesh.rotation.z = g.angle;
    });
    ring1.rotation.set(1.2 + Math.sin(time * 0.3) * 0.2, time * 0.4, 0);
    ring2.rotation.set(1.4, -time * 0.25, Math.sin(time * 0.2) * 0.3);
    for (let i = 0; i < N; i++) { sp[i * 3 + 1] += dt * (0.15 + (seeds[i] % 1) * 0.3); if (sp[i * 3 + 1] > 3.5) sp[i * 3 + 1] = -2.2; }
    sg.attributes.position.needsUpdate = true;
    const P = v.pointer;
    const a = Math.sin(time * 0.15) * 0.5 + P.sx * 0.5;
    camera.position.set(Math.sin(a) * 7.5, 1.2 + P.sy * 0.8, Math.cos(a) * 7.5);
    camera.lookAt(0, -0.1, 0);
  };
  return v;
}

/* ================= Circuit-board city ================= */
export function createPcb(host) {
  const v = new View(host);
  const { scene, camera } = v;
  scene.background = new THREE.Color(0x160b0c);
  scene.fog = new THREE.FogExp2(0x160b0c, 0.085);
  camera.fov = 50; camera.updateProjectionMatrix();

  const SIZE = 18, RES = 1024;
  const traces = [];
  for (let i = 0; i < 90; i++) {
    let x = Math.round(rand(0.05, 0.95) * 64) / 64, y = Math.round(rand(0.05, 0.95) * 64) / 64;
    const pts = [[x, y]];
    let horiz = Math.random() < 0.5;
    for (let k = 0; k < 2 + Math.floor(rand(0, 5)); k++) {
      const len = Math.round(rand(2, 12)) / 64 * (Math.random() < 0.5 ? -1 : 1);
      if (Math.random() < 0.25) { x += len * 0.7; y += len * 0.7; } else if (horiz) x += len; else y += len;
      x = Math.min(0.98, Math.max(0.02, x)); y = Math.min(0.98, Math.max(0.02, y));
      pts.push([x, y]);
      horiz = !horiz;
    }
    traces.push(pts);
  }
  const drawTraces = (c, col, lw, pads) => {
    c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round';
    traces.forEach(t => {
      c.beginPath(); t.forEach(([x, y], k) => (k ? c.lineTo(x * RES, y * RES) : c.moveTo(x * RES, y * RES))); c.stroke();
      if (pads) { c.fillStyle = col; [t[0], t[t.length - 1]].forEach(([x, y]) => { c.beginPath(); c.arc(x * RES, y * RES, lw * 1.8, 0, TAU); c.fill(); }); }
    });
  };
  const colorTex = canvasTex(RES, RES, c => {
    c.fillStyle = '#2a0f10'; c.fillRect(0, 0, RES, RES);
    c.strokeStyle = 'rgba(255,200,160,0.05)'; c.lineWidth = 1;
    for (let i = 0; i < RES; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, RES); c.moveTo(0, i); c.lineTo(RES, i); c.stroke(); }
    drawTraces(c, '#b8692f', 4, true);
    c.fillStyle = 'rgba(243,227,199,0.5)'; c.font = '14px monospace';
    for (let i = 0; i < 26; i++) c.fillText(['R', 'C', 'U', 'Q', 'D'][i % 5] + Math.floor(rand(1, 99)), rand(20, RES - 40), rand(20, RES - 20));
  });
  const emiTex = canvasTex(RES, RES, c => { c.fillStyle = '#000'; c.fillRect(0, 0, RES, RES); drawTraces(c, '#ff7a30', 2.5, true); });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), toon(0xffffff, { map: colorTex, emissive: 0xffffff, emissiveMap: emiTex, emissiveIntensity: 0.5 }));
  board.rotation.x = -Math.PI / 2;
  scene.add(board);
  const toWorld = ([x, y]) => new THREE.Vector3((x - 0.5) * SIZE, 0.04, (y - 0.5) * SIZE);

  scene.add(new THREE.AmbientLight(0x5a2a2a, 1.6));
  const sun = new THREE.DirectionalLight(0xffd0a0, 1.2); sun.position.set(-3, 6, 2); scene.add(sun);
  const roam = new THREE.PointLight(0x3de0d0, 18, 8, 2); roam.position.set(0, 1.5, 0); scene.add(roam);

  const chipMat = toon(0x1a1214), pinMat = toon(0xcfc6bb);
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.35 });
  const winTex = canvasTex(64, 128, c => {
    c.fillStyle = '#120a0c'; c.fillRect(0, 0, 64, 128);
    for (let y = 6; y < 124; y += 9) for (let x = 6; x < 60; x += 10) if (Math.random() < 0.45) { c.fillStyle = Math.random() < 0.8 ? '#ffae5a' : '#4fe6d6'; c.fillRect(x, y, 5, 4); }
  });
  const towerMat = toon(0xffffff, { map: winTex, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.8 });
  const addBlock = (w, h, d, x, z, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, h / 2, z);
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), edgeMat));
    scene.add(m);
    return m;
  };
  for (let i = 0; i < 30; i++) {
    const w = rand(0.6, 1.8), d = rand(0.6, 1.8), x = rand(-8, 8), z = rand(-8, 8);
    addBlock(w, rand(0.12, 0.35), d, x, z, chipMat);
    const pins = Math.floor(w / 0.18);
    for (let k = 0; k < pins; k++) {
      [-1, 1].forEach(side => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.14), pinMat); p.position.set(x - w / 2 + 0.1 + k * 0.18, 0.04, z + side * (d / 2 + 0.06)); scene.add(p); });
    }
  }
  for (let i = 0; i < 9; i++) {
    const t = addBlock(rand(0.6, 0.9), rand(1.4, 3.6), rand(0.6, 0.9), rand(-7, 7), rand(-7, 5), towerMat);
    t.material = towerMat;
  }
  const capMat = toon(0x1f4f55);
  for (let i = 0; i < 22; i++) {
    const m = outline(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.5, 14), capMat), 0.01, 0x050203);
    m.position.set(rand(-8, 8), 0.25, rand(-8, 8));
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.01, 14), pinMat); top.position.y = 0.255; m.add(top);
    scene.add(m);
  }

  // light pulses running along the traces
  const PN = lowPower ? 40 : 70, glow = glowTexture();
  const pp = new Float32Array(PN * 3), pc = new Float32Array(PN * 3);
  const pulses = [];
  const lens = traces.map(t => { let L = 0; for (let k = 1; k < t.length; k++) L += Math.hypot(t[k][0] - t[k - 1][0], t[k][1] - t[k - 1][1]); return L; });
  for (let i = 0; i < PN; i++) {
    const col = new THREE.Color(Math.random() < 0.7 ? 0xffa050 : 0x4fe6d6);
    pc.set([col.r, col.g, col.b], i * 3);
    pulses.push({ tr: Math.floor(rand(0, traces.length)), s: Math.random(), sp: rand(0.15, 0.4) });
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  pg.setAttribute('color', new THREE.BufferAttribute(pc, 3));
  scene.add(new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.35, map: glow, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  const tmp = new THREE.Vector3();
  const along = (t, L, s) => {
    let d = s * L;
    for (let k = 1; k < t.length; k++) {
      const seg = Math.hypot(t[k][0] - t[k - 1][0], t[k][1] - t[k - 1][1]);
      if (d <= seg || k === t.length - 1) { const f = seg ? Math.min(1, d / seg) : 0; return [t[k - 1][0] + (t[k][0] - t[k - 1][0]) * f, t[k - 1][1] + (t[k][1] - t[k - 1][1]) * f]; }
      d -= seg;
    }
    return t[0];
  };

  v.update = (time, dt) => {
    pulses.forEach((p, i) => {
      p.s += dt * p.sp / Math.max(0.05, lens[p.tr]) * 0.1;
      if (p.s > 1) { p.s = 0; p.tr = Math.floor(rand(0, traces.length)); }
      tmp.copy(toWorld(along(traces[p.tr], lens[p.tr], p.s)));
      pp.set([tmp.x, 0.08, tmp.z], i * 3);
    });
    pg.attributes.position.needsUpdate = true;
    roam.position.set(Math.sin(time * 0.4) * 5, 1.4, Math.cos(time * 0.3) * 4);
    const P = v.pointer;
    camera.position.set(Math.sin(time * 0.06) * 3.5 + P.sx * 1.2, 3.0 + P.sy * 0.6, 7.5 + Math.cos(time * 0.05) * 1.2);
    camera.lookAt(camera.position.x * 0.4, 0, -1.5);
  };
  return v;
}
