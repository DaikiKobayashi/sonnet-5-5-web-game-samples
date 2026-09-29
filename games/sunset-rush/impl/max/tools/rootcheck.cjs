// Loads the game when dist/ itself is the server root (BASE=http://127.0.0.1:5105/index.html) and plays a few seconds.
const { launch, open, state, sleep, waitScene } = require('./lib.cjs');
(async () => {
  const browser = await launch();
  const { page, log } = await open(browser, 'debug=1&seed=42&mute=1');
  await sleep(400);
  await page.keyboard.press('Enter');
  await waitScene(page, 'playing', 6000);
  await page.keyboard.down('ArrowUp');
  await sleep(2000);
  const s = await state(page);
  await page.keyboard.up('ArrowUp');
  const gallery = await browser.newPage();
  const gerr = [];
  gallery.on('console', (m) => { if (m.type() === 'error') gerr.push(m.text()); });
  gallery.on('response', (r) => { if (r.status() >= 400) gerr.push(r.status() + ' ' + r.url()); });
  await gallery.goto(process.env.BASE + '?gallery=1&mute=1');
  await gallery.waitForSelector('canvas[data-asset-id="logo_title"]');
  const n = await gallery.evaluate(() => document.querySelectorAll('canvas[data-asset-id]').length);
  console.log('scene', s.scene, 'speed', s.speedKmh.toFixed(1), 'requests', log.requests.length, 'errors', JSON.stringify(log.errors), 'bad', JSON.stringify(log.bad), 'failed', JSON.stringify(log.failed));
  console.log('gallery canvases', n, 'errors', JSON.stringify(gerr));
  console.log('urls', JSON.stringify(log.requests.map((u) => u.replace('http://127.0.0.1:5105', ''))));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
