'use strict';
// G 群: スクリーンショット・モンタージュ(目視評価の素材)と自動計測(M28)、ファズ(M2)、集計(M2,M34,M36,M40)
const fs = require('fs');
const path = require('path');
const L = require('./lib');
const { sleep, snap, dbg, tap, press, waitState, startPlaying, startRec, stopRec, canvasPng, STAGES } = L;
const D = require('./checks_d');
const C = require('./checks_c');

const save = (env, name, url) => fs.writeFileSync(path.join(env.shotDir, name), Buffer.from(url.split(',')[1], 'base64'));

// 連続キャプチャ(ページ内ループで、フレームのずれを抑える)。crop は s(snapshot)から {x,y,w,h} を返す式
async function burst(page, { n, interval, crop, png = true, lum = false }) {
  return page.evaluate(async ({ n, interval, crop, png, lum }) => {
    const cropFn = crop ? new Function('s', 'return (' + crop + ')') : null;
    const c = document.querySelector('canvas');
    const g2 = c.getContext('2d');
    const hash = (x, y, w, h) => { const d = g2.getImageData(x, y, w, h).data; let hh = 2166136261; for (let i = 0; i < d.length; i++) { hh ^= d[i]; hh = Math.imul(hh, 16777619); } return hh >>> 0; };
    const out = [];
    for (let i = 0; i < n; i++) {
      const s = window.__GAME__.snapshot();
      const cr = cropFn ? cropFn(s) : null;
      let l = null;
      if (lum && cr) {
        const d = g2.getImageData(cr.x, cr.y, cr.w, cr.h).data;
        l = new Array(cr.w * cr.h);
        for (let i = 0; i < l.length; i++) l[i] = Math.round(d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11);
      }
      out.push({ url: png ? c.toDataURL('image/png') : null, crop: cr, h: cr ? hash(cr.x, cr.y, cr.w, cr.h) : null, lum: l, state: s.state, t: performance.now() });
      await new Promise((r) => setTimeout(r, interval));
    }
    return out;
  }, { n, interval, crop, png, lum });
}
// 輝度配列の列を、画素差が小さいものを同じフレームとみなしてクラスタリングする(環境光・火の粉などの小さなノイズに強い)
function clusterFrames(frames, { thr = 28, maxDiff = 14, minSize = 2 } = {}) {
  const reps = [], counts = [], ids = [];
  for (const f of frames) {
    let id = -1;
    for (let r = 0; r < reps.length; r++) {
      let diff = 0;
      for (let i = 0; i < f.length; i++) if (Math.abs(f[i] - reps[r][i]) > thr) { diff++; if (diff > maxDiff) break; }
      if (diff <= maxDiff) { id = r; break; }
    }
    if (id < 0) { reps.push(f); counts.push(0); id = reps.length - 1; }
    counts[id]++; ids.push(id);
  }
  return { frames: counts.filter((c) => c >= minSize).length, ids };
}
const clusterTransitions = (ids) => { let n = 0; for (let i = 1; i < ids.length; i++) if (ids[i] !== ids[i - 1]) n++; return n; };
// 複数フレームの切り出しを 1 枚の PNG に並べる(別ページで合成)
async function montage(env, rows, { scale = 3, gap = 2, label = true } = {}) {
  const page = await env.browser.newPage();
  const url = await page.evaluate(async ({ rows, scale, gap }) => {
    const load = (u) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = u; });
    const imgs = [];
    for (const row of rows) { const r = []; for (const it of row.items) r.push(await load(it.url)); imgs.push(r); }
    const cw = Math.max(...rows.flatMap((r) => r.items.map((it) => (it.crop ? it.crop.w : 480)))) * scale;
    const ch = Math.max(...rows.flatMap((r) => r.items.map((it) => (it.crop ? it.crop.h : 416)))) * scale;
    const W = Math.max(...rows.map((r) => r.items.length)) * (cw + gap) + 4;
    const H = rows.length * (ch + gap) + 4;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#ff00ff'; g.fillRect(0, 0, W, H);
    rows.forEach((row, ri) => row.items.forEach((it, ci) => {
      const c = it.crop || { x: 0, y: 0, w: 480, h: 416 };
      g.drawImage(imgs[ri][ci], c.x, c.y, c.w, c.h, 2 + ci * (cw + gap), 2 + ri * (ch + gap), c.w * scale, c.h * scale);
    }));
    return cv.toDataURL('image/png');
  }, { rows, scale, gap });
  await page.close();
  return url;
}

async function tileStats(page, s) {
  // 各タイル種の中央値色(スプライトが一部重なっても影響を受けにくい)
  return page.evaluate((grid) => {
    const c = document.querySelector('canvas'); const g = c.getContext('2d');
    const med = (x, y) => {
      const d = g.getImageData(x, y, 32, 32).data; const ch = [[], [], []];
      for (let i = 0; i < d.length; i += 4) { ch[0].push(d[i]); ch[1].push(d[i + 1]); ch[2].push(d[i + 2]); }
      return ch.map((a) => a.sort((p, q) => p - q)[a.length >> 1]);
    };
    const find = (chr, filter) => { for (let r = 1; r < 10; r++) for (let cc = 1; cc < 14; cc++) if (grid[r][cc] === chr && (!filter || filter(cc, r))) return [cc, r]; return null; };
    const out = { wall: med(0, 64 + 0), pillar: med(2 * 32, 64 + 2 * 32) };
    const soft = find('S'); if (soft) out.rock = med(soft[0] * 32, 64 + soft[1] * 32);
    const f = find('.', (cc, r) => !(cc === 1 && r === 1) && (cc + r) % 2 === 0); const f2 = find('.', (cc, r) => !(cc === 1 && r === 1) && (cc + r) % 2 === 1);
    if (f) out.floorA = med(f[0] * 32, 64 + f[1] * 32);
    if (f2) out.floorB = med(f2[0] * 32, 64 + f2[1] * 32);
    return out;
  }, s.grid);
}

async function shots(env) {
  const metrics = {};
  const step = async (name, fn) => { try { await fn(); } catch (e) { console.log(`[${env.effort}] shots.${name} failed: ${e.message.split('\n')[0]}`); env.extra.shotErrors = (env.extra.shotErrors || []).concat(`${name}: ${e.message.split('\n')[0]}`); } };

  // --- タイトル・導入・各ステージ ---
  await step('title', async () => {
    const p = await env.open('debug=1&seed=1');
    const page = p.page;
    await snap(page); // title
    const frames = await page.evaluate(async () => {
      const c = document.querySelector('canvas'); const g = c.getContext('2d');
      const hash = (x, y, w, h) => { const d = g.getImageData(x, y, w, h).data; let hh = 2166136261; for (let i = 0; i < d.length; i++) { hh ^= d[i]; hh = Math.imul(hh, 16777619); } return hh >>> 0; };
      const out = [];
      for (let i = 0; i < 12; i++) { out.push({ top: hash(0, 0, 480, 140), mid: hash(0, 140, 480, 140), bot: hash(0, 280, 480, 136), url: i % 4 === 0 ? c.toDataURL('image/png') : null }); await new Promise((r) => setTimeout(r, 250)); }
      return out;
    });
    const distinct = (k) => new Set(frames.map((f) => f[k])).size;
    metrics.titleBands = { top: distinct('top'), mid: distinct('mid'), bot: distinct('bot') };
    const urls = frames.filter((f) => f.url).map((f) => f.url);
    save(env, 'title-0.png', urls[0]);
    save(env, 'title-montage.png', await montage(env, [{ items: urls.map((u) => ({ url: u })) }], { scale: 0.75 }));
    await L.press(page, 'Enter');
    await waitState(page, 'stageIntro', 3000);
    await sleep(900);
    await snap(page); // stageIntro
    save(env, 'intro-1.png', await canvasPng(page));
    await env.done(p);
  });

  const stageStats = {};
  for (let n = 1; n <= 5; n++) {
    await step(`stage${n}`, async () => {
      const p = await env.open(`stage=${n}&seed=1&debug=1`);
      const page = p.page;
      await L.press(page, 'Enter');
      await waitState(page, 'stageIntro', 3000);
      await sleep(900);
      save(env, `intro-s${n}.png`, await canvasPng(page));
      await waitState(page, 'playing', 4000);
      await dbg(env, page, 'godMode', true);
      await sleep(600);
      const s = await snap(page);
      save(env, `play-s${n}.png`, await canvasPng(page));
      stageStats[n] = await tileStats(page, s);
      await env.done(p);
    });
  }
  metrics.stageTiles = stageStats;
  // M28 の数値: 各ステージ対で、タイル種のうち最も違う組の RGB 距離
  {
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const pairs = [];
    for (let i = 1; i <= 5; i++) for (let j = i + 1; j <= 5; j++) {
      if (!stageStats[i] || !stageStats[j]) continue;
      const per = {};
      for (const k of ['wall', 'pillar', 'rock', 'floorA']) if (stageStats[i][k] && stageStats[j][k]) per[k] = dist(stageStats[i][k], stageStats[j][k]);
      pairs.push({ i, j, per, max: Math.max(...Object.values(per)), all: Object.values(per).every((v) => v >= 20) });
    }
    metrics.stagePairs = pairs.map((p) => ({ pair: `${p.i}-${p.j}`, ...Object.fromEntries(Object.entries(p.per).map(([k, v]) => [k, +v.toFixed(0)])) }));
    const minPair = Math.min(...pairs.map((p) => p.max));
    metrics.stageMinPairMax = +minPair.toFixed(0);
    const perTypeMin = {};
    for (const k of ['wall', 'pillar', 'rock', 'floorA']) perTypeMin[k] = +Math.min(...pairs.map((p) => p.per[k] ?? 999)).toFixed(0);
    metrics.stagePerTypeMin = perTypeMin;
  }

  // --- エンティティ一覧(ステージ 4: 敵 4 種全部)・アイテム・出口 ---
  await step('entities', async () => {
    const p = await env.open('stage=4&seed=1&debug=1');
    const page = p.page;
    await startPlaying(page);
    await dbg(env, page, 'godMode', true);
    await dbg(env, page, 'clearBlocks');
    for (const [t, c] of [['fire', 2], ['bomb', 3], ['boots', 4], ['life', 5]]) await dbg(env, page, 'spawnItem', t, c, 1);
    await sleep(500);
    save(env, 'entities.png', await canvasPng(page));
    await dbg(env, page, 'killAllEnemies');
    await sleep(900);
    save(env, 'exit-open.png', await canvasPng(page));
    await env.done(p);
  });

  // --- 爆弾の点滅(S7)・爆発の連続フレーム(パーティクル/シェイク) ---
  await step('bomb', async () => {
    const p = await env.open('debug=1&seed=1');
    const page = p.page;
    await startPlaying(page);
    await dbg(env, page, 'godMode', true);
    await dbg(env, page, 'setPowerups', { range: 3 });
    await dbg(env, page, 'teleport', 7, 5);
    await sleep(300);
    await L.press(page, 'Space');
    await dbg(env, page, 'teleport', 7, 3);
    const fr = await burst(page, { n: 42, interval: 60, crop: '(s.bombs.length ? {x: s.bombs[0].col*32, y: 64+s.bombs[0].row*32, w:32, h:32} : {x:0,y:0,w:32,h:32})' });
    // 点滅速度の測定は、別の爆弾(PNG を作らず 25ms 間隔)で行う
    save(env, 'bomb-strip.png', await montage(env, [{ items: fr.slice(0, 21).map((f) => ({ url: f.url, crop: f.crop })) }, { items: fr.slice(21).map((f) => ({ url: f.url, crop: f.crop })) }], { scale: 3 }));
    await page.waitForFunction(() => window.__GAME__.snapshot().bombs.length === 0, null, { timeout: 4000, polling: 50 });
    await sleep(800);
    await dbg(env, page, 'teleport', 7, 3);
    await sleep(200);
    await dbg(env, page, 'teleport', 7, 5);
    await L.press(page, 'Space');
    await dbg(env, page, 'teleport', 7, 3);
    const bl = await burst(page, { n: 88, interval: 25, png: false, lum: true, crop: '(s.bombs.length ? {x: s.bombs[0].col*32+2, y: 64+s.bombs[0].row*32+2, w:28, h:28} : {x:34,y:98,w:28,h:28})' });
    const t0b = bl[0].t;
    const seg = (a, b) => bl.filter((f) => (f.t - t0b) / 1000 >= a && (f.t - t0b) / 1000 < b);
    const ids = clusterFrames(bl.map((f) => f.lum), { minSize: 1 }).ids;
    const early = ids.filter((_, i) => { const t = (bl[i].t - t0b) / 1000; return t >= 0.2 && t < 1.6; });
    const late = ids.filter((_, i) => { const t = (bl[i].t - t0b) / 1000; return t >= 1.8 && t < 2.4; });
    metrics.bombBlink = { earlyRate: +(clusterTransitions(early) / 1.4).toFixed(2), lateRate: +(clusterTransitions(late) / 0.6).toFixed(2), earlyFrames: early.length, lateFrames: late.length };
    void seg;
    // 爆発の連続フレーム
    await L.press(page, 'Space').catch(() => {});
    const ex = await burst(page, { n: 8, interval: 45 });
    save(env, 'explosion-strip.png', await montage(env, [{ items: ex.slice(0, 4).map((f) => ({ url: f.url, crop: { x: 0, y: 64, w: 480, h: 352 } })) }, { items: ex.slice(4).map((f) => ({ url: f.url, crop: { x: 0, y: 64, w: 480, h: 352 } })) }], { scale: 0.75 }));
    await env.done(p);
  });

  // --- クリア演出(S13): 出口が開く瞬間・ステージクリア中のプレイヤーの連続フレーム ---
  await step('clearfx', async () => {
    const p = await env.open('debug=1&seed=1', { tag: 'clearfx' });
    const page = p.page;
    await startPlaying(page);
    await dbg(env, page, 'godMode', true);
    await dbg(env, page, 'clearBlocks');
    const nb = await D.neighborOfExit(env, page);
    await dbg(env, page, 'teleport', nb.c, nb.r);
    await sleep(400);
    const exCrop = '{x: Math.max(0, s.exit.col*32-16), y: 64+Math.max(0, s.exit.row*32-16), w: 64, h: 64}';
    const openP = burst(page, { n: 14, interval: 55, crop: exCrop });
    await sleep(60);
    await dbg(env, page, 'killAllEnemies');
    const openFrames = await openP;
    await sleep(300);
    const ex = (await snap(page)).exit;
    const key = nb.c > ex.col ? 'ArrowLeft' : nb.c < ex.col ? 'ArrowRight' : nb.r > ex.row ? 'ArrowUp' : 'ArrowDown';
    await page.keyboard.down(key);
    await waitState(page, 'stageClear', 3000);
    await page.keyboard.up(key);
    const plCrop = '{x: Math.max(0, Math.round(s.player.x*32)-16), y: 64+Math.max(0, Math.round(s.player.y*32)-16), w: 64, h: 64}';
    const clearFrames = await burst(page, { n: 20, interval: 100, crop: plCrop });
    save(env, 'clearfx-strip.png', await montage(env, [{ items: openFrames.map((f) => ({ url: f.url, crop: f.crop })) }, { items: clearFrames.slice(0, 14).map((f) => ({ url: f.url, crop: f.crop })) }], { scale: 2 }));
    await env.done(p);
  });

  // --- 爆弾・炎・プレイヤー・敵が、5 ステージすべての床の上で見分けられるか(M37 の目視用) ---
  await step('flames', async () => {
    const bombs = [], flames = [];
    for (let n = 1; n <= 5; n++) {
      const p = await env.open(`stage=${n}&seed=1&debug=1`, { tag: `flames s${n}` });
      const page = p.page;
      await startPlaying(page);
      await dbg(env, page, 'godMode', true);
      await dbg(env, page, 'setPowerups', { range: 3 });
      await dbg(env, page, 'clearBlocks');
      await dbg(env, page, 'teleport', 7, 5);
      await sleep(200);
      await L.press(page, 'Space');
      await dbg(env, page, 'teleport', 8, 5);
      await dbg(env, page, 'spawnEnemy', 'slime', 7, 3);
      await dbg(env, page, 'spawnEnemy', 'bat', 5, 5);
      await sleep(1100);
      const crop = '{x: 7*32-64, y: 64+5*32-64, w: 224, h: 160}';
      const b = await burst(page, { n: 1, interval: 10, crop });
      await page.waitForFunction(() => window.__GAME__.snapshot().flames.length > 0, null, { timeout: 5000, polling: 'raf' });
      const f = await burst(page, { n: 3, interval: 90, crop });
      bombs.push({ url: b[0].url, crop: b[0].crop });
      flames.push({ url: f[1].url, crop: f[1].crop });
      await env.done(p);
    }
    save(env, 'stage-bomb-flame.png', await montage(env, [{ items: bombs }, { items: flames }], { scale: 1 }));
  });

  // --- プレイヤー: 歩行(4 方向)・待機・死亡・復活 ---
  await step('player', async () => {
    const p = await env.open('debug=1&seed=1');
    const page = p.page;
    await startPlaying(page);
    await dbg(env, page, 'godMode', true);
    await dbg(env, page, 'clearBlocks');
    await dbg(env, page, 'killAllEnemies');
    await sleep(600);
    const crop = '{x: Math.round(s.player.x*32)-4, y: 64+Math.round(s.player.y*32)-4, w:40, h:40}';
    const rows = [];
    // 待機(呼吸)
    await dbg(env, page, 'teleport', 1, 1);
    await sleep(200);
    const idle = await burst(page, { n: 24, interval: 120, crop: '{x: 34, y: 98, w: 28, h: 28}', lum: true });
    metrics.playerIdleFrames = clusterFrames(idle.map((f) => f.lum)).frames;
    rows.push({ items: idle.slice(0, 16).map((f) => ({ url: f.url, crop: { x: 28, y: 92, w: 40, h: 40 } })) });
    const walk = async (key, from, n = 16) => {
      await dbg(env, page, 'teleport', from[0], from[1]);
      await sleep(250);
      await page.keyboard.down(key);
      const b = await burst(page, { n, interval: 42, crop });
      await page.keyboard.up(key);
      await sleep(300);
      return b;
    };
    const bR = await walk('ArrowRight', [1, 1]);
    const bL = await walk('ArrowLeft', [12, 1]);
    const bD = await walk('ArrowDown', [1, 1]);
    const bU = await walk('ArrowUp', [1, 9]);
    for (const b of [bR, bL, bD, bU]) rows.push({ items: b.map((f) => ({ url: f.url, crop: f.crop })) });
    save(env, 'player-walk.png', await montage(env, rows, { scale: 2 }));
    await env.done(p);
    // 死亡・復活
    const q = await env.open('debug=1&seed=1');
    await startPlaying(q.page);
    await L.press(q.page, 'Space');
    await q.page.waitForFunction(() => window.__GAME__.snapshot().player.alive === false, null, { timeout: 6000, polling: 16 });
    const death = await burst(q.page, { n: 24, interval: 55, crop });
    await q.page.waitForFunction(() => window.__GAME__.snapshot().player.alive === true, null, { timeout: 3000, polling: 16 });
    const respawn = await burst(q.page, { n: 24, interval: 55, crop });
    save(env, 'player-death-respawn.png', await montage(env, [{ items: death.slice(0, 24).map((f) => ({ url: f.url, crop: f.crop })) }, { items: respawn.map((f) => ({ url: f.url, crop: f.crop })) }], { scale: 2 }));
    save(env, 'death-frame.png', death[6].url);
    await env.done(q);
  });

  // --- 敵の待機アニメ(フレーム数)・ゴーレム被弾・ゴーストの追跡表現 ---
  await step('enemies', async () => {
    const p = await env.open('seed=1&debug=1');
    const page = p.page;
    await startPlaying(page);
    await dbg(env, page, 'godMode', true);
    const idleDistinct = {};
    const rows = [];
    for (const type of ['slime', 'bat', 'ghost', 'golem']) {
      await dbg(env, page, 'killAllEnemies');
      await sleep(700);
      await dbg(env, page, 'setPowerups', { maxBombs: 5, range: 2 });
      await dbg(env, page, 'teleport', 2, 1);
      await sleep(100);
      await L.tap(page, 'Space', 45);
      await dbg(env, page, 'teleport', 1, 2);
      await L.tap(page, 'Space', 45);
      await dbg(env, page, 'spawnEnemy', type, 1, 1);
      await sleep(150);
      const b = await burst(page, { n: 20, interval: 60, crop: '{x:34,y:98,w:28,h:28}', lum: true });
      idleDistinct[type] = clusterFrames(b.map((f) => f.lum)).frames;
      rows.push({ items: b.slice(0, 16).map((f) => ({ url: f.url, crop: f.crop })) });
      await sleep(1000);
      if (type === 'golem') {
        // 被弾の連続フレーム(爆発直後から追従)
        await page.waitForFunction(() => window.__GAME__.snapshot().flames.length > 0, null, { timeout: 4000, polling: 'raf' }).catch(() => {});
        const hit = await burst(page, { n: 16, interval: 55, crop: '(() => { const g = s.enemies.find((e) => e.type==="golem"); return g ? {x: Math.round(g.x*32)-4, y: 64+Math.round(g.y*32)-4, w:40, h:40} : {x:0,y:0,w:32,h:32}; })()' });
        rows.push({ items: hit.map((f) => ({ url: f.url, crop: f.crop })) });
      }
      await sleep(600);
    }
    metrics.enemyIdleFrames = idleDistinct;
    save(env, 'enemy-idle-strips.png', await montage(env, rows, { scale: 2 }));
    // ゴーストの追跡表現: 遠い(距離 > 6)/近い(距離 ≤ 6)
    await dbg(env, page, 'killAllEnemies');
    await sleep(700);
    await dbg(env, page, 'clearBlocks');
    await dbg(env, page, 'teleport', 1, 9);
    await sleep(150);
    await dbg(env, page, 'spawnEnemy', 'ghost', 13, 1);
    const gcrop = '(() => { const g = s.enemies.find((e) => e.type==="ghost" && e.alive); return g ? {x: Math.round(g.x*32)-4, y: 64+Math.round(g.y*32)-4, w:40, h:40} : {x:0,y:0,w:32,h:32}; })()';
    const far = await burst(page, { n: 12, interval: 90, crop: gcrop });
    const farDist = await snap(page);
    await dbg(env, page, 'killAllEnemies');
    await sleep(700);
    await dbg(env, page, 'teleport', 7, 5);
    await sleep(150);
    await dbg(env, page, 'spawnEnemy', 'ghost', 11, 5);
    const near = await burst(page, { n: 12, interval: 90, crop: gcrop });
    save(env, 'ghost-far-near.png', await montage(env, [{ items: far.map((f) => ({ url: f.url, crop: f.crop })) }, { items: near.map((f) => ({ url: f.url, crop: f.crop })) }], { scale: 2 }));
    void farDist;
    await env.done(p);
  });

  // --- 画面: 一時停止・ステージクリア・ゲームオーバー・ゲームクリア ---
  await step('screens', async () => {
    const p = await env.open('debug=1&seed=1');
    const page = p.page;
    await startPlaying(page);
    await dbg(env, page, 'godMode', true);
    await sleep(400);
    await L.press(page, 'KeyP');
    await sleep(250);
    await snap(page); // paused
    save(env, 'paused.png', await canvasPng(page));
    await L.press(page, 'KeyP');
    await sleep(200);
    await dbg(env, page, 'clearBlocks');
    await dbg(env, page, 'killAllEnemies');
    const nb = await D.neighborOfExit(env, page);
    await dbg(env, page, 'teleport', nb.c, nb.r);
    await sleep(200);
    const ex = (await snap(page)).exit;
    const key = nb.c > ex.col ? 'ArrowLeft' : nb.c < ex.col ? 'ArrowRight' : nb.r > ex.row ? 'ArrowUp' : 'ArrowDown';
    await page.keyboard.down(key);
    await waitState(page, 'stageClear', 3000);
    await page.keyboard.up(key);
    await sleep(1200);
    await snap(page); // stageClear
    save(env, 'stageclear.png', await canvasPng(page));
    // S13: スコアのカウントアップ(stageClear 中の SCORE 表示の値が複数あるか)
    await env.done(p);
    const q = await env.open('debug=1&seed=1');
    await startPlaying(q.page);
    await dbg(env, q.page, 'setLives', 1);
    await L.press(q.page, 'Space');
    await waitState(q.page, 'gameOver', 8000);
    await sleep(700);
    await snap(q.page); // gameOver
    save(env, 'gameover.png', await canvasPng(q.page));
    await env.done(q);
    const r = await env.open('debug=1&seed=1&stage=5');
    await L.press(r.page, 'Enter');
    await waitState(r.page, 'playing', 5000);
    await D.playThrough(env, r.page, null, 5);
    await sleep(1200);
    await snap(r.page); // gameClear
    save(env, 'gameclear.png', await canvasPng(r.page));
    await env.done(r);
  });

  await step('touch', async () => {
    const p = await env.open('touch=1&seed=1&debug=1', { viewport: { width: 390, height: 844 }, hasTouch: true, tag: 'touch shot' });
    await sleep(400);
    await p.page.screenshot({ path: path.join(env.shotDir, 'touch-390x844.png') });
    await env.done(p);
  });

  env.extra.shotMetrics = metrics;
  // M28: 数値部分(目視の最終判定は別途)
  const ok28 = metrics.stageMinPairMax >= 40;
  env.rec('M28-auto', ok28, `各ステージ対で、壁/柱/岩/床のうち最も違うタイルの RGB 距離の最小値 ${metrics.stageMinPairMax}(40 以上を目安)。タイル種別ごとの全ステージ対での最小距離 ${JSON.stringify(metrics.stagePerTypeMin)}。目視の最終判定は scrennshot(play-s1〜5.png)で行う`);
}

// ランダム入力(ファズ)で例外・404 が出ないことを確認する
async function fuzz(env) {
  const p = await env.open('debug=1&seed=3', { tag: 'fuzz' });
  const page = p.page;
  const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyZ', 'Enter', 'Escape', 'KeyP', 'KeyR', 'KeyM', 'KeyQ', 'Tab'];
  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const t0 = Date.now();
  let n = 0;
  const states = new Set();
  while (Date.now() - t0 < 45000) {
    const k = keys[Math.floor(rnd() * keys.length)];
    await page.keyboard.down(k);
    await sleep(5 + Math.floor(rnd() * 70));
    await page.keyboard.up(k);
    n++;
    if (n % 25 === 0) { const s = await snap(page); states.add(s.state); if (s.state === 'title' || s.state === 'gameOver' || s.state === 'gameClear') { await sleep(650); await press(page, 'Enter'); } }
    if (n % 200 === 0) { try { await dbg(env, page, 'godMode', rnd() < 0.7); } catch (e) { /* debug 無効時 */ } }
  }
  const s = await snap(page);
  env.extra.fuzz = { events: n, states: [...states], finalState: s.state, issues: p.issues.length };
  await env.done(p);
}

async function final(env) {
  // M2: 全実行で console error / pageerror / 404 が 1 件もない(通しプレイ・gameOver リトライ・ファズを含む)
  const errs = env.issues.filter((i) => !/^external request blocked/.test(i.msg));
  const ext = env.issues.filter((i) => /^external request blocked/.test(i.msg));
  const played = env.results.M26 && env.results.M27 && env.results.M31;
  env.rec('M2', errs.length === 0 && ext.length === 0 && !!played, errs.length === 0 && ext.length === 0 ? `全検証セッション(タイトル→ステージ 1〜5→gameClear、gameOver→リトライ、R/Esc/一時停止、ランダム入力 ${env.extra.fuzz ? env.extra.fuzz.events + ' イベント' : '(ファズ未実行)'})を通して console error・未処理例外・404・外部リクエストが 0 件` : `error/404 あり: ${errs.slice(0, 5).map((e) => `[${e.tag}] ${e.msg}`).join(' | ')} 外部=${ext.length}`);
  // M34: 効果音名
  const must = ['start', 'place', 'explode', 'break', 'enemyDie', 'hit', 'playerDie', 'item', 'life', 'exitOpen', 'stageClear', 'gameOver', 'pause'];
  const got = new Set(env.sfxNames);
  const miss = must.filter((n) => !got.has(n));
  env.rec('M34', miss.length === 0, miss.length ? `sfxLog に残らなかった Must の効果音: ${miss.join(', ')}(観測できた名前: ${[...got].join(', ')})` : `Must の 13 種すべてが sfxLog に残った(その他に観測: ${[...got].filter((n) => !must.includes(n)).join(', ') || 'なし'})`);
  // M36(自動部分): fillText 未使用・外部リクエストなし
  env.extra.fillTextCalls = env.extra.fillTextCalls || 0;
  // M40: スナップショット形式と debug
  const shape = L.SHAPE;
  const states = ['title', 'stageIntro', 'playing', 'paused', 'stageClear', 'gameOver', 'gameClear'];
  const missingStates = states.filter((s) => !shape[s]);
  const badShape = Object.entries(shape).filter(([, v]) => v.bad.length).map(([k, v]) => `${k}: ${v.bad.slice(0, 3).join(',')}`);
  const fns = ['killAllEnemies', 'revealExit', 'clearBlocks', 'teleport', 'setLives', 'setTimeLeft', 'setPowerups', 'spawnItem', 'spawnEnemy', 'godMode'];
  const worked = new Set(env.dbgWorked);
  const notWorked = fns.filter((f) => !worked.has(f));
  const p = await env.open('');
  const noDebug = await p.page.evaluate(() => window.__GAME__.debug === undefined);
  await env.done(p);
  const q = await env.open('debug=1');
  const dbgTypes = await q.page.evaluate((fns) => fns.map((f) => typeof (window.__GAME__.debug || {})[f]), fns);
  await env.done(q);
  const allFns = dbgTypes.every((t) => t === 'function');
  env.rec('M40', !missingStates.length && !badShape.length && noDebug && allFns && !notWorked.length, `snapshot() の形式を 7 状態すべてで検証${missingStates.length ? '(未観測: ' + missingStates.join(',') + ')' : ''}${badShape.length ? ' 不正: ' + badShape.join('; ') : ' OK'}、?debug=1 なしで __GAME__.debug は存在しない=${noDebug}、?debug=1 で 10 関数すべて function=${allFns}、10 関数すべてが他の検証で実際に期待どおり動作=${!notWorked.length}${notWorked.length ? '(未実行: ' + notWorked.join(',') + ')' : ''}。?stage=n で開始ステージ変更は M8/M31 で確認。`);
}

module.exports = { shots, flow: fuzz, final };
