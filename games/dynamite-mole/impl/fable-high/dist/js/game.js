/* Dynamite Mole - game state, rules and fixed-step simulation (spec chapter 3). */
var Game = (function () {
  'use strict';

  var COLS = Level.COLS, ROWS = Level.ROWS;
  var WALL = Level.WALL, SOFT = Level.SOFT, EMPTY = Level.EMPTY;
  var DIRS = { up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } };
  var DIR_LIST = ['up', 'down', 'left', 'right'];
  var OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
  var ENEMY_DEF = {
    slime: { speed: 2.0, hp: 1, score: 100 },
    bat: { speed: 3.2, hp: 1, score: 200 },
    ghost: { speed: 2.4, hp: 1, score: 300 },
    golem: { speed: 1.5, hp: 3, score: 500 }
  };
  var LIMITS = { maxBombs: 5, range: 6, boots: 3, lives: 5 };
  var FUSE = 2.5, FLAME_LIFE = 0.5, INTRO_T = 1.8, CLEAR_T = 3.0, DEATH_T = 1.2, ENEMY_DEATH_T = 0.4, INV_T = 2.0, LOCK_T = 0.6;

  var G = {
    state: 'title', stateTime: 0, totalTime: 0,
    seed: 0, seedFixed: null, startStage: 1, debugOn: false,
    stage: 1, score: 0, lives: 3, timeLeft: 0, hiSaved: 0, hiBefore: 0, newRecord: false,
    grid: [], exit: { col: 0, row: 0, revealed: false, open: false }, hiddenItems: {},
    items: [], enemies: [], bombs: [], flames: [], crumbles: [], particles: [], popups: [], shakeT: 0, exitFlash: 0,
    player: null, rng: null, runActive: false, reachedStage: 1, clearBonus: 0, timeBonus: 0,
    input: { held: [], buffer: null, bombRequested: false },
    brokeThisTick: false, lastCeil: -1, hurry: false,
    scoreShown: 0
  };

  /* ---------- persistence ---------- */
  function loadHi() {
    try { var v = parseInt(localStorage.getItem('dynamiteMole.hiScore'), 10); if (v > 0) G.hiSaved = v; } catch (e) { G.hiSaved = 0; }
  }
  function saveHi() {
    try { localStorage.setItem('dynamiteMole.hiScore', String(G.hiSaved)); } catch (e) { /* ignore */ }
  }
  function loadMuted(force) {
    var m = false;
    try { m = localStorage.getItem('dynamiteMole.muted') === '1'; } catch (e) { m = false; }
    if (force) m = true;
    Sound.setMuted(m);
  }
  function saveMuted() {
    try { localStorage.setItem('dynamiteMole.muted', Sound.isMuted() ? '1' : '0'); } catch (e) { /* ignore */ }
  }

  /* ---------- helpers ---------- */
  function newPlayer() {
    return {
      x: 1, y: 1, facing: 'down', alive: true, deathT: 0, invincible: 0, moving: false, dir: null,
      fromX: 1, fromY: 1, toX: 1, toY: 1, progress: 0, maxBombs: 1, range: 2, boots: 0,
      idleT: 0, timeUpDeath: false, god: false, dustT: 0
    };
  }
  function speedOf(p) { return 4.5 + 0.6 * p.boots; }
  function tileOf(e) { return { col: Math.round(e.x), row: Math.round(e.y) }; }
  function inBounds(c, r) { return c >= 0 && r >= 0 && c < COLS && r < ROWS; }
  function bombAt(c, r) {
    for (var i = 0; i < G.bombs.length; i++) if (G.bombs[i].col === c && G.bombs[i].row === r) return G.bombs[i];
    return null;
  }
  function flameAt(c, r) {
    for (var i = 0; i < G.flames.length; i++) if (G.flames[i].col === c && G.flames[i].row === r) return G.flames[i];
    return null;
  }
  function canEnter(c, r) {
    if (!inBounds(c, r)) return false;
    var t = G.grid[r][c];
    if (t === WALL || t === SOFT) return false;
    if (bombAt(c, r)) return false;
    return true;
  }
  function aliveEnemies() {
    var n = 0;
    for (var i = 0; i < G.enemies.length; i++) if (G.enemies[i].alive) n++;
    return n;
  }
  function randomSeed() { return (Math.floor(Math.random() * 4294967296)) >>> 0; }

  function makeEnemy(type, col, row) {
    var def = ENEMY_DEF[type];
    return {
      type: type, x: col, y: row, dir: null, moving: false, fromX: col, fromY: row, toX: col, toY: row, progress: 0,
      speed: def.speed * G.stageDef.speedMul, hp: def.hp, alive: true, deathT: 0, invT: 0, wait: 0, chasing: false,
      animT: (col * 7 + row * 3) % 5 * 0.1
    };
  }

  /* ---------- run / stage lifecycle ---------- */
  function setState(s) {
    G.state = s;
    G.stateTime = 0;
    syncBgm();
  }
  function syncBgm() {
    if (G.state === 'title') Sound.setBgm('title');
    else if (G.state === 'playing') Sound.setBgm('stage' + G.stage);
    else if (G.state === 'paused') { /* keep track id */ }
    else Sound.setBgm(null);
  }

  function newRun() {
    if (G.runActive) endRun();
    G.seed = G.seedFixed !== null ? G.seedFixed : randomSeed();
    G.rng = Level.mulberry32((G.seed ^ 0xC0FFEE) >>> 0);
    G.score = 0; G.scoreShown = 0; G.lives = 3; G.newRecord = false;
    G.player = newPlayer();
    G.stage = G.startStage;
    G.runActive = true;
    Sound.sfx('start');
    loadStage(G.stage);
    setState('stageIntro');
  }
  function endRun() {
    G.runActive = false;
    G.hiBefore = G.hiSaved;
    if (G.score > G.hiSaved) { G.hiSaved = G.score; saveHi(); }
    G.newRecord = G.score > G.hiBefore && G.score > 0;
  }

  function loadStage(n) {
    var gen = Level.generate(G.seed, n);
    G.stageDef = gen.stage;
    G.grid = gen.grid;
    G.exit = { col: gen.exit.col, row: gen.exit.row, revealed: false, open: false };
    G.hiddenItems = gen.hiddenItems;
    G.items = []; G.bombs = []; G.flames = []; G.crumbles = []; G.particles = []; G.popups = [];
    G.enemies = gen.spawns.map(function (s) { return makeEnemy(s.type, s.col, s.row); });
    G.timeLeft = gen.stage.time;
    G.lastCeil = Math.ceil(G.timeLeft);
    G.shakeT = 0; G.exitFlash = 0;
    var p = G.player;
    p.x = 1; p.y = 1; p.facing = 'down'; p.alive = true; p.deathT = 0; p.invincible = 0; p.moving = false; p.progress = 0;
    p.fromX = p.toX = 1; p.fromY = p.toY = 1; p.timeUpDeath = false; p.idleT = 0;
    G.input.buffer = null; G.input.bombRequested = false;
    G.reachedStage = n;
  }

  // Preview stage used for snapshot() before any run starts.
  function preview() {
    G.seed = G.seedFixed !== null ? G.seedFixed : randomSeed();
    G.rng = Level.mulberry32((G.seed ^ 0xC0FFEE) >>> 0);
    G.player = newPlayer();
    G.stage = G.startStage;
    loadStage(G.stage);
  }

  function init(params) {
    G.debugOn = params.debug;
    var st = parseInt(params.stage, 10);
    G.startStage = (st >= 1 && st <= 5) ? st : 1;
    if (params.seed !== null && params.seed !== undefined && /^-?\d+$/.test(String(params.seed))) {
      G.seedFixed = (parseInt(params.seed, 10) >>> 0);
    } else G.seedFixed = null;
    loadHi();
    loadMuted(params.mute);
    preview();
    setState('title');
  }

  /* ---------- input ---------- */
  var KEY_DIR = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };

  function lastHeld() { var h = G.input.held; return h.length ? h[h.length - 1] : null; }

  function keyDown(code, repeat) {
    if (code === 'KeyM') {
      if (!repeat) { Sound.setMuted(!Sound.isMuted()); saveMuted(); }
      return;
    }
    var dir = KEY_DIR[code];
    if (dir) {
      if (repeat) return;
      var h = G.input.held;
      var i = h.indexOf(dir);
      if (i >= 0) h.splice(i, 1);
      h.push(dir);
      G.input.buffer = dir;
      return;
    }
    if (repeat) return;
    var s = G.state;
    var locked = (s === 'gameOver' || s === 'gameClear') && G.stateTime < LOCK_T;
    if (code === 'Space' || code === 'KeyZ') {
      if (s === 'playing') { G.input.bombRequested = true; return; }
      if (code === 'Space' && (s === 'title' || ((s === 'gameOver' || s === 'gameClear') && !locked))) { newRun(); }
      return;
    }
    if (code === 'Enter') {
      if (s === 'title' || ((s === 'gameOver' || s === 'gameClear') && !locked)) newRun();
      return;
    }
    if (code === 'KeyP' || code === 'Escape') {
      if (s === 'playing') { setState('paused'); Sound.pauseBgm(); Sound.sfx('pause'); }
      else if (s === 'paused') { setState('playing'); Sound.resumeBgm(); Sound.sfx('pause'); }
      else if (code === 'Escape' && (s === 'gameOver' || s === 'gameClear') && !locked) { setState('title'); }
      return;
    }
    if (code === 'KeyR') {
      if (s === 'title') return;
      if ((s === 'gameOver' || s === 'gameClear') && locked) return;
      newRun();
    }
  }
  function keyUp(code) {
    var dir = KEY_DIR[code];
    if (dir) {
      var i = G.input.held.indexOf(dir);
      if (i >= 0) G.input.held.splice(i, 1);
    }
  }
  function releaseAllKeys() { G.input.held = []; }

  /* ---------- fixed-step update ---------- */
  function update(dt) {
    G.totalTime += dt;
    G.stateTime += dt;
    G.scoreShown = G.score;
    switch (G.state) {
      case 'stageIntro':
        updateEffects(dt);
        if (G.stateTime >= INTRO_T) { G.input.buffer = null; G.input.bombRequested = false; setState('playing'); }
        break;
      case 'playing':
        tick(dt);
        break;
      case 'stageClear':
        updateEffects(dt);
        if (G.player) G.player.idleT += dt;
        if (G.stateTime >= CLEAR_T) {
          if (G.stage >= 5) {
            endRun();
            setState('gameClear');
            Sound.sfx('gameClear');
          } else {
            G.stage++;
            loadStage(G.stage);
            setState('stageIntro');
          }
        }
        break;
      case 'gameOver': case 'gameClear': case 'title': case 'paused':
        if (G.state !== 'paused') updateEffects(dt);
        break;
    }
  }

  function tick(dt) {
    var p = G.player;
    G.brokeThisTick = false;
    // 1. timer
    if (p.alive) {
      var prev = G.timeLeft;
      G.timeLeft = Math.max(0, G.timeLeft - dt);
      var c = Math.ceil(G.timeLeft);
      if (c !== G.lastCeil) {
        G.lastCeil = c;
        if (c <= 10 && c >= 0 && prev > 0) Sound.sfx('warn');
      }
      if (G.timeLeft <= 0 && prev > 0 && !p.god) killPlayer(true);
    }
    var hurry = G.timeLeft <= 30;
    if (hurry !== G.hurry) { G.hurry = hurry; Sound.setTempo(hurry ? 1.25 : 1); }
    // 2. player
    updatePlayer(dt);
    // 3. bombs
    for (var i = 0; i < G.bombs.length; i++) G.bombs[i].timeLeft -= dt;
    var due = G.bombs.filter(function (b) { return b.timeLeft <= 0; });
    for (i = 0; i < due.length; i++) if (G.bombs.indexOf(due[i]) >= 0) explode(due[i]);
    // 4. enemies
    for (i = 0; i < G.enemies.length; i++) updateEnemy(G.enemies[i], dt);
    G.enemies = G.enemies.filter(function (e) { return e.alive || e.deathT > 0; });
    // 5. flames
    for (i = 0; i < G.flames.length; i++) { G.flames[i].timeLeft -= dt; G.flames[i].age += dt; }
    G.flames = G.flames.filter(function (f) { return f.timeLeft > 0; });
    // 6. flame hits
    if (p.alive && p.invincible <= 0 && !p.god) {
      var pt = tileOf(p);
      if (flameAt(pt.col, pt.row)) killPlayer(false);
    }
    for (i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      if (!e.alive || e.invT > 0) continue;
      var et = tileOf(e);
      if (flameAt(et.col, et.row)) damageEnemy(e);
    }
    // 7. contact
    if (p.alive && p.invincible <= 0 && !p.god) {
      for (i = 0; i < G.enemies.length; i++) {
        var en = G.enemies[i];
        if (!en.alive) continue;
        var dx = en.x - p.x, dy = en.y - p.y;
        if (dx * dx + dy * dy < 0.36) { killPlayer(false); break; }
      }
    }
    // 8. items
    if (p.alive) {
      var ptile = tileOf(p);
      for (i = 0; i < G.items.length; i++) {
        var it = G.items[i];
        if (it.col === ptile.col && it.row === ptile.row) { pickItem(it); G.items.splice(i, 1); break; }
      }
    }
    // 9. exit
    if (!G.exit.open && aliveEnemies() === 0) {
      G.exit.open = true;
      G.exitFlash = 0.6;
      Sound.sfx('exitOpen');
    }
    if (G.exit.open && p.alive) {
      var t9 = tileOf(p);
      if (t9.col === G.exit.col && t9.row === G.exit.row) {
        stageClear();
        return;
      }
    }
    if (G.brokeThisTick) Sound.sfx('break');
    // 10. effects
    updateEffects(dt);
    if (p.alive && p.invincible > 0) p.invincible = Math.max(0, p.invincible - dt);
  }

  function stageClear() {
    G.clearBonus = 500;
    G.timeBonus = Math.floor(G.timeLeft) * 10;
    G.score += G.clearBonus + G.timeBonus;
    G.player.moving = false; G.player.idleT = 0;
    G.input.buffer = null;
    setState('stageClear');
    Sound.sfx('stageClear');
    for (var i = 0; i < 24; i++) spawnParticle(G.player.x, G.player.y, (Math.random() - 0.5) * 6, -Math.random() * 6 - 2, 1.2, i % 2 ? '#ffd060' : '#ffffff', 2, 8);
  }

  /* ---------- player ---------- */
  function updatePlayer(dt) {
    var p = G.player;
    if (!p.alive) {
      G.input.bombRequested = false;
      G.input.buffer = null;
      p.deathT -= dt;
      if (p.deathT <= 0) {
        if (G.lives > 0) revive();
        else {
          endRun();
          setState('gameOver');
          Sound.sfx('gameOver');
        }
      }
      return;
    }
    var t = dt, guard = 0;
    var moved = false;
    while (t > 1e-9 && guard++ < 8) {
      if (!p.moving) {
        var dir = G.input.buffer || lastHeld();
        G.input.buffer = null;
        if (!dir) break;
        p.facing = dir;
        var d = DIRS[dir];
        var c = Math.round(p.x), r = Math.round(p.y);
        if (!canEnter(c + d.dx, r + d.dy)) break;
        p.moving = true; p.dir = dir; p.progress = 0;
        p.fromX = c; p.fromY = r; p.toX = c + d.dx; p.toY = r + d.dy;
      }
      var stepTime = 1 / speedOf(p);
      var remain = (1 - p.progress) * stepTime;
      moved = true;
      if (t >= remain) {
        t -= remain;
        p.x = p.toX; p.y = p.toY; p.moving = false; p.progress = 0;
      } else {
        p.progress += t / stepTime;
        p.x = p.fromX + (p.toX - p.fromX) * p.progress;
        p.y = p.fromY + (p.toY - p.fromY) * p.progress;
        t = 0;
      }
    }
    if (moved) {
      p.idleT = 0;
      p.dustT += dt;
      if (p.dustT > 0.12) { p.dustT = 0; spawnParticle(p.x, p.y + 0.35, (Math.random() - 0.5) * 1.5, -0.6, 0.35, 'rgba(200,180,140,0.7)', 2, 0); }
    } else p.idleT += dt;
    // bomb placement
    if (G.input.bombRequested) {
      G.input.bombRequested = false;
      var tile = tileOf(p);
      if (G.bombs.length < p.maxBombs && !bombAt(tile.col, tile.row)) {
        G.bombs.push({ col: tile.col, row: tile.row, timeLeft: FUSE, range: p.range });
        Sound.sfx('place');
      }
    }
  }

  function killPlayer(byTime) {
    var p = G.player;
    if (!p.alive) return;
    p.alive = false; p.deathT = DEATH_T; p.moving = false; p.progress = 0;
    p.timeUpDeath = byTime;
    G.lives--;
    p.maxBombs = Math.max(1, p.maxBombs - 1);
    p.range = Math.max(2, p.range - 1);
    p.boots = Math.max(0, p.boots - 1);
    G.input.buffer = null;
    Sound.sfx('playerDie');
    for (var i = 0; i < 10; i++) spawnParticle(p.x, p.y, (Math.random() - 0.5) * 4, -Math.random() * 4 - 1, 0.8, '#f5c542', 2, 10);
  }
  function revive() {
    var p = G.player;
    p.x = 1; p.y = 1; p.fromX = p.toX = 1; p.fromY = p.toY = 1; p.facing = 'down'; p.alive = true; p.moving = false; p.progress = 0;
    p.invincible = INV_T; p.idleT = 0;
    if (p.timeUpDeath) { G.timeLeft = 60.0; G.lastCeil = 60; }
    p.timeUpDeath = false;
  }

  /* ---------- bombs & flames ---------- */
  function addFlame(c, r, kind, axis, dir) {
    var f = flameAt(c, r);
    if (f) {
      f.timeLeft = FLAME_LIFE; f.age = 0;
      if (f.kind !== 'center') {
        if (f.axis === axis) { if (f.kind === 'tip' || kind === 'tip') f.kind = 'arm'; }
        else f.kind = 'center';
      }
      return f;
    }
    f = { col: c, row: r, timeLeft: FLAME_LIFE, age: 0, kind: kind, axis: axis, dir: dir };
    G.flames.push(f);
    return f;
  }
  function explode(b) {
    var idx = G.bombs.indexOf(b);
    if (idx < 0) return;
    G.bombs.splice(idx, 1);
    Sound.sfx('explode');
    G.shakeT = 0.2;
    addFlame(b.col, b.row, 'center', null, null);
    for (var i = 0; i < 10; i++) spawnParticle(b.col, b.row, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, 0.5, i % 2 ? '#ffd060' : '#ff6a1a', 2, 6);
    for (var k = 0; k < DIR_LIST.length; k++) {
      var dir = DIR_LIST[k], d = DIRS[dir];
      var axis = (dir === 'left' || dir === 'right') ? 'h' : 'v';
      var last = null, stoppedByRange = true;
      for (var n = 1; n <= b.range; n++) {
        var c = b.col + d.dx * n, r = b.row + d.dy * n;
        if (!inBounds(c, r)) { stoppedByRange = false; break; }
        var t = G.grid[r][c];
        if (t === WALL) { stoppedByRange = false; break; }
        if (t === SOFT) {
          breakRock(c, r, true);
          addFlame(c, r, 'tip', axis, dir);
          stoppedByRange = false;
          break;
        }
        last = addFlame(c, r, 'arm', axis, dir);
        var other = bombAt(c, r);
        if (other) explode(other);
      }
      if (stoppedByRange && last && last.kind === 'arm') last.kind = 'tip';
      if (last && last.kind === 'tip') last.dir = dir;
    }
  }
  function breakRock(c, r, score) {
    if (G.grid[r][c] !== SOFT) return;
    G.grid[r][c] = EMPTY;
    if (score) G.score += 10;
    G.brokeThisTick = true;
    G.crumbles.push({ col: c, row: r, t: 0 });
    for (var i = 0; i < 6; i++) spawnParticle(c, r, (Math.random() - 0.5) * 5, -Math.random() * 5, 0.6, 'rock', 2, 12);
    var key = c + ',' + r;
    if (G.hiddenItems[key]) {
      G.items.push({ type: G.hiddenItems[key], col: c, row: r });
      delete G.hiddenItems[key];
    }
    if (G.exit.col === c && G.exit.row === r) G.exit.revealed = true;
  }

  /* ---------- enemies ---------- */
  function damageEnemy(e) {
    e.hp--;
    if (e.hp <= 0) {
      e.alive = false; e.deathT = ENEMY_DEATH_T; e.moving = false;
      var sc = ENEMY_DEF[e.type].score;
      G.score += sc;
      G.popups.push({ x: e.x, y: e.y, text: '+' + sc, t: 0 });
      Sound.sfx('enemyDie');
    } else {
      e.invT = 0.8;
      Sound.sfx('hit');
    }
  }
  function updateEnemy(e, dt) {
    if (!e.alive) { e.deathT -= dt; return; }
    if (e.invT > 0) e.invT = Math.max(0, e.invT - dt);
    e.animT += dt;
    var t = dt, guard = 0;
    while (t > 1e-9 && guard++ < 8) {
      if (e.wait > 0) { var w = Math.min(e.wait, t); e.wait -= w; t -= w; continue; }
      if (!e.moving) { decide(e); if (!e.moving) continue; }
      var stepTime = 1 / e.speed;
      var remain = (1 - e.progress) * stepTime;
      if (t >= remain) {
        t -= remain;
        e.x = e.toX; e.y = e.toY; e.moving = false; e.progress = 0;
      } else {
        e.progress += t / stepTime;
        e.x = e.fromX + (e.toX - e.fromX) * e.progress;
        e.y = e.fromY + (e.toY - e.fromY) * e.progress;
        t = 0;
      }
    }
  }
  function movableDirs(c, r) {
    var out = [];
    for (var i = 0; i < DIR_LIST.length; i++) {
      var d = DIRS[DIR_LIST[i]];
      if (canEnter(c + d.dx, r + d.dy)) out.push(DIR_LIST[i]);
    }
    return out;
  }
  function pick(arr) { return arr[Math.floor(G.rng() * arr.length)]; }
  function wander(e, movable) {
    var cur = e.dir;
    if (cur && movable.indexOf(cur) >= 0 && G.rng() >= 0.2) return cur;
    var opts = movable.filter(function (d) { return d !== OPP[cur]; });
    if (opts.length) return pick(opts);
    if (cur && movable.indexOf(OPP[cur]) >= 0) return OPP[cur];
    return null;
  }
  function batChoose(e, movable) {
    var cur = e.dir;
    var opts = movable.filter(function (d) { return d !== OPP[cur]; });
    if (opts.length) return pick(opts);
    if (cur && movable.indexOf(OPP[cur]) >= 0) return OPP[cur];
    return null;
  }
  function decide(e) {
    var c = Math.round(e.x), r = Math.round(e.y);
    var movable = movableDirs(c, r);
    var chosen = null;
    var p = G.player;
    if (e.type === 'ghost') {
      var pt = tileOf(p);
      var dist = Math.abs(pt.col - c) + Math.abs(pt.row - r);
      if (p.alive && dist <= 6) {
        e.chasing = true;
        if (G.rng() < 0.25) chosen = wander(e, movable);
        else {
          var pool = movable.filter(function (d) { return d !== OPP[e.dir]; });
          if (!pool.length) pool = movable;
          if (pool.length) {
            var best = Infinity, ties = [];
            for (var i = 0; i < pool.length; i++) {
              var d = DIRS[pool[i]];
              var nd = Math.abs(pt.col - (c + d.dx)) + Math.abs(pt.row - (r + d.dy));
              if (nd < best) { best = nd; ties = [pool[i]]; }
              else if (nd === best) ties.push(pool[i]);
            }
            chosen = ties.length === 1 ? ties[0] : pick(ties);
          }
        }
      } else { e.chasing = false; chosen = wander(e, movable); }
    } else if (e.type === 'bat') chosen = batChoose(e, movable);
    else chosen = wander(e, movable);
    if (chosen) {
      var dd = DIRS[chosen];
      e.dir = chosen; e.moving = true; e.progress = 0;
      e.fromX = c; e.fromY = r; e.toX = c + dd.dx; e.toY = r + dd.dy;
    } else e.wait = 0.3;
  }

  /* ---------- items ---------- */
  function pickItem(it) {
    var p = G.player;
    if (it.type === 'fire') p.range = Math.min(LIMITS.range, p.range + 1);
    else if (it.type === 'bomb') p.maxBombs = Math.min(LIMITS.maxBombs, p.maxBombs + 1);
    else if (it.type === 'boots') p.boots = Math.min(LIMITS.boots, p.boots + 1);
    else if (it.type === 'life') G.lives = Math.min(LIMITS.lives, G.lives + 1);
    G.score += 50;
    G.popups.push({ x: it.col, y: it.row, text: '+50', t: 0 });
    Sound.sfx(it.type === 'life' ? 'life' : 'item');
    for (var i = 0; i < 8; i++) spawnParticle(it.col, it.row, (Math.random() - 0.5) * 3, -Math.random() * 3 - 1, 0.5, '#ffffff', 1, 4);
  }

  /* ---------- effects ---------- */
  function spawnParticle(x, y, vx, vy, life, color, size, gravity) {
    if (G.particles.length > 300) return;
    G.particles.push({ x: x, y: y, vx: vx, vy: vy, life: life, maxLife: life, color: color, size: size, g: gravity });
  }
  function updateEffects(dt) {
    var i;
    for (i = 0; i < G.crumbles.length; i++) G.crumbles[i].t += dt;
    G.crumbles = G.crumbles.filter(function (c) { return c.t < 0.3; });
    for (i = 0; i < G.particles.length; i++) {
      var q = G.particles[i];
      q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.g * dt;
    }
    G.particles = G.particles.filter(function (q) { return q.life > 0; });
    for (i = 0; i < G.popups.length; i++) G.popups[i].t += dt;
    G.popups = G.popups.filter(function (p) { return p.t < 0.8; });
    if (G.shakeT > 0) G.shakeT = Math.max(0, G.shakeT - dt);
    if (G.exitFlash > 0) G.exitFlash = Math.max(0, G.exitFlash - dt);
  }

  /* ---------- snapshot & debug ---------- */
  function snapshot(texts) {
    var p = G.player;
    var pt = tileOf(p);
    return {
      state: G.state,
      seed: G.seed,
      stage: G.stage,
      score: G.score,
      hiScore: Math.max(G.hiSaved, G.score),
      lives: G.lives,
      timeLeft: G.timeLeft,
      player: {
        col: pt.col, row: pt.row, x: p.x, y: p.y, facing: p.facing, alive: p.alive,
        invincible: p.alive ? p.invincible : 0,
        maxBombs: p.maxBombs, activeBombs: G.bombs.length, range: p.range, boots: p.boots, speed: speedOf(p)
      },
      bombs: G.bombs.map(function (b) { return { col: b.col, row: b.row, timeLeft: b.timeLeft, range: b.range }; }),
      flames: G.flames.map(function (f) { return { col: f.col, row: f.row, timeLeft: f.timeLeft }; }),
      enemies: G.enemies.map(function (e) { return { type: e.type, col: Math.round(e.x), row: Math.round(e.y), x: e.x, y: e.y, hp: e.hp, alive: e.alive }; }),
      items: G.items.map(function (it) { return { type: it.type, col: it.col, row: it.row }; }),
      exit: { col: G.exit.col, row: G.exit.row, revealed: G.exit.revealed, open: G.exit.open },
      grid: G.grid.map(function (row) { return row.join(''); }),
      texts: texts.slice(),
      audio: { unlocked: Sound.isUnlocked(), muted: Sound.isMuted(), bgm: Sound.bgm(), sfxLog: Sound.log() }
    };
  }

  var debug = {
    killAllEnemies: function () {
      for (var i = 0; i < G.enemies.length; i++) {
        var e = G.enemies[i];
        if (!e.alive) continue;
        e.hp = 1; e.invT = 0;
        damageEnemy(e);
      }
    },
    revealExit: function () {
      if (G.grid[G.exit.row][G.exit.col] === SOFT) breakRock(G.exit.col, G.exit.row, false);
      G.exit.revealed = true;
    },
    clearBlocks: function () {
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (G.grid[r][c] === SOFT) breakRock(c, r, false);
    },
    teleport: function (col, row) {
      col = Math.round(col); row = Math.round(row);
      if (!inBounds(col, row) || G.grid[row][col] === WALL) return false;
      if (G.grid[row][col] === SOFT) breakRock(col, row, false);
      var p = G.player;
      p.x = col; p.y = row; p.fromX = p.toX = col; p.fromY = p.toY = row; p.moving = false; p.progress = 0;
      G.input.buffer = null;
      return true;
    },
    setLives: function (n) { n = Math.round(n); if (n >= 1 && n <= 5) G.lives = n; },
    setTimeLeft: function (sec) { sec = Number(sec); if (isFinite(sec)) { G.timeLeft = Math.max(0, sec); G.lastCeil = Math.ceil(G.timeLeft); } },
    setPowerups: function (o) {
      o = o || {};
      var p = G.player;
      if (o.maxBombs !== undefined) p.maxBombs = Math.min(LIMITS.maxBombs, Math.max(1, Math.round(o.maxBombs)));
      if (o.range !== undefined) p.range = Math.min(LIMITS.range, Math.max(1, Math.round(o.range)));
      if (o.boots !== undefined) p.boots = Math.min(LIMITS.boots, Math.max(0, Math.round(o.boots)));
    },
    spawnItem: function (type, col, row) {
      if (['fire', 'bomb', 'boots', 'life'].indexOf(type) < 0) return false;
      if (!inBounds(col, row) || G.grid[row][col] !== EMPTY) return false;
      G.items.push({ type: type, col: col, row: row });
      return true;
    },
    spawnEnemy: function (type, col, row) {
      if (!ENEMY_DEF[type]) return false;
      if (!inBounds(col, row) || G.grid[row][col] !== EMPTY) return false;
      G.enemies.push(makeEnemy(type, col, row));
      return true;
    },
    godMode: function (on) { G.player.god = !!on; }
  };

  return {
    G: G, init: init, update: update, keyDown: keyDown, keyUp: keyUp, releaseAllKeys: releaseAllKeys,
    snapshot: snapshot, debug: debug, speedOf: speedOf, tileOf: tileOf, aliveEnemies: aliveEnemies,
    saveMuted: saveMuted, DIRS: DIRS, newRun: newRun, setState: setState,
    pauseIfPlaying: function () { if (G.state === 'playing') { setState('paused'); Sound.pauseBgm(); Sound.sfx('pause'); } },
    startFromTouch: function () {
      var s = G.state;
      var locked = (s === 'gameOver' || s === 'gameClear') && G.stateTime < LOCK_T;
      if (s === 'title' || ((s === 'gameOver' || s === 'gameClear') && !locked)) newRun();
    }
  };
})();
