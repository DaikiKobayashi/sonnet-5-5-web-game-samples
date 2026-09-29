const { launch, open, state, sleep, waitScene } = require('./lib.cjs');
(async () => {
  const browser = await launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on('console', (m) => console.log('console', m.type(), m.text()));
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  page.on('crash', () => console.log('PAGE CRASHED'));
  page.on('close', () => console.log('page closed'));
  await page.goto('http://127.0.0.1:5105/dist/index.html?debug=1&seed=42&mute=1&stage=' + (process.argv[2] || 2));
  await sleep(1500);
  console.log('before enter', JSON.stringify(await state(page)));
  await page.keyboard.press('Enter');
  await sleep(1000);
  console.log('after enter', JSON.stringify(await state(page)));
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
