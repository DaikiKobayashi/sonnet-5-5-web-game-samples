import { Sim } from '../dist/js/sim.js';
const seed = Number(process.argv[2] || 1);
const sim = new Sim({ seed, startStage: 1, best: 0 });
const history = [];
let done = false;
for (let i = 0; i < 60 * 130 && !done; i++) {
  sim.step();
  const pz = sim.pos + 839.1;
  const lanes = sim.lanes.map((l) => l.filter((q) => !q.gone && q.z - pz > -1500 && q.z - pz < 20000).map((q) => `${q.type[0]}${q.type === 'sports' ? 'P' : ''}@${Math.round(q.z - pz)}v${Math.round(q.eff / 40)}`).join(' '));
  history.push({ i, pos: Math.round(sim.pos / 144), x: +sim.playerX.toFixed(2), tgt: +sim.autoTargetX.toFixed(2), lanes });
  if (history.length > 500) history.shift();
  for (const c of sim.traffic) {
    if (c.gone) continue;
    const camZ = c.z - sim.pos;
    if (camZ > 250 && camZ < 1800 && Math.abs(c.x - sim.playerX) - 0.25 < 0) {
      for (let k = 0; k < history.length; k += 25) console.log(JSON.stringify(history[k]));
      console.log('EVENT', JSON.stringify(history[history.length - 1]));
      done = true;
      break;
    }
  }
}
