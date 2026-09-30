// Game state, rules and fixed-step update.
(function () {
  'use strict';
  var DM = window.DM;
  var Audio = DM.Audio;

  var LS_HI = 'dynamiteMole.hiScore', LS_MUTE = 'dynamiteMole.muted';
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  // ---------- URL params ----------
  var params = {};
  try {
    var q = new URLSearchParams(window.location.search);
    params.seed = q.get('seed');
    params.stage = q.get('stage');
    params.debug = q.get('debug') === '1';
    params.mute = q.get('mute') === '1';
    params.touch = q.get('touch') === '1';
  } catch (e) { /* ignore */ }
  DM.params = params;

  var fixedSeed = null;
  if (params.seed !== null && params.seed !== undefined && /^-?\d+$/.test(String(params.seed).trim())) {
    fixedSeed = Number(params.seed) >>> 0;
  }
  var startStage = 1;
  if (params.stage && /^\d+$/.test(params.stage)) {
    var sv = parseInt(params.stage, 10);
    if (sv >= 1 && sv <= 5) startStage = sv;
  }

  function newSeed() { return fixedSeed !== null ? fixedSeed : (Math.floor(Math.random() * 4294967296) >>> 0); }

  var hiStored = parseInt(lsGet(LS_HI) || '0', 10);
  if (!isFinite(hiStored) || hiStored < 0) hiStored = 0;
  var muted = params.mute ? true : lsGet(LS_MUTE) === '1';
  Audio.init(muted);

  var G = {
    state: 'title', stateTime: 0, seed: newSeed(), startStage: startStage, stage: startStage,
    score: 0, lives: 3, timeLeft: 0, hiStored: hiStored, prevHi: hiStored, newRecord: false,
    runActive: false, runCommitted: true,
    player: null, bombs: [], flames: [], enemies: [], items: [], exit: null, grid: null, hidden: {},
    crumbles: [], particles: [], popups: [], shake: 0, exitFlash: 0, time: 0,
    rng: null, god: false, clearBonus: 0, timeBonus: 0, lastWarn: -1, breakThisTick: false,
    input: { held: [], buffer: null, bombPressed: false },
    bgVersion: 0
  };
  DM.G = G;

  function newPlayer() {
    return {
      c: 1, r: 1, tc: 1, tr: 1, x: 1, y: 1, moving: false, prog: 0, facing: 'down', alive: true,
      invincible: 0, deathT: 0, deathCause: null, maxBombs: 1, range: 2, boots: 0, animT: 0, stepCount: 0
    };
  }

  function playerSpeed() { return 4.5 + 0.6 * G.player.boots; }

  function loadStage(s) {
    G.stage = s;
    var L = DM.generateStage(G.seed, s);
    G.grid = L.grid;
    G.hidden = L.hidden;
    G.exit = { col: L.exit.c, row: L.exit.r, revealed: false, open: false };
    var p = G.player || newPlayer();
    p.c = p.tc = 1; p.r = p.tr = 1; p.x = 1; p.y = 1; p.moving = false; p.prog = 0; p.facing = 'down';
    p.alive = true; p.invincible = 0; p.deathT = 0;
    G.player = p;
    G.bombs = []; G.flames = []; G.items = []; G.crumbles = []; G.particles = []; G.popups = [];
    G.enemies = L.enemies.map(function (e) { return makeEnemy(e.type, e.c, e.r); });
    G.timeLeft = DM.STAGES[s - 1].time;
    G.lastWarn = -1;
    G.exitFlash = 0;
    G.input.buffer = null; G.input.bombPressed = false;
    G.bgVersion++;
  }

  function makeEnemy(type, c, r) {
    return {
      type: type, c: c, r: r, tc: c, tr: r, x: c, y: r, moving: false, prog: 0, dir: null, wait: 0,
      hp: DM.ENEMY[type].hp, alive: true, dyingT: 0, invulnT: 0, chasing: false, animT: Math.random() * 2
    };
  }

  function setState(s) {
    G.state = s;
    G.stateTime = 0;
  }

  // ---------- run lifecycle ----------
  function commitRun() {
    if (G.runCommitted) return;
    G.runCommitted = true;
    G.prevHi = G.hiStored;
    if (G.score > G.hiStored) {
      G.hiStored = G.score;
      lsSet(LS_HI, String(G.score));
    }
    G.newRecord = G.score > G.prevHi && G.score > 0;
  }

  function startRun() {
    if (G.runActive && !G.runCommitted) commitRun();
    G.seed = newSeed();
    G.rng = DM.mulberry32((G.seed ^ 0xC0FFEE) >>> 0);
    G.score = 0; G.lives = 3;
    G.player = newPlayer();
    G.runActive = true; G.runCommitted = false; G.newRecord = false;
    loadStage(G.startStage);
    setState('stageIntro');
    Audio.sfx('start');
  }

  function toTitle() {
    setState('title');
    G.stage = G.startStage;
  }

  // ---------- grid helpers ----------
  function cell(c, r) {
    if (c < 0 || r < 0 || c >= DM.COLS || r >= DM.ROWS) return DM.WALL;
    return G.grid[r][c];
  }
  function bombAt(c, r) {
    for (var i = 0; i < G.bombs.length; i++) if (G.bombs[i].col === c && G.bombs[i].row === r) return G.bombs[i];
    return null;
  }
  function flameAt(c, r) {
    for (var i = 0; i < G.flames.length; i++) if (G.flames[i].col === c && G.flames[i].row === r) return true;
    return false;
  }
  function canEnter(c, r) {
    var t = cell(c, r);
    return t !== DM.WALL && t !== DM.SOFT && !bombAt(c, r);
  }
  G.canEnter = canEnter;

  function popup(x, y, text, color) {
    G.popups.push({ x: x, y: y, text: text, t: 0, color: color || '#ffffff' });
  }
  function particles(x, y, n, colors, spd, life, grav) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, s = spd * (0.4 + Math.random() * 0.8);
      G.particles.push({
        x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (grav ? spd * 0.4 : 0), t: 0,
        life: life * (0.6 + Math.random() * 0.6), color: colors[(Math.random() * colors.length) | 0], g: grav || 0
      });
    }
    if (G.particles.length > 400) G.particles.splice(0, G.particles.length - 400);
  }
  function tilePx(c, r) { return { x: (c + 0.5) * 32, y: 64 + (r + 0.5) * 32 }; }

  function breakSoft(c, r, withScore) {
    if (G.grid[r][c] !== DM.SOFT) return;
    G.grid[r][c] = DM.EMPTY;
    if (withScore) G.score += 10;
    G.crumbles.push({ col: c, row: r, t: 0 });
    var T = DM.THEMES[G.stage - 1];
    var p = tilePx(c, r);
    particles(p.x, p.y, 10, [T.rock, T.rockD, T.rockL], 90, 0.5, 260);
    var key = c + ',' + r;
    if (G.hidden[key]) {
      G.items.push({ type: G.hidden[key], col: c, row: r, t: 0 });
      delete G.hidden[key];
    }
    if (G.exit.col === c && G.exit.row === r) G.exit.revealed = true;
    if (!G.breakThisTick) { G.breakThisTick = true; Audio.sfx('break'); }
  }

  // ---------- player ----------
  function lastHeld() {
    var h = G.input.held;
    return h.length ? h[h.length - 1] : null;
  }

  function updatePlayer(dt) {
    var p = G.player;
    if (!p.alive) return;
    if (p.invincible > 0) p.invincible = Math.max(0, p.invincible - dt);
    var time = dt;
    var guard = 0;
    while (time > 0 && guard++ < 8) {
      if (!p.moving) {
        var d = G.input.buffer || lastHeld();
        G.input.buffer = null;
        if (!d) break;
        p.facing = d;
        var v = DM.DIRS[d];
        var nc = p.c + v[0], nr = p.r + v[1];
        if (!canEnter(nc, nr)) break;
        p.moving = true; p.tc = nc; p.tr = nr; p.prog = 0;
      }
      var spd = playerSpeed();
      var need = (1 - p.prog) / spd;
      if (time < need) { p.prog += time * spd; time = 0; }
      else {
        time -= need;
        p.c = p.tc; p.r = p.tr; p.prog = 0; p.moving = false;
        p.stepCount++;
        var pp = tilePx(p.c, p.r);
        if (p.stepCount % 2 === 0) particles(pp.x, pp.y + 12, 2, ['#c8b8a0', '#a89880'], 20, 0.3, 0);
        if (!G.input.buffer && !lastHeld()) break;
      }
    }
    if (p.moving) {
      p.x = p.c + (p.tc - p.c) * p.prog;
      p.y = p.r + (p.tr - p.r) * p.prog;
    } else { p.x = p.c; p.y = p.r; }
    p.animT += dt;
  }

  function tryPlaceBomb() {
    var p = G.player;
    if (!G.input.bombPressed) return;
    G.input.bombPressed = false;
    if (!p.alive) return;
    if (G.bombs.length >= p.maxBombs) return;
    var c = Math.round(p.x), r = Math.round(p.y);
    if (bombAt(c, r)) return;
    G.bombs.push({ col: c, row: r, timeLeft: 2.5, range: p.range, age: 0 });
    Audio.sfx('place');
  }

  function killPlayer(cause) {
    var p = G.player;
    if (!p.alive) return;
    p.alive = false;
    p.deathT = 1.2;
    p.deathCause = cause;
    p.moving = false;
    p.x = Math.round(p.x); p.y = Math.round(p.y);
    p.c = p.x; p.r = p.y;
    G.lives = Math.max(0, G.lives - 1);
    p.maxBombs = Math.max(1, p.maxBombs - 1);
    p.range = Math.max(2, p.range - 1);
    p.boots = Math.max(0, p.boots - 1);
    G.input.buffer = null;
    G.shake = Math.max(G.shake, 0.15);
    Audio.sfx('playerDie');
  }

  function updateDeath(dt) {
    var p = G.player;
    if (p.alive) return;
    p.deathT -= dt;
    p.animT += dt;
    if (p.deathT <= 0) {
      if (G.lives >= 1) {
        p.c = p.tc = 1; p.r = p.tr = 1; p.x = 1; p.y = 1; p.moving = false; p.prog = 0;
        p.facing = 'down'; p.alive = true; p.invincible = 2.0;
        if (p.deathCause === 'time') G.timeLeft = 60.0;
        G.lastWarn = -1;
      } else {
        commitRun();
        setState('gameOver');
        Audio.sfx('gameOver');
      }
    }
  }

  // ---------- bombs ----------
  function explode(bomb) {
    var queue = [bomb];
    bomb.done = true;
    while (queue.length) {
      var b = queue.shift();
      var idx = G.bombs.indexOf(b);
      if (idx >= 0) G.bombs.splice(idx, 1);
      Audio.sfx('explode');
      G.shake = 0.2;
      var bp = tilePx(b.col, b.row);
      particles(bp.x, bp.y, 14, ['#ffe04a', '#ff9a2a', '#fffbe8', '#f0502a'], 160, 0.45, 0);
      addFlame(b.col, b.row, 'center', null);
      DM.DIR_LIST.forEach(function (d) {
        var v = DM.DIRS[d];
        var cells = [];
        for (var i = 1; i <= b.range; i++) {
          var c = b.col + v[0] * i, r = b.row + v[1] * i;
          var t = cell(c, r);
          if (t === DM.WALL) break;
          if (t === DM.SOFT) { breakSoft(c, r, true); cells.push([c, r]); break; }
          cells.push([c, r]);
          var ob = bombAt(c, r);
          if (ob && !ob.done) { ob.done = true; ob.timeLeft = 0; queue.push(ob); }
        }
        cells.forEach(function (cr, k) {
          addFlame(cr[0], cr[1], k === cells.length - 1 ? 'tip' : 'arm', d);
        });
      });
    }
  }
  function addFlame(c, r, kind, dir) {
    G.flames.push({ col: c, row: r, timeLeft: 0.5, kind: kind, dir: dir });
  }

  function updateBombs(dt) {
    var list = G.bombs.slice();
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (b.done) continue;
      b.timeLeft -= dt;
      b.age += dt;
      if (b.timeLeft <= 0) { b.timeLeft = 0; explode(b); }
    }
  }

  // ---------- enemies ----------
  function enemyCan(e, d) {
    var v = DM.DIRS[d];
    return canEnter(e.c + v[0], e.r + v[1]);
  }
  function pick(arr) { return arr[Math.floor(G.rng() * arr.length)]; }
  function wanderDir(e) {
    if (e.dir && enemyCan(e, e.dir)) {
      if (G.rng() >= 0.2) return e.dir;
    }
    var rev = e.dir ? DM.REVERSE[e.dir] : null;
    var opts = DM.DIR_LIST.filter(function (d) { return d !== rev && enemyCan(e, d); });
    if (opts.length) return pick(opts);
    if (rev && enemyCan(e, rev)) return rev;
    return null;
  }
  function batDir(e) {
    var rev = e.dir ? DM.REVERSE[e.dir] : null;
    var opts = DM.DIR_LIST.filter(function (d) { return d !== rev && enemyCan(e, d); });
    if (opts.length) return pick(opts);
    if (rev && enemyCan(e, rev)) return rev;
    return null;
  }
  function ghostDir(e) {
    var p = G.player;
    var pc = Math.round(p.x), pr = Math.round(p.y);
    var dist = Math.abs(e.c - pc) + Math.abs(e.r - pr);
    if (!p.alive || dist > 6) { e.chasing = false; return wanderDir(e); }
    e.chasing = true;
    if (G.rng() < 0.25) return wanderDir(e);
    var rev = e.dir ? DM.REVERSE[e.dir] : null;
    var opts = DM.DIR_LIST.filter(function (d) { return d !== rev && enemyCan(e, d); });
    if (!opts.length) {
      if (rev && enemyCan(e, rev)) return rev;
      return null;
    }
    var best = Infinity, cands = [];
    opts.forEach(function (d) {
      var v = DM.DIRS[d];
      var dd = Math.abs(e.c + v[0] - pc) + Math.abs(e.r + v[1] - pr);
      if (dd < best) { best = dd; cands = [d]; } else if (dd === best) cands.push(d);
    });
    return pick(cands);
  }

  function updateEnemies(dt) {
    var mult = DM.STAGES[G.stage - 1].mult;
    for (var i = G.enemies.length - 1; i >= 0; i--) {
      var e = G.enemies[i];
      e.animT += dt;
      if (!e.alive) {
        e.dyingT -= dt;
        if (e.dyingT <= 0) G.enemies.splice(i, 1);
        continue;
      }
      if (e.invulnT > 0) e.invulnT = Math.max(0, e.invulnT - dt);
      var spd = DM.ENEMY[e.type].speed * mult;
      var time = dt, guard = 0;
      while (time > 0 && guard++ < 8) {
        if (!e.moving) {
          if (e.wait > 0) {
            var w = Math.min(e.wait, time);
            e.wait -= w; time -= w;
            if (e.wait > 0) break;
          }
          var d = e.type === 'bat' ? batDir(e) : e.type === 'ghost' ? ghostDir(e) : wanderDir(e);
          if (!d) { e.wait = 0.3; continue; }
          e.dir = d;
          var v = DM.DIRS[d];
          e.tc = e.c + v[0]; e.tr = e.r + v[1]; e.moving = true; e.prog = 0;
        }
        var need = (1 - e.prog) / spd;
        if (time < need) { e.prog += time * spd; time = 0; }
        else {
          time -= need;
          e.c = e.tc; e.r = e.tr; e.prog = 0; e.moving = false;
        }
      }
      if (e.moving) { e.x = e.c + (e.tc - e.c) * e.prog; e.y = e.r + (e.tr - e.r) * e.prog; }
      else { e.x = e.c; e.y = e.r; }
    }
  }

  function damageEnemy(e) {
    if (!e.alive || e.invulnT > 0) return;
    e.hp -= 1;
    if (e.hp <= 0) killEnemy(e);
    else { e.invulnT = 0.8; Audio.sfx('hit'); }
  }
  function killEnemy(e) {
    if (!e.alive) return;
    e.hp = 0;
    e.alive = false;
    e.dyingT = 0.4;
    e.moving = false;
    var sc = DM.ENEMY[e.type].score;
    G.score += sc;
    var p = tilePx(e.x, e.y);
    popup(p.x, p.y - 8, '+' + sc, '#ffe066');
    Audio.sfx('enemyDie');
  }

  // ---------- items ----------
  function collectItems() {
    var p = G.player;
    if (!p.alive) return;
    var c = Math.round(p.x), r = Math.round(p.y);
    for (var i = G.items.length - 1; i >= 0; i--) {
      var it = G.items[i];
      if (it.col !== c || it.row !== r) continue;
      G.items.splice(i, 1);
      G.score += 50;
      if (it.type === 'fire') p.range = Math.min(6, p.range + 1);
      else if (it.type === 'bomb') p.maxBombs = Math.min(5, p.maxBombs + 1);
      else if (it.type === 'boots') p.boots = Math.min(3, p.boots + 1);
      else if (it.type === 'life') G.lives = Math.min(5, G.lives + 1);
      var pp = tilePx(c, r);
      popup(pp.x, pp.y - 8, '+50', '#9affd0');
      particles(pp.x, pp.y, 10, ['#ffffff', '#fff6a0', '#9af0ff'], 70, 0.4, 0);
      Audio.sfx(it.type === 'life' ? 'life' : 'item');
    }
  }

  function aliveEnemyCount() {
    var n = 0;
    for (var i = 0; i < G.enemies.length; i++) if (G.enemies[i].alive) n++;
    return n;
  }
  G.aliveEnemyCount = aliveEnemyCount;

  function checkExit() {
    if (!G.exit.open && aliveEnemyCount() === 0) {
      G.exit.open = true;
      G.exitFlash = 0.6;
      Audio.sfx('exitOpen');
    }
    var p = G.player;
    if (G.exit.open && G.exit.revealed && p.alive && Math.round(p.x) === G.exit.col && Math.round(p.y) === G.exit.row) {
      G.timeBonus = Math.floor(G.timeLeft) * 10;
      G.clearBonus = 500;
      G.score += G.clearBonus + G.timeBonus;
      p.moving = false; p.x = p.c = G.exit.col; p.y = p.r = G.exit.row;
      setState('stageClear');
      Audio.sfx('stageClear');
    }
  }

  // ---------- per-tick update ----------
  function tickPlaying(dt) {
    var p = G.player;
    G.breakThisTick = false;
    // 1. timer
    if (p.alive) {
      G.timeLeft -= dt;
      var sec = Math.ceil(G.timeLeft);
      if (G.timeLeft <= 10 && G.timeLeft > 0 && sec !== G.lastWarn) {
        G.lastWarn = sec;
        Audio.sfx('warn');
      }
      if (G.timeLeft <= 0) {
        G.timeLeft = 0;
        if (!G.god) killPlayer('time');
      }
    }
    // 2. player
    if (p.alive) {
      updatePlayer(dt);
      tryPlaceBomb();
    } else {
      G.input.bombPressed = false;
      updateDeath(dt);
      if (G.state !== 'playing') return;
    }
    // 3. bombs
    updateBombs(dt);
    // 4. enemies
    updateEnemies(dt);
    // 5. flames
    for (var i = G.flames.length - 1; i >= 0; i--) {
      G.flames[i].timeLeft -= dt;
      if (G.flames[i].timeLeft <= 0) G.flames.splice(i, 1);
    }
    // 6. flame damage
    if (p.alive && p.invincible <= 0 && !G.god && flameAt(Math.round(p.x), Math.round(p.y))) killPlayer('flame');
    G.enemies.forEach(function (e) {
      if (e.alive && flameAt(Math.round(e.x), Math.round(e.y))) damageEnemy(e);
    });
    // 7. contact
    if (p.alive && p.invincible <= 0 && !G.god) {
      for (var k = 0; k < G.enemies.length; k++) {
        var e = G.enemies[k];
        if (!e.alive) continue;
        var dx = e.x - p.x, dy = e.y - p.y;
        if (dx * dx + dy * dy < 0.36) { killPlayer('enemy'); break; }
      }
    }
    // 8. items
    collectItems();
    // 9. exit
    checkExit();
  }

  function tickEffects(dt) {
    G.time += dt;
    for (var i = G.crumbles.length - 1; i >= 0; i--) { G.crumbles[i].t += dt; if (G.crumbles[i].t >= 0.3) G.crumbles.splice(i, 1); }
    for (i = G.particles.length - 1; i >= 0; i--) {
      var q = G.particles[i];
      q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.g * dt; q.vx *= 0.96; q.vy *= q.g ? 1 : 0.96;
      if (q.t >= q.life) G.particles.splice(i, 1);
    }
    for (i = G.popups.length - 1; i >= 0; i--) { G.popups[i].t += dt; if (G.popups[i].t >= 0.8) G.popups.splice(i, 1); }
    G.items.forEach(function (it) { it.t += dt; });
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt);
    if (G.exitFlash > 0) G.exitFlash = Math.max(0, G.exitFlash - dt);
  }

  G.update = function (dt) {
    G.stateTime += dt;
    switch (G.state) {
      case 'title':
        G.time += dt;
        break;
      case 'stageIntro':
        tickEffects(dt);
        if (G.stateTime >= 1.8) setState('playing');
        break;
      case 'playing':
        tickPlaying(dt);
        tickEffects(dt);
        break;
      case 'stageClear':
        tickEffects(dt);
        G.player.animT += dt;
        if (G.stateTime >= 3.0) {
          if (G.stage >= 5) {
            commitRun();
            setState('gameClear');
            Audio.sfx('gameClear');
          } else {
            loadStage(G.stage + 1);
            setState('stageIntro');
          }
        }
        break;
      case 'gameOver':
      case 'gameClear':
        tickEffects(dt);
        break;
    }
  };

  // ---------- input ----------
  var DIRKEY = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right'
  };
  var heldCodes = [];
  function recomputeHeld() {
    var dirs = [];
    heldCodes.forEach(function (c) {
      var d = DIRKEY[c];
      var idx = dirs.indexOf(d);
      if (idx >= 0) dirs.splice(idx, 1);
      dirs.push(d);
    });
    G.input.held = dirs;
  }
  G.GAME_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'Enter', 'Escape', 'KeyP', 'KeyR', 'KeyM'];

  G.keyDown = function (code, repeat) {
    Audio.unlock();
    if (code === 'KeyM' && !repeat) { toggleMute(); return; }
    if (DIRKEY[code]) {
      if (heldCodes.indexOf(code) < 0) heldCodes.push(code);
      recomputeHeld();
      if (!repeat && G.state === 'playing') G.input.buffer = DIRKEY[code];
      return;
    }
    if (repeat) return;
    var s = G.state;
    if (s === 'title') {
      if (code === 'Enter' || code === 'Space') startRun();
      return;
    }
    if (s === 'gameOver' || s === 'gameClear') {
      if (G.stateTime < 0.6) return;
      if (code === 'Enter' || code === 'Space' || code === 'KeyR') startRun();
      else if (code === 'Escape') toTitle();
      return;
    }
    if (code === 'KeyR') { startRun(); return; }
    if (s === 'playing') {
      if (code === 'Space' || code === 'KeyZ') { G.input.bombPressed = true; return; }
      if (code === 'KeyP' || code === 'Escape') { setPaused(true); return; }
    } else if (s === 'paused') {
      if (code === 'KeyP' || code === 'Escape') { setPaused(false); return; }
    }
  };
  G.keyUp = function (code) {
    var i = heldCodes.indexOf(code);
    if (i >= 0) { heldCodes.splice(i, 1); recomputeHeld(); }
  };
  G.clearKeys = function () { heldCodes = []; recomputeHeld(); };

  function setPaused(on) {
    if (on && G.state === 'playing') { G.state = 'paused'; Audio.sfx('pause'); }
    else if (!on && G.state === 'paused') { G.state = 'playing'; Audio.sfx('pause'); }
  }
  G.setPaused = setPaused;

  function toggleMute() {
    Audio.setMuted(!Audio.muted);
    lsSet(LS_MUTE, Audio.muted ? '1' : '0');
  }

  G.bgmTrack = function () {
    if (G.state === 'title') return 'title';
    if (G.state === 'playing' || G.state === 'paused') return 'stage' + G.stage;
    return null;
  };

  G.hiScore = function () { return Math.max(G.hiStored, G.score); };

  // ---------- snapshot ----------
  function gridStrings() {
    return G.grid.map(function (row) {
      return row.map(function (t) { return t === DM.WALL ? '#' : t === DM.SOFT ? 'S' : '.'; }).join('');
    });
  }
  G.snapshot = function () {
    var p = G.player;
    var flameMap = {};
    G.flames.forEach(function (f) {
      var k = f.col + ',' + f.row;
      if (!flameMap[k] || flameMap[k].timeLeft < f.timeLeft) flameMap[k] = { col: f.col, row: f.row, timeLeft: f.timeLeft };
    });
    return {
      state: G.state,
      seed: G.seed,
      stage: G.stage,
      score: G.score,
      hiScore: G.hiScore(),
      lives: G.lives,
      timeLeft: G.timeLeft,
      player: {
        col: Math.round(p.x), row: Math.round(p.y), x: p.x, y: p.y, facing: p.facing, alive: p.alive,
        invincible: p.invincible, maxBombs: p.maxBombs, activeBombs: G.bombs.length, range: p.range,
        boots: p.boots, speed: playerSpeed()
      },
      bombs: G.bombs.map(function (b) { return { col: b.col, row: b.row, timeLeft: b.timeLeft, range: b.range }; }),
      flames: Object.keys(flameMap).map(function (k) { return flameMap[k]; }),
      enemies: G.enemies.map(function (e) {
        return { type: e.type, col: Math.round(e.x), row: Math.round(e.y), x: e.x, y: e.y, hp: e.hp, alive: e.alive };
      }),
      items: G.items.map(function (it) { return { type: it.type, col: it.col, row: it.row }; }),
      exit: { col: G.exit.col, row: G.exit.row, revealed: G.exit.revealed, open: G.exit.open },
      grid: gridStrings(),
      texts: DM.Font.lastTexts.slice(),
      audio: {
        unlocked: Audio.unlocked, muted: Audio.muted, bgm: G.bgmTrack(),
        sfxLog: Audio.sfxLog.map(function (s) { return { name: s.name, time: s.time }; })
      }
    };
  };

  // ---------- debug ----------
  function inField(c, r) { return c >= 0 && r >= 0 && c < DM.COLS && r < DM.ROWS; }
  G.makeDebug = function () {
    return {
      killAllEnemies: function () {
        G.enemies.forEach(function (e) { if (e.alive) killEnemy(e); });
        if (G.state === 'playing' || G.state === 'paused') {
          if (!G.exit.open) { G.exit.open = true; G.exitFlash = 0.6; Audio.sfx('exitOpen'); }
        }
      },
      revealExit: function () {
        if (G.grid[G.exit.row][G.exit.col] === DM.SOFT) breakSoft(G.exit.col, G.exit.row, false);
        G.exit.revealed = true;
      },
      clearBlocks: function () {
        for (var r = 0; r < DM.ROWS; r++) for (var c = 0; c < DM.COLS; c++) if (G.grid[r][c] === DM.SOFT) breakSoft(c, r, false);
      },
      teleport: function (c, r) {
        c = Math.floor(c); r = Math.floor(r);
        if (!inField(c, r) || G.grid[r][c] === DM.WALL) return false;
        if (G.grid[r][c] === DM.SOFT) breakSoft(c, r, false);
        var p = G.player;
        p.c = p.tc = c; p.r = p.tr = r; p.x = c; p.y = r; p.moving = false; p.prog = 0;
        G.input.buffer = null;
        return true;
      },
      setLives: function (n) { G.lives = Math.max(1, Math.min(5, Math.floor(n))); },
      setTimeLeft: function (s) { G.timeLeft = Number(s); G.lastWarn = -1; },
      setPowerups: function (o) {
        o = o || {};
        var p = G.player;
        if (o.maxBombs !== undefined) p.maxBombs = Math.max(1, Math.min(5, Math.floor(o.maxBombs)));
        if (o.range !== undefined) p.range = Math.max(2, Math.min(6, Math.floor(o.range)));
        if (o.boots !== undefined) p.boots = Math.max(0, Math.min(3, Math.floor(o.boots)));
      },
      spawnItem: function (type, c, r) {
        if (['fire', 'bomb', 'boots', 'life'].indexOf(type) < 0 || !inField(c, r) || G.grid[r][c] !== DM.EMPTY) return false;
        G.items.push({ type: type, col: c, row: r, t: 0 });
        return true;
      },
      spawnEnemy: function (type, c, r) {
        if (!DM.ENEMY[type] || !inField(c, r) || G.grid[r][c] !== DM.EMPTY) return false;
        G.enemies.push(makeEnemy(type, c, r));
        return true;
      },
      godMode: function (on) { G.god = !!on; }
    };
  };

  // Preview stage for the title screen snapshot
  G.player = newPlayer();
  G.rng = DM.mulberry32((G.seed ^ 0xC0FFEE) >>> 0);
  loadStage(G.startStage);
})();
