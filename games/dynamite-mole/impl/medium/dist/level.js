/* Deterministic level generation (SPEC 3.3). */
(function () {
  var COLS = 15, ROWS = 11;

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

  var STAGES = [
    { name: 'SHALLOW TUNNELS', density: 0.40, enemies: { slime: 3, bat: 0, ghost: 0, golem: 0 }, mult: 1.00, time: 150 },
    { name: 'MUSHROOM GROTTO', density: 0.42, enemies: { slime: 3, bat: 2, ghost: 0, golem: 0 }, mult: 1.00, time: 150 },
    { name: 'CRYSTAL VEIN', density: 0.45, enemies: { slime: 2, bat: 2, ghost: 2, golem: 0 }, mult: 1.05, time: 165 },
    { name: 'LAVA DEPTHS', density: 0.45, enemies: { slime: 2, bat: 2, ghost: 2, golem: 1 }, mult: 1.10, time: 180 },
    { name: 'THE DEEP DARK', density: 0.48, enemies: { slime: 0, bat: 3, ghost: 3, golem: 2 }, mult: 1.15, time: 180 }
  ];
  var ENEMY_ORDER = ['slime', 'bat', 'ghost', 'golem'];
  var SAFE = { '1,1': 1, '2,1': 1, '3,1': 1, '1,2': 1, '1,3': 1, '3,2': 1, '2,3': 1 };

  function isWall(c, r) {
    return r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1 || (r % 2 === 0 && c % 2 === 0);
  }

  function generate(seed, s) {
    var st = STAGES[s - 1];
    var rng = mulberry32(((seed >>> 0) + s * 7919) >>> 0);
    var grid = [], r, c;
    for (r = 0; r < ROWS; r++) { grid.push([]); for (c = 0; c < COLS; c++) grid[r].push(isWall(c, r) ? '#' : '.'); }
    // enemies
    var cand = [];
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
      if (grid[r][c] === '.' && Math.abs(c - 1) + Math.abs(r - 1) >= 7) cand.push([c, r]);
    }
    var enemies = [], nearSpawn = {};
    ENEMY_ORDER.forEach(function (t) {
      for (var n = 0; n < st.enemies[t]; n++) {
        var i = Math.floor(rng() * cand.length);
        var p = cand.splice(i, 1)[0];
        enemies.push({ type: t, col: p[0], row: p[1] });
        nearSpawn[p[0] + ',' + p[1]] = 1;
        nearSpawn[(p[0] + 1) + ',' + p[1]] = 1; nearSpawn[(p[0] - 1) + ',' + p[1]] = 1;
        nearSpawn[p[0] + ',' + (p[1] + 1)] = 1; nearSpawn[p[0] + ',' + (p[1] - 1)] = 1;
      }
    });
    // rocks
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
      if (grid[r][c] !== '.') continue;
      var k = c + ',' + r;
      if (SAFE[k] || nearSpawn[k]) continue;
      if (rng() < st.density) grid[r][c] = 'S';
    }
    // exit
    var far = [], all = [];
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
      if (grid[r][c] === 'S') { all.push([c, r]); if (Math.abs(c - 1) + Math.abs(r - 1) >= 8) far.push([c, r]); }
    }
    var pool = far.length ? far : all;
    var ex = pool.length ? pool[Math.floor(rng() * pool.length)] : [13, 9];
    // items
    var hidden = {};
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
      if (grid[r][c] !== 'S' || (c === ex[0] && r === ex[1])) continue;
      var u = rng();
      if (u < 0.18) {
        var v = rng() * 100;
        hidden[c + ',' + r] = v < 35 ? 'fire' : v < 70 ? 'bomb' : v < 90 ? 'boots' : 'life';
      }
    }
    return { grid: grid, hidden: hidden, exit: { col: ex[0], row: ex[1] }, enemies: enemies };
  }

  window.Level = { COLS: COLS, ROWS: ROWS, STAGES: STAGES, mulberry32: mulberry32, generate: generate, isWall: isWall };
})();
