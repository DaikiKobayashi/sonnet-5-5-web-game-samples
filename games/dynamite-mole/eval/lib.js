'use strict';
// 評価ハーネス共通ライブラリ。実装ディレクトリは読み取り(HTTP 配信)のみで、変更しない。
const { chromium } = require('playwright');

const EFFORT_PORT = { low: 5101, medium: 5102, high: 5103, xhigh: 5104, max: 5105 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 仕様 3.3 の参照ジェネレータ ----------
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const STAGES = {
  1: { name: 'SHALLOW TUNNELS', density: 0.4, en: { slime: 3, bat: 0, ghost: 0, golem: 0 }, mult: 1.0, time: 150 },
  2: { name: 'MUSHROOM GROTTO', density: 0.42, en: { slime: 3, bat: 2, ghost: 0, golem: 0 }, mult: 1.0, time: 150 },
  3: { name: 'CRYSTAL VEIN', density: 0.45, en: { slime: 2, bat: 2, ghost: 2, golem: 0 }, mult: 1.05, time: 165 },
  4: { name: 'LAVA DEPTHS', density: 0.45, en: { slime: 2, bat: 2, ghost: 2, golem: 1 }, mult: 1.1, time: 180 },
  5: { name: 'THE DEEP DARK', density: 0.48, en: { slime: 0, bat: 3, ghost: 3, golem: 2 }, mult: 1.15, time: 180 },
};
const BASE_SPEED = { slime: 2.0, bat: 3.2, ghost: 2.4, golem: 1.5 };
const isWall = (c, r) => r === 0 || r === 10 || c === 0 || c === 14 || (r % 2 === 0 && c % 2 === 0);

function genStage(seed, s) {
  const st = STAGES[s];
  const rng = mulberry32(((seed >>> 0) + s * 7919) >>> 0);
  const g = [];
  for (let r = 0; r < 11; r++) { g.push([]); for (let c = 0; c < 15; c++) g[r].push(isWall(c, r) ? '#' : '.'); }
  const cand = [];
  for (let r = 0; r < 11; r++) for (let c = 0; c < 15; c++) if (g[r][c] === '.' && Math.abs(c - 1) + Math.abs(r - 1) >= 7) cand.push([c, r]);
  const enemies = [];
  for (const t of ['slime', 'bat', 'ghost', 'golem']) {
    for (let k = 0; k < st.en[t]; k++) {
      const i = Math.floor(rng() * cand.length);
      const [c, r] = cand.splice(i, 1)[0];
      enemies.push({ type: t, col: c, row: r });
    }
  }
  const safe = new Set(['1,1', '2,1', '3,1', '1,2', '1,3', '3,2', '2,3']);
  const nearEnemy = new Set();
  for (const e of enemies) for (const [dc, dr] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) nearEnemy.add(`${e.col + dc},${e.row + dr}`);
  const softs = [];
  for (let r = 0; r < 11; r++) for (let c = 0; c < 15; c++) {
    if (g[r][c] !== '.') continue;
    const k = `${c},${r}`;
    if (safe.has(k) || nearEnemy.has(k)) continue;
    if (rng() < st.density) { g[r][c] = 'S'; softs.push([c, r]); }
  }
  let far = softs.filter(([c, r]) => Math.abs(c - 1) + Math.abs(r - 1) >= 8);
  if (far.length === 0) far = softs;
  const ex = far[Math.floor(rng() * far.length)];
  const items = [];
  for (const [c, r] of softs) {
    if (c === ex[0] && r === ex[1]) continue;
    const u = rng();
    if (u < 0.18) {
      const v = rng() * 100;
      const type = v < 35 ? 'fire' : v < 70 ? 'bomb' : v < 90 ? 'boots' : 'life';
      items.push({ type, col: c, row: r });
    }
  }
  return { grid: g.map((row) => row.join('')), exit: { col: ex[0], row: ex[1] }, enemies, items };
}

// 爆風シミュレーション(仕様 3.5)。bombs: [{col,row,range}]、start: 最初に爆発する bombs の index 配列
function simulateFlames(grid, bombs, start) {
  const g = grid.map((row) => row.split(''));
  const flames = new Set();
  const broken = [];
  const queued = new Set(start);
  const queue = [...start];
  while (queue.length) {
    const b = bombs[queue.shift()];
    flames.add(`${b.col},${b.row}`);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let i = 1; i <= b.range; i++) {
        const c = b.col + dc * i, r = b.row + dr * i;
        const ch = g[r][c];
        if (ch === '#') break;
        flames.add(`${c},${r}`);
        if (ch === 'S') { g[r][c] = '.'; broken.push(`${c},${r}`); break; }
        bombs.forEach((o, idx) => { if (!queued.has(idx) && o.col === c && o.row === r) { queued.add(idx); queue.push(idx); } });
      }
    }
  }
  return { flames, broken, exploded: queued };
}

// ---------- ブラウザ / ページ ----------
const INIT = () => {
  // 評価用の観測(ゲームの挙動は変えない)
  window.__trans = [];
  window.__sfx = [];
  window.__ft = 0;
  window.__kd = [];
  const seen = new Set();
  let last = null;
  const proto = CanvasRenderingContext2D.prototype;
  for (const fn of ['fillText', 'strokeText']) {
    const orig = proto[fn];
    proto[fn] = function () { window.__ft++; return orig.apply(this, arguments); };
  }
  window.addEventListener('keydown', (e) => { setTimeout(() => window.__kd.push({ code: e.code, dp: e.defaultPrevented }), 0); });
  setInterval(() => {
    try {
      const g = window.__GAME__;
      if (!g) return;
      const s = g.snapshot();
      if (s.state !== last) { window.__trans.push({ t: performance.now(), s: s.state, stage: s.stage }); last = s.state; }
      for (const e of s.audio.sfxLog) {
        const k = e.name + '@' + e.time;
        if (!seen.has(k)) { seen.add(k); window.__sfx.push({ name: e.name, time: e.time, state: s.state }); }
      }
    } catch (e) { /* ignore */ }
  }, 20);
};

class Env {
  constructor(effort, opts = {}) {
    this.effort = effort;
    this.port = opts.port || EFFORT_PORT[effort];
    this.base = `http://127.0.0.1:${this.port}`;
    this.results = {};
    this.issues = [];
    this.sfxNames = new Set();
    this.dbgWorked = new Set();
    this.extra = {};
  }
  async launch() {
    this.browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  }
  async close() { await this.browser.close(); }
  rec(id, pass, note) {
    const prev = this.results[id];
    this.results[id] = { pass, note: note || '' };
    console.log(`[${this.effort}] ${id}: ${pass === true ? 'PASS' : pass === false ? 'FAIL' : 'N/A '} ${note || ''}`);
    return prev;
  }
  async open(query = '', o = {}) {
    const viewport = o.viewport || { width: 960, height: 832 };
    const ctx = o.context || (await this.browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: o.reducedMotion || 'no-preference', hasTouch: !!o.hasTouch, storageState: o.storageState }));
    const page = await ctx.newPage();
    const p = { page, ctx, ownCtx: !o.context, issues: [], warnings: [], external: 0, tag: o.tag || query };
    page.on('console', (m) => {
      if (m.type() === 'error') p.issues.push(`console.error: ${m.text()}`);
      else if (m.type() === 'warning') p.warnings.push(m.text());
    });
    page.on('pageerror', (e) => p.issues.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { const f = r.failure(); if (f && /ERR_ABORTED/.test(f.errorText)) return; p.issues.push(`requestfailed: ${r.url()} ${f && f.errorText}`); });
    page.on('response', (r) => { if (r.status() >= 400) p.issues.push(`HTTP ${r.status()}: ${r.url()}`); });
    await page.route('**/*', (route) => {
      const u = new URL(route.request().url());
      if (u.hostname !== '127.0.0.1' && u.hostname !== 'localhost') { p.external++; p.issues.push(`external request blocked: ${u.href}`); return route.abort(); }
      return route.continue();
    });
    if (!o.noInit) await page.addInitScript(INIT);
    if (o.init) await page.addInitScript(o.init);
    const base = o.base || this.base;
    const path = o.path || '/dist/index.html';
    await page.goto(`${base}${path}${query ? '?' + query : ''}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__GAME__ && window.__GAME__.snapshot, null, { timeout: 8000 });
    await sleep(150);
    this.pages = this.pages || [];
    this.pages.push(p);
    return p;
  }
  async harvest(p) {
    try {
      const sfx = await p.page.evaluate(() => window.__sfx || []);
      for (const e of sfx) this.sfxNames.add(e.name);
      this.extra.fillTextCalls = (this.extra.fillTextCalls || 0) + (await p.page.evaluate(() => window.__ft || 0));
    } catch (e) { /* page closed */ }
    for (const i of p.issues) this.issues.push({ tag: p.tag, msg: i });
    for (const w of p.warnings) this.extra.warnings = (this.extra.warnings || 0) + 1;
  }
  async done(p) {
    await this.harvest(p);
    try { if (p.ownCtx) await p.ctx.close(); else await p.page.close(); } catch (e) { /* ignore */ }
  }
}

// ---------- ページ操作ヘルパ ----------
// snapshot() の形式を検証して状態ごとに記録する(M40 用)
const SHAPE = {};
function validate(s) {
  const bad = [];
  const num = (v) => typeof v === 'number' && isFinite(v);
  if (!['title', 'stageIntro', 'playing', 'paused', 'stageClear', 'gameOver', 'gameClear'].includes(s.state)) bad.push('state');
  for (const k of ['seed', 'stage', 'score', 'hiScore', 'lives', 'timeLeft']) if (!num(s[k])) bad.push(k);
  const p = s.player;
  if (!p) bad.push('player');
  else {
    for (const k of ['col', 'row', 'x', 'y', 'invincible', 'maxBombs', 'activeBombs', 'range', 'boots', 'speed']) if (!num(p[k])) bad.push('player.' + k);
    if (!['up', 'down', 'left', 'right'].includes(p.facing)) bad.push('player.facing');
    if (typeof p.alive !== 'boolean') bad.push('player.alive');
  }
  for (const k of ['bombs', 'flames', 'enemies', 'items', 'texts']) if (!Array.isArray(s[k])) bad.push(k);
  if (!Array.isArray(s.grid) || s.grid.length !== 11 || s.grid.some((r) => typeof r !== 'string' || r.length !== 15)) bad.push('grid');
  if (!s.exit || !('col' in s.exit) || !('row' in s.exit) || typeof s.exit.revealed !== 'boolean' || typeof s.exit.open !== 'boolean') bad.push('exit');
  const a = s.audio;
  if (!a || typeof a.unlocked !== 'boolean' || typeof a.muted !== 'boolean' || !('bgm' in a) || !Array.isArray(a.sfxLog)) bad.push('audio');
  return bad;
}
const snap = async (page) => {
  const s = await page.evaluate(() => JSON.parse(JSON.stringify(window.__GAME__.snapshot())));
  const e = (SHAPE[s.state] = SHAPE[s.state] || { n: 0, bad: [] });
  e.n++;
  for (const b of validate(s)) if (!e.bad.includes(b)) e.bad.push(b);
  return s;
};
const dbg = (env, page, fn, ...args) => page.evaluate(([f, a]) => window.__GAME__.debug[f](...a), [fn, args]).then((r) => { env.dbgWorked.add(fn); return r; });
const joined = (s) => s.texts.join(' | ');
const has = (s, re) => re.test(s.texts.join(' | '));
async function tap(page, key, ms = 45) { await page.keyboard.down(key); await sleep(ms); await page.keyboard.up(key); }
// 1 フレーム(約 16ms)より確実に長く押す。keyboard.press は down/up が同時で、フレーム単位でキー状態を見る実装に取りこぼされうるため
const press = (page, key) => tap(page, key, 45);
async function waitState(page, state, timeout = 10000) {
  await page.waitForFunction((st) => window.__GAME__.snapshot().state === st, state, { timeout, polling: 16 });
}
async function startPlaying(page, key = 'Enter') {
  await press(page, key);
  await waitState(page, 'stageIntro', 3000);
  await waitState(page, 'playing', 6000);
}
async function startRec(page, { interval = 16, crops = null, texts = false } = {}) {
  await page.evaluate(({ interval, crops, texts }) => {
    const cropFn = crops ? new Function('s', 'return (' + crops + ')') : null;
    const canvas = document.querySelector('canvas');
    const c2 = canvas.getContext('2d');
    const out = [];
    window.__rec = out;
    const hash = (x, y, w, h) => {
      const d = c2.getImageData(x, y, w, h).data;
      let hh = 2166136261;
      for (let i = 0; i < d.length; i++) { hh ^= d[i]; hh = Math.imul(hh, 16777619); }
      return hh >>> 0;
    };
    window.__recId = setInterval(() => {
      const s = window.__GAME__.snapshot();
      const f = { t: performance.now(), state: s.state, stage: s.stage, score: s.score, lives: s.lives, timeLeft: s.timeLeft, player: s.player, bombs: s.bombs, flames: s.flames, enemies: s.enemies, items: s.items, exit: s.exit, grid: s.grid };
      if (texts) f.texts = s.texts;
      if (cropFn) { f.crops = {}; for (const c of cropFn(s) || []) f.crops[c.k] = hash(c.x, c.y, c.w || 32, c.h || 32); }
      out.push(f);
    }, interval);
  }, { interval, crops, texts });
}
async function stopRec(page) {
  return page.evaluate(() => { clearInterval(window.__recId); const o = window.__rec; window.__rec = []; return o; });
}
async function screenshotCanvas(page, file) {
  const el = await page.$('canvas');
  await el.screenshot({ path: file });
}
// canvas の論理ピクセルを PNG(dataURL)で取得
async function canvasPng(page) {
  return page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
}
const tileOf = (v) => Math.round(v);
function freeCells(grid) {
  const out = [];
  for (let r = 0; r < 11; r++) for (let c = 0; c < 15; c++) if (grid[r][c] === '.') out.push([c, r]);
  return out;
}

module.exports = { SHAPE, press, chromium, EFFORT_PORT, sleep, STAGES, BASE_SPEED, genStage, simulateFlames, mulberry32, isWall, Env, snap, dbg, joined, has, tap, waitState, startPlaying, startRec, stopRec, screenshotCanvas, canvasPng, tileOf, freeCells, INIT };
