// 起伏・カーブ・ゲートの見え方を、停車状態で複数地点スクリーンショットに撮る(目視確認用)
import { open, OUT } from './lib.mjs';

const plan = [
  [1, [330, 380, 430, 600, 860, 1040, 2960]],
  [2, [420, 700, 1100, 1180, 1215, 1245, 1300, 1560]],
  [3, [560, 900, 1350, 2000]],
];
for (const [stage, list] of plan) {
  const g = await open({ query: `debug=1&seed=42&stage=${stage}` });
  await g.press('Enter');
  await g.waitScene('playing', 6000);
  await g.dbg('setTime', 99);
  for (const m of list) {
    await g.dbg('warp', m);
    await g.dbg('setSpeedKmh', 0);
    await g.dbg('setPlayerX', 0);
    await g.wait(250);
    await g.shot(OUT + `h_s${stage}_${m}.png`);
  }
  console.log(stage, 'errors', JSON.stringify(g.log.errors));
  await g.close();
}
