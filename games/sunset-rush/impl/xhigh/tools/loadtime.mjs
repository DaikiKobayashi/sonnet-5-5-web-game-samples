// 起動時間(アセット生成を含む)の計測
import { chromium, BASE } from './lib.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const t0 = Date.now();
await page.goto(BASE + '?debug=1');
await page.waitForFunction(() => window.__game);
const t1 = Date.now();
const asset = await page.evaluate(async () => {
  const t = performance.now();
  // 新しいモジュールインスタンスでアセット生成だけの時間を測る
  const m = await import('./js/assets.js?probe=' + Math.random());
  const t2 = performance.now();
  m.getAssets();
  return { import: +(t2 - t).toFixed(1), build: +(performance.now() - t2).toFixed(1) };
});
console.log('goto->__game ready ms:', t1 - t0, 'assets build (re-run):', JSON.stringify(asset));
await browser.close();
