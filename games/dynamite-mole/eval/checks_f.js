'use strict';
// F 群: Should のうち自動で測れるもの(S1 タッチ、S2 シェイク、S4 ポップアップ、S6 赤点滅・warn、S9 タブ非表示、S13 カウントアップ)
const L = require('./lib');
const { sleep, snap, dbg, tap, press, waitState, startPlaying, startRec, stopRec } = L;
const C = require('./checks_c');
const D = require('./checks_d');

async function shouldA(env) {
  // ---- S1: タッチ操作 ----
  {
    const notes = [];
    let ok = true;
    const p = await env.open('touch=1&seed=1&debug=1', { viewport: { width: 390, height: 844 }, hasTouch: true, tag: 'S1 touch' });
    const page = p.page;
    // title でキャンバスをタップ → 開始
    const box = await (await page.$('canvas')).boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await waitState(page, 'stageIntro', 3000).catch(() => { ok = false; notes.push('タイトルでキャンバスをタップしても始まらない'); });
    await waitState(page, 'playing', 6000).catch(() => {});
    // DOM のタッチ UI を列挙
    const ui = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('body *').forEach((el) => {
        if (['CANVAS', 'SCRIPT', 'STYLE'].includes(el.tagName) || el.children.length > 0) return; // 末端要素だけ
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (r.width < 8 || r.height < 8 || cs.visibility === 'hidden' || cs.display === 'none') return;
        const text = (el.innerText || '').trim().slice(0, 12);
        const label = el.getAttribute('aria-label') || el.dataset.key || el.dataset.dir || '';
        if (!text && !label) return;
        out.push({ tag: el.tagName, text, label, x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 });
      });
      return out;
    });
    const bomb = ui.find((e) => /BOMB/i.test(e.text + e.label));
    const pause = ui.find((e) => /PAUSE/i.test(e.text + e.label));
    const others = ui.filter((e) => e !== bomb && e !== pause && e.w < 120 && e.h < 120 && e.y > box.y + box.height - 20);
    let dirs = null;
    if (others.length >= 4) {
      const c = others.slice().sort((a, b) => a.cx - b.cx);
      const left = c[0], right = c[c.length - 1];
      const mid = c.slice(1, -1).sort((a, b) => a.cy - b.cy);
      dirs = { left, right, up: mid[0], down: mid[mid.length - 1] };
    }
    if (!bomb || !pause || !dirs) { ok = false; notes.push(`タッチ UI の検出: bomb=${!!bomb} pause=${!!pause} 十字=${others.length}個`); }
    else {
      await dbg(env, page, 'godMode', true);
      await dbg(env, page, 'clearBlocks');
      const s0 = await snap(page);
      await page.mouse.move(dirs.right.cx, dirs.right.cy);
      await page.mouse.down();
      await sleep(500);
      const s1 = await snap(page);
      await page.mouse.up();
      await sleep(400);
      const s2 = await snap(page);
      const s3 = await snap(page);
      const moved = s1.player.x > s0.player.x + 0.5;
      const stopped = Math.abs(s3.player.x - s2.player.x) < 0.01 && Math.abs(s2.player.x - Math.round(s2.player.x)) < 0.02;
      if (!moved) { ok = false; notes.push('十字(右)の押下で動かない'); }
      if (!stopped) { ok = false; notes.push('離しても止まらない'); }
      await page.mouse.move(bomb.cx, bomb.cy);
      await page.mouse.down(); await sleep(120); await page.mouse.up();
      await sleep(150);
      const sb = await snap(page);
      if (sb.bombs.length !== 1) { ok = false; notes.push('BOMB ボタンで爆弾が置かれない'); }
      await page.mouse.move(pause.cx, pause.cy);
      await page.mouse.down(); await sleep(120); await page.mouse.up();
      await sleep(200);
      const sp = await snap(page);
      if (sp.state !== 'paused') { ok = false; notes.push(`PAUSE ボタンで paused にならない(${sp.state})`); }
    }
    const fit = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth, c: document.querySelector('canvas').getBoundingClientRect().toJSON() }));
    const fitOk = fit.sh <= fit.ih && fit.sw <= fit.iw;
    if (!fitOk) { ok = false; notes.push(`390x844 で縦横にスクロール(scrollHeight=${fit.sh}/${fit.ih})`); }
    env.rec('S1', ok, `?touch=1・390x844: 十字/BOMB/PAUSE の DOM ボタン検出=${!!dirs && !!bomb && !!pause}、押している間だけ移動・離すと止まる・BOMB で設置・PAUSE で paused、タイトルのタップで開始、キャンバス ${fit.c.width.toFixed(0)}x${fit.c.height.toFixed(0)} とタッチ UI が縦に収まる=${fitOk}。${notes.join(' ')}`);
    await env.done(p);
  }

  // ---- S2: 画面シェイク(通常 vs prefers-reduced-motion)。外壁/床の境界線(強いエッジ)の位置が動くかで測る ----
  {
    const measure = async (reduced) => {
      const p = await env.open('debug=1&seed=1', { reducedMotion: reduced ? 'reduce' : 'no-preference', tag: `S2 ${reduced}` });
      const page = p.page;
      await startPlaying(page);
      await dbg(env, page, 'godMode', true);
      await dbg(env, page, 'killAllEnemies');
      await dbg(env, page, 'teleport', 13, 9);
      await sleep(700);
      const sample = (ms, n) => page.evaluate(async ({ ms, n }) => {
        const g = document.querySelector('canvas').getContext('2d');
        const lum = (d, i) => d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11;
        const edge = (d, len) => { let best = -1, at = 0; for (let i = 0; i < len - 1; i++) { const v = Math.abs(lum(d, i + 1) - lum(d, i)); if (v > best) { best = v; at = i; } } return at; };
        const out = [];
        for (let i = 0; i < n; i++) {
          const xe = edge(g.getImageData(20, 240, 27, 1).data, 27); // 左の外壁と床の境界(論理 x=32 付近)
          const ye = edge(g.getImageData(240, 84, 1, 27).data, 27); // 上の外壁と床の境界(論理 y=96 付近)
          out.push(xe + ',' + ye);
          await new Promise((r) => setTimeout(r, ms));
        }
        return out;
      }, { ms, n });
      const base = await sample(16, 25);
      await L.press(page, 'Space');
      await dbg(env, page, 'teleport', 1, 1);
      await page.waitForFunction(() => window.__GAME__.snapshot().flames.length > 0, null, { timeout: 5000, polling: 'raf' });
      const during = await sample(12, 40);
      await env.done(p);
      const d = (a) => new Set(a).size;
      return { base: d(base), during: d(during), seen: [...new Set(during)].slice(0, 6).join(' ') };
    };
    const n = await measure(false);
    const r = await measure(true);
    const detected = n.base === 1 && n.during >= 2;
    const suppressed = r.base === 1 && r.during === 1;
    env.rec('S2', detected && suppressed, `爆発中に外壁/床の境界エッジの位置(論理 px)が動くか: 通常 静止時 ${n.base} 種 → 爆発中 ${n.during} 種(${n.seen})、reduced-motion 静止時 ${r.base} 種 → 爆発中 ${r.during} 種。揺れの検出=${detected}、reduce で抑止=${suppressed}`);
  }

  // ---- S4: スコアポップアップ(texts に +N が出て約 0.8 秒で消える) ----
  {
    const p = await env.open('seed=1&debug=1', { tag: 'S4' });
    const page = p.page;
    await startPlaying(page);
    await dbg(env, page, 'godMode', true);
    const r = await C.pinTrial(env, page, 'bat', null); // (1,1) に封じた bat を爆風で倒す(録画は texts 付き)
    const pops = {};
    for (const f of r.fr) for (const t of f.texts || []) { const m = t.match(/^\+(\d+)$/); if (m) (pops[m[1]] = pops[m[1]] || []).push(f.t); }
    // アイテム +50
    await dbg(env, page, 'clearBlocks');
    await dbg(env, page, 'teleport', 1, 1);
    await sleep(700);
    await startRec(page, { interval: 16, texts: true });
    await dbg(env, page, 'spawnItem', 'fire', 2, 1);
    await L.tap(page, 'ArrowRight', 45);
    await sleep(1400);
    const fr2 = await stopRec(page);
    for (const f of fr2) for (const t of f.texts || []) { const m = t.match(/^\+(\d+)$/); if (m && m[1] === '50') (pops['50'] = pops['50'] || []).push(f.t); }
    const summary = Object.entries(pops).map(([v, ts]) => ({ v, dur: (Math.max(...ts) - Math.min(...ts)) / 1000 }));
    const item = summary.find((x) => x.v === '50');
    const enemyPop = summary.find((x) => x.v === '200');
    const okDur = (x) => x && x.dur >= 0.55 && x.dur <= 1.05;
    env.rec('S4', okDur(item) && okDur(enemyPop), `テキストのポップアップ(texts の "+N"): ${summary.map((x) => `+${x.v}=${x.dur.toFixed(2)}s`).join(' ') || '検出なし'}(敵撃破 +200 とアイテム +50 の両方が約 0.8s 表示されることを期待。範囲 0.55〜1.05s)`);
    await env.done(p);
  }

  // ---- S6: 残り時間 30 秒以下の赤点滅・10 秒以下の warn ----
  {
    const p = await env.open('debug=1&seed=1', { tag: 'S6' });
    const page = p.page;
    await startPlaying(page);
    await dbg(env, page, 'godMode', true);
    // TIME 表示帯(右上)の「明るい画素の平均色」が時間で変動するか(赤とピンク/白の点滅)
    const redVar = () => page.evaluate(async () => {
      const g = document.querySelector('canvas').getContext('2d');
      const gs = [], rs = [];
      for (let i = 0; i < 40; i++) {
        const d = g.getImageData(330, 0, 150, 22).data; let n = 0, sg = 0, sr = 0;
        for (let k = 0; k < d.length; k += 4) { const l = d[k] * 0.3 + d[k + 1] * 0.59 + d[k + 2] * 0.11; if (l > 90) { n++; sg += d[k + 1]; sr += d[k]; } }
        gs.push(n ? sg / n : 0); rs.push(n ? sr / n : 0);
        await new Promise((r) => setTimeout(r, 40));
      }
      return { gMin: Math.min(...gs), gMax: Math.max(...gs), rMin: Math.min(...rs), rMax: Math.max(...rs) };
    });
    await dbg(env, page, 'setTimeLeft', 100);
    await sleep(200);
    const normal = await redVar();
    await dbg(env, page, 'setTimeLeft', 25);
    await sleep(200);
    const low = await redVar();
    const flash = low.gMax - low.gMin >= 30 && normal.gMax - normal.gMin < 15;
    await dbg(env, page, 'setTimeLeft', 9.5);
    await sleep(4200);
    const warnN = await page.evaluate(() => window.__sfx.filter((e) => e.name === 'warn').length);
    const warnOk = warnN >= 3 && warnN <= 6;
    env.rec('S6', flash && warnOk, `TIME 30 秒以下で HUD 右上の明るい画素の平均 G 値が時間で変動(点滅): 100 秒時 ${normal.gMin.toFixed(0)}〜${normal.gMax.toFixed(0)}、25 秒時 ${low.gMin.toFixed(0)}〜${low.gMax.toFixed(0)}(R は ${low.rMin.toFixed(0)}〜${low.rMax.toFixed(0)})=${flash}、残り 10 秒以下の 4.2 秒間で warn が ${warnN} 回(1 秒ごとなら 3〜5 回)=${warnOk}`);
    await env.done(p);
  }

  // ---- S9: タブが非表示になったら自動で paused ----
  {
    const p = await env.open('debug=1&seed=1', { tag: 'S9' });
    const page = p.page;
    await startPlaying(page);
    await dbg(env, page, 'godMode', true);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await sleep(300);
    const s = await snap(page);
    env.rec('S9', s.state === 'paused', `visibilitychange(hidden)を発火 → state=${s.state}(疑似的にプロパティを上書きして発火。実際のタブ切替は未計測)`);
    await env.done(p);
  }

  // ---- S13: カウントアップ(stageClear 中にスコア表示が段階的に増える) ----
  {
    const p = await env.open('debug=1&seed=1', { tag: 'S13' });
    const page = p.page;
    await startPlaying(page);
    await dbg(env, page, 'godMode', true);
    await dbg(env, page, 'clearBlocks');
    await dbg(env, page, 'killAllEnemies');
    const nb = await D.neighborOfExit(env, page);
    await dbg(env, page, 'teleport', nb.c, nb.r);
    await sleep(200);
    const ex = (await snap(page)).exit;
    const key = nb.c > ex.col ? 'ArrowLeft' : nb.c < ex.col ? 'ArrowRight' : nb.r > ex.row ? 'ArrowUp' : 'ArrowDown';
    await startRec(page, { interval: 30, texts: true });
    await page.keyboard.down(key);
    await waitState(page, 'stageClear', 3000);
    await page.keyboard.up(key);
    await sleep(3400);
    const fr = await stopRec(page);
    const seen = [];
    for (const f of fr) if (f.state === 'stageClear') { const k = (f.texts || []).filter((t) => /\d/.test(t) && !/^\+\d+$/.test(t) && !/TIME\s*\d/.test(t)).join(' | '); if (seen[seen.length - 1] !== k) seen.push(k); }
    const distinct = seen;
    const countUp = distinct.length >= 3;
    env.extra.countUp = { distinct: distinct.length, values: distinct.slice(0, 8) };
    env.rec('INFO-countup', countUp, `stageClear 中の数値テキストの変化: ${distinct.length} 種。3 種以上ならカウントアップと判定(情報。S13 は喜びポーズ・出口フラッシュ・カウントアップのうち 2 つ以上なので、他は目視)`);
    await env.done(p);
  }
}

module.exports = { shouldA, shouldB: async () => {} };
