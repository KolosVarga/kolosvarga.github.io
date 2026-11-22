/* Scene 1: front-row seat at a small jazz club.
   The stage curves around you: pan left for the piano and bass, right for the drums and horns.
   Hovering an instrument releases musical notes. Rendered through a painterly filter. */
import * as THREE from 'three';
import { View, TAU, lerp, clamp, rand, isTouch, lowPower, reduceMotion } from './core.js';
import { soft, canvasTex, painted, glowTexture, smokeTexture, noteTextures } from './toon.js';
import { painterly } from './post.js';

const D2R = Math.PI / 180;
const polar = (deg, r) => new THREE.Vector3(Math.sin(deg * D2R) * r, 0, -Math.cos(deg * D2R) * r);

export function createBar(host) {
  const v = new View(host, { shadows: !lowPower, dprMax: 1.25 });
  const { scene, camera } = v;
  scene.background = new THREE.Color(0x1a0e0b);
  scene.fog = new THREE.FogExp2(0x24140f, 0.035);
  camera.fov = 52; camera.near = 0.05; camera.far = 40;
  camera.rotation.order = 'YXZ';
  camera.updateProjectionMatrix();
  const CAM = new THREE.Vector3(0, 1.2, 0.2);
  camera.position.copy(CAM);
  const pass = painterly(v, { radius: lowPower ? 2 : 4, bloom: !lowPower });

  const glow = glowTexture();
  const add = (m, p = scene) => { p.add(m); return m; };
  const sh = m => { m.castShadow = m.receiveShadow = true; return m; };
  const mesh = (geo, mat, x = 0, y = 0, z = 0, p) => { const m = sh(new THREE.Mesh(geo, mat)); m.position.set(x, y, z); return add(m, p); };
  const box = (w, h, d, mat, x, y, z, p) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, p);
  const cyl = (rt, rb, h, mat, x, y, z, p, s = 20) => mesh(new THREE.CylinderGeometry(rt, rb, h, s), mat, x, y, z, p);
  const sphere = (r, mat, x, y, z, p, s = 16) => mesh(new THREE.SphereGeometry(r, s, Math.max(8, s * 0.6)), mat, x, y, z, p);
  const glowSprite = (color, size, pos, opacity = 0.6, p) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.set(size, size, 1); s.position.copy(pos);
    return add(s, p);
  };
  const rep = (t, x, y) => { t.repeat.set(x, y); return t; };
  const basic = (o) => new THREE.MeshBasicMaterial(o);

  /* ================= painted textures ================= */
  const T = {
    plaster: rep(painted(512, 512, '#c4ab86', ['#d6c09a', '#b0946c', '#e2d0ac', '#9c8262', '#cdb894'], {
      strokes: 1400, size: [8, 30], alpha: 0.2,
      extra: (c, w, h) => {
        // patches of exposed brick, painted loosely
        for (let p = 0; p < 3; p++) {
          const px = rnd(40, w - 160), py = rnd(40, h - 120), pw = rnd(90, 150), ph = rnd(60, 110);
          for (let y = py; y < py + ph; y += 14) for (let x = px + ((y / 14) % 2) * 14; x < px + pw; x += 30) {
            if (Math.hypot((x - px - pw / 2) / pw, (y - py - ph / 2) / ph) > 0.5 + Math.random() * 0.1) continue;
            c.fillStyle = `hsl(${rnd(6, 16)},${rnd(40, 55)}%,${rnd(30, 42)}%)`; c.globalAlpha = 0.85;
            c.fillRect(x, y, 26, 11);
          }
        }
        c.globalAlpha = 1;
      }
    }), 3, 1.2),
    wainscot: rep(painted(512, 512, '#4a2716', ['#5c321d', '#3a1d10', '#6a3b22'], {
      strokes: 900, size: [10, 40], alpha: 0.25, angle: Math.PI / 2, jitter: 0.08,
      extra: (c, w, h) => { c.strokeStyle = 'rgba(20,8,4,0.55)'; c.lineWidth = 3; for (let x = 0; x < w; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } c.fillStyle = 'rgba(255,200,150,0.12)'; c.fillRect(0, 0, w, 10); }
    }), 6, 1),
    floor: rep(painted(512, 512, '#5a3220', ['#6e3e26', '#4a2818', '#7d4a2c', '#3e2214'], {
      strokes: 1300, size: [14, 50], alpha: 0.22, angle: 0, jitter: 0.06,
      extra: (c, w, h) => { c.strokeStyle = 'rgba(25,10,5,0.45)'; c.lineWidth = 2; for (let y = 0; y < h; y += 42) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); for (let x = rnd(0, 120); x < w; x += rnd(140, 260)) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 42); c.stroke(); } } }
    }), 4, 4),
    stage: rep(painted(512, 512, '#8a5a32', ['#a06c3e', '#76482a', '#b07a48'], {
      strokes: 900, size: [14, 44], alpha: 0.25, angle: 0, jitter: 0.05,
      extra: (c, w, h) => { c.strokeStyle = 'rgba(40,18,8,0.4)'; c.lineWidth = 2; for (let y = 0; y < h; y += 36) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } }
    }), 3, 3),
    // velvet curtain: painted folds with highlights and a gold fringe along the bottom
    curtain: painted(1024, 512, '#6e1618', ['#8a2224', '#5a1012', '#a2302c', '#4a0c0e'], {
      strokes: 1600, size: [14, 60], alpha: 0.2, angle: Math.PI / 2, jitter: 0.05,
      extra: (c, w, h) => {
        const folds = 16;
        for (let i = 0; i < folds; i++) {
          const x0 = (i / folds) * w, fw = w / folds;
          const g = c.createLinearGradient(x0, 0, x0 + fw, 0);
          g.addColorStop(0, 'rgba(20,0,2,0.55)'); g.addColorStop(0.35, 'rgba(0,0,0,0)');
          g.addColorStop(0.55, 'rgba(255,140,110,0.22)'); g.addColorStop(0.7, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,0,2,0.5)');
          c.fillStyle = g; c.fillRect(x0, 0, fw, h);
        }
        c.fillStyle = '#c8973c'; c.fillRect(0, h - 26, w, 8);
        for (let x = 0; x < w; x += 5) { c.fillStyle = Math.random() < 0.5 ? '#e0b456' : '#a87a2a'; c.fillRect(x, h - 18, 3, 18); }
      }
    }),
    velvet: painted(256, 256, '#8a2420', ['#a8322a', '#6a1816', '#b8463a'], { strokes: 400, size: [6, 20], alpha: 0.3 }),
    leaf: painted(128, 128, '#4f7f3a', ['#6a9a48', '#3a6630', '#86b05a'], { strokes: 200, size: [6, 18], alpha: 0.35 }),
  };
  function rnd(a, b) { return a + Math.random() * (b - a); }

  const windowTex = canvasTex(512, 420, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0f1838'); g.addColorStop(0.55, '#24305a'); g.addColorStop(1, '#5a3a5a');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(255,250,230,${rnd(0.3, 0.9)})`; c.fillRect(rnd(0, w), rnd(0, h * 0.45), 1.5, 1.5); }
    c.fillStyle = 'rgba(255,245,220,0.9)'; c.beginPath(); c.arc(w * 0.78, h * 0.18, 18, 0, TAU); c.fill();
    for (const L of [{ col: '#2a2a4e', min: 110, max: 230, lit: 0.18 }, { col: '#1a1630', min: 170, max: 330, lit: 0.34 }]) {
      let x = -10;
      while (x < w) {
        const bw = rnd(36, 84), bh = rnd(L.min, L.max);
        c.fillStyle = L.col; c.fillRect(x, h - bh, bw, bh);
        c.fillRect(x + bw * 0.2, h - bh - 14, bw * 0.6, 14);
        for (let wy = h - bh + 10; wy < h - 6; wy += 15) for (let wx = x + 6; wx < x + bw - 8; wx += 11)
          if (Math.random() < L.lit) { c.fillStyle = Math.random() < 0.85 ? '#ffc070' : '#7fe6d8'; c.fillRect(wx, wy, 5, 8); }
        x += bw + rnd(2, 8);
      }
    }
    c.shadowBlur = 16;
    [['#ff7a3d', 70, 230], ['#5fe0d0', 320, 180], ['#ff5070', 430, 260]].forEach(([col, x, y]) => { c.shadowColor = col; c.fillStyle = col; c.fillRect(x, y, 12, 70); });
  });
  const rainTex = rep(canvasTex(256, 256, c => {
    c.strokeStyle = 'rgba(210,225,255,0.4)'; c.lineWidth = 1;
    for (let i = 0; i < 150; i++) { const x = rnd(0, 256), y = rnd(0, 256), l = rnd(8, 22); c.beginPath(); c.moveTo(x, y); c.lineTo(x - l * 0.15, y + l); c.stroke(); }
  }), 2, 2);
  rainTex.wrapS = rainTex.wrapT = THREE.RepeatWrapping;

  const neonTex = canvasTex(1024, 256, (c, w, h) => {
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = 'italic 600 150px Fraunces, Georgia, serif';
    for (const [blur, col] of [[60, '#ff5a1f'], [28, '#ff7a3d'], [10, '#ffb27a']]) { c.shadowBlur = blur; c.shadowColor = col; c.fillStyle = col; c.fillText("Varga's", w / 2, h / 2 + 8); }
    c.shadowBlur = 0; c.lineWidth = 3; c.strokeStyle = '#fff1e0'; c.strokeText("Varga's", w / 2, h / 2 + 8);
  });

  const posterTex = (bg, accent, title, sub, kind) => canvasTex(256, 360, (c, w, h) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) { c.globalAlpha = 0.12; c.fillStyle = i % 2 ? '#000' : '#fff'; c.beginPath(); c.ellipse(rnd(0, w), rnd(0, h), rnd(8, 30), rnd(3, 10), rnd(0, 3), 0, TAU); c.fill(); }
    c.globalAlpha = 1;
    c.fillStyle = accent; c.beginPath(); c.arc(w / 2, h * 0.38, 74, 0, TAU); c.fill();
    c.strokeStyle = '#1a0f0a'; c.lineWidth = 7; c.lineCap = 'round';
    if (kind === 'horn') { c.beginPath(); c.moveTo(50, h * 0.6); c.lineTo(185, h * 0.28); c.stroke(); c.beginPath(); c.ellipse(192, h * 0.26, 18, 30, -0.9, 0, TAU); c.stroke(); }
    else { for (let k = 0; k < 7; k++) { c.fillStyle = k % 2 ? '#1a0f0a' : '#f3e3c7'; c.fillRect(60 + k * 20, h * 0.3, 18, 60); } }
    c.fillStyle = '#1a0f0a'; c.textAlign = 'center';
    c.font = '600 36px Fraunces, Georgia, serif'; c.fillText(title, w / 2, h * 0.8);
    c.font = '20px "Zen Kaku Gothic New", sans-serif'; c.fillText(sub, w / 2, h * 0.9);
  });

  const cardTex = canvasTex(512, 300, (c, w, h) => {
    c.fillStyle = '#f1e4c8'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#a8322a'; c.lineWidth = 6; c.strokeRect(14, 14, w - 28, h - 28);
    c.fillStyle = '#2a1810'; c.textAlign = 'center';
    c.font = 'italic 34px Fraunces, Georgia, serif'; c.fillText('Tonight', w / 2, 82);
    c.font = '600 52px Fraunces, Georgia, serif'; c.fillText('Kolos Varga', w / 2, 152);
    c.font = '26px "Zen Kaku Gothic New", sans-serif'; c.fillText('trumpet & piano', w / 2, 200);
    c.font = '22px "Zen Kaku Gothic New", sans-serif'; c.fillStyle = '#a8322a'; c.fillText('first set at nine', w / 2, 246);
  });

  const sheetTex = canvasTex(256, 330, (c, w, h) => {
    c.fillStyle = '#f3ead6'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#3a2a20'; c.lineWidth = 1;
    for (let s = 0; s < 7; s++) {
      const y0 = 40 + s * 40;
      for (let l = 0; l < 5; l++) { c.beginPath(); c.moveTo(16, y0 + l * 5); c.lineTo(w - 16, y0 + l * 5); c.stroke(); }
      for (let n = 0; n < 9; n++) { c.fillStyle = '#2a1a10'; c.beginPath(); c.ellipse(30 + n * 24, y0 + rnd(-2, 22), 4, 3, -0.4, 0, TAU); c.fill(); c.fillRect(33 + n * 24, y0 - 14 + rnd(0, 6), 1.5, 16); }
    }
  });

  const drumHead = canvasTex(256, 256, c => {
    c.fillStyle = '#efe0c2'; c.beginPath(); c.arc(128, 128, 128, 0, TAU); c.fill();
    c.strokeStyle = '#a8322a'; c.lineWidth = 14; c.beginPath(); c.arc(128, 128, 104, 0, TAU); c.stroke();
    c.fillStyle = '#a8322a'; c.font = 'italic 600 80px Fraunces, Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('KV', 128, 134);
  });

  /* ================= materials ================= */
  const M = {
    lacquer: soft(0x231a17), harp: soft(0xc09048), ivory: soft(0xf4ead6), ebony: soft(0x120d0b),
    wood: soft(0x8a5230), woodDark: soft(0x4a2818), woodLight: soft(0xb07444),
    brass: soft(0xe6b04c, { emissive: 0x3a2205 }), chrome: soft(0xd8d0c4), shell: soft(0xa82e20),
    cymbal: soft(0xdcaa50, { emissive: 0x2a1704 }), bassWood: soft(0xa44a22), velvet: soft(0xffffff, { map: T.velvet }),
    black: soft(0x1a1412), terracotta: soft(0xb0603a), plant: soft(0x4f7f3a), plant2: soft(0x6a9a48), plantDark: soft(0x35602c),
    cat: soft(0x2e2826), paper: soft(0xf1e4c8), glass: soft(0xe8dcc4, { transparent: true, opacity: 0.45 }),
    amberGlass: soft(0x9a1e18, { emissive: 0x3a0806, transparent: true, opacity: 0.85 }),
    green: soft(0x2f5a44, { side: THREE.DoubleSide }), hat: soft(0x2a2420), hatBand: soft(0xa8322a),
  };

  /* ================= room ================= */
  const floor = mesh(new THREE.PlaneGeometry(10, 10), soft(0xffffff, { map: T.floor }), 0, 0, -2);
  floor.rotation.x = -Math.PI / 2; floor.castShadow = false;
  const wall = (w, h, x, y, z, ry) => {
    const m = mesh(new THREE.PlaneGeometry(w, h), soft(0xffffff, { map: T.plaster.clone() }), x, y, z);
    m.material.map.repeat.set(w / 3, h / 2.6); m.material.map.needsUpdate = true;
    m.rotation.y = ry; m.castShadow = false;
    const wn = mesh(new THREE.PlaneGeometry(w, 1.0), soft(0xffffff, { map: T.wainscot.clone() }), 0, 0, 0);
    wn.material.map.repeat.set(w / 1.4, 1); wn.material.map.needsUpdate = true;
    wn.position.set(x, 0.5, z); wn.rotation.y = ry; wn.translateZ(0.01); wn.castShadow = false;
    return m;
  };
  wall(9.2, 3.4, 0, 1.7, -5.2, 0);
  wall(8, 3.4, -4.6, 1.7, -1.2, Math.PI / 2);
  wall(8, 3.4, 4.6, 1.7, -1.2, -Math.PI / 2);
  const ceil = mesh(new THREE.PlaneGeometry(10, 10), soft(0x24140e), 0, 3.4, -2);
  ceil.rotation.x = Math.PI / 2;
  [-4.4, -3.0, -1.6, -0.2, 1.2].forEach(z => box(9.2, 0.18, 0.22, M.woodDark, 0, 3.3, z));

  /* ================= stage ================= */
  {
    const a0 = -80 * D2R, a1 = 80 * D2R, rIn = 1.55, rOut = 5.6;
    const s = new THREE.Shape();
    s.moveTo(Math.sin(a0) * rIn, Math.cos(a0) * rIn);
    for (let i = 0; i <= 48; i++) { const a = a0 + (a1 - a0) * i / 48; s.lineTo(Math.sin(a) * rIn, Math.cos(a) * rIn); }
    for (let i = 48; i >= 0; i--) { const a = a0 + (a1 - a0) * i / 48; s.lineTo(Math.sin(a) * rOut, Math.cos(a) * rOut); }
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.32, bevelEnabled: false, curveSegments: 48 });
    g.rotateX(-Math.PI / 2);
    const st = mesh(g, soft(0xffffff, { map: T.stage }));
    st.castShadow = false;
    // brass lip + footlights along the front edge
    const lip = new THREE.CatmullRomCurve3(Array.from({ length: 33 }, (_, i) => { const a = a0 + (a1 - a0) * i / 32; return new THREE.Vector3(Math.sin(a) * rIn, 0.32, -Math.cos(a) * rIn); }));
    mesh(new THREE.TubeGeometry(lip, 96, 0.018, 6), M.brass);
    for (let i = 1; i < 12; i++) {
      const a = a0 + (a1 - a0) * i / 12;
      const p = new THREE.Vector3(Math.sin(a) * (rIn + 0.08), 0.35, -Math.cos(a) * (rIn + 0.08));
      cyl(0.04, 0.05, 0.05, M.black, p.x, 0.345, p.z, scene, 10);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), basic({ color: 0xffd99a }))).position.set(p.x, 0.385, p.z);
      glowSprite(0xffb060, 0.32, new THREE.Vector3(p.x, 0.39, p.z), 0.55);
    }
    const fl1 = add(new THREE.PointLight(0xffb468, 0.6, 2.5, 2)); fl1.position.set(-0.9, 0.5, -1.9);
    const fl2 = add(new THREE.PointLight(0xffb468, 0.6, 2.5, 2)); fl2.position.set(0.9, 0.5, -1.9);
  }
  // curtain + gathered side drapes
  {
    const geo = new THREE.PlaneGeometry(7.4, 3.2, 140, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 6.5) * 0.09 + Math.sin(p.getX(i) * 2.1) * 0.05);
    geo.computeVertexNormals();
    const c = mesh(geo, soft(0xffffff, { map: T.curtain, side: THREE.DoubleSide }), 0, 1.9, -5.0);
    c.castShadow = false;
    [-3.7, 3.7].forEach(x => {
      const d = mesh(new THREE.CylinderGeometry(0.22, 0.42, 3.0, 14), soft(0xffffff, { map: T.curtain }), x, 1.8, -4.9);
      d.scale.z = 0.5;
      mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 16), M.brass, x, 1.45, -4.78);
    });
    box(7.8, 0.22, 0.24, M.woodDark, 0, 3.25, -4.95);
    const neon = add(new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), basic({ map: neonTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
    neon.position.set(0, 2.85, -4.85);
    v.neon = neon;
  }

  /* ================= instruments ================= */
  const instruments = [];
  const register = (g, name, emit) => {
    g.userData = { name, emit, bounce: 0 };
    g.traverse(o => { if (o.isMesh) o.userData.instrument = g; });
    instruments.push(g);
    return g;
  };
  const place = (deg, r, y = 0.32) => { const g = add(new THREE.Group()); g.position.copy(polar(deg, r)); g.position.y = y; return g; };
  const facing = deg => -deg * D2R; // rotation that turns +z toward the seat

  // grand piano, stage left, lid open toward you
  {
    const g = place(-58, 3.35);
    g.rotation.y = 1.15;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(1.5, 0); shape.lineTo(1.5, 0.5);
    shape.bezierCurveTo(1.5, 1.0, 0.9, 0.9, 0.95, 1.45);
    shape.quadraticCurveTo(0.9, 1.88, 0.45, 1.9);
    shape.quadraticCurveTo(0.0, 1.9, 0, 1.55); shape.lineTo(0, 0);
    const body = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 32 }), M.lacquer, -0.75, 0.62, 0, g);
    body.rotation.x = -Math.PI / 2;
    const harp = mesh(new THREE.ShapeGeometry(shape, 32), M.harp, -0.7, 0.94, -0.05, g);
    harp.rotation.x = -Math.PI / 2; harp.scale.set(0.93, 0.93, 1);
    for (let i = 0; i < 26; i++) { const s = box(0.004, 0.004, 1.2 - i * 0.025, M.chrome, -0.6 + i * 0.045, 0.945, -0.75 + i * 0.01, g); s.castShadow = false; }
    const lidPivot = add(new THREE.Group(), g);
    lidPivot.position.set(-0.75, 0.945, 0); lidPivot.rotation.z = 0.55;
    const lid = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: false, curveSegments: 32 }), M.lacquer, 0, 0, 0, lidPivot);
    lid.rotation.x = -Math.PI / 2;
    cyl(0.012, 0.012, 0.68, M.ebony, 0.33, 1.26, -0.95, g, 6);
    box(1.52, 0.12, 0.32, M.lacquer, 0, 0.7, 0.15, g);
    box(1.44, 0.03, 0.17, M.ivory, 0, 0.775, 0.2, g);
    const bk = new THREE.InstancedMesh(new THREE.BoxGeometry(0.014, 0.025, 0.1), M.ebony, 40);
    const pat = [1, 1, 0, 1, 1, 1, 0]; let n = 0; const ww = 1.44 / 52; const mtx = new THREE.Matrix4();
    for (let i = 0; i < 51 && n < 40; i++) if (pat[i % 7]) { mtx.setPosition(-0.72 + (i + 1) * ww, 0.8, 0.165); bk.setMatrixAt(n++, mtx); }
    bk.count = n; g.add(bk);
    const stand = box(0.66, 0.24, 0.012, M.lacquer, 0, 1.07, -0.02, g); stand.rotation.x = -0.25;
    const sheet = add(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.26), soft(0xffffff, { map: sheetTex })), g);
    sheet.position.set(0, 1.08, 0.0); sheet.rotation.x = -0.25;
    [[-0.62, -0.1], [0.62, -0.15], [-0.3, -1.6]].forEach(([x, z]) => cyl(0.055, 0.035, 0.62, M.lacquer, x, 0.31, z, g, 12));
    const bench = add(new THREE.Group(), g); bench.position.set(0, 0, 0.8);
    box(0.84, 0.08, 0.38, M.velvet, 0, 0.5, 0, bench);
    [[-0.36, -0.15], [0.36, -0.15], [-0.36, 0.15], [0.36, 0.15]].forEach(([x, z]) => cyl(0.024, 0.02, 0.47, M.lacquer, x, 0.235, z, bench, 8));
    // the club cat, asleep on the bench
    const cat = add(new THREE.Group(), bench); cat.position.set(0.1, 0.55, 0);
    const cb = sphere(1, M.cat, 0, 0.09, 0, cat); cb.scale.set(0.2, 0.1, 0.15);
    sphere(0.08, M.cat, 0.16, 0.11, 0.05, cat);
    [[0.15, 0.03], [0.2, 0.09]].forEach(([x, z]) => { const e = mesh(new THREE.ConeGeometry(0.028, 0.06, 6), M.cat, x, 0.19, z, cat); e.rotation.z = -0.3; });
    const tail = mesh(new THREE.TorusGeometry(0.15, 0.024, 6, 16, Math.PI * 1.1), M.cat, -0.02, 0.05, 0.02, cat); tail.rotation.set(Math.PI / 2, 0, 1.6);
    v.catBody = cb;
    register(g, 'piano', new THREE.Vector3(0.1, 1.55, -0.7));
  }

  // upright bass on a stand
  {
    const g = place(-31, 3.25);
    g.rotation.set(0, facing(-31), 0.1); g.scale.setScalar(0.88);
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(0.35, 0, 0.46, 0.2, 0.42, 0.42); s.bezierCurveTo(0.4, 0.56, 0.26, 0.56, 0.27, 0.66);
    s.bezierCurveTo(0.28, 0.76, 0.36, 0.82, 0.32, 0.96); s.bezierCurveTo(0.28, 1.08, 0.12, 1.1, 0, 1.12);
    s.bezierCurveTo(-0.12, 1.1, -0.28, 1.08, -0.32, 0.96); s.bezierCurveTo(-0.36, 0.82, -0.28, 0.76, -0.27, 0.66);
    s.bezierCurveTo(-0.26, 0.56, -0.4, 0.56, -0.42, 0.42); s.bezierCurveTo(-0.46, 0.2, -0.35, 0, 0, 0);
    mesh(new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 4, curveSegments: 28 }), M.bassWood, 0, 0.15, -0.1, g);
    box(0.075, 0.86, 0.06, M.woodDark, 0, 1.68, 0.1, g);
    box(0.06, 1.15, 0.02, M.ebony, 0, 1.4, 0.15, g);
    const scroll = mesh(new THREE.TorusGeometry(0.05, 0.022, 8, 16), M.woodDark, 0, 2.16, 0.1, g); scroll.rotation.y = Math.PI / 2;
    box(0.17, 0.11, 0.02, M.woodLight, 0, 0.78, 0.17, g);
    box(0.1, 0.22, 0.02, M.ebony, 0, 0.42, 0.155, g);
    [-0.12, 0.12].forEach(x => { const f = box(0.02, 0.22, 0.01, M.ebony, x, 0.86, 0.137, g); f.rotation.z = x > 0 ? -0.15 : 0.15; });
    const pts = []; [-0.025, -0.008, 0.008, 0.025].forEach(x => pts.push(x, 0.5, 0.18, x * 0.6, 2.06, 0.17));
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xe8d8b8, transparent: true, opacity: 0.6 })), g);
    box(0.5, 0.03, 0.3, M.black, 0, 0.015, 0, g);
    register(g, 'bass', new THREE.Vector3(0, 1.3, 0.2));
  }

  // stage dressing: patterned rug, amp, floor lamp, a stack of charts
  {
    const rugTex = canvasTex(512, 512, (c, w) => {
      const cx = w / 2;
      c.fillStyle = '#4a1a1c'; c.beginPath(); c.arc(cx, cx, cx, 0, TAU); c.fill();
      [[0.95, '#9a7438', 10], [0.84, '#24343e', 18], [0.62, '#9a7438', 4], [0.4, '#6a2420', 40], [0.18, '#b08a48', 6]].forEach(([r, col, lw]) => { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.arc(cx, cx, cx * r, 0, TAU); c.stroke(); });
      for (let i = 0; i < 32; i++) { const a = i / 32 * TAU; c.fillStyle = i % 2 ? '#e0b860' : '#4a6a5a'; c.beginPath(); c.ellipse(cx + Math.cos(a) * cx * 0.73, cx + Math.sin(a) * cx * 0.73, 12, 6, a, 0, TAU); c.fill(); }
      for (let i = 0; i < 400; i++) { c.globalAlpha = 0.12; c.fillStyle = i % 2 ? '#000' : '#fff'; c.fillRect(Math.random() * w, Math.random() * w, 2, 2); }
    });
    const rug = add(new THREE.Mesh(new THREE.CircleGeometry(1.25, 48), soft(0xffffff, { map: rugTex })));
    rug.rotation.x = -Math.PI / 2; rug.position.copy(polar(4, 3.0)); rug.position.y = 0.325; rug.receiveShadow = true;

    const amp = add(new THREE.Group()); amp.position.copy(polar(-16, 3.9)); amp.position.y = 0.32; amp.rotation.y = facing(-16);
    box(0.5, 0.55, 0.3, soft(0x2a1e18), 0, 0.275, 0, amp);
    const grill = canvasTex(128, 128, c => { c.fillStyle = '#c8b48a'; c.fillRect(0, 0, 128, 128); c.strokeStyle = 'rgba(80,60,40,0.4)'; for (let i = 0; i < 128; i += 4) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 128); c.stroke(); } });
    add(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.34), soft(0xffffff, { map: grill })), amp).position.set(0, 0.24, 0.152);
    box(0.44, 0.08, 0.02, soft(0xd8c8a8), 0, 0.48, 0.152, amp);

    const lamp = add(new THREE.Group()); lamp.position.copy(polar(44, 4.4)); lamp.position.y = 0.32;
    cyl(0.16, 0.18, 0.04, M.brass, 0, 0.02, 0, lamp, 18);
    cyl(0.015, 0.015, 1.6, M.brass, 0, 0.82, 0, lamp, 8);
    const ls = mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.32, 20, 1, true), soft(0xf0c890, { side: THREE.DoubleSide, emissive: 0x8a4a18 }), 0, 1.7, 0, lamp); ls.castShadow = false;
    glowSprite(0xffb870, 1.4, new THREE.Vector3(0, 1.66, 0), 0.5, lamp);
    const ll = add(new THREE.PointLight(0xffb070, 3, 4, 2), lamp); ll.position.set(0, 1.55, 0);

    const stack = add(new THREE.Group()); stack.position.copy(polar(-8, 3.6)); stack.position.y = 0.32;
    for (let i = 0; i < 6; i++) { const b = box(0.32, 0.03, 0.24, i % 2 ? M.paper : soft(0xd8c8a8), 0, 0.015 + i * 0.03, 0, stack); b.rotation.y = rand(-0.3, 0.3); }
  }

  // centre stage: vintage mic, stool, hat
  {
    const g = place(0, 2.75);
    cyl(0.14, 0.17, 0.03, M.black, 0, 0.015, 0, g, 24);
    cyl(0.013, 0.013, 1.45, M.chrome, 0, 0.74, 0, g, 8);
    const mic = mesh(new THREE.CapsuleGeometry(0.05, 0.08, 6, 14), M.chrome, 0, 1.52, 0.02, g); mic.rotation.x = 0.35;
    const grille = mesh(new THREE.TorusGeometry(0.052, 0.008, 6, 18), M.black, 0, 1.52, 0.02, g); grille.rotation.x = Math.PI / 2 + 0.35;
    const stool = add(new THREE.Group()); stool.position.copy(polar(12, 3.3)); stool.position.y = 0.32;
    cyl(0.19, 0.19, 0.07, M.velvet, 0, 0.74, 0, stool, 20);
    [0, 1, 2, 3].forEach(i => { const a = i * Math.PI / 2 + 0.4; const l = cyl(0.016, 0.016, 0.76, M.woodDark, Math.cos(a) * 0.12, 0.37, Math.sin(a) * 0.12, stool, 6); l.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12); });
    cyl(0.11, 0.13, 0.09, M.hat, 0.02, 0.83, 0, stool, 18);
    cyl(0.21, 0.21, 0.012, M.hat, 0.02, 0.785, 0, stool, 24);
    cyl(0.112, 0.122, 0.025, M.hatBand, 0.02, 0.8, 0, stool, 18);
  }

  // drum kit, stage right
  {
    const g = place(30, 3.4);
    g.rotation.y = facing(30);
    const kick = cyl(0.3, 0.3, 0.36, M.shell, 0, 0.31, 0, g, 30); kick.rotation.x = Math.PI / 2;
    add(new THREE.Mesh(new THREE.CircleGeometry(0.29, 32), soft(0xffffff, { map: drumHead })), g).position.set(0, 0.31, 0.182);
    const tom = cyl(0.15, 0.15, 0.17, M.shell, 0.14, 0.75, 0.05, g, 24); tom.rotation.x = 0.45;
    cyl(0.21, 0.21, 0.32, M.shell, 0.6, 0.38, 0.15, g, 24);
    [[0.42, 0.0], [0.78, 0.0], [0.6, 0.36]].forEach(([x, z]) => cyl(0.012, 0.012, 0.25, M.chrome, x, 0.12, z, g, 6));
    cyl(0.18, 0.18, 0.12, M.chrome, -0.44, 0.62, 0.28, g, 24);
    cyl(0.014, 0.014, 0.56, M.chrome, -0.44, 0.28, 0.28, g, 6);
    const cym = (r, x, y, z, tilt) => { cyl(0.012, 0.012, y, M.chrome, x, y / 2, z, g, 6); const c = cyl(0.015, r, 0.02, M.cymbal, x, y + 0.02, z, g, 32); c.rotation.z = tilt; };
    cym(0.18, -0.78, 0.92, 0.05, 0); cym(0.18, -0.78, 0.95, 0.05, 0);
    cym(0.27, 0.92, 1.12, -0.25, -0.25); cym(0.22, -0.42, 1.25, -0.38, 0.3);
    cyl(0.17, 0.17, 0.08, M.velvet, 0, 0.46, -0.6, g, 20); cyl(0.02, 0.02, 0.42, M.chrome, 0, 0.21, -0.6, g, 6);
    register(g, 'drums', new THREE.Vector3(0.2, 1.3, 0));
  }

  // horns: trumpet + saxophone on stands, a music stand
  {
    const g = place(56, 2.85);
    g.rotation.y = facing(56);
    // trumpet stand
    const tg = add(new THREE.Group(), g); tg.position.set(-0.35, 0, 0);
    [0, 2.1, 4.2].forEach(a => { const l = cyl(0.008, 0.008, 0.26, M.black, Math.cos(a) * 0.1, 0.06, Math.sin(a) * 0.1, tg, 6); l.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1); });
    cyl(0.012, 0.012, 0.42, M.black, 0, 0.25, 0, tg, 6);
    const t = add(new THREE.Group(), tg); t.position.set(0, 0.62, 0); t.rotation.set(0.15, 0.6, Math.PI / 2); t.scale.setScalar(1.9);
    const tube = (pts, r = 0.011) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 48, r, 8), M.brass, 0, 0, 0, t);
    tube([[-0.34, 0.05, 0], [0.0, 0.05, 0], [0.15, 0.05, 0], [0.2, 0.0, 0], [0.15, -0.05, 0], [-0.12, -0.05, 0], [-0.18, -0.01, 0], [-0.12, 0.02, 0.02]]);
    tube([[-0.06, 0.0, 0.03], [0.1, 0.0, 0.03], [0.22, 0.0, 0.03]], 0.012);
    const prof = []; for (let i = 0; i <= 14; i++) { const u = i / 14; prof.push(new THREE.Vector2(0.012 + Math.pow(u, 3.2) * 0.075, u * 0.17)); }
    const bellMat = soft(0xe6b04c, { emissive: 0x3a2205, side: THREE.DoubleSide });
    mesh(new THREE.LatheGeometry(prof, 28), bellMat, 0.22, 0, 0.03, t).rotation.z = -Math.PI / 2;
    [-0.06, -0.02, 0.02].forEach(x => { cyl(0.016, 0.016, 0.13, M.brass, x, 0, 0.015, t, 12); cyl(0.02, 0.02, 0.012, M.ivory, x, 0.072, 0.015, t, 12); });
    register(tg, 'trumpet', new THREE.Vector3(0, 1.3, 0));

    // saxophone
    const sg = add(new THREE.Group(), g); sg.position.set(0.32, 0, 0.05);
    [0, 2.1, 4.2].forEach(a => { const l = cyl(0.008, 0.008, 0.3, M.black, Math.cos(a) * 0.12, 0.07, Math.sin(a) * 0.12, sg, 6); l.rotation.set(Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0); });
    const sax = add(new THREE.Group(), sg); sax.position.set(0, 0.16, 0); sax.rotation.y = -0.4;
    const body = new THREE.CatmullRomCurve3([[0.0, 0.95], [0.02, 0.7], [0.03, 0.4], [0.03, 0.18], [0.07, 0.04], [0.15, 0.03], [0.2, 0.12], [0.21, 0.3]].map(([x, y]) => new THREE.Vector3(x, y, 0)));
    const radius = u => 0.022 + u * 0.05;
    const sgeo = new THREE.TubeGeometry(body, 64, 1, 12);
    const sp = sgeo.attributes.position;
    // taper the tube from mouthpiece to bell
    for (let i = 0; i < sp.count; i++) {
      const seg = Math.floor(i / 13) / 64, c = body.getPointAt(Math.min(1, seg));
      const dx = sp.getX(i) - c.x, dy = sp.getY(i) - c.y, dz = sp.getZ(i) - c.z, r = radius(seg);
      sp.setXYZ(i, c.x + dx * r, c.y + dy * r, c.z + dz * r);
    }
    sgeo.computeVertexNormals();
    mesh(sgeo, M.brass, 0, 0, 0, sax);
    const bprof = []; for (let i = 0; i <= 10; i++) { const u = i / 10; bprof.push(new THREE.Vector2(0.07 + Math.pow(u, 2.5) * 0.06, u * 0.08)); }
    mesh(new THREE.LatheGeometry(bprof, 24), bellMat, 0.21, 0.3, 0, sax);
    const neck = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.95, 0), new THREE.Vector3(-0.03, 1.05, 0), new THREE.Vector3(-0.1, 1.08, 0)]), 16, 0.012, 8), M.brass, 0, 0, 0, sax);
    neck.castShadow = false;
    for (let k = 0; k < 7; k++) sphere(0.013, M.ivory, 0.045, 0.3 + k * 0.08, 0.02, sax, 8);
    register(sg, 'sax', new THREE.Vector3(0.1, 1.2, 0));

    // music stand with a chart
    const ms = add(new THREE.Group(), g); ms.position.set(0.05, 0, 0.55);
    cyl(0.01, 0.01, 1.05, M.black, 0, 0.52, 0, ms, 6);
    const desk = box(0.48, 0.34, 0.012, M.black, 0, 1.1, 0, ms); desk.rotation.x = -0.35;
    const chart = add(new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.3), soft(0xffffff, { map: sheetTex })), ms);
    chart.position.set(0, 1.11, 0.01); chart.rotation.x = -0.35;
  }

  /* ================= your table ================= */
  {
    const g = add(new THREE.Group()); g.position.set(0, 0, -0.55);
    cyl(0.42, 0.42, 0.04, M.wood, 0, 0.74, 0, g, 40);
    cyl(0.43, 0.43, 0.012, M.woodDark, 0, 0.715, 0, g, 40);
    cyl(0.045, 0.045, 0.7, M.black, 0, 0.36, 0, g, 10);
    // candle lamp
    cyl(0.035, 0.03, 0.08, M.amberGlass, 0.14, 0.8, -0.08, g, 16);
    cyl(0.05, 0.06, 0.02, M.brass, 0.14, 0.765, -0.08, g, 14);
    const flame = glowSprite(0xffb050, 0.32, new THREE.Vector3(0.14, 0.83, -0.08), 0.9, g);
    const L = add(new THREE.PointLight(0xff9a50, 0.7, 2.2, 2), g); L.position.set(0.14, 0.95, -0.08);
    v.candles = [{ L, flame, seed: 1, base: 0.7 }];
    // a drink
    cyl(0.04, 0.036, 0.09, M.glass, -0.18, 0.805, 0.05, g, 16);
    cyl(0.035, 0.033, 0.045, soft(0xc4701c, { emissive: 0x5a2a06, transparent: true, opacity: 0.85 }), -0.18, 0.785, 0.05, g, 16);
    box(0.03, 0.03, 0.03, soft(0xe8f0f0, { transparent: true, opacity: 0.6 }), -0.17, 0.8, 0.05, g);
    // bud vase with a flower
    cyl(0.025, 0.035, 0.12, soft(0x4a7a8a, { transparent: true, opacity: 0.8 }), -0.04, 0.82, -0.2, g, 12);
    cyl(0.003, 0.003, 0.18, M.plantDark, -0.04, 0.95, -0.2, g, 4);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const p = sphere(0.022, soft(0xc8342c), -0.04 + Math.cos(a) * 0.02, 1.05, -0.2 + Math.sin(a) * 0.02, g, 8); p.scale.y = 0.6; }
    sphere(0.012, soft(0xf2c050), -0.04, 1.06, -0.2, g, 8);
    // program card naming tonight's player
    const card = add(new THREE.Group(), g); card.position.set(0.17, 0.74, 0.14); card.rotation.y = -0.35;
    const front = add(new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.12), soft(0xffffff, { map: cardTex, side: THREE.DoubleSide })), card);
    front.position.set(0, 0.055, 0.02); front.rotation.x = -0.32;
    const back = add(new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.12), M.paper), card);
    back.position.set(0, 0.055, -0.02); back.rotation.x = 0.32;
  }

  // neighbouring tables
  const sideTable = (x, z) => {
    const g = add(new THREE.Group()); g.position.set(x, 0, z);
    cyl(0.42, 0.42, 0.04, M.wood, 0, 0.74, 0, g, 30);
    cyl(0.04, 0.04, 0.72, M.black, 0, 0.36, 0, g, 8);
    cyl(0.22, 0.24, 0.03, M.black, 0, 0.015, 0, g, 20);
    [0.9, -0.6].forEach((a, i) => {
      const ch = add(new THREE.Group(), g); ch.position.set(Math.sin(a) * 0.7, 0, Math.cos(a) * 0.7); ch.rotation.y = a + Math.PI;
      box(0.42, 0.05, 0.42, M.velvet, 0, 0.46, 0, ch);
      box(0.42, 0.5, 0.05, M.woodDark, 0, 0.72, -0.2, ch);
      [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(([lx, lz]) => box(0.04, 0.46, 0.04, M.woodDark, lx, 0.23, lz, ch));
    });
    cyl(0.035, 0.03, 0.08, M.amberGlass, 0, 0.8, 0, g, 14);
    const flame = glowSprite(0xffb050, 0.3, new THREE.Vector3(0, 0.82, 0), 0.9, g);
    const L = add(new THREE.PointLight(0xff9a50, 1.2, 2.5, 2), g); L.position.set(0, 0.95, 0);
    v.candles.push({ L, flame, seed: rand(0, 100), base: 1.2 });
  };
  sideTable(-2.5, -0.1);
  sideTable(2.45, 0.6);

  /* ================= left wall: records, posters, sconces, plants ================= */
  {
    const shelfX = -4.55;
    [1.35, 1.75].forEach(y => box(0.25, 0.035, 1.6, M.woodDark, shelfX + 0.12, y, -2.6));
    const sleeveCols = [0xc8342c, 0xe6b04c, 0x2f5a44, 0xf1e4c8, 0x3a4a7a, 0x8a5230, 0x1a1412];
    [1.37, 1.77].forEach(y => { for (let z = -3.35; z < -1.85; z += rand(0.025, 0.05)) box(0.2, rand(0.28, 0.32), 0.012, soft(sleeveCols[Math.floor(Math.random() * sleeveCols.length)]), shelfX + 0.12, y + 0.16, z).rotation.x = rand(-0.08, 0.08); });
    [[posterTex('#e9c79a', '#c8412c', 'Live jazz', 'Fridays at nine', 'horn'), -3.9], [posterTex('#2e4a3d', '#f2a65a', 'Late set', 'Piano trio', 'keys'), -0.9]].forEach(([tex, z]) => {
      const p = add(new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.85), soft(0xffffff, { map: tex })));
      p.position.set(-4.535, 2.25, z); p.rotation.y = Math.PI / 2;
      const fr = box(0.04, 0.92, 0.67, M.woodDark, -4.565, 2.25, z); fr.castShadow = false;
    });
    [-2.6, 0.2].forEach(z => sconce(-4.5, 2.25, z, Math.PI / 2));
  }
  function sconce(x, y, z, ry) {
    const g = add(new THREE.Group()); g.position.set(x, y, z); g.rotation.y = ry;
    box(0.08, 0.16, 0.03, M.brass, 0, 0, 0, g);
    const shade = mesh(new THREE.CylinderGeometry(0.06, 0.11, 0.14, 16, 1, true), soft(0xf0d8a8, { side: THREE.DoubleSide, emissive: 0x6a3a10 }), 0, 0.05, 0.12, g);
    shade.castShadow = false;
    glowSprite(0xffb46b, 0.9, new THREE.Vector3(0, 0.05, 0.14), 0.45, g);
    const L = add(new THREE.PointLight(0xffb06a, 1.5, 3, 2), g); L.position.set(0, 0.05, 0.25);
  }

  // potted plants (big leafy ones — the club is a little overgrown)
  const plant = (x, z, scale = 1) => {
    const g = add(new THREE.Group()); g.position.set(x, 0, z); g.scale.setScalar(scale);
    cyl(0.22, 0.16, 0.4, M.terracotta, 0, 0.2, 0, g, 16);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + rand(-0.2, 0.2), tilt = rand(0.4, 1.1), len = rand(0.35, 0.6);
      const stem = add(new THREE.Group(), g); stem.position.y = 0.38; stem.rotation.set(Math.cos(a) * tilt, 0, -Math.sin(a) * tilt);
      cyl(0.006, 0.008, len, M.plantDark, 0, len / 2, 0, stem, 4);
      const leaf = mesh(new THREE.SphereGeometry(1, 12, 8), soft(0xffffff, { map: T.leaf, color: i % 3 ? 0xffffff : 0xc8e0b0 }), 0, len + 0.08, 0, stem);
      leaf.scale.set(0.16, 0.02, 0.1); leaf.rotation.y = a;
    }
  };
  plant(-4.0, -4.6, 1.3);
  plant(4.0, -4.6, 1.1);
  plant(-4.1, 1.2, 1.0);

  /* ================= right wall: window, bar ================= */
  {
    const win = add(new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.4), basic({ map: windowTex, fog: false })));
    win.position.set(4.58, 2.0, -3.3); win.rotation.y = -Math.PI / 2;
    const rain = add(new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.4), basic({ map: rainTex, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
    rain.position.set(4.57, 2.0, -3.3); rain.rotation.y = -Math.PI / 2;
    v.rain = rainTex;
    [[2.72, 1.75, 0.08], [1.28, 1.75, 0.1], [2.0, 0.06, 1.5]].forEach(([y, w, h], i) => box(0.08, i === 2 ? 1.5 : h, i === 2 ? 0.06 : w, M.woodDark, 4.54, y, -3.3));
    [-4.1, -2.5].forEach(z => box(0.08, 1.52, 0.08, M.woodDark, 4.54, 2.0, z));
    box(0.28, 0.06, 1.9, M.woodDark, 4.45, 1.25, -3.3);
    // ivy creeping around the window frame
    for (let i = 0; i < 70; i++) {
      const t = i / 70, a = t * Math.PI * 1.4 - 0.2;
      const lf = mesh(new THREE.SphereGeometry(1, 8, 6), i % 2 ? M.plant : M.plant2, 4.5, 2.0 + Math.sin(a) * 0.95 + rand(-0.06, 0.06), -3.3 + Math.cos(a) * 1.0 + rand(-0.06, 0.06));
      lf.scale.set(0.015, 0.06, 0.06); lf.rotation.x = rand(0, 3); lf.castShadow = false;
    }
    const winLight = add(new THREE.PointLight(0x6a8ad8, 3, 4, 2)); winLight.position.set(4.0, 2.0, -3.3);

    // bar counter along the right wall, near your seat
    box(0.6, 1.02, 2.8, M.woodDark, 4.15, 0.51, 0.8);
    box(0.8, 0.06, 2.9, M.woodLight, 4.1, 1.05, 0.8);
    const rail = cyl(0.022, 0.022, 2.8, M.brass, 3.78, 0.2, 0.8, scene, 10); rail.rotation.x = Math.PI / 2;
    [0.0, 0.9, 1.8].forEach(z => {
      cyl(0.19, 0.19, 0.07, M.velvet, 3.45, 0.78, z, scene, 18);
      cyl(0.026, 0.026, 0.76, M.chrome, 3.45, 0.4, z, scene, 8);
      cyl(0.2, 0.22, 0.03, M.chrome, 3.45, 0.015, z, scene, 18);
    });
    const bottleCols = [0x9a5a1a, 0x2f5a2c, 0x8a1f1a, 0xc9b38a, 0x6b3a14];
    const bottleGeo = new THREE.LatheGeometry([[0, 0], [0.045, 0], [0.05, 0.02], [0.05, 0.18], [0.035, 0.22], [0.016, 0.26], [0.016, 0.33], [0, 0.33]].map(([x, y]) => new THREE.Vector2(x, y)), 12);
    [1.45, 1.9].forEach(y => {
      box(0.3, 0.035, 2.4, M.woodDark, 4.45, y, 0.8);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 2.4), basic({ color: 0xffa050 }))).position.set(4.3, y - 0.03, 0.8);
      for (let z = -0.3; z < 1.9; z += rand(0.13, 0.22)) {
        const c = bottleCols[Math.floor(Math.random() * bottleCols.length)];
        const b = mesh(bottleGeo, soft(c, { emissive: new THREE.Color(c).multiplyScalar(0.35) }), 4.45 + rand(-0.06, 0.06), y + 0.02, z);
        b.castShadow = false;
      }
    });
    const bl = add(new THREE.PointLight(0xffa050, 2, 3, 2)); bl.position.set(4.0, 1.7, 0.8);
  }

  /* ================= ceiling: string lights, pendants, hanging vines ================= */
  const bulbs = [];
  {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const a = (-85 + 170 * i / 40) * D2R, r = 3.3;
      const p = new THREE.Vector3(Math.sin(a) * r, 3.05 - Math.abs(Math.sin(i / 40 * Math.PI * 4)) * 0.22, -Math.cos(a) * r - 0.4);
      pts.push(p);
      if (i % 2) {
        add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), basic({ color: 0xffd28a }))).position.copy(p).y -= 0.05;
        bulbs.push(glowSprite(0xffb060, 0.36, p.clone().add(new THREE.Vector3(0, -0.05, 0)), 0.5));
      }
    }
    add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x1a0f0a })));
  }
  [[-2.5, -0.1], [2.45, 0.6]].forEach(([x, z]) => {
    cyl(0.005, 0.005, 1.1, M.black, x, 2.85, z, scene, 4);
    const shade = mesh(new THREE.CylinderGeometry(0.06, 0.26, 0.22, 20, 1, true), M.green, x, 2.25, z); shade.castShadow = false;
    add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), basic({ color: 0xffd7a0 }))).position.set(x, 2.15, z);
    glowSprite(0xffa860, 1.0, new THREE.Vector3(x, 2.12, z), 0.5);
    const L = add(new THREE.PointLight(0xffa860, 2.5, 4, 2)); L.position.set(x, 2.05, z);
  });
  // trailing vines from the beams
  const vineLeaf = new THREE.SphereGeometry(1, 8, 6);
  for (let k = 0; k < 14; k++) {
    const x = rand(-4.3, 4.3), z = [-4.4, -3.0, -1.6][k % 3] + rand(-0.1, 0.1), len = rand(0.4, 1.3);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 3.22, z), new THREE.Vector3(x + rand(-0.15, 0.15), 3.22 - len * 0.5, z + rand(-0.1, 0.1)), new THREE.Vector3(x + rand(-0.2, 0.2), 3.22 - len, z)]);
    const vine = mesh(new THREE.TubeGeometry(curve, 12, 0.006, 4), M.plantDark); vine.castShadow = false;
    for (let i = 0; i < len * 14; i++) {
      const p = curve.getPointAt(i / (len * 14));
      const lf = mesh(vineLeaf, i % 2 ? M.plant : M.plant2, p.x + rand(-0.04, 0.04), p.y, p.z + rand(-0.04, 0.04));
      lf.scale.set(0.045, 0.012, 0.035); lf.rotation.set(rand(-0.6, 0.6), rand(0, 3), rand(-0.6, 0.6)); lf.castShadow = false;
    }
  }

  /* ================= light ================= */
  add(new THREE.HemisphereLight(0xffd6a8, 0x2a1a30, 0.5));
  add(new THREE.AmbientLight(0x4a3040, 0.45));
  const spot = add(new THREE.SpotLight(0xfff0d0, 22, 9, 0.42, 0.7, 1.4));
  spot.position.set(0, 3.3, -0.9);
  spot.target.position.set(0, 0.3, -2.5); add(spot.target);
  if (!lowPower) { spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0005; }
  const pianoSpot = add(new THREE.SpotLight(0xffc080, 16, 8, 0.4, 0.8, 1.5));
  pianoSpot.position.set(-1.6, 3.3, -0.8); pianoSpot.target.position.copy(polar(-58, 3.35)); add(pianoSpot.target);
  const drumSpot = add(new THREE.SpotLight(0xffa080, 14, 8, 0.4, 0.8, 1.5));
  drumSpot.position.set(1.6, 3.3, -0.8); drumSpot.target.position.copy(polar(30, 3.4)); add(drumSpot.target);
  // light shafts
  [[spot, 0.16], [pianoSpot, 0.08], [drumSpot, 0.07]].forEach(([s, o]) => {
    const from = s.position.clone(), to = s.target.position.clone(), h = from.distanceTo(to);
    const geo = new THREE.ConeGeometry(Math.tan(s.angle) * h * 0.85, h, 40, 1, true); geo.translate(0, -h / 2, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uH: { value: h }, uC: { value: s.color.clone() }, uO: { value: o } },
      vertexShader: `uniform float uH; varying float vT; varying float vF; void main(){ vT = -position.y / uH; vec4 mv = modelViewMatrix * vec4(position,1.0); vec3 n = normalize(normalMatrix * normal); vF = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uC; uniform float uO; varying float vT; varying float vF; void main(){ float a = uO * pow(vF, 2.0) * smoothstep(0.0, 0.2, vT) * (1.0 - smoothstep(0.75, 1.0, vT)); gl_FragColor = vec4(uC, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    });
    const cone = add(new THREE.Mesh(geo, mat));
    cone.position.copy(from);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.sub(from).normalize());
  });

  /* ================= atmosphere ================= */
  const DUST = lowPower ? 40 : 70;
  const dustGeo = new THREE.BufferGeometry();
  const dp = new Float32Array(DUST * 3), ds = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) { const p = polar(rand(-80, 80), rand(1.2, 4.5)); dp.set([p.x, rand(0.4, 3.1), p.z], i * 3); ds[i] = rand(0, 100); }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dustBase = dp.slice();
  add(new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.06, map: glow, color: 0xffe2b0, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending })));
  const smokeTex = smokeTexture();
  const smoke = [];
  for (let i = 0; i < 6; i++) {
    const s = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xffc89a, transparent: true, opacity: 0.3, depthWrite: false })));
    s.position.copy(polar(rand(-60, 60), rand(2, 4))); s.position.y = rand(1.8, 3.0);
    s.scale.setScalar(rand(2, 3.4)); s.userData.seed = rand(0, 100);
    smoke.push(s);
  }

  /* ================= notes ================= */
  const noteTex = noteTextures();
  const noteCols = [0xfff1dc, 0xffcf8a, 0xff9a5a, 0xf2c15c, 0xffe6c4];
  const notes = [];
  function spawnNote(pos, burst = false) {
    if (notes.length > 90) { const o = notes.shift(); scene.remove(o); o.material.dispose(); }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex[Math.floor(Math.random() * noteTex.length)], color: noteCols[Math.floor(Math.random() * noteCols.length)], transparent: true, depthWrite: false, opacity: 0, fog: false }));
    s.position.copy(pos);
    s.userData = { vel: new THREE.Vector3(rand(-0.2, 0.2) * (burst ? 2 : 1), rand(0.35, 0.7), rand(0, 0.2)), life: 0, max: rand(2.4, 3.4), size: rand(0.16, 0.26), phase: rand(0, TAU) };
    scene.add(s); notes.push(s);
  }
  const emitFrom = (inst, n = 1, burst = false) => {
    for (let i = 0; i < n; i++) spawnNote(inst.localToWorld(inst.userData.emit.clone().add(new THREE.Vector3(rand(-0.2, 0.2), rand(-0.1, 0.2), rand(-0.1, 0.1)))), burst);
    inst.userData.bounce = 1;
  };

  /* ================= looking around ================= */
  const MAXYAW = 0.85;
  let yaw = 0.7, yawTarget = 0.7, dragYaw = 0, interacted = false, introPan = reduceMotion ? 0 : 1;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const pickables = []; instruments.forEach(g => g.traverse(o => { if (o.isMesh) pickables.push(o); }));
  let clock = 0, lastSpawn = 0, lastInteract = -10;
  const pick = e => {
    const r = host.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    return hit ? { inst: hit.object.userData.instrument, point: hit.point } : null;
  };
  let dragging = false, dragX = 0;
  host.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') {
      if (dragging) { dragYaw = clamp(dragYaw + (e.clientX - dragX) / host.clientWidth * 2.2, -MAXYAW, MAXYAW); dragX = e.clientX; }
      return;
    }
    interacted = true;
    const h = pick(e);
    host.classList.toggle('hovering', !!h);
    if (h && clock - lastSpawn > 0.07) {
      lastSpawn = clock; lastInteract = clock;
      spawnNote(h.point.clone().add(new THREE.Vector3(rand(-0.08, 0.08), 0.12, 0.08)));
      h.inst.userData.bounce = Math.max(h.inst.userData.bounce, 0.6);
    }
  });
  host.addEventListener('pointerdown', e => {
    interacted = true;
    if (e.pointerType === 'touch') { dragging = true; dragX = e.clientX; }
    const h = pick(e);
    if (h) { emitFrom(h.inst, 7, true); lastInteract = clock; }
  });
  window.addEventListener('pointerup', () => { dragging = false; });
  host.addEventListener('pointerleave', () => host.classList.remove('hovering'));
  window.addEventListener('keydown', e => {
    if (!v.visible || v.active === false) return;
    if (e.key === 'ArrowLeft') { dragYaw = clamp(dragYaw + 0.25, -MAXYAW, MAXYAW); interacted = true; }
    if (e.key === 'ArrowRight') { dragYaw = clamp(dragYaw - 0.25, -MAXYAW, MAXYAW); interacted = true; }
  });

  /* ================= scroll framing + ink ================= */
  let frame = 0, slotX = 0, slotY = 0;
  v.setFrame = (k, sx, sy) => { frame = k; slotX = sx; slotY = sy; };
  v.setInk = x => { pass.uniforms.uInk.value = x; };

  let idleTimer = 1.5;
  v.update = (time, dt, rdt) => {
    clock += rdt;
    const P = v.pointer;
    // yaw: mouse position across the screen (eased at the centre), touch drag, arrow keys, and a slow intro pan
    if (introPan > 0) introPan = Math.max(0, introPan - rdt * (interacted ? 1.5 : 0.22));
    const ip = introPan * introPan * (3 - 2 * introPan);
    const mouseYaw = isTouch ? 0 : -Math.sign(P.sx) * Math.pow(Math.abs(P.sx), 1.35) * MAXYAW;
    yawTarget = clamp(mouseYaw + dragYaw, -MAXYAW, MAXYAW) * (1 - ip) + 0.7 * ip;
    yawTarget *= 1 - frame;
    yaw = lerp(yaw, yawTarget, 1 - Math.exp(-rdt * 3));
    camera.position.set(CAM.x + Math.sin(time * 0.3) * 0.02, CAM.y + Math.sin(time * 0.45) * 0.012, CAM.z);
    camera.rotation.set(-0.09 + P.sy * 0.05 - frame * 0.04, yaw, 0);
    const fov = lerp(52, 46, frame);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    if (frame > 0.001) camera.setViewOffset(v.w, v.h, (v.w / 2 - slotX) * frame, (v.h / 2 - slotY) * frame, v.w, v.h);
    else if (camera.view) camera.clearViewOffset();

    instruments.forEach(g => {
      const b = g.userData.bounce;
      if (b > 0.001) { g.userData.bounce *= Math.exp(-rdt * 5); g.scale.setScalar(1 + Math.sin(clock * 30) * 0.012 * b); } else g.scale.setScalar(1);
    });
    idleTimer -= dt;
    if (idleTimer <= 0 && clock - lastInteract > 2.5) {
      idleTimer = rand(1.0, 1.8);
      emitFrom(instruments[Math.floor(Math.random() * instruments.length)], 1 + Math.floor(Math.random() * 2));
    }
    for (let i = notes.length - 1; i >= 0; i--) {
      const s = notes[i], u = s.userData;
      u.life += rdt;
      const t = u.life / u.max;
      if (t >= 1) { scene.remove(s); s.material.dispose(); notes.splice(i, 1); continue; }
      s.position.addScaledVector(u.vel, rdt);
      s.position.x += Math.sin(u.life * 3 + u.phase) * 0.003;
      u.vel.y *= 1 - rdt * 0.25;
      const pop = Math.min(1, u.life / 0.22);
      const sc = u.size * (pop < 1 ? (1 - Math.pow(1 - pop, 3)) + Math.sin(pop * Math.PI) * 0.25 : 1);
      s.scale.set(sc, sc, 1);
      s.material.opacity = t < 0.08 ? t / 0.08 : 1 - clamp((t - 0.6) / 0.4, 0, 1);
      s.material.rotation = Math.sin(u.life * 2 + u.phase) * 0.35;
    }

    v.rain.offset.y += dt * 1.5; v.rain.offset.x += dt * 0.2;
    v.neon.material.opacity = Math.sin(time * 0.7) > 0.985 ? 0.4 : 0.95 + Math.sin(time * 13) * 0.05;
    v.candles.forEach(c => { const f = 0.8 + Math.sin(time * 9 + c.seed) * 0.12 + Math.sin(time * 23 + c.seed) * 0.08; c.L.intensity = c.base * f; c.flame.scale.set(0.3 * f, 0.38 * f, 1); });
    bulbs.forEach((b, i) => { b.material.opacity = 0.42 + Math.sin(time * 1.3 + i) * 0.1; });
    for (let i = 0; i < DUST; i++) {
      const s = ds[i];
      dp[i * 3] = dustBase[i * 3] + Math.sin(time * 0.15 + s) * 0.25;
      dp[i * 3 + 1] = dustBase[i * 3 + 1] + Math.sin(time * 0.11 + s * 1.3) * 0.2;
      dp[i * 3 + 2] = dustBase[i * 3 + 2] + Math.cos(time * 0.13 + s) * 0.25;
    }
    dustGeo.attributes.position.needsUpdate = true;
    smoke.forEach(s => { s.material.rotation = time * 0.03 + s.userData.seed; });
    v.catBody.scale.y = 0.1 + Math.sin(time * 1.6) * 0.005;
  };
  return v;
}
