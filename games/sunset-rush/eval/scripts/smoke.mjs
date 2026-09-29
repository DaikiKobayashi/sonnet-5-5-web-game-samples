// 動作確認用: 合成キーの対照テストと、ボットの挙動
import { EFFORTS, PORTS } from './config.mjs';
import { launch, openTitle, st, toPlaying, errCount, sleep } from './lib.mjs';
const b = await launch();
for (const e of process.argv[2] ? [process.argv[2]] : EFFORTS) {
  const P = await openTitle(b, PORTS[e]);
  await toPlaying(P.page);
  await P.page.evaluate(() => window.__ev.send('keydown', 'ArrowUp'));
  await sleep(500);
  await P.page.evaluate(() => window.__ev.send('keyup', 'ArrowUp'));
  const s1 = await st(P.page);
  await P.page.evaluate(() => window.__ev.startBot());
  for (let i = 0; i < 6; i++) { await sleep(5000); const s = await st(P.page); console.log(e, i, s.scene, s.speedKmh.toFixed(0), s.playerX.toFixed(2), s.distanceM.toFixed(0), s.crashes, s.timeLeft.toFixed(1)); }
  console.log(e, 'control speed after synthetic 0.5s', s1.speedKmh, JSON.stringify(errCount(P.errs)));
  await P.context.close();
}
await b.close();
