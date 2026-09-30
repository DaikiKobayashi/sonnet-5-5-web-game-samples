// Rendering: field, entities, lighting, HUD and all screens.
(function () {
  'use strict';
  var DM = window.DM;
  var G = DM.G;
  var F = DM.Font;
  var A = null; // art
  var ctx = null;
  var bgCache = { version: -1, canvas: null, lights: [] };
  var lightCv, lightCtx, vignette, hudPanel, shadowSpr, logoCv, logoCtx;
  var reducedMotion = false;
  var fireflies = [];

  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  function init(context, art) {
    ctx = context;
    A = art;
    try { reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reducedMotion = false; }
    lightCv = mk(480, 352); lightCtx = lightCv.getContext('2d');
    vignette = mk(480, 352);
    var v = vignette.getContext('2d');
    var gr = v.createRadialGradient(240, 176, 120, 240, 176, 330);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.55)');
    v.fillStyle = gr; v.fillRect(0, 0, 480, 352);
    // HUD panel (stone texture, 2px dots)
    var hg = new DM.Grid(240, 32);
    for (var y = 0; y < 32; y++) for (var x = 0; x < 240; x++) {
      var h = DM.hash(x >> 1, y >> 1, 3);
      var brick = (y % 8 === 7) || ((x + ((y >> 3) % 2) * 6) % 12 === 11);
      var c = brick ? '#1a1418' : h < 0.2 ? '#2a2228' : h > 0.9 ? '#3a3036' : '#302830';
      if (y === 0) c = '#5a4a50';
      if (y >= 30) c = y === 31 ? '#0a0608' : '#8a6a3a';
      hg.set(x, y, c);
    }
    hudPanel = hg.canvas();
    var sg = new DM.Grid(16, 16);
    sg.ellipse(8, 13.5, 5.5, 1.8, 'rgba(0,0,0,0.32)');
    shadowSpr = sg.canvas();
    logoCv = mk(A.logo.w, A.logo.h); logoCtx = logoCv.getContext('2d');
    for (var i = 0; i < 18; i++) {
      fireflies.push({ x: Math.random() * 480, y: 150 + Math.random() * 230, p: Math.random() * 10, s: 0.3 + Math.random() * 0.6, c: i % 3 === 0 ? '#ffe27a' : i % 3 === 1 ? '#6affd6' : '#9af0ff' });
    }
  }

  // ---------- stage background ----------
  function buildBg() {
    var th = A.themes[G.stage - 1];
    var cv = mk(480, 352);
    var g = cv.getContext('2d');
    var lights = [];
    var torchCells = [];
    for (var r = 0; r < DM.ROWS; r++) for (var c = 0; c < DM.COLS; c++) {
      var x = c * 32, y = r * 32;
      var wall = DM.isWallCell(c, r);
      if (!wall) {
        var deco = DM.hash(c, r, G.stage * 31 + G.seed % 997) < 0.12 && !(c <= 3 && r <= 3);
        var img = deco ? th.floors[2] : th.floors[(c + r) % 2];
        g.drawImage(img, x, y);
        if (deco && G.stage !== 1) lights.push({ x: x + 16, y: y + 16, r: 30, a: 0.55, c: th.T.acc });
      } else if (r === 0 || r === 10 || c === 0 || c === 14) {
        g.drawImage(th.wall, x, y);
      } else {
        g.drawImage(th.pillar, x, y);
        if (G.stage === 3) lights.push({ x: x + 16, y: y + 12, r: 34, a: 0.6, c: th.T.acc });
        if (G.stage === 4) lights.push({ x: x + 16, y: y + 26, r: 26, a: 0.45, c: th.T.acc });
      }
    }
    // ambient occlusion under walls/pillars
    g.fillStyle = 'rgba(0,0,0,0.28)';
    for (r = 1; r < DM.ROWS; r++) for (c = 0; c < DM.COLS; c++) {
      if (!DM.isWallCell(c, r) && DM.isWallCell(c, r - 1)) g.fillRect(c * 32, r * 32, 32, 4);
    }
    if (th.T.torch) {
      [[3, 0], [7, 0], [11, 0], [3, 10], [11, 10]].forEach(function (p) { torchCells.push(p); lights.push({ x: p[0] * 32 + 16, y: p[1] * 32 + 12, r: 70, a: 0.85, torch: true, c: '#ffb050' }); });
    }
    bgCache = { version: G.bgVersion, canvas: cv, lights: lights, torches: torchCells, stage: G.stage };
  }

  function frameOf(t, fps, n) { return Math.floor(t * fps) % n; }

  function drawSprite(img, px, py) {
    ctx.drawImage(img, Math.round(px), Math.round(py));
  }

  // pixel center of tile coordinate
  function cx(x) { return (x + 0.5) * 32; }
  function cy(y) { return 64 + (y + 0.5) * 32; }

  function drawPlayer() {
    var p = G.player;
    var px = cx(p.x) - 16, py = cy(p.y) - 16;
    if (G.state === 'stageClear') {
      var j = A.player.joy[Math.floor(G.stateTime * 4) % 2];
      drawSprite(shadowSpr, px, py);
      drawSprite(j, px, py - (Math.floor(G.stateTime * 4) % 2) * 2);
      return;
    }
    if (!p.alive) {
      var t = 1.2 - p.deathT;
      var fi = Math.min(5, Math.floor(t / 0.2));
      drawSprite(A.player.death[fi], px, py);
      if (fi < 4) {
        for (var s = 0; s < 3; s++) {
          var a = G.time * 6 + s * 2.094;
          var sx = Math.round((cx(p.x) + Math.cos(a) * 10) / 2) * 2, sy = Math.round((cy(p.y) - 14 + Math.sin(a) * 4) / 2) * 2;
          ctx.fillStyle = '#ffe04a';
          ctx.fillRect(sx, sy - 2, 2, 6); ctx.fillRect(sx - 2, sy, 6, 2);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(sx, sy, 2, 2);
        }
      }
      return;
    }
    if (p.invincible > 0 && Math.floor(p.invincible / 0.0625) % 2 === 1) return;
    var img;
    if (p.moving) {
      var fr = (p.stepCount % 2 === 0) ? (p.prog < 0.5 ? 1 : 2) : (p.prog < 0.5 ? 3 : 0);
      img = A.player.walk[p.facing][fr];
    } else {
      img = (Math.floor(G.time / 0.6) % 2 === 1) ? A.player.idle2[p.facing] : A.player.walk[p.facing][0];
    }
    drawSprite(shadowSpr, px, py);
    drawSprite(img, px, py);
  }

  function drawEnemy(e) {
    var px = cx(e.x) - 16, py = cy(e.y) - 16;
    if (!e.alive) {
      var fi = Math.min(3, Math.floor((0.4 - e.dyingT) / 0.1));
      drawSprite(A.puff[e.type][fi], px, py);
      return;
    }
    drawSprite(shadowSpr, px, py);
    var img;
    if (e.type === 'slime') img = A.slime[frameOf(e.animT, 6, 4)];
    else if (e.type === 'bat') { img = A.bat[frameOf(e.animT, 10, 4)]; py -= 4; }
    else if (e.type === 'ghost') {
      img = (e.chasing ? A.ghostChase : A.ghost)[frameOf(e.animT, 5, 3)];
      py -= 2 + (Math.floor(e.animT * 3) % 2) * 2;
      ctx.globalAlpha = 0.88;
    } else {
      var gf = e.moving ? frameOf(e.animT, 5, 4) : 0;
      img = A.golem[gf];
      if (e.invulnT > 0 && Math.floor(e.invulnT / 0.08) % 2 === 0) img = A.golemFlash[gf];
    }
    if (e.invulnT > 0 && e.type !== 'golem' && Math.floor(e.invulnT / 0.08) % 2 === 0) { ctx.globalAlpha = 1; return; }
    drawSprite(img, px, py);
    ctx.globalAlpha = 1;
  }

  function drawField() {
    if (bgCache.version !== G.bgVersion) buildBg();
    var th = A.themes[G.stage - 1];
    var ox = 0, oy = 0;
    if (G.shake > 0 && !reducedMotion && (G.state === 'playing')) {
      var m = Math.ceil(4 * G.shake / 0.2);
      ox = (Math.floor(Math.random() * (m + 1)) - (m >> 1)) & ~1;
      oy = (Math.floor(Math.random() * (m + 1)) - (m >> 1)) & ~1;
    }
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 64, 480, 352); ctx.clip();
    ctx.translate(ox, oy);
    ctx.drawImage(bgCache.canvas, 0, 64);
    // torches
    (bgCache.torches || []).forEach(function (p, i) {
      drawSprite(A.torch[frameOf(G.time + i * 0.37, 7, 3)], p[0] * 32, 64 + p[1] * 32 - (p[1] === 0 ? 2 : 6));
    });
    var r, c;
    // exit
    var ex = G.exit;
    if (ex.revealed && G.grid[ex.row][ex.col] !== DM.SOFT) {
      var eimg = ex.open ? A.exit.open[frameOf(G.time, 3, 2)] : A.exit.closed;
      drawSprite(eimg, ex.col * 32, 64 + ex.row * 32);
    }
    // rocks
    for (r = 0; r < DM.ROWS; r++) for (c = 0; c < DM.COLS; c++) {
      if (G.grid[r][c] === DM.SOFT) drawSprite(th.rock, c * 32, 64 + r * 32);
    }
    G.crumbles.forEach(function (cr) {
      drawSprite(th.crumble[Math.min(2, Math.floor(cr.t / 0.1))], cr.col * 32, 64 + cr.row * 32);
    });
    // items
    G.items.forEach(function (it) {
      var bob = (Math.floor(it.t * 3) % 2) * 2;
      drawSprite(shadowSpr, it.col * 32, 64 + it.row * 32 + 2);
      drawSprite(A.items[it.type][frameOf(it.t, 2.5, 2)], it.col * 32, 64 + it.row * 32 - bob);
    });
    // bombs
    G.bombs.forEach(function (b) {
      var fi = frameOf(b.age, 8, 4);
      var flash = b.timeLeft < 0.8 ? (Math.floor(b.age * 16) % 2 === 0) : (Math.floor(b.age * 3) % 2 === 0 && (b.age % (1 / 3)) < 0.06);
      var img = flash ? A.bomb.flash[fi] : A.bomb.normal[fi];
      var hop = b.timeLeft < 0.8 ? (Math.floor(b.age * 16) % 2) * 2 : 0;
      drawSprite(shadowSpr, b.col * 32, 64 + b.row * 32);
      drawSprite(img, b.col * 32, 64 + b.row * 32 - hop);
    });
    // flames
    G.flames.forEach(function (f) {
      var fi = f.timeLeft < 0.1 ? 4 : Math.floor((0.5 - f.timeLeft) * 16) % 4;
      var img;
      if (f.kind === 'center') img = A.flame.center[fi];
      else if (f.kind === 'arm') img = (f.dir === 'up' || f.dir === 'down') ? A.flame.armV[fi] : A.flame.armH[fi];
      else img = A.flame.tip[f.dir][fi];
      drawSprite(img, f.col * 32, 64 + f.row * 32);
    });
    // entities sorted by y
    var ents = G.enemies.slice();
    ents.push(null);
    ents.sort(function (a, b) { return (a ? a.y : G.player.y) - (b ? b.y : G.player.y); });
    ents.forEach(function (e) { if (e) drawEnemy(e); else drawPlayer(); });
    // particles
    G.particles.forEach(function (q) {
      ctx.fillStyle = q.color;
      ctx.fillRect(Math.round(q.x / 2) * 2, Math.round(q.y / 2) * 2, 2, 2);
    });
    // lighting
    drawLighting(th);
    // exit flash
    if (G.exitFlash > 0) {
      ctx.fillStyle = 'rgba(255,240,180,' + (G.exitFlash / 0.6 * 0.45).toFixed(3) + ')';
      ctx.fillRect(0, 64, 480, 352);
    }
    // popups
    G.popups.forEach(function (pp) {
      var k = pp.t / 0.8;
      ctx.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1;
      F.draw(ctx, pp.text, pp.x, pp.y - k * 24, { scale: 2, color: pp.color, align: 'center' });
      ctx.globalAlpha = 1;
    });
    ctx.restore();
  }

  function drawLighting(th) {
    var dark = th.T.dark;
    var L = lightCtx;
    L.globalCompositeOperation = 'source-over';
    L.clearRect(0, 0, 480, 352);
    L.fillStyle = 'rgba(6,4,14,' + dark + ')';
    L.fillRect(0, 0, 480, 352);
    L.globalCompositeOperation = 'destination-out';
    var lights = [];
    var p = G.player;
    lights.push({ x: cx(p.x), y: cy(p.y) - 64 - 6, r: 110, a: 1 });
    bgCache.lights.forEach(function (l) {
      var fl = l.torch ? 0.9 + 0.1 * Math.sin(G.time * 13 + l.x) : 1;
      lights.push({ x: l.x, y: l.y, r: l.r * fl, a: l.a });
    });
    G.bombs.forEach(function (b) { lights.push({ x: cx(b.col) + 6, y: cy(b.row) - 64 - 12, r: 36, a: 0.8 }); });
    G.flames.forEach(function (f) { lights.push({ x: cx(f.col), y: cy(f.row) - 64, r: 60, a: 1 }); });
    G.enemies.forEach(function (e) { lights.push({ x: cx(e.x), y: cy(e.y) - 64, r: 30, a: 0.7 }); });
    G.items.forEach(function (it) { lights.push({ x: cx(it.col), y: cy(it.row) - 64, r: 30, a: 0.7 }); });
    if (G.exit.revealed && G.exit.open) lights.push({ x: cx(G.exit.col), y: cy(G.exit.row) - 64, r: 56, a: 1 });
    lights.forEach(function (l) {
      var g = L.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      g.addColorStop(0, 'rgba(0,0,0,' + l.a + ')');
      g.addColorStop(0.55, 'rgba(0,0,0,' + (l.a * 0.6) + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      L.fillStyle = g;
      L.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    });
    ctx.drawImage(lightCv, 0, 64);
    // warm additive glow from flames/torches
    ctx.globalCompositeOperation = 'lighter';
    var warm = [];
    G.flames.forEach(function (f) { if (f.kind === 'center') warm.push([cx(f.col), cy(f.row), 70, 0.22]); });
    bgCache.lights.forEach(function (l) { if (l.torch) warm.push([l.x, l.y + 64, 50, 0.1]); });
    warm.forEach(function (w) {
      var g = ctx.createRadialGradient(w[0], w[1], 0, w[0], w[1], w[2]);
      g.addColorStop(0, 'rgba(255,150,50,' + w[3] + ')');
      g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g;
      ctx.fillRect(w[0] - w[2], w[1] - w[2], w[2] * 2, w[2] * 2);
    });
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(vignette, 0, 64);
  }

  function pad6(n) { var s = String(Math.max(0, Math.floor(n))); while (s.length < 6) s = '0' + s; return s; }
  DM.pad6 = pad6;
  function fmtTime(t) {
    var s = Math.max(0, Math.ceil(t - 1e-9));
    var m = Math.floor(s / 60), ss = s % 60;
    return m + ':' + (ss < 10 ? '0' : '') + ss;
  }
  DM.fmtTime = fmtTime;

  function drawHud() {
    ctx.drawImage(hudPanel, 0, 0);
    var p = G.player;
    F.draw(ctx, 'SCORE ' + pad6(G.score), 10, 6, { color: '#ffffff' });
    F.draw(ctx, 'HI ' + pad6(G.hiScore()), 196, 6, { color: '#ffe27a' });
    var low = G.timeLeft <= 30;
    var tcol = low ? (Math.floor(G.time * 4) % 2 === 0 ? '#ff3a3a' : '#ffb0a0') : '#ffffff';
    F.draw(ctx, 'TIME ' + fmtTime(G.timeLeft), 470, 6, { color: tcol, align: 'right' });
    F.draw(ctx, 'STAGE ' + G.stage + '/5', 10, 25, { color: '#9af0ff' });
    ctx.drawImage(A.hud.face, 170, 24);
    F.draw(ctx, 'x' + G.lives, 190, 25, { color: '#ffffff' });
    F.draw(ctx, 'SND ' + (DM.Audio.muted ? 'OFF' : 'ON'), 470, 25, { color: DM.Audio.muted ? '#ff8a8a' : '#9affb0', align: 'right' });
    ctx.drawImage(A.hud.bomb, 10, 43);
    F.draw(ctx, 'BOMB ' + p.maxBombs, 30, 44, { color: '#ffffff' });
    ctx.drawImage(A.hud.fire, 130, 43);
    F.draw(ctx, 'FIRE ' + p.range, 150, 44, { color: '#ffffff' });
    ctx.drawImage(A.hud.boots, 250, 43);
    F.draw(ctx, 'SPD ' + p.boots, 270, 44, { color: '#ffffff' });
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(10,6,14,0.88)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y + h - 2, w, 2); ctx.fillRect(x, y, 2, h); ctx.fillRect(x + w - 2, y, 2, h);
    ctx.fillStyle = '#f8c83a';
    ctx.fillRect(x + 4, y + 4, w - 8, 2); ctx.fillRect(x + 4, y + h - 6, w - 8, 2); ctx.fillRect(x + 4, y + 4, 2, h - 8); ctx.fillRect(x + w - 6, y + 4, 2, h - 8);
    ctx.fillStyle = '#1a0f1c';
    [[x, y], [x + w - 2, y], [x, y + h - 2], [x + w - 2, y + h - 2]].forEach(function (c) { ctx.fillRect(c[0], c[1], 2, 2); });
  }

  function dimField(a) {
    ctx.fillStyle = 'rgba(0,0,0,' + a + ')';
    ctx.fillRect(0, 64, 480, 352);
  }

  function drawIntro() {
    dimField(0.62);
    var st = DM.STAGES[G.stage - 1];
    panel(70, 140, 340, 170);
    F.draw(ctx, 'STAGE ' + G.stage, 240, 158, { scale: 3, color: '#ffe27a', align: 'center' });
    F.draw(ctx, st.name, 240, 196, { color: '#ffffff', align: 'center' });
    var total = st.enemies.slime + st.enemies.bat + st.enemies.ghost + st.enemies.golem;
    F.draw(ctx, 'ENEMIES ' + total, 240, 222, { color: '#ff9a7a', align: 'center' });
    var list = [];
    DM.ENEMY_ORDER.forEach(function (t) { for (var i = 0; i < st.enemies[t]; i++) list.push(t); });
    var x0 = 240 - list.length * 17;
    list.forEach(function (t, i) {
      var img = t === 'slime' ? A.slime[0] : t === 'bat' ? A.bat[frameOf(G.time, 10, 4)] : t === 'ghost' ? A.ghost[0] : A.golem[0];
      ctx.drawImage(img, x0 + i * 34, 252);
    });
  }

  function drawPause() {
    dimField(0.6);
    panel(110, 150, 260, 150);
    F.draw(ctx, 'PAUSED', 240, 168, { scale: 3, color: '#ffe27a', align: 'center' });
    F.draw(ctx, 'P / ESC  RESUME', 240, 214, { align: 'center' });
    F.draw(ctx, 'R  RESTART', 240, 238, { align: 'center' });
    F.draw(ctx, 'M  SOUND', 240, 262, { align: 'center' });
  }

  function drawStageClear() {
    panel(90, 150, 300, 124);
    F.draw(ctx, 'STAGE CLEAR!', 240, 166, { scale: 3, color: '#ffe27a', align: 'center' });
    F.draw(ctx, 'CLEAR BONUS +' + G.clearBonus, 240, 210, { align: 'center' });
    F.draw(ctx, 'TIME BONUS +' + G.timeBonus, 240, 236, { align: 'center' });
  }

  function drawResult(clear) {
    dimField(0.7);
    panel(60, 104, 360, 270);
    var y = 122;
    if (clear) {
      F.draw(ctx, 'CONGRATULATIONS!', 240, y, { scale: 3, color: '#ffe27a', align: 'center' }); y += 38;
      F.draw(ctx, 'YOU ESCAPED THE MINE', 240, y, { color: '#9af0ff', align: 'center' }); y += 34;
    } else {
      F.draw(ctx, 'GAME OVER', 240, y, { scale: 3, color: '#ff5a4a', align: 'center' }); y += 44;
    }
    F.draw(ctx, 'SCORE ' + pad6(G.score), 240, y, { align: 'center' }); y += 24;
    F.draw(ctx, 'BEST  ' + pad6(G.hiStored), 240, y, { align: 'center', color: '#ffe27a' }); y += 24;
    if (!clear) { F.draw(ctx, 'REACHED STAGE ' + G.stage, 240, y, { align: 'center' }); y += 24; }
    if (G.newRecord) {
      var col = Math.floor(G.time * 5) % 2 === 0 ? '#ff7ac0' : '#ffe27a';
      F.draw(ctx, 'NEW RECORD!', 240, y, { align: 'center', color: col });
    }
    y += 34;
    var ready = G.stateTime >= 0.6;
    F.draw(ctx, clear ? 'ENTER  PLAY AGAIN' : 'ENTER  RETRY', 240, y, { align: 'center', color: ready ? '#ffffff' : '#7a7080' }); y += 24;
    F.draw(ctx, 'ESC    TITLE', 240, y, { align: 'center', color: ready ? '#ffffff' : '#7a7080' });
  }

  function drawTitle() {
    ctx.drawImage(A.titleBg, 0, 0);
    var t = G.time;
    // torches on the mine supports
    [[33, 104], [409, 104]].forEach(function (p, i) {
      drawSprite(A.torch[frameOf(t + i * 0.3, 7, 3)], p[0], p[1]);
    });
    ctx.globalCompositeOperation = 'lighter';
    [[49, 110], [425, 110]].forEach(function (p, i) {
      var r = 90 + Math.sin(t * 11 + i) * 6;
      var g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
      g.addColorStop(0, 'rgba(255,160,60,0.3)'); g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g; ctx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2);
    });
    ctx.globalCompositeOperation = 'source-over';
    // fireflies
    fireflies.forEach(function (f) {
      var x = (f.x + t * 12 * f.s) % 500 - 10;
      var y = f.y + Math.sin(t * f.s * 2 + f.p) * 14;
      var on = Math.sin(t * 3 * f.s + f.p) > -0.3;
      if (!on) return;
      ctx.fillStyle = f.c;
      ctx.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, 2, 2);
    });
    // logo with shimmer
    logoCtx.globalCompositeOperation = 'source-over';
    logoCtx.clearRect(0, 0, logoCv.width, logoCv.height);
    logoCtx.drawImage(A.logo.canvas, 0, 0);
    logoCtx.globalCompositeOperation = 'source-atop';
    var sweep = ((t % 3.2) / 3.2) * (logoCv.width + 200) - 100;
    logoCtx.fillStyle = 'rgba(255,255,255,0.55)';
    for (var yy = 0; yy < logoCv.height; yy += 2) {
      var sx = Math.round((sweep + yy * 0.5) / 2) * 2;
      logoCtx.fillRect(sx, yy, 12, 2);
    }
    var lx = Math.round((480 - A.logo.w) / 4) * 2;
    var ly = 14 + (Math.floor(t * 1.5) % 2) * 2;
    ctx.drawImage(logoCv, lx, ly);
    F.frameTexts.push('DYNAMITE MOLE');
    // logo fuse sparks
    A.logo.sparks.forEach(function (s, i) {
      var sx2 = lx + s[0] * 2, sy2 = ly + s[1] * 2;
      var k = Math.floor(t * 12 + i) % 3;
      ctx.fillStyle = '#fffbe8'; ctx.fillRect(sx2, sy2, 2, 2);
      ctx.fillStyle = '#ffd23a';
      if (k > 0) { ctx.fillRect(sx2 - 2, sy2, 2, 2); ctx.fillRect(sx2 + 2, sy2, 2, 2); ctx.fillRect(sx2, sy2 - 2, 2, 2); ctx.fillRect(sx2, sy2 + 2, 2, 2); }
      if (k === 2) { ctx.fillStyle = '#ff8a2a'; ctx.fillRect(sx2 - 4, sy2 - 4, 2, 2); ctx.fillRect(sx2 + 4, sy2 - 4, 2, 2); ctx.fillRect(sx2 + 4, sy2 + 4, 2, 2); }
    });
    // illustration: mole with a bomb
    drawSprite(shadowSpr, 206, 126);
    drawSprite(Math.floor(t / 0.6) % 2 ? A.player.idle2.down : A.player.walk.down[0], 206, 126);
    drawSprite(shadowSpr, 242, 126);
    drawSprite(A.bomb.normal[frameOf(t, 8, 4)], 242, 126);
    // walking mole along the rails
    var wx = ((t * 40) % 620) - 70;
    var wf = Math.floor(t * 8) % 4;
    drawSprite(A.player.walk.right[wf], wx, 344);
    // texts
    var blink = Math.floor(t * 2) % 2 === 0;
    F.draw(ctx, 'PRESS ENTER TO START', 240, 176, { align: 'center', color: blink ? '#ffffff' : '#8a7a6a' });
    F.draw(ctx, 'HI-SCORE ' + pad6(G.hiStored), 240, 202, { align: 'center', color: '#ffe27a' });
    ctx.fillStyle = 'rgba(10,6,12,0.7)';
    ctx.fillRect(96, 226, 288, 112);
    var lines = ['ARROWS / WASD  MOVE', 'SPACE / Z      BOMB', 'P / ESC        PAUSE', 'R              RESTART', 'M              SOUND'];
    lines.forEach(function (l, i) { F.draw(ctx, l, 110, 234 + i * 20, { color: '#e8dcc8' }); });
    // sound indicator
    F.draw(ctx, 'SND ' + (DM.Audio.muted ? 'OFF' : 'ON'), 470, 400, { align: 'right', color: '#9a8a7a', record: true });
  }

  function draw() {
    F.frameTexts = [];
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 480, 416);
    if (G.state === 'title') {
      drawTitle();
    } else {
      drawField();
      if (G.state === 'stageIntro') drawIntro();
      else if (G.state === 'paused') drawPause();
      else if (G.state === 'stageClear') drawStageClear();
      else if (G.state === 'gameOver') drawResult(false);
      else if (G.state === 'gameClear') drawResult(true);
      drawHud();
    }
    F.lastTexts = F.frameTexts;
  }

  DM.Render = { init: init, draw: draw };
})();
