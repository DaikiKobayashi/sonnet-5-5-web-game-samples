// Shared helpers for the Playwright-based checks (dev tools, not part of the game).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:5105/dist/index.html';

async function launch(opts = {}) {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage', ...(opts.args || [])],
  });
  return browser;
}

// Opens the game and records console errors, page errors and failed/404 requests.
async function open(browser, query = '', ctxOpts = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...ctxOpts });
  const page = await context.newPage();
  const log = { errors: [], requests: [], failed: [], bad: [] };
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') log.errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => log.errors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => log.failed.push(r.url() + ' ' + (r.failure() && r.failure().errorText)));
  page.on('response', (r) => { log.requests.push(r.url()); if (r.status() >= 400) log.bad.push(r.status() + ' ' + r.url()); });
  await page.goto(BASE + (query ? (query.startsWith('?') ? query : '?' + query) : ''), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.getState, null, { timeout: 15000 });
  return { context, page, log };
}

const state = (page) => page.evaluate(() => window.__game.getState());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitScene(page, scene, timeout = 15000) {
  await page.waitForFunction((s) => window.__game.getState().scene === s, scene, { timeout });
}

module.exports = { chromium, launch, open, state, sleep, waitScene, BASE };
