/* Node-only sanity test of level generation (no dependencies).
 *   node tools/test-level.js
 */
'use strict';
var path = require('path');
global.window = undefined;
require(path.join(__dirname, '..', 'dist', 'js', 'util.js'));
require(path.join(__dirname, '..', 'dist', 'js', 'level.js'));
var DM = globalThis.DM;

var fails = 0;
function check(cond, msg) { if (!cond) { fails++; console.log('FAIL: ' + msg); } }

/* mulberry32 reference values (computed independently with the canonical formulation) */
function refMulberry(a) {
  return function () {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
[0, 1, 12345, 4294967295, 0xC0FFEE].forEach(function (seed) {
  var a = DM.mulberry32(seed), b = refMulberry(seed);
  for (var i = 0; i < 1000; i++) {
    var x = a(), y = b();
    if (x !== y) { check(false, 'rng mismatch seed ' + seed + ' i=' + i + ' ' + x + ' vs ' + y); break; }
    if (!(x >= 0 && x < 1)) { check(false, 'rng range'); break; }
  }
});

var SAFE = ['1,1', '2,1', '3,1', '1,2', '1,3', '3,2', '2,3'];
var seeds = [];
for (var k = 0; k < 300; k++) seeds.push((k * 2654435761) >>> 0);
seeds.push(0, 1, 42, 4294967295);

seeds.forEach(function (seed) {
  for (var st = 1; st <= 5; st++) {
    var lv = DM.generateLevel(seed, st);
    var def = DM.STAGES[st - 1];
    var g = lv.grid;
    check(g.length === 11, 'rows');
    for (var r = 0; r < 11; r++) {
      check(g[r].length === 15, 'cols');
      for (var c = 0; c < 15; c++) {
        var wall = r === 0 || r === 10 || c === 0 || c === 14 || (r % 2 === 0 && c % 2 === 0);
        if (wall) check(g[r][c] === '#', 'wall at ' + c + ',' + r);
        else check(g[r][c] !== '#', 'non-wall # at ' + c + ',' + r);
      }
    }
    SAFE.forEach(function (k2) {
      var p = k2.split(',').map(Number);
      check(g[p[1]][p[0]] !== 'S', 'safe zone ' + k2 + ' seed ' + seed + ' st ' + st);
    });
    var counts = { slime: 0, bat: 0, ghost: 0, golem: 0 };
    var seen = {};
    lv.enemies.forEach(function (e) {
      counts[e.type]++;
      check(Math.abs(e.col - 1) + Math.abs(e.row - 1) >= 7, 'enemy dist');
      check(g[e.row][e.col] === '.', 'enemy on rock/wall');
      var kk = e.col + ',' + e.row;
      check(!seen[kk], 'enemy overlap');
      seen[kk] = 1;
    });
    ['slime', 'bat', 'ghost', 'golem'].forEach(function (t) { check(counts[t] === def.enemies[t], 'enemy count ' + t); });
    check(g[lv.exit.row][lv.exit.col] === 'S', 'exit under rock');
    Object.keys(lv.hidden).forEach(function (k3) {
      var p = k3.split(',').map(Number);
      check(g[p[1]][p[0]] === 'S', 'item under rock');
      check(!(p[0] === lv.exit.col && p[1] === lv.exit.row), 'item on exit');
    });
    /* determinism */
    var lv2 = DM.generateLevel(seed, st);
    check(JSON.stringify(lv) === JSON.stringify(lv2), 'deterministic');
  }
});

/* print one sample for eyeballing */
var s = DM.generateLevel(12345, 1);
console.log(s.grid.map(function (r) { return r.join(''); }).join('\n'));
console.log('exit', s.exit, 'enemies', JSON.stringify(s.enemies), 'items', JSON.stringify(s.hidden));
var diff = DM.generateLevel(1, 1).grid.map(function (r) { return r.join(''); }).join('|') !== DM.generateLevel(2, 1).grid.map(function (r) { return r.join(''); }).join('|');
check(diff, 'different seeds differ');
console.log(fails ? ('FAILED ' + fails) : 'level tests OK');
process.exit(fails ? 1 : 0);
