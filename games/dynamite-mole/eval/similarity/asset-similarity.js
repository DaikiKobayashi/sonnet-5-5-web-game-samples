'use strict';
// 参考実装(opus-medium / fable-high)の絵(スプライト)が既存 5 実装の絵と酷似していないかの画素比較(dynamite-mole 版)。
// games/sunset-rush/eval/scripts/asset-similarity.mjs を参考にしたが、このゲームには ?gallery=1 がなく、絵はすべてコードで
// オフスクリーン canvas に生成されるため、方法を変えた:
//   1. 7 実装に同じ操作列(タイトル → ステージ 1〜5 で歩行・爆弾・アイテム・敵 4 種・出口・撃破・クリア、死亡 → gameOver)を流す。
//   2. その間、CanvasRenderingContext2D.prototype.drawImage を包んで、画面に出ていない canvas / 画像から描かれた
//      「元の矩形」(sx,sy,sw,sh)を、描かれた時点の画素のまま取り出す(同じ元・矩形は 250ms に 1 回まで取り直し、内容のハッシュで重複除去)。
//      ゲームの挙動は変えない(元の drawImage をそのまま呼ぶ)。
//   3. 4〜64 px 角の絵(キャラ・タイル・アイテム・アイコン・字形)を、同じ大きさの絵どうしで比べる:
//      - RGBA が完全一致する絵の数
//      - 最も近い絵との画素距離 D(0〜255。両方透明=0、片方だけ不透明=255、両方不透明=RGB 差の平均)。D ≤ 8 を「ほぼ同一」
//   既存 5 実装どうしの値を「同じ仕様書から独立に作った場合の基準」とする。
// 限界: drawImage を通らない絵(fillRect で直接描く絵)は拾えない。拡大・反転・色替えした流用は D が大きくなり拾えない。
// 使い方: 7 実装のサーバー(5101〜5107)を起動した状態で
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers NODE_PATH=$(npm root -g) node asset-similarity.js [capture|compare]
// 出力: sprites-<variant>.json(取り出した絵。大きいのでコミットしない)、asset-similarity.json(比較結果)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const V = ['low', 'medium', 'high', 'xhigh', 'max', 'opus-medium', 'fable-high'];
const EXIST = V.slice(0, 5);
const REFS = ['opus-medium', 'fable-high'];
const PORT = { low: 5101, medium: 5102, high: 5103, xhigh: 5104, max: 5105, 'opus-medium': 5106, 'fable-high': 5107 };
const OUT = __dirname;
const TMP = process.env.SPRITE_DIR || OUT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const INIT = () => {
  const W = new WeakMap();
  let nid = 0;
  const idOf = (o) => { let i = W.get(o); if (i === undefined) { i = ++nid; W.set(o, i); } return i; };
  const last = new Map();
  const seen = new Set();
  window.__sprites = [];
  const orig = CanvasRenderingContext2D.prototype.drawImage;
  let tmp = null, tctx = null;
  CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) {
    try {
      if (img && !(img instanceof HTMLCanvasElement && img.isConnected) && window.__sprites.length < 6000) {
        let sx = 0, sy = 0, sw = img.width, sh = img.height;
        if (a.length === 8) { [sx, sy, sw, sh] = a; }
        sx = Math.round(sx); sy = Math.round(sy); sw = Math.round(sw); sh = Math.round(sh);
        if (sw >= 4 && sh >= 4 && sw <= 64 && sh <= 64) {
          const key = idOf(img) + ':' + sx + ',' + sy + ',' + sw + ',' + sh;
          const now = performance.now();
          if (!(last.get(key) > now - 250)) {
            last.set(key, now);
            if (!tmp) { tmp = document.createElement('canvas'); tctx = tmp.getContext('2d', { willReadFrequently: true }); }
            tmp.width = sw; tmp.height = sh;
            tctx.clearRect(0, 0, sw, sh);
            orig.call(tctx, img, sx, sy, sw, sh, 0, 0, sw, sh);
            const d = tctx.getImageData(0, 0, sw, sh).data;
            let h = 2166136261;
            for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619); }
            const hk = sw + 'x' + sh + ':' + (h >>> 0);
            if (!seen.has(hk)) {
              seen.add(hk);
              let s = '';
              for (let i = 0; i < d.length; i++) s += String.fromCharCode(d[i]);
              window.__sprites.push({ w: sw, h: sh, px: btoa(s) });
            }
          }
        }
      }
    } catch (e) { /* 観測だけ。失敗しても描画は続ける */ }
    return orig.call(this, img, ...a);
  };
};

async function press(page, key, ms = 45) { await page.keyboard.down(key); await sleep(ms); await page.keyboard.up(key); }
const waitState = (page, st, t = 10000) => page.waitForFunction((s) => window.__GAME__.snapshot().state === s, st, { timeout: t, polling: 16 });
const S = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__GAME__.snapshot())));
const D = (page, fn, ...args) => page.evaluate(([f, a]) => window.__GAME__.debug[f](...a), [fn, args]);

async function capture(browser, v) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 832 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(INIT);
  const all = [];
  const collect = async (page) => { const s = await page.evaluate(() => window.__sprites); all.push(...s); };
  const base = `http://127.0.0.1:${PORT[v]}/dist/index.html`;
  for (let n = 1; n <= 5; n++) {
    const page = await ctx.newPage();
    await page.goto(`${base}?seed=11&stage=${n}&debug=1&mute=1`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__GAME__ && window.__GAME__.snapshot, null, { timeout: 8000 });
    await sleep(n === 1 ? 2500 : 300);
    await press(page, 'Enter');
    await waitState(page, 'stageIntro', 3000);
    await sleep(1000);
    await waitState(page, 'playing', 6000);
    await D(page, 'godMode', true);
    await D(page, 'setPowerups', { maxBombs: 3, range: 3 });
    let s = await S(page);
    const free = [];
    for (let r = 1; r < 10; r++) for (let c = 1; c < 14; c++) if (s.grid[r][c] === '.' && !(c <= 3 && r <= 3)) free.push([c, r]);
    const items = ['fire', 'bomb', 'boots', 'life'];
    const enemies = ['slime', 'bat', 'ghost', 'golem'];
    for (let i = 0; i < 4 && i < free.length; i++) await D(page, 'spawnItem', items[i], free[i][0], free[i][1]).catch(() => {});
    for (let i = 0; i < 4 && 4 + i < free.length; i++) await D(page, 'spawnEnemy', enemies[i], free[free.length - 1 - i][0], free[free.length - 1 - i][1]).catch(() => {});
    await D(page, 'spawnEnemy', 'ghost', 3, 1).catch(() => {});
    for (const k of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) { await page.keyboard.down(k); await sleep(500); await page.keyboard.up(k); }
    await sleep(1500);
    await press(page, 'Space');
    await page.keyboard.down('ArrowDown'); await sleep(450); await page.keyboard.up('ArrowDown');
    await sleep(3200);
    await D(page, 'teleport', 1, 1);
    await press(page, 'Space');
    await sleep(2800);
    await D(page, 'revealExit');
    await sleep(600);
    await D(page, 'killAllEnemies');
    await sleep(1500);
    s = await S(page);
    const ex = s.exit;
    const nb = [[1, 0, 'ArrowLeft'], [-1, 0, 'ArrowRight'], [0, 1, 'ArrowUp'], [0, -1, 'ArrowDown']].find(([dc, dr]) => s.grid[ex.row + dr] && s.grid[ex.row + dr][ex.col + dc] === '.');
    if (nb) {
      await D(page, 'teleport', ex.col + nb[0], ex.row + nb[1]);
      await sleep(200);
      await page.keyboard.down(nb[2]); await sleep(400); await page.keyboard.up(nb[2]);
      await sleep(2600);
    }
    await collect(page);
    await page.close();
  }
  // 死亡 → gameOver、一時停止
  const page = await ctx.newPage();
  await page.goto(`${base}?seed=11&debug=1&mute=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__GAME__ && window.__GAME__.snapshot, null, { timeout: 8000 });
  await press(page, 'Enter');
  await waitState(page, 'playing', 6000);
  await press(page, 'KeyP'); await sleep(600); await press(page, 'KeyP');
  await D(page, 'setLives', 1);
  await press(page, 'Space');
  await sleep(4500);
  await collect(page);
  await page.close();
  await ctx.close();
  return all;
}

// ---- 比較 ----
function decode(sp) {
  const b = Buffer.from(sp.px, 'base64');
  return { w: sp.w, h: sp.h, px: new Uint8Array(b.buffer, b.byteOffset, b.length) };
}
function informative(s) {
  // 不透明画素 16 以上、かつ色が 2 種類以上(単色の塗りは比較から除く)
  let n = 0; const cols = new Set();
  for (let i = 0; i < s.px.length; i += 4) if (s.px[i + 3] > 127) { n++; if (cols.size < 3) cols.add((s.px[i] << 16) | (s.px[i + 1] << 8) | s.px[i + 2]); }
  return n >= 16 && cols.size >= 2;
}
function sig(s) {
  // 4x4 のブロックごとの平均 (R,G,B,不透明率) = 64 次元。候補の絞り込み用
  const g = new Float32Array(64);
  const cnt = new Float32Array(16);
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    const b = Math.min(3, Math.floor((y * 4) / s.h)) * 4 + Math.min(3, Math.floor((x * 4) / s.w));
    const i = (y * s.w + x) * 4;
    const op = s.px[i + 3] > 127 ? 1 : 0;
    g[b * 4] += op * s.px[i]; g[b * 4 + 1] += op * s.px[i + 1]; g[b * 4 + 2] += op * s.px[i + 2]; g[b * 4 + 3] += op * 255;
    cnt[b]++;
  }
  for (let b = 0; b < 16; b++) for (let k = 0; k < 4; k++) g[b * 4 + k] /= cnt[b] || 1;
  return g;
}
function dist(a, b) {
  let d = 0;
  const n = a.px.length / 4;
  for (let i = 0; i < a.px.length; i += 4) {
    const oa = a.px[i + 3] > 127, ob = b.px[i + 3] > 127;
    if (!oa && !ob) continue;
    if (oa !== ob) { d += 255; continue; }
    d += (Math.abs(a.px[i] - b.px[i]) + Math.abs(a.px[i + 1] - b.px[i + 1]) + Math.abs(a.px[i + 2] - b.px[i + 2])) / 3;
  }
  return d / n;
}
const sigd = (p, q) => { let d = 0; for (let i = 0; i < 64; i++) d += Math.abs(p[i] - q[i]); return d; };
const hashOf = (s) => crypto.createHash('sha256').update(s.px).digest('hex').slice(0, 16);

function compare() {
  const SP = {};
  for (const v of V) {
    const raw = JSON.parse(fs.readFileSync(path.join(TMP, `sprites-${v}.json`), 'utf8'));
    SP[v] = raw.map(decode).filter(informative).map((s) => ({ ...s, sig: sig(s), hash: hashOf(s) }));
  }
  const res = { variants: V, method: 'drawImage の元矩形(4〜64px 角)を同じ大きさどうしで比較。D=画素距離(0〜255)、D≤8 をほぼ同一', counts: {}, sizes: {}, pairs: {}, exactAcrossVariants: [] };
  for (const v of V) {
    res.counts[v] = SP[v].length;
    const sz = {}; for (const s of SP[v]) sz[`${s.w}x${s.h}`] = (sz[`${s.w}x${s.h}`] || 0) + 1;
    res.sizes[v] = sz;
  }
  const byHash = {};
  for (const v of V) for (const s of SP[v]) (byHash[s.hash] = byHash[s.hash] || new Set()).add(v);
  for (const [h, set] of Object.entries(byHash)) if (set.size > 1) res.exactAcrossVariants.push([...set]);
  for (const a of V) for (const b of V) {
    if (a === b) continue;
    const bySize = {};
    for (const s of SP[b]) (bySize[`${s.w}x${s.h}`] = bySize[`${s.w}x${s.h}`] || []).push(s);
    let n = 0, exact = 0, near = 0; const ds = []; const nearEx = [];
    for (const s of SP[a]) {
      const cand = bySize[`${s.w}x${s.h}`];
      if (!cand) continue;
      n++;
      // 署名で上位 8 件に絞ってから全画素で距離
      const top = cand.map((c) => [sigd(s.sig, c.sig), c]).sort((p, q) => p[0] - q[0]).slice(0, 8);
      let best = Infinity, bc = null;
      for (const [, c] of top) { const d = c.hash === s.hash ? 0 : dist(s, c); if (d < best) { best = d; bc = c; } }
      if (bc && bc.hash === s.hash) exact++;
      if (best <= 8) { near++; if (nearEx.length < 12) nearEx.push({ size: `${s.w}x${s.h}`, d: +best.toFixed(1), a: s.hash, b: bc.hash }); }
      ds.push(best);
    }
    ds.sort((p, q) => p - q);
    res.pairs[`${a}->${b}`] = { comparable: n, exact, nearDup: near, nearDupRate: n ? +(near / n).toFixed(4) : null, medianNearestD: n ? +ds[Math.floor(n / 2)].toFixed(1) : null, p10NearestD: n ? +ds[Math.floor(n / 10)].toFixed(1) : null, nearExamples: nearEx };
  }
  const pick = (f) => EXIST.flatMap((a) => EXIST.filter((b) => b !== a).map((b) => res.pairs[`${a}->${b}`][f])).filter((x) => x != null).sort((p, q) => p - q);
  const rng = (arr) => ({ min: arr[0], median: arr[Math.floor(arr.length / 2)], max: arr[arr.length - 1] });
  res.summary = {
    existingPairs: { nearDupRate: rng(pick('nearDupRate')), exact: rng(pick('exact')), medianNearestD: rng(pick('medianNearestD')) },
    refs: Object.fromEntries(REFS.map((r) => [r, Object.fromEntries(V.filter((b) => b !== r).map((b) => [b, { to: res.pairs[`${r}->${b}`], from: res.pairs[`${b}->${r}`] }]).map(([b, x]) => [b, { toNearDupRate: x.to.nearDupRate, toExact: x.to.exact, toMedianD: x.to.medianNearestD, fromNearDupRate: x.from.nearDupRate, fromExact: x.from.exact }]))])),
  };
  fs.writeFileSync(path.join(OUT, 'asset-similarity.json'), JSON.stringify(res, null, 1));
  console.log('counts', JSON.stringify(res.counts));
  console.log('existing pairs', JSON.stringify(res.summary.existingPairs));
  for (const [k, p] of Object.entries(res.pairs)) console.log(k.padEnd(26), `n=${p.comparable} exact=${p.exact} near=${p.nearDup} rate=${p.nearDupRate} medD=${p.medianNearestD} p10D=${p.p10NearestD}`);
  console.log('exact matches across variants:', res.exactAcrossVariants.length, JSON.stringify(res.exactAcrossVariants.slice(0, 20)));
}

(async () => {
  const mode = process.argv[2] || 'all';
  if (mode === 'capture' || mode === 'all') {
    const { chromium } = require('playwright');
    const only = process.argv[3] ? process.argv[3].split(',') : V;
    const browser = await chromium.launch();
    for (const v of only) {
      const t = Date.now();
      const sp = await capture(browser, v);
      fs.writeFileSync(path.join(TMP, `sprites-${v}.json`), JSON.stringify(sp));
      console.log(v, 'captured', sp.length, 'sprites in', ((Date.now() - t) / 1000).toFixed(1), 's');
    }
    await browser.close();
  }
  if (mode === 'compare' || mode === 'all') compare();
})().catch((e) => { console.error(e); process.exit(1); });
