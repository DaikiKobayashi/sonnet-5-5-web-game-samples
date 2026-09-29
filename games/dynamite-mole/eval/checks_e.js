'use strict';
// E 群: タイマー(M29)、一時停止(M30)、リスタート(M31)、ハイスコア(M32)、BGM 状態・ミュート(M33,M35)
const L = require('./lib');
const { sleep, snap, dbg, tap, press, waitState, startPlaying, startRec, stopRec, STAGES } = L;
const D = require('./checks_d');

const timeText = (s) => { const m = L.joined(s).match(/TIME\s*(\d+):(\d\d)/); return m ? +m[1] * 60 + +m[2] : null; };
const die = async (page) => { await tap(page, 'Space', 45); };

async function m29(env) {
  const p = await env.open('debug=1&seed=1');
  const page = p.page;
  await startPlaying(page);
  const notes = [];
  let ok = true;
  // 1 秒ごとに減る
  const vals = [];
  const t0 = Date.now();
  while (Date.now() - t0 < 3300) { const s = await snap(page); vals.push({ w: Date.now(), hud: timeText(s), tl: s.timeLeft }); await sleep(50); }
  const hudSeq = vals.map((v) => v.hud).filter((v, i, a) => i === 0 || v !== a[i - 1]);
  const mono = hudSeq.every((v, i) => i === 0 || v === hudSeq[i - 1] - 1);
  const startHud = hudSeq[0];
  const rate = (vals[0].tl - vals[vals.length - 1].tl) / ((vals[vals.length - 1].w - vals[0].w) / 1000);
  const ceilOk = vals.every((v) => v.hud === Math.ceil(v.tl));
  if (!(mono && hudSeq.length >= 3 && ceilOk && Math.abs(rate - 1) < 0.05)) { ok = false; notes.push(`TIME 表示の遷移 ${hudSeq.join('→')} rate=${rate.toFixed(3)} ceil一致=${ceilOk}`); }
  // タイムアップ → 死亡 → 復活で 60 秒
  await dbg(env, page, 'setTimeLeft', 2);
  const l0 = (await snap(page)).lives;
  const tSet = Date.now();
  await page.waitForFunction(() => window.__GAME__.snapshot().player.alive === false, null, { timeout: 5000, polling: 16 }).catch(() => { ok = false; notes.push('0 秒でも死亡しない'); });
  const tDie = (Date.now() - tSet) / 1000;
  const dSnap = await snap(page);
  await page.waitForFunction(() => window.__GAME__.snapshot().player.alive === true, null, { timeout: 4000, polling: 16 }).catch(() => { ok = false; notes.push('復活しない'); });
  const rSnap = await snap(page);
  const resetOk = rSnap.timeLeft > 59 && rSnap.timeLeft <= 60 && /TIME\s*1:00|TIME\s*0:59/.test(L.joined(rSnap));
  if (dSnap.lives !== l0 - 1) { ok = false; notes.push(`ライフ ${l0}→${dSnap.lives}`); }
  if (!resetOk) { ok = false; notes.push(`復活後の timeLeft=${rSnap.timeLeft} texts=${L.joined(rSnap)}`); }
  // ライフ 1 でタイムアップ → gameOver
  await dbg(env, page, 'setLives', 1);
  await dbg(env, page, 'setTimeLeft', 1);
  await waitState(page, 'gameOver', 6000).catch(() => { ok = false; notes.push('ライフ 1 のタイムアップで gameOver にならない'); });
  const go = await snap(page);
  await env.done(p);
  env.rec('M29', ok && go.state === 'gameOver', `TIME 表示 ${hudSeq.join('→')}(m:ss は ceil と全フレーム一致=${ceilOk}、減少レート ${rate.toFixed(3)} 秒/秒)。setTimeLeft(2) → ${tDie.toFixed(1)}s 後に死亡(ライフ ${l0}→${dSnap.lives})、復活後の timeLeft=${rSnap.timeLeft.toFixed(1)}(60 にリセット=${resetOk})。ライフ 1 のタイムアップ → ${go.state}。${notes.join(' ')}`);
}

async function m30(env) {
  const notes = [];
  let ok = true;
  const p = await env.open('debug=1&seed=1');
  const page = p.page;
  await startPlaying(page);
  await dbg(env, page, 'godMode', true);
  await press(page, 'Space');
  await sleep(400);
  const a0 = await snap(page);
  await press(page, 'KeyP');
  await sleep(150);
  const a = await snap(page);
  const overlay = a.state === 'paused' && /PAUSED/.test(L.joined(a));
  if (!overlay) { ok = false; notes.push(`P で paused にならない/PAUSED 表示なし state=${a.state}`); }
  await sleep(3000);
  const b = await snap(page);
  const same = b.timeLeft === a.timeLeft && b.bombs[0] && a.bombs[0] && b.bombs[0].timeLeft === a.bombs[0].timeLeft && b.enemies.every((e, i) => e.x === a.enemies[i].x && e.y === a.enemies[i].y);
  if (!same) { ok = false; notes.push(`3 秒待つ間に値が動いた timeLeft ${a.timeLeft}→${b.timeLeft} bomb ${a.bombs[0] && a.bombs[0].timeLeft}→${b.bombs[0] && b.bombs[0].timeLeft}`); }
  await press(page, 'KeyP');
  await sleep(500);
  const c = await snap(page);
  const resumed = c.state === 'playing' && a.bombs[0] && c.bombs[0] && Math.abs((a.bombs[0].timeLeft - c.bombs[0].timeLeft) - 0.5) < 0.15;
  if (!resumed) { ok = false; notes.push(`P で再開しない/時間が飛んだ state=${c.state} bomb ${a.bombs[0] && a.bombs[0].timeLeft}→${c.bombs[0] && c.bombs[0].timeLeft}`); }
  // Escape でも一時停止・再開
  await press(page, 'Escape'); await sleep(150);
  const e1 = await snap(page);
  await press(page, 'Escape'); await sleep(150);
  const e2 = await snap(page);
  const escOk = e1.state === 'paused' && e2.state === 'playing';
  if (!escOk) { ok = false; notes.push(`Escape での切替 ${e1.state}→${e2.state}`); }
  await env.done(p);
  // stageIntro 中は止まらない
  const q = await env.open('debug=1&seed=1');
  await press(q.page, 'Enter');
  await waitState(q.page, 'stageIntro', 3000);
  await press(q.page, 'KeyP');
  await sleep(150);
  const si = await snap(q.page);
  const introOk = si.state === 'stageIntro';
  await waitState(q.page, 'playing', 4000);
  if (!introOk) { ok = false; notes.push(`stageIntro 中に P で ${si.state} になった`); }
  await env.done(q);
  env.rec('M30', ok, `P で paused(PAUSED 表示=${overlay})、3 秒間 timeLeft・爆弾の timeLeft・敵の位置が不変=${same}、再開後は続きから(0.5 秒で爆弾 ${a.bombs[0] && c.bombs[0] ? (a.bombs[0].timeLeft - c.bombs[0].timeLeft).toFixed(2) : '?'} 減少)=${resumed}、Escape でも切替=${escOk}、stageIntro 中の P は無効=${introOk}。${notes.join(' ')}`);
}

async function m31(env) {
  const notes = [];
  let ok = true;
  const results = [];
  const check = async (label, setup, startStage, seed) => {
    const p = await env.open(`debug=1&seed=${seed}&stage=${startStage}`);
    const page = p.page;
    await press(page, 'Enter');
    await waitState(page, 'stageIntro', 3000);
    const init = await snap(page);
    await waitState(page, 'playing', 4000);
    await setup(page, env);
    await press(page, 'KeyR');
    await sleep(150);
    const s = await snap(page);
    const st = STAGES[startStage];
    const good = s.state === 'stageIntro' && s.stage === startStage && s.score === 0 && s.lives === 3 && s.player.maxBombs === 1 && s.player.range === 2 && s.player.boots === 0 && s.timeLeft === st.time && s.grid.join('') === init.grid.join('');
    if (!good) { ok = false; notes.push(`${label}: state=${s.state} stage=${s.stage} score=${s.score} lives=${s.lives} pw=${s.player.maxBombs}/${s.player.range}/${s.player.boots} time=${s.timeLeft} grid同一=${s.grid.join('') === init.grid.join('')}`); }
    results.push(`${label}${good ? '○' : '×'}`);
    await env.done(p);
  };
  const mutate = async (page, env2) => {
    await dbg(env2, page, 'godMode', true);
    await dbg(env2, page, 'killAllEnemies');
    await dbg(env2, page, 'setPowerups', { maxBombs: 3, range: 4, boots: 2 });
    await dbg(env2, page, 'setLives', 2);
    await dbg(env2, page, 'setTimeLeft', 50);
    await sleep(300);
  };
  await check('playing', mutate, 1, 5);
  await check('paused', async (page, e) => { await mutate(page, e); await press(page, 'KeyP'); await sleep(150); }, 3, 9);
  await check('stageClear', async (page, e) => {
    await mutate(page, e);
    await dbg(e, page, 'clearBlocks');
    await D.stepOntoExit(e, page, 500);
    await waitState(page, 'stageClear', 2000);
  }, 2, 4);
  // stageIntro 中の R(stage 1 intro → 新しいゲーム)
  {
    const p = await env.open('debug=1&seed=5');
    await press(p.page, 'Enter');
    await waitState(p.page, 'stageIntro', 3000);
    await press(p.page, 'KeyR');
    await sleep(150);
    const s = await snap(p.page);
    const good = s.state === 'stageIntro' && s.stage === 1 && s.score === 0 && s.lives === 3;
    if (!good) { ok = false; notes.push(`stageIntro 中の R: ${s.state}`); }
    results.push(`stageIntro${good ? '○' : '×'}`);
    await env.done(p);
  }
  // gameOver: 0.6 秒以内の R は無視、その後の R / Enter で新しいゲーム
  {
    const p = await env.open('debug=1&seed=5&stage=2');
    await press(p.page, 'Enter');
    await waitState(p.page, 'playing', 6000);
    await dbg(env, p.page, 'setLives', 1);
    await press(p.page, 'Space');
    await waitState(p.page, 'gameOver', 8000);
    await sleep(100);
    await press(p.page, 'KeyR');
    await sleep(80);
    const early = await snap(p.page);
    await sleep(700);
    await press(p.page, 'KeyR');
    await sleep(150);
    const late = await snap(p.page);
    const goodR = early.state === 'gameOver' && late.state === 'stageIntro' && late.stage === 2 && late.score === 0 && late.lives === 3 && late.timeLeft === STAGES[2].time;
    if (!goodR) { ok = false; notes.push(`gameOver: 早い R → ${early.state}、遅い R → ${late.state} stage=${late.stage} lives=${late.lives}`); }
    results.push(`gameOver(R)${goodR ? '○' : '×'}`);
    // Enter でも
    await waitState(p.page, 'playing', 4000);
    await dbg(env, p.page, 'setLives', 1);
    await press(p.page, 'Space');
    await waitState(p.page, 'gameOver', 8000);
    await sleep(800);
    await press(p.page, 'Enter');
    await sleep(150);
    const en = await snap(p.page);
    const goodE = en.state === 'stageIntro' && en.score === 0 && en.lives === 3;
    if (!goodE) { ok = false; notes.push(`gameOver で Enter → ${en.state}`); }
    results.push(`gameOver(Enter)${goodE ? '○' : '×'}`);
    await env.done(p);
  }
  // gameClear(開始ステージ 5 で 1 ステージだけクリア)
  {
    const p = await env.open('debug=1&seed=5&stage=5');
    await press(p.page, 'Enter');
    await waitState(p.page, 'playing', 6000);
    await D.playThrough(env, p.page, null, 5); // 開始ステージが 5 なのでステージ 5 だけクリアする
    await sleep(800);
    const gc = await snap(p.page);
    await press(p.page, 'KeyR');
    await sleep(150);
    const s = await snap(p.page);
    const good = gc.state === 'gameClear' && s.state === 'stageIntro' && s.stage === 5 && s.score === 0 && s.lives === 3 && s.timeLeft === STAGES[5].time;
    if (!good) { ok = false; notes.push(`gameClear → R: ${gc.state} → ${s.state} stage=${s.stage}`); }
    results.push(`gameClear${good ? '○' : '×'}`);
    await env.done(p);
  }
  env.rec('M31', ok, `R でリスタート(開始ステージの新しい stageIntro・スコア 0・ライフ 3・パワーアップ初期値・timeLeft 満タン・同じシードで同じレイアウト): ${results.join(' ')}(?stage=3 / ?stage=2 / ?stage=5 の開始ステージ保持も含む)。${notes.join(' ')}`);
}

async function m32(env) {
  const notes = [];
  let ok = true;
  const ctx = await env.browser.newContext({ viewport: { width: 960, height: 832 } });
  const getHi = (page) => page.evaluate(() => { try { return localStorage.getItem('dynamiteMole.hiScore'); } catch (e) { return 'ERR'; } });
  const runToGameOver = async (page, earn) => {
    await press(page, 'Enter');
    await waitState(page, 'playing', 6000);
    await dbg(env, page, 'godMode', true);
    await earn();
    await dbg(env, page, 'godMode', false);
    await dbg(env, page, 'setLives', 1);
    await press(page, 'Space');
    await waitState(page, 'gameOver', 9000);
    await sleep(200);
    return snap(page);
  };
  const killN = async (page, n) => { for (let i = 0; i < n; i++) { await dbg(env, page, 'spawnEnemy', 'slime', 13, 9 - 2 * i > 1 ? 9 - 2 * i : 3); } };
  // Run 1: 初回(保存値 0)。300 点 → NEW RECORD!
  let p = await env.open('debug=1&seed=1', { context: ctx, tag: 'hi run1' });
  let page = p.page;
  const t0 = L.joined(await snap(page));
  const hi0 = /HI-SCORE\s*000000/.test(t0);
  const g1 = await runToGameOver(page, async () => { await dbg(env, page, 'killAllEnemies'); await sleep(200); });
  const nr1 = /NEW RECORD!/.test(L.joined(g1));
  const best1 = /BEST\s*000300/.test(L.joined(g1));
  const ls1 = await getHi(page);
  await env.done(p);
  // リロード後: タイトルの HI-SCORE と HUD の HI
  p = await env.open('debug=1&seed=1', { context: ctx, tag: 'hi run2' });
  page = p.page;
  const t1 = L.joined(await snap(page));
  const titleHi = /HI-SCORE\s*000300/.test(t1);
  await press(page, 'Enter');
  await waitState(page, 'playing', 6000);
  const hudHi = /HI\s*000300/.test(L.joined(await snap(page)));
  // Run 2: 0 点 → NEW RECORD! は出ない
  await dbg(env, page, 'setLives', 1);
  await press(page, 'Space');
  await waitState(page, 'gameOver', 9000);
  await sleep(200);
  const g2 = await snap(page);
  const nr2 = /NEW RECORD!/.test(L.joined(g2));
  const best2 = /BEST\s*000300/.test(L.joined(g2));
  // Run 3: 超える(300 + 追加の 300 = 600)→ NEW RECORD!
  await sleep(700);
  await press(page, 'Enter');
  await waitState(page, 'stageIntro', 3000);
  await waitState(page, 'playing', 4000);
  await dbg(env, page, 'godMode', true);
  await dbg(env, page, 'killAllEnemies');
  await sleep(300);
  for (const [c, r] of [[13, 1], [13, 3], [13, 5]]) await dbg(env, page, 'spawnEnemy', 'slime', c, r);
  await dbg(env, page, 'killAllEnemies');
  await sleep(700);
  const mid = await snap(page);
  await dbg(env, page, 'godMode', false);
  await dbg(env, page, 'setLives', 1);
  await press(page, 'Space');
  await waitState(page, 'gameOver', 9000);
  await sleep(200);
  const g3 = await snap(page);
  const nr3 = /NEW RECORD!/.test(L.joined(g3));
  const best3 = new RegExp(`BEST\\s*${String(mid.score).padStart(6, '0')}`).test(L.joined(g3));
  const ls3 = await getHi(page);
  // R で放棄したときも保存される
  await sleep(700);
  await press(page, 'Enter');
  await waitState(page, 'playing', 6000);
  await dbg(env, page, 'godMode', true);
  await dbg(env, page, 'killAllEnemies');
  await sleep(300);
  for (const [c, r] of [[13, 1], [13, 3], [13, 5], [11, 5], [9, 5]]) await dbg(env, page, 'spawnEnemy', 'slime', c, r);
  await dbg(env, page, 'killAllEnemies');
  await sleep(700);
  const beforeR = await snap(page);
  await press(page, 'KeyR');
  await sleep(300);
  const ls4 = await getHi(page);
  await env.done(p);
  p = await env.open('debug=1&seed=1', { context: ctx, tag: 'hi run3' });
  const t3 = L.joined(await snap(p.page));
  const titleAfterR = new RegExp(`HI-SCORE\\s*${String(beforeR.score).padStart(6, '0')}`).test(t3);
  await env.done(p);
  await ctx.close();
  const oks = { hi0, nr1, best1, ls1: ls1 === '300', titleHi, hudHi, nr2: !nr2, best2, nr3, best3, ls3: ls3 === String(mid.score), ls4: ls4 === String(beforeR.score), titleAfterR };
  const bad = Object.entries(oks).filter(([, v]) => !v).map(([k]) => k);
  if (bad.length) { ok = false; notes.push(`不合格項目: ${bad.join(', ')}`); }
  env.rec('M32', ok, `localStorage['dynamiteMole.hiScore']: 初回 300 点で保存値=${ls1}、リロード後 タイトル HI-SCORE 000300=${titleHi}・HUD HI 000300=${hudHi}、初回は NEW RECORD! 表示=${nr1}、0 点の run では NEW RECORD! が出ない=${!nr2}(BEST 維持=${best2})、超えた run(${mid.score} 点)で NEW RECORD! 表示=${nr3}・保存値=${ls3}、R で放棄した run(${beforeR.score} 点)も保存=${ls4}・リロード後のタイトルに反映=${titleAfterR}。${notes.join(' ')}`);
}

async function m33m35(env) {
  const notes33 = [], notes35 = [];
  let ok33 = true, ok35 = true;
  const bgm = async (page) => (await snap(page)).audio.bgm;
  // --- M33 ---
  let p = await env.open('debug=1&seed=1');
  let page = p.page;
  const s0 = await snap(page);
  const unlockedBefore = s0.audio.unlocked;
  const bTitle = s0.audio.bgm;
  await press(page, 'Enter');
  await sleep(100);
  const s1 = await snap(page);
  const unlockedAfter = s1.audio.unlocked;
  if (!unlockedAfter) { ok33 = false; notes33.push('最初のキー入力後も unlocked=false'); }
  if (bTitle !== 'title') { ok33 = false; notes33.push(`title の bgm=${bTitle}`); }
  const st = {};
  st.stageIntro = s1.state === 'stageIntro' ? s1.audio.bgm : `(state=${s1.state})`;
  await waitState(page, 'playing', 4000);
  st.playing = await bgm(page);
  await press(page, 'KeyP'); await sleep(150);
  st.paused = await bgm(page);
  await press(page, 'KeyP'); await sleep(150);
  await dbg(env, page, 'godMode', true);
  await dbg(env, page, 'clearBlocks');
  await dbg(env, page, 'killAllEnemies');
  const nb = await D.neighborOfExit(env, page);
  await dbg(env, page, 'teleport', nb.c, nb.r);
  await sleep(150);
  const ex = (await snap(page)).exit;
  const key = nb.c > ex.col ? 'ArrowLeft' : nb.c < ex.col ? 'ArrowRight' : nb.r > ex.row ? 'ArrowUp' : 'ArrowDown';
  await page.keyboard.down(key);
  await waitState(page, 'stageClear', 3000);
  await page.keyboard.up(key);
  await sleep(100);
  st.stageClear = await bgm(page);
  await waitState(page, 'stageIntro', 5000);
  await sleep(80);
  st.stageIntro2 = await bgm(page);
  await waitState(page, 'playing', 4000);
  st.playing2 = await bgm(page);
  await dbg(env, page, 'godMode', false);
  await dbg(env, page, 'setLives', 1);
  await press(page, 'Space');
  await waitState(page, 'gameOver', 9000);
  await sleep(150);
  st.gameOver = await bgm(page);
  await env.done(p);
  p = await env.open('debug=1&seed=1&stage=5');
  page = p.page;
  await press(page, 'Enter');
  await waitState(page, 'playing', 6000);
  await dbg(env, page, 'godMode', true);
  await dbg(env, page, 'clearBlocks');
  await dbg(env, page, 'killAllEnemies');
  const nb5 = await D.neighborOfExit(env, page);
  await dbg(env, page, 'teleport', nb5.c, nb5.r);
  await sleep(150);
  const ex5 = (await snap(page)).exit;
  const key5 = nb5.c > ex5.col ? 'ArrowLeft' : nb5.c < ex5.col ? 'ArrowRight' : nb5.r > ex5.row ? 'ArrowUp' : 'ArrowDown';
  await page.keyboard.down(key5);
  await waitState(page, 'stageClear', 3000);
  await page.keyboard.up(key5);
  await waitState(page, 'gameClear', 5000);
  await sleep(150);
  st.gameClear = await bgm(page);
  const st5 = 'stage5';
  await env.done(p);
  const expect = { stageIntro: null, playing: 'stage1', paused: 'stage1', stageClear: null, stageIntro2: null, playing2: 'stage2', gameOver: null, gameClear: null };
  for (const [k, v] of Object.entries(expect)) if (st[k] !== v) { ok33 = false; notes33.push(`${k}: bgm=${JSON.stringify(st[k])}(期待 ${JSON.stringify(v)})`); }
  env.rec('M33', ok33 && unlockedAfter, `audio.unlocked: 最初のキー入力前=${unlockedBefore} → 後=${unlockedAfter}。bgm: title=${bTitle}、${Object.entries(st).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}。${notes33.join(' ')}`);

  // --- M35: ミュート ---
  const ctx = await env.browser.newContext({ viewport: { width: 960, height: 832 } });
  p = await env.open('debug=1&seed=1', { context: ctx, tag: 'mute' });
  page = p.page;
  await press(page, 'KeyM'); await sleep(120);
  let a = await snap(page);
  const muted1 = a.audio.muted === true;
  await press(page, 'Enter');
  await waitState(page, 'playing', 6000);
  a = await snap(page);
  const hudOff = /SND\s*OFF/.test(L.joined(a)) && a.audio.muted === true;
  await dbg(env, page, 'godMode', true);
  await press(page, 'Space'); await sleep(200);
  const b = await snap(page);
  const placeLogged = b.audio.sfxLog.some((e) => e.name === 'place');
  const proceeds = b.bombs.length === 1 && b.timeLeft < a.timeLeft;
  await press(page, 'KeyM'); await sleep(120);
  const c = await snap(page);
  const hudOn = /SND\s*ON/.test(L.joined(c)) && c.audio.muted === false;
  await press(page, 'KeyM'); await sleep(120); // 再びミュート
  await env.done(p);
  p = await env.open('debug=1&seed=1', { context: ctx, tag: 'mute reload' });
  const d = await snap(p.page);
  const persisted = d.audio.muted === true;
  await env.done(p);
  await ctx.close();
  // ?mute=1 は保存値(ミュート解除)より優先
  const ctx2 = await env.browser.newContext({ viewport: { width: 960, height: 832 } });
  p = await env.open('debug=1&seed=1', { context: ctx2, tag: 'mute q1' });
  await press(p.page, 'KeyM'); await sleep(100); await press(p.page, 'KeyM'); await sleep(100); // 保存値は '0'
  await env.done(p);
  p = await env.open('debug=1&seed=1&mute=1', { context: ctx2, tag: 'mute q2' });
  const e = await snap(p.page);
  const queryOk = e.audio.muted === true;
  await env.done(p);
  await ctx2.close();
  const q3 = await env.open('debug=1&seed=1&mute=1', { tag: 'mute q3' });
  await press(q3.page, 'Enter');
  await waitState(q3.page, 'playing', 6000);
  const f = await snap(q3.page);
  const hudQ = /SND\s*OFF/.test(L.joined(f));
  await env.done(q3);
  const oks = { muted1, hudOff, placeLogged, proceeds, hudOn, persisted, queryOk, hudQ };
  const bad = Object.entries(oks).filter(([, v]) => !v).map(([k]) => k);
  if (bad.length) { ok35 = false; notes35.push(`不合格: ${bad.join(', ')}`); }
  env.rec('M35', ok35, `M でトグル(title でも有効=${muted1})、HUD SND OFF/ON 切替=${hudOff && hudOn}、ミュート中もゲーム進行=${proceeds}・sfxLog に place が残る=${placeLogged}、リロード後もミュート維持=${persisted}、?mute=1 で保存値(ミュート解除)より優先=${queryOk}・HUD=${hudQ}。${notes35.join(' ')}`);
}

module.exports = { m29, m30, m31, m32, m33m35 };
