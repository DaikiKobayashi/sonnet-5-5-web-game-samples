// 共通ライブラリ: ブラウザ起動、観測フック(addInitScript)、状態待ち、撮影、コンタクトシート
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch() {
  return chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium' });
}

// ---------- ページ側の観測フック(全実装で同一) ----------
function initHook(opts) {
  const rawRAF = window.requestAnimationFrame.bind(window);
  const ev = (window.__ev = {
    opts, rawRAF,
    frames: [], cbDur: [], recFrames: false,
    sceneLog: [], titleAt: null, lastScene: null,
    samples: [], sampling: false, sampleFields: null,
    hold: null, hooks: [], caps: {}, imgs: {},
    keyLog: [], fillText: 0, strokeText: 0, fontSet: 0,
    audioCtxs: [], taps: [], bot: null, botLog: [],
  });
  // --- 1) テキスト描画の監視
  for (const C of [window.CanvasRenderingContext2D, window.OffscreenCanvasRenderingContext2D]) {
    if (!C) continue;
    const f = C.prototype.fillText, s = C.prototype.strokeText;
    C.prototype.fillText = function (...a) { ev.fillText++; return f.apply(this, a); };
    C.prototype.strokeText = function (...a) { ev.strokeText++; return s.apply(this, a); };
  }
  // --- 2) localStorage 例外化(M32-2)
  if (opts.throwStorage) {
    Storage.prototype.getItem = function () { throw new Error('blocked-get'); };
    Storage.prototype.setItem = function () { throw new Error('blocked-set'); };
  }
  // --- 3) 音の出力タップ
  const AC = window.AudioContext;
  if (AC) {
    class TapAC extends AC { constructor(...a) { super(...a); ev.audioCtxs.push(this); } }
    window.AudioContext = TapAC;
    if (window.webkitAudioContext) window.webkitAudioContext = TapAC;
    const oc = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dest, ...rest) {
      if (dest instanceof AudioDestinationNode && !(dest.context instanceof OfflineAudioContext)) {
        const ctx = dest.context;
        let t = ev.taps.find((x) => x.ctx === ctx);
        if (!t) {
          const an = ctx.createAnalyser(); an.fftSize = 2048;
          oc.call(an, dest);
          t = { ctx, an, buf: new Float32Array(2048), fbuf: new Uint8Array(1024) };
          ev.taps.push(t);
        }
        oc.call(this, t.an, ...rest);
        return dest;
      }
      return oc.call(this, dest, ...rest);
    };
  }
  ev.level = () => {
    let rms = 0, peak = 0;
    for (const t of ev.taps) {
      t.an.getFloatTimeDomainData(t.buf);
      let s = 0, p = 0;
      for (const v of t.buf) { s += v * v; if (Math.abs(v) > p) p = Math.abs(v); }
      rms = Math.max(rms, Math.sqrt(s / t.buf.length)); peak = Math.max(peak, p);
    }
    return { rms, peak, n: ev.taps.length, states: ev.audioCtxs.map((c) => c.state) };
  };
  ev.spectrum = () => { const t = ev.taps[ev.taps.length - 1]; if (!t) return null; t.an.getByteFrequencyData(t.fbuf); return Array.from(t.fbuf.slice(0, 256)); };
  // --- 4) キー入力ログ(捕捉フェーズ、実装より先)
  for (const type of ['keydown', 'keyup']) {
    window.addEventListener(type, (e) => { ev.keyLog.push({ t: performance.now(), type, code: e.code, trusted: e.isTrusted }); }, true);
  }
  // --- 5) rAF ラップ(ゲーム用)。fps オプションで setTimeout 化
  let gameRAF = rawRAF;
  if (opts.fps) {
    const iv = 1000 / opts.fps; let next = performance.now();
    let id = 0;
    gameRAF = (cb) => { id++; next = Math.max(next + iv, performance.now()); const d = Math.max(0, next - performance.now()); setTimeout(() => cb(performance.now()), d); return id; };
  }
  let lastTs = -1;
  window.requestAnimationFrame = (cb) => gameRAF((ts) => {
    const t0 = performance.now();
    try { cb(ts); } finally {
      const t1 = performance.now();
      if (ev.recFrames) { if (ts !== lastTs) ev.frames.push(t0); ev.cbDur.push(t1 - t0); }
      lastTs = ts;
    }
  });
  // --- 6) 毎フレームの観測ループ(生の rAF)
  const canvasEl = () => document.getElementById('game');
  ev.capture = (name, keepImg) => {
    const c = canvasEl(); if (!c) return;
    ev.caps[name] = c.toDataURL('image/png');
    if (keepImg) { const x = c.getContext('2d'); ev.imgs[name] = x.getImageData(0, 0, c.width, c.height); }
  };
  ev.dbg = () => window.__game && window.__game.debug;
  const loop = () => {
    rawRAF(loop);
    const g = window.__game; if (!g || !g.getState) return;
    let st; try { st = g.getState(); } catch (e) { return; }
    const t = performance.now();
    if (st.scene !== ev.lastScene) {
      ev.sceneLog.push({ t, scene: st.scene, st: JSON.parse(JSON.stringify(st)) });
      if (st.scene === 'title' && ev.titleAt == null) ev.titleAt = t;
      ev.lastScene = st.scene;
    }
    if (ev.sampling) ev.samples.push({ t, ...JSON.parse(JSON.stringify(st)) });
    for (const h of ev.hooks.slice()) { try { if (h(st, t) === 'done') ev.hooks.splice(ev.hooks.indexOf(h), 1); } catch (e) { ev.hooks.splice(ev.hooks.indexOf(h), 1); } }
    if (ev.hold && st.scene === 'playing') {
      const d = ev.dbg();
      if (d) { if (ev.hold.x != null) d.setPlayerX(ev.hold.x); if (ev.hold.v != null) d.setSpeedKmh(ev.hold.v); }
    }
    if (ev.bot) ev.botStep(st, t);
  };
  rawRAF(loop);
  // --- 7) 予約撮影: 条件成立から delays(ms) 後に撮る
  ev.captureAfter = (condSrc, delays, prefix, keepImg) => {
    const cond = new Function('st', 'prev', 'return (' + condSrc + ')');
    let t0 = null, prev = null; const left = delays.slice();
    ev.hooks.push((st, t) => {
      if (t0 == null) { if (cond(st, prev)) t0 = t; prev = st; if (t0 == null) return; }
      while (left.length && t - t0 >= left[0]) { const d = left.shift(); ev.capture(prefix + d, keepImg); ev.caps[prefix + d + '_t'] = t - t0; }
      if (!left.length) return 'done';
    });
  };
  ev.rec = {};
  ev.stateAfter = (condSrc, delays, prefix) => {
    const cond = new Function('st', 'prev', 'return (' + condSrc + ')');
    let t0 = null, prev = null; const left = delays.slice();
    ev.hooks.push((st, t) => {
      if (t0 == null) { if (cond(st, prev)) t0 = t; prev = st; if (t0 == null) return; }
      while (left.length && t - t0 >= left[0]) { const d = left.shift(); ev.rec[prefix + d] = { dt: t - t0, ...JSON.parse(JSON.stringify(st)) }; }
      if (!left.length) return 'done';
    });
  };
  ev.longtasks = 0;
  try { new PerformanceObserver((l) => { ev.longtasks += l.getEntries().length; }).observe({ entryTypes: ['longtask'] }); } catch (e) {}
  // --- 8) 自動運転ボット(§1.3)
  const send = (type, code) => {
    const key = { ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Enter: 'Enter' }[code] || code;
    window.dispatchEvent(new KeyboardEvent(type, { code, key, bubbles: true, cancelable: true }));
  };
  ev.send = send;
  ev.botStep = (st) => {
    const b = ev.bot; const want = new Set();
    if (st.scene === 'playing') {
      const err = st.playerX - 0.333;
      if (err < -0.02) want.add('ArrowRight'); else if (err > 0.02) want.add('ArrowLeft');
      const a = Math.abs(err);
      // EVAL §1.3 のとおり。ただし速度 0 から |err| >= 0.08 だと操舵が効かず永久に停止するため、
      // 80 km/h 未満では ↓ の代わりに ↑ を押す(RESULTS.md に逸脱として記録)
      if (a < 0.08) want.add('ArrowUp');
      else if (st.speedKmh < 80) want.add('ArrowUp');
      else if (a >= 0.15) want.add('ArrowDown');
    }
    if (b.mode === 'node') { b.want = [...want]; }
    else {
      for (const k of b.down) if (!want.has(k)) { send('keyup', k); b.down.delete(k); }
      for (const k of want) if (!b.down.has(k)) { send('keydown', k); b.down.add(k); }
    }
    if (st.scene === 'stageclear') {
      if (b.scT == null) b.scT = performance.now();
      if (performance.now() - b.scT > 1700 && !b.entered) { b.entered = true; if (b.mode === 'node') b.enter = true; else { send('keydown', 'Enter'); send('keyup', 'Enter'); } }
    } else { b.scT = null; b.entered = false; }
  };
  ev.startBot = (mode) => { ev.bot = { mode: mode || 'synthetic', down: new Set(), want: [] }; };
  ev.stopBot = () => { if (ev.bot && ev.bot.mode !== 'node') for (const k of ev.bot.down) send('keyup', k); ev.bot = null; };
  // --- 9) 画像解析(ページ内)
  ev.shift = (a, b, y0, y1, x0, x1, range) => {
    const A = ev.imgs[a], B = ev.imgs[b]; if (!A || !B) return null;
    const W = A.width; let best = null, bestS = 0; const res = [];
    for (let s = -range; s <= range; s++) {
      let sum = 0, n = 0;
      for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 2) {
        const xa = x - s; if (xa < 0 || xa >= W) continue;
        const ia = (y * W + xa) * 4, ib = (y * W + x) * 4;
        sum += Math.abs(A.data[ia] - B.data[ib]) + Math.abs(A.data[ia + 1] - B.data[ib + 1]) + Math.abs(A.data[ia + 2] - B.data[ib + 2]); n++;
      }
      const m = sum / n / 3; res.push(m); if (best == null || m < best) { best = m; bestS = s; }
    }
    return { s: bestS, mad: best, mad0: res[range] };
  };
  ev.diff = (a, b, y0, y1, thr) => {
    const A = ev.imgs[a], B = ev.imgs[b]; if (!A || !B) return null;
    const W = A.width; let ch = 0, n = 0, sum = 0;
    for (let y = y0; y <= y1; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4; const d = (Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2])) / 3;
      sum += d; n++; if (d > (thr || 8)) ch++;
    }
    return { changedRatio: ch / n, mad: sum / n };
  };
  ev.colorStats = (a) => {
    const A = ev.imgs[a]; if (!A) return null; const W = A.width, H = A.height;
    const stat = (y0, y1) => {
      let cx = 0, cy = 0, lum = 0, n = 0, neon = 0;
      for (let y = y0; y <= y1; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4; const r = A.data[i] / 255, g = A.data[i + 1] / 255, b = A.data[i + 2] / 255;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; const s = mx ? d / mx : 0; let h = 0;
        if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
        cx += s * Math.cos(h * Math.PI / 180); cy += s * Math.sin(h * Math.PI / 180);
        lum += 0.2126 * r + 0.7152 * g + 0.0722 * b; n++;
        if (s > 0.6 && mx > 0.6 && ((h >= 160 && h <= 200) || (h >= 280 && h <= 330))) neon++;
      }
      let hue = Math.atan2(cy, cx) * 180 / Math.PI; if (hue < 0) hue += 360;
      return { hue: +hue.toFixed(1), lum: +(lum / n).toFixed(4), neon: +(neon / n).toFixed(5) };
    };
    return { sky: stat(0, 179), full: stat(0, H - 1) };
  };
}

// ---------- ページ生成 ----------
export async function newPage(browser, opts = {}) {
  const ctxOpts = { viewport: opts.viewport || { width: 1280, height: 720 }, deviceScaleFactor: 1 };
  if (opts.touch) { ctxOpts.hasTouch = true; ctxOpts.isMobile = true; }
  const context = await browser.newContext(ctxOpts);
  await context.addInitScript(initHook, { fps: opts.fps || 0, throwStorage: !!opts.throwStorage });
  const page = await context.newPage();
  const errs = { console: [], pageerror: [], requestfailed: [], http4xx: [], external: [], favicon: [], warnings: 0 };
  const port = opts.port;
  page.on('console', (m) => { if (m.type() === 'error') errs.console.push(m.text()); else if (m.type() === 'warning') errs.warnings++; });
  page.on('pageerror', (e) => errs.pageerror.push(String(e && e.stack || e)));
  page.on('requestfailed', (r) => { if (r.url().endsWith('/favicon.ico') && !r.url().includes('/dist/')) errs.favicon.push(r.url()); else errs.requestfailed.push(r.url() + ' ' + (r.failure() && r.failure().errorText)); });
  page.on('response', (r) => { if (r.status() >= 400) { if (/\/favicon\.ico$/.test(r.url()) && !r.url().includes('/dist/')) errs.favicon.push(r.url()); else errs.http4xx.push(r.status() + ' ' + r.url()); } });
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith('data:') && !u.startsWith('blob:') && !u.startsWith(`http://localhost:${port}/`)) errs.external.push(u); });
  return { context, page, errs };
}
export function errCount(errs) {
  return { console: errs.console.length, pageerror: errs.pageerror.length, requestfailed: errs.requestfailed.length + errs.http4xx.length, external: errs.external.length, favicon: errs.favicon.length, warnings: errs.warnings };
}
export function errTotal(errs) { const c = errCount(errs); return c.console + c.pageerror + c.requestfailed + c.external; }

export const gameUrl = (port, params = {}, root = false) => {
  const q = new URLSearchParams({ seed: '42', debug: '1', ...params });
  for (const [k, v] of Object.entries(params)) if (v == null) q.delete(k);
  return `http://localhost:${port}/${root ? '' : 'dist/'}?${q}`;
};

// ---------- 状態・待機 ----------
export const st = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__game.getState())));
export async function waitScene(page, scene, timeout = 12000) {
  try {
    await page.waitForFunction((s) => window.__game && window.__game.getState && window.__game.getState().scene === s, scene, { timeout, polling: 'raf' });
    return true;
  } catch (e) { return false; }
}
export async function sceneEntry(page, scene, after = 0) {
  return page.evaluate(([s, a]) => { const e = window.__ev.sceneLog.filter((x) => x.scene === s && x.t >= a); return e.length ? e[e.length - 1] : null; }, [scene, after]);
}
export const now = (page) => page.evaluate(() => performance.now());
export const dbg = (page, fn, ...args) => page.evaluate(([f, a]) => window.__game.debug[f](...a), [fn, args]);
export const hold = (page, h) => page.evaluate((x) => { window.__ev.hold = x; }, h);
export const press = async (page, code, ms = 60) => { await page.keyboard.down(code); await sleep(ms); await page.keyboard.up(code); };
export async function startSampling(page) { await page.evaluate(() => { window.__ev.samples = []; window.__ev.sampling = true; }); }
export async function stopSampling(page) { return page.evaluate(() => { window.__ev.sampling = false; const s = window.__ev.samples; window.__ev.samples = []; return s; }); }
// サンプル列から時刻 t の値を線形補間
export function at(samples, t, key) {
  let prev = null;
  for (const s of samples) { if (s.t >= t) { if (!prev) return s[key]; const r = (t - prev.t) / (s.t - prev.t || 1); return prev[key] + (s[key] - prev[key]) * r; } prev = s; }
  return prev ? prev[key] : null;
}
export function nearest(samples, t) { let best = null; for (const s of samples) if (!best || Math.abs(s.t - t) < Math.abs(best.t - t)) best = s; return best; }

export async function openTitle(browser, port, params = {}, opts = {}) {
  const P = await newPage(browser, { port, ...opts });
  await P.page.goto(gameUrl(port, params, opts.root));
  P.titleOk = await waitScene(P.page, 'title', 10000);
  await sleep(200);
  return P;
}
export async function toPlaying(page) {
  await press(page, 'Enter');
  const c = await waitScene(page, 'countdown', 5000);
  const p = await waitScene(page, 'playing', 8000);
  return c && p;
}

// ---------- 撮影 ----------
export async function saveDataUrl(dataUrl, file) {
  if (!dataUrl) return null;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  return path.basename(file);
}
export async function rawShot(page, file, keepName) {
  const d = await page.evaluate((k) => { window.__ev.capture(k || '_tmp', !!k); return window.__ev.caps[k || '_tmp']; }, keepName || null);
  return saveDataUrl(d, file);
}
export async function getCaps(page, prefix) {
  return page.evaluate((p) => { const o = {}; for (const [k, v] of Object.entries(window.__ev.caps)) if (k.startsWith(p)) o[k] = v; return o; }, prefix);
}
// 部分拡大(ページ内 canvas で nearest 拡大)
export async function zoomCrop(sheetPage, dataUrl, [x, y, w, h], scale, file) {
  const out = await sheetPage.evaluate(async ([d, x, y, w, h, s]) => {
    const img = new Image(); img.src = d; await img.decode();
    const c = document.createElement('canvas'); c.width = w * s; c.height = h * s; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(img, x, y, w, h, 0, 0, w * s, h * s); return c.toDataURL('image/png');
  }, [dataUrl, x, y, w, h, scale]);
  return saveDataUrl(out, file);
}
// コンタクトシート
export async function contactSheet(sheetPage, items, cols, cellW, file, crop) {
  const out = await sheetPage.evaluate(async ([items, cols, cellW, crop]) => {
    const imgs = [];
    for (const it of items) { const im = new Image(); im.src = it.d; await im.decode(); imgs.push(im); }
    const cw = crop ? crop[2] : imgs[0].width, ch = crop ? crop[3] : imgs[0].height;
    const cellH = Math.round(cellW * ch / cw); const rows = Math.ceil(imgs.length / cols);
    const c = document.createElement('canvas'); c.width = cols * cellW; c.height = rows * (cellH + 12); const g = c.getContext('2d');
    g.fillStyle = '#222'; g.fillRect(0, 0, c.width, c.height); g.imageSmoothingEnabled = false;
    g.font = '10px monospace';
    imgs.forEach((im, i) => {
      const cx = (i % cols) * cellW, cy = Math.floor(i / cols) * (cellH + 12);
      if (crop) g.drawImage(im, crop[0], crop[1], crop[2], crop[3], cx, cy, cellW, cellH); else g.drawImage(im, cx, cy, cellW, cellH);
      g.fillStyle = '#fff'; g.fillText(items[i].label || String(i), cx + 2, cy + cellH + 10);
    });
    return c.toDataURL('image/png');
  }, [items, cols, cellW, crop || null]);
  return saveDataUrl(out, file);
}
