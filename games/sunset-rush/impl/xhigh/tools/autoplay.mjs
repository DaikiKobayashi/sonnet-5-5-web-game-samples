// autoplay ポリシーのフラグなし(既定の Chromium)でも、最初のキー入力後に audio.state が running になるか確認する
import { chromium, BASE } from './lib.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto(BASE + '?debug=1&seed=42');
await page.waitForFunction(() => window.__game);
const a = await page.evaluate(() => window.__game.getState().audio.state);
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
const b = await page.evaluate(() => window.__game.getState().audio);
console.log('before key:', a, ' after Enter:', JSON.stringify(b));
await page.waitForFunction(() => window.__game.getState().scene === 'playing');
await page.keyboard.press('KeyP');
await page.waitForTimeout(300);
const c = await page.evaluate(() => window.__game.getState().audio);
await page.keyboard.press('KeyP');
await page.waitForTimeout(300);
const d = await page.evaluate(() => window.__game.getState().audio);
console.log('paused:', JSON.stringify(c), ' resumed:', JSON.stringify(d));
console.log('console errors/warnings:', JSON.stringify(errs));
await browser.close();
