/* game.js - all game rules: state machine, player, bombs/flames, enemies, timer, score, debug API.
 * Logic time is always in seconds; update() is called with a fixed 1/60 step. */
(function (root) {
  'use strict';
  var DM = root.DM = root.DM || {};
  var COLS = DM.COLS, ROWS = DM.ROWS;

  var DIRS = { up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } };
  var OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
  var DIR_LIST = ['up', 'down', 'left', 'right'];

  var K = {
    FUSE: 2.5, FLAME_LIFE: 0.5, INV_RESPAWN: 2.0, DEATH_ANIM: 1.2, ENEMY_DEATH: 0.4, HIT_INV: 0.8,
    CONTACT: 0.6, ENEMY_WAIT: 0.3, TIMEUP_RESET: 60, INTRO: 1.8, CLEAR: 3.0, LOCK: 0.6,
    POPUP: 0.8, CRUMBLE: 0.3
  };
  DM.K = K;

  var ENEMY_DEF = {
    slime: { speed: 2.0, hp: 1, score: 100 },
    bat: { speed: 3.2, hp: 1, score: 200 },
    ghost: { speed: 2.4, hp: 1, score: 300 },
    golem: { speed: 1.5, hp: 3, score: 500 }
  };
  DM.ENEMY_DEF = ENEMY_DEF;

  var HI_KEY = 'dynamiteMole.hiScore';

  var G = DM.Game = {
    state: 'title',
    seed: 0, seedFixed: null, startStage: 1, stage: 1,
    debugEnabled: false,
    score: 0, lives: 3, timeLeft: 150,
    hiSaved: 0,
    grid: [], hidden: {}, exit: { col: 0, row: 0, revealed: false, open: false },
    player: null, bombs: [], flames: [], enemies: [], items: [],
    particles: [], popups: [], crumbles: [],
    rng: null,
    animT: 0, introT: 0, clearT: 0, lockT: 0,
    shakeT: 0, shakeAmp: 0, flashT: 0, flashColor: '#ffffff',
    runActive: false,
    result: { score: 0, best: 0, newRecord: false, stage: 1 },
    clearInfo: { clear: 500, time: 0 },
    god: false,
    reducedMotion: false,
    input: { held: [], buffer: null, bombReq: false },
    warnAcc: null,
    breakSfxThisTick: false,
    uid: 0,
    fresh: true
  };

  /* ------------------------------------------------------------------ helpers */
  function sfx(name) { if (DM.Audio) DM.Audio.sfx(name); }
  function playerSpeed() { return 4.5 + 0.6 * G.player.boots; }
  function pcol() { return Math.round(G.player.x); }
  function prow() { return Math.round(G.player.y); }
  function randomSeed() { return (Math.floor(Math.random() * 4294967296)) >>> 0; }  /* the ONLY use of Math.random */

  function bombAt(c, r) {
    for (var i = 0; i < G.bombs.length; i++) {
      var b = G.bombs[i];
      if (!b.dead && b.col === c && b.row === r) return b;
    }
    return null;
  }
  function flameAt(c, r) {
    for (var i = 0; i < G.flames.length; i++) {
      var f = G.flames[i];
      if (f.col === c && f.row === r) return f;
    }
    return null;
  }
  function activeBombs() {
    var n = 0;
    for (var i = 0; i < G.bombs.length; i++) if (!G.bombs[i].dead) n++;
    return n;
  }
  function aliveEnemies() {
    var n = 0;
    for (var i = 0; i < G.enemies.length; i++) if (G.enemies[i].alive) n++;
    return n;
  }
  function tileAt(c, r) {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return '#';
    return G.grid[r][c];
  }
  /* may an actor (player or enemy) START a step into this tile? */
  function canEnter(c, r) {
    var t = tileAt(c, r);
    if (t === '#' || t === 'S') return false;
    if (bombAt(c, r)) return false;
    return true;
  }

  function readHi() {
    var v = DM.storage.get(HI_KEY);
    var n = parseInt(v, 10);
    return isFinite(n) && n > 0 ? n : 0;
  }

  function newPlayer() {
    return {
      x: 1, y: 1, facing: 'down', alive: true, deathT: 0, deathTimeUp: false, deathAge: 0,
      invT: 0, maxBombs: 1, range: 2, boots: 0,
      stepping: false, fromX: 1, fromY: 1, toX: 1, toY: 1, prog: 0,
      walkDist: 0, moving: false, joy: false, stepDir: 'down'
    };
  }
  function resetPowerups() {
    var P = G.player;
    P.maxBombs = 1; P.range = 2; P.boots = 0;
  }

  /* ------------------------------------------------------------------ state changes */
  function bgmFor(state) {
    if (state === 'title') return 'title';
    if (state === 'playing' || state === 'paused') return 'stage' + G.stage;
    return null;
  }
  function setState(s) {
    G.state = s;
    if (DM.Audio) {
      DM.Audio.setBgm(bgmFor(s));
      DM.Audio.setPaused(s === 'paused');
      if (s !== 'playing') DM.Audio.setTempoUp(false);
    }
  }

  /* ------------------------------------------------------------------ stage loading */
  function makeEnemy(type, col, row) {
    var def = ENEMY_DEF[type];
    var sm = DM.STAGES[G.stage - 1].speedMul;
    G.uid++;
    return {
      id: G.uid, type: type, x: col, y: row, hp: def.hp, alive: true,
      speed: def.speed * sm, heading: null,
      stepping: false, fromX: col, fromY: row, toX: col, toY: row, prog: 0,
      wait: 0, hitT: 0, deathT: 0, chasing: false, face: 'down', phase: (G.uid * 0.37) % 1, walkDist: 0
    };
  }

  function loadStage(n) {
    G.stage = n;
    var lv = DM.generateLevel(G.seed, n);
    G.grid = lv.grid;
    G.hidden = lv.hidden;
    G.exit = { col: lv.exit.col, row: lv.exit.row, revealed: false, open: false, openT: 0 };
    G.bombs = []; G.flames = []; G.items = []; G.particles = []; G.popups = []; G.crumbles = [];
    G.enemies = lv.enemies.map(function (e) { return makeEnemy(e.type, e.col, e.row); });
    var P = G.player;
    P.x = 1; P.y = 1; P.facing = 'down'; P.alive = true; P.invT = 0; P.stepping = false; P.prog = 0;
    P.moving = false; P.joy = false; P.deathT = 0;
    G.input.buffer = null; G.input.bombReq = false;
    G.timeLeft = DM.STAGES[n - 1].time;
    G.warnAcc = null;
    G.shakeT = 0; G.flashT = 0;
    G.fresh = true;
  }

  function beginRun() {
    if (G.seedFixed != null) G.seed = G.seedFixed; else G.seed = randomSeed();
    G.rng = DM.mulberry32((G.seed ^ 0xC0FFEE) >>> 0);
    G.score = 0;
    G.lives = 3;
    G.player = newPlayer();
    G.god = G.god && G.debugEnabled;
    G.runActive = true;
    G.result = { score: 0, best: G.hiSaved, newRecord: false, stage: G.startStage };
    loadStage(G.startStage);
    G.introT = K.INTRO;
    setState('stageIntro');
    sfx('start');
  }

  /* the current run is over: store the high score exactly once */
  function endRun() {
    if (!G.runActive) return;
    G.runActive = false;
    var prev = G.hiSaved;
    if (G.score > prev) {
      G.hiSaved = G.score;
      DM.storage.set(HI_KEY, G.score);
    }
    G.result = { score: G.score, best: Math.max(prev, G.score), newRecord: G.score > prev && G.score > 0, stage: G.stage };
  }

  function enterGameOver() {
    endRun();
    G.lockT = K.LOCK;
    setState('gameOver');
    sfx('gameOver');
  }
  function enterGameClear() {
    endRun();
    G.lockT = K.LOCK;
    setState('gameClear');
    sfx('gameClear');
  }
  function enterStageClear() {
    var P = G.player;
    var timeBonus = Math.floor(G.timeLeft) * 10;
    G.clearInfo = { clear: 500, time: timeBonus };
    G.score += 500 + timeBonus;
    G.clearT = K.CLEAR;
    P.joy = true;
    P.stepping = false;
    P.moving = false;
    G.input.buffer = null; G.input.bombReq = false;
    setState('stageClear');
    sfx('stageClear');
    for (var i = 0; i < 14; i++) addParticle('confetti', P.x * 32 + 16, P.y * 32 + 8, (DM.fxRand() - 0.5) * 120, -60 - DM.fxRand() * 90, 1.0 + DM.fxRand() * 0.6, Math.floor(DM.fxRand() * 5));
  }

  /* ------------------------------------------------------------------ fx (visual only) */
  function addParticle(kind, x, y, vx, vy, life, shade, size) {
    if (G.particles.length > 420) return;
    G.particles.push({ kind: kind, x: x, y: y, vx: vx, vy: vy, life: life, max: life, shade: shade || 0, size: size || 1 });
  }
  function addPopup(x, y, text, color) {
    G.popups.push({ x: x, y: y, text: text, t: 0, color: color || '#ffffff' });
  }
  function fxRockBreak(c, r) {
    var cx = c * 32 + 16, cy = r * 32 + 16;
    for (var i = 0; i < 11; i++) {
      var a = DM.fxRand() * Math.PI * 2, s = 40 + DM.fxRand() * 90;
      addParticle('rock', cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, Math.cos(a) * s, Math.sin(a) * s - 50, 0.45 + DM.fxRand() * 0.35, Math.floor(DM.fxRand() * 4), 2 + Math.floor(DM.fxRand() * 2));
    }
    for (var j = 0; j < 4; j++) addParticle('dust', cx + (DM.fxRand() - 0.5) * 16, cy + (DM.fxRand() - 0.5) * 16, (DM.fxRand() - 0.5) * 30, -10 - DM.fxRand() * 20, 0.5 + DM.fxRand() * 0.3, 0, 3);
  }
  function fxExplosion(c, r) {
    var cx = c * 32 + 16, cy = r * 32 + 16;
    for (var i = 0; i < 18; i++) {
      var a = DM.fxRand() * Math.PI * 2, s = 50 + DM.fxRand() * 150;
      addParticle('spark', cx, cy, Math.cos(a) * s, Math.sin(a) * s, 0.35 + DM.fxRand() * 0.4, Math.floor(DM.fxRand() * 3), 2);
    }
    if (!G.reducedMotion) { G.shakeT = 0.2; G.shakeAmp = 4; }
  }
  function fxDust(x, y) {
    addParticle('dust', x + (DM.fxRand() - 0.5) * 8, y, (DM.fxRand() - 0.5) * 22, -6 - DM.fxRand() * 10, 0.28 + DM.fxRand() * 0.15, 0, 2);
  }
  function fxPoof(x, y, kind) {
    for (var i = 0; i < 9; i++) {
      var a = DM.fxRand() * Math.PI * 2, s = 30 + DM.fxRand() * 70;
      addParticle('poof', x, y, Math.cos(a) * s, Math.sin(a) * s - 20, 0.35 + DM.fxRand() * 0.2, kind, 2 + Math.floor(DM.fxRand() * 2));
    }
  }
  function fxSparkle(x, y, n) {
    for (var i = 0; i < (n || 6); i++) {
      var a = DM.fxRand() * Math.PI * 2, s = 20 + DM.fxRand() * 50;
      addParticle('glint', x, y, Math.cos(a) * s, Math.sin(a) * s - 20, 0.4 + DM.fxRand() * 0.3, 0, 1);
    }
  }

  /* celebratory fireworks on the game-clear screen (visual only) */
  var fwTimer = 0;
  function fireworks(dt) {
    fwTimer -= dt;
    if (fwTimer > 0) return;
    fwTimer = 0.42 + DM.fxRand() * 0.35;
    var cx = DM.fxRand() < 0.5 ? 18 + DM.fxRand() * 96 : 366 + DM.fxRand() * 96, cy = 30 + DM.fxRand() * 220, col = Math.floor(DM.fxRand() * 5);
    for (var i = 0; i < 26; i++) {
      var a = (i / 26) * Math.PI * 2 + DM.fxRand() * 0.2, sp = 55 + DM.fxRand() * 35;
      addParticle('firework', cx, cy, Math.cos(a) * sp, Math.sin(a) * sp, 0.9 + DM.fxRand() * 0.4, col, 2);
    }
  }

  function updateFx(dt) {
    var i;
    if (G.shakeT > 0) G.shakeT = Math.max(0, G.shakeT - dt);
    if (G.flashT > 0) G.flashT = Math.max(0, G.flashT - dt);
    for (i = G.particles.length - 1; i >= 0; i--) {
      var p = G.particles[i];
      p.life -= dt;
      if (p.life <= 0) { G.particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'rock' || p.kind === 'confetti') p.vy += 260 * dt;
      else if (p.kind === 'dust' || p.kind === 'poof') { p.vx *= 0.92; p.vy *= 0.92; }
      else if (p.kind === 'spark') { p.vx *= 0.94; p.vy = p.vy * 0.94 + 30 * dt; }
      else if (p.kind === 'firework') { p.vx *= 0.95; p.vy = p.vy * 0.95 + 42 * dt; }
    }
    for (i = G.popups.length - 1; i >= 0; i--) {
      G.popups[i].t += dt;
      if (G.popups[i].t >= K.POPUP) G.popups.splice(i, 1);
    }
    for (i = G.crumbles.length - 1; i >= 0; i--) {
      G.crumbles[i].t += dt;
      if (G.crumbles[i].t >= K.CRUMBLE) G.crumbles.splice(i, 1);
    }
    for (i = 0; i < G.items.length; i++) G.items[i].t += dt;
    if (G.exit.open) G.exit.openT += dt;
  }

  /* ------------------------------------------------------------------ input entry points */
  var input = G.input;

  G.dirDown = function (d) {
    var i = input.held.indexOf(d);
    if (i >= 0) input.held.splice(i, 1);
    input.held.push(d);
    if (G.state === 'playing') input.buffer = d;
  };
  G.dirUp = function (d) {
    var i = input.held.indexOf(d);
    if (i >= 0) input.held.splice(i, 1);
  };
  G.clearInput = function () { input.held.length = 0; input.buffer = null; input.bombReq = false; };

  function canConfirm() { return (G.state === 'gameOver' || G.state === 'gameClear') && G.lockT <= 0; }

  G.pressBomb = function (viaSpace) {
    if (G.state === 'playing') input.bombReq = true;
    else if (viaSpace && (G.state === 'title' || canConfirm())) G.startNewGame();
  };
  G.pressConfirm = function () {
    if (G.state === 'title' || canConfirm()) G.startNewGame();
  };
  G.pressPause = function () {
    if (G.state === 'playing') { setState('paused'); sfx('pause'); }
    else if (G.state === 'paused') { setState('playing'); sfx('pause'); }
  };
  G.pressEscape = function () {
    if (G.state === 'playing' || G.state === 'paused') G.pressPause();
    else if (canConfirm()) G.goTitle();
  };
  /* back to the title: a fresh, not-yet-started run on the start stage */
  G.goTitle = function () {
    endRun();
    if (G.seedFixed != null) G.seed = G.seedFixed; else G.seed = randomSeed();
    G.score = 0;
    G.lives = 3;
    G.player = newPlayer();
    loadStage(G.startStage);
    setState('title');
  };
  G.pressRestart = function () {
    var s = G.state;
    if (s === 'stageIntro' || s === 'playing' || s === 'paused' || s === 'stageClear' || canConfirm()) G.startNewGame();
  };
  G.startNewGame = function () {
    endRun();
    beginRun();
  };
  G.autoPause = function () {
    if (G.state === 'playing') setState('paused');
  };

  /* ------------------------------------------------------------------ player */
  function killPlayer(byTime) {
    var P = G.player;
    if (!P.alive) return;
    P.alive = false;
    P.deathT = K.DEATH_ANIM;
    P.deathAge = 0;
    P.deathTimeUp = !!byTime;
    G.lives = Math.max(0, G.lives - 1);
    P.maxBombs = Math.max(1, P.maxBombs - 1);
    P.range = Math.max(2, P.range - 1);
    P.boots = Math.max(0, P.boots - 1);
    P.x = Math.round(P.x); P.y = Math.round(P.y);
    P.stepping = false; P.prog = 0; P.moving = false;
    input.buffer = null; input.bombReq = false;
    sfx('playerDie');
    fxPoof(P.x * 32 + 16, P.y * 32 + 16, 5);
  }

  function respawn() {
    var P = G.player;
    P.x = 1; P.y = 1; P.facing = 'down';
    P.stepping = false; P.prog = 0; P.moving = false;
    P.alive = true;
    P.invT = K.INV_RESPAWN;
    input.buffer = null; input.bombReq = false;
    if (P.deathTimeUp) G.timeLeft = K.TIMEUP_RESET;
    P.deathTimeUp = false;
  }

  function chooseDir() {
    if (input.buffer) { var b = input.buffer; input.buffer = null; return b; }
    if (input.held.length) return input.held[input.held.length - 1];
    return null;
  }

  function updatePlayerMove(dt) {
    var P = G.player;
    var t = dt, guard = 0;
    while (t > 1e-9 && guard++ < 8) {
      if (!P.stepping) {
        var d = chooseDir();
        if (!d) break;
        P.facing = d;
        var v = DIRS[d];
        var tc = Math.round(P.x) + v.dx, tr = Math.round(P.y) + v.dy;
        if (!canEnter(tc, tr)) break;
        P.stepping = true;
        P.fromX = Math.round(P.x); P.fromY = Math.round(P.y);
        P.toX = tc; P.toY = tr;
        P.prog = 0;
        P.stepDir = d;
        fxDust(P.x * 32 + 16, P.y * 32 + 28);
      }
      var sp = playerSpeed();
      var need = (1 - P.prog) / sp;
      if (t >= need) {
        t -= need;
        P.walkDist += 1 - P.prog;
        P.prog = 1;
        P.x = P.toX; P.y = P.toY;
        P.stepping = false;
      } else {
        var adv = t * sp;
        P.prog += adv;
        P.walkDist += adv;
        t = 0;
        P.x = P.fromX + (P.toX - P.fromX) * P.prog;
        P.y = P.fromY + (P.toY - P.fromY) * P.prog;
      }
    }
    P.moving = P.stepping;
  }

  function tryPlaceBomb() {
    var P = G.player;
    if (!P.alive) return;
    if (activeBombs() >= P.maxBombs) return;
    var c = pcol(), r = prow();
    if (bombAt(c, r)) return;
    if (tileAt(c, r) === '#' || tileAt(c, r) === 'S') return;
    G.bombs.push({ col: c, row: r, timeLeft: K.FUSE, range: P.range, age: 0, dead: false });
    sfx('place');
  }

  function updatePlayer(dt) {
    var P = G.player;
    if (!P.alive) {
      input.buffer = null; input.bombReq = false;
      P.deathAge += dt;
      P.deathT -= dt;
      if (P.deathT <= 0) {
        if (G.lives >= 1) respawn();
        else enterGameOver();
      }
      return;
    }
    if (P.invT > 0) P.invT = Math.max(0, P.invT - dt);
    updatePlayerMove(dt);
    if (input.bombReq) { input.bombReq = false; tryPlaceBomb(); }
  }

  /* ------------------------------------------------------------------ bombs / flames / rocks */
  function destroyRock(c, r, o) {
    o = o || {};
    G.grid[r][c] = '.';
    if (!o.noScore) G.score += 10;
    var key = c + ',' + r;
    if (G.hidden[key]) {
      G.items.push({ type: G.hidden[key], col: c, row: r, t: 0 });
      delete G.hidden[key];
    }
    if (G.exit.col === c && G.exit.row === r) {
      G.exit.revealed = true;
      fxSparkle(c * 32 + 16, r * 32 + 16, 8);
    }
    G.crumbles.push({ col: c, row: r, t: 0 });
    fxRockBreak(c, r);
    if (!o.silent && !G.breakSfxThisTick) { G.breakSfxThisTick = true; sfx('break'); }
  }

  function addFlame(c, r, kind, dir) {
    G.flames.push({ col: c, row: r, timeLeft: K.FLAME_LIFE, kind: kind, dir: dir, age: 0 });
  }

  function explodeBomb(b) {
    b.dead = true;
    sfx('explode');
    var c = b.col, r = b.row;
    addFlame(c, r, 'center', null);
    fxExplosion(c, r);
    for (var k = 0; k < 4; k++) {
      var d = DIR_LIST[k], v = DIRS[d];
      for (var i = 1; i <= b.range; i++) {
        var cc = c + v.dx * i, rr = r + v.dy * i;
        var t = tileAt(cc, rr);
        if (t === '#') break;
        if (t === 'S') {
          destroyRock(cc, rr);
          addFlame(cc, rr, 'tip', d);
          break;
        }
        addFlame(cc, rr, i === b.range ? 'tip' : 'arm', d);
        var ob = bombAt(cc, rr);
        if (ob) ob.timeLeft = 0;
      }
    }
  }

  function updateBombs(dt) {
    var i, b;
    for (i = 0; i < G.bombs.length; i++) {
      b = G.bombs[i]; b.timeLeft -= dt; b.age += dt;
      /* sparks flying off the burning fuse (visual only) */
      if (DM.fxRand() < 0.3) addParticle('spark', b.col * 32 + 18, b.row * 32 + 6, (DM.fxRand() - 0.5) * 34, -14 - DM.fxRand() * 34, 0.18 + DM.fxRand() * 0.2, 0, 1);
    }
    var guard = 0, found = true;
    while (found && guard++ < 64) {
      found = false;
      for (i = 0; i < G.bombs.length; i++) {
        b = G.bombs[i];
        if (!b.dead && b.timeLeft <= 0) { explodeBomb(b); found = true; break; }
      }
    }
    G.bombs = G.bombs.filter(function (x) { return !x.dead; });
  }

  function decayFlames(dt) {
    for (var i = G.flames.length - 1; i >= 0; i--) {
      var f = G.flames[i];
      f.timeLeft -= dt;
      f.age += dt;
      if (f.timeLeft <= 0) G.flames.splice(i, 1);
    }
  }

  /* ------------------------------------------------------------------ enemies */
  function enemyOptions(e) {
    var c = Math.round(e.x), r = Math.round(e.y), out = [];
    for (var i = 0; i < 4; i++) {
      var d = DIR_LIST[i], v = DIRS[d];
      if (canEnter(c + v.dx, r + v.dy)) out.push(d);
    }
    return out;
  }
  function wander(e, opts) {
    var h = e.heading;
    if (h && opts.indexOf(h) >= 0 && G.rng() >= 0.2) return h;
    var cand = opts.filter(function (d) { return d !== OPP[h]; });
    if (cand.length) return cand[Math.floor(G.rng() * cand.length)];
    if (h && opts.indexOf(OPP[h]) >= 0) return OPP[h];
    return null;
  }
  function chooseEnemyDir(e) {
    var opts = enemyOptions(e);
    if (!opts.length) return null;
    var h = e.heading;
    if (e.type === 'bat') {
      var cand = opts.filter(function (d) { return d !== OPP[h]; });
      if (cand.length) return cand[Math.floor(G.rng() * cand.length)];
      if (h && opts.indexOf(OPP[h]) >= 0) return OPP[h];
      return null;
    }
    if (e.type === 'ghost') {
      var P = G.player;
      var ec = Math.round(e.x), er = Math.round(e.y);
      var dist = Math.abs(ec - pcol()) + Math.abs(er - prow());
      if (P.alive && dist <= 6) {
        e.chasing = true;
        if (G.rng() < 0.25) return wander(e, opts);
        var c2 = opts.filter(function (d) { return d !== OPP[h]; });
        if (!c2.length) c2 = opts;
        var best = 99, bl = [];
        c2.forEach(function (d) {
          var v = DIRS[d];
          var nd = Math.abs(ec + v.dx - pcol()) + Math.abs(er + v.dy - prow());
          if (nd < best) { best = nd; bl = [d]; } else if (nd === best) bl.push(d);
        });
        return bl[Math.floor(G.rng() * bl.length)];
      }
      e.chasing = false;
      return wander(e, opts);
    }
    return wander(e, opts);
  }

  function updateEnemyMove(e, dt) {
    var t = dt, guard = 0;
    while (t > 1e-9 && guard++ < 8) {
      if (e.wait > 0) {
        var w = Math.min(e.wait, t);
        e.wait -= w; t -= w;
        if (e.wait > 1e-9) break;
        e.wait = 0;
        continue;
      }
      if (!e.stepping) {
        var d = chooseEnemyDir(e);
        if (!d) { e.wait = K.ENEMY_WAIT; continue; }
        e.heading = d;
        if (d === 'left' || d === 'right') e.face = d; else e.face = d;
        var v = DIRS[d];
        e.stepping = true;
        e.fromX = Math.round(e.x); e.fromY = Math.round(e.y);
        e.toX = e.fromX + v.dx; e.toY = e.fromY + v.dy;
        e.prog = 0;
      }
      var need = (1 - e.prog) / e.speed;
      if (t >= need) {
        t -= need;
        e.walkDist += 1 - e.prog;
        e.prog = 1;
        e.x = e.toX; e.y = e.toY;
        e.stepping = false;
      } else {
        var adv = t * e.speed;
        e.prog += adv;
        e.walkDist += adv;
        t = 0;
        e.x = e.fromX + (e.toX - e.fromX) * e.prog;
        e.y = e.fromY + (e.toY - e.fromY) * e.prog;
      }
    }
  }

  function updateEnemies(dt) {
    for (var i = G.enemies.length - 1; i >= 0; i--) {
      var e = G.enemies[i];
      if (!e.alive) {
        e.deathT -= dt;
        if (e.deathT <= 0) G.enemies.splice(i, 1);
        continue;
      }
      if (e.hitT > 0) e.hitT = Math.max(0, e.hitT - dt);
      updateEnemyMove(e, dt);
    }
  }
  function updateDyingEnemies(dt) {
    for (var i = G.enemies.length - 1; i >= 0; i--) {
      var e = G.enemies[i];
      if (!e.alive) {
        e.deathT -= dt;
        if (e.deathT <= 0) G.enemies.splice(i, 1);
      }
    }
  }

  function killEnemy(e) {
    var def = ENEMY_DEF[e.type];
    e.alive = false;
    e.hp = 0;
    e.deathT = K.ENEMY_DEATH;
    e.stepping = false;
    G.score += def.score;
    addPopup(e.x * 32 + 16, e.y * 32 + 4, '+' + def.score, '#ffe36e');
    fxPoof(e.x * 32 + 16, e.y * 32 + 16, e.type === 'slime' ? 0 : e.type === 'bat' ? 1 : e.type === 'ghost' ? 2 : 3);
    sfx('enemyDie');
  }
  function damageEnemy(e) {
    if (e.hitT > 0) return;
    e.hp -= 1;
    if (e.hp <= 0) killEnemy(e);
    else {
      e.hitT = K.HIT_INV;
      sfx('hit');
      fxSparkle(e.x * 32 + 16, e.y * 32 + 16, 6);
    }
  }

  function flameDamage() {
    if (!G.flames.length) return;
    var i;
    for (i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      if (e.alive && flameAt(Math.round(e.x), Math.round(e.y))) damageEnemy(e);
    }
    var P = G.player;
    if (P.alive && P.invT <= 0 && !G.god && flameAt(pcol(), prow())) killPlayer(false);
  }

  function contactCheck() {
    var P = G.player;
    if (!P.alive || P.invT > 0 || G.god) return;
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      if (!e.alive) continue;
      var dx = e.x - P.x, dy = e.y - P.y;
      if (Math.sqrt(dx * dx + dy * dy) < K.CONTACT) { killPlayer(false); return; }
    }
  }

  function pickupItems() {
    var P = G.player;
    if (!P.alive) return;
    var c = pcol(), r = prow();
    for (var i = 0; i < G.items.length; i++) {
      var it = G.items[i];
      if (it.col !== c || it.row !== r) continue;
      G.items.splice(i, 1);
      if (it.type === 'fire') P.range = Math.min(6, P.range + 1);
      else if (it.type === 'bomb') P.maxBombs = Math.min(5, P.maxBombs + 1);
      else if (it.type === 'boots') P.boots = Math.min(3, P.boots + 1);
      else if (it.type === 'life') G.lives = Math.min(5, G.lives + 1);
      G.score += 50;
      sfx(it.type === 'life' ? 'life' : 'item');
      addPopup(c * 32 + 16, r * 32 + 2, '+50', '#8dffb0');
      fxSparkle(c * 32 + 16, r * 32 + 16, 10);
      break;
    }
  }

  function updateExitOpen() {
    if (!G.exit.open && aliveEnemies() === 0) {
      G.exit.open = true;
      G.exit.openT = 0;
      sfx('exitOpen');
      if (!G.reducedMotion) { G.flashT = 0.35; G.flashColor = '#fff6c0'; }
      fxSparkle(G.exit.col * 32 + 16, G.exit.row * 32 + 16, 12);
    }
  }

  function exitCheck() {
    updateExitOpen();
    var P = G.player;
    if (G.exit.open && P.alive && pcol() === G.exit.col && prow() === G.exit.row) enterStageClear();
  }

  /* ------------------------------------------------------------------ main tick (spec 3.13) */
  function tickPlaying(dt) {
    var P = G.player;
    /* 1. timer */
    if (P.alive) {
      G.timeLeft -= dt;
      if (G.timeLeft <= 0) {
        G.timeLeft = 0;
        if (!G.god) killPlayer(true);
      }
      /* 'warn' tick: immediately when the last 10 s begin, then exactly once per second */
      if (G.timeLeft > 0 && G.timeLeft <= 10) {
        if (G.warnAcc == null) G.warnAcc = 0;
        G.warnAcc -= dt;
        if (G.warnAcc <= 0) { G.warnAcc += 1; sfx('warn'); }
      } else if (G.timeLeft > 10) {
        G.warnAcc = null;
      }
    }
    if (DM.Audio) DM.Audio.setTempoUp(G.timeLeft > 0 && G.timeLeft <= 30);
    /* 2. player */
    updatePlayer(dt);
    if (G.state !== 'playing') return;
    /* 3. bombs */
    G.breakSfxThisTick = false;
    updateBombs(dt);
    /* 4. enemies */
    updateEnemies(dt);
    /* 5. flames */
    decayFlames(dt);
    /* 6. flame damage */
    flameDamage();
    /* 7. contact */
    contactCheck();
    /* 8. items */
    pickupItems();
    /* 9. exit */
    exitCheck();
  }

  function beginPlaying() {
    input.buffer = null; input.bombReq = false;
    G.fresh = false;
    setState('playing');
  }

  G.update = function (dt) {
    G.animT += dt;
    switch (G.state) {
      case 'stageIntro':
        G.introT -= dt;
        decayFlames(dt);
        if (G.introT <= 0) beginPlaying();
        break;
      case 'playing':
        tickPlaying(dt);
        break;
      case 'stageClear':
        decayFlames(dt);
        updateDyingEnemies(dt);
        G.clearT -= dt;
        if (G.clearT <= 0) {
          if (G.stage < 5) {
            loadStage(G.stage + 1);
            G.introT = K.INTRO;
            setState('stageIntro');
          } else {
            enterGameClear();
          }
        }
        break;
      case 'gameOver':
      case 'gameClear':
        decayFlames(dt);
        updateDyingEnemies(dt);
        G.lockT = Math.max(0, G.lockT - dt);
        if (G.state === 'gameClear') fireworks(dt);
        break;
      default: break;
    }
    updateFx(dt);
  };

  /* ------------------------------------------------------------------ init / snapshot */
  G.init = function (params) {
    G.debugEnabled = !!params.debug;
    G.seedFixed = params.seed;
    G.startStage = params.stage;
    G.hiSaved = readHi();
    G.seed = params.seed != null ? params.seed : randomSeed();
    G.rng = DM.mulberry32((G.seed ^ 0xC0FFEE) >>> 0);
    G.player = newPlayer();
    G.score = 0; G.lives = 3;
    try { G.reducedMotion = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { G.reducedMotion = false; }
    loadStage(G.startStage);
    G.state = 'title';
    if (DM.Audio) DM.Audio.setBgm('title');
  };

  G.snapshot = function () {
    var P = G.player;
    return {
      state: G.state,
      seed: G.seed,
      stage: G.stage,
      score: G.score,
      hiScore: Math.max(G.hiSaved, G.score),
      lives: G.lives,
      timeLeft: G.timeLeft,
      player: {
        col: pcol(), row: prow(), x: P.x, y: P.y, facing: P.facing, alive: P.alive,
        invincible: P.invT > 0 ? P.invT : 0,
        maxBombs: P.maxBombs, activeBombs: activeBombs(), range: P.range, boots: P.boots, speed: playerSpeed()
      },
      bombs: G.bombs.map(function (b) { return { col: b.col, row: b.row, timeLeft: b.timeLeft, range: b.range }; }),
      flames: G.flames.map(function (f) { return { col: f.col, row: f.row, timeLeft: f.timeLeft }; }),
      enemies: G.enemies.map(function (e) {
        return { type: e.type, col: Math.round(e.x), row: Math.round(e.y), x: e.x, y: e.y, hp: e.hp, alive: e.alive };
      }),
      items: G.items.map(function (i) { return { type: i.type, col: i.col, row: i.row }; }),
      exit: { col: G.exit.col, row: G.exit.row, revealed: G.exit.revealed, open: G.exit.open },
      grid: G.grid.map(function (r) { return r.join(''); }),
      texts: DM.Font.texts.slice(),
      audio: DM.Audio ? DM.Audio.info() : { unlocked: false, muted: false, bgm: null, sfxLog: [] }
    };
  };

  /* ------------------------------------------------------------------ debug API (only exposed with ?debug=1) */
  G.debug = {
    killAllEnemies: function () {
      G.enemies.forEach(function (e) { if (e.alive) killEnemy(e); });
      updateExitOpen();
    },
    revealExit: function () {
      var ex = G.exit;
      if (G.grid[ex.row][ex.col] === 'S') destroyRock(ex.col, ex.row, { noScore: true, silent: true });
      ex.revealed = true;
    },
    clearBlocks: function () {
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        if (G.grid[r][c] === 'S') destroyRock(c, r, { noScore: true, silent: true });
      }
    },
    teleport: function (col, row) {
      col = Math.round(col); row = Math.round(row);
      if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return;
      if (G.grid[row][col] === '#') return;
      if (G.grid[row][col] === 'S') destroyRock(col, row, { noScore: true, silent: true });
      var P = G.player;
      P.x = col; P.y = row; P.stepping = false; P.prog = 0; P.moving = false;
      P.fromX = col; P.fromY = row; P.toX = col; P.toY = row;
      input.buffer = null;
    },
    setLives: function (n) { G.lives = DM.clamp(Math.round(n), 1, 5); },
    setTimeLeft: function (sec) { G.timeLeft = Math.max(0, +sec || 0); G.warnAcc = null; },
    setPowerups: function (o) {
      o = o || {};
      var P = G.player;
      if (o.maxBombs != null) P.maxBombs = DM.clamp(Math.round(o.maxBombs), 1, 5);
      if (o.range != null) P.range = DM.clamp(Math.round(o.range), 2, 6);
      if (o.boots != null) P.boots = DM.clamp(Math.round(o.boots), 0, 3);
    },
    spawnItem: function (type, col, row) {
      if (['fire', 'bomb', 'boots', 'life'].indexOf(type) < 0) return;
      if (tileAt(col, row) !== '.') return;
      for (var i = 0; i < G.items.length; i++) if (G.items[i].col === col && G.items[i].row === row) return;
      G.items.push({ type: type, col: col, row: row, t: 0 });
    },
    spawnEnemy: function (type, col, row) {
      if (!ENEMY_DEF[type]) return;
      if (tileAt(col, row) !== '.') return;
      G.enemies.push(makeEnemy(type, col, row));
    },
    godMode: function (on) { G.god = !!on; }
  };

  DM.GameInternals = { DIRS: DIRS, DIR_LIST: DIR_LIST, OPP: OPP, flameAt: flameAt, bombAt: bombAt, playerSpeed: playerSpeed, activeBombs: activeBombs };
})(typeof window !== 'undefined' ? window : globalThis);
