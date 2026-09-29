'use strict';
// C 群: 死亡と復活(M16,M17,M18,M19)、敵(M20,M21,M22)
const L = require('./lib');
const { sleep, snap, dbg, tap, waitState, startPlaying, startRec, stopRec, STAGES, BASE_SPEED } = L;

const PLAYER_CROP = '[{k:"p", x: Math.round(s.player.x*32), y: 64+Math.round(s.player.y*32)}]';
const transitions = (arr) => { let n = 0; for (let i = 1; i < arr.length; i++) if (arr[i] !== arr[i - 1]) n++; return n; };
const median = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };

async function m16m17m18(env) {
  const p = await env.open('debug=1&seed=1');
  const page = p.page;
  await startPlaying(page);
  await startRec(page, { interval: 16, crops: PLAYER_CROP });
  const notes = { m16: [], m17: [], m18: [] };
  let ok16 = true, ok17 = true, ok18 = true;
  // A: (1,1) に置いて立ち続ける(自爆)。B: range3 を (1,4) に置き、復活後の無敵中に炎を当てる
  await L.press(page, 'Space');
  await sleep(1400);
  await dbg(env, page, 'setPowerups', { maxBombs: 2, range: 3 });
  await dbg(env, page, 'teleport', 1, 4);
  await sleep(150);
  await L.press(page, 'Space');
  await sleep(200);
  await dbg(env, page, 'teleport', 1, 1);
  await page.waitForFunction(() => window.__GAME__.snapshot().player.alive === false, null, { timeout: 5000, polling: 16 }).catch(() => { ok16 = false; notes.m16.push('炎で死亡しなかった'); });
  await sleep(350);
  const dSnap = await snap(page);
  await page.keyboard.down('ArrowRight'); await sleep(300); await page.keyboard.up('ArrowRight');
  await L.press(page, 'Space');
  await sleep(50);
  const dSnap2 = await snap(page);
  await page.waitForFunction(() => window.__GAME__.snapshot().player.alive === true, null, { timeout: 4000, polling: 16 }).catch(() => { ok17 = false; notes.m17.push('復活しなかった'); });
  const rSnap = await snap(page);
  // B の炎が無敵中の (1,1) に当たる
  await page.waitForFunction(() => window.__GAME__.snapshot().flames.some((f) => f.col === 1 && f.row === 1), null, { timeout: 4000, polling: 16 }).catch(() => notes.m17.push('B の炎が (1,1) に来なかった'));
  await sleep(250);
  const fSnap = await snap(page);
  // 無敵中の敵接触
  const en = fSnap.enemies.find((e) => e.alive);
  let contactInv = null;
  if (en) {
    await dbg(env, page, 'teleport', en.col, en.row);
    await sleep(500);
    contactInv = await snap(page);
  }
  await page.waitForFunction(() => window.__GAME__.snapshot().player.invincible === 0, null, { timeout: 5000, polling: 16 }).catch(() => notes.m17.push('無敵が終わらない'));
  await sleep(250);
  // 無敵が切れたあとの接触 → 死亡、敵は死なない
  const beforeC = await snap(page);
  const en2 = beforeC.enemies.find((e) => e.alive);
  let afterC = null;
  if (en2) {
    await dbg(env, page, 'teleport', en2.col, en2.row);
    await sleep(500);
    afterC = await snap(page);
  }
  const fr = await stopRec(page);
  const sfx = await page.evaluate(() => window.__sfx.map((e) => e.name));
  await env.done(p);

  // ---- 解析 ----
  const iD = fr.findIndex((f) => f.lives === 2 && f.player.alive === false);
  const iR = fr.findIndex((f, i) => i > iD && iD >= 0 && f.player.alive === true);
  let deathDur = null, tlSpan = null, retained = null;
  if (iD >= 0 && iR > 0) {
    deathDur = (fr[iR].t - fr[iD].t) / 1000;
    const seg = fr.slice(iD, iR).map((f) => f.timeLeft);
    tlSpan = Math.max(...seg) - Math.min(...seg);
    const aliveEn = (f) => f.enemies.filter((e) => e.alive).length;
    const gridEq = fr[iD + 3].grid.join('') === fr[iR].grid.join('');
    retained = gridEq && aliveEn(fr[iD + 3]) === aliveEn(fr[iR]);
    if (Math.abs(deathDur - 1.2) > 0.15) { ok16 = false; notes.m16.push(`死亡演出 ${deathDur.toFixed(2)}s`); }
    if (tlSpan > 0.05) { ok16 = false; notes.m16.push(`死亡中に timeLeft が ${tlSpan.toFixed(2)}s 動いた`); }
  } else { ok16 = false; notes.m16.push('死亡→復活を観測できず'); }
  if (dSnap.lives !== 2) { ok16 = false; notes.m16.push(`ライフ ${dSnap.lives}(期待 2)`); }
  const moveBlocked = dSnap2.player.col === dSnap.player.col && dSnap2.player.row === dSnap.player.row && Math.abs(dSnap2.player.x - dSnap.player.x) < 0.01;
  const bombBlocked = !dSnap2.bombs.some((b) => b.col === 1 && b.row === 1);
  if (!moveBlocked) { ok16 = false; notes.m16.push('死亡演出中に移動できた'); }
  if (!bombBlocked) { ok16 = false; notes.m16.push('死亡演出中に爆弾を置けた'); }
  if (!sfx.includes('playerDie')) { ok16 = false; notes.m16.push('sfxLog に playerDie がない'); }
  // M17
  const respawnOk = rSnap.player.col === 1 && rSnap.player.row === 1 && rSnap.player.invincible > 1.6 && rSnap.player.invincible <= 2.0; // 向きは、死亡中に入力しない M17b で確認する
  if (!respawnOk) { ok17 = false; notes.m17.push(`復活状態 (${rSnap.player.col},${rSnap.player.row}) facing=${rSnap.player.facing} invincible=${rSnap.player.invincible}`); }
  if (retained === false) { ok17 = false; notes.m17.push('復活でフィールド(岩・敵)が変化した'); }
  const flameOnInv = fSnap.flames.some((f) => f.col === 1 && f.row === 1) || fr.some((f) => f.player.invincible > 0 && f.flames.some((x) => x.col === 1 && x.row === 1));
  const survivedFlame = fSnap.lives === 2 && fSnap.player.alive;
  if (!(flameOnInv && survivedFlame)) { ok17 = false; notes.m17.push(`無敵中の炎: 炎が当たった=${flameOnInv} 生存=${survivedFlame}`); }
  const survivedContact = contactInv && contactInv.lives === 2 && contactInv.player.alive;
  if (!survivedContact) { ok17 = false; notes.m17.push('無敵中の敵接触で死亡した/検証できず'); }
  // 無敵の長さと点滅
  const iInv0 = fr.findIndex((f, i) => i >= iR && f.player.invincible > 0);
  void 0;
  const iInv1 = fr.findIndex((f, i) => i > iInv0 && iInv0 >= 0 && f.player.invincible === 0);
  let invDur = null, blink = null;
  if (iInv0 >= 0 && iInv1 > 0) {
    invDur = (fr[iInv1].t - fr[iInv0].t) / 1000;
    const seg = fr.slice(iInv0, iInv1).filter((f) => f.player.alive && f.player.col === 1 && f.player.row === 1 && f.crops && f.crops.p !== undefined && f.flames.length === 0 && f.state === 'playing');
    blink = transitions(seg.map((f) => f.crops.p));
    if (Math.abs(invDur - 2.0) > 0.2) { ok17 = false; notes.m17.push(`無敵 ${invDur.toFixed(2)}s`); }
  }
  // M18
  const killedByContact = afterC && afterC.lives === 1 && !afterC.player.alive;
  const enemyAlive = afterC && en2 && afterC.enemies.filter((e) => e.alive).length === beforeC.enemies.filter((e) => e.alive).length;
  if (!killedByContact) { ok18 = false; notes.m18.push(`無敵切れ後の敵接触で死亡しなかった lives=${afterC && afterC.lives}`); }
  if (!enemyAlive) { ok18 = false; notes.m18.push('接触で敵が倒れた/検証できず'); }
  env.rec('M16', ok16, `自爆(範囲内に立つ): ライフ 3→${dSnap.lives}、死亡演出 ${deathDur && deathDur.toFixed(2)}s(1.2±0.15)、死亡中 timeLeft の変化 ${tlSpan !== null ? tlSpan.toFixed(3) : '?'}s、死亡中の移動入力 ${moveBlocked ? '無効' : '有効 NG'}・爆弾設置 ${bombBlocked ? '無効' : '有効 NG'}、sfxLog に playerDie ${sfx.includes('playerDie') ? 'あり' : 'なし'}。${notes.m16.join(' ')}`);
  env.rec('M17', ok17, `復活: (1,1)・invincible=${rSnap.player.invincible.toFixed(2)}s、無敵の長さ ${invDur && invDur.toFixed(2)}s(2.0±0.2)、無敵中の点滅(見た目の変化回数)${blink}、無敵中に B の炎が当たっても生存=${survivedFlame}、無敵中に敵へ接触しても生存=${!!survivedContact}、岩・敵の保持=${retained}。${notes.m17.join(' ')} ※パワーアップ低下は M17b で確認`);
  env.rec('M18', ok18, `無敵切れ後に生存中の敵へ接触 → ライフ 2→${afterC && afterC.lives}(死亡)、敵は倒れない=${!!enemyAlive}。${notes.m18.join(' ')}`);
  env.extra.blinkInvincible = blink;
  env.extra.invDur = invDur;
}

// 復活後の無敵点滅を、プレイヤーのタイル中央の平均輝度の時系列から測る(色に依存しない。半周期と切替回数)
async function blinkProbe(page, col, row) {
  return page.evaluate(async ({ col, row }) => {
    const g = document.querySelector('canvas').getContext('2d');
    const out = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 2300) {
      const d = g.getImageData(col * 32 + 8, 64 + row * 32 + 8, 16, 16).data;
      let s = 0;
      for (let k = 0; k < d.length; k += 4) s += d[k] * 0.3 + d[k + 1] * 0.59 + d[k + 2] * 0.11;
      out.push([performance.now() - t0, s / 256]);
      await new Promise((r) => setTimeout(r, 8));
    }
    const vals = out.map((x) => x[1]);
    const mid = (Math.min(...vals) + Math.max(...vals)) / 2;
    const edges = [];
    for (let i = 1; i < out.length; i++) if ((out[i][1] > mid) !== (out[i - 1][1] > mid)) edges.push(out[i][0]);
    const gaps = edges.slice(1).map((t, i) => t - edges[i]).sort((a, b) => a - b);
    return { toggles: edges.length, halfPeriodMs: gaps.length ? gaps[gaps.length >> 1] : null, range: Math.max(...vals) - Math.min(...vals) };
  }, { col, row });
}

async function m17b(env) {
  const p = await env.open('debug=1&seed=1');
  const page = p.page;
  await startPlaying(page);
  await dbg(env, page, 'killAllEnemies');
  await dbg(env, page, 'setLives', 5);
  await dbg(env, page, 'setPowerups', { maxBombs: 3, range: 4, boots: 2 });
  await sleep(600);
  await L.tap(page, 'Space', 45);
  await page.waitForFunction(() => window.__GAME__.snapshot().player.alive === false, null, { timeout: 6000, polling: 16 });
  await page.waitForFunction(() => window.__GAME__.snapshot().player.alive === true, null, { timeout: 4000, polling: 16 });
  const a = await snap(page);
  const blink = await blinkProbe(page, 1, 1); // 復活直後(無敵中)の 2.3 秒
  await dbg(env, page, 'setPowerups', { maxBombs: 1, range: 2, boots: 0 });
  await L.tap(page, 'Space', 45);
  await page.waitForFunction(() => window.__GAME__.snapshot().player.alive === false, null, { timeout: 6000, polling: 16 });
  await page.waitForFunction(() => window.__GAME__.snapshot().player.alive === true, null, { timeout: 4000, polling: 16 });
  const b = await snap(page);
  await env.done(p);
  {
    const q = await env.open('debug=1&seed=1');
    await startPlaying(q.page);
    await dbg(env, q.page, 'killAllEnemies');
    await sleep(600);
    await L.tap(q.page, 'Space', 45);
    await q.page.waitForFunction(() => window.__GAME__.snapshot().player.alive === false, null, { timeout: 6000, polling: 16 });
    await sleep(350);
    await q.page.keyboard.down('ArrowRight');
    await sleep(300);
    await q.page.keyboard.up('ArrowRight');
    await q.page.waitForFunction(() => window.__GAME__.snapshot().player.alive === true, null, { timeout: 4000, polling: 4 });
    const s1 = await snap(q.page);
    await sleep(300);
    const s2 = await snap(q.page);
    await env.done(q);
    const carried = s1.player.facing !== 'down' || s2.player.col !== 1 || s2.player.row !== 1;
    env.extra.deathInputCarry = { facingAtRespawn: s1.player.facing, colAfter300ms: s2.player.col, carried };
    env.rec('INFO-deathInput', !carried, `死亡演出中に→キーを押して離した場合: 復活直後の向き=${s1.player.facing}、復活 0.3 秒後の位置=(${s2.player.col},${s2.player.row})。押した入力が復活後に持ち越される(向きが down にならない/勝手に 1 歩進む)=${carried}(情報。仕様は死亡中は移動不可・復活時は向き down)`);
  }
  const ok = a.player.maxBombs === 2 && a.player.range === 3 && a.player.boots === 1 && b.player.maxBombs === 1 && b.player.range === 2 && b.player.boots === 0 && a.player.facing === 'down' && a.player.col === 1 && a.player.row === 1;
  const blinkOk = blink.toggles >= 10 && blink.halfPeriodMs !== null && Math.abs(blink.halfPeriodMs - 62.5) <= 20;
  env.extra.invincibleBlink = blink;
  const prev = env.results.M17;
  env.rec('M17b', ok && blinkOk, `復活の向き(入力なし)=${a.player.facing}(期待 down)。死亡時のパワーアップ低下: (爆弾3/range4/ブーツ2) → (${a.player.maxBombs}/${a.player.range}/${a.player.boots})(期待 2/3/1)、最小値 (1/2/0) からは → (${b.player.maxBombs}/${b.player.range}/${b.player.boots})(期待 1/2/0)。復活後の無敵中の点滅(タイル中央の輝度の ON/OFF): 2.3 秒間に ${blink.toggles} 回切替、半周期 ${blink.halfPeriodMs && blink.halfPeriodMs.toFixed(0)}ms(仕様 62.5ms。半周期 ±20ms かつ 10 回以上で合格。輝度差が小さいと切替の検出漏れがあり得る)`);
  if (prev && !(ok && blinkOk)) env.results.M17 = { pass: false, note: prev.note + ' / パワーアップ低下または無敵点滅が仕様と異なる' };
}

async function m19(env) {
  const p = await env.open('debug=1&seed=1');
  const page = p.page;
  await startPlaying(page);
  await dbg(env, page, 'setLives', 1);
  await L.press(page, 'Space');
  await waitState(page, 'gameOver', 9000);
  await sleep(400);
  const s = await snap(page);
  const t = L.joined(s);
  const need = { 'GAME OVER': /GAME OVER/, SCORE: /SCORE\s*\d+/, BEST: /BEST\s*\d+/, 'REACHED STAGE 1': /REACHED STAGE\s*1/, 'ENTER RETRY': /ENTER\s+RETRY/, 'ESC TITLE': /ESC\s+TITLE/ };
  const miss = Object.entries(need).filter(([, re]) => !re.test(t)).map(([k]) => k);
  await env.done(p);
  env.rec('M19', miss.length === 0 && s.state === 'gameOver', miss.length ? `gameOver の texts に不足: ${miss.join(', ')} texts=${JSON.stringify(s.texts)}` : `ライフ 0 → gameOver。texts=${JSON.stringify(s.texts)}`);
}

async function m20(env) {
  // 速度(clearBlocks 済みの開けた場で 5 秒測る。ステージ 4 なので倍率 1.10)
  const p = await env.open('stage=4&seed=1&debug=1');
  const page = p.page;
  await startPlaying(page);
  await dbg(env, page, 'godMode', true);
  await dbg(env, page, 'clearBlocks');
  await sleep(300);
  await startRec(page, { interval: 20 });
  await sleep(6000);
  const fr = await stopRec(page);
  const n = fr[0].enemies.length;
  const per = [];
  let diag = 0, badTile = 0;
  for (let i = 0; i < n; i++) {
    let len = 0;
    for (let k = 1; k < fr.length; k++) {
      const a = fr[k - 1].enemies[i], b = fr[k].enemies[i];
      if (!a || !b) continue;
      const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
      // グリッド線上(x か y のどちらかが整数)にいないフレームを斜め移動とみなす
      if (Math.abs(b.x - Math.round(b.x)) > 0.06 && Math.abs(b.y - Math.round(b.y)) > 0.06) diag++;
      len += dx + dy;
    }
    per.push({ type: fr[0].enemies[i].type, speed: len / ((fr[fr.length - 1].t - fr[0].t) / 1000) });
  }
  const st = STAGES[4];
  const byType = {};
  for (const e of per) (byType[e.type] = byType[e.type] || []).push(e.speed);
  const rows = [];
  let ok = true;
  for (const t of ['slime', 'bat', 'ghost', 'golem']) {
    const exp = BASE_SPEED[t] * st.mult;
    const m = median(byType[t] || []);
    const within = m !== null && Math.abs(m - exp) / exp <= 0.2;
    if (!within) ok = false;
    rows.push(`${t} ${m && m.toFixed(2)}(期待 ${exp.toFixed(2)}${within ? '' : ' NG'})`);
  }
  const batFaster = median(byType.bat) > median(byType.slime) * 1.3;
  if (!batFaster) ok = false;
  await env.done(p);
  // 岩あり・6 秒: 敵が壁・岩・爆弾のマスに入らない
  const q = await env.open('stage=4&seed=1&debug=1');
  await startPlaying(q.page);
  await dbg(env, q.page, 'godMode', true);
  await startRec(q.page, { interval: 25 });
  await sleep(8000);
  const fr2 = await stopRec(q.page);
  const moved = new Set();
  for (const f of fr2) for (let i = 0; i < f.enemies.length; i++) {
    const e = f.enemies[i];
    const c = Math.round(e.x), r = Math.round(e.y);
    if (f.grid[r][c] !== '.') badTile++;
    if (fr2[0].enemies[i] && (Math.abs(e.x - fr2[0].enemies[i].x) > 0.5 || Math.abs(e.y - fr2[0].enemies[i].y) > 0.5)) moved.add(i);
  }
  await env.done(q);
  if (badTile > 0 || diag > 0) ok = false;
  env.rec('M20', ok, `ステージ 4(倍率 1.10)・岩なしで 6 秒測定(経路長/時間の中央値 タイル/秒): ${rows.join('、')}。bat は slime の ${(median(byType.bat) / median(byType.slime)).toFixed(2)} 倍(>1.3 で速いと判定)。グリッド線から外れたフレーム ${diag}、岩ありで 8 秒間に敵が壁/岩のマスに入ったフレーム ${badTile}(移動した敵 ${moved.size}/${n})。見た目の違いは目視(スクリーンショット)で別途確認`);
}

async function m21(env) {
  const p = await env.open('seed=1&debug=1');
  const page = p.page;
  await startPlaying(page);
  await dbg(env, page, 'godMode', true);
  await dbg(env, page, 'killAllEnemies');
  await dbg(env, page, 'clearBlocks');
  await sleep(700);
  await dbg(env, page, 'teleport', 7, 5);
  await sleep(150);
  // プレイヤー(7,5)からのマンハッタン距離 3〜6 の非柱タイルから、固定シードで 16 か所
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const cand = [];
  for (let r = 1; r <= 9; r++) for (let c = 1; c <= 13; c++) { const d = Math.abs(c - 7) + Math.abs(r - 5); if (d >= 3 && d <= 6 && !(r % 2 === 0 && c % 2 === 0)) cand.push([c, r, d]); }
  const trials = [];
  while (trials.length < 16) trials.push(cand.splice(Math.floor(rnd() * cand.length), 1)[0]);
  const run = async (type) => {
    const res = [];
    for (const [gc, gr] of trials) {
      await dbg(env, page, 'spawnEnemy', type, gc, gr);
      await startRec(page, { interval: 40 });
      await sleep(3000);
      const fr = await stopRec(page);
      const d = fr.map((f) => { const e = f.enemies.find((x) => x.type === type && x.alive); return e ? Math.abs(e.x - 7) + Math.abs(e.y - 5) : null; }).filter((x) => x !== null);
      const d0 = d[0], dmin = Math.min(...d);
      res.push({ start: `${gc},${gr}`, d0: +d0.toFixed(1), dmin: +dmin.toFixed(1), ok: dmin <= 1.5 || d0 - dmin >= 2 });
      await dbg(env, page, 'killAllEnemies');
      await sleep(600);
    }
    return res;
  };
  const g = await run('ghost');
  const sl = await run('slime');
  await env.done(p);
  const gr = g.filter((r) => r.ok).length / g.length, sr = sl.filter((r) => r.ok).length / sl.length;
  env.extra.ghostChase = { ghost: gr, slime: sr };
  env.rec('M21', gr >= 0.6 && gr >= sr + 0.25, `ゴーストとスライム(ランダム徘徊の基準線)を、静止したプレイヤーから距離 3〜6 の 16 か所に出現させて 3 秒観察し、接近(最短距離 ≤1.5 か 2 以上縮小)した割合: ゴースト ${g.filter((r) => r.ok).length}/16、スライム ${sl.filter((r) => r.ok).length}/16。ゴーストが 0.6 以上かつスライムより 0.25 以上高ければ「追跡して近づく」と判定。仕様の追跡は「逆走しない・25% 徘徊」なので確率的。ゴースト: ${g.map((r) => `${r.start}:${r.d0}→${r.dmin}`).join(' ')}`);
}

// ゴーレムが炎を受けた直後の点滅(被弾後無敵 0.8 秒)を、ゴーレムのタイル中央の輝度の ON/OFF で測る
async function golemBlink(env, page) {
  await dbg(env, page, 'killAllEnemies');
  await sleep(700);
  await dbg(env, page, 'setPowerups', { maxBombs: 5, range: 2 });
  await dbg(env, page, 'teleport', 2, 1);
  await sleep(100);
  await L.tap(page, 'Space', 45);
  await dbg(env, page, 'teleport', 1, 2);
  await L.tap(page, 'Space', 45);
  await dbg(env, page, 'spawnEnemy', 'golem', 1, 1);
  await sleep(200);
  await page.waitForFunction(() => window.__GAME__.snapshot().flames.length > 0, null, { timeout: 5000, polling: 'raf' });
  const r = await page.evaluate(async () => {
    const g = document.querySelector('canvas').getContext('2d');
    const out = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 1400) {
      const s = window.__GAME__.snapshot();
      const e = s.enemies.find((x) => x.type === 'golem');
      if (e) {
        const d = g.getImageData(Math.max(0, Math.round(e.x * 32) + 8), 64 + Math.round(e.y * 32) + 8, 16, 16).data;
        let sum = 0;
        for (let k = 0; k < d.length; k += 4) sum += d[k] * 0.3 + d[k + 1] * 0.59 + d[k + 2] * 0.11;
        out.push([performance.now() - t0, sum / 256, e.hp]);
      }
      await new Promise((r) => setTimeout(r, 10));
    }
    return out;
  });
  const vals = r.map((x) => x[1]);
  const mid = (Math.min(...vals) + Math.max(...vals)) / 2;
  const edges = [];
  for (let i = 1; i < r.length; i++) if ((r[i][1] > mid) !== (r[i - 1][1] > mid)) edges.push(r[i][0]);
  const span = edges.length ? (edges[edges.length - 1] - edges[0]) / 1000 : 0;
  return { toggles: edges.length, blinkSpanSec: +span.toFixed(2), hp: r.length ? r[r.length - 1][2] : null };
}

// 動けない敵(開始タイル (1,1) の 2 出口を爆弾でふさぐ)に炎を 1 回当てる。after があれば録画を止める前に実行する
async function pinTrial(env, page, type, after) {
  await dbg(env, page, 'killAllEnemies');
  await sleep(700);
  await dbg(env, page, 'setPowerups', { maxBombs: 5, range: 2 });
  await dbg(env, page, 'teleport', 2, 1);
  await sleep(120);
  await startRec(page, { interval: 10, texts: true, crops: '[{k:"e", x:32, y:96}]' });
  // 先に出口 (2,1)/(1,2) を爆弾でふさぎ、その後で (1,1) に敵を出現させる(Y/X の爆発は 0.06 秒差になる)
  await dbg(env, page, 'teleport', 2, 1);
  await L.tap(page, 'Space', 45);
  await dbg(env, page, 'teleport', 1, 2);
  await L.tap(page, 'Space', 45);
  await dbg(env, page, 'spawnEnemy', type, 1, 1);
  await sleep(200);
  const chk = await snap(page);
  const e0 = chk.enemies.find((e) => e.type === type && e.alive);
  const pinned = !!e0 && Math.abs(e0.x - 1) < 0.05 && Math.abs(e0.y - 1) < 0.05;
  if (pinned) {
    await page.waitForFunction(() => { const s = window.__GAME__.snapshot(); return s.flames.length > 0 && s.bombs.length === 0; }, null, { timeout: 8000, polling: 'raf' });
    await sleep(900);
    if (after) await after();
  } else {
    await sleep(3200);
  }
  await sleep(700);
  const fr = await stopRec(page);
  const sfx = await page.evaluate(() => window.__sfx.map((e) => e.name));
  return { fr, sfx, pinned };
}

// 歩いているゴーレムの足元に射程 6 の爆弾を置くのを、倒れるまで繰り返す(1 個ずつ。連鎖させない)
async function chaseGolem(env, page, maxRounds = 12) {
  await dbg(env, page, 'setPowerups', { maxBombs: 1, range: 6 });
  for (let i = 0; i < maxRounds; i++) {
    const s = await snap(page);
    const g = s.enemies.find((e) => e.type === 'golem' && e.alive);
    if (!g) return i;
    await dbg(env, page, 'teleport', Math.round(g.x), Math.round(g.y));
    await sleep(80);
    await L.tap(page, 'Space', 45);
    await page.waitForFunction(() => window.__GAME__.snapshot().flames.length > 0, null, { timeout: 6000, polling: 'raf' });
    await page.waitForFunction(() => window.__GAME__.snapshot().flames.length === 0, null, { timeout: 3000, polling: 'raf' });
    await sleep(100);
  }
  return maxRounds;
}

async function m22(env) {
  const p = await env.open('seed=1&debug=1');
  const page = p.page;
  await startPlaying(page);
  await dbg(env, page, 'godMode', true);
  await dbg(env, page, 'clearBlocks');
  const out = [];
  let ok = true;
  const value = { slime: 100, bat: 200, ghost: 300, golem: 500 };
  const notes = [];
  for (const type of ['slime', 'bat', 'ghost', 'golem']) {
    let done = null;
    for (let attempt = 1; attempt <= 4 && !done; attempt++) {
      const r = await pinTrial(env, page, type, type === 'golem' ? () => chaseGolem(env, page) : null);
      // (1,1) の敵の hp/alive の時系列
      const seq = [];
      let last = null;
      for (const f of r.fr) {
        const e = f.enemies.find((x) => x.type === type);
        const key = e ? `${e.hp}/${e.alive ? 'A' : 'D'}` : 'gone';
        if (key !== last && !(key === 'gone' && seq.length === 0)) { seq.push({ t: f.t, key, score: f.score }); last = key; }
      }
      const pinnedOk = seq.length > 0 && seq[0].key === (type === 'golem' ? '3/A' : '1/A');
      // 期待: golem 3/A → 2/A → 1/A → 0/D → gone。他: 1/A → 0/D(または gone)
      const keys = seq.map((s) => s.key);
      const good = type === 'golem'
        ? keys.join(',').replace(/(^|,)0\/D/, '$1D').startsWith('3/A,2/A,1/A') && keys.some((k) => k === '0/D' || k === 'gone')
        : keys[0] === '1/A' && keys.slice(1).some((k) => k === '0/D' || k === 'gone');
      if (good && r.pinned) done = { r, seq, keys };
      else if (attempt === 4) done = { r, seq, keys, bad: true };
    }
    const { r, seq, keys, bad } = done;
    const iDead = seq.findIndex((s) => s.key === '0/D');
    const iGone = seq.findIndex((s) => s.key === 'gone');
    const anim = iDead >= 0 && iGone > iDead ? (seq[iGone].t - seq[iDead].t) / 1000 : null;
    // 撃破の得点: 死亡した瞬間の前後 3 フレームのスコアの差(岩やアイテムの得点を混ぜない)
    const iD0 = r.fr.findIndex((f) => f.enemies.some((e) => e.type === type && !e.alive));
    const delta = iD0 >= 3 ? r.fr[Math.min(r.fr.length - 1, iD0 + 3)].score - r.fr[iD0 - 3].score : NaN;
    const rocks = 0;
    const invBlink = (() => {
      if (type !== 'golem') return null;
      const iH = r.fr.findIndex((f) => f.enemies.some((e) => e.type === 'golem' && e.hp === 2));
      if (iH < 0) return null;
      const seg = r.fr.slice(iH + 5, iH + 60).filter((f) => f.crops && f.crops.e !== undefined && f.flames.length === 0);
      return transitions(seg.map((f) => f.crops.e));
    })();
    const hitSfx = r.sfx.includes('hit'), dieSfx = r.sfx.includes('enemyDie');
    const okType = !bad && (anim === null || Math.abs(anim - 0.4) <= 0.15) && delta === value[type] && dieSfx && (type !== 'golem' || hitSfx);
    if (!okType) ok = false;
    out.push(`${type}: hp/状態の遷移 ${keys.join('→')}、死亡演出→消滅 ${anim === null ? '?' : anim.toFixed(2) + 's'}(0.4±0.15)、撃破時のスコア +${delta}(期待 +${value[type]})、sfx enemyDie=${dieSfx}${type === 'golem' ? ` hit=${hitSfx} ` : ''}${okType ? '' : ' NG'}`);
    if (type === 'golem') env.extra.golemBlink = invBlink;
  }
  const gb = await golemBlink(env, page);
  env.extra.golemBlink = gb;
  const blinkOk = gb.toggles >= 4 && gb.blinkSpanSec <= 1.0; // 輝度差が小さいスプライトは切替の取りこぼしがあるので、下限は緩く(点滅が観測できれば合格)
  if (!blinkOk) ok = false;
  out.push(`ゴーレムの被弾後の点滅(タイル中央の輝度の ON/OFF): 切替 ${gb.toggles} 回、点滅を観測できた時間 ${gb.blinkSpanSec}s(参考。0.8s 前後が仕様。切替 4 回以上で合格)${blinkOk ? '' : ' NG'}`);
  await env.done(p);
  env.rec('M22', ok, out.join('。 '));
  // M23 用に敵ごとのスコアも同時に取れたので記録
  env.extra.enemyScoreChecked = ok;
}

module.exports = { pinTrial, "m16m17m18": async (env) => { await m16m17m18(env); await m17b(env); }, m19, m20, m21, m22 };
