// Scrolls through the gallery page and saves viewport-sized screenshots.
const { launch, sleep, BASE } = require('./lib.cjs');
const OUT = process.argv[2];
(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(BASE + '?gallery=1&mute=1');
  await page.waitForSelector('canvas[data-asset-id="font_pixel"]');
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  let i = 0;
  for (let y = 0; y < h; y += 880) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await sleep(100);
    await page.screenshot({ path: `${OUT}/gal_${i++}.png` });
  }
  console.log('pages', i, 'height', h);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
