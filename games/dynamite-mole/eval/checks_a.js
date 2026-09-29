'use strict';
// A 群: 起動・配信(M1,M3)、レイアウト(M4,M5,M6,M7)、マップ生成(M8-M10)、キー入力(M39)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const L = require('./lib');
const { sleep, snap, dbg, has, joined, waitState, STAGES, genStage, isWall } = L;

async function withDeepServer(env, fn) {
  const dir = fs.mkdtempSync(path.join(process.env.EVAL_TMP || os.tmpdir(), `deep-${env.effort}-`));
  fs.mkdirSync(path.join(dir, 'x'), { recursive: true });
  fs.symlinkSync(path.resolve(__dirname, '../impl', env.effort), path.join(dir, 'x', 'y'));
  const port = env.port + 100;
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: dir, stdio: 'ignore' });
  await sleep(800);
  try { return await fn(`http://127.0.0.1:${port}`); } finally { srv.kill(); }
}

async function m1(env) {
  const notes = [];
  let ok = true;
  const p = await env.open('');
  const s = await snap(p.page);
  const fav = await p.page.evaluate(async () => {
    const l = document.querySelector('link[rel~="icon"]');
    if (!l) return { link: false };
    const r = await fetch(l.href);
    return { link: true, href: l.getAttribute('href'), status: r.status };
  });
  if (s.state !== 'title') { ok = false; notes.push(`title state=${s.state}`); }
  if (!fav.link || fav.status !== 200) { ok = false; notes.push(`favicon ${JSON.stringify(fav)}`); }
  await L.press(p.page, 'Enter');
  await waitState(p.page, 'playing', 8000).catch(() => { ok = false; notes.push('playing に到達せず'); });
  await sleep(500);
  if (p.issues.length) { ok = false; notes.push(`root: ${p.issues.join('; ')}`); }
  await env.done(p);
  const deep = await withDeepServer(env, async (base) => {
    const q = await env.open('', { base, path: '/x/y/dist/index.html', tag: 'deep' });
    const st = await snap(q.page);
    await L.press(q.page, 'Enter');
    let reached = true;
    await waitState(q.page, 'playing', 8000).catch(() => { reached = false; });
    await sleep(500);
    const res = { state: st.state, reached, issues: [...q.issues] };
    await env.done(q);
    return res;
  });
  if (deep.state !== 'title' || !deep.reached || deep.issues.length) { ok = false; notes.push(`deep(/x/y/dist/): state=${deep.state} reached=${deep.reached} ${deep.issues.join('; ')}`); }
  env.rec('M1', ok, ok ? 'ルート配信・深いサブパス(/x/y/dist/)とも title 表示・playing 到達・404/console error なし・favicon 200' : notes.join(' / '));
}

async function m3(env) {
  const p = await env.open('debug=1&seed=3', { init: () => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } }); }, tag: 'ls-throw' });
  const notes = [];
  let ok = true;
  const s0 = await snap(p.page);
  if (s0.state !== 'title') { ok = false; notes.push(`title state=${s0.state}`); }
  await L.press(p.page, 'Enter');
  await waitState(p.page, 'playing', 8000).catch(() => { ok = false; notes.push('playing に到達せず'); });
  await L.press(p.page, 'KeyM'); // 保存を試みる
  await sleep(100);
  await L.press(p.page, 'KeyM');
  await dbg(env, p.page, 'killAllEnemies');
  await dbg(env, p.page, 'setLives', 1);
  await L.press(p.page, 'Space');
  await waitState(p.page, 'gameOver', 9000).catch(() => { ok = false; notes.push('gameOver に到達せず(ハイスコア保存失敗時)'); });
  await sleep(300);
  if (p.issues.length) { ok = false; notes.push(p.issues.join('; ')); }
  const st = await snap(p.page);
  await env.done(p);
  env.rec('M3', ok, ok ? `localStorage が例外を投げる環境で title→play→mute→gameOver(state=${st.state})まで error なし` : notes.join(' / '));
}

async function m4(env) {
  const views = [[1280, 720], [800, 600], [390, 844]];
  const out = [];
  let ok = true;
  for (const [w, h] of views) {
    const p = await env.open('', { viewport: { width: w, height: h }, tag: `viewport ${w}x${h}` });
    const info = await p.page.evaluate(() => {
      const c = document.querySelector('canvas');
      const r = c.getBoundingClientRect();
      return { w: c.width, h: c.height, rw: r.width, rh: r.height, x: r.x, y: r.y, iw: innerWidth, ih: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, bsw: document.body.scrollWidth, bsh: document.body.scrollHeight, ir: getComputedStyle(c).imageRendering, n: document.querySelectorAll('canvas').length };
    });
    const aspect = info.rw / info.rh;
    const fits = info.x >= -1 && info.y >= -1 && info.x + info.rw <= info.iw + 1 && info.y + info.rh <= info.ih + 1;
    const noScroll = info.sw <= info.iw && info.sh <= info.ih && info.bsw <= info.iw && info.bsh <= info.ih;
    const good = info.w === 480 && info.h === 416 && Math.abs(aspect - 480 / 416) < 0.01 && fits && noScroll && info.ir === 'pixelated';
    // 最大サイズで表示されているか(参考)
    const scale = Math.min(info.iw / 480, info.ih / 416);
    const fill = Math.max(info.rw / (480 * scale), info.rh / (416 * scale));
    out.push(`${w}x${h}: canvas ${info.w}x${info.h} 表示 ${info.rw.toFixed(0)}x${info.rh.toFixed(0)} 比${aspect.toFixed(3)} スクロール${noScroll ? 'なし' : 'あり'} image-rendering=${info.ir} 充填率${(fill * 100).toFixed(0)}% ${good ? 'OK' : 'NG'}`);
    if (!good) ok = false;
    await env.done(p);
  }
  env.rec('M4', ok, out.join(' / '));
}

async function m5m6m7(env) {
  const p = await env.open('debug=1&seed=1');
  const s = await snap(p.page);
  const t = joined(s);
  const checks = {
    'PRESS ENTER TO START': /PRESS ENTER TO START/.test(t),
    'HI-SCORE 6桁': /HI-SCORE\s*\d{6}/.test(t),
    'MOVE': /MOVE/.test(t), 'BOMB': /BOMB/.test(t), 'PAUSE': /PAUSE/.test(t), 'RESTART': /RESTART/.test(t), 'SOUND': /SOUND/.test(t),
    'ARROWS/WASD': /ARROWS\s*\/\s*WASD/.test(t), 'SPACE/Z': /SPACE\s*\/\s*Z/.test(t), 'P/ESC': /P\s*\/\s*ESC/.test(t),
  };
  const logoInTexts = /DYNAMITE MOLE/.test(t);
  const bad5 = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  env.rec('M5', bad5.length === 0, bad5.length ? `title texts に不足: ${bad5.join(', ')}` : `title texts 一式あり(ロゴ文字列は texts に${logoInTexts ? 'あり' : 'なし。画像で描画。目視確認は別途'})。texts=${JSON.stringify(s.texts)}`);
  env.extra.titleTexts = s.texts;

  // M6: stageIntro
  await L.press(p.page, 'Enter');
  await waitState(p.page, 'stageIntro', 3000);
  const i0 = await snap(p.page);
  await p.page.keyboard.down('ArrowRight');
  await sleep(700);
  const i1 = await snap(p.page);
  await p.page.keyboard.up('ArrowRight');
  await waitState(p.page, 'playing', 6000);
  await sleep(80); // 遷移ログ(20ms ポーリング)に反映されるのを待つ
  const tr = await p.page.evaluate(() => window.__trans);
  const tIn = tr.find((x) => x.s === 'stageIntro').t;
  const tPl = tr.find((x) => x.s === 'playing').t;
  const dur = (tPl - tIn) / 1000;
  const it = joined(i0);
  const introTexts = /STAGE\s*1/.test(it) && /SHALLOW TUNNELS/.test(it) && /ENEMIES\s*3/.test(it);
  const still = i1.player.col === i0.player.col && i1.player.row === i0.player.row && Math.abs(i1.player.x - i0.player.x) < 0.01;
  const timeFrozen = i1.timeLeft === i0.timeLeft;
  const dOk = Math.abs(dur - 1.8) <= 0.3;
  env.rec('M6', introTexts && still && timeFrozen && dOk && i0.state === 'stageIntro', `Enter→stageIntro 表示 texts=${introTexts ? 'OK' : 'NG ' + it}、stageIntro→playing ${dur.toFixed(2)}s(1.8±0.3)${dOk ? '' : ' NG'}、intro 中の移動入力 ${still ? '無効' : '効いた(NG)'}、timeLeft ${timeFrozen ? '停止' : '動いた(NG)'}`);

  // M7: HUD
  await sleep(200);
  const h = await snap(p.page);
  const ht = joined(h);
  const hud = {
    SCORE: /SCORE\s*000000/.test(ht), HI: /HI\s*\d{6}/.test(ht), TIME: /TIME\s*2:30/.test(ht), STAGE: /STAGE\s*1\/5/.test(ht), LIVES: /[xX]\s*3/.test(ht),
    BOMB: /BOMB\s*1/.test(ht), FIRE: /FIRE\s*2/.test(ht), SPD: /SPD\s*0/.test(ht), SND: /SND\s*(ON|OFF)/.test(ht),
  };
  const badH = Object.entries(hud).filter(([, v]) => !v).map(([k]) => k);
  const lowerX = /x\s*3/.test(ht);
  env.rec('M7', badH.length === 0, badH.length ? `HUD 不足/不一致: ${badH.join(', ')} texts=${JSON.stringify(h.texts)}` : `HUD 全項目が期待値どおり(ライフ表記は ${lowerX ? '"x3"' : '"X3"(大文字)'})。texts=${JSON.stringify(h.texts)}`);
  await env.done(p);
}

async function m8m9m10(env) {
  const seeds = [1, 7, 12345];
  const fails8 = [], fails9 = [];
  let refOk = 0, refTotal = 0;
  const refFails = [];
  for (const seed of seeds) {
    for (let stage = 1; stage <= 5; stage++) {
      const p = await env.open(`stage=${stage}&seed=${seed}&debug=1`, { tag: `gen s${seed} st${stage}` });
      await L.press(p.page, 'Enter');
      await waitState(p.page, 'stageIntro', 3000);
      const s = await snap(p.page);
      await env.done(p);
      const tag = `seed${seed}/stage${stage}`;
      // M8
      let ok8 = s.grid.length === 11 && s.grid.every((r) => r.length === 15);
      if (ok8) {
        for (let r = 0; r < 11; r++) for (let c = 0; c < 15; c++) {
          const ch = s.grid[r][c];
          if (isWall(c, r) ? ch !== '#' : (ch === '#' || (ch !== '.' && ch !== 'S'))) ok8 = false;
        }
        for (const [c, r] of [[1, 1], [2, 1], [3, 1], [1, 2], [1, 3], [3, 2], [2, 3]]) if (s.grid[r][c] === 'S') ok8 = false;
      }
      if (!ok8) fails8.push(tag);
      // M9
      const st = STAGES[stage];
      let ok9 = true;
      const cnt = { slime: 0, bat: 0, ghost: 0, golem: 0 };
      const seen = new Set();
      for (const e of s.enemies) {
        cnt[e.type]++;
        if (Math.abs(e.col - 1) + Math.abs(e.row - 1) < 7) ok9 = false;
        if (s.grid[e.row] && s.grid[e.row][e.col] === 'S') ok9 = false;
        const k = `${e.col},${e.row}`;
        if (seen.has(k)) ok9 = false;
        seen.add(k);
      }
      for (const t of Object.keys(cnt)) if (cnt[t] !== st.en[t]) ok9 = false;
      if (!(s.exit && s.grid[s.exit.row] && s.grid[s.exit.row][s.exit.col] === 'S')) ok9 = false;
      if (!ok9) fails9.push(`${tag} 敵=${JSON.stringify(cnt)} exit=${JSON.stringify(s.exit)}`);
      // 参照(仕様 3.3 のアルゴリズム)との一致
      const ref = genStage(seed, stage);
      const eq = ref.grid.join('/') === s.grid.join('/') && ref.exit.col === s.exit.col && ref.exit.row === s.exit.row &&
        JSON.stringify(ref.enemies.map((e) => `${e.type}@${e.col},${e.row}`).sort()) === JSON.stringify(s.enemies.map((e) => `${e.type}@${e.col},${e.row}`).sort());
      refTotal++;
      if (eq) refOk++; else refFails.push(tag);
    }
  }
  env.rec('M8', fails8.length === 0, fails8.length ? `不変条件違反: ${fails8.join(', ')}` : `seed ${seeds.join('/')} x stage 1-5 の 15 レイアウトすべてで 11x15・壁位置・安全地帯・岩の記号が正しい`);
  env.rec('M9', fails9.length === 0, fails9.length ? `違反: ${fails9.join('; ')}` : '15 レイアウトすべてで敵の数・種類が 3.11 の表どおり、開始位置から距離 7 以上、重複なし、岩の上でない、exit は S のマス');
  env.extra.refMatch = { ok: refOk, total: refTotal, fails: refFails };
  env.rec('EXTRA-REF', refOk === refTotal, `仕様 3.3 の参照アルゴリズム(評価側で独自実装)との一致(grid・exit・敵スポーン): ${refOk}/${refTotal}${refFails.length ? ' 不一致=' + refFails.join(',') : ''}`);

  // M10
  const load = async (q) => { const p = await env.open(q, { tag: 'repro ' + q }); await L.press(p.page, 'Enter'); await waitState(p.page, 'stageIntro', 3000); const s = await snap(p.page); await env.done(p); return s; };
  const key = (s) => JSON.stringify([s.grid, s.exit, s.enemies.map((e) => [e.type, e.col, e.row]).sort()]);
  const a = await load('seed=42&stage=3');
  const b = await load('seed=42&stage=3');
  const c = await load('seed=43&stage=3');
  const d = await load('seed=42&stage=1');
  const e2 = await load('seed=42&stage=1');
  const same = key(a) === key(b) && key(d) === key(e2);
  const diff = key(a) !== key(c);
  env.rec('M10', same && diff, `同一シード 2 回(stage 3 と stage 1): ${same ? '完全一致' : '不一致(NG)'}、別シード: ${diff ? '異なる' : '同じ(NG)'}`);
}

async function m39(env) {
  const p = await env.open('debug=1&seed=5', { viewport: { width: 400, height: 300 }, tag: 'keys' });
  const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
  const perState = {};
  const pressAll = async (label) => {
    await p.page.evaluate(() => { window.__kd.length = 0; });
    for (const k of keys) { await L.tap(p.page, k, 30); await sleep(40); }
    await sleep(60);
    const kd = await p.page.evaluate(() => window.__kd.slice());
    perState[label] = kd.length ? kd.filter((x) => keys.includes(x.code)).every((x) => x.dp) : null;
    return kd;
  };
  await pressAll('title');
  await L.press(p.page, 'Enter');
  await waitState(p.page, 'stageIntro', 3000);
  await pressAll('stageIntro');
  await waitState(p.page, 'playing', 6000);
  await dbg(env, p.page, 'godMode', true);
  const kdp = await pressAll('playing');
  const sy = await p.page.evaluate(() => [scrollX, scrollY]);
  const bad = Object.entries(perState).filter(([, v]) => v === false).map(([k]) => k);
  const ok = perState.playing === true && sy[0] === 0 && sy[1] === 0 && bad.length === 0;
  await env.done(p);
  env.rec('M39', ok, `矢印/Space の keydown が preventDefault 済み: ${JSON.stringify(perState)}、scroll=(${sy})。キー入力はキャンバスをクリックせずに全テストで有効`);
}

module.exports = { m1, m3, m4, m5m6m7, m8m9m10, m39, withDeepServer };
