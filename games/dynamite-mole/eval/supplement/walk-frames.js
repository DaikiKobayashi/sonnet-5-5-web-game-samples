'use strict';
// 補足の測定(参考実装の追加測定で足したもの。既存の checks_*.js の判定には使っていない)。
// checks_g.js の S11 の敵フレーム数は、敵を爆弾で囲んで動けなくした「待機」の見た目の変化を数えている。
// 歩いている間だけ絵を切り替える実装(opus-medium / fable-high のゴーレム)はこの方法では 1 フレームになるため、
// 「歩いている敵」に使われた絵の種類を、7 実装に同じ方法で数えて参考値とする。
// 方法: drawImage を包み、描画先が敵の位置(snapshot の x,y から求めた 32x32 の枠)に重なる描画の「元の画像+元の矩形」を集める。
//       同じ時間に敵以外の場所(プレイヤーの下・床など)にも描かれた元は除く(床タイル・影)。残った種類の数 = 歩行中に使われた絵の数。
// 限界: drawImage を通らずに描く絵は数えられない。上下の揺れ(描画位置のずれ)は数えない(絵の種類だけを数える)。
// 使い方: 7 実装のサーバー(5101〜5107)を起動して
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers NODE_PATH=$(npm root -g) node walk-frames.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const V = ['low', 'medium', 'high', 'xhigh', 'max', 'opus-medium', 'fable-high'];
const PORT = { low: 5101, medium: 5102, high: 5103, xhigh: 5104, max: 5105, 'opus-medium': 5106, 'fable-high': 5107 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const INIT = () => {
  const W = new WeakMap();
  let nid = 0;
  const idOf = (o) => { let i = W.get(o); if (i === undefined) { i = ++nid; W.set(o, i); } return i; };
  window.__draws = null;
  const orig = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) {
    try {
      if (window.__draws && this.canvas && this.canvas.isConnected && img && !(img instanceof HTMLCanvasElement && img.isConnected)) {
        let sx = 0, sy = 0, sw = img.width, sh = img.height, dx, dy, dw, dh;
        if (a.length === 8) [sx, sy, sw, sh, dx, dy, dw, dh] = a;
        else if (a.length === 4) [dx, dy, dw, dh] = a;
        else { [dx, dy] = a; dw = sw; dh = sh; }
        const tr = this.getTransform();
        // 平行移動だけ反映(左右反転の scale(-1,1) は幅の符号で扱う)
        const X = tr.a * dx + tr.e, Y = tr.d * dy + tr.f, Wd = Math.abs(tr.a * dw), Hd = Math.abs(tr.d * dh);
        const x0 = tr.a < 0 ? X - Wd : X;
        window.__draws.push([idOf(img) + ':' + Math.round(sx) + ',' + Math.round(sy) + ',' + Math.round(sw) + ',' + Math.round(sh) + (tr.a < 0 ? ':flip' : ''), x0, Y, Wd, Hd]);
      }
    } catch (e) { /* 観測のみ */ }
    return orig.call(this, img, ...a);
  };
};

async function measure(browser, v) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 832 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT[v]}/dist/index.html?seed=1&debug=1&mute=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__GAME__ && window.__GAME__.snapshot, null, { timeout: 8000 });
  await page.keyboard.down('Enter'); await sleep(45); await page.keyboard.up('Enter');
  await page.waitForFunction(() => window.__GAME__.snapshot().state === 'playing', null, { timeout: 8000, polling: 16 });
  const dbg = (f, ...a) => page.evaluate(([f, a]) => window.__GAME__.debug[f](...a), [f, a]);
  await dbg('godMode', true);
  const out = {};
  for (const type of ['slime', 'bat', 'ghost', 'golem']) {
    await dbg('killAllEnemies');
    await dbg('clearBlocks');
    await sleep(800);
    await dbg('teleport', 1, 9);
    await dbg('spawnEnemy', type, 7, 5);
    await sleep(100);
    // 3 秒間、毎フレームの描画と敵の位置を集める
    const res = await page.evaluate(async () => {
      const frames = [];
      const t0 = performance.now();
      await new Promise((resolve) => {
        const tick = () => {
          const s = window.__GAME__.snapshot();
          window.__draws = [];
          requestAnimationFrame(() => {
            const d = window.__draws; window.__draws = null;
            const e = s.enemies.find((q) => q.alive);
            frames.push({ e: e ? { x: e.x, y: e.y } : null, p: { x: s.player.x, y: s.player.y }, d });
            if (performance.now() - t0 < 3000) tick(); else resolve();
          });
        };
        tick();
      });
      return frames;
    });
    const near = new Map(), other = new Set();
    let moved = 0, lastPos = null;
    for (const f of res) {
      if (!f.e) continue;
      if (lastPos && (Math.abs(lastPos.x - f.e.x) + Math.abs(lastPos.y - f.e.y)) > 0.001) moved++;
      lastPos = f.e;
      const ex = f.e.x * 32, ey = 64 + f.e.y * 32;
      for (const [k, x, y, w, h] of f.d) {
        if (w < 16 || h < 16 || w > 48 || h > 48) { other.add(k); continue; }
        const cx = x + w / 2, cy = y + h / 2;
        if (Math.abs(cx - (ex + 16)) <= 6 && Math.abs(cy - (ey + 16)) <= 12) near.set(k, (near.get(k) || 0) + 1);
        else other.add(k);
      }
    }
    const keys = [...near.entries()].filter(([k]) => !other.has(k));
    out[type] = { frames: res.length, movedFrames: moved, spriteKinds: keys.length, perKindDraws: keys.map(([, n]) => n) };
  }
  await ctx.close();
  return out;
}

(async () => {
  const browser = await chromium.launch();
  const all = {};
  for (const v of V) {
    all[v] = await measure(browser, v);
    console.log(v, JSON.stringify(Object.fromEntries(Object.entries(all[v]).map(([t, x]) => [t, `${x.spriteKinds} kinds (moved ${x.movedFrames}/${x.frames})`]))));
  }
  await browser.close();
  fs.writeFileSync(path.join(__dirname, 'walk-frames.json'), JSON.stringify({ method: 'drawImage の元(画像+矩形+反転)のうち、歩いている敵の位置にだけ描かれた種類の数。3 秒間。ステージ 1・seed=1・岩なし', results: all }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
