/* level.js - stage table and deterministic stage generation (spec 3.3 / 3.11) */
(function (root) {
  'use strict';
  var DM = root.DM = root.DM || {};
  var COLS = 15, ROWS = 11;

  DM.STAGES = [
    { name: 'SHALLOW TUNNELS', density: 0.40, enemies: { slime: 3, bat: 0, ghost: 0, golem: 0 }, speedMul: 1.00, time: 150 },
    { name: 'MUSHROOM GROTTO', density: 0.42, enemies: { slime: 3, bat: 2, ghost: 0, golem: 0 }, speedMul: 1.00, time: 150 },
    { name: 'CRYSTAL VEIN',    density: 0.45, enemies: { slime: 2, bat: 2, ghost: 2, golem: 0 }, speedMul: 1.05, time: 165 },
    { name: 'LAVA DEPTHS',     density: 0.45, enemies: { slime: 2, bat: 2, ghost: 2, golem: 1 }, speedMul: 1.10, time: 180 },
    { name: 'THE DEEP DARK',   density: 0.48, enemies: { slime: 0, bat: 3, ghost: 3, golem: 2 }, speedMul: 1.15, time: 180 }
  ];
  DM.ENEMY_ORDER = ['slime', 'bat', 'ghost', 'golem'];

  DM.enemyTotal = function (stage) {
    var e = DM.STAGES[stage - 1].enemies;
    return e.slime + e.bat + e.ghost + e.golem;
  };

  function isWall(c, r) {
    return r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1 || (r % 2 === 0 && c % 2 === 0);
  }
  DM.isFixedWall = isWall;

  /* safe zone (col,row) */
  var SAFE = { '1,1': 1, '2,1': 1, '3,1': 1, '1,2': 1, '1,3': 1, '3,2': 1, '2,3': 1 };

  /*
   * generateLevel(seed, stage) -> {
   *   grid: [ROWS][COLS] of '#','S','.',
   *   enemies: [{type,col,row}],
   *   exit: {col,row},
   *   hidden: { 'col,row': 'fire'|'bomb'|'boots'|'life' }
   * }
   */
  DM.generateLevel = function (seed, stage) {
    var def = DM.STAGES[stage - 1];
    var rng = DM.mulberry32(((seed >>> 0) + stage * 7919) >>> 0);
    var r, c, i;

    /* 1. fixed terrain */
    var grid = [];
    for (r = 0; r < ROWS; r++) {
      var row = [];
      for (c = 0; c < COLS; c++) row.push(isWall(c, r) ? '#' : '.');
      grid.push(row);
    }

    /* 2. enemy spawns */
    var cand = [];
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        if (grid[r][c] === '.' && Math.abs(c - 1) + Math.abs(r - 1) >= 7) cand.push([c, r]);
      }
    }
    var enemies = [];
    DM.ENEMY_ORDER.forEach(function (type) {
      for (var n = 0; n < def.enemies[type]; n++) {
        var idx = Math.floor(rng() * cand.length);
        var p = cand[idx];
        cand.splice(idx, 1);
        enemies.push({ type: type, col: p[0], row: p[1] });
      }
    });

    /* 3. soft rocks */
    var blocked = {};
    enemies.forEach(function (e) {
      blocked[e.col + ',' + e.row] = 1;
      blocked[(e.col + 1) + ',' + e.row] = 1;
      blocked[(e.col - 1) + ',' + e.row] = 1;
      blocked[e.col + ',' + (e.row + 1)] = 1;
      blocked[e.col + ',' + (e.row - 1)] = 1;
    });
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        if (grid[r][c] !== '.') continue;
        var key = c + ',' + r;
        if (SAFE[key] || blocked[key]) continue;
        if (rng() < def.density) grid[r][c] = 'S';
      }
    }

    /* 4. exit */
    var softs = [];
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) if (grid[r][c] === 'S') softs.push([c, r]);
    var far = softs.filter(function (p) { return Math.abs(p[0] - 1) + Math.abs(p[1] - 1) >= 8; });
    var pool = far.length ? far : softs;
    var ex = pool[Math.floor(rng() * pool.length)];
    var exit = { col: ex[0], row: ex[1] };

    /* 5. hidden items */
    var hidden = {};
    for (i = 0; i < softs.length; i++) {
      var s = softs[i];
      if (s[0] === exit.col && s[1] === exit.row) continue;
      var u = rng();
      if (u < 0.18) {
        var v = rng() * 100;
        var type = v < 35 ? 'fire' : (v < 70 ? 'bomb' : (v < 90 ? 'boots' : 'life'));
        hidden[s[0] + ',' + s[1]] = type;
      }
    }

    return { grid: grid, enemies: enemies, exit: exit, hidden: hidden };
  };
})(typeof window !== 'undefined' ? window : globalThis);
