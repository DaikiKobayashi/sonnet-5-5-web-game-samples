// 検証用の Playwright ヘルパー(開発・自己チェック用。dist には含めない)
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
const require = createRequire('/opt/node22/lib/node_modules/');
export const { chromium } = require('playwright');

export const BASE = process.env.BASE || 'http://localhost:5104/dist/index.html';

const opened = [];
export async function closeAll() {
  while (opened.length) { const b = opened.pop(); try { await b.close(); } catch (e) { /* 何もしない */ } }
}

export async function launch(o) {
  const b = await chromium.launch(o);
  opened.push(b);
  return b;
}

export async function open(opts = {}) {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', ...(opts.args || [])] });
  opened.push(browser);
  const context = await browser.newContext({
    viewport: opts.viewport || { width: 1280, height: 720 },
    hasTouch: !!opts.touch,
    isMobile: !!opts.touch,
    deviceScaleFactor: opts.dpr || 1,
  });
  if (opts.init) await context.addInitScript(opts.init);
  const page = await context.newPage();
  const log = { errors: [], failed: [], external: [], requests: [] };
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') log.errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => log.errors.push('PAGEERROR ' + e.message));
  page.on('requestfailed', (r) => log.failed.push(r.url() + ' ' + (r.failure() && r.failure().errorText)));
  page.on('response', (r) => { if (r.status() >= 400) log.failed.push(r.status() + ' ' + r.url()); });
  page.on('request', (r) => {
    log.requests.push(r.url());
    const u = new URL(r.url());
    if (u.protocol.startsWith('http') && u.hostname !== 'localhost') log.external.push(r.url());
  });
  const q = opts.query === undefined ? 'debug=1&seed=42' : opts.query;
  await page.goto(opts.url || (BASE + (q ? '?' + q : '')));
  await page.waitForFunction(() => window.__game || document.querySelector('[data-asset-id]'), null, { timeout: 15000 });
  const api = {
    browser, context, page, log,
    state: () => page.evaluate(() => window.__game.getState()),
    dbg: (name, ...args) => page.evaluate(([n, a]) => window.__game.debug[n](...a), [name, args]),
    press: (key) => page.keyboard.press(key),
    down: (key) => page.keyboard.down(key),
    up: (key) => page.keyboard.up(key),
    wait: (ms) => page.waitForTimeout(ms),
    shot: (path) => page.screenshot({ path }),
    waitScene: async (scene, timeout = 8000) => {
      await page.waitForFunction((s) => window.__game.getState().scene === s, scene, { timeout });
    },
    close: () => browser.close(),
  };
  return api;
}

// スクリーンショット等の出力先(環境変数 VERIFY_OUT で変更できる)
export const OUT = (process.env.VERIFY_OUT || path.join(os.tmpdir(), 'sunset-rush-verify')) + '/';
fs.mkdirSync(OUT, { recursive: true });
