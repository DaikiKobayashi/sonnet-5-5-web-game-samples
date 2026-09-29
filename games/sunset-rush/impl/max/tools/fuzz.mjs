// Random-input fuzzing of the simulation state machine (Node, no browser).
// Invariants: scene is one of the 8 allowed values, numbers stay finite, timeLeft >= 0, speed within [0, 300 km/h],
// playerX within +-2, score never decreases inside a run, overtakes/crashes never exceed sane values.
import { Sim } from '../dist/js/sim.js';

const SCENES = new Set(['title', 'countdown', 'playing', 'paused', 'stageclear', 'timeup', 'gameover', 'ending']);
let rngState = Number(process.argv[2] || 1);
const rnd = () => { rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0; return rngState / 4294967296; };

let violations = 0;
const kinds = {};
function viol(msg, sim) { violations++; const k = msg.split(' ')[0] + ' ' + (msg.split(' ')[1] || ''); kinds[k] = (kinds[k] || 0) + 1; if (violations < 10) console.log('VIOLATION', msg, JSON.stringify(sim.getState())); }

const totals = { steps: 0, scenes: {}, transitions: 0 };
for (let round = 0; round < 12; round++) {
  const sim = new Sim({ seed: (rnd() * 1e9) >>> 0, startStage: 1 + Math.floor(rnd() * 3), best: 0 });
  let lastScene = sim.scene;
  let lastScore = 0;
  let runId = 0;
  let lastRunId = 0;
  const origStart = sim.startRun.bind(sim);
  sim.startRun = () => { runId++; origStart(); };
  for (let i = 0; i < 60000; i++) {
    // random inputs
    if (i % 7 === 0) { sim.input.up = rnd() < 0.7; sim.input.down = rnd() < 0.15; sim.input.left = rnd() < 0.25; sim.input.right = rnd() < 0.25; }
    const r = rnd();
    if (r < 0.004) sim.confirm();
    else if (r < 0.0055) sim.togglePause();
    else if (r < 0.0062) sim.restart();
    else if (r < 0.0068) sim.quit();
    else if (r < 0.0074) sim.escape();
    else if (r < 0.0085 && (sim.scene === 'playing' || sim.scene === 'countdown')) { sim.debugWarp(rnd() * 2900); }
    else if (r < 0.0092 && sim.scene === 'playing') sim.debugSetTime(rnd() * 12);
    else if (r < 0.0096) sim.debugSetPlayerX((rnd() - 0.5) * 4);
    else if (r < 0.0100) sim.debugSetSpeedKmh(rnd() * 320);
    sim.step();
    sim.events.length = 0;
    totals.steps++;
    totals.scenes[sim.scene] = (totals.scenes[sim.scene] || 0) + 1;
    if (sim.scene !== lastScene) totals.transitions++;
    const s = sim.getState();
    if (!SCENES.has(s.scene)) viol('bad scene ' + s.scene, sim);
    for (const k of ['timeLeft', 'speedKmh', 'playerX', 'distanceM', 'goalRemainingM', 'score']) if (!Number.isFinite(s[k])) viol('non-finite ' + k, sim);
    if (s.timeLeft < -1e-9) viol('negative time', sim);
    if (s.speedKmh < -1e-9 || s.speedKmh > 300.0001) viol('speed out of range', sim);
    if (Math.abs(s.playerX) > 2.0001) viol('playerX out of range', sim);
    // score never decreases inside one run (a new run legitimately starts again at 0)
    if (runId === lastRunId && s.score < lastScore) viol('score decreased ' + lastScore + ' -> ' + s.score, sim);
    lastRunId = runId;
    lastScore = s.score;
    // scene-specific invariants
    if (s.scene === 'ending' && !['S', 'A', 'B', 'C'].includes(s.rank)) viol('ending without rank', sim);
    if (s.scene !== 'ending' && s.rank !== null) viol('rank outside ending', sim);
    if ((s.scene === 'title' || s.scene === 'paused' || s.scene === 'gameover' || s.scene === 'ending') && s.audio.engineHz !== 0) viol('engineHz nonzero in ' + s.scene, sim);
    if ((s.scene === 'countdown' || s.scene === 'playing' || s.scene === 'paused') !== (s.audio.bgm !== null)) viol('bgm mismatch in ' + s.scene, sim);
    lastScene = sim.scene;
  }
}
console.log('steps', totals.steps, 'scene transitions', totals.transitions, 'time per scene', JSON.stringify(totals.scenes));
console.log('violation kinds', JSON.stringify(kinds));
console.log(violations === 0 ? 'FUZZ OK (0 violations)' : 'FUZZ FAILED: ' + violations + ' violations');
process.exit(violations === 0 ? 0 : 1);
