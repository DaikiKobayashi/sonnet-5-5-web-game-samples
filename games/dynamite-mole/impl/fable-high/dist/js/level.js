/* Dynamite Mole - deterministic stage generation (spec 3.3). */
var Level = (function () {
  'use strict';

  var COLS = 15, ROWS = 11;
  var WALL = '#', SOFT = 'S', EMPTY = '.';

  var STAGES = [
    { n: 1, name: 'SHALLOW TUNNELS', density: 0.40, enemies: { slime: 3, bat: 0, ghost: 0, golem: 0 }, speedMul: 1.00, time: 150 },
    { n: 2, name: 'MUSHROOM GROTTO', density: 0.42, enemies: { slime: 3, bat: 2, ghost: 0, golem: 0 }, speedMul: 1.00, time: 150 },
    { n: 3, name: 'CRYSTAL VEIN', density: 0.45, enemies: { slime: 2, bat: 2, ghost: 2, golem: 0 }, speedMul: 1.05, time: 165 },
    { n: 4, name: 'LAVA DEPTHS', density: 0.45, enemies: { slime: 2, bat: 2, ghost: 2, golem: 1 }, speedMul: 1.10, time: 180 },
    { n: 5, name: 'THE DEEP DARK', density: 0.48, enemies: { slime: 0, bat: 3, ghost: 3, golem: 2 }, speedMul: 1.15, time: 180 }
  ];

  function mulberry32(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function isWall(c, r) {
    return r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1 || (r % 2 === 0 && c % 2 === 0);
  }

  var SAFE = { '1,1': 1, '2,1': 1, '3,1': 1, '1,2': 1, '1,3': 1, '3,2': 1, '2,3': 1 };

  function generate(seed, stageNo) {
    var st = STAGES[stageNo - 1];
    var rng = mulberry32((seed + stageNo * 7919) >>> 0);
    var grid = [];
    var r, c;
    for (r = 0; r < ROWS; r++) {
      grid.push([]);
      for (c = 0; c < COLS; c++) grid[r].push(isWall(c, r) ? WALL : EMPTY);
    }
    // 2. enemy spawns
    var cand = [];
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
      if (grid[r][c] === EMPTY && Math.abs(c - 1) + Math.abs(r - 1) >= 7) cand.push({ col: c, row: r });
    }
    var spawns = [];
    var order = ['slime', 'bat', 'ghost', 'golem'];
    for (var k = 0; k < order.length; k++) {
      var type = order[k];
      for (var n = 0; n < st.enemies[type]; n++) {
        var i = Math.floor(rng() * cand.length);
        var p = cand.splice(i, 1)[0];
        spawns.push({ type: type, col: p.col, row: p.row });
      }
    }
    var blocked = {};
    spawns.forEach(function (s) {
      blocked[s.col + ',' + s.row] = 1;
      blocked[(s.col + 1) + ',' + s.row] = 1;
      blocked[(s.col - 1) + ',' + s.row] = 1;
      blocked[s.col + ',' + (s.row + 1)] = 1;
      blocked[s.col + ',' + (s.row - 1)] = 1;
    });
    // 3. soft rocks
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
      if (grid[r][c] !== EMPTY) continue;
      var key = c + ',' + r;
      if (SAFE[key] || blocked[key]) continue;
      if (rng() < st.density) grid[r][c] = SOFT;
    }
    // 4. exit
    var far = [], all = [];
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
      if (grid[r][c] !== SOFT) continue;
      all.push({ col: c, row: r });
      if (Math.abs(c - 1) + Math.abs(r - 1) >= 8) far.push({ col: c, row: r });
    }
    var pool = far.length ? far : all;
    var exit = pool.length ? pool[Math.floor(rng() * pool.length)] : { col: 13, row: 9 };
    // 5. hidden items
    var items = {};
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
      if (grid[r][c] !== SOFT) continue;
      if (c === exit.col && r === exit.row) continue;
      var u = rng();
      if (u < 0.18) {
        var v = rng() * 100;
        var t = v < 35 ? 'fire' : (v < 70 ? 'bomb' : (v < 90 ? 'boots' : 'life'));
        items[c + ',' + r] = t;
      }
    }
    return { stage: st, grid: grid, spawns: spawns, exit: { col: exit.col, row: exit.row }, hiddenItems: items };
  }

  return { COLS: COLS, ROWS: ROWS, WALL: WALL, SOFT: SOFT, EMPTY: EMPTY, STAGES: STAGES, mulberry32: mulberry32, isWall: isWall, generate: generate };
})();
