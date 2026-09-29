/* node tools/verify-all.js
 * Runs every verification script in sequence and prints one summary line per script.
 * Prerequisite: the static server on :5105 (cd games/dynamite-mole/impl/max && python3 -m http.server 5105)
 * and a global Playwright install (PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers). */
'use strict';
const path = require('path');
const cp = require('child_process');
const steps = [
  ['static checks (ES2020, no fillText, relative paths ...)', ['check-static.js']],
  ['level generation invariants (Node only)', ['test-level.js']],
  ['audio: peak levels / lengths / loops (offline render)', ['verify-audio.js']],
  ['art: build time, theme hues (M28)', ['measure-art.js']],
  ['A: boot, layout, map, movement, bombs (M1-M15)', ['verify-a.js']],
  ['B: death, enemies, items, exit, full run (M16-M28)', ['verify-b.js']],
  ['C: timer, pause, restart, save, audio state, throttle, hooks (M29-M40)', ['verify-c.js']],
  ['D: Should items S1-S15 (touch, effects, warnings ...)', ['verify-d.js']],
  ['fuzz (random input), seed 3', ['fuzz.js', '45', '3']],
  ['fuzz (random input), seed 4', ['fuzz.js', '45', '4']]
];
const summary = [];
steps.forEach(([title, args]) => {
  console.log('\n######## ' + title);
  const t0 = Date.now();
  const r = cp.spawnSync('node', [path.join(__dirname, args[0])].concat(args.slice(1)), { stdio: 'inherit', env: Object.assign({}, process.env) });
  summary.push([title, r.status === 0 ? 'OK ' : 'FAIL', ((Date.now() - t0) / 1000).toFixed(0) + ' s']);
});
console.log('\n================ SUMMARY ================');
summary.forEach((s) => console.log(s[1] + '  ' + s[2].padStart(6) + '  ' + s[0]));
process.exit(summary.some((s) => s[1] !== 'OK ') ? 1 : 0);
