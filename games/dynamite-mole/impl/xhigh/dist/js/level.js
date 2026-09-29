/* level.js - stage table and the deterministic stage generator (SPEC 3.3). */
(function () {
  'use strict';
  var DM = window.DM;

  DM.COLS = 15;
  DM.ROWS = 11;

  DM.STAGES = [
    { name: 'SHALLOW TUNNELS', density: 0.4, enemies: { slime: 3, bat: 0, ghost: 0, golem: 0 }, mult: 1.0, time: 150 },
    { name: 'MUSHROOM GROTTO', density: 0.42, enemies: { slime: 3, bat: 2, ghost: 0, golem: 0 }, mult: 1.0, time: 150 },
    { name: 'CRYSTAL VEIN', density: 0.45, enemies: { slime: 2, bat: 2, ghost: 2, golem: 0 }, mult: 1.05, time: 165 },
    { name: 'LAVA DEPTHS', density: 0.45, enemies: { slime: 2, bat: 2, ghost: 2, golem: 1 }, mult: 1.1, time: 180 },
    { name: 'THE DEEP DARK', density: 0.48, enemies: { slime: 0, bat: 3, ghost: 3, golem: 2 }, mult: 1.15, time: 180 }
  ];
  DM.ENEMY_ORDER = ['slime', 'bat', 'ghost', 'golem'];
  DM.ENEMY_DEF = {
    slime: { speed: 2.0, hp: 1, score: 100 },
    bat: { speed: 3.2, hp: 1, score: 200 },
    ghost: { speed: 2.4, hp: 1, score: 300 },
    golem: { speed: 1.5, hp: 3, score: 500 }
  };

  var EMPTY = 0, WALL = 1, SOFT = 2;
  DM.EMPTY = EMPTY;
  DM.WALL = WALL;
  DM.SOFT = SOFT;

  function isWall(col, row) {
    return row === 0 || row === 10 || col === 0 || col === 14 || (row % 2 === 0 && col % 2 === 0);
  }
  DM.isFixedWall = isWall;

  var SAFE = { '1,1': 1, '2,1': 1, '3,1': 1, '1,2': 1, '1,3': 1, '3,2': 1, '2,3': 1 };

  /* returns { grid[row][col], spawns:[{type,col,row}], exit:{col,row}, hidden:{"c,r":type} } */
  DM.generateLevel = function (seed, stage) {
    var def = DM.STAGES[stage - 1];
    var rng = DM.mulberry32(((seed >>> 0) + stage * 7919) >>> 0);
    var grid = [];
    var r, c;
    for (r = 0; r < DM.ROWS; r++) {
      var row = [];
      for (c = 0; c < DM.COLS; c++) row.push(isWall(c, r) ? WALL : EMPTY);
      grid.push(row);
    }

    /* 2. enemy spawns */
    var cands = [];
    for (r = 0; r < DM.ROWS; r++)
      for (c = 0; c < DM.COLS; c++) if (grid[r][c] === EMPTY && Math.abs(c - 1) + Math.abs(r - 1) >= 7) cands.push([c, r]);
    var spawns = [];
    var spawnKey = {};
    DM.ENEMY_ORDER.forEach(function (type) {
      for (var n = 0; n < def.enemies[type]; n++) {
        var i = Math.floor(rng() * cands.length);
        var p = cands.splice(i, 1)[0];
        spawns.push({ type: type, col: p[0], row: p[1] });
        spawnKey[p[0] + ',' + p[1]] = 1;
      }
    });
    function nearSpawn(cc, rr) {
      return (
        spawnKey[cc + ',' + rr] || spawnKey[cc + 1 + ',' + rr] || spawnKey[cc - 1 + ',' + rr] || spawnKey[cc + ',' + (rr + 1)] || spawnKey[cc + ',' + (rr - 1)]
      );
    }

    /* 3. rocks */
    for (r = 0; r < DM.ROWS; r++)
      for (c = 0; c < DM.COLS; c++) {
        if (grid[r][c] !== EMPTY) continue;
        if (SAFE[c + ',' + r]) continue;
        if (nearSpawn(c, r)) continue;
        if (rng() < def.density) grid[r][c] = SOFT;
      }

    /* 4. exit */
    var softs = [];
    for (r = 0; r < DM.ROWS; r++) for (c = 0; c < DM.COLS; c++) if (grid[r][c] === SOFT) softs.push([c, r]);
    var far = softs.filter(function (p) {
      return Math.abs(p[0] - 1) + Math.abs(p[1] - 1) >= 8;
    });
    if (!softs.length) {
      /* practically unreachable (density >= 0.4); keep the exit-under-a-rock invariant anyway */
      grid[9][13] = SOFT;
      softs.push([13, 9]);
    }
    var pool = far.length ? far : softs;
    var ex = pool[Math.floor(rng() * pool.length)];
    var exit = { col: ex[0], row: ex[1] };

    /* 5. hidden items */
    var hidden = {};
    softs.forEach(function (p) {
      if (p[0] === exit.col && p[1] === exit.row) return;
      var u = rng();
      if (u < 0.18) {
        var v = rng() * 100;
        hidden[p[0] + ',' + p[1]] = v < 35 ? 'fire' : v < 70 ? 'bomb' : v < 90 ? 'boots' : 'life';
      }
    });

    return { grid: grid, spawns: spawns, exit: exit, hidden: hidden };
  };
})();
