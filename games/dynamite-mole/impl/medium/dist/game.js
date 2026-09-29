/* Dynamite Mole - game logic, rendering, input. */
(function () {
  'use strict';
  var T = 32, COLS = 15, ROWS = 11, HUD = 64, DT = 1 / 60, W = 480, H = 416;
  var STAGES = Level.STAGES;
  var AU = Audio2;

  /* ---------- params / storage ---------- */
  var params = new URLSearchParams(location.search);
  var seedParam = null;
  if (params.has('seed')) { var sp = parseInt(params.get('seed'), 10); if (isFinite(sp)) seedParam = sp >>> 0; }
  var startStage = parseInt(params.get('stage'), 10); if (!(startStage >= 1 && startStage <= 5)) startStage = 1;
  var DEBUG = params.get('debug') === '1';
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var DIRS = {
    up: { n: 'up', dx: 0, dy: -1 }, down: { n: 'down', dx: 0, dy: 1 },
    left: { n: 'left', dx: -1, dy: 0 }, right: { n: 'right', dx: 1, dy: 0 }
  };
  var DIRLIST = [DIRS.up, DIRS.down, DIRS.left, DIRS.right];
  var OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
  var EDEF = {
    slime: { speed: 2.0, hp: 1, score: 100 }, bat: { speed: 3.2, hp: 1, score: 200 },
    ghost: { speed: 2.4, hp: 1, score: 300 }, golem: { speed: 1.5, hp: 3, score: 500 }
  };

  /* ---------- state ---------- */
  var G = {
    state: 'title', seed: 0, stage: startStage, score: 0, lives: 3, timeLeft: 150,
    pw: { maxBombs: 1, range: 2, boots: 0 }, timer: 0, animT: 0,
    grid: null, hidden: null, exit: null, bombs: [], flames: [], items: [], enemies: [], crumbles: [],
    particles: [], popups: [], player: null, rng: null, hiSaved: 0, runEnded: false, newRecord: false,
    god: false, shake: 0, flash: 0, lock: 0, bonus: 0, lastWarn: -1, breakFlag: false, bombQueued: false,
    prevHi: 0
  };
  var input = { held: [], buffer: null };
  var hi = parseInt(lsGet('dynamiteMole.hiScore'), 10);
  G.hiSaved = isFinite(hi) && hi > 0 ? hi : 0;
  var muted = lsGet('dynamiteMole.muted') === '1';
  if (params.get('mute') === '1') muted = true;
  AU.setMuted(muted);

  function sfx(n) { AU.sfx(n); }

  function makePlayer() {
    return {
      x: 1, y: 1, sx: 1, sy: 1, tx: 1, ty: 1, prog: 0, moving: false, facing: 'down', alive: true,
      dieT: 0, inv: 0, walkT: 0, timeup: false, dust: 0
    };
  }
  function makeEnemy(s) {
    var d = EDEF[s.type];
    return {
      type: s.type, x: s.col, y: s.row, sx: s.col, sy: s.row, tx: s.col, ty: s.row, prog: 0, moving: false,
      dir: null, hp: d.hp, alive: true, deathT: 0, hitCd: 0, wait: 0, chase: false
    };
  }
  function loadStage(seed, stage) {
    var L = Level.generate(seed, stage);
    G.grid = L.grid; G.hidden = L.hidden;
    G.exit = { col: L.exit.col, row: L.exit.row, revealed: false, open: false };
    G.bombs = []; G.flames = []; G.items = []; G.crumbles = []; G.particles = []; G.popups = [];
    G.enemies = L.enemies.map(makeEnemy);
    G.timeLeft = STAGES[stage - 1].time;
    G.player = makePlayer();
    G.lastWarn = -1; G.shake = 0; G.flash = 0;
    input.buffer = null;
  }
  function freshSeed() { return seedParam !== null ? seedParam : ((Math.random() * 4294967296) >>> 0); }

  function toTitle() {
    G.state = 'title';
    G.seed = freshSeed();
    G.stage = startStage;
    loadStage(G.seed, G.stage);
    G.score = 0; G.lives = 3; G.pw = { maxBombs: 1, range: 2, boots: 0 };
  }
  function newRun() {
    G.seed = freshSeed();
    G.rng = Level.mulberry32((G.seed ^ 0xC0FFEE) >>> 0);
    G.score = 0; G.lives = 3; G.pw = { maxBombs: 1, range: 2, boots: 0 };
    G.stage = startStage; G.runEnded = false; G.newRecord = false;
    sfx('start');
    beginStage();
  }
  function beginStage() {
    loadStage(G.seed, G.stage);
    G.state = 'stageIntro'; G.timer = 1.8;
  }
  function endRun() {
    if (G.runEnded) return;
    G.runEnded = true;
    var prev = G.hiSaved;
    G.newRecord = G.score > prev && G.score > 0;
    if (G.score > prev) { G.hiSaved = G.score; lsSet('dynamiteMole.hiScore', String(G.score)); }
  }

  /* ---------- helpers ---------- */
  function bombAt(c, r) { for (var i = 0; i < G.bombs.length; i++) if (G.bombs[i].col === c && G.bombs[i].row === r) return G.bombs[i]; return null; }
  function inB(c, r) { return c >= 0 && r >= 0 && c < COLS && r < ROWS; }
  function playerCanEnter(c, r) { return inB(c, r) && G.grid[r][c] === '.' && !bombAt(c, r); }
  function enemyCanEnter(c, r) { return inB(c, r) && G.grid[r][c] === '.' && !bombAt(c, r); }
  function aliveEnemies() { var n = 0; G.enemies.forEach(function (e) { if (e.alive) n++; }); return n; }
  function pspeed() { return 4.5 + 0.6 * G.pw.boots; }
  function rnd() { return G.rng(); }
  function popup(text, col, row, color) { G.popups.push({ text: text, x: (col + 0.5) * T, y: HUD + row * T, t: 0, color: color || '#ffe45a' }); }
  function burst(x, y, n, colors, spd, life) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, s = (0.3 + Math.random()) * spd;
      G.particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - spd * 0.3, life: life * (0.6 + Math.random() * 0.6), max: life, color: colors[i % colors.length], size: 2 + (Math.random() < 0.4 ? 2 : 0), g: 200 });
    }
  }
  function tcx(c) { return (c + 0.5) * T; }
  function tcy(r) { return HUD + (r + 0.5) * T; }

  /* ---------- rocks / items ---------- */
  function breakRock(c, r, score) {
    G.grid[r][c] = '.';
    if (score) G.score += 10;
    G.breakFlag = true;
    G.crumbles.push({ col: c, row: r, t: 0 });
    var th = Art.themeDef[G.stage - 1];
    burst(tcx(c), tcy(r), 7, [th.rock, th.rLo, th.rHi], 90, 0.5);
    var k = c + ',' + r;
    if (G.hidden[k]) { G.items.push({ type: G.hidden[k], col: c, row: r }); delete G.hidden[k]; }
    if (G.exit.col === c && G.exit.row === r) { G.exit.revealed = true; }
  }

  /* ---------- bombs & flames ---------- */
  function addFlame(c, r, kind, dir) {
    var f = { col: c, row: r, timeLeft: 0.5, kind: kind, dir: dir };
    G.flames.push(f); return f;
  }
  function detonate(b) {
    var i = G.bombs.indexOf(b); if (i < 0) return;
    G.bombs.splice(i, 1);
    sfx('explode');
    if (!reduced) G.shake = 0.2;
    addFlame(b.col, b.row, 'c');
    burst(tcx(b.col), tcy(b.row), 10, ['#ffd23a', '#ff8a1a', '#fffbd0'], 140, 0.5);
    DIRLIST.forEach(function (d) {
      var last = null;
      for (var k = 1; k <= b.range; k++) {
        var c = b.col + d.dx * k, r = b.row + d.dy * k;
        if (!inB(c, r) || G.grid[r][c] === '#') break;
        if (G.grid[r][c] === 'S') { breakRock(c, r, true); last = addFlame(c, r, 'arm', d.n); break; }
        last = addFlame(c, r, 'arm', d.n);
        var ob = bombAt(c, r);
        if (ob) { ob.timeLeft = 0; detonate(ob); }
      }
      if (last) last.kind = 'tip';
    });
  }

  /* ---------- enemies ---------- */
  function killEnemy(e) {
    e.alive = false; e.deathT = 0.4; e.moving = false;
    var d = EDEF[e.type];
    G.score += d.score;
    sfx('enemyDie');
    var c = Math.round(e.x), r = Math.round(e.y);
    popup('+' + d.score, c, r);
    burst(tcx(c), tcy(r), 8, ['#f6f0e4', '#b8b0a4', '#ffe45a'], 100, 0.5);
  }
  function checkExitOpen() {
    if (!G.exit.open && aliveEnemies() === 0) {
      G.exit.open = true; sfx('exitOpen'); G.flash = 0.35;
    }
  }
  function decideEnemy(e) {
    var c = Math.round(e.x), r = Math.round(e.y), opts = [];
    DIRLIST.forEach(function (d) { if (enemyCanEnter(c + d.dx, r + d.dy)) opts.push(d); });
    var rev = e.dir ? OPP[e.dir] : null;
    function can(d) { return enemyCanEnter(c + d.dx, r + d.dy); }
    function wander() {
      var cur = e.dir ? DIRS[e.dir] : null;
      if (cur && can(cur) && rnd() >= 0.2) return cur;
      var o = opts.filter(function (d) { return d.n !== rev; });
      if (o.length) return o[Math.floor(rnd() * o.length)];
      if (rev && can(DIRS[rev])) return DIRS[rev];
      return null;
    }
    var ch = null;
    e.chase = false;
    if (e.type === 'bat') {
      var o = opts.filter(function (d) { return d.n !== rev; });
      if (o.length) ch = o[Math.floor(rnd() * o.length)];
      else if (rev && can(DIRS[rev])) ch = DIRS[rev];
    } else if (e.type === 'ghost') {
      var p = G.player, pc = Math.round(p.x), pr = Math.round(p.y);
      if (p.alive && Math.abs(pc - c) + Math.abs(pr - r) <= 6) {
        e.chase = true;
        if (rnd() < 0.25) ch = wander();
        else {
          var cand = opts.filter(function (d) { return d.n !== rev; });
          if (!cand.length) cand = opts;
          var best = 99, bl = [];
          cand.forEach(function (d) {
            var dist = Math.abs(pc - (c + d.dx)) + Math.abs(pr - (r + d.dy));
            if (dist < best) { best = dist; bl = [d]; } else if (dist === best) bl.push(d);
          });
          if (bl.length) ch = bl[Math.floor(rnd() * bl.length)];
        }
      } else ch = wander();
    } else ch = wander();
    if (!ch) { e.wait = 0.3; return false; }
    e.dir = ch.n; e.sx = c; e.sy = r; e.tx = c + ch.dx; e.ty = r + ch.dy; e.prog = 0; e.moving = true;
    return true;
  }
  function advance(e, dt, speed, decide) {
    var budget = dt, guard = 0;
    while (budget > 1e-9 && guard++ < 4) {
      if (!e.moving) { if (!decide(e)) return; }
      var need = (1 - e.prog) / speed;
      if (budget >= need) { budget -= need; e.x = e.tx; e.y = e.ty; e.prog = 0; e.moving = false; }
      else { e.prog += budget * speed; e.x = e.sx + (e.tx - e.sx) * e.prog; e.y = e.sy + (e.ty - e.sy) * e.prog; budget = 0; }
    }
  }

  /* ---------- player ---------- */
  function killPlayer(timeup) {
    var p = G.player;
    if (!p.alive) return;
    p.alive = false; p.dieT = 1.2; p.timeup = !!timeup; p.moving = false;
    p.x = Math.round(p.x); p.y = Math.round(p.y);
    G.lives = Math.max(0, G.lives - 1);
    G.pw.maxBombs = Math.max(1, G.pw.maxBombs - 1);
    G.pw.range = Math.max(2, G.pw.range - 1);
    G.pw.boots = Math.max(0, G.pw.boots - 1);
    input.buffer = null;
    sfx('playerDie');
    burst(tcx(p.x), tcy(p.y), 10, ['#ffe45a', '#ff8a1a', '#fff'], 110, 0.6);
  }
  function playerDecide(p) {
    var d = null;
    if (input.held.length) d = DIRS[input.held[input.held.length - 1]];
    else if (input.buffer) d = DIRS[input.buffer];
    input.buffer = null;
    if (!d) return false;
    p.facing = d.n;
    var c = Math.round(p.x), r = Math.round(p.y);
    if (!playerCanEnter(c + d.dx, r + d.dy)) return false;
    p.sx = c; p.sy = r; p.tx = c + d.dx; p.ty = r + d.dy; p.prog = 0; p.moving = true;
    return true;
  }
  function applyItem(it) {
    var pw = G.pw;
    G.score += 50;
    if (it.type === 'fire') pw.range = Math.min(6, pw.range + 1);
    else if (it.type === 'bomb') pw.maxBombs = Math.min(5, pw.maxBombs + 1);
    else if (it.type === 'boots') pw.boots = Math.min(3, pw.boots + 1);
    else G.lives = Math.min(5, G.lives + 1);
    sfx(it.type === 'life' ? 'life' : 'item');
    popup('+50', it.col, it.row, '#7af0ff');
    burst(tcx(it.col), tcy(it.row), 6, ['#fff', '#7af0ff', '#ffe45a'], 80, 0.4);
  }

  /* ---------- main tick ---------- */
  function tick(dt) {
    var p = G.player, i, e;
    G.breakFlag = false;
    // 1 timer
    if (p.alive) {
      G.timeLeft -= dt;
      if (G.timeLeft <= 0) { G.timeLeft = 0; if (!G.god) killPlayer(true); }
      else if (G.timeLeft <= 10) {
        var cw = Math.ceil(G.timeLeft);
        if (cw !== G.lastWarn) { G.lastWarn = cw; sfx('warn'); }
      }
    }
    // player death / respawn
    if (!p.alive) {
      p.dieT -= dt;
      if (p.dieT <= 0) {
        if (G.lives > 0) {
          var tu = p.timeup;
          G.player = p = makePlayer(); p.inv = 2.0;
          if (tu) G.timeLeft = 60.0;
        } else {
          G.state = 'gameOver'; endRun(); sfx('gameOver'); G.lock = 0.6; input.buffer = null; return;
        }
      }
    }
    if (p.inv > 0) p.inv = Math.max(0, p.inv - dt);
    // 2 player move + bomb
    if (p.alive) {
      var was = p.moving;
      advance(p, dt, pspeed(), playerDecide);
      if (p.moving) {
        p.walkT += dt; p.dust -= dt;
        if (p.dust <= 0) { p.dust = 0.13; G.particles.push({ x: tcx(p.x) - 6 + Math.random() * 12, y: tcy(p.y) + 10, vx: (Math.random() - 0.5) * 20, vy: -12, life: 0.3, max: 0.3, color: '#c8a880', size: 2, g: 0 }); }
      }
    }
    // 3 bombs
    var due = [];
    G.bombs.forEach(function (b) { b.timeLeft -= dt; if (b.timeLeft <= 0) due.push(b); });
    due.forEach(function (b) { if (G.bombs.indexOf(b) >= 0) detonate(b); });
    if (G.breakFlag) sfx('break');
    // 4 enemies
    for (i = G.enemies.length - 1; i >= 0; i--) {
      e = G.enemies[i];
      if (!e.alive) { e.deathT -= dt; if (e.deathT <= 0) G.enemies.splice(i, 1); continue; }
      if (e.hitCd > 0) e.hitCd = Math.max(0, e.hitCd - dt);
      if (e.wait > 0) { e.wait -= dt; continue; }
      advance(e, dt, EDEF[e.type].speed * STAGES[G.stage - 1].mult, decideEnemy);
    }
    // 5 flames
    for (i = G.flames.length - 1; i >= 0; i--) { G.flames[i].timeLeft -= dt; if (G.flames[i].timeLeft <= 0) G.flames.splice(i, 1); }
    // 6 flame hits
    var fm = {};
    G.flames.forEach(function (f) { fm[f.col + ',' + f.row] = 1; });
    if (p.alive && p.inv <= 0 && !G.god && fm[Math.round(p.x) + ',' + Math.round(p.y)]) killPlayer(false);
    G.enemies.forEach(function (en) {
      if (!en.alive || en.hitCd > 0) return;
      if (fm[Math.round(en.x) + ',' + Math.round(en.y)]) {
        en.hp--;
        if (en.hp <= 0) killEnemy(en);
        else { en.hitCd = 0.8; sfx('hit'); burst(tcx(en.x), tcy(en.y), 5, ['#fff', '#c8c8dc'], 90, 0.3); }
      }
    });
    // 7 contact
    if (p.alive && p.inv <= 0 && !G.god) {
      for (i = 0; i < G.enemies.length; i++) {
        e = G.enemies[i];
        if (!e.alive) continue;
        var dx = e.x - p.x, dy = e.y - p.y;
        if (Math.sqrt(dx * dx + dy * dy) < 0.6) { killPlayer(false); break; }
      }
    }
    // 8 items
    if (p.alive) {
      var pc = Math.round(p.x), pr = Math.round(p.y);
      for (i = G.items.length - 1; i >= 0; i--) {
        if (G.items[i].col === pc && G.items[i].row === pr) { var it = G.items.splice(i, 1)[0]; applyItem(it); }
      }
    }
    // 9 exit
    checkExitOpen();
    if (p.alive && G.exit.open && G.exit.revealed && G.grid[G.exit.row][G.exit.col] !== 'S' &&
      Math.round(p.x) === G.exit.col && Math.round(p.y) === G.exit.row) {
      G.state = 'stageClear'; G.timer = 3.0;
      G.bonus = 500 + Math.floor(G.timeLeft) * 10;
      G.bonusTime = Math.floor(G.timeLeft) * 10;
      sfx('stageClear');
      p.moving = false; p.x = Math.round(p.x); p.y = Math.round(p.y);
      burst(tcx(G.exit.col), tcy(G.exit.row), 16, ['#ffe45a', '#fff', '#7af0ff'], 130, 0.8);
    }
    updateFx(dt);
  }
  function updateFx(dt) {
    var i;
    for (i = G.particles.length - 1; i >= 0; i--) {
      var q = G.particles[i];
      q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.g * dt;
      if (q.life <= 0) G.particles.splice(i, 1);
    }
    for (i = G.popups.length - 1; i >= 0; i--) { G.popups[i].t += dt; if (G.popups[i].t >= 0.8) G.popups.splice(i, 1); }
    for (i = G.crumbles.length - 1; i >= 0; i--) { G.crumbles[i].t += dt; if (G.crumbles[i].t >= 0.3) G.crumbles.splice(i, 1); }
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt);
    if (G.flash > 0) G.flash = Math.max(0, G.flash - dt);
    // bomb fuse sparks
    if (G.state === 'playing' && Math.random() < dt * 20 * G.bombs.length) {
      var b = G.bombs[Math.floor(Math.random() * G.bombs.length)];
      G.particles.push({ x: tcx(b.col) + 6, y: tcy(b.row) - 12, vx: (Math.random() - 0.3) * 30, vy: -30 - Math.random() * 20, life: 0.25, max: 0.25, color: Math.random() < 0.5 ? '#ffd23a' : '#ff8a1a', size: 2, g: 60 });
    }
  }

  function update(dt) {
    if (G.state === 'paused') return;
    G.animT += dt;
    switch (G.state) {
      case 'title': break;
      case 'stageIntro':
        G.timer -= dt;
        if (G.timer <= 0) { G.state = 'playing'; input.buffer = null; }
        break;
      case 'playing': tick(dt); break;
      case 'stageClear':
        G.timer -= dt; updateFx(dt);
        if (G.timer <= 0) {
          G.score += G.bonus;
          if (G.stage >= 5) { G.state = 'gameClear'; endRun(); sfx('gameClear'); G.lock = 0.6; }
          else { G.stage++; beginStage(); }
        }
        break;
      case 'gameOver': case 'gameClear':
        if (G.lock > 0) G.lock -= dt;
        updateFx(dt);
        break;
    }
  }

  /* ---------- input ---------- */
  var KEYDIR = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right'
  };
  var GAMEKEYS = { Space: 1, Enter: 1, KeyZ: 1, KeyP: 1, KeyR: 1, KeyM: 1, Escape: 1 };
  function pressDir(d) {
    var i = input.held.indexOf(d); if (i >= 0) input.held.splice(i, 1);
    input.held.push(d);
    if (G.state === 'playing') input.buffer = d;
  }
  function releaseDir(d) { var i = input.held.indexOf(d); if (i >= 0) input.held.splice(i, 1); }
  function locked() { return (G.state === 'gameOver' || G.state === 'gameClear') && G.lock > 0; }
  function confirm() {
    if (G.state === 'title') newRun();
    else if ((G.state === 'gameOver' || G.state === 'gameClear') && !locked()) newRun();
  }
  function togglePause() {
    if (G.state === 'playing') { G.state = 'paused'; sfx('pause'); AU.setPaused(true); }
    else if (G.state === 'paused') { G.state = 'playing'; sfx('pause'); AU.setPaused(false); lastT = performance.now(); }
  }
  function restart() {
    var s = G.state;
    if (s === 'stageIntro' || s === 'playing' || s === 'paused' || s === 'stageClear') { endRun(); AU.setPaused(false); newRun(); }
    else if ((s === 'gameOver' || s === 'gameClear') && !locked()) newRun();
  }
  function toggleMute() {
    muted = !muted; AU.setMuted(muted); lsSet('dynamiteMole.muted', muted ? '1' : '0');
  }
  function bombKey() {
    var p = G.player;
    if (G.state !== 'playing' || !p.alive) return;
    var bc = Math.round(p.x), br = Math.round(p.y);
    if (G.bombs.length < G.pw.maxBombs && !bombAt(bc, br) && G.grid[br][bc] !== '#') {
      G.bombs.push({ col: bc, row: br, timeLeft: 2.5, range: G.pw.range });
      sfx('place');
    }
  }

  window.addEventListener('keydown', function (e) {
    var code = e.code;
    if (KEYDIR[code] || GAMEKEYS[code]) e.preventDefault();
    AU.init();
    if (e.repeat) return;
    if (KEYDIR[code]) { pressDir(KEYDIR[code]); return; }
    switch (code) {
      case 'Space': if (G.state === 'playing') bombKey(); else confirm(); break;
      case 'KeyZ': bombKey(); break;
      case 'Enter': confirm(); break;
      case 'KeyP': togglePause(); break;
      case 'Escape':
        if (G.state === 'playing' || G.state === 'paused') togglePause();
        else if ((G.state === 'gameOver' || G.state === 'gameClear') && !locked()) toTitle();
        break;
      case 'KeyR': restart(); break;
      case 'KeyM': toggleMute(); break;
    }
  });
  window.addEventListener('keyup', function (e) {
    if (KEYDIR[e.code]) { e.preventDefault(); releaseDir(KEYDIR[e.code]); }
  });
  window.addEventListener('blur', function () { input.held.length = 0; });
  document.addEventListener('visibilitychange', function () { if (document.hidden && G.state === 'playing') togglePause(); });

  /* ---------- canvas / layout ---------- */
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  var touchEl = document.getElementById('touch');
  var touchOn = params.get('touch') === '1';
  try { if (window.matchMedia('(pointer: coarse)').matches) touchOn = true; } catch (e) {}
  if (touchOn) touchEl.style.display = 'flex';
  function layout() {
    var th = touchOn ? touchEl.offsetHeight : 0;
    var aw = window.innerWidth, ah = window.innerHeight - th;
    var s = Math.min(aw / W, ah / H);
    canvas.style.width = Math.floor(W * s) + 'px';
    canvas.style.height = Math.floor(H * s) + 'px';
  }
  window.addEventListener('resize', layout);
  canvas.addEventListener('pointerdown', function () {
    AU.init();
    if (G.state === 'title' || G.state === 'gameOver' || G.state === 'gameClear') confirm();
  });
  // touch buttons
  (function () {
    var btns = touchEl.querySelectorAll('[data-k]');
    Array.prototype.forEach.call(btns, function (b) {
      var k = b.getAttribute('data-k'), down = false;
      function on(ev) {
        ev.preventDefault(); AU.init(); if (down) return; down = true; b.classList.add('on');
        try { b.setPointerCapture(ev.pointerId); } catch (e) {}
        if (DIRS[k]) pressDir(k); else if (k === 'bomb') bombKey(); else if (k === 'pause') togglePause();
      }
      function off(ev) { ev.preventDefault(); if (!down) return; down = false; b.classList.remove('on'); if (DIRS[k]) releaseDir(k); }
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });
  })();

  /* ---------- rendering ---------- */
  var lightC = document.createElement('canvas'); lightC.width = W; lightC.height = 352;
  var lightX = lightC.getContext('2d');
  var DARK = [0.16, 0.26, 0.24, 0.30, 0.46];
  var white = new Map();
  function whiteOf(c) { var w = white.get(c); if (!w) { w = Art.tint(c, '#ffffff'); white.set(c, w); } return w; }
  function text(s, x, y, sc, col, o) { return Font.draw(ctx, s, x, y, sc, col, o); }
  function pad6(n) { var s = String(n); while (s.length < 6) s = '0' + s; return s; }
  function fmtTime(t) { var s = Math.max(0, Math.ceil(t)); return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); }
  function shadow(cx, cy, r) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(Math.round(cx - r), Math.round(cy + 10), Math.round(r * 2), 4); ctx.fillRect(Math.round(cx - r + 2), Math.round(cy + 14), Math.round(r * 2 - 4), 2); }

  function drawHUD() {
    ctx.drawImage(Art.hud, 0, 0);
    var sc = 2, hiv = Math.max(G.hiSaved, G.score);
    text('SCORE ' + pad6(G.score), 10, 6, sc, '#ffffff', { shadow: '#000' });
    text('HI ' + pad6(hiv), 176, 6, sc, '#ffd23a', { shadow: '#000' });
    var low = G.timeLeft <= 30 && G.state !== 'stageIntro';
    var tcol = low && Math.floor(G.animT * 3) % 2 === 0 ? '#ff4a3a' : (low ? '#ffa090' : '#ffffff');
    text('TIME ' + fmtTime(G.timeLeft), 340, 6, sc, tcol, { shadow: '#000' });
    text('STAGE ' + G.stage + '/5', 10, 23, sc, '#ffffff', { shadow: '#000' });
    ctx.drawImage(Art.hudFace, 150, 22);
    text('x' + G.lives, 172, 23, sc, '#ffffff', { shadow: '#000' });
    text('SND ' + (muted ? 'OFF' : 'ON'), 340, 23, sc, muted ? '#ff8a7a' : '#8af08a', { shadow: '#000' });
    text('BOMB ' + G.pw.maxBombs, 10, 40, sc, '#ff9a5a', { shadow: '#000' });
    text('FIRE ' + G.pw.range, 140, 40, sc, '#ffd23a', { shadow: '#000' });
    text('SPD ' + G.pw.boots, 270, 40, sc, '#7af0a0', { shadow: '#000' });
  }

  function drawField() {
    var th = Art.themes[G.stage - 1], r, c, i;
    var sx = 0, sy = 0;
    if (G.shake > 0 && !reduced) { var a = 4 * (G.shake / 0.2); sx = Math.round((Math.random() * 2 - 1) * a); sy = Math.round((Math.random() * 2 - 1) * a); }
    ctx.save();
    ctx.beginPath(); ctx.rect(0, HUD, W, 352); ctx.clip();
    ctx.translate(sx, sy);
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
      var x = c * T, y = HUD + r * T, g = G.grid[r][c];
      if (g === '#') {
        ctx.drawImage((r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) ? th.wall : th.pillar, x, y);
      } else {
        var v = (c + r) % 2, dec = ((c * 7 + r * 13) % 11 === 0) && v === 0;
        ctx.drawImage(dec ? th.floor[2] : th.floor[v], x, y);
        if (g === 'S') ctx.drawImage(th.rock, x, y);
      }
    }
    // crumble
    G.crumbles.forEach(function (k) { ctx.drawImage(th.crumble[Math.min(2, Math.floor(k.t / 0.1))], k.col * T, HUD + k.row * T); });
    // exit
    var ex = G.exit;
    if (ex.revealed && G.grid[ex.row][ex.col] !== 'S') {
      ctx.drawImage(ex.open ? Art.exitOpen[Math.floor(G.animT * 4) % 2] : Art.exitClosed, ex.col * T, HUD + ex.row * T);
    }
    // items
    G.items.forEach(function (it) {
      var bob = Math.round(Math.sin(G.animT * 4 + it.col) * 2) * 1;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(it.col * T + 8, HUD + it.row * T + 26, 16, 3);
      ctx.drawImage(Art.item[it.type][Math.floor(G.animT * 3 + it.col) % 2], it.col * T, HUD + it.row * T + bob - 2);
    });
    // bombs
    G.bombs.forEach(function (b) {
      var fr = Math.floor(G.animT * 6) % 3;
      var fl = b.timeLeft < 0.8 && Math.floor(b.timeLeft * 14) % 2 === 0;
      var pulse = Math.floor(G.animT * 6) % 3 === 1 ? -2 : 0;
      shadow(tcx(b.col), tcy(b.row) - 4, 9);
      ctx.drawImage(fl ? Art.bombFlash[fr] : Art.bomb[fr], b.col * T, HUD + b.row * T + pulse);
    });
    // enemies (dying first)
    var order = G.enemies.slice().sort(function (a, b) { return a.y - b.y; });
    order.forEach(function (e) {
      var cx = tcx(e.x), cy = tcy(e.y), spr;
      if (!e.alive) {
        var f = Math.min(2, Math.floor((0.4 - e.deathT) / 0.4 * 3));
        ctx.drawImage(Art.puff[f], Math.round(cx - 16), Math.round(cy - 16)); return;
      }
      shadow(cx, cy, e.type === 'golem' ? 10 : 8);
      if (e.type === 'slime') spr = Art.slime[Math.floor(G.animT * 6) % 4];
      else if (e.type === 'bat') spr = Art.bat[Math.floor(G.animT * 12) % 4];
      else if (e.type === 'ghost') spr = (e.chase ? Art.ghostChase : Art.ghost)[Math.floor(G.animT * 4) % 3];
      else spr = Art.golem[Math.floor(G.animT * 4) % 4];
      var bobY = e.type === 'ghost' || e.type === 'bat' ? Math.round(Math.sin(G.animT * 5 + e.x) * 2) - 2 : 0;
      if (e.hitCd > 0) { if (Math.floor(e.hitCd / 0.07) % 2 === 0) spr = whiteOf(spr); else if (Math.floor(e.hitCd / 0.07) % 4 === 1) return; }
      ctx.drawImage(spr, Math.round(cx - 16), Math.round(cy - 16 + bobY));
    });
    // player
    var p = G.player;
    var pcx = tcx(p.x), pcy = tcy(p.y), ps;
    if (!p.alive) {
      ps = Art.moleDie[Math.min(5, Math.floor((1.2 - Math.max(0, p.dieT)) / 1.2 * 6))];
      ctx.drawImage(ps, Math.round(pcx - 16), Math.round(pcy - 16));
    } else {
      var vis = !(p.inv > 0 && Math.floor(p.inv / 0.0625) % 2 === 0);
      if (vis) {
        shadow(pcx, pcy, 9);
        var joy = 0;
        if (G.state === 'stageClear') { ps = Art.mole.down[Math.floor(G.animT * 8) % 4 < 2 ? 0 : 1]; joy = -Math.round(Math.abs(Math.sin(G.animT * 8)) * 6); }
        else if (p.moving) ps = Art.mole[p.facing][Math.floor(p.walkT * 10) % 4];
        else ps = Art.mole[p.facing][Math.floor(G.animT * 2.5) % 2 ? 4 : 0];
        ctx.drawImage(ps, Math.round(pcx - 16), Math.round(pcy - 16 + joy));
      }
    }
    // flames
    var fr = Math.floor(G.animT * 12) % 2;
    G.flames.forEach(function (f) {
      var set = Art.flame[fr], spr;
      if (f.kind === 'c') spr = set.center; else if (f.kind === 'tip') spr = set.tip[f.dir]; else spr = (f.dir === 'left' || f.dir === 'right') ? set.h : set.v;
      var s = f.timeLeft < 0.12 ? 0.55 + f.timeLeft / 0.12 * 0.45 : 1;
      var sz = Math.round(32 * s / 2) * 2;
      ctx.drawImage(spr, f.col * T + (32 - sz) / 2, HUD + f.row * T + (32 - sz) / 2, sz, sz);
    });
    // particles
    G.particles.forEach(function (q) {
      ctx.globalAlpha = Math.min(1, q.life / q.max * 1.5);
      ctx.fillStyle = q.color; ctx.fillRect(Math.round(q.x / 2) * 2, Math.round(q.y / 2) * 2, q.size, q.size);
    });
    ctx.globalAlpha = 1;
    // exit open flash
    if (G.flash > 0 && G.exit.revealed) {
      ctx.fillStyle = 'rgba(255,240,160,' + (G.flash / 0.35 * 0.6) + ')';
      ctx.fillRect(G.exit.col * T - 8, HUD + G.exit.row * T - 8, T + 16, T + 16);
    }
    // lighting
    lightX.globalCompositeOperation = 'source-over';
    lightX.clearRect(0, 0, W, 352);
    lightX.fillStyle = 'rgba(6,3,16,' + DARK[G.stage - 1] + ')'; lightX.fillRect(0, 0, W, 352);
    lightX.globalCompositeOperation = 'destination-out';
    var fl = 0.94 + Math.sin(G.animT * 13) * 0.04 + Math.sin(G.animT * 5.3) * 0.02;
    function lamp(x, y, rad) { lightX.drawImage(Art.light, x - rad, y - HUD - rad, rad * 2, rad * 2); }
    if (p.alive || true) lamp(pcx, pcy, 150 * fl);
    G.bombs.forEach(function (b) { lamp(tcx(b.col), tcy(b.row), 56 * fl); });
    G.flames.forEach(function (f) { if (f.kind !== 'arm') lamp(tcx(f.col), tcy(f.row), 70); else lamp(tcx(f.col), tcy(f.row), 44); });
    if (ex.revealed) lamp(tcx(ex.col), tcy(ex.row), ex.open ? 80 : 40);
    G.items.forEach(function (it) { lamp(tcx(it.col), tcy(it.row), 34); });
    ctx.drawImage(lightC, 0, HUD);
    ctx.drawImage(Art.vignette, 0, HUD);
    // popups
    G.popups.forEach(function (q) {
      var y = q.y - q.t / 0.8 * 22;
      ctx.globalAlpha = q.t > 0.55 ? Math.max(0, 1 - (q.t - 0.55) / 0.25) : 1;
      text(q.text, q.x, Math.round(y), 2, q.color, { align: 'center', shadow: '#000' });
      ctx.globalAlpha = 1;
    });
    ctx.restore();
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = '#0c0808'; ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
    ctx.fillStyle = '#8a5a2a'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#241a1c'; ctx.fillRect(x, y, w, h);
  }
  function dim(a) { ctx.fillStyle = 'rgba(4,2,10,' + a + ')'; ctx.fillRect(0, HUD, W, 352); }

  function drawTitle() {
    var t = G.animT;
    ctx.drawImage(Art.titleBg, 0, 0);
    // lantern glow
    var fl = 0.85 + Math.sin(t * 9) * 0.08 + Math.sin(t * 3.7) * 0.05;
    [[44, 150], [436, 150]].forEach(function (l) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 * fl;
      var r = 90 * fl; ctx.drawImage(Art.light, l[0] - r, l[1] - r, r * 2, r * 2);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.fillStyle = '#2a1a0c'; ctx.fillRect(l[0] - 8, l[1] - 12, 16, 4); ctx.fillRect(l[0] - 8, l[1] + 8, 16, 4);
      ctx.fillStyle = '#ffb42a'; ctx.fillRect(l[0] - 6, l[1] - 8, 12, 16); ctx.fillStyle = '#fff2a0'; ctx.fillRect(l[0] - 2, l[1] - 4, 4, 8);
      ctx.fillStyle = '#5a3a1a'; ctx.fillRect(l[0] - 8, l[1] - 8, 2, 16); ctx.fillRect(l[0] + 6, l[1] - 8, 2, 16);
    });
    // fireflies
    for (var i = 0; i < 14; i++) {
      var fx = 60 + ((i * 97) % 360) + Math.sin(t * 0.7 + i) * 20, fy = 80 + ((i * 53) % 260) + Math.cos(t * 0.5 + i * 2) * 16;
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + i));
      ctx.fillStyle = i % 3 ? '#e8ff8a' : '#8af0ff'; ctx.fillRect(Math.round(fx / 2) * 2, Math.round(fy / 2) * 2, 4, 4);
    }
    ctx.globalAlpha = 1;
    // logo with glow pulse
    var lgY = 44 + Math.round(Math.sin(t * 2) * 2);
    ctx.drawImage(Art.logo, 20, lgY);
    Font.texts.push('DYNAMITE MOLE');
    // mole + bomb illustration
    var by = Math.round(Math.sin(t * 4) * 3);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(150, 226, 180, 6);
    ctx.drawImage(Art.mole.right[Math.floor(t * 8) % 4], 172, 160 + by, 64, 64);
    ctx.drawImage(Art.bomb[Math.floor(t * 6) % 3], 250, 164, 64, 64);
    if (Math.random() < 0.6) G.particles.push({ x: 250 + 46, y: 164 + 8, vx: (Math.random() - 0.3) * 60, vy: -50 - Math.random() * 40, life: 0.5, max: 0.5, color: Math.random() < 0.5 ? '#ffd23a' : '#ff8a1a', size: 4, g: 80 });
    G.particles.forEach(function (q) { ctx.globalAlpha = Math.min(1, q.life / q.max * 1.5); ctx.fillStyle = q.color; ctx.fillRect(Math.round(q.x / 2) * 2, Math.round(q.y / 2) * 2, q.size, q.size); });
    ctx.globalAlpha = 1;
    if (Math.floor(t * 2) % 2 === 0) text('PRESS ENTER TO START', 240, 246, 2, '#ffffff', { align: 'center', shadow: '#000' });
    text('HI-SCORE ' + pad6(G.hiSaved), 240, 274, 2, '#ffd23a', { align: 'center', shadow: '#000' });
    ctx.fillStyle = 'rgba(8,4,14,0.6)'; ctx.fillRect(100, 304, 280, 104);
    var lines = ['ARROWS / WASD  MOVE', 'SPACE / Z      BOMB', 'P / ESC        PAUSE', 'R              RESTART', 'M              SOUND'];
    lines.forEach(function (s, k) { text(s, 108, 310 + k * 19, 2, '#e8dcc8', { shadow: '#000' }); });
  }

  function drawIntro() {
    dim(0.6);
    var st = STAGES[G.stage - 1];
    panel(60, 150, 360, 180);
    text('STAGE ' + G.stage, 240, 166, 4, '#ffd23a', { align: 'center', shadow: '#5a2a0a' });
    text(st.name, 240, 214, 2, '#ffffff', { align: 'center', shadow: '#000' });
    var tot = 0; ['slime', 'bat', 'ghost', 'golem'].forEach(function (k) { tot += st.enemies[k]; });
    text('ENEMIES ' + tot, 240, 244, 2, '#ff9a7a', { align: 'center', shadow: '#000' });
    var icons = []; ['slime', 'bat', 'ghost', 'golem'].forEach(function (k) { for (var n = 0; n < st.enemies[k]; n++) icons.push(k); });
    var iw = 26, x0 = 240 - icons.length * iw / 2;
    icons.forEach(function (k, n) {
      var sp = k === 'slime' ? Art.slime[Math.floor(G.animT * 6) % 4] : k === 'bat' ? Art.bat[Math.floor(G.animT * 12) % 4] : k === 'ghost' ? Art.ghost[Math.floor(G.animT * 4) % 3] : Art.golem[Math.floor(G.animT * 4) % 4];
      ctx.drawImage(sp, Math.round(x0 + n * iw - 3), 274);
    });
  }
  function drawPause() {
    dim(0.6);
    panel(100, 160, 280, 150);
    text('PAUSED', 240, 176, 4, '#ffd23a', { align: 'center', shadow: '#5a2a0a' });
    text('P / ESC  RESUME', 240, 226, 2, '#fff', { align: 'center', shadow: '#000' });
    text('R  RESTART', 240, 252, 2, '#fff', { align: 'center', shadow: '#000' });
    text('M  SOUND', 240, 278, 2, '#fff', { align: 'center', shadow: '#000' });
  }
  function drawClear() {
    dim(0.45);
    panel(70, 150, 340, 150);
    text('STAGE CLEAR!', 240, 166, 3, '#ffd23a', { align: 'center', shadow: '#5a2a0a' });
    var k = Math.min(1, (3 - G.timer) / 0.8);
    text('CLEAR BONUS +500', 240, 214, 2, '#ffffff', { align: 'center', shadow: '#000' });
    text('TIME BONUS +' + G.bonusTime, 240, 242, 2, '#7af0ff', { align: 'center', shadow: '#000' });
  }
  function drawEnd(win) {
    dim(0.75);
    panel(50, 100, 380, 250);
    var y = 116;
    if (win) {
      text('CONGRATULATIONS!', 240, y, 3, '#ffd23a', { align: 'center', shadow: '#5a2a0a' }); y += 40;
      text('YOU ESCAPED THE MINE', 240, y, 2, '#ffffff', { align: 'center', shadow: '#000' }); y += 30;
    } else {
      text('GAME OVER', 240, y, 4, '#ff5a4a', { align: 'center', shadow: '#4a0a0a' }); y += 50;
    }
    text('SCORE ' + pad6(G.score), 240, y, 2, '#ffffff', { align: 'center', shadow: '#000' }); y += 24;
    text('BEST  ' + pad6(G.hiSaved), 240, y, 2, '#ffd23a', { align: 'center', shadow: '#000' }); y += 24;
    if (!win) { text('REACHED STAGE ' + G.stage, 240, y, 2, '#ffffff', { align: 'center', shadow: '#000' }); y += 24; }
    if (G.newRecord && Math.floor(G.animT * 3) % 2 === 0) text('NEW RECORD!', 240, y, 2, '#7af0a0', { align: 'center', shadow: '#000' });
    else if (G.newRecord) Font.texts.push('NEW RECORD!');
    y += 28;
    text('ENTER  ' + (win ? 'PLAY AGAIN' : 'RETRY'), 240, y, 2, '#ffffff', { align: 'center', shadow: '#000' }); y += 22;
    text('ESC    TITLE', 240, y, 2, '#ffffff', { align: 'center', shadow: '#000' });
  }

  function render() {
    Font.texts.length = 0;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (G.state === 'title') { drawTitle(); return; }
    drawField(); drawHUD();
    if (G.state === 'stageIntro') drawIntro();
    else if (G.state === 'paused') drawPause();
    else if (G.state === 'stageClear') drawClear();
    else if (G.state === 'gameOver') drawEnd(false);
    else if (G.state === 'gameClear') drawEnd(true);
  }

  /* ---------- snapshot / debug ---------- */
  function bgmId() {
    if (G.state === 'title') return 'title';
    if (G.state === 'playing' || G.state === 'paused') return 'stage' + G.stage;
    return null;
  }
  function snapshot() {
    var p = G.player;
    return {
      state: G.state, seed: G.seed, stage: G.stage, score: G.score, hiScore: Math.max(G.hiSaved, G.score),
      lives: G.lives, timeLeft: G.timeLeft,
      player: {
        col: Math.round(p.x), row: Math.round(p.y), x: p.x, y: p.y, facing: p.facing, alive: p.alive,
        invincible: p.inv, maxBombs: G.pw.maxBombs, activeBombs: G.bombs.length, range: G.pw.range,
        boots: G.pw.boots, speed: pspeed()
      },
      bombs: G.bombs.map(function (b) { return { col: b.col, row: b.row, timeLeft: b.timeLeft, range: b.range }; }),
      flames: G.flames.map(function (f) { return { col: f.col, row: f.row, timeLeft: f.timeLeft }; }),
      enemies: G.enemies.map(function (e) { return { type: e.type, col: Math.round(e.x), row: Math.round(e.y), x: e.x, y: e.y, hp: e.hp, alive: e.alive }; }),
      items: G.items.map(function (i) { return { type: i.type, col: i.col, row: i.row }; }),
      exit: { col: G.exit.col, row: G.exit.row, revealed: G.exit.revealed, open: G.exit.open },
      grid: G.grid.map(function (r) { return r.join(''); }),
      texts: Font.texts.slice(),
      audio: { unlocked: AU.unlocked, muted: muted, bgm: bgmId(), sfxLog: AU.sfxLog.map(function (s) { return { name: s.name, time: s.time }; }) }
    };
  }
  var API = { snapshot: snapshot };
  if (DEBUG) {
    API.debug = {
      killAllEnemies: function () { G.enemies.forEach(function (e) { if (e.alive) killEnemy(e); }); checkExitOpen(); },
      revealExit: function () { if (G.grid[G.exit.row][G.exit.col] === 'S') breakRock(G.exit.col, G.exit.row, false); },
      clearBlocks: function () { for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (G.grid[r][c] === 'S') breakRock(c, r, false); },
      teleport: function (c, r) {
        if (!inB(c, r) || G.grid[r][c] === '#') return;
        if (G.grid[r][c] === 'S') breakRock(c, r, false);
        var p = G.player; p.x = p.sx = p.tx = c; p.y = p.sy = p.ty = r; p.moving = false; p.prog = 0; input.buffer = null;
      },
      setLives: function (n) { G.lives = Math.max(1, Math.min(5, n | 0)); },
      setTimeLeft: function (s) { G.timeLeft = Math.max(0, +s); },
      setPowerups: function (o) {
        if (o.maxBombs !== undefined) G.pw.maxBombs = Math.max(1, Math.min(5, o.maxBombs | 0));
        if (o.range !== undefined) G.pw.range = Math.max(2, Math.min(6, o.range | 0));
        if (o.boots !== undefined) G.pw.boots = Math.max(0, Math.min(3, o.boots | 0));
      },
      spawnItem: function (t, c, r) {
        if (!inB(c, r) || G.grid[r][c] !== '.' || !EDEF || ['fire', 'bomb', 'boots', 'life'].indexOf(t) < 0) return;
        G.items.push({ type: t, col: c, row: r });
      },
      spawnEnemy: function (t, c, r) {
        if (!EDEF[t] || !inB(c, r) || G.grid[r][c] !== '.') return;
        G.enemies.push(makeEnemy({ type: t, col: c, row: r }));
      },
      godMode: function (on) { G.god = !!on; }
    };
  }
  window.__GAME__ = API;

  /* ---------- loop ---------- */
  var lastT = performance.now(), acc = 0, prevWarnState = null;
  function syncAudio() {
    AU.setBgm(bgmId());
    AU.setFast(G.state === 'playing' && G.timeLeft <= 30 && G.player.alive);
  }
  function frame(now) {
    var dt = (now - lastT) / 1000; lastT = now;
    if (dt > 0.25) dt = 0.25; if (dt < 0) dt = 0;
    if (G.state === 'paused') acc = 0; else acc += dt;
    while (acc >= DT) { update(DT); acc -= DT; }
    syncAudio();
    render();
    requestAnimationFrame(frame);
  }

  Art.build();
  toTitle();
  layout();
  render();
  requestAnimationFrame(function (t) { lastT = t; requestAnimationFrame(frame); });
})();
