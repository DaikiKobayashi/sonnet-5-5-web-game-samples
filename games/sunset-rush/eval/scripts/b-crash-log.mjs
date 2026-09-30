// 補足(参考実装の追加測定で追加): B ルート(ボット、seed 42)を同じ手順で流し、衝突が起きたフレームの playerX・速度・距離を記録する。
// SAFE_X(0.333)付近で衝突したか(当たり判定の逸脱の手がかり)を見るため。使い方: node b-crash-log.mjs <variant>
// 出力: eval/raw/b-crash-<variant>.json
import fs from 'fs';
import path from 'path';
import { PORTS, EVAL_DIR } from './config.mjs';
import { launch, openTitle, press, waitScene, sleep, st } from './lib.mjs';

const v = process.argv[2];
const b = await launch();
const P = await openTitle(b, PORTS[v]);
await press(P.page, 'Enter');
await waitScene(P.page, 'playing', 8000);
await P.page.evaluate(() => {
  const ev = window.__ev; ev.crashLog = []; let prev = null;
  ev.hooks.push((s, t) => {
    if (prev && s.crashes > prev.crashes) ev.crashLog.push({ t: Math.round(t), stage: s.stage, x: +prev.playerX.toFixed(3), xAfter: +s.playerX.toFixed(3), speedBefore: +prev.speedKmh.toFixed(1), speedAfter: +s.speedKmh.toFixed(1), distanceM: +s.distanceM.toFixed(1), goalRemainingM: +s.goalRemainingM.toFixed(1) });
    prev = s;
  });
  ev.startBot('synthetic');
});
const t0 = Date.now();
while (Date.now() - t0 < 320000) { await sleep(1000); const s = await st(P.page); if (['ending', 'gameover', 'timeup'].includes(s.scene)) break; }
const log = await P.page.evaluate(() => window.__ev.crashLog);
const fin = await st(P.page);
await b.close();
const out = { variant: v, crashes: log, final: { scene: fin.scene, score: fin.score, crashes: fin.crashes } };
fs.writeFileSync(path.join(EVAL_DIR, 'raw', `b-crash-${v}.json`), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
