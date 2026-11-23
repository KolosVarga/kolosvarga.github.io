/* An original painted cove with independently animated boats, rigging, people and water.
   All nudges are bounded springs around a mooring; the visitor never displaces the harbor.
   Static paint is cached. Only the visible scene animates, at 30fps and capped DPR. */
import { visibleLoop, reduceMotion, clamp } from './site.js';

const scene = document.getElementById('harbor');
if (scene) initHarbor();

function initHarbor() {
  const canvas = scene.querySelector('canvas'), ctx = canvas.getContext('2d');
  const pause = document.getElementById('harbor-pause');
  const TAU = Math.PI * 2, WW = 1600, HH = 1000;
  let time = 0, paused = false, width = 1, height = 1, scale = 1, ox = 0, oy = 0;
  let cameraX = 0, cameraY = 0, lastTouch = -9;
  const image = new Image();
  image.src = new URL('../assets/harbor/painted-cove.png', import.meta.url).href;
  image.onload = () => draw();
  const ripples = [];
  const rand = (a, b) => a + seeded() * (b - a);
  let seed = 237;
  function seeded() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  function path(g, d, fill, stroke = '#586558', lw = 1.5) {
    const p = new Path2D(d);
    g.lineJoin = 'round'; g.lineCap = 'round';
    if (fill) { g.fillStyle = fill; g.fill(p); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(p); }
    return p;
  }
  function line(g, points, color, lw = 1) { path(g, points, null, color, lw); }
  function ellipse(g, x, y, rx, ry, fill) { g.fillStyle = fill; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); }

  // Small translucent pigment marks give the code-painted layers the same imperfect finish
  // as the background. They are painted once, never randomized on every frame.
  function pigment(g, p, bounds, colors, n = 100) {
    g.save(); g.clip(p);
    for (let i = 0; i < n; i++) {
      g.globalAlpha = rand(.04, .16); g.fillStyle = colors[i % colors.length];
      const x = rand(bounds[0], bounds[2]), y = rand(bounds[1], bounds[3]);
      g.fillRect(x, y, rand(3, 22), rand(.5, 3));
    }
    g.restore();
  }

  function boatArt(color, sailType) {
    const c = document.createElement('canvas'); c.width = 600; c.height = 700;
    const g = c.getContext('2d'); g.scale(2, 2); g.translate(150, 296);
    // keel, hull, rubbing strake and deck
    const hull = path(g, 'M-106 -11 Q-56 -2 1 -4 Q68 -1 112 -18 Q89 12 59 21 Q-45 38 -91 8 Z', color, '#455b57', 1.8);
    pigment(g, hull, [-110, -20, 115, 35], ['#e9dbad', '#1f4e50', '#9d4d37'], 280);
    path(g, 'M-100 -12 Q-27 -19 54 -15 L111 -20 L107 -13 Q24 -3 -98 -5 Z', '#d5c09a', '#766f57', 1);
    line(g, 'M-90 4 Q6 24 88 4', '#e0c898', 1.1);
    path(g, 'M-34 -17 L-25 -39 L19 -41 L38 -18 Z', '#e1d8ac', '#6e7764', 1);
    path(g, 'M-26 -34 L-10 -34 L-10 -23 L-29 -23 Z M-3 -34 L13 -34 L23 -23 L-3 -23 Z', '#567c78', '#8b9178', .8);
    // mast and boom: slight wavering contours instead of ruler-straight geometry
    path(g, 'M-12 -14 L-14 -263 L-11 -265 L-8 -15 Z', '#b49b72', '#766d53', 1.2);
    line(g, 'M-88 -10 Q-49 -139 -13 -259 L98 -17', '#737d69', .8);
    line(g, 'M-13 -257 Q-10 -156 -10 -18 M-11 -165 L-35 -13', '#b3b699', .6);
    if (sailType !== 'furled') {
      const main = path(g, sailType === 'tan'
        ? 'M-17 -247 Q-36 -190 -88 -65 Q-59 -67 -18 -55 Z'
        : 'M-18 -247 Q-39 -185 -91 -60 Q-55 -51 -19 -54 Z', sailType === 'tan' ? '#c98b61' : '#f2e7c5', '#8e8f75', 1.1);
      pigment(g, main, [-95, -250, -17, -50], ['#fff9e0', '#9b966d', '#c4ac7c'], 360);
      for (let j = 0; j < 5; j++) line(g, `M-19 ${-219+j*30} Q-41 ${-198+j*26} ${-34-j*11} ${-195+j*31}`, '#afa68666', .7);
      const jib = path(g, 'M-8 -229 Q17 -148 91 -36 Q39 -47 -4 -43 Z', '#e4daba', '#8e8f75', 1.1);
      pigment(g, jib, [-9, -234, 95, -35], ['#fff5d0', '#b4af86'], 280);
      line(g, 'M-5 -181 Q20 -99 62 -44', '#c6bfa0', .7);
      if (sailType === 'striped') {
        g.save(); g.clip(main); g.globalAlpha = .48;
        path(g, 'M-97 -114 L-10 -127 L-10 -105 L-97 -92 Z', '#b76e54', null);
        path(g, 'M-97 -154 L-10 -167 L-10 -159 L-97 -146 Z', '#b76e54', null);
        g.restore();
      }
      // short boom below the sail and tiny sewn-on patches
      line(g, 'M-16 -51 L-96 -55', '#8c795c', 2.3);
      path(g, 'M-37 -85 l10 -1 l-1 11 l-10 0 Z', '#d5cca9', '#aaa78c', .4);
    } else {
      path(g, 'M-15 -57 Q-48 -60 -94 -53 L-93 -45 Q-53 -40 -16 -47 Z', '#e5dbc0', '#9b977e', 1.2);
      for (let x = -85; x < -20; x += 13) line(g, `M${x} -55 l-1 10`, '#9b9379', .8);
    }
    // fenders, deck cleats, rudder, life ring
    [-68, 51].forEach(x => { line(g, `M${x} -7 l-1 17`, '#818b77', .8); ellipse(g, x-1, 11, 3, 9, '#e9e1c6'); });
    line(g, 'M-98 -13 l-10 -7 M-105 -23 l-2 9 M88 -21 l8 -3', '#6a705f', 1.2);
    ellipse(g, 37, -11, 7, 7, '#b76e51'); ellipse(g, 37, -11, 3.5, 3.5, '#d8cfac');
    return c;
  }

  const boats = [
    { x: 170, y: 596, s: .64, color: '#5b8581', sail: 'tan' },
    { x: 390, y: 622, s: .8, color: '#a05e49', sail: 'white' },
    { x: 650, y: 666, s: .88, color: '#496879', sail: 'striped' },
    { x: 925, y: 697, s: .72, color: '#d0a15e', sail: 'furled' },
    { x: 1200, y: 736, s: 1, color: '#5d7771', sail: 'white' },
    { x: 1470, y: 771, s: .82, color: '#a15c48', sail: 'tan' },
    { x: 640, y: 910, s: .78, color: '#a96c48', sail: 'furled', front: true },
    { x: 1150, y: 929, s: .6, color: '#5c7a89', sail: 'white', front: true }
  ].map((b,i) => ({ ...b, id: i, phase: i*1.8, nudge: 0, v: 0, lift: 0, art: boatArt(b.color, b.sail) }));
  const people = [{ x: 460, y: 676, shirt: '#708993', hat: true, arm: 0 }, { x: 1035, y: 755, shirt: '#ae6c52', seated: true, arm: 0 }];
  const waves = Array.from({length: 105}, () => ({ x: rand(0, WW), y: rand(445, HH), len: rand(6, 47), phase: rand(0,TAU), speed: rand(.3,.7), a: rand(.07,.26) }));
  const birds = Array.from({length: 5}, (_,i) => ({ x: rand(700,1550), y: rand(180,360), s: rand(2,4), phase: i*1.9 }));

  // The pier is painted once, including grain, joints, piling reflections, ropes and pots.
  const pier = document.createElement('canvas'); pier.width = WW; pier.height = HH;
  const pg = pier.getContext('2d');
  function deckY(x) { return 601 + x*.136; }
  path(pg, 'M-30 625 L1600 847 L1600 875 L-30 652 Z', '#455e5480', null);
  for (let x = -20; x < 1650; x += 174) {
    const y = deckY(x);
    path(pg, `M${x-7} ${y+7} l14 2 l-2 95 l-12 -2 Z`, '#827255', '#5f6d57', 1.3);
    line(pg, `M${x-2} ${y+24} l-1 67`, '#b09b70', 1.7);
    line(pg, `M${x-8} ${y+105} q12 3 30 0`, '#5d9585', 5);
  }
  const deck = path(pg, 'M-30 585 L1600 807 L1600 852 L-30 630 Z', '#b69d72', '#6a745b', 1.7);
  pigment(pg, deck, [0,585,WW,860], ['#efd4a3','#615f46','#967f5e'], 1600);
  for (let x = 0; x < 1640; x += 23) {
    const y = 589+x*.136;
    line(pg, `M${x} ${y} l-8 40`, '#786f528c', 1.1);
    line(pg, `M${x+7} ${y+6} l-4 20 M${x+9} ${y+29} l-2 6`, '#e5c68c9a', .8);
    ellipse(pg, x+4, y+8, 1, 1, '#655f4a');
  }
  line(pg, 'M-30 634 L1600 856', '#71684e', 4);
  line(pg, 'M-30 630 L1600 852', '#d7bf8b', 2);
  for (let x = 50; x < 1600; x += 174) {
    const y = deckY(x);
    path(pg, `M${x-5} ${y-16} l10 1 l-1 47 l-10 -1 Z`, '#8c795b', '#5f6a54', 1);
    ellipse(pg, x, y-16, 6, 2.4, '#d1b783');
    line(pg, `M${x-7} ${y+5} q13 8 19 4`, '#b4a27c', 2);
  }
  // coil of rope, bucket and a pot of greenery on the dock
  for (let r = 4; r < 15; r += 3) { pg.strokeStyle = '#d7bc83'; pg.lineWidth = 1.4; pg.beginPath(); pg.ellipse(788, 721, r, r*.35, .14, 0, TAU); pg.stroke(); }
  path(pg, 'M820 702 l14 2 l-2 15 l-11 -1 Z', '#779289', '#586e5e', 1);
  line(pg, 'M820 704 q3 -14 14 1', '#54685b', 1);
  path(pg, 'M118 589 l20 2 l-4 20 l-14 -2 Z', '#b67d53', '#6f7051', 1);
  for (let i=0;i<12;i++) { const a=rand(-2.8,-.3), len=rand(9,27); line(pg, `M128 591 q${Math.cos(a)*len} ${Math.sin(a)*len} ${Math.cos(a)*len*.8} ${Math.sin(a)*len-5}`, i%2 ? '#6f8757':'#496f51', 3); }

  function drawBoat(b, reflection = false) {
    const bob = Math.sin(time*.85+b.phase)*2.2 + b.lift;
    const tilt = Math.sin(time*.63+b.phase)*.012+b.nudge;
    ctx.save(); ctx.translate(b.x, b.y+bob);
    if (reflection) {
      ctx.scale(1, -.33); ctx.globalAlpha=.13;
      ctx.beginPath(); ctx.rect(-140*b.s,-410*b.s,280*b.s,410*b.s); ctx.clip();
    }
    ctx.rotate(tilt); ctx.scale(b.s,b.s);
    ctx.drawImage(b.art, -150, -296, 300,350);
    // Pennants are redrawn independently: the breeze moves the tip and leaves the mast still.
    const f = Math.sin(time*2.3+b.phase)*2;
    path(ctx, `M-11 -259 Q1 ${-260+f} 18 ${-256+f} L-11 -250 Z`, b.id%2 ? '#ba7356':'#697e78', '#80856a', .6);
    ctx.restore();
    if (!reflection) {
      const ax=b.x+(b.front?38:-23), ay=b.front?deckY(b.x)+25:deckY(b.x)-2;
      line(ctx, `M${b.x+78*b.s} ${b.y+bob-11*b.s} Q${ax+40} ${(ay+b.y)/2+9} ${ax} ${ay}`, '#6f7d6499', 1.3);
    }
  }
  function person(p) {
    ctx.save(); ctx.translate(p.x,p.y); const sway=Math.sin(time*.6+p.x)*.8;
    ctx.translate(sway,0);
    if (p.seated) {
      line(ctx, 'M-4 -12 l-4 19 M4 -12 l4 21', '#405f66', 4);
      path(ctx, 'M-6 -34 Q0 -38 7 -32 L10 -11 L-8 -12 Z', p.shirt, '#6e735a', 1);
      line(ctx, `M7 -29 q${8+p.arm*5} 9 17 10`, '#d6ad7e', 3);
      line(ctx, 'M23 -21 l44 55 l1 75', '#6e7457', .9); // fishing rod and line
    } else {
      line(ctx, 'M-5 -19 l-2 22 M5 -19 l4 22', '#5a6c6b', 5);
      path(ctx, 'M-7 -44 Q1 -48 9 -42 L11 -18 L-9 -19 Z', p.shirt, '#6b765f', 1);
      line(ctx, `M8 -39 Q${21+p.arm*8} -35 ${16+p.arm*17} ${-49-p.arm*9}`, '#d6ad7e', 3.5);
    }
    const hy=p.seated?-41:-52;
    ellipse(ctx,0,hy,6.4,8,'#d7af83');
    if(p.hat) { ellipse(ctx,0,hy-5,11,3,'#c9ac74'); path(ctx,`M-6 ${hy-5} l1 -6 l10 0 l1 7 Z`,'#d5bc84','#948e65',.5); }
    else path(ctx, `M-6 ${hy-2} Q-8 ${hy-13} 3 ${hy-9} Q10 ${hy-8} 6 ${hy+1}`, '#565b4a', null);
    ctx.restore();
  }
  function draw() {
    const dpr=canvas.width/width;
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,width,height);
    ctx.translate(ox+cameraX*scale,oy+cameraY*scale); ctx.scale(scale,scale);
    if(image.complete && image.naturalWidth) ctx.drawImage(image,-8,-8,WW+16,HH+16);
    else { ctx.fillStyle='#82b7af'; ctx.fillRect(-10,-10,WW+20,HH+20); }
    // Very shallow lateral strips animate the painted water itself, while leaving the coast still.
    if(image.complete && image.naturalWidth) for(let y=470;y<HH;y+=10) {
      const dx=Math.sin(time*.55+y*.035)*1.7;
      ctx.drawImage(image,0,y/HH*image.naturalHeight,image.naturalWidth,10/HH*image.naturalHeight,dx,y,WW,10.3);
    }
    ctx.save();
    for(const w of waves) {
      const k=(w.y-440)/560;
      const x=w.x+Math.sin(time*w.speed+w.phase)*8, y=w.y+Math.sin(time*.7+w.phase)*1.5;
      ctx.globalAlpha=w.a*(.6+.4*Math.sin(time*.9+w.phase));
      line(ctx, `M${x} ${y} q${w.len*.35} ${-2*k} ${w.len} ${-k}`, '#f1e6b7', 1+k);
    }
    ctx.restore();
    for (const b of boats) drawBoat(b,true);
    for (const b of boats.filter(b=>!b.front)) drawBoat(b);
    ctx.drawImage(pier,0,0);
    for (const p of people) person(p);
    // A curled-up harbor cat lifts its head when the nearest visitor waves.
    ellipse(ctx, 921, 744, 14, 7, '#c49060'); ellipse(ctx, 932, 739-people[1].arm*3, 6, 6, '#c49060');
    path(ctx,'M927 735 l0 -5 l5 3 l4 -2 l-1 7 Z','#b47f54',null);
    for (const b of boats.filter(b=>b.front)) drawBoat(b);
    for(const r of ripples) {
      ctx.save(); ctx.translate(r.x,r.y); ctx.scale(1,.3);
      for(let k=0;k<3;k++) { const radius=r.t*33-k*12; if(radius<0)continue; ctx.globalAlpha=Math.max(0,(1-r.t/3.6)*.65); ctx.strokeStyle='#f3e7b9'; ctx.lineWidth=1.6; ctx.beginPath();ctx.arc(0,0,radius,0,TAU);ctx.stroke(); }
      ctx.restore();
    }
    for(const b of birds) {
      const x=(b.x+time*5)%(WW+80)-40,y=b.y+Math.sin(time*.5+b.phase)*5,flap=Math.sin(time*2+b.phase)*b.s;
      line(ctx,`M${x-b.s*2} ${y-flap} q${b.s} ${-b.s} ${b.s*2} 0 q${b.s} ${-b.s} ${b.s*2} ${-flap}`,'#e9ede0',1.6);
    }
  }
  function step(_,dt) {
    if(paused)return;
    time+=Math.min(dt,.05);
    cameraX=Math.sin(time*.07)*3; cameraY=Math.sin(time*.11)*1.3;
    for(const b of boats) { b.v+=(-b.nudge*11-b.v*4)*dt; b.nudge=clamp(b.nudge+b.v*dt,-.075,.075); b.lift*=Math.exp(-dt*1.6); }
    for(const p of people) p.arm*=Math.exp(-dt*.9);
    for(let i=ripples.length-1;i>=0;i--) { ripples[i].t+=dt;if(ripples[i].t>3.6)ripples.splice(i,1); }
    draw();
  }
  function disturb(x,y) {
    if(paused) return;
    const personHit=people.find(p=>Math.hypot(p.x-x,p.y-25-y)<38);
    if(personHit)personHit.arm=1;
    const boat=boats.slice().reverse().find(b=>Math.abs(x-b.x)<105*b.s && y>b.y-260*b.s && y<b.y+30);
    if(boat && !reduceMotion) { boat.v+=clamp((x-boat.x)*.002,-.16,.16); boat.lift=-3; }
    if(y>450 && !reduceMotion) {
      ripples.push({x,y,t:0});if(ripples.length>8)ripples.shift();
      for(const b of boats) if(Math.hypot(b.x-x,b.y-y)<180)b.v+=.05;
    }
    if(reduceMotion) { for(const p of people)p.arm=0; draw(); }
  }
  canvas.addEventListener('pointerdown',e=>{
    const r=canvas.getBoundingClientRect();
    lastTouch=time;
    disturb((e.clientX-r.left-ox)/scale-cameraX,(e.clientY-r.top-oy)/scale-cameraY);
  });
  canvas.addEventListener('pointermove',e=>{
    if(e.pointerType==='touch'||reduceMotion||paused||time-lastTouch<.2)return;
    const r=canvas.getBoundingClientRect(), x=(e.clientX-r.left-ox)/scale-cameraX,y=(e.clientY-r.top-oy)/scale-cameraY;
    const hit=boats.find(b=>Math.abs(x-b.x)<95*b.s&&y>b.y-245*b.s&&y<b.y+24);
    canvas.style.cursor=hit?'pointer':'default';
    if(hit){hit.v+=.007;lastTouch=time;}
  });
  document.getElementById('harbor-nudge').addEventListener('click',()=>disturb(WW*.51,HH*.88));
  pause.addEventListener('click',()=>{paused=!paused;pause.setAttribute('aria-pressed',String(paused));pause.textContent=paused?'Resume scene':'Pause scene';});
  function resize() {
    width=scene.clientWidth;height=scene.clientHeight;
    const dpr=Math.min(devicePixelRatio||1,1.5);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    // A wide composition remains legible on phones: crop into the central moorings.
    scale=Math.max(width/WW,height/HH);ox=(width-WW*scale)/2;oy=(height-HH*scale)/2;
    draw();
  }
  new ResizeObserver(resize).observe(scene);
  resize();
  if(reduceMotion){pause.disabled=true;pause.textContent='Still scene';}
  else visibleLoop(scene,step,{fps:30});
}
