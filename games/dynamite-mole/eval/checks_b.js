'use strict';
// B 群: 移動(M11,M12)、爆弾(M13,M14,M15)、CPU スロットリング(M38)
const L = require('./lib');
const { sleep, snap, dbg, tap, waitState, startPlaying, startRec, stopRec, simulateFlames, freeCells } = L;

function crossTime(frames, sel, X, from = 0) {
  for (let i = Math.max(1, from); i < frames.length; i++) {
    const a = sel(frames[i - 1]), b = sel(frames[i]);
    if (a < X && b >= X) return frames[i - 1].t + ((X - a) / (b - a)) * (frames[i].t - frames[i - 1].t);
  }
  return null;
}
const isInt = (v, tol = 0.02) => Math.abs(v - Math.round(v)) < tol;

async function moveSpeed(env, page, { interval = 10 } = {}) {
  // (1,1) から右へ押しっぱなし。clearBlocks 済みの前提。x=3 → x=9 の 6 タイルを測る
  await L.dbg(env, page, 'teleport', 1, 1);
  await sleep(150);
  await startRec(page, { interval });
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__GAME__.snapshot().player.x >= 11.2, null, { timeout: 6000, polling: 16 });
  await page.keyboard.up('ArrowRight');
  await sleep(450);
  const fr = await stopRec(page);
  const tA = crossTime(fr, (f) => f.player.x, 3);
  const tB = crossTime(fr, (f) => f.player.x, 9);
  const moving = fr.filter((f) => f.player.x > 1.2 && f.player.x < 11);
  const fracMid = moving.filter((f) => !isInt(f.player.x, 0.05)).length / Math.max(1, moving.length);
  const last = fr[fr.length - 1];
  return { speed: tA && tB ? 6 / ((tB - tA) / 1000) : null, perTile: tA && tB ? (tB - tA) / 6000 : null, fracMid, stopX: last.player.x, stopInt: isInt(last.player.x), nFrames: fr.length };
}

async function m11(env) {
  const notes = [];
  let ok = true;
  let p = await env.open('debug=1&seed=1');
  await startPlaying(p.page);
  await dbg(env, p.page, 'godMode', true);
  await dbg(env, p.page, 'clearBlocks');
  const ms = await moveSpeed(env, p.page);
  const perOk = ms.perTile && Math.abs(ms.perTile - 0.2222) / 0.2222 <= 0.2;
  if (!perOk) ok = false;
  if (ms.fracMid < 0.5) { ok = false; notes.push('中間位置(補間)が取れていない'); }
  if (!ms.stopInt) { ok = false; notes.push(`キーを離した後タイル中心で止まらない x=${ms.stopX}`); }
  const mv = `速度 ${ms.speed && ms.speed.toFixed(2)} タイル/秒(1 タイル ${ms.perTile && ms.perTile.toFixed(3)}s、基準 0.222s ±20%)${perOk ? '' : ' NG'}、移動中の中間 x 割合 ${(ms.fracMid * 100).toFixed(0)}%、離した後 x=${ms.stopX.toFixed(3)}${ms.stopInt ? '(タイル中心)' : ' NG'}`;
  // 壁・柱
  await dbg(env, p.page, 'teleport', 1, 1);
  await sleep(100);
  await p.page.keyboard.down('ArrowUp'); await sleep(300); await p.page.keyboard.up('ArrowUp');
  await p.page.keyboard.down('ArrowLeft'); await sleep(300); await p.page.keyboard.up('ArrowLeft');
  let s = await snap(p.page);
  const wallOk = s.player.col === 1 && s.player.row === 1;
  await dbg(env, p.page, 'teleport', 2, 1);
  await sleep(100);
  await p.page.keyboard.down('ArrowDown'); await sleep(350); await p.page.keyboard.up('ArrowDown');
  s = await snap(p.page);
  const pillarOk = s.player.col === 2 && s.player.row === 1;
  await env.done(p);
  // 岩(clearBlocks なしの別ページ)
  p = await env.open('debug=1&seed=1');
  await startPlaying(p.page);
  await dbg(env, p.page, 'godMode', true);
  s = await snap(p.page);
  let rockTest = null;
  const dirs = [['ArrowRight', 1, 0], ['ArrowLeft', -1, 0], ['ArrowDown', 0, 1], ['ArrowUp', 0, -1]];
  outer: for (const [c, r] of freeCells(s.grid)) {
    if (c === 1 && r === 1) continue;
    for (const [key, dc, dr] of dirs) if (s.grid[r + dr] && s.grid[r + dr][c + dc] === 'S') { rockTest = { c, r, key, dc, dr }; break outer; }
  }
  let rockOk = false;
  if (rockTest) {
    await dbg(env, p.page, 'teleport', rockTest.c, rockTest.r);
    await sleep(100);
    await p.page.keyboard.down(rockTest.key); await sleep(500); await p.page.keyboard.up(rockTest.key);
    const s2 = await snap(p.page);
    rockOk = s2.player.col === rockTest.c && s2.player.row === rockTest.r && s2.grid[rockTest.r + rockTest.dr][rockTest.c + rockTest.dc] === 'S';
  }
  await env.done(p);
  if (!wallOk || !pillarOk || !rockOk) ok = false;
  env.rec('M11', ok, `${mv}。外壁 ${wallOk ? '通れない' : '通れた NG'}、柱 ${pillarOk ? '通れない' : '通れた NG'}、岩 ${rockOk ? '通れない' : (rockTest ? '通れた NG' : '検証できる配置なし')}(爆弾のマスは M13)。${notes.join(' ')}`);
  env.extra.moveSpeed = ms.speed;
}

async function m12(env) {
  const p = await env.open('debug=1&seed=1');
  await startPlaying(p.page);
  await dbg(env, p.page, 'godMode', true);
  await dbg(env, p.page, 'clearBlocks');
  await dbg(env, p.page, 'teleport', 1, 1);
  await sleep(150);
  const results = [];
  // (1,1)→(2,1)→(3,1)→(3,2)→(3,1)→(2,1)→(3,1) と歩き(奇数列でだけ縦に動ける)、最後は 8ms の超短タップで往復
  const seq = [['ArrowRight', 1, 0, 40], ['ArrowRight', 1, 0, 40], ['ArrowDown', 0, 1, 40], ['ArrowUp', 0, -1, 40], ['ArrowLeft', -1, 0, 40], ['ArrowRight', 1, 0, 40], ['ArrowRight', 1, 0, 8], ['ArrowRight', 1, 0, 8], ['ArrowRight', 1, 0, 8], ['ArrowLeft', -1, 0, 8], ['ArrowLeft', -1, 0, 8]];
  for (const [key, dc, dr, ms] of seq) {
    const a = await snap(p.page);
    await tap(p.page, key, ms);
    await sleep(420);
    const b = await snap(p.page);
    const ok = b.player.col === a.player.col + dc && b.player.row === a.player.row + dr && isInt(b.player.x) && isInt(b.player.y);
    results.push(ok);
    if (!ok) results.push(`(${key} ${ms}ms: (${a.player.col},${a.player.row})→(${b.player.col},${b.player.row}) x=${b.player.x.toFixed(2)})`);
  }
  const tapOk = results.every((r) => r === true);
  // 後から押したキーが優先
  await dbg(env, p.page, 'teleport', 1, 1);
  await sleep(200);
  await p.page.keyboard.down('ArrowDown');
  await p.page.waitForFunction(() => window.__GAME__.snapshot().player.y > 2.3, null, { timeout: 3000, polling: 'raf' });
  await p.page.keyboard.down('ArrowRight');
  await sleep(600);
  const s = await snap(p.page);
  await p.page.keyboard.up('ArrowRight');
  await p.page.keyboard.up('ArrowDown');
  await sleep(300);
  // 後押し Right が優先 → (1,3) で右へ進み row 3 のまま。旧方向(Down)が優先されるなら row 4 以降へ進む
  const lastWins = s.player.row === 3 && s.player.col >= 2;
  // 塞がっている方向が最後に押された場合は動かない
  await dbg(env, p.page, 'teleport', 2, 1);
  await sleep(150);
  await p.page.keyboard.down('ArrowRight');
  await sleep(30);
  await p.page.keyboard.down('ArrowDown'); // (2,2) は柱: 後押しの Down は塞がっている
  await sleep(700);
  const s3 = await snap(p.page);
  await p.page.keyboard.up('ArrowDown'); await p.page.keyboard.up('ArrowRight');
  const blockedLast = s3.player.col <= 3; // 最初の 1 ステップ(バッファ含む)以上は進まない
  await env.done(p);
  env.rec('M12', tapOk && lastWins, `タップ(40ms x6 / 8ms x5)で毎回ちょうど 1 タイル: ${tapOk ? `${results.length}/${results.length}` : results.filter((x) => x !== true).join(' ')}、Down 押しっぱなし中に Right を追加 → ${lastWins ? `後押し優先で (${s.player.col},${s.player.row}) へ右折` : `右折せず (${s.player.col},${s.player.row}) NG`}、後押しが塞がっているとき ${blockedLast ? '止まる' : '進み続けた'}(col=${s3.player.col})`);
}

async function m13(env) {
  const p = await env.open('debug=1&seed=1');
  await startPlaying(p.page);
  await dbg(env, p.page, 'godMode', true);
  const notes = [];
  let ok = true;
  await L.press(p.page, 'Space');
  await sleep(80);
  let s = await snap(p.page);
  const placed = s.bombs.length === 1 && s.bombs[0].col === 1 && s.bombs[0].row === 1 && s.bombs[0].timeLeft > 2.3 && s.bombs[0].timeLeft <= 2.5;
  if (!placed) { ok = false; notes.push(`Space で爆弾が置かれない/timeLeft 異常 ${JSON.stringify(s.bombs)}`); }
  await L.press(p.page, 'Space');
  await sleep(80);
  s = await snap(p.page);
  if (s.bombs.length !== 1) { ok = false; notes.push('同じタイルに 2 個目が置かれた'); }
  await tap(p.page, 'ArrowRight', 40);
  await sleep(350);
  await L.press(p.page, 'Space');
  await sleep(80);
  s = await snap(p.page);
  const maxOne = s.bombs.length === 1 && s.player.activeBombs === 1;
  if (!maxOne) { ok = false; notes.push(`最大同時爆弾数 1 のとき 2 個目が置かれた(bombs=${s.bombs.length})`); }
  // 爆弾のマスへは戻れない
  await p.page.keyboard.down('ArrowLeft'); await sleep(450); await p.page.keyboard.up('ArrowLeft');
  s = await snap(p.page);
  const noReturn = s.player.col === 2 && s.player.row === 1;
  if (!noReturn) { ok = false; notes.push(`爆弾のマスに戻れた(col=${s.player.col})`); }
  // アニメーション(爆弾マスの絵が時間で変わる)
  await startRec(p.page, { interval: 20, crops: '(s.bombs.length ? [{k:"b", x: s.bombs[0].col*32, y: 64+s.bombs[0].row*32}] : [])' });
  await sleep(1000);
  const fr = await stopRec(p.page);
  const hashes = new Set(fr.filter((f) => f.crops && f.crops.b !== undefined && f.bombs.length).map((f) => f.crops.b));
  const animated = hashes.size >= 2;
  if (!animated) { ok = false; notes.push('爆弾の絵が時間で変化しない(静止画)'); }
  // 爆発後に Z でも置ける・2 個目が置ける
  await p.page.waitForFunction(() => window.__GAME__.snapshot().bombs.length === 0, null, { timeout: 4000, polling: 50 });
  await sleep(700);
  await L.press(p.page, 'KeyZ');
  await sleep(80);
  s = await snap(p.page);
  const zOk = s.bombs.length === 1;
  if (!zOk) { ok = false; notes.push('Z キーで爆弾が置けない'); }
  await env.done(p);
  env.rec('M13', ok, `Space で所属タイルに置く(bombs=1, timeLeft≈2.5)${placed ? '' : ' NG'}、重ね置き不可、最大 1 のとき 2 個目不可、爆弾マスへ戻れない=${noReturn}、爆弾の絵の変化 ${hashes.size} 種(アニメ${animated ? 'あり' : 'なし'})、Z キー ${zOk ? 'OK' : 'NG'}。${notes.join(' ')}`);
}

async function m14(env) {
  const p = await env.open('debug=1&seed=1');
  await startPlaying(p.page);
  await dbg(env, p.page, 'godMode', true);
  const s0 = await snap(p.page);
  // 岩と壁の両方が射程に入る位置を選ぶ
  let best = null;
  for (const [c, r] of freeCells(s0.grid)) {
    if (c === 1 && r === 1) continue;
    const sim = simulateFlames(s0.grid, [{ col: c, row: r, range: 2 }], [0]);
    if (sim.broken.length >= 1 && sim.flames.size <= 8) {
      const d = Math.min(...s0.enemies.map((e) => Math.abs(e.col - c) + Math.abs(e.row - r)));
      if (!best || d > best.d) best = { c, r, d, sim };
    }
  }
  if (!best) { env.rec('M14', null, '検証できる配置が見つからない'); await env.done(p); return; }
  await dbg(env, p.page, 'teleport', best.c, best.r);
  await sleep(150);
  const before = await snap(p.page);
  await startRec(p.page, { interval: 10 });
  await L.press(p.page, 'Space');
  await sleep(3600);
  const fr = await stopRec(p.page);
  const iB = fr.findIndex((f) => f.bombs.length > 0);
  const iF = fr.findIndex((f) => f.flames.length > 0);
  const iG = fr.findIndex((f, i) => i > iF && iF >= 0 && f.flames.length === 0);
  const notes = [];
  let ok = iB >= 0 && iF >= 0 && iG >= 0;
  let fuse = null, life = null, setOk = false, brokenOk = false, wallFlame = false;
  if (ok) {
    fuse = (fr[iF].t - fr[iB].t) / 1000;
    life = (fr[iG].t - fr[iF].t) / 1000;
    const got = new Set(fr[iF].flames.map((f) => `${f.col},${f.row}`));
    const exp = best.sim.flames;
    setOk = got.size === exp.size && [...exp].every((k) => got.has(k));
    if (!setOk) notes.push(`炎の位置が仕様と不一致 got=${[...got].sort()} exp=${[...exp].sort()}`);
    for (const f of fr) for (const fl of f.flames) if (before.grid[fl.row][fl.col] === '#') wallFlame = true;
    const after = fr[iG].grid;
    brokenOk = true;
    for (let r = 0; r < 11; r++) for (let c = 0; c < 15; c++) {
      const was = before.grid[r][c], now = after[r][c];
      const shouldBreak = best.sim.broken.includes(`${c},${r}`);
      if (shouldBreak && now !== '.') brokenOk = false;
      if (!shouldBreak && was !== now) brokenOk = false;
    }
    if (Math.abs(fuse - 2.5) > 0.3) ok = false;
    if (Math.abs(life - 0.5) > 0.15) ok = false;
    if (!setOk || wallFlame || !brokenOk) ok = false;
  } else notes.push('爆発/炎の観測に失敗');
  await env.done(p);
  env.rec('M14', ok, `位置(${best.c},${best.r}) range2: 導火線 ${fuse && fuse.toFixed(3)}s(2.5±0.3)、炎の寿命 ${life && life.toFixed(3)}s(0.5±0.15)、炎マスが仕様の予測と${setOk ? '一致' : '不一致'}(${best.sim.flames.size} マス)、壁マスに炎${wallFlame ? 'あり NG' : 'なし'}、岩は予測どおり ${brokenOk ? '壊れ' : '不整合 NG'}(壊れる予定 ${best.sim.broken.join(' ')})。${notes.join(' ')}`);
  env.extra.fuse = fuse; env.extra.flameLife = life;
}

async function m15(env) {
  const p = await env.open('debug=1&seed=1');
  await startPlaying(p.page);
  await dbg(env, p.page, 'godMode', true);
  await dbg(env, p.page, 'setPowerups', { maxBombs: 2 });
  await dbg(env, p.page, 'clearBlocks');
  await dbg(env, p.page, 'teleport', 1, 1);
  await sleep(150);
  const s0 = await snap(p.page);
  await startRec(p.page, { interval: 10 });
  await L.press(p.page, 'Space'); // A at (1,1)
  await sleep(900);
  await dbg(env, p.page, 'teleport', 3, 1);
  await sleep(150);
  await L.press(p.page, 'Space'); // B at (3,1): A の射程(2)内
  await sleep(3400);
  const fr = await stopRec(p.page);
  const iF = fr.findIndex((f) => f.flames.length > 0);
  let ok = iF > 0;
  const notes = [];
  let chainOk = false, setOk = false, remain = null;
  if (ok) {
    const prev = fr[iF - 1];
    const bB = prev.bombs.find((b) => b.col === 3 && b.row === 1);
    remain = bB ? bB.timeLeft : null;
    const exp = simulateFlames(s0.grid, [{ col: 1, row: 1, range: 2 }, { col: 3, row: 1, range: 2 }], [0]);
    const got = new Set(fr[iF].flames.map((f) => `${f.col},${f.row}`));
    setOk = got.size === exp.flames.size && [...exp.flames].every((k) => got.has(k));
    chainOk = fr[iF].bombs.length === 0 && remain !== null && remain > 0.5;
    ok = chainOk && setOk;
    if (!chainOk) notes.push(`B が同時に爆発していない(B の残り ${remain}、爆発後の bombs=${fr[iF].bombs.length})`);
    if (!setOk) notes.push(`炎の範囲が連鎖後の予測と不一致 got=${[...got].sort()} exp=${[...exp.flames].sort()}`);
  } else notes.push('爆発を観測できず');
  await env.done(p);
  env.rec('M15', ok, `A(1,1)→B(3,1) を置いた連鎖: A の爆発フレームで B(残り ${remain && remain.toFixed(2)}s)も同時に爆発=${chainOk}、炎の範囲が連鎖後の予測(B の腕を含む)と${setOk ? '一致' : '不一致'}。自爆(爆風がプレイヤーに当たる)は M16 で確認。${notes.join(' ')}`);
}

async function m38(env) {
  const p = await env.open('debug=1&seed=1', { tag: 'throttle' });
  const cdp = await p.ctx.newCDPSession(p.page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await startPlaying(p.page);
  await dbg(env, p.page, 'godMode', true);
  await dbg(env, p.page, 'clearBlocks');
  const notes = [];
  // 導火線
  await startRec(p.page, { interval: 32 });
  await L.press(p.page, 'Space');
  await sleep(3400);
  let fr = await stopRec(p.page);
  const iB = fr.findIndex((f) => f.bombs.length > 0), iF = fr.findIndex((f) => f.flames.length > 0);
  const fuse = iB >= 0 && iF >= 0 ? (fr[iF].t - fr[iB].t) / 1000 : null;
  // タイマー
  const t1 = await snap(p.page); const w1 = Date.now();
  await sleep(4000);
  const t2 = await snap(p.page); const w2 = Date.now();
  const timerRate = (t1.timeLeft - t2.timeLeft) / ((w2 - w1) / 1000);
  // 移動
  const ms = await moveSpeed(env, p.page, { interval: 32 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await env.done(p);
  const fuseOk = fuse !== null && Math.abs(fuse - 2.5) <= 0.3;
  const timerOk = Math.abs(timerRate - 1) <= 0.1;
  const tileOk = ms.perTile && Math.abs(ms.perTile - 0.2222) / 0.2222 <= 0.2;
  env.rec('M38', fuseOk && timerOk && tileOk, `CPU 4x スロットリング下: 導火線 ${fuse && fuse.toFixed(3)}s(2.5±0.3)${fuseOk ? '' : ' NG'}、TIME 減少レート ${timerRate.toFixed(3)} 秒/秒(1±0.1)${timerOk ? '' : ' NG'}、1 タイル ${ms.perTile && ms.perTile.toFixed(3)}s(0.222±20%)${tileOk ? '' : ' NG'}`);
}

module.exports = { m11, m12, m13, m14, m15, m38, moveSpeed, crossTime, isInt };
