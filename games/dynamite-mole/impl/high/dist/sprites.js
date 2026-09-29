/* sprites.js - every sprite is drawn from code onto a 16x16 dot grid (1 dot = 2px => 32x32 cells) */
(function () {
  'use strict';
  const DM = (window.DM = window.DM || {});
  const { Pix, mix, dark, light, mulberry32 } = DM;

  const SPR = (DM.SPR = {});
  const OUT = '#23150f';

  /* ---------------------------------------------------------------- themes */
  const THEMES = [
    {
      name: 'SHALLOW TUNNELS',
      floorA: '#b48858', floorB: '#a87c4e', floorLight: '#c99e6a', floorDark: '#8f6640',
      wall: { base: '#6d4626', hi: '#95622f', lo: '#3f2412', deep: '#26150a', accent: '#d9a441' },
      pillar: { base: '#8f5f2e', hi: '#c48a4a', lo: '#4f2f14', cap: '#d9ad6e', accent: '#7a4a20' },
      rock: { base: '#a29a8c', hi: '#cfc7b8', lo: '#645c52', deep: '#3e3832', accent: '#d8b070' },
      ambient: [40, 20, 5, 0.26], torch: ['#ff8a1a', '#ffd23a'],
    },
    {
      name: 'MUSHROOM GROTTO',
      floorA: '#1f6f68', floorB: '#1a625c', floorLight: '#2f9a88', floorDark: '#134640',
      wall: { base: '#4b2a70', hi: '#7048a6', lo: '#2b1646', deep: '#170a2c', accent: '#ff7ad9' },
      pillar: { base: '#9a64c8', hi: '#c898f0', lo: '#5a3488', cap: '#e04eb0', accent: '#ffb0ec' },
      rock: { base: '#82c8b0', hi: '#bcf2dc', lo: '#3f8270', deep: '#22503f', accent: '#a060d8' },
      ambient: [10, 0, 40, 0.3], torch: ['#ff7ad9', '#ffd0f4'],
    },
    {
      name: 'CRYSTAL VEIN',
      floorA: '#2c4486', floorB: '#263c78', floorLight: '#4666b4', floorDark: '#1a2a5a',
      wall: { base: '#132552', hi: '#2c4c94', lo: '#0a1230', deep: '#050a1c', accent: '#5af0ff' },
      pillar: { base: '#3a9ad8', hi: '#8ad8ff', lo: '#1c5a98', cap: '#d8fbff', accent: '#ffffff' },
      rock: { base: '#78c4f4', hi: '#d0f4ff', lo: '#3480c0', deep: '#1c4a86', accent: '#ffffff' },
      ambient: [0, 10, 45, 0.3], torch: ['#5af0ff', '#e0ffff'],
    },
    {
      name: 'LAVA DEPTHS',
      floorA: '#552020', floorB: '#4a1a1a', floorLight: '#743028', floorDark: '#341010',
      wall: { base: '#2c1414', hi: '#4c2626', lo: '#160808', deep: '#0c0404', accent: '#ff5a10' },
      pillar: { base: '#5c3030', hi: '#8a5048', lo: '#301616', cap: '#ff6a1a', accent: '#ffd23a' },
      rock: { base: '#6a5858', hi: '#948080', lo: '#382c2c', deep: '#201818', accent: '#ff7a20' },
      ambient: [50, 0, 0, 0.3], torch: ['#ff5a10', '#ffd23a'],
    },
    {
      name: 'THE DEEP DARK',
      floorA: '#1a1c3a', floorB: '#151732', floorLight: '#2a2e56', floorDark: '#0e1024',
      wall: { base: '#0b0c20', hi: '#20244c', lo: '#04040e', deep: '#020208', accent: '#40e0ff' },
      pillar: { base: '#2c3064', hi: '#5a64b0', lo: '#151838', cap: '#6a76c8', accent: '#40e0ff' },
      rock: { base: '#4a5090', hi: '#7c86d0', lo: '#242850', deep: '#12142c', accent: '#6af0ff' },
      ambient: [0, 0, 18, 0.34], torch: ['#40e0ff', '#d0fbff'],
    },
  ];
  DM.THEMES = THEMES;

  /* ---------------------------------------------------------------- player (mole) */
  const MP = { y: '#f2b91a', Y: '#ffe27a', o: '#c47f10', L: '#fffbd0', b: '#8b5e3c', l: '#b98a5e', B: '#5a3a25', p: '#f58aa8', k: OUT, s: '#f6dcb5', w: '#ffffff' };
  const MOLE_ART = {
    down: [
      '................', '................',
      '.....yyyyyy.....',
      '....yYYYyyyo....',
      '...yYYyyyyyyo...'.replace('yyyyyyo', 'yyyyyyo'),
      '...yYyyLLyyyo...',
      '...yyyyyyyyyo...',
      '..oooooooooooo..',
      '...bbbbbbbbbb...',
      '...bbkbbbbkbb...',
      '...bbkbppbkbb...',
      '..sbbbbppbbbbs..',
      '..sbbBBBBBBbbs..',
      '...bBBBBBBBBb...',
    ],
    up: [
      '................', '................',
      '.....yyyyyy.....',
      '....yYYYyyyo....',
      '...yYYYyyyyyo...',
      '...yYyyyyyyyo...',
      '...yyyyyyyyyo...',
      '..oooooooooooo..',
      '...bbbbbbbbbb...',
      '...bbbbbbbbbb...',
      '...blbbbbbbbb...',
      '..sbbbbbbbbbbs..',
      '..sbbBBBBBBbbs..',
      '...bBBBppBBBb...',
    ],
    left: [
      '................', '................',
      '......yyyyyy....',
      '.....yYYYyyyo...',
      '....yYYyyyyyyo..',
      '...LLyyyyyyyyo..',
      '..oyyyyyyyyyyoo.',
      '..ooooooooooooo.',
      '..ppbbbbbbbbb...',
      '.pppbkbbbbbbbb..',
      '..ppbkbbbbbbb...',
      '...sbbbbBBBBb...',
      '...ssbbBBBBBb...',
      '....bbBBBBBBb...',
    ],
  };
  const LEGS = {
    fb: ['....BB....BB....', '...BB......BB...', '....BB....BB....', '.....BB..BB.....'],
    side: ['....BB...BB.....', '...BB.....BB....', '....BB...BB.....', '.....BB.BB......'],
  };
  function moleFrame(dir, legIdx, bob, breath) {
    const p = new Pix(16, 16);
    p.art(MOLE_ART[dir], MP);
    if (breath) {
      const q = new Pix(16, 16);
      for (let y = 0; y < 13; y++) for (let x = 0; x < 16; x++) if (p.get(x, y)) q.set(x, y + 1, p.get(x, y));
      p.d = q.d;
    }
    const legs = (dir === 'left' ? LEGS.side : LEGS.fb)[legIdx];
    p.art([legs], { B: MP.B }, 0, 14);
    if (dir !== 'left' && (legIdx === 1 || legIdx === 3)) { // arm swing
      const a = legIdx === 1 ? -1 : 1;
      for (const [x, sgn] of [[2, 1], [13, -1]]) {
        for (const y of [11, 12]) p.set(x, y, null);
        p.set(x, 11 + a * sgn, MP.s); p.set(x, 12 + a * sgn, MP.s);
      }
    }
    let out = p;
    if (bob) out = p.shift(0, -1);
    out.outline(OUT);
    return out;
  }
  function buildMole() {
    const m = { down: [], up: [], left: [], right: [], idle: {} };
    for (const dir of ['down', 'up', 'left']) {
      const frames = [0, 1, 2, 3].map((i) => moleFrame(dir, i, i === 2, false));
      m[dir] = frames.map((f) => f.toCanvas());
      if (dir === 'left') m.right = frames.map((f) => f.flipH().toCanvas());
      const idle = [moleFrame(dir, 0, false, false), moleFrame(dir, 0, false, true)];
      m.idle[dir] = idle.map((f) => f.toCanvas());
      if (dir === 'left') m.idle.right = idle.map((f) => f.flipH().toCanvas());
    }
    SPR.mole = m;

    // death animation (6 frames)
    const base = new Pix(16, 16).art(MOLE_ART.down, MP);
    const helmet = new Pix(16, 16);
    for (let y = 2; y <= 7; y++) for (let x = 0; x < 16; x++) helmet.set(x, y, base.get(x, y));
    const bare = new Pix(16, 16);
    bare.art(['................', '................', '................',
      '...bb......bb...', '...bbbbbbbbbb...', '...bbbbbbbbbb...', '...bbbbbbbbbb...', '...bbbbbbbbbb...'], MP);
    for (let y = 8; y <= 13; y++) for (let x = 0; x < 16; x++) bare.set(x, y, base.get(x, y));
    // X eyes
    for (const ex of [4, 9]) {
      bare.set(ex, 8, OUT); bare.set(ex + 2, 8, OUT); bare.set(ex + 1, 9, OUT); bare.set(ex, 10, OUT); bare.set(ex + 2, 10, OUT);
    }
    bare.art(['....BB....BB....'], { B: MP.B }, 0, 14);
    const star = (p, cx, cy) => {
      p.set(cx, cy, '#fff27a'); p.set(cx - 1, cy, '#ffc820'); p.set(cx + 1, cy, '#ffc820'); p.set(cx, cy - 1, '#ffc820'); p.set(cx, cy + 1, '#ffc820');
    };
    const frames = [];
    // f0: white flash, arms up
    let f0 = base.map((c) => light(c, 0.75));
    f0.art(['....BB....BB....'], { B: '#ffffff' }, 0, 14);
    frames.push(f0.outline(OUT));
    // f1: helmet pops up
    let f1 = bare.clone().blit(helmet, 0, -3).shift(0, 1);
    star(f1, 3, 5); star(f1, 12, 4);
    frames.push(f1.outline(OUT));
    // f2/f3: sitting, dizzy stars
    for (const k of [0, 1]) {
      let f = bare.scaleBottom(1.06, 0.82).shift(0, 0);
      f.blit(helmet.scaleBottom(0.9, 0.7), k ? 2 : -3, 3);
      if (k === 0) { star(f, 4, 3); star(f, 12, 4); } else { star(f, 6, 2); star(f, 11, 3); }
      frames.push(f.outline(OUT));
    }
    // f4: flat on the ground
    let f4 = bare.scaleBottom(1.15, 0.55);
    f4.blit(helmet.scaleBottom(0.8, 0.55), 4, 2);
    star(f4, 5, 5); star(f4, 11, 6);
    frames.push(f4.outline(OUT));
    // f5: fading
    let f5 = f4.map((c, x, y) => ((x + y) % 2 === 0 ? c : null));
    frames.push(f5);
    SPR.moleDie = frames.map((f) => f.toCanvas());

    // joy pose (2 frames)
    const joy = [];
    for (const k of [0, 1]) {
      const p = new Pix(16, 16).art(MOLE_ART.down, MP);
      for (let y = 11; y <= 12; y++) { p.set(2, y, null); p.set(13, y, null); }
      p.set(2, 10, MP.b); p.set(2, 9, MP.b); p.set(2, 8, MP.s); p.set(3, 10, MP.b);
      p.set(13, 10, MP.b); p.set(13, 9, MP.b); p.set(13, 8, MP.s); p.set(12, 10, MP.b);
      p.art([k ? '...BB......BB...' : '....BB....BB....'], { B: MP.B }, 0, 14);
      p.set(5, 9, OUT); p.set(10, 9, OUT); p.set(5, 10, MP.b); p.set(10, 10, MP.b);
      p.set(6, 11, OUT); p.set(7, 11, MP.p); p.set(8, 11, MP.p); p.set(9, 11, OUT);
      const q = k ? p.shift(0, -1) : p;
      joy.push(q.outline(OUT).toCanvas());
    }
    SPR.moleJoy = joy;

    // small HUD icons (8x8 dots = 16x16 px)
    const icon = (rows, pal) => new Pix(8, 8).art(rows, pal, 1, 1).outline(OUT).toCanvas();
    SPR.iconLife = icon(['.yyyy.', 'yYyyyo', 'oooooo', 'bkbbkb', 'bbppbb', '.bbbb.'], MP);
    SPR.iconBomb = icon(['..fs..', '.rrrr.', '.rttr.', '.rrrr.', '.rttr.', '.rrrr.'], { f: '#8a6a4a', s: '#ffe860', r: '#e0342a', t: '#f0d8a0' });
    SPR.iconFire = icon(['..o...', '.oyo..', '.oyyo.', 'oyYYyo', 'oyYYyo', '.oooo.'], { o: '#e0501a', y: '#ffb020', Y: '#fff2a0' });
    SPR.iconBoot = icon(['..bb..', '..bb..', '..bb..', '.bbbb.', 'bbbbbb', 'kkkkkk'], { b: '#3ac0e8', k: '#20304a' });
  }

  /* ---------------------------------------------------------------- enemies */
  function buildEnemies() {
    // slime: 4 frames
    const SL = { body: '#48c85a', hi: '#b8f8b0', lo: '#2a8a3e', out: '#14401f' };
    const slimeParams = [[6.2, 5.8], [6.8, 5.2], [7.2, 4.4], [6.6, 5.2]];
    SPR.slime = slimeParams.map(([rx, ry]) => {
      const p = new Pix(16, 16);
      const cy = 14.4 - ry, cx = 8;
      p.ellipse(cx, cy, rx, ry, SL.body);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (p.get(x, y) && y > cy + ry * 0.35) p.set(x, y, SL.lo);
      }
      p.set(cx - rx * 0.55, cy - ry * 0.6, SL.hi); p.set(cx - rx * 0.55 + 1, cy - ry * 0.6, SL.hi); p.set(cx - rx * 0.55, cy - ry * 0.6 + 1, SL.hi);
      const ex = Math.round(cx - 3), ey = Math.round(cy - 1);
      for (const x of [ex, ex + 4]) { p.rect(x, ey, 2, 3, '#ffffff'); p.set(x + 1, ey + 1, '#1a1a2a'); p.set(x + 1, ey + 2, '#1a1a2a'); }
      p.set(cx - 1, Math.round(cy + 2.5), '#14401f'); p.set(cx, Math.round(cy + 2.5), '#14401f');
      return p.outline(SL.out).toCanvas();
    });

    // bat: 4 frames
    const wingTips = [1.5, 5, 10, 5];
    SPR.bat = wingTips.map((ty) => {
      const p = new Pix(16, 16);
      const mem = '#a45ee0', memHi = '#dcb0ff', memLo = '#6a34a0';
      const wing = (sgn) => {
        const X = (x) => (sgn < 0 ? x : 16 - x);
        const q = new Pix(16, 16);
        q.tri(X(6), 7.5, X(0.2), ty + 1, X(3.6), ty + 4.6, mem);
        q.tri(X(6), 7.5, X(3.6), ty + 4.6, X(6.4), 11.5, mem);
        q.line(X(6), 7.5, X(0.5), ty + 1, memHi);
        q.line(X(6), 8.5, X(3.6), ty + 4.6, memLo);
        p.blit(q);
      };
      wing(-1); wing(1);
      p.ellipse(8, 8.6, 2.9, 3.3, '#7a52b8');
      p.ellipse(8, 9.3, 1.8, 2.2, '#9a78d8');
      p.set(5, 4, '#7a52b8'); p.set(5, 5, '#7a52b8'); p.set(10, 4, '#7a52b8'); p.set(10, 5, '#7a52b8'); p.set(5, 3, '#7a52b8'); p.set(10, 3, '#7a52b8');
      p.set(6, 6, '#7a52b8'); p.set(9, 6, '#7a52b8');
      p.set(6, 7, '#ff4a3a'); p.set(9, 7, '#ff4a3a');
      p.set(7, 10, '#ffffff'); p.set(8, 10, '#ffffff');
      return p.outline('#1c0e30').toCanvas();
    });

    // ghost: 4 wave phases x normal / chasing
    const mkGhost = (phase, chase) => {
      const p = new Pix(16, 16);
      const body = '#eaf0ff', shade = '#b6c6f0', deep = '#8a9ad8';
      p.ellipse(8, 7.5, 6, 5.5, body);
      p.rect(2, 7, 12, 6, body);
      for (let x = 2; x <= 13; x++) {
        const w = [0, 1, 0, -1][(x + phase) % 4];
        const bottom = 13 + w;
        for (let y = 12; y <= 14; y++) if (y > bottom) p.set(x, y, null);
      }
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const c = p.get(x, y);
        if (!c) continue;
        if (x >= 11) p.set(x, y, shade);
        if (y >= 12) p.set(x, y, shade);
        if (x >= 13) p.set(x, y, deep);
      }
      p.set(4, 3, '#ffffff'); p.set(5, 2, '#ffffff'); p.set(6, 2, '#ffffff');
      p.rect(1, 8, 1, 3, body); p.rect(14, 8, 1, 3, shade);
      if (chase) {
        for (const ex of [5, 9]) { p.rect(ex, 6, 2, 3, '#ff2a2a'); p.set(ex, 6, '#ffb0a0'); p.set(ex + 1, 8, '#a00a0a'); }
        p.set(4, 5, '#5a0a0a'); p.set(5, 5, '#5a0a0a'); p.set(10, 5, '#5a0a0a'); p.set(11, 5, '#5a0a0a');
        p.rect(7, 10, 2, 2, '#3a0a0a');
      } else {
        for (const ex of [5, 9]) { p.rect(ex, 6, 2, 3, '#1a2050'); }
        p.rect(7, 10, 2, 1, '#1a2050'); p.rect(7, 11, 2, 1, '#5a3a5a');
      }
      return p.outline('#2c3a80').toCanvas();
    };
    SPR.ghost = [0, 1, 2, 3].map((i) => mkGhost(i, false));
    SPR.ghostChase = [0, 1, 2, 3].map((i) => mkGhost(i, true));

    // golem: 4 walking frames
    const GC = { b: '#8b93a3', h: '#bcc4d4', l: '#5a6272', d: '#3a4050', g: '#ffa030', G: '#ffe080', m: '#5a9a48' };
    const mkGolem = (i) => {
      const p = new Pix(16, 16);
      const bob = i === 1 || i === 3 ? 1 : 0;
      const legL = [0, 1, 0, -1][i], legR = [0, -1, 0, 1][i];
      const armL = [0, -1, 0, 1][i], armR = [0, 1, 0, -1][i];
      // legs
      p.rect(4, 12 + Math.min(0, legL), 3, 3 - Math.min(0, legL) - (legL > 0 ? 1 : 0), GC.l);
      p.rect(9, 12 + Math.min(0, legR), 3, 3 - Math.min(0, legR) - (legR > 0 ? 1 : 0), GC.l);
      p.rect(4, 13 + Math.min(0, legL), 3, 1, GC.d); p.rect(9, 13 + Math.min(0, legR), 3, 1, GC.d);
      const B = bob;
      // arms
      p.rect(1, 7 + armL + B, 3, 5, GC.b); p.rect(1, 7 + armL + B, 3, 1, GC.h); p.rect(1, 11 + armL + B, 3, 1, GC.l);
      p.rect(12, 7 + armR + B, 3, 5, GC.b); p.rect(12, 7 + armR + B, 3, 1, GC.h); p.rect(12, 11 + armR + B, 3, 1, GC.l);
      // torso
      p.rect(4, 7 + B, 8, 6, GC.b);
      p.rect(4, 7 + B, 8, 1, GC.h); p.rect(4, 12 + B, 8, 1, GC.l);
      p.rect(11, 8 + B, 1, 4, GC.l);
      p.rect(7, 9 + B, 2, 2, GC.g); p.set(7, 9 + B, GC.G);
      p.set(5, 10 + B, GC.d); p.set(5, 11 + B, GC.d); p.set(6, 11 + B, GC.d);
      p.set(10, 8 + B, GC.m); p.set(9, 8 + B, GC.m);
      // head
      p.rect(5, 2 + B, 6, 5, GC.b);
      p.rect(5, 2 + B, 6, 1, GC.h); p.rect(10, 3 + B, 1, 4, GC.l); p.rect(5, 6 + B, 6, 1, GC.l);
      p.rect(6, 4 + B, 2, 1, GC.g); p.rect(9, 4 + B, 1, 1, GC.g); p.set(6, 4 + B, GC.G);
      p.rect(6, 5 + B, 4, 1, GC.d);
      p.set(6, 2 + B, GC.m);
      return p.outline('#20242e');
    };
    const golemPix = [0, 1, 2, 3].map(mkGolem);
    SPR.golem = golemPix.map((p) => p.toCanvas());
    SPR.golemFlash = golemPix.map((p) => p.map((c) => '#ffffff').toCanvas());

    // death puff: 3 frames per enemy tint
    const tints = { slime: '#48c85a', bat: '#8a4ac0', ghost: '#b6c6f0', golem: '#8b93a3' };
    SPR.puff = {};
    for (const t in tints) {
      const col = tints[t];
      const fr = [];
      const f0 = new Pix(16, 16);
      f0.ellipse(8, 8, 4.5, 4.5, col); f0.ellipse(8, 8, 2.8, 2.8, light(col, 0.6));
      f0.rect(7, 2, 2, 12, '#ffffff'); f0.rect(2, 7, 12, 2, '#ffffff'); f0.ellipse(8, 8, 2, 2, '#fff8c0');
      fr.push(f0.outline(dark(col, 0.6)).toCanvas());
      const f1 = new Pix(16, 16);
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2 + 0.3;
        f1.ellipse(8 + Math.cos(ang) * 5.2, 8 + Math.sin(ang) * 5.2, 2.2, 2.2, a % 2 ? col : light(col, 0.5));
      }
      f1.ellipse(8, 8, 2.5, 2.5, '#ffffff');
      fr.push(f1.outline(dark(col, 0.6)).toCanvas());
      const f2 = new Pix(16, 16);
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2 + 0.7;
        const rr = 6.5 + (a % 2);
        f2.ellipse(8 + Math.cos(ang) * rr, 8 + Math.sin(ang) * rr, 1.2, 1.2, a % 2 ? light(col, 0.3) : '#ffffff');
      }
      fr.push(f2.toCanvas());
      SPR.puff[t] = fr;
    }
  }

  /* ---------------------------------------------------------------- tiles */
  function makeFloor(T, variant, seed, deco) {
    const p = new Pix(16, 16), r = mulberry32(seed);
    const base = variant === 1 ? T.floorB : T.floorA;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const q = r();
      p.set(x, y, q < 0.09 ? T.floorLight : q < 0.2 ? T.floorDark : base);
    }
    for (let i = 0; i < 16; i++) {
      p.set(15, i, dark(p.get(15, i), 0.14)); p.set(i, 15, dark(p.get(i, 15), 0.14));
      p.set(0, i, mix(p.get(0, i), '#ffffff', 0.05)); p.set(i, 0, mix(p.get(i, 0), '#ffffff', 0.05));
    }
    if (deco) deco(p, r);
    return p;
  }
  const DECO = [
    (T) => (p, r) => { // roots and pebbles
      p.ellipse(4 + r() * 8, 5 + r() * 6, 1.6, 1.1, '#8a8478'); p.set(4, 5, '#c8c0b0');
      const x = 3 + Math.floor(r() * 8), y = 3 + Math.floor(r() * 8);
      p.line(x, y, x + 4, y + 1, '#6d4626'); p.line(x + 4, y + 1, x + 6, y + 4, '#6d4626');
    },
    (T) => (p, r) => { // tiny glowing mushrooms
      const x = 3 + Math.floor(r() * 9), y = 5 + Math.floor(r() * 6);
      p.rect(x, y + 1, 1, 2, '#e8d8f8'); p.rect(x - 1, y, 3, 1, '#e04eb0'); p.set(x, y - 1, '#ff9adf'); p.set(x - 1, y, '#a02a80');
      p.set(x + 3, y + 2, '#6af0d0'); p.set(x - 3, y + 1, '#6af0d0');
    },
    (T) => (p, r) => { // crystal shards
      const x = 3 + Math.floor(r() * 9), y = 4 + Math.floor(r() * 8);
      p.rect(x, y, 2, 4, '#5ab8f0'); p.set(x, y - 1, '#d8fbff'); p.set(x + 1, y, '#d8fbff'); p.set(x, y + 3, '#2a78b8'); p.set(x + 1, y + 3, '#2a78b8');
      p.rect(x + 3, y + 2, 1, 2, '#8ad8ff');
    },
    (T) => (p, r) => { // lava cracks
      let x = 2 + Math.floor(r() * 4), y = 3 + Math.floor(r() * 8);
      for (let i = 0; i < 8; i++) { p.set(x, y, '#ff6a1a'); if (i % 2) p.set(x, y + 1, '#8a2a10'); x++; y += r() < 0.5 ? 1 : -1; y = Math.max(1, Math.min(14, y)); }
      p.set(x - 4, y, '#ffd23a');
    },
    (T) => (p, r) => { // glowing specks
      for (let i = 0; i < 3; i++) {
        const x = 2 + Math.floor(r() * 12), y = 2 + Math.floor(r() * 12);
        p.set(x, y, '#40e0ff'); p.set(x + 1, y, '#1a6a8a'); p.set(x, y + 1, '#1a6a8a');
      }
    },
  ];

  function makeWall(T, ti) {
    const p = new Pix(16, 16), r = mulberry32(100 + ti), W = T.wall;
    if (ti === 0) { // vertical timber planks with iron braces
      for (let x = 0; x < 16; x++) {
        const plank = Math.floor(x / 4);
        for (let y = 0; y < 16; y++) {
          let c = plank % 2 ? W.base : mix(W.base, W.hi, 0.35);
          if (x % 4 === 0) c = W.lo;
          else if (x % 4 === 1) c = mix(c, W.hi, 0.35);
          else if (r() < 0.08) c = W.lo;
          p.set(x, y, c);
        }
      }
      for (const y of [2, 12]) { p.rect(0, y, 16, 2, '#4a4a52'); p.rect(0, y, 16, 1, '#8a8a96'); for (let x = 2; x < 16; x += 4) p.set(x, y + 1, '#d8d8e0'); }
    } else {
      for (let y = 0; y < 16; y++) {
        const row = Math.floor(y / 4);
        for (let x = 0; x < 16; x++) {
          const xo = (x + (row % 2 ? 4 : 0)) % 8;
          let c = mix(W.base, W.hi, r() * 0.25);
          if (y % 4 === 3) c = W.deep;
          else if (xo === 7) c = W.deep;
          else if (y % 4 === 0) c = mix(c, W.hi, 0.5);
          else if (r() < 0.1) c = W.lo;
          p.set(x, y, c);
        }
      }
      if (ti === 1) { // glowing mushrooms creeping on bricks
        for (const [x, y] of [[3, 9], [11, 4], [7, 13]]) { p.rect(x, y, 3, 1, W.accent); p.set(x + 1, y - 1, light(W.accent, 0.5)); p.set(x + 1, y + 1, '#ffe8f8'); }
      } else if (ti === 2) { // crystals embedded
        for (const [x, y] of [[3, 3], [10, 9]]) { p.rect(x, y, 2, 4, W.accent); p.set(x, y - 1, '#ffffff'); p.set(x + 2, y + 2, '#2a90b8'); p.set(x + 1, y + 3, '#1a6a90'); }
      } else if (ti === 3) { // lava seams
        for (const y of [3, 11]) for (let x = 0; x < 16; x++) if (x % 5 !== 4) p.set(x, y, x % 3 ? W.accent : '#ffb030');
      } else { // deep dark glow specks
        for (const [x, y] of [[2, 1], [9, 6], [13, 12], [5, 10]]) { p.set(x, y, W.accent); p.set(x + 1, y, mix(W.accent, W.base, 0.6)); }
      }
    }
    // frame edge to separate from rocks: darker outer ring
    for (let i = 0; i < 16; i++) {
      p.set(i, 15, dark(p.get(i, 15), 0.3)); p.set(15, i, dark(p.get(15, i), 0.25));
    }
    return p;
  }

  function makePillar(T, ti) {
    const p = new Pix(16, 16), r = mulberry32(200 + ti), P = T.pillar;
    // body
    p.rect(3, 6, 10, 8, P.base);
    for (let y = 6; y < 14; y++) { p.set(3, y, P.hi); p.set(4, y, mix(P.base, P.hi, 0.5)); p.set(11, y, mix(P.base, P.lo, 0.5)); p.set(12, y, P.lo); }
    p.rect(3, 13, 10, 1, P.lo);
    for (let y = 8; y < 13; y += 2) for (let x = 5; x < 11; x++) if (r() < 0.25) p.set(x, y, P.lo);
    p.ellipse(8, 13.5, 5.2, 1.5, P.lo);
    // cap
    p.ellipse(8, 6, 6, 4, P.hi);
    p.ellipse(8, 6, 5, 3.2, P.cap);
    p.ellipse(9, 6.5, 3.4, 2, mix(P.cap, P.lo, 0.2));
    if (ti === 0) { p.ellipse(8, 6, 2.6, 1.6, P.accent); p.ellipse(8, 6, 1.2, 0.8, P.hi); }
    else if (ti === 1) { for (const [x, y] of [[5, 5], [9, 4], [10, 7], [7, 7]]) p.rect(x, y, 2, 1, P.accent); }
    else if (ti === 2) { p.tri(8, 0.5, 5, 6, 11, 6, P.cap); p.tri(8, 0.5, 8, 6, 11, 6, P.hi); p.line(8, 1, 8, 6, '#ffffff'); }
    else if (ti === 3) { p.ellipse(8, 6, 3.2, 2, P.accent); p.ellipse(8, 6, 1.6, 1, '#fff0a0'); }
    else { p.ellipse(8, 6, 3.2, 2, '#10123a'); p.ellipse(8, 6, 1.8, 1, P.accent); }
    return p.outline('#0c0a10');
  }

  function makeRock(T, ti) {
    const p = new Pix(16, 16), r = mulberry32(300 + ti), R = T.rock;
    // chunky boulder block
    p.rect(1, 1, 14, 14, R.base);
    for (const [x, y] of [[1, 1], [14, 1], [1, 14], [14, 14], [2, 1], [13, 1], [1, 2], [14, 2], [2, 14], [13, 14], [1, 13], [14, 13]]) p.set(x, y, null);
    p.set(1, 3, null); p.set(14, 12, null);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (!p.get(x, y)) continue;
      let c = R.base;
      const q = r();
      if (q < 0.14) c = mix(R.base, R.hi, 0.5); else if (q < 0.26) c = mix(R.base, R.lo, 0.5);
      if (y <= 2 || x <= 2) c = mix(c, R.hi, 0.6);
      if (y >= 13 || x >= 13) c = mix(c, R.lo, 0.7);
      p.set(x, y, c);
    }
    // lumps
    p.rect(3, 3, 4, 3, mix(R.base, R.hi, 0.35)); p.rect(3, 3, 4, 1, R.hi);
    p.rect(9, 8, 4, 4, mix(R.base, R.lo, 0.25)); p.rect(9, 8, 4, 1, mix(R.base, R.hi, 0.3));
    // cracks
    const crack = ti === 3 ? R.accent : R.deep;
    p.line(8, 2, 7, 6, crack); p.line(7, 6, 9, 9, crack); p.line(9, 9, 8, 12, crack);
    p.line(3, 9, 6, 10, crack);
    if (ti === 0) { p.set(11, 4, R.accent); p.set(12, 4, R.accent); p.set(4, 12, R.accent); }
    else if (ti === 1) { for (const [x, y] of [[5, 8], [11, 5], [6, 12]]) { p.rect(x, y, 2, 2, R.accent); p.set(x, y, light(R.accent, 0.4)); } }
    else if (ti === 2) { p.tri(10, 3, 13, 3, 12, 7, '#d8fbff'); p.tri(3, 8, 6, 8, 4, 12, '#a8e4ff'); p.set(11, 4, '#ffffff'); }
    else if (ti === 3) { p.set(9, 9, '#ffd23a'); p.set(8, 6, '#ffb030'); p.set(6, 10, '#ffb030'); p.set(8, 11, '#ffd23a'); }
    else { for (const [x, y] of [[4, 4], [11, 6], [6, 11], [12, 12]]) { p.set(x, y, R.accent); p.set(x + 1, y, mix(R.accent, R.base, 0.6)); } }
    return p.outline(R.deep);
  }

  // shatter a rock into fragments: spread pixels away from centre, drop some of them
  function shatter(rock, spread, keep, seed, dust) {
    const p = new Pix(16, 16), r = mulberry32(seed);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const c = rock.get(x, y);
      if (!c) continue;
      if (r() > keep) continue;
      const dx = x + 0.5 - 8, dy = y + 0.5 - 8;
      const nx = Math.round(x + Math.sign(dx) * spread * (0.5 + r()) + (r() - 0.5) * spread * 0.5);
      const ny = Math.round(y + Math.sign(dy) * spread * (0.5 + r()) + (r() - 0.5) * spread * 0.5);
      p.set(nx, ny, dust ? mix(c, '#c8b8a0', 0.5) : c);
    }
    return p;
  }

  function makeExit(T, open, frame) {
    const p = new Pix(16, 16);
    // stone frame
    p.rect(1, 1, 14, 14, '#7c7c8a');
    p.rect(1, 1, 14, 1, '#b4b4c4'); p.rect(1, 1, 1, 14, '#a4a4b4'); p.rect(1, 14, 14, 1, '#4a4a58'); p.rect(14, 1, 1, 14, '#4a4a58');
    if (!open) {
      p.rect(3, 3, 10, 10, '#7a4a20');
      for (let x = 3; x < 13; x += 3) p.rect(x, 3, 1, 10, '#5a3416');
      p.rect(3, 3, 10, 1, '#a86c34');
      p.rect(3, 5, 10, 1, '#3a3a44'); p.rect(3, 10, 10, 1, '#3a3a44');
      p.rect(7, 6, 2, 4, '#9a9aaa'); p.rect(7, 7, 2, 2, '#26262e'); p.set(7, 6, '#d8d8e6');
      for (const [x, y] of [[4, 5], [11, 5], [4, 10], [11, 10]]) p.set(x, y, '#d8d8e6');
      return p.outline('#1a1a22');
    }
    // open: dark shaft + ladder + glow
    p.rect(3, 3, 10, 10, '#0a0c1a');
    const g = frame ? '#fff0a0' : '#ffd850';
    p.rect(4, 4, 8, 1, mix('#0a0c1a', g, 0.5));
    p.rect(3, 3, 10, 1, '#3a3a52');
    p.rect(5, 4, 1, 9, '#d8b070'); p.rect(10, 4, 1, 9, '#d8b070');
    for (let y = 5; y < 13; y += 2) p.rect(5, y, 6, 1, '#a07840');
    p.rect(4, 12, 8, 1, mix('#0a0c1a', g, frame ? 0.35 : 0.2));
    // glowing corners
    const gl = frame ? '#fff8c0' : '#ffe070';
    p.set(2, 2, gl); p.set(13, 2, gl); p.set(2, 13, gl); p.set(13, 13, gl);
    if (frame) { p.set(1, 8, gl); p.set(14, 8, gl); p.set(8, 1, gl); p.set(8, 14, gl); }
    return p.outline('#1a1a22');
  }

  function buildTiles() {
    SPR.themes = THEMES.map((T, ti) => {
      const floors = [makeFloor(T, 0, 11 + ti).toCanvas(), makeFloor(T, 1, 21 + ti).toCanvas()];
      const decoFn = DECO[ti](T);
      const floorDeco = [0, 1, 2].map((k) => makeFloor(T, k % 2, 31 + ti * 7 + k, decoFn).toCanvas());
      const rock = makeRock(T, ti);
      const rockFrames = [
        rock.toCanvas(),
        shatter(rock, 1, 0.92, 41 + ti, false).toCanvas(),
        shatter(rock, 3, 0.55, 51 + ti, false).toCanvas(),
        shatter(rock, 5, 0.22, 61 + ti, true).toCanvas(),
      ];
      return {
        floors, floorDeco,
        wall: makeWall(T, ti).toCanvas(),
        pillar: makePillar(T, ti).toCanvas(),
        rock: rockFrames,
        ambient: T.ambient,
      };
    });
    const sh = new Pix(16, 16);
    const a = ['#00000080', '#00000060', '#00000040', '#00000024'];
    for (let y = 0; y < 4; y++) sh.rect(0, y, 16, 1, a[y]);
    SPR.shadowTop = sh.toCanvas();
    const sh2 = new Pix(16, 16);
    sh2.ellipse(8, 8, 6, 2.6, '#00000066'); sh2.ellipse(8, 8, 4.4, 1.8, '#00000044');
    SPR.shadowChar = sh2.toCanvas();
    SPR.exit = { closed: makeExit(null, false, 0).toCanvas(), open: [makeExit(null, true, 0).toCanvas(), makeExit(null, true, 1).toCanvas()] };
  }

  /* ---------------------------------------------------------------- bomb, flame, items, torch */
  function buildObjects() {
    // dynamite bundle, 3 fuse-spark frames + white flash variant
    const bombFrame = (k, flash) => {
      const p = new Pix(16, 16);
      const red = flash ? '#ffb0a0' : '#d8322a', redHi = flash ? '#ffffff' : '#ff6a50', redLo = flash ? '#e08070' : '#8e1a1e';
      for (let i = 0; i < 3; i++) {
        const x = 3 + i * 4;
        p.rect(x, 6, 3, 8, red);
        p.rect(x, 6, 1, 8, redHi); p.rect(x + 2, 6, 1, 8, redLo);
        p.rect(x, 5, 3, 1, '#3a2a2a');
      }
      p.rect(2, 9, 12, 2, '#ecd6a0'); p.rect(2, 9, 12, 1, '#fff2c8'); p.rect(2, 10, 12, 1, '#b89a60');
      p.rect(2, 13, 12, 1, '#5a1014');
      // fuse
      const fuse = '#a08060';
      p.set(8, 4, fuse); p.set(8, 3, fuse); p.set(9, 2, fuse); p.set(10, 2, fuse);
      // spark
      const sx = 11, sy = 1;
      if (k === 0) { p.set(sx, sy, '#ffe860'); p.set(sx, sy - 1 < 0 ? 0 : sy - 1, '#ff8a1a'); }
      else if (k === 1) { p.set(sx, sy, '#ffffff'); p.set(sx - 0, 0, '#ffe860'); p.set(sx + 1, sy, '#ffb030'); p.set(sx, sy + 1, '#ffb030'); p.set(sx + 1, 0, '#ff8a1a'); }
      else { p.set(sx, sy, '#ffd23a'); p.set(sx + 1, 0, '#ffffff'); p.set(sx + 1, sy + 1, '#ff8a1a'); p.set(sx - 1, 0, '#ffb030'); }
      return p.outline(OUT).toCanvas();
    };
    SPR.bomb = [0, 1, 2].map((k) => bombFrame(k, false));
    SPR.bombFlash = [0, 1, 2].map((k) => bombFrame(k, true));

    // flames
    const layerCols = ['#b8240e', '#f2561a', '#ffa828', '#ffe45c', '#fffbe0'];
    const pick = (t) => (t > 0.78 ? layerCols[0] : t > 0.55 ? layerCols[1] : t > 0.34 ? layerCols[2] : t > 0.16 ? layerCols[3] : layerCols[4]);
    const flameCenter = (f) => {
      const p = new Pix(16, 16), r = mulberry32(700 + f * 13);
      const wob = [];
      for (let i = 0; i < 16; i++) wob.push((r() - 0.5) * 1.6);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const dx = x + 0.5 - 8, dy = y + 0.5 - 8;
        const d = (Math.hypot(dx, dy) + Math.max(Math.abs(dx), Math.abs(dy))) * 0.5;
        const ang = Math.atan2(dy, dx);
        const R = 7.6 + wob[Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 15.99)];
        if (d > R) continue;
        let t = d / R + (r() - 0.5) * 0.12;
        p.set(x, y, pick(t));
      }
      return p.toCanvas();
    };
    const flameArm = (f) => {
      const p = new Pix(16, 16), r = mulberry32(800 + f * 17);
      const wob = [];
      for (let i = 0; i < 16; i++) wob.push((r() - 0.5) * 1.8);
      for (let x = 0; x < 16; x++) {
        const H = 5.4 + wob[(x + f * 3) % 16] + Math.sin((x + f * 2) * 0.9) * 0.6;
        for (let y = 0; y < 16; y++) {
          const dy = Math.abs(y + 0.5 - 8);
          if (dy > H) continue;
          p.set(x, y, pick(dy / H + (r() - 0.5) * 0.14));
        }
      }
      return p;
    };
    const flameTip = (f) => {
      const p = new Pix(16, 16), r = mulberry32(900 + f * 19);
      const wob = [];
      for (let i = 0; i < 16; i++) wob.push((r() - 0.5) * 1.6);
      for (let x = 0; x < 16; x++) {
        let H = 5.4 + wob[(x + f * 3) % 16] + Math.sin((x + f * 2) * 0.9) * 0.6;
        if (x > 8) H *= Math.sqrt(Math.max(0, 1 - Math.pow((x - 8) / 8.2, 2)));
        for (let y = 0; y < 16; y++) {
          const dy = Math.abs(y + 0.5 - 8);
          if (dy > H) continue;
          p.set(x, y, pick(dy / Math.max(H, 0.1) * 0.9 + (x > 10 ? 0.12 : 0) + (r() - 0.5) * 0.1));
        }
      }
      return p;
    };
    SPR.flame = { center: [], armH: [], armV: [], tip: { right: [], down: [], left: [], up: [] } };
    for (let f = 0; f < 4; f++) {
      SPR.flame.center.push(flameCenter(f));
      const a = flameArm(f);
      SPR.flame.armH.push(a.toCanvas());
      SPR.flame.armV.push(a.rot90().toCanvas());
      const t = flameTip(f);
      SPR.flame.tip.right.push(t.toCanvas());
      SPR.flame.tip.down.push(t.rot90().toCanvas());
      SPR.flame.tip.left.push(t.rot90().rot90().toCanvas());
      SPR.flame.tip.up.push(t.rot90().rot90().rot90().toCanvas());
    }

    // items: round badge + icon, 2 sparkle frames
    const badge = (ring, icon, pal, oy) => {
      const frames = [];
      for (const k of [0, 1]) {
        const p = new Pix(16, 16);
        p.ellipse(8, 8, 7.4, 7.4, ring);
        p.ellipse(8, 8, 6, 6, '#1b2140');
        p.ellipse(8, 8, 5, 5, '#262e58');
        p.art(icon, pal, 3, oy);
        p.set(3, 3, '#ffffff'); p.set(2, 5, light(ring, 0.5));
        if (k === 0) { p.set(13, 3, '#ffffff'); p.set(12, 3, light(ring, 0.6)); p.set(13, 4, light(ring, 0.6)); }
        else { p.set(3, 13, '#ffffff'); p.set(2, 13, light(ring, 0.6)); p.set(3, 12, light(ring, 0.6)); }
        frames.push(p.outline('#0a0d1a').toCanvas());
      }
      return frames;
    };
    SPR.item = {
      fire: badge('#ff8a1a', ['....o.....', '...oo.o...', '..ooyoo...', '..oyyyoo..', '.ooyYyyoo.', '.oyyYYyyo.', '.oyYYYYyo.', '.oyYYYYyo.', '..oyYYyo..', '...oooo...'], { o: '#e0501a', y: '#ffb020', Y: '#fff2a0' }, 3),
      bomb: badge('#ff4a3a', ['......s...', '.....f....', '..rrrfrr..', '..rrrrrR..', '..tttttt..', '..rrrrrR..', '..rrrrrR..', '..tttttt..', '..rrrrrR..', '..RRRRRR..'], { s: '#ffe860', f: '#c8a070', r: '#f0483a', R: '#a01e22', t: '#f4e0b0' }, 3),
      boots: badge('#3ac0e8', ['..bbbb....', '..bbbb....', '..bWWb....', '..bbbb....', '..bbbb....', '..bbbbbb..', '..bbbbbbb.', '.bBbbbbbbb', '.kkkkkkkkk', '..........'], { b: '#3ab8e8', B: '#9aeaff', W: '#ffffff', k: '#c0d0e0' }, 3),
      life: badge('#ff70a8', ['..rr..rr..', '.rRRrrrrr.', '.rRrrrrrr.', '.rrrrrrrr.', '..rrrrrr..', '...rrrr...', '....rr....'], { r: '#ff5a8a', R: '#ffd0e4' }, 4),
    };

    // wall torch: 2 frames
    SPR.torch = [0, 1].map((k) => {
      const p = new Pix(16, 16);
      p.rect(7, 8, 2, 6, '#7a5a34'); p.rect(6, 7, 4, 2, '#4a4a52'); p.rect(6, 7, 4, 1, '#8a8a96');
      p.set(7, 14, '#4a4a52'); p.set(8, 14, '#4a4a52');
      p.ellipse(8, 4.5, 2.4, 3.2 + k * 0.6, '#ff8a1a');
      p.ellipse(8, 5, 1.4, 2.2 + k * 0.5, '#ffd23a');
      p.set(8, 5, '#fffbe0');
      if (k) p.set(9, 1, '#ff8a1a'); else p.set(7, 1, '#ff8a1a');
      return p.outline('#1a0e08').toCanvas();
    });

    // soft light sprite (radial alpha gradient), for the lighting layer
    const lc = DM.mkCanvas(128, 128), lx = lc.getContext('2d');
    const gr = lx.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.75, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    lx.fillStyle = gr; lx.fillRect(0, 0, 128, 128);
    SPR.light = lc;
    const gc = DM.mkCanvas(128, 128), gx = gc.getContext('2d');
    const gg = gx.createRadialGradient(64, 64, 2, 64, 64, 64);
    gg.addColorStop(0, 'rgba(255,190,90,0.55)'); gg.addColorStop(0.5, 'rgba(255,120,30,0.22)'); gg.addColorStop(1, 'rgba(255,90,20,0)');
    gx.fillStyle = gg; gx.fillRect(0, 0, 128, 128);
    SPR.glow = gc;
  }

  /* ---------------------------------------------------------------- HUD panel */
  function buildHud() {
    const p = new Pix(240, 32);
    const r = mulberry32(4242);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 240; x++) {
      const row = Math.floor(y / 6), xo = (x + (row % 2 ? 8 : 0)) % 16;
      let c = mix('#3c2e26', '#54423a', r() * 0.5);
      if (y % 6 === 5 || xo === 15) c = '#1c1410';
      else if (y % 6 === 0) c = mix(c, '#8a7060', 0.3);
      p.set(x, y, c);
    }
    p.rect(0, 30, 240, 2, '#0e0a08');
    p.rect(0, 29, 240, 1, '#c88a2a');
    p.rect(0, 0, 240, 1, '#8a7060');
    SPR.hud = p.toCanvas();
  }

  /* ---------------------------------------------------------------- init */
  DM.buildSprites = function () {
    buildMole();
    buildEnemies();
    buildTiles();
    buildObjects();
    buildHud();
  };
})();
