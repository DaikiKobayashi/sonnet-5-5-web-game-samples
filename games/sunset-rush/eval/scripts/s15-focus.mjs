// S-15 の補足(参考): 合成 blur ではなく、同じコンテキストに別タブを開いて前面に出し、実際にフォーカスを失わせたときの scene
import fs from 'fs';
import path from 'path';
import { EFFORTS, PORTS, EVAL_DIR } from './config.mjs';
import { launch, newPage, gameUrl, waitScene, toPlaying, sleep, st } from './lib.mjs';
// 引数で variant を指定した場合はその variant だけを計算し、既存の s15-focus.json に追記する
const ONLY = process.argv.slice(2);
const OUTF = path.join(EVAL_DIR, 'raw', 's15-focus.json');
const b = await launch(); const out = ONLY.length && fs.existsSync(OUTF) ? JSON.parse(fs.readFileSync(OUTF, 'utf8')) : {};
for (const e of ONLY.length ? ONLY : EFFORTS) {
  const P = await newPage(b, { port: PORTS[e] });
  await P.page.goto(gameUrl(PORTS[e])); await waitScene(P.page, 'title'); await toPlaying(P.page); await sleep(500);
  const before = await P.page.evaluate(() => document.hasFocus());
  const other = await P.context.newPage(); await other.goto('about:blank'); await other.bringToFront(); await sleep(500);
  const r = await P.page.evaluate(() => ({ hasFocus: document.hasFocus(), hidden: document.hidden, scene: window.__game.getState().scene }));
  out[e] = { hasFocusBefore: before, ...r };
  console.log(e, JSON.stringify(out[e]));
  await P.context.close();
}
fs.writeFileSync(OUTF, JSON.stringify(out, null, 1));
await b.close();
