// Core constants, RNG and deterministic stage generation.
(function () {
  'use strict';
  var DM = (window.DM = window.DM || {});

  DM.W = 480;
  DM.H = 416;
  DM.COLS = 15;
  DM.ROWS = 11;
  DM.TILE = 32;
  DM.HUD = 64;

  DM.EMPTY = 0;
  DM.WALL = 1;
  DM.SOFT = 2;

  DM.STAGES = [
    { name: 'SHALLOW TUNNELS', density: 0.40, enemies: { slime: 3, bat: 0, ghost: 0, golem: 0 }, mult: 1.00, time: 150 },
    { name: 'MUSHROOM GROTTO', density: 0.42, enemies: { slime: 3, bat: 2, ghost: 0, golem: 0 }, mult: 1.00, time: 150 },
    { name: 'CRYSTAL VEIN', density: 0.45, enemies: { slime: 2, bat: 2, ghost: 2, golem: 0 }, mult: 1.05, time: 165 },
    { name: 'LAVA DEPTHS', density: 0.45, enemies: { slime: 2, bat: 2, ghost: 2, golem: 1 }, mult: 1.10, time: 180 },
    { name: 'THE DEEP DARK', density: 0.48, enemies: { slime: 0, bat: 3, ghost: 3, golem: 2 }, mult: 1.15, time: 180 }
  ];
  DM.ENEMY_ORDER = ['slime', 'bat', 'ghost', 'golem'];
  DM.ENEMY = {
    slime: { speed: 2.0, hp: 1, score: 100 },
    bat: { speed: 3.2, hp: 1, score: 200 },
    ghost: { speed: 2.4, hp: 1, score: 300 },
    golem: { speed: 1.5, hp: 3, score: 500 }
  };

  DM.DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  DM.DIR_LIST = ['up', 'down', 'left', 'right'];
  DM.REVERSE = { up: 'down', down: 'up', left: 'right', right: 'left' };

  DM.SAFE = [[1, 1], [2, 1], [3, 1], [1, 2], [1, 3], [3, 2], [2, 3]];

  DM.mulberry32 = function (seed) {
    var state = seed >>> 0;
    return function () {
      state = (state + 0x6D2B79F5) >>> 0;
      var t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  DM.isWallCell = function (c, r) {
    return r === 0 || r === 10 || c === 0 || c === 14 || (r % 2 === 0 && c % 2 === 0);
  };

  function isSafe(c, r) {
    for (var i = 0; i < DM.SAFE.length; i++) if (DM.SAFE[i][0] === c && DM.SAFE[i][1] === r) return true;
    return false;
  }

  // Returns { grid[r][c], enemies:[{type,c,r}], exit:{c,r}, hidden:{ 'c,r': type } }
  DM.generateStage = function (seed, s) {
    var rng = DM.mulberry32(((seed >>> 0) + s * 7919) >>> 0);
    var st = DM.STAGES[s - 1];
    var grid = [];
    var r, c, i;
    for (r = 0; r < DM.ROWS; r++) {
      var row = [];
      for (c = 0; c < DM.COLS; c++) row.push(DM.isWallCell(c, r) ? DM.WALL : DM.EMPTY);
      grid.push(row);
    }
    // 2. enemy spawns
    var cand = [];
    for (r = 0; r < DM.ROWS; r++)
      for (c = 0; c < DM.COLS; c++)
        if (grid[r][c] === DM.EMPTY && Math.abs(c - 1) + Math.abs(r - 1) >= 7) cand.push([c, r]);
    var enemies = [];
    DM.ENEMY_ORDER.forEach(function (type) {
      for (var k = 0; k < st.enemies[type]; k++) {
        var idx = Math.floor(rng() * cand.length);
        var p = cand.splice(idx, 1)[0];
        enemies.push({ type: type, c: p[0], r: p[1] });
      }
    });
    function nearEnemy(cc, rr) {
      for (var j = 0; j < enemies.length; j++) {
        var e = enemies[j];
        if (Math.abs(e.c - cc) + Math.abs(e.r - rr) <= 1) return true;
      }
      return false;
    }
    // 3. soft rocks
    for (r = 0; r < DM.ROWS; r++)
      for (c = 0; c < DM.COLS; c++) {
        if (grid[r][c] !== DM.EMPTY) continue;
        if (isSafe(c, r)) continue;
        if (nearEnemy(c, r)) continue;
        if (rng() < st.density) grid[r][c] = DM.SOFT;
      }
    var soft = [];
    for (r = 0; r < DM.ROWS; r++)
      for (c = 0; c < DM.COLS; c++) if (grid[r][c] === DM.SOFT) soft.push([c, r]);
    // 4. exit
    var far = soft.filter(function (p) { return Math.abs(p[0] - 1) + Math.abs(p[1] - 1) >= 8; });
    var pool = far.length ? far : soft;
    var exit;
    if (pool.length) {
      var ep = pool[Math.floor(rng() * pool.length)];
      exit = { c: ep[0], r: ep[1] };
    } else {
      exit = { c: 13, r: 9 }; // degenerate fallback (no rocks at all)
    }
    // 5. items
    var hidden = {};
    for (i = 0; i < soft.length; i++) {
      var sp = soft[i];
      if (sp[0] === exit.c && sp[1] === exit.r) continue;
      var u = rng();
      if (u < 0.18) {
        var v = rng() * 100;
        hidden[sp[0] + ',' + sp[1]] = v < 35 ? 'fire' : v < 70 ? 'bomb' : v < 90 ? 'boots' : 'life';
      }
    }
    return { grid: grid, enemies: enemies, exit: exit, hidden: hidden };
  };
})();
