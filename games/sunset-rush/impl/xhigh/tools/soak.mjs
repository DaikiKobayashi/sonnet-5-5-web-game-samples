// ロジックの耐久テスト(Node、描画なし): ランダム入力で全ステージを何度も走り、例外・不変条件の破れがないか確認する
import { Game } from '../dist/js/game.js';
import { STAGES, MAX_SPEED } from '../dist/js/constants.js';

let seedRng = 12345;
const rnd = () => { seedRng = (Math.imul(seedRng, 1664525) + 1013904223) >>> 0; return seedRng / 4294967296; };

let minGap = Infinity;
let runs = 0; let clears = 0; let gameovers = 0; let crashes = 0; let overtakes = 0; let maxScore = 0;
const problems = [];
for (let trial = 0; trial < 40; trial++) {
  const g = new Game({ seed: 1000 + trial, startStage: 1 + (trial % 3), best: 0, muted: true, emit: () => {} });
  g.confirm();
  let steerHold = 0; let steer = 0; let gasStyle = 0;
  for (let i = 0; i < 60 * 240; i++) {
    if (i % 30 === 0) { steerHold = Math.floor(rnd() * 3) - 1; gasStyle = rnd(); }
    steer = steerHold;
    g.input.throttle = gasStyle > 0.15;
    g.input.brake = gasStyle < 0.08;
    g.input.left = steer < 0;
    g.input.right = steer > 0;
    // 自動運転: ときどき道路中央へ戻す
    if (Math.abs(g.playerX) > 0.9) { g.input.left = g.playerX > 0; g.input.right = g.playerX < 0; }
    g.step();
    if (g.scene === 'stageclear' && g.clear && g.clear.panel) { clears++; g.confirm(); }
    if (g.scene === 'gameover') { gameovers++; g.confirm(); runs++; }
    if (g.scene === 'ending') { g.confirm(); }
    if (g.scene === 'title') g.confirm();
    if (i % 6 === 0) {
      const lanes = [[], [], []];
      for (const c of g.traffic) lanes[c.lane].push(c.z);
      for (const l of lanes) { l.sort((a, b) => a - b); for (let k = 1; k < l.length; k++) minGap = Math.min(minGap, l[k] - l[k - 1]); }
    }
    const bad = [];
    if (!(g.playerX >= -2 && g.playerX <= 2)) bad.push('playerX ' + g.playerX);
    if (!(g.speed >= 0 && g.speed <= MAX_SPEED + 1e-6)) bad.push('speed ' + g.speed);
    if (Number.isNaN(g.score) || Number.isNaN(g.timeLeft) || Number.isNaN(g.pos)) bad.push('NaN');
    if (g.scene === 'playing' && g.timeLeft < -0.02) bad.push('timeLeft ' + g.timeLeft);
    if (g.pos > (g.course.length - 1) * 200) bad.push('pos beyond course ' + g.pos);
    if (bad.length) { problems.push(`trial ${trial} step ${i} scene ${g.scene}: ${bad.join(', ')}`); break; }
  }
  crashes += g.crashes; overtakes += g.overtakes; maxScore = Math.max(maxScore, g.score);
}
console.log(JSON.stringify({ minSameLaneGapU: Math.round(minGap), runs, clears, gameovers, crashes, overtakes, maxScore: Math.floor(maxScore), problems }));
console.log(problems.length === 0 ? 'SOAK OK' : 'SOAK FAILED');
void STAGES;
