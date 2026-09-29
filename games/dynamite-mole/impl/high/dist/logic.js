/* logic.js - game rules (SPEC chapter 3). Pure state + update(dt); rendering lives in render.js */
(function () {
  'use strict';
  const DM = (window.DM = window.DM || {});
  const { mulberry32 } = DM;

  const COLS = 15, ROWS = 11;
  const T_EMPTY = 0, T_WALL = 1, T_SOFT = 2;
  const STAGES = [
    { name: 'SHALLOW TUNNELS', density: 0.4, enemies: { slime: 3, bat: 0, ghost: 0, golem: 0 }, speed: 1.0, time: 150 },
    { name: 'MUSHROOM GROTTO', density: 0.42, enemies: { slime: 3, bat: 2, ghost: 0, golem: 0 }, speed: 1.0, time: 150 },
    { name: 'CRYSTAL VEIN', density: 0.45, enemies: { slime: 2, bat: 2, ghost: 2, golem: 0 }, speed: 1.05, time: 165 },
    { name: 'LAVA DEPTHS', density: 0.45, enemies: { slime: 2, bat: 2, ghost: 2, golem: 1 }, speed: 1.1, time: 180 },
    { name: 'THE DEEP DARK', density: 0.48, enemies: { slime: 0, bat: 3, ghost: 3, golem: 2 }, speed: 1.15, time: 180 },
  ];
  const ENEMY = {
    slime: { speed: 2.0, hp: 1, score: 100 },
    bat: { speed: 3.2, hp: 1, score: 200 },
    ghost: { speed: 2.4, hp: 1, score: 300 },
    golem: { speed: 1.5, hp: 3, score: 500 },
  };
  const ENEMY_ORDER = ['slime', 'bat', 'ghost', 'golem'];
  const DIRS = { up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } };
  const DIR_LIST = ['up', 'down', 'left', 'right'];
  const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const SAFE = [[1, 1], [2, 1], [3, 1], [1, 2], [1, 3], [3, 2], [2, 3]];

  const FUSE = 2.5, FLAME_LIFE = 0.5, DIE_TIME = 1.2, ENEMY_DIE = 0.4, RESPAWN_INV = 2.0, HIT_INV = 0.8;
  const FIXED = 1 / 60;

  const G = (DM.G = {
    COLS, ROWS, STAGES, ENEMY, DIRS, T_EMPTY, T_WALL, T_SOFT, FIXED,
    state: 'title', stateT: 0, animT: 0,
    seedParam: null, seed: 0, startStage: 1, stage: 1,
    score: 0, lives: 3, timeLeft: 150, hi: 0, newRecord: false, runEnded: true, prevBest: 0,
    grid: [], hidden: [], player: null, bombs: [], flames: [], enemies: [], items: [], exit: null,
    breaks: [], particles: [], popups: [], shake: 0, exitFlash: 0, clearBonus: 0, timeBonus: 0,
    rng: null, god: false, warnMark: -1, timeUpDeath: false, reducedMotion: false,
    input: { held: [], buffer: null, bomb: false },
    breakSfxThisTick: false, stageClearAt: 0,
  });

  /* ---------------------------------------------------------------- storage */
  function loadHi() {
    try { const v = parseInt(localStorage.getItem('dynamiteMole.hiScore'), 10); return Number.isFinite(v) && v > 0 ? v : 0; } catch (e) { return 0; }
  }
  function saveHi(v) { try { localStorage.setItem('dynamiteMole.hiScore', String(v)); } catch (e) { /* ignore */ } }
  G.loadMuted = function () { try { return localStorage.getItem('dynamiteMole.muted') === '1'; } catch (e) { return false; } };
  function saveMuted(m) { try { localStorage.setItem('dynamiteMole.muted', m ? '1' : '0'); } catch (e) { /* ignore */ } }

  /* ---------------------------------------------------------------- helpers */
  const sfx = (n) => DM.audio.sfx(n);
  const rnd = () => G.rng();
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const inB = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS;
  const tileOf = (e) => [Math.round(e.x), Math.round(e.y)];
  const bombAt = (c, r) => G.bombs.find((b) => b.col === c && b.row === r);
  G.hiDisplay = () => Math.max(G.hi, G.score);
  G.newPlayerStats = () => ({ maxBombs: 1, range: 2, boots: 0 });

  function newPlayer(prev) {
    const s = prev || G.newPlayerStats();
    return {
      x: 1, y: 1, facing: 'down', alive: true, dieT: 0, inv: 0,
      moving: false, dir: null, prog: 0, fromX: 1, fromY: 1, walkT: 0, dust: 0,
      maxBombs: s.maxBombs, range: s.range, boots: s.boots,
    };
  }
  const playerSpeed = (p) => 4.5 + 0.6 * p.boots;

  /* ---------------------------------------------------------------- stage generation (SPEC 3.3) */
  function generate(seed, s) {
    const st = STAGES[s - 1];
    const rng = mulberry32((seed + s * 7919) >>> 0);
    const grid = [], hidden = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [], hrow = [];
      for (let c = 0; c < COLS; c++) {
        const wall = r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1 || (r % 2 === 0 && c % 2 === 0);
        row.push(wall ? T_WALL : T_EMPTY);
        hrow.push(null);
      }
      grid.push(row); hidden.push(hrow);
    }
    // enemy spawns
    const cand = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (grid[r][c] === T_EMPTY && Math.abs(c - 1) + Math.abs(r - 1) >= 7) cand.push([c, r]);
    const spawns = [];
    for (const type of ENEMY_ORDER) {
      for (let n = 0; n < st.enemies[type]; n++) {
        const i = Math.floor(rng() * cand.length);
        const [c, r] = cand[i];
        spawns.push({ type, col: c, row: r });
        cand.splice(i, 1);
      }
    }
    // rocks
    const blocked = new Set(SAFE.map(([c, r]) => c + ',' + r));
    for (const sp of spawns) {
      blocked.add(sp.col + ',' + sp.row);
      blocked.add(sp.col + 1 + ',' + sp.row); blocked.add(sp.col - 1 + ',' + sp.row);
      blocked.add(sp.col + ',' + (sp.row + 1)); blocked.add(sp.col + ',' + (sp.row - 1));
    }
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== T_EMPTY || blocked.has(c + ',' + r)) continue;
      if (rng() < st.density) grid[r][c] = T_SOFT;
    }
    // exit
    const softs = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (grid[r][c] === T_SOFT) softs.push([c, r]);
    const far = softs.filter(([c, r]) => Math.abs(c - 1) + Math.abs(r - 1) >= 8);
    const pool = far.length ? far : softs;
    const ex = pool[Math.floor(rng() * pool.length)];
    hidden[ex[1]][ex[0]] = 'exit';
    // items
    for (const [c, r] of softs) {
      if (c === ex[0] && r === ex[1]) continue;
      const u = rng();
      if (u < 0.18) {
        const v = rng() * 100;
        hidden[r][c] = v < 35 ? 'fire' : v < 70 ? 'bomb' : v < 90 ? 'boots' : 'life';
      }
    }
    return { grid, hidden, spawns, exit: { col: ex[0], row: ex[1], revealed: false, open: false } };
  }
  DM.generate = generate;

  function makeEnemy(type, col, row) {
    const def = ENEMY[type];
    return {
      type, x: col, y: row, hp: def.hp, alive: true, deathT: 0, hitT: 0,
      moving: false, dir: null, prog: 0, fromX: col, fromY: row, wait: 0,
      speed: def.speed * STAGES[G.stage - 1].speed, anim: Math.random() * 4, chase: false,
    };
  }

  function loadStage(s) {
    G.stage = s;
    const g = generate(G.seed, s);
    G.grid = g.grid; G.hidden = g.hidden; G.exit = g.exit;
    G.enemies = g.spawns.map((sp) => makeEnemy(sp.type, sp.col, sp.row));
    G.bombs = []; G.flames = []; G.items = []; G.breaks = []; G.particles = []; G.popups = [];
    G.timeLeft = STAGES[s - 1].time;
    G.player = newPlayer(G.player ? { maxBombs: G.player.maxBombs, range: G.player.range, boots: G.player.boots } : null);
    G.warnMark = -1; G.timeUpDeath = false; G.shake = 0; G.exitFlash = 0;
    G.input.buffer = null; G.input.bomb = false;
  }

  /* ---------------------------------------------------------------- state machine */
  function setState(s) {
    G.state = s; G.stateT = 0;
    G.input.bomb = false; G.input.buffer = null;
    const A = DM.audio;
    A.bgm = s === 'title' ? 'title' : s === 'playing' || s === 'paused' ? 'stage' + G.stage : null;
    A.paused = s === 'paused';
    A.fast = false;
  }
  G.setState = setState;

  function endRun() {
    if (G.runEnded) return;
    G.runEnded = true;
    G.prevBest = G.hi;
    G.newRecord = G.score > G.hi && G.score > 0;
    if (G.score > G.hi) { G.hi = G.score; saveHi(G.hi); }
  }

  function startRun() {
    endRun();
    G.seed = G.seedParam !== null ? G.seedParam >>> 0 : Math.floor(Math.random() * 4294967296) >>> 0;
    G.rng = mulberry32((G.seed ^ 0xc0ffee) >>> 0);
    G.score = 0; G.lives = 3; G.newRecord = false; G.runEnded = false;
    G.player = null;
    loadStage(G.startStage);
    sfx('start');
    setState('stageIntro');
  }
  G.startRun = startRun;

  function toTitle() {
    endRun();
    setState('title');
  }

  function enterPlaying() {
    setState('playing');
  }

  function enterStageClear() {
    G.clearBonus = 500;
    G.timeBonus = Math.floor(G.timeLeft) * 10;
    G.score += G.clearBonus + G.timeBonus;
    sfx('stageClear');
    setState('stageClear');
  }

  function afterStageClear() {
    if (G.stage >= 5) {
      endRun();
      sfx('gameClear');
      setState('gameClear');
    } else {
      loadStage(G.stage + 1);
      setState('stageIntro');
    }
  }

  function gameOver() {
    endRun();
    sfx('gameOver');
    setState('gameOver');
  }

  G.press = function (code) {
    if (code === 'KeyM') {
      DM.audio.setMuted(!DM.audio.muted);
      saveMuted(DM.audio.muted);
      return;
    }
    const s = G.state;
    const confirm = code === 'Enter' || code === 'Space';
    if (s === 'title') { if (confirm) startRun(); return; }
    if (s === 'stageIntro' || s === 'stageClear') { if (code === 'KeyR') startRun(); return; }
    if (s === 'playing') {
      if (code === 'KeyP' || code === 'Escape') { setState('paused'); sfx('pause'); }
      else if (code === 'KeyR') startRun();
      else if (code === 'Space' || code === 'KeyZ') G.input.bomb = true;
      return;
    }
    if (s === 'paused') {
      if (code === 'KeyP' || code === 'Escape') { setState('playing'); sfx('pause'); }
      else if (code === 'KeyR') startRun();
      return;
    }
    if (s === 'gameOver' || s === 'gameClear') {
      if (G.stateT < 0.6) return;
      if (confirm || code === 'KeyR') startRun();
      else if (code === 'Escape') toTitle();
    }
  };
  G.autoPause = function () {
    if (G.state === 'playing') { setState('paused'); sfx('pause'); }
  };

  /* ---------------------------------------------------------------- effects */
  const fieldPx = (c) => (c + 0.5) * 32;
  function addParticle(p) {
    if (G.particles.length > 420) G.particles.shift();
    G.particles.push(p);
  }
  function debris(col, row) {
    const T = DM.THEMES[G.stage - 1].rock;
    const cols = [T.base, T.hi, T.lo, T.deep];
    for (let i = 0; i < 9; i++) {
      addParticle({ x: fieldPx(col) + (Math.random() - 0.5) * 20, y: 64 + fieldPx(row) + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 150, vy: -60 - Math.random() * 110, g: 420, life: 0.5 + Math.random() * 0.3, max: 0.8, size: 2 + (Math.random() < 0.4 ? 2 : 0), color: cols[i % 4] });
    }
  }
  function sparks(col, row, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 110;
      addParticle({ x: fieldPx(col), y: 64 + fieldPx(row), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, g: 120, life: 0.3 + Math.random() * 0.4, max: 0.7, size: 2, color: ['#ffe45c', '#ffa828', '#fffbe0', '#f2561a'][i % 4] });
    }
  }
  function popup(col, row, text, color) {
    G.popups.push({ x: fieldPx(col), y: 64 + fieldPx(row) - 6, text, t: 0, color: color || '#ffffff' });
  }
  function addShake() {
    if (!G.reducedMotion) G.shake = 0.2;
  }

  /* ---------------------------------------------------------------- rocks / flames / bombs */
  function breakRock(c, r, silent) {
    if (G.grid[r][c] !== T_SOFT) return;
    G.grid[r][c] = T_EMPTY;
    G.breaks.push({ col: c, row: r, t: 0 });
    debris(c, r);
    if (!silent) {
      G.score += 10;
      if (!G.breakSfxThisTick) { G.breakSfxThisTick = true; sfx('break'); }
    }
    const h = G.hidden[r][c];
    G.hidden[r][c] = null;
    if (h === 'exit') G.exit.revealed = true;
    else if (h) G.items.push({ type: h, col: c, row: r, t: 0 });
  }

  function addFlame(c, r, kind, dir) {
    G.flames.push({ col: c, row: r, timeLeft: FLAME_LIFE, kind, dir, born: G.animT });
  }

  function explode(b) {
    const i = G.bombs.indexOf(b);
    if (i < 0) return;
    G.bombs.splice(i, 1);
    sfx('explode');
    addShake();
    sparks(b.col, b.row, 10);
    addFlame(b.col, b.row, 'center', null);
    const chain = [];
    for (const d of DIR_LIST) {
      const { dx, dy } = DIRS[d];
      const tiles = [];
      for (let n = 1; n <= b.range; n++) {
        const c = b.col + dx * n, r = b.row + dy * n;
        if (!inB(c, r) || G.grid[r][c] === T_WALL) break;
        if (G.grid[r][c] === T_SOFT) { breakRock(c, r, false); tiles.push([c, r]); break; }
        tiles.push([c, r]);
        const ob = bombAt(c, r);
        if (ob) chain.push(ob);
      }
      tiles.forEach(([c, r], k) => addFlame(c, r, k === tiles.length - 1 ? 'tip' : 'arm', d));
    }
    for (const ob of chain) { ob.timeLeft = 0; explode(ob); }
  }

  /* ---------------------------------------------------------------- player */
  function chooseInputDir() {
    const inp = G.input;
    let d = null;
    if (inp.buffer) { d = inp.buffer; inp.buffer = null; }
    else if (inp.held.length) d = inp.held[inp.held.length - 1];
    return d;
  }
  function canEnterPlayer(c, r) {
    return inB(c, r) && G.grid[r][c] === T_EMPTY && !bombAt(c, r);
  }
  function movePlayer(dt) {
    const p = G.player, v = playerSpeed(p);
    let time = dt, guard = 0;
    while (time > 1e-9 && guard++ < 8) {
      if (!p.moving) {
        const d = chooseInputDir();
        if (!d) break;
        p.facing = d;
        const c = Math.round(p.x), r = Math.round(p.y);
        if (canEnterPlayer(c + DIRS[d].dx, r + DIRS[d].dy)) {
          p.moving = true; p.dir = d; p.prog = 0; p.fromX = c; p.fromY = r;
        } else { G.input.buffer = null; break; }
      }
      const remain = (1 - p.prog) / v;
      const dd = DIRS[p.dir];
      if (time >= remain) {
        time -= remain;
        p.x = p.fromX + dd.dx; p.y = p.fromY + dd.dy; p.moving = false; p.prog = 0;
        p.walkT += remain;
      } else {
        p.prog += v * time; p.walkT += time; time = 0;
        p.x = p.fromX + dd.dx * p.prog; p.y = p.fromY + dd.dy * p.prog;
      }
    }
    if (p.moving) {
      p.dust -= dt;
      if (p.dust <= 0) {
        p.dust = 0.11;
        addParticle({ x: (p.x + 0.5) * 32 + (Math.random() - 0.5) * 6, y: 64 + (p.y + 0.5) * 32 + 10, vx: (Math.random() - 0.5) * 20, vy: -8 - Math.random() * 10, g: 0, life: 0.35, max: 0.35, size: 2, color: 'dust' });
      }
    }
  }
  function placeBomb() {
    const p = G.player;
    if (!G.input.bomb) return;
    G.input.bomb = false;
    if (!p.alive) return;
    const c = Math.round(p.x), r = Math.round(p.y);
    if (G.bombs.length >= p.maxBombs || bombAt(c, r)) return;
    G.bombs.push({ col: c, row: r, timeLeft: FUSE, range: p.range, t: 0 });
    sfx('place');
  }

  function killPlayer(byTime) {
    const p = G.player;
    if (!p.alive) return;
    p.alive = false; p.dieT = 0;
    G.lives -= 1;
    p.maxBombs = Math.max(1, p.maxBombs - 1);
    p.range = Math.max(2, p.range - 1);
    p.boots = Math.max(0, p.boots - 1);
    G.timeUpDeath = !!byTime;
    G.input.buffer = null; G.input.bomb = false;
    sfx('playerDie');
    sparks(Math.round(p.x), Math.round(p.y), 6);
  }

  /* ---------------------------------------------------------------- enemies */
  const passableEnemy = (c, r) => inB(c, r) && G.grid[r][c] === T_EMPTY && !bombAt(c, r);

  function wander(e, opts) {
    if (e.dir && opts.includes(e.dir) && rnd() >= 0.2) return e.dir;
    const nonRev = e.dir ? opts.filter((d) => d !== OPP[e.dir]) : opts;
    if (nonRev.length) return pick(nonRev);
    if (e.dir && opts.includes(OPP[e.dir])) return OPP[e.dir];
    return null;
  }
  function pickEnemyDir(e) {
    const c = Math.round(e.x), r = Math.round(e.y);
    const opts = DIR_LIST.filter((d) => passableEnemy(c + DIRS[d].dx, r + DIRS[d].dy));
    if (!opts.length) return null;
    const rev = e.dir ? OPP[e.dir] : null;
    if (e.type === 'bat') {
      const nr = opts.filter((d) => d !== rev);
      if (nr.length) return pick(nr);
      return rev && opts.includes(rev) ? rev : null;
    }
    if (e.type === 'ghost') {
      const p = G.player;
      const pc = Math.round(p.x), pr = Math.round(p.y);
      const dist = Math.abs(c - pc) + Math.abs(r - pr);
      e.chase = p.alive && dist <= 6;
      if (e.chase) {
        if (rnd() < 0.25) return wander(e, opts);
        let cands = opts.filter((d) => d !== rev);
        if (!cands.length) cands = opts;
        let best = 1e9, bl = [];
        for (const d of cands) {
          const m = Math.abs(c + DIRS[d].dx - pc) + Math.abs(r + DIRS[d].dy - pr);
          if (m < best) { best = m; bl = [d]; } else if (m === best) bl.push(d);
        }
        return pick(bl);
      }
      return wander(e, opts);
    }
    return wander(e, opts);
  }
  function updateEnemy(e, dt) {
    if (!e.alive) { e.deathT -= dt; return; }
    e.anim += dt;
    if (e.hitT > 0) e.hitT -= dt;
    let time = dt, guard = 0;
    while (time > 1e-9 && guard++ < 10) {
      if (e.wait > 0) { const d = Math.min(e.wait, time); e.wait -= d; time -= d; continue; }
      if (!e.moving) {
        const d = pickEnemyDir(e);
        if (!d) { e.wait = 0.3; continue; }
        e.dir = d; e.moving = true; e.prog = 0; e.fromX = Math.round(e.x); e.fromY = Math.round(e.y);
      }
      const remain = (1 - e.prog) / e.speed, dd = DIRS[e.dir];
      if (time >= remain) {
        time -= remain; e.x = e.fromX + dd.dx; e.y = e.fromY + dd.dy; e.moving = false; e.prog = 0;
      } else {
        e.prog += e.speed * time; time = 0; e.x = e.fromX + dd.dx * e.prog; e.y = e.fromY + dd.dy * e.prog;
      }
    }
  }
  function killEnemy(e) {
    if (!e.alive) return;
    e.alive = false; e.deathT = ENEMY_DIE; e.hp = 0;
    const sc = ENEMY[e.type].score;
    G.score += sc;
    sfx('enemyDie');
    popup(Math.round(e.x), Math.round(e.y), '+' + sc, '#ffe45c');
    sparks(Math.round(e.x), Math.round(e.y), 5);
  }
  const aliveEnemies = () => G.enemies.filter((e) => e.alive).length;

  /* ---------------------------------------------------------------- items / exit */
  function applyItem(it) {
    const p = G.player;
    if (it.type === 'fire') p.range = Math.min(6, p.range + 1);
    else if (it.type === 'bomb') p.maxBombs = Math.min(5, p.maxBombs + 1);
    else if (it.type === 'boots') p.boots = Math.min(3, p.boots + 1);
    else if (it.type === 'life') G.lives = Math.min(5, G.lives + 1);
    G.score += 50;
    sfx(it.type === 'life' ? 'life' : 'item');
    popup(it.col, it.row, it.type === 'life' ? '1UP' : '+50', '#8ae8ff');
    sparks(it.col, it.row, 6);
  }
  function checkExitOpen() {
    if (!G.exit.open && aliveEnemies() === 0) {
      G.exit.open = true;
      G.exitFlash = 0.5;
      sfx('exitOpen');
    }
  }

  /* ---------------------------------------------------------------- update */
  function updateEffects(dt) {
    for (const b of G.breaks) b.t += dt;
    G.breaks = G.breaks.filter((b) => b.t < 0.3);
    for (const p of G.particles) { p.life -= dt; p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    G.particles = G.particles.filter((p) => p.life > 0);
    for (const p of G.popups) p.t += dt;
    G.popups = G.popups.filter((p) => p.t < 0.8);
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt);
    if (G.exitFlash > 0) G.exitFlash = Math.max(0, G.exitFlash - dt);
  }

  function updatePlaying(dt) {
    const p = G.player;
    G.breakSfxThisTick = false;
    // player death animation bookkeeping (timers of the world keep running)
    if (!p.alive) {
      p.dieT += dt;
      if (p.dieT >= DIE_TIME) {
        if (G.lives >= 1) {
          p.x = 1; p.y = 1; p.facing = 'down'; p.alive = true; p.inv = RESPAWN_INV; p.moving = false; p.prog = 0; p.dieT = 0; G.input.buffer = null;
          if (G.timeUpDeath) { G.timeLeft = 60; G.warnMark = -1; }
          G.timeUpDeath = false;
        } else { gameOver(); return; }
      }
    }
    // 1. timer
    if (p.alive) {
      G.timeLeft -= dt;
      if (G.timeLeft <= 0) { G.timeLeft = 0; if (!G.god) killPlayer(true); }
      else if (G.timeLeft <= 10) {
        const sec = Math.ceil(G.timeLeft);
        if (sec !== G.warnMark) { G.warnMark = sec; sfx('warn'); }
      }
    }
    DM.audio.fast = G.timeLeft <= 30;
    // 2. player
    if (p.alive) {
      if (p.inv > 0) p.inv = Math.max(0, p.inv - dt);
      movePlayer(dt);
      placeBomb();
    }
    // 3. bombs
    for (const b of G.bombs) { b.timeLeft -= dt; b.t += dt; }
    for (const b of G.bombs.slice()) if (b.timeLeft <= 0) explode(b);
    // 4. enemies
    for (const e of G.enemies) updateEnemy(e, dt);
    G.enemies = G.enemies.filter((e) => e.alive || e.deathT > 0);
    // 5. flames
    for (const f of G.flames) f.timeLeft -= dt;
    G.flames = G.flames.filter((f) => f.timeLeft > 0);
    // 6. flame hits
    if (G.flames.length) {
      const set = new Set(G.flames.map((f) => f.row * COLS + f.col));
      if (p.alive && p.inv <= 0 && !G.god && set.has(Math.round(p.y) * COLS + Math.round(p.x))) killPlayer(false);
      for (const e of G.enemies) {
        if (!e.alive || e.hitT > 0) continue;
        if (set.has(Math.round(e.y) * COLS + Math.round(e.x))) {
          e.hp -= 1;
          if (e.hp <= 0) killEnemy(e);
          else { e.hitT = HIT_INV; sfx('hit'); sparks(Math.round(e.x), Math.round(e.y), 4); }
        }
      }
    }
    // 7. contact
    if (p.alive && p.inv <= 0 && !G.god) {
      for (const e of G.enemies) {
        if (e.alive && Math.hypot(e.x - p.x, e.y - p.y) < 0.6) { killPlayer(false); break; }
      }
    }
    // 8. items
    if (p.alive) {
      const c = Math.round(p.x), r = Math.round(p.y);
      for (let i = G.items.length - 1; i >= 0; i--) {
        const it = G.items[i];
        if (it.col === c && it.row === r) { G.items.splice(i, 1); applyItem(it); }
      }
    }
    for (const it of G.items) it.t += dt;
    // 9. exit
    checkExitOpen();
    if (G.exit.open && G.exit.revealed && p.alive && Math.round(p.x) === G.exit.col && Math.round(p.y) === G.exit.row) {
      enterStageClear();
      return;
    }
    // 10. effects
    updateEffects(dt);
  }

  G.update = function (dt) {
    G.stateT += dt;
    if (G.state !== 'paused') G.animT += dt;
    switch (G.state) {
      case 'stageIntro':
        updateEffects(dt);
        if (G.stateT >= 1.8) enterPlaying();
        break;
      case 'playing':
        updatePlaying(dt);
        break;
      case 'stageClear':
        updateEffects(dt);
        if (G.stateT >= 3.0) afterStageClear();
        break;
      case 'gameOver': case 'gameClear': case 'title':
        updateEffects(dt);
        break;
      default: break;
    }
  };

  /* ---------------------------------------------------------------- snapshot & debug */
  G.snapshot = function () {
    const p = G.player || newPlayer();
    const A = DM.audio;
    return {
      state: G.state, seed: G.seed, stage: G.stage, score: G.score, hiScore: G.hiDisplay(), lives: G.lives, timeLeft: G.timeLeft,
      player: {
        col: Math.round(p.x), row: Math.round(p.y), x: p.x, y: p.y, facing: p.facing, alive: p.alive, invincible: Math.max(0, p.inv),
        maxBombs: p.maxBombs, activeBombs: G.bombs.length, range: p.range, boots: p.boots, speed: playerSpeed(p),
      },
      bombs: G.bombs.map((b) => ({ col: b.col, row: b.row, timeLeft: b.timeLeft, range: b.range })),
      flames: G.flames.map((f) => ({ col: f.col, row: f.row, timeLeft: f.timeLeft })),
      enemies: G.enemies.map((e) => ({ type: e.type, col: Math.round(e.x), row: Math.round(e.y), x: e.x, y: e.y, hp: e.hp, alive: e.alive })),
      items: G.items.map((i) => ({ type: i.type, col: i.col, row: i.row })),
      exit: { col: G.exit.col, row: G.exit.row, revealed: G.exit.revealed, open: G.exit.open },
      grid: G.grid.map((row) => row.map((t) => (t === T_WALL ? '#' : t === T_SOFT ? 'S' : '.')).join('')),
      texts: DM.texts.slice(),
      audio: { unlocked: A.unlocked, muted: A.muted, bgm: A.bgm, sfxLog: A.sfxLog.map((s) => ({ name: s.name, time: s.time })) },
    };
  };

  G.debug = {
    killAllEnemies() { for (const e of G.enemies) killEnemy(e); checkExitOpen(); },
    revealExit() { if (G.grid[G.exit.row][G.exit.col] === T_SOFT) breakRock(G.exit.col, G.exit.row, true); },
    clearBlocks() { for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) breakRock(c, r, true); },
    teleport(col, row) {
      col = Math.round(col); row = Math.round(row);
      if (!inB(col, row) || G.grid[row][col] === T_WALL) return;
      if (G.grid[row][col] === T_SOFT) breakRock(col, row, true);
      const p = G.player;
      p.x = col; p.y = row; p.moving = false; p.prog = 0; G.input.buffer = null;
    },
    setLives(n) { G.lives = Math.max(1, Math.min(5, Math.round(n))); },
    setTimeLeft(sec) { G.timeLeft = Math.max(0, Number(sec) || 0); G.warnMark = -1; },
    setPowerups(o) {
      const p = G.player; o = o || {};
      if (o.maxBombs !== undefined) p.maxBombs = Math.max(1, Math.min(5, Math.round(o.maxBombs)));
      if (o.range !== undefined) p.range = Math.max(2, Math.min(6, Math.round(o.range)));
      if (o.boots !== undefined) p.boots = Math.max(0, Math.min(3, Math.round(o.boots)));
    },
    spawnItem(type, col, row) {
      if (!['fire', 'bomb', 'boots', 'life'].includes(type) || !inB(col, row) || G.grid[row][col] !== T_EMPTY) return;
      G.items.push({ type, col, row, t: 0 });
    },
    spawnEnemy(type, col, row) {
      if (!ENEMY[type] || !inB(col, row) || G.grid[row][col] !== T_EMPTY) return;
      G.enemies.push(makeEnemy(type, col, row));
    },
    godMode(on) { G.god = !!on; },
  };

  /* ---------------------------------------------------------------- boot */
  G.init = function (params) {
    G.hi = loadHi();
    const s = params.get('seed');
    G.seedParam = s !== null && /^-?\d+$/.test(s) ? Number(s) >>> 0 : null;
    const st = parseInt(params.get('stage'), 10);
    G.startStage = st >= 1 && st <= 5 ? st : 1;
    G.seed = G.seedParam !== null ? G.seedParam : Math.floor(Math.random() * 4294967296) >>> 0;
    G.rng = mulberry32((G.seed ^ 0xc0ffee) >>> 0);
    G.player = null;
    loadStage(G.startStage);
    setState('title');
  };
})();
