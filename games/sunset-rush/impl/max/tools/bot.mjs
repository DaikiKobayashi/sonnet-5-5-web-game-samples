// A simple autopilot that plays the simulation headlessly to check that every stage is winnable and
// that nothing degenerates (NaN, stuck states). Usage: node tools/bot.mjs [seed]
import { Sim } from '../dist/js/sim.js';
import { STAGES, LANE_X, PLAYER_Z, SEG_LEN, CAM_DEPTH } from '../dist/js/config.js';

const seed = Number(process.argv[2] || 42);

function play(startStage, opts = {}) {
  const sim = new Sim({ seed, startStage, best: 0 });
  sim.startRun();
  const log = [];
  let steps = 0;
  const skill = opts.skill === undefined ? 1 : opts.skill;
  let target = 1;
  while (steps < 60 * 400) {
    steps++;
    const s = sim.scene;
    if (s === 'stageclear' && sim.sceneT >= 90) { log.push(`stage ${sim.stage} clear: time left ${sim.timeLeft.toFixed(1)} score ${sim.scoreInt} crashes ${sim.crashes} overtakes ${sim.overtakes}`); sim.confirm(); continue; }
    if (s === 'ending' || s === 'gameover') break;
    if (s === 'playing') {
      const pz = sim.pos + PLAYER_Z;
      const segs = sim.course.segments;
      const i0 = Math.floor(pz / SEG_LEN);
      // curvature ahead (max |curve| over next 25 segments, weighted)
      let cur = 0;
      for (let k = 0; k < 25; k++) cur = Math.max(cur, Math.abs(segs[Math.min(segs.length - 1, i0 + k)].curve) * (1 - k / 40));
      const here = segs[Math.min(segs.length - 1, i0)].curve;
      const spLimit = cur < 0.6 ? 1 : Math.min(1, (3.0 / cur) * (skill === 1 ? 1 : 0.85));
      const sp = sim.speed / 12000;
      // lane choice: nearest car ahead in each lane
      const free = [1e9, 1e9, 1e9];
      for (let l = 0; l < 3; l++) for (const c of sim.lanes[l]) { if (c.gone) continue; const rel = c.z - pz; if (rel > -600 && rel < free[l]) free[l] = rel; }
      const curLane = LANE_X.reduce((b, x, l) => (Math.abs(x - sim.playerX) < Math.abs(LANE_X[b] - sim.playerX) ? l : b), 0);
      const lookahead = 4000 + sp * 9000;
      if (free[target] < lookahead) {
        let best = target;
        for (const l of [1, curLane - 1, curLane + 1, 0, 2]) if (l >= 0 && l < 3 && free[l] > free[best] + 2500) best = l;
        target = best;
      }
      const targetX = LANE_X[target];
      // steering: bang-bang with dead zone, compensating the centrifugal push
      const dx = targetX - sim.playerX;
      const inp = sim.input;
      inp.left = false; inp.right = false;
      const push = sp * sp * here * 0.3 * 2.0 / 60 * 60; // per-second leftward push
      const want = dx + (here > 0 ? 0.12 : here < 0 ? -0.12 : 0) * Math.min(1, sp * 2) * Math.abs(here) / 4;
      if (want > 0.05) inp.right = true; else if (want < -0.05) inp.left = true;
      // throttle: brake if far too fast for the corner or a slow car is close in our lane
      const blocked = free[curLane] < 1800 + sp * 3000 && Math.abs(dx) < 0.3;
      inp.up = sp < spLimit && !blocked;
      inp.down = sp > spLimit + 0.08 || (blocked && free[curLane] < 1500);
    }
    sim.step();
    if (!Number.isFinite(sim.pos) || !Number.isFinite(sim.playerX) || !Number.isFinite(sim.timeLeft)) { log.push('NaN detected!'); break; }
  }
  log.push(`end: scene=${sim.scene} stage=${sim.stage} score=${sim.scoreInt} rank=${sim.rank} time=${(steps / 60).toFixed(1)}s crashes=${sim.crashes} overtakes=${sim.overtakes}`);
  return log;
}

for (const st of [1, 2, 3]) {
  console.log(`--- start at stage ${st} (seed ${seed}) ---`);
  for (const line of play(st)) console.log(line);
}
console.log('--- full run from stage 1, cautious bot ---');
for (const line of play(1, { skill: 0.9 })) console.log(line);
