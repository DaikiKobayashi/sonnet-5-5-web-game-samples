/* Shared helpers for the Playwright verification scripts (tools/verify-*.js).
 * Requires the global Playwright install (PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers) and a static server:
 *   cd games/dynamite-mole/impl/max && python3 -m http.server 5105
 */
'use strict';
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }

const BASE = process.env.BASE || 'http://127.0.0.1:5105';
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ok(id, cond, msg) {
  results.push({ id, ok: !!cond, msg });
  console.log((cond ? 'PASS ' : 'FAIL ') + id + '  ' + (msg || ''));
}
function info(msg) { console.log('     ' + msg); }

async function launch() {
  return chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
}

/* opens a fresh context+page; collects console errors / page errors / 4xx-5xx */
async function open(browser, qs, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({
    viewport: opts.viewport || { width: 1280, height: 720 },
    hasTouch: !!opts.touch, isMobile: !!opts.touch,
    reducedMotion: opts.reducedMotion || 'no-preference'
  });
  const page = await ctx.newPage();
  page._errors = [];
  page._warnings = [];
  page._bad = [];
  page.on('console', (m) => {
    if (m.type() === 'error') page._errors.push('console.error: ' + m.text());
    else if (m.type() === 'warning') page._warnings.push(m.text());
  });
  page.on('pageerror', (e) => page._errors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => page._bad.push('requestfailed: ' + r.url()));
  page.on('response', (r) => { if (r.status() >= 400) page._bad.push(r.status() + ' ' + r.url()); });
  if (opts.init) await page.addInitScript(opts.init);
  await page.goto((opts.base || BASE) + (opts.path || '/dist/index.html') + (qs || ''));
  await page.waitForFunction(() => window.__GAME__ && window.__GAME__.snapshot);
  page._ctx = ctx;
  return page;
}
async function closePage(page) { try { await page._ctx.close(); } catch (e) { /* ignore */ } }

const snap = (page) => page.evaluate(() => window.__GAME__.snapshot());
const dbg = (page, fn, ...args) => page.evaluate(([f, a]) => window.__GAME__.debug[f](...a), [fn, args]);
async function waitState(page, state, timeout) {
  await page.waitForFunction((s) => window.__GAME__.snapshot().state === s, state, { timeout: timeout || 8000, polling: 20 });
}
/* title -> stageIntro -> playing */
async function startGame(page) {
  await page.keyboard.press('Enter');
  await waitState(page, 'playing', 6000);
}

/* per-frame time series recorded inside the page (real time via performance.now) */
async function record(page, ms) {
  return page.evaluate((dur) => new Promise((res) => {
    const out = [];
    const t0 = performance.now();
    (function f() {
      const s = window.__GAME__.snapshot();
      out.push({
        t: performance.now() - t0, st: s.state, tl: s.timeLeft, score: s.score, lives: s.lives,
        px: s.player.x, py: s.player.y, alive: s.player.alive, inv: s.player.invincible, face: s.player.facing,
        bombs: s.bombs.map((b) => [b.col, b.row, b.timeLeft]),
        flames: s.flames.map((q) => [q.col, q.row, q.timeLeft]),
        en: s.enemies.map((e) => [e.type, e.x, e.y, e.hp, e.alive]),
        exit: s.exit, sfx: s.audio.sfxLog.length
      });
      if (performance.now() - t0 < dur) requestAnimationFrame(f); else res(out);
    })();
  }), ms);
}

/* dispatch several key events inside one JS task (same game tick) */
async function keysSameTick(page, events) {
  await page.evaluate((evs) => {
    evs.forEach(([type, code]) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true })));
  }, events);
}

function summary() {
  const failed = results.filter((r) => !r.ok);
  console.log('\n==== ' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed ====');
  failed.forEach((f) => console.log('  FAILED ' + f.id + ' ' + (f.msg || '')));
  return failed.length;
}

module.exports = { chromium, BASE, ok, info, sleep, launch, open, closePage, snap, dbg, waitState, startGame, record, keysSameTick, summary, results };
