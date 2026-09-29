// Node unit checks for the pure simulation layer (no browser needed).
// Run: node tools/simtest.mjs
import { Sim } from '../dist/js/sim.js';
import { STAGES } from '../dist/js/config.js';

let fails = 0;
function check(name, cond, info = '') {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : ''));
  if (!cond) fails++;
}
const near = (v, lo, hi) => v >= lo && v <= hi;

function mk(seed = 42, stage = 1) {
  const s = new Sim({ seed, startStage: stage, best: 0 });
  s.startRun();
  return s;
}
function runSteps(s, n) { for (let i = 0; i < n; i++) s.step(); }
function toPlaying(s) {
  runSteps(s, 180);
  return s;
}

// course tables
for (const st of STAGES) {
  const total = st.sections.reduce((a, b) => a + b[0], 0);
  check('stage ' + st.id + ' sections sum to N', total === st.N, total + ' vs ' + st.N);
}

// countdown
{
  const s = mk();
  check('countdown scene at start', s.scene === 'countdown');
  s.input.up = true;
  runSteps(s, 179);
  check('still countdown after 179 steps', s.scene === 'countdown');
  check('speed 0 during countdown', s.speed === 0);
  check('timeLeft untouched during countdown', s.timeLeft === 30);
  runSteps(s, 1);
  check('playing after 180 steps', s.scene === 'playing');
}

// time
{
  const s = toPlaying(mk());
  runSteps(s, 300);
  check('timeLeft 25.0 after 5 s', Math.abs(s.timeLeft - 25) < 0.02, String(s.timeLeft));
}

// accel 3 s
{
  const s = toPlaying(mk());
  s.input.up = true;
  runSteps(s, 180);
  const kmh = s.speed / 40;
  check('accel: 180 km/h after 3 s', near(kmh, 178, 182), kmh.toFixed(2));
  s.debugSetSpeedKmh(299);
  for (const c of s.traffic) c.hit = true;
  for (const o of s.roadside) o.hit = true;
  for (let i = 0; i < 120; i++) { s.debugSetPlayerX(0); s.step(); }
  check('speed capped at 300', s.speed / 40 <= 300.0001 && s.speed / 40 > 299.9, (s.speed / 40).toFixed(3));
}

// brake
{
  const s = toPlaying(mk());
  s.debugSetSpeedKmh(200);
  s.input.down = true;
  runSteps(s, 60);
  const kmh = s.speed / 40;
  check('brake: -150 km/h in 1 s', near(200 - kmh, 148, 152), (200 - kmh).toFixed(2));
}

// coast
{
  const s = toPlaying(mk());
  s.debugSetSpeedKmh(200);
  runSteps(s, 120);
  const kmh = s.speed / 40;
  check('coast: 110 km/h after 2 s', near(kmh, 108, 112), kmh.toFixed(2));
}

// steering at speed 0 does nothing
{
  const s = toPlaying(mk());
  s.input.right = true;
  runSteps(s, 30);
  check('no steering at speed 0', s.playerX === 0);
  s.debugSetSpeedKmh(100);
  s.input.up = true;
  runSteps(s, 30);
  check('steering right increases playerX', s.playerX > 0.1, s.playerX.toFixed(3));
  s.input.right = false;
  s.input.left = true;
  const x0 = s.playerX;
  runSteps(s, 30);
  check('steering left decreases playerX', s.playerX < x0);
}

// centrifugal
{
  const s = toPlaying(mk(7));
  s.debugWarp(765);
  s.debugSetSpeedKmh(200);
  s.input.up = true;
  // remove traffic influence: no cars near 765 m likely, but disable crash by making all hit
  for (const c of s.traffic) c.hit = true;
  for (const o of s.roadside) o.hit = true;
  runSteps(s, 60);
  check('centrifugal: playerX <= -0.5 after 1 s', s.playerX <= -0.5, s.playerX.toFixed(3));
}

// offroad
{
  const s = toPlaying(mk(7));
  for (const c of s.traffic) c.hit = true;
  for (const o of s.roadside) o.hit = true;
  s.debugSetPlayerX(1.05);
  s.input.up = true;
  // hold playerX with a tiny corrective: only test on the straight start (curve 0 for first 100 segs)
  runSteps(s, 180);
  const kmh = s.speed / 40;
  check('offroad: settles near 75 km/h', near(kmh, 70, 80), kmh.toFixed(2) + ' playerX=' + s.playerX.toFixed(3));
}

// checkpoint
{
  const s = toPlaying(mk(3));
  for (const c of s.traffic) c.hit = true;
  s.debugWarp(990);
  s.debugSetSpeedKmh(200);
  s.input.up = true;
  const t0 = s.timeLeft, sc0 = s.scoreInt;
  runSteps(s, 60);
  check('checkpoint: passed count 1', s.checkpointsPassed === 1);
  check('checkpoint: +18 s', s.timeLeft > t0 + 16, s.timeLeft.toFixed(2));
  check('checkpoint: +500 score', s.scoreInt - sc0 >= 500, String(s.scoreInt - sc0));
}

// goal + bonuses
{
  const s = toPlaying(mk(3));
  for (const c of s.traffic) c.hit = true;
  for (const o of s.roadside) o.hit = true;
  s.debugWarp(2950);
  s.debugSetSpeedKmh(200);
  s.input.up = true;
  s.debugSetTime(23.5);
  const sc0 = s.scoreInt;
  let guard = 0;
  while (s.scene === 'playing' && guard++ < 600) s.step();
  check('goal: stageclear', s.scene === 'stageclear', s.scene);
  const gain = s.scoreInt - sc0;
  const expectBonus = 100 * s.clear.timeLeft + 1000;
  check('goal: gain = 100*floor(time)+1000+distance', gain >= expectBonus && gain < expectBonus + 60, gain + ' vs ' + expectBonus + ' timeLeft=' + s.clear.timeLeft);
  runSteps(s, 89);
  check('confirm ignored before panel', s.confirm() === false);
  runSteps(s, 1);
  check('confirm works after 1.5 s', s.confirm() === true && s.scene === 'countdown' && s.stage === 2);
  const g = s.getState();
  check('stage 2 goalRemainingM ~3594', near(g.goalRemainingM, 3592, 3596), g.goalRemainingM.toFixed(1));
  check('stage 2 timeLeft 32', g.timeLeft === 32);
  check('stage 2 trafficTotal 54', g.trafficTotal === 54);
  check('score carried to stage 2', g.score === s.scoreInt && g.score > 3000);
}

// time up
{
  const s = toPlaying(mk(3));
  s.debugSetTime(2);
  let guard = 0;
  while (s.scene === 'playing' && guard++ < 600) s.step();
  check('timeup scene', s.scene === 'timeup', s.scene);
  runSteps(s, 149);
  check('still timeup until 2.5 s', s.scene === 'timeup', s.scene);
  runSteps(s, 1);
  check('gameover after 2.5 s', s.scene === 'gameover', s.scene);
}

// layout hash determinism
{
  const a = new Sim({ seed: 42, startStage: 1 }); a.startRun();
  const b = new Sim({ seed: 42, startStage: 1 }); b.startRun();
  const c = new Sim({ seed: 43, startStage: 1 }); c.startRun();
  check('layoutHash same seed', a.layoutHash === b.layoutHash, a.layoutHash);
  check('layoutHash differs by seed', a.layoutHash !== c.layoutHash, c.layoutHash);
  const h1 = a.layoutHash;
  a.restart();
  check('layoutHash stable across restart', a.layoutHash === h1);
  check('trafficTotal 36', a.trafficTotal === 36);
}

// traffic lanes: no overlaps in 60 s of a fast run
{
  const s = toPlaying(mk(11));
  for (const c of s.traffic) c.hit = true;
  let minGap = 1e9;
  for (let i = 0; i < 3600; i++) {
    s.step();
    for (const lane of s.lanes) {
      const live = lane.filter((c) => !c.gone);
      for (let k = 1; k < live.length; k++) minGap = Math.min(minGap, live[k - 1].z - live[k].z);
    }
  }
  check('same-lane cars never overlap (min gap > 0)', minGap > 300, minGap.toFixed(0));
}

// ending rank
{
  const s = new Sim({ seed: 1, startStage: 3, best: 0 });
  s.startRun();
  s.stage = 3;
  s.scoreF = 33000;
  s.finishRun();
  check('rank S at 33000', s.rank === 'S' && s.scene === 'ending');
  s.scoreF = 28000; s.finishRun(); check('rank A at 28000', s.rank === 'A');
  s.scoreF = 23000; s.finishRun(); check('rank B at 23000', s.rank === 'B');
  s.scoreF = 22999; s.finishRun(); check('rank C below 23000', s.rank === 'C');
}

// crash
{
  const s = toPlaying(mk(5));
  s.debugSetSpeedKmh(250);
  s.input.up = true;
  const c = s.traffic[0];
  c.x = s.playerX; c.z = s.pos + 839 + 800; c.prevRel = 800; c.hit = false; c.passed = false; c.gone = false;
  for (const l of s.lanes) l.sort((a, b) => b.z - a.z);
  let guard = 0;
  while (s.crashes === 0 && guard++ < 120) s.step();
  check('crash increments crashes', s.crashes === 1, String(s.crashes));
  check('crash caps speed at <= 60 km/h (+1 step accel)', s.speed / 40 <= 62, (s.speed / 40).toFixed(1));
  check('crash invulnerable', s.getState().invulnerable === true);
  let inv = 0;
  while (s.getState().invulnerable && inv < 200) { s.step(); inv++; }
  check('invulnerable ~1.2 s (72 steps)', inv >= 70 && inv <= 73, String(inv));
  const ov = s.overtakes;
  runSteps(s, 200);
  check('no overtake credit for the crashed car', s.overtakes === ov, ov + ' -> ' + s.overtakes);
}

// overtake credit (+50) and near miss
{
  const s = toPlaying(mk(5));
  for (const o of s.roadside) o.hit = true;
  for (const c of s.traffic) c.hit = true; // everything else inert
  const c = s.traffic[0];
  c.hit = false; c.passed = false; c.gone = false;
  c.x = 0.667; c.speed = 100 * 40; c.eff = c.speed;
  s.playerX = 0; s.pos = 0;
  c.z = s.pos + 839.1 + 1800; c.prevRel = 1800;
  for (const l of s.lanes) l.sort((a, b) => b.z - a.z);
  s.debugSetSpeedKmh(200);
  s.input.up = true;
  const sc0 = s.scoreF;
  let jump = 0, guard = 0, ov0 = s.overtakes;
  while (s.overtakes === ov0 && guard++ < 600) {
    const before = s.scoreF;
    s.step();
    if (s.overtakes !== ov0) jump = s.scoreF - before;
  }
  check('overtake: overtakes +1', s.overtakes === ov0 + 1, String(s.overtakes));
  check('overtake: +50 jump at that step (plus one step of distance)', jump >= 50 && jump < 52.5, jump.toFixed(2));
}

console.log(fails === 0 ? '\nALL PASSED' : '\nFAILURES: ' + fails);
process.exit(fails === 0 ? 0 : 1);
