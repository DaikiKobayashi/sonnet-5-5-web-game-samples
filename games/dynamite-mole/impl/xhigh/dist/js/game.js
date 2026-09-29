/* game.js - game state machine and all rules (SPEC section 3). No drawing here. */
(function () {
  'use strict';
  var DM = window.DM;
  var A = DM.audio;

  var DT = 1 / 60;
  var DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  var DIRS = ['up', 'down', 'left', 'right'];
  var KEY_HI = 'dynamiteMole.hiScore';
  var KEY_MUTE = 'dynamiteMole.muted';
  var EPS = 1e-9;

  var G = (DM.game = {
    state: 'title',
    stateT: 0,
    t: 0,
    seed: 0,
    fixedSeed: null,
    startStage: 1,
    stage: 1,
    score: 0,
    lives: 3,
    hiSaved: 0,
    newRecord: false,
    runFinished: true,
    rng: null,
    timeLeft: 150,
    L: null,
    player: null,
    held: [],
    pending: null,
    bombQueued: false,
    god: false,
    particles: [],
    popups: [],
    shakeT: 0,
    reduceMotion: false,
    clearBonus: 0,
    timeBonus: 0,
    levelId: 0,
    lastWarnSec: 99,
    tickBroke: false,
    fuseAcc: 0,
    debugEnabled: false
  });

  /* ------------------------------------------------------------ helpers */
  function randomSeed() {
    return Math.floor(Math.random() * 4294967296) >>> 0; /* the only Math.random in the game (run seed) */
  }
  function vr() {
    return DM.vfxRng();
  }
  function tileOf(v) {
    return Math.round(v);
  }
  function inBounds(c, r) {
    return c >= 0 && r >= 0 && c < DM.COLS && r < DM.ROWS;
  }
  function bombAt(c, r) {
    var b = G.L.bombs;
    for (var i = 0; i < b.length; i++) if (b[i].col === c && b[i].row === r) return b[i];
    return null;
  }
  function aliveEnemies() {
    var n = 0, e = G.L.enemies;
    for (var i = 0; i < e.length; i++) if (e[i].alive) n++;
    return n;
  }
  function stageDef() {
    return DM.STAGES[G.stage - 1];
  }

  /* ------------------------------------------------------------ storage */
  function loadHi() {
    var v = parseInt(DM.store.get(KEY_HI), 10);
    return isFinite(v) && v > 0 ? v : 0;
  }

  /* ------------------------------------------------------------ init */
  G.init = function (opts) {
    opts = opts || {};
    G.fixedSeed = opts.seed === undefined || opts.seed === null ? null : opts.seed >>> 0;
    G.startStage = opts.stage >= 1 && opts.stage <= 5 ? opts.stage : 1;
    G.debugEnabled = !!opts.debug;
    G.reduceMotion = !!opts.reduceMotion;
    G.hiSaved = loadHi();
    var muted = DM.store.get(KEY_MUTE) === '1';
    if (opts.mute) muted = true;
    A.setMuted(muted);
    G.resetRunState();
    G.seed = G.fixedSeed !== null ? G.fixedSeed : randomSeed();
    G.stage = G.startStage;
    loadStage(G.startStage);
    enterTitle();
  };

  G.resetRunState = function () {
    G.score = 0;
    G.lives = 3;
    G.god = false;
    G.newRecord = false;
    G.particles.length = 0;
    G.popups.length = 0;
  };

  /* ------------------------------------------------------------ stage loading */
  function newPlayer(prev) {
    return {
      x: 1,
      y: 1,
      facing: 'down',
      alive: true,
      invincible: 0,
      maxBombs: prev ? prev.maxBombs : 1,
      range: prev ? prev.range : 2,
      boots: prev ? prev.boots : 0,
      moving: false,
      sx: 1,
      sy: 1,
      dx: 0,
      dy: 0,
      prog: 0,
      deathT: 0,
      deathAge: 0,
      timeUpDeath: false,
      walkPhase: 0,
      idleT: 0,
      joy: false
    };
  }

  function loadStage(s) {
    G.stage = s;
    var def = DM.STAGES[s - 1];
    var gen = DM.generateLevel(G.seed, s);
    G.levelId++;
    G.L = {
      id: G.levelId,
      stage: s,
      def: def,
      themeIdx: s - 1,
      grid: gen.grid,
      hidden: gen.hidden,
      exit: { col: gen.exit.col, row: gen.exit.row, revealed: false, open: false, flash: 0, openT: 0 },
      items: [],
      bombs: [],
      flames: [],
      enemies: [],
      crumbles: []
    };
    G.player = newPlayer(G.player);
    G.timeLeft = def.time;
    G.lastWarnSec = 99;
    G.pending = null;
    G.bombQueued = false;
    G.particles.length = 0;
    G.popups.length = 0;
    G.shakeT = 0;
    G.fuseAcc = 0;
    gen.spawns.forEach(function (sp) {
      makeEnemy(sp.type, sp.col, sp.row);
    });
  }

  function makeEnemy(type, col, row) {
    var d = DM.ENEMY_DEF[type];
    var e = {
      type: type,
      x: col,
      y: row,
      hp: d.hp,
      alive: true,
      dx: 0,
      dy: 0,
      moving: false,
      sx: col,
      sy: row,
      prog: 0,
      wait: 0,
      invuln: 0,
      deathT: 0,
      deathAge: 0,
      speed: d.speed * stageDef().mult,
      face: 1,
      chase: false,
      phase: G.L.enemies.length * 0.37
    };
    G.L.enemies.push(e);
    return e;
  }

  /* ------------------------------------------------------------ state transitions */
  function bgmFor(state) {
    if (state === 'title') return 'title';
    if (state === 'playing' || state === 'paused') return 'stage' + G.stage;
    return null;
  }
  function setState(s) {
    G.state = s;
    G.stateT = 0;
    A.setBgm(bgmFor(s));
    A.setPaused(s === 'paused');
    if (s !== 'playing') A.setTempo(1);
  }

  function enterTitle() {
    G.resetRunState();
    G.player = newPlayer(null);
    G.seed = G.fixedSeed !== null ? G.fixedSeed : randomSeed();
    loadStage(G.startStage);
    setState('title');
  }

  function startRun() {
    G.resetRunState();
    G.runFinished = false;
    G.seed = G.fixedSeed !== null ? G.fixedSeed : randomSeed();
    G.rng = DM.mulberry32((G.seed ^ 0xc0ffee) >>> 0);
    G.player = newPlayer(null);
    loadStage(G.startStage);
    A.sfx('start');
    setState('stageIntro');
  }

  /* run ended (gameOver / gameClear / abandoned with R): save the hi-score once */
  function finishRun() {
    if (G.runFinished) return;
    G.runFinished = true;
    var prev = G.hiSaved;
    if (G.score > prev) {
      DM.store.set(KEY_HI, G.score);
      G.hiSaved = G.score;
    }
    G.newRecord = G.score > prev && G.score > 0;
  }

  function enterGameOver() {
    finishRun();
    A.sfx('gameOver');
    setState('gameOver');
  }
  function enterGameClear() {
    finishRun();
    A.sfx('gameClear');
    setState('gameClear');
  }
  function enterStageClear() {
    var p = G.player;
    G.clearBonus = 500;
    G.timeBonus = Math.floor(G.timeLeft) * 10;
    G.score += G.clearBonus + G.timeBonus;
    p.joy = true;
    p.moving = false;
    A.sfx('stageClear');
    setState('stageClear');
  }
  function nextStage() {
    if (G.stage >= 5) {
      enterGameClear();
      return;
    }
    loadStage(G.stage + 1);
    setState('stageIntro');
  }

  G.pause = function () {
    if (G.state !== 'playing') return;
    setState('paused');
    A.sfx('pause');
  };
  G.resume = function () {
    if (G.state !== 'paused') return;
    setState('playing');
    G.pending = null;
    A.sfx('pause');
  };
  function restartRun() {
    finishRun();
    startRun();
  }

  G.toggleMute = function () {
    A.setMuted(!A.muted);
    DM.store.set(KEY_MUTE, A.muted ? '1' : '0');
  };

  /* ------------------------------------------------------------ input */
  G.keyDown = function (code, repeat) {
    if (code === 'KeyM') {
      if (!repeat) G.toggleMute();
      return;
    }
    var dir = code === 'ArrowUp' || code === 'KeyW' ? 'up' : code === 'ArrowDown' || code === 'KeyS' ? 'down' : code === 'ArrowLeft' || code === 'KeyA' ? 'left' : code === 'ArrowRight' || code === 'KeyD' ? 'right' : null;
    if (dir) {
      if (repeat) return;
      var i = G.held.indexOf(dir);
      if (i >= 0) G.held.splice(i, 1);
      G.held.push(dir);
      if (G.state === 'playing') G.pending = dir;
      return;
    }
    if (repeat) return;
    var s = G.state;
    var isBomb = code === 'Space' || code === 'KeyZ';
    var isPause = code === 'KeyP' || code === 'Escape';
    if (s === 'title') {
      if (code === 'Enter' || code === 'Space') startRun();
    } else if (s === 'stageIntro') {
      if (code === 'KeyR') restartRun();
    } else if (s === 'playing') {
      if (isPause) G.pause();
      else if (code === 'KeyR') restartRun();
      else if (isBomb) G.bombQueued = true;
    } else if (s === 'paused') {
      if (isPause) G.resume();
      else if (code === 'KeyR') restartRun();
    } else if (s === 'stageClear') {
      if (code === 'KeyR') restartRun();
    } else if (s === 'gameOver' || s === 'gameClear') {
      if (G.stateT < 0.6) return;
      if (code === 'Enter' || code === 'Space' || code === 'KeyR') startRun();
      else if (code === 'Escape') enterTitle();
    }
  };
  G.keyUp = function (code) {
    var dir = code === 'ArrowUp' || code === 'KeyW' ? 'up' : code === 'ArrowDown' || code === 'KeyS' ? 'down' : code === 'ArrowLeft' || code === 'KeyA' ? 'left' : code === 'ArrowRight' || code === 'KeyD' ? 'right' : null;
    if (dir) {
      var i = G.held.indexOf(dir);
      if (i >= 0) G.held.splice(i, 1);
    }
  };
  G.releaseAllKeys = function () {
    G.held.length = 0;
  };
  /* tap on canvas (touch): acts like Enter on title / gameOver / gameClear */
  G.tapConfirm = function () {
    var s = G.state;
    if (s === 'title') startRun();
    else if ((s === 'gameOver' || s === 'gameClear') && G.stateT >= 0.6) startRun();
  };

  /* ------------------------------------------------------------ vfx */
  function addParticle(p) {
    if (G.particles.length > 600) return;
    G.particles.push(p);
  }
  function popup(text, col, row, color) {
    G.popups.push({ text: text, x: (col + 0.5) * 32, y: 64 + row * 32 + 4, t: 0, color: color || '#ffe45a' });
  }
  function dust(x, y) {
    var th = DM.THEMES[G.L.themeIdx];
    for (var i = 0; i < 3; i++)
      addParticle({
        kind: 'dust',
        x: (x + 0.5) * 32 + (vr() - 0.5) * 8,
        y: 64 + (y + 0.5) * 32 + 12 + vr() * 3,
        vx: (vr() - 0.5) * 14,
        vy: -6 - vr() * 8,
        life: 0.32 + vr() * 0.12,
        max: 0.4,
        size: 2 + Math.floor(vr() * 2),
        color: th.fl[2]
      });
  }
  function debris(col, row) {
    var th = DM.THEMES[G.L.themeIdx];
    var cols = [th.rk[0], th.rk[1], th.rk[2], th.rk[3]];
    for (var i = 0; i < 9; i++) {
      var a = vr() * Math.PI * 2;
      var sp = 40 + vr() * 70;
      addParticle({
        kind: 'chip',
        x: (col + 0.5) * 32,
        y: 64 + (row + 0.5) * 32,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 50,
        life: 0.45 + vr() * 0.3,
        max: 0.75,
        size: 2 + Math.floor(vr() * 2),
        color: cols[i % 4],
        grav: 260
      });
    }
  }
  function sparks(col, row, n) {
    var cols = ['#fff3a0', '#ffb02c', '#ff7a1c', '#ffffff'];
    for (var i = 0; i < n; i++) {
      var a = vr() * Math.PI * 2;
      var sp = 30 + vr() * 90;
      addParticle({
        kind: 'spark',
        x: (col + 0.5) * 32 + (vr() - 0.5) * 12,
        y: 64 + (row + 0.5) * 32 + (vr() - 0.5) * 12,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 20,
        life: 0.3 + vr() * 0.4,
        max: 0.7,
        size: 1 + Math.floor(vr() * 2),
        color: cols[i % 4],
        grav: 80
      });
    }
  }
  function shake() {
    if (!G.reduceMotion) G.shakeT = 0.2;
  }

  /* ------------------------------------------------------------ rocks, flames, bombs */
  function addItem(type, col, row) {
    G.L.items.push({ type: type, col: col, row: row, t: 0 });
  }

  function breakSoft(c, r, o) {
    var L = G.L;
    if (L.grid[r][c] !== DM.SOFT) return;
    o = o || {};
    L.grid[r][c] = DM.EMPTY;
    if (o.score !== false) G.score += 10;
    if (o.fx !== false) {
      L.crumbles.push({ col: c, row: r, t: 0 });
      debris(c, r);
      G.tickBroke = true;
    }
    var key = c + ',' + r;
    if (L.hidden[key]) {
      addItem(L.hidden[key], c, r);
      delete L.hidden[key];
    }
    if (L.exit.col === c && L.exit.row === r) L.exit.revealed = true;
  }

  function axisOf(k) {
    return k === 'h' || k === 'l' || k === 'r' ? 'x' : k === 'v' || k === 'u' || k === 'd' ? 'y' : 'c';
  }
  function mergeKind(a, b) {
    if (a === b) return a;
    if (a === 'c' || b === 'c') return 'c';
    if (axisOf(a) === axisOf(b)) return axisOf(a) === 'x' ? 'h' : 'v';
    return 'c';
  }
  function addFlame(c, r, kind) {
    var f = G.L.flames;
    for (var i = 0; i < f.length; i++) {
      if (f[i].col === c && f[i].row === r) {
        f[i].timeLeft = 0.5;
        f[i].kind = mergeKind(f[i].kind, kind);
        return;
      }
    }
    f.push({ col: c, row: r, timeLeft: 0.5, kind: kind, age: 0 });
    if (vr() < 0.6) sparks(c, r, 2);
  }

  var TIP = { up: 'u', down: 'd', left: 'l', right: 'r' };
  var ARM = { up: 'v', down: 'v', left: 'h', right: 'h' };

  function explode(b, queue) {
    var L = G.L;
    A.sfx('explode');
    shake();
    addFlame(b.col, b.row, 'c');
    sparks(b.col, b.row, 10);
    DIRS.forEach(function (dn) {
      var d = DIR[dn];
      var tiles = [];
      for (var i = 1; i <= b.range; i++) {
        var c = b.col + d[0] * i, r = b.row + d[1] * i;
        if (!inBounds(c, r) || L.grid[r][c] === DM.WALL) break;
        if (L.grid[r][c] === DM.SOFT) {
          breakSoft(c, r);
          tiles.push([c, r]);
          break;
        }
        tiles.push([c, r]);
        var ob = bombAt(c, r);
        if (ob && !ob.done && ob !== b) {
          ob.timeLeft = 0;
          queue.push(ob);
        }
      }
      tiles.forEach(function (t, idx) {
        addFlame(t[0], t[1], idx === tiles.length - 1 ? TIP[dn] : ARM[dn]);
      });
    });
  }

  function updateBombs(dt) {
    var L = G.L;
    var queue = [];
    var i;
    for (i = 0; i < L.bombs.length; i++) {
      var b = L.bombs[i];
      b.timeLeft -= dt;
      b.age += dt;
      if (b.timeLeft <= EPS) queue.push(b);
    }
    while (queue.length) {
      var e = queue.pop();
      if (e.done) continue;
      e.done = true;
      explode(e, queue);
    }
    if (L.bombs.some(function (x) { return x.done; })) L.bombs = L.bombs.filter(function (x) { return !x.done; });
  }

  function tryPlaceBomb() {
    var p = G.player, L = G.L;
    if (!p.alive) return;
    if (L.bombs.length >= p.maxBombs) return;
    var c = tileOf(p.x), r = tileOf(p.y);
    if (bombAt(c, r)) return;
    if (L.grid[r][c] !== DM.EMPTY) return;
    L.bombs.push({ col: c, row: r, timeLeft: 2.5, range: p.range, age: 0, done: false });
    A.sfx('place');
  }

  /* ------------------------------------------------------------ player */
  function canPlayerEnter(dn) {
    var p = G.player;
    var d = DIR[dn];
    var c = tileOf(p.x) + d[0], r = tileOf(p.y) + d[1];
    if (!inBounds(c, r)) return false;
    if (G.L.grid[r][c] !== DM.EMPTY) return false;
    if (bombAt(c, r)) return false;
    return true;
  }

  function chooseStep() {
    var p = G.player;
    var cand = G.pending;
    G.pending = null;
    if (cand) {
      if (canPlayerEnter(cand)) return cand;
      p.facing = cand;
      if (G.held.indexOf(cand) >= 0) return null;
    }
    var h = G.held.length ? G.held[G.held.length - 1] : null;
    if (h) {
      if (canPlayerEnter(h)) return h;
      p.facing = h;
    }
    return null;
  }

  function playerSpeed() {
    return 4.5 + 0.6 * G.player.boots;
  }

  function movePlayer(dt) {
    var p = G.player;
    var speed = playerSpeed();
    var rem = dt, guard = 0;
    var moved = false;
    while (rem > EPS && guard++ < 4) {
      if (!p.moving) {
        var dn = chooseStep();
        if (!dn) break;
        var d = DIR[dn];
        p.facing = dn;
        p.dx = d[0];
        p.dy = d[1];
        p.sx = p.x;
        p.sy = p.y;
        p.prog = 0;
        p.moving = true;
        dust(p.x, p.y);
      }
      var need = (1 - p.prog) / speed;
      moved = true;
      if (rem >= need - 1e-12) {
        p.walkPhase += (1 - p.prog) * 2;
        p.prog = 1;
        p.x = p.sx + p.dx;
        p.y = p.sy + p.dy;
        p.moving = false;
        rem -= need;
      } else {
        p.prog += rem * speed;
        p.walkPhase += rem * speed * 2;
        p.x = p.sx + p.dx * p.prog;
        p.y = p.sy + p.dy * p.prog;
        rem = 0;
      }
    }
    if (p.moving || moved) p.idleT = 0;
    else p.idleT += dt;
  }

  function powerDown() {
    var p = G.player;
    p.maxBombs = Math.max(1, p.maxBombs - 1);
    p.range = Math.max(2, p.range - 1);
    p.boots = Math.max(0, p.boots - 1);
  }

  function killPlayer(timeUp) {
    var p = G.player;
    if (!p.alive) return;
    p.alive = false;
    p.moving = false;
    p.deathT = 1.2;
    p.deathAge = 0;
    p.timeUpDeath = !!timeUp;
    G.lives = Math.max(0, G.lives - 1);
    powerDown();
    G.pending = null;
    G.bombQueued = false;
    A.sfx('playerDie');
    shake();
  }

  function respawn() {
    var p = G.player;
    p.x = 1;
    p.y = 1;
    p.sx = 1;
    p.sy = 1;
    p.facing = 'down';
    p.alive = true;
    p.moving = false;
    p.prog = 0;
    p.invincible = 2.0;
    p.idleT = 0;
    if (p.timeUpDeath) G.timeLeft = 60;
    p.timeUpDeath = false;
    G.pending = null;
    G.bombQueued = false;
  }

  /* returns true when the state changed (caller must stop the tick) */
  function updatePlayer(dt) {
    var p = G.player;
    if (!p.alive) {
      p.deathT -= dt;
      p.deathAge += dt;
      if (p.deathT <= EPS) {
        if (G.lives >= 1) respawn();
        else {
          enterGameOver();
          return true;
        }
      }
      return false;
    }
    if (p.invincible > 0) p.invincible = Math.max(0, p.invincible - dt);
    if (G.bombQueued) {
      G.bombQueued = false;
      tryPlaceBomb();
    }
    movePlayer(dt);
    return false;
  }

  /* ------------------------------------------------------------ enemies */
  function enemyCanEnter(c, r) {
    return inBounds(c, r) && G.L.grid[r][c] === DM.EMPTY && !bombAt(c, r);
  }
  function wanderDir(e, c, r) {
    var rng = G.rng;
    var hasDir = e.dx !== 0 || e.dy !== 0;
    if (hasDir && enemyCanEnter(c + e.dx, r + e.dy) && rng() >= 0.2) return [e.dx, e.dy];
    var opts = [];
    DIRS.forEach(function (dn) {
      var d = DIR[dn];
      if (hasDir && d[0] === -e.dx && d[1] === -e.dy) return;
      if (enemyCanEnter(c + d[0], r + d[1])) opts.push(d);
    });
    if (opts.length) return opts[Math.floor(rng() * opts.length)];
    if (hasDir && enemyCanEnter(c - e.dx, r - e.dy)) return [-e.dx, -e.dy];
    return null;
  }
  function batDir(e, c, r) {
    var rng = G.rng;
    var hasDir = e.dx !== 0 || e.dy !== 0;
    var opts = [];
    DIRS.forEach(function (dn) {
      var d = DIR[dn];
      if (hasDir && d[0] === -e.dx && d[1] === -e.dy) return;
      if (enemyCanEnter(c + d[0], r + d[1])) opts.push(d);
    });
    if (opts.length) return opts[Math.floor(rng() * opts.length)];
    if (hasDir && enemyCanEnter(c - e.dx, r - e.dy)) return [-e.dx, -e.dy];
    return null;
  }
  function ghostDir(e, c, r) {
    var rng = G.rng;
    var p = G.player;
    var pc = tileOf(p.x), pr = tileOf(p.y);
    var chase = p.alive && Math.abs(pc - c) + Math.abs(pr - r) <= 6;
    e.chase = chase;
    if (!chase) return wanderDir(e, c, r);
    if (rng() < 0.25) return wanderDir(e, c, r);
    var hasDir = e.dx !== 0 || e.dy !== 0;
    var opts = [];
    DIRS.forEach(function (dn) {
      var d = DIR[dn];
      if (hasDir && d[0] === -e.dx && d[1] === -e.dy) return;
      if (enemyCanEnter(c + d[0], r + d[1])) opts.push(d);
    });
    if (!opts.length) {
      if (hasDir && enemyCanEnter(c - e.dx, r - e.dy)) opts.push([-e.dx, -e.dy]);
      else return null;
    }
    var best = 99, bl = [];
    opts.forEach(function (d) {
      var dist = Math.abs(pc - (c + d[0])) + Math.abs(pr - (r + d[1]));
      if (dist < best) {
        best = dist;
        bl = [d];
      } else if (dist === best) bl.push(d);
    });
    return bl[Math.floor(rng() * bl.length)];
  }
  function decideEnemy(e) {
    var c = tileOf(e.x), r = tileOf(e.y);
    if (e.type === 'bat') return batDir(e, c, r);
    if (e.type === 'ghost') return ghostDir(e, c, r);
    return wanderDir(e, c, r);
  }

  function updateEnemy(e, dt) {
    if (e.invuln > 0) e.invuln = Math.max(0, e.invuln - dt);
    var rem = dt, guard = 0;
    while (rem > EPS && guard++ < 8) {
      if (e.wait > 0) {
        var w = Math.min(rem, e.wait);
        e.wait -= w;
        rem -= w;
        if (e.wait > EPS) return;
        e.wait = 0;
        continue;
      }
      if (!e.moving) {
        var d = decideEnemy(e);
        if (!d) {
          e.wait = 0.3;
          continue;
        }
        e.dx = d[0];
        e.dy = d[1];
        if (d[0]) e.face = d[0];
        e.sx = e.x;
        e.sy = e.y;
        e.prog = 0;
        e.moving = true;
      }
      var need = (1 - e.prog) / e.speed;
      if (rem >= need - 1e-12) {
        e.prog = 1;
        e.x = e.sx + e.dx;
        e.y = e.sy + e.dy;
        e.moving = false;
        rem -= need;
      } else {
        e.prog += rem * e.speed;
        e.x = e.sx + e.dx * e.prog;
        e.y = e.sy + e.dy * e.prog;
        rem = 0;
      }
    }
  }

  function killEnemy(e) {
    if (!e.alive) return;
    e.hp = 0;
    e.alive = false;
    e.deathT = 0.4;
    e.deathAge = 0;
    e.moving = false;
    G.score += DM.ENEMY_DEF[e.type].score;
    popup('+' + DM.ENEMY_DEF[e.type].score, tileOf(e.x), tileOf(e.y) - 0.4);
    A.sfx('enemyDie');
  }
  function hurtEnemy(e) {
    if (!e.alive || e.invuln > 0) return;
    e.hp -= 1;
    if (e.hp <= 0) killEnemy(e);
    else {
      e.invuln = 0.8;
      A.sfx('hit');
      sparks(tileOf(e.x), tileOf(e.y), 6);
    }
  }

  function updateEnemies(dt) {
    var L = G.L;
    var i, e;
    for (i = 0; i < L.enemies.length; i++) {
      e = L.enemies[i];
      if (e.alive) updateEnemy(e, dt);
      else {
        e.deathT -= dt;
        e.deathAge += dt;
      }
    }
    if (L.enemies.some(function (x) { return !x.alive && x.deathT <= EPS; })) {
      L.enemies = L.enemies.filter(function (x) { return x.alive || x.deathT > EPS; });
    }
  }

  /* ------------------------------------------------------------ flames / contact / items / exit */
  function ageFlames(dt) {
    var L = G.L;
    var any = false;
    for (var i = 0; i < L.flames.length; i++) {
      L.flames[i].timeLeft -= dt;
      L.flames[i].age += dt;
      if (L.flames[i].timeLeft <= EPS) any = true;
    }
    if (any) L.flames = L.flames.filter(function (f) { return f.timeLeft > EPS; });
  }
  function flameAt(c, r) {
    var f = G.L.flames;
    for (var i = 0; i < f.length; i++) if (f[i].col === c && f[i].row === r) return true;
    return false;
  }
  function flameDamage(allowPlayer) {
    var L = G.L, p = G.player;
    if (!L.flames.length) return;
    if (allowPlayer && p.alive && p.invincible <= 0 && !G.god && flameAt(tileOf(p.x), tileOf(p.y))) killPlayer(false);
    for (var i = 0; i < L.enemies.length; i++) {
      var e = L.enemies[i];
      if (e.alive && flameAt(tileOf(e.x), tileOf(e.y))) hurtEnemy(e);
    }
  }
  function contact() {
    var p = G.player, L = G.L;
    if (!p.alive || p.invincible > 0 || G.god) return;
    for (var i = 0; i < L.enemies.length; i++) {
      var e = L.enemies[i];
      if (!e.alive) continue;
      var dx = e.x - p.x, dy = e.y - p.y;
      if (dx * dx + dy * dy < 0.36) {
        killPlayer(false);
        return;
      }
    }
  }
  function pickItems() {
    var p = G.player, L = G.L;
    if (!p.alive) return;
    var c = tileOf(p.x), r = tileOf(p.y);
    for (var i = L.items.length - 1; i >= 0; i--) {
      var it = L.items[i];
      if (it.col !== c || it.row !== r) continue;
      L.items.splice(i, 1);
      if (it.type === 'fire') p.range = Math.min(6, p.range + 1);
      else if (it.type === 'bomb') p.maxBombs = Math.min(5, p.maxBombs + 1);
      else if (it.type === 'boots') p.boots = Math.min(3, p.boots + 1);
      else if (it.type === 'life') G.lives = Math.min(5, G.lives + 1);
      G.score += 50;
      A.sfx(it.type === 'life' ? 'life' : 'item');
      popup('+50', c, r - 0.4, '#9af0ff');
      for (var k = 0; k < 8; k++) {
        var a = (k / 8) * Math.PI * 2;
        addParticle({ kind: 'spark', x: (c + 0.5) * 32, y: 64 + (r + 0.5) * 32, vx: Math.cos(a) * 50, vy: Math.sin(a) * 50, life: 0.4, max: 0.4, size: 2, color: k % 2 ? '#ffffff' : '#ffe45a', grav: 0 });
      }
    }
  }
  function checkExitOpen() {
    var L = G.L;
    if (!L.exit.open && aliveEnemies() === 0) {
      L.exit.open = true;
      L.exit.flash = 0.5;
      A.sfx('exitOpen');
    }
  }
  function checkClear() {
    var L = G.L, p = G.player;
    if (L.exit.open && L.exit.revealed && p.alive && tileOf(p.x) === L.exit.col && tileOf(p.y) === L.exit.row) {
      enterStageClear();
      return true;
    }
    return false;
  }

  /* ------------------------------------------------------------ vfx update */
  function compact(arr, keep) {
    var j = 0;
    for (var i = 0; i < arr.length; i++) {
      if (keep(arr[i])) arr[j++] = arr[i];
    }
    arr.length = j;
  }
  function keepParticle(q) {
    return q.life > 0;
  }
  function keepPopup(q) {
    return q.t < 0.8;
  }
  function keepCrumble(q) {
    return q.t < 0.3;
  }
  function updateVfx(dt) {
    var L = G.L;
    var i;
    for (i = 0; i < G.particles.length; i++) {
      var q = G.particles[i];
      q.life -= dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      if (q.grav) q.vy += q.grav * dt;
      if (q.kind === 'dust') {
        q.vx *= 0.94;
        q.vy *= 0.94;
      }
    }
    compact(G.particles, keepParticle);
    for (i = 0; i < G.popups.length; i++) G.popups[i].t += dt;
    compact(G.popups, keepPopup);
    for (i = 0; i < L.crumbles.length; i++) L.crumbles[i].t += dt;
    compact(L.crumbles, keepCrumble);
    for (i = 0; i < L.items.length; i++) L.items[i].t += dt;
    if (L.exit.flash > 0) L.exit.flash = Math.max(0, L.exit.flash - dt);
    if (L.exit.open) L.exit.openT += dt;
    if (G.shakeT > 0) G.shakeT = Math.max(0, G.shakeT - dt);
    /* fuse sparks */
    G.fuseAcc += dt;
    if (G.fuseAcc >= 0.07) {
      G.fuseAcc = 0;
      for (i = 0; i < L.bombs.length; i++) {
        var b = L.bombs[i];
        addParticle({
          kind: 'spark',
          x: b.col * 32 + 22.6,
          y: 64 + b.row * 32 + 4,
          vx: (vr() - 0.5) * 40,
          vy: -18 - vr() * 30,
          life: 0.22 + vr() * 0.16,
          max: 0.38,
          size: 1,
          color: vr() < 0.5 ? '#ffe45a' : '#ff9a26',
          grav: 90
        });
      }
    }
  }

  /* ------------------------------------------------------------ tick */
  function tickPlaying(dt) {
    var L = G.L, p = G.player;
    G.tickBroke = false;
    /* 1. timer */
    if (p.alive) {
      G.timeLeft -= dt;
      if (G.timeLeft > 10) G.lastWarnSec = 99;
      else if (G.timeLeft > 0) {
        var sec = Math.ceil(G.timeLeft);
        if (sec !== G.lastWarnSec) {
          G.lastWarnSec = sec;
          A.sfx('warn');
        }
      }
      if (G.timeLeft <= 0) {
        G.timeLeft = 0;
        if (!G.god) killPlayer(true);
      }
    }
    A.setTempo(G.timeLeft <= 30 && G.timeLeft > 0 ? 1.2 : 1);
    /* 2. player */
    if (updatePlayer(dt)) return;
    /* 3. bombs */
    updateBombs(dt);
    if (G.tickBroke) A.sfx('break');
    /* 4. enemies */
    updateEnemies(dt);
    /* 5. flames age */
    ageFlames(dt);
    /* 6. flame damage */
    flameDamage(true);
    /* 7. contact */
    contact();
    /* 8. items */
    pickItems();
    /* 9. exit */
    checkExitOpen();
    if (checkClear()) return;
    /* 10. vfx */
    updateVfx(dt);
  }

  function tickStageClear(dt) {
    var L = G.L;
    ageFlames(dt);
    var i;
    for (i = 0; i < L.enemies.length; i++) {
      var e = L.enemies[i];
      if (!e.alive) {
        e.deathT -= dt;
        e.deathAge += dt;
      }
    }
    L.enemies = L.enemies.filter(function (x) { return x.alive || x.deathT > EPS; });
    updateVfx(dt);
    G.player.idleT += dt;
    if (G.stateT >= 3.0) nextStage();
  }

  G.update = function (dt) {
    G.t += dt;
    G.stateT += dt;
    switch (G.state) {
      case 'title':
        updateVfx(dt);
        break;
      case 'stageIntro':
        updateVfx(dt);
        G.player.idleT += dt;
        if (G.stateT >= 1.8) {
          setState('playing');
          G.pending = null;
          G.bombQueued = false;
        }
        break;
      case 'playing':
        tickPlaying(dt);
        break;
      case 'paused':
        break;
      case 'stageClear':
        tickStageClear(dt);
        break;
      case 'gameOver':
      case 'gameClear':
        updateVfx(dt);
        break;
    }
  };

  /* ------------------------------------------------------------ snapshot */
  G.snapshot = function () {
    var L = G.L, p = G.player;
    var grid = [];
    for (var r = 0; r < DM.ROWS; r++) {
      var s = '';
      for (var c = 0; c < DM.COLS; c++) s += L.grid[r][c] === DM.WALL ? '#' : L.grid[r][c] === DM.SOFT ? 'S' : '.';
      grid.push(s);
    }
    return {
      state: G.state,
      seed: G.seed,
      stage: G.stage,
      score: G.score,
      hiScore: Math.max(G.hiSaved, G.score),
      lives: G.lives,
      timeLeft: G.timeLeft,
      player: {
        col: tileOf(p.x),
        row: tileOf(p.y),
        x: p.x,
        y: p.y,
        facing: p.facing,
        alive: p.alive,
        invincible: p.invincible,
        maxBombs: p.maxBombs,
        activeBombs: L.bombs.length,
        range: p.range,
        boots: p.boots,
        speed: playerSpeed()
      },
      bombs: L.bombs.map(function (b) {
        return { col: b.col, row: b.row, timeLeft: b.timeLeft, range: b.range };
      }),
      flames: L.flames.map(function (f) {
        return { col: f.col, row: f.row, timeLeft: f.timeLeft };
      }),
      enemies: L.enemies.map(function (e) {
        return { type: e.type, col: tileOf(e.x), row: tileOf(e.y), x: e.x, y: e.y, hp: e.hp, alive: e.alive };
      }),
      items: L.items.map(function (i) {
        return { type: i.type, col: i.col, row: i.row };
      }),
      exit: { col: L.exit.col, row: L.exit.row, revealed: L.exit.revealed, open: L.exit.open },
      grid: grid,
      texts: DM.font.texts.slice(),
      audio: A.snapshot()
    };
  };

  /* ------------------------------------------------------------ debug hooks (exposed only with ?debug=1) */
  G.debugApi = {
    killAllEnemies: function () {
      G.L.enemies.forEach(function (e) {
        if (e.alive) killEnemy(e);
      });
      checkExitOpen();
    },
    revealExit: function () {
      var L = G.L;
      if (L.grid[L.exit.row][L.exit.col] === DM.SOFT) breakSoft(L.exit.col, L.exit.row, { score: false });
      L.exit.revealed = true;
    },
    clearBlocks: function () {
      var L = G.L;
      for (var r = 0; r < DM.ROWS; r++) for (var c = 0; c < DM.COLS; c++) if (L.grid[r][c] === DM.SOFT) breakSoft(c, r, { score: false, fx: false });
    },
    teleport: function (col, row) {
      col = Math.round(col);
      row = Math.round(row);
      if (!inBounds(col, row) || G.L.grid[row][col] === DM.WALL) return false;
      if (G.L.grid[row][col] === DM.SOFT) breakSoft(col, row, { score: false });
      var p = G.player;
      p.x = col;
      p.y = row;
      p.sx = col;
      p.sy = row;
      p.prog = 0;
      p.moving = false;
      G.pending = null;
      return true;
    },
    setLives: function (n) {
      G.lives = DM.clamp(Math.round(n), 1, 5);
    },
    setTimeLeft: function (s) {
      G.timeLeft = Math.max(0, +s || 0);
    },
    setPowerups: function (o) {
      o = o || {};
      var p = G.player;
      if (o.maxBombs !== undefined) p.maxBombs = DM.clamp(Math.round(o.maxBombs), 1, 5);
      if (o.range !== undefined) p.range = DM.clamp(Math.round(o.range), 2, 6);
      if (o.boots !== undefined) p.boots = DM.clamp(Math.round(o.boots), 0, 3);
    },
    spawnItem: function (type, col, row) {
      if (['fire', 'bomb', 'boots', 'life'].indexOf(type) < 0) return false;
      if (!inBounds(col, row) || G.L.grid[row][col] !== DM.EMPTY) return false;
      addItem(type, col, row);
      return true;
    },
    spawnEnemy: function (type, col, row) {
      if (!DM.ENEMY_DEF[type]) return false;
      if (!inBounds(col, row) || G.L.grid[row][col] !== DM.EMPTY) return false;
      if (!G.rng) G.rng = DM.mulberry32((G.seed ^ 0xc0ffee) >>> 0);
      makeEnemy(type, col, row);
      return true;
    },
    godMode: function (on) {
      G.god = !!on;
    }
  };
})();
