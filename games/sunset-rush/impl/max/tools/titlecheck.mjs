// The title screen has no player car: make sure the self-driving camera never ends up inside or right behind a car.
import { Sim } from '../dist/js/sim.js';
import { PLAYER_Z } from '../dist/js/config.js';

for (const seed of [42, 1, 7, 99, 12345]) {
  const sim = new Sim({ seed, startStage: 1, best: 0 });
  let bad = 0, worst = 1e9, wraps = 0, lastPos = 0;
  for (let i = 0; i < 60 * 600; i++) {
    sim.step();
    if (sim.pos < lastPos) wraps++;
    lastPos = sim.pos;
    for (const c of sim.traffic) {
      if (c.gone) continue;
      const camZ = c.z - sim.pos; // distance from the camera
      if (camZ > 250 && camZ < 1800) {
        const lat = Math.abs(c.x - sim.playerX) - 0.25;
        worst = Math.min(worst, lat);
        if (lat < 0) bad++;
      }
    }
  }
  console.log(`seed ${seed}: frames with a car overlapping the camera lane within 1800 u = ${bad}; loops=${wraps}; closest lateral margin=${worst.toFixed(2)}`);
}
