'use strict';
// D 群: スコア・アイテム(M23,M24)、出口・ステージクリア・ゲームクリア(M25,M26,M27)
const L = require('./lib');
const { sleep, snap, dbg, tap, waitState, startPlaying, startRec, stopRec, simulateFlames, genStage, freeCells, STAGES, isWall } = L;
const { moveSpeed } = require('./checks_b');

const pad6 = (n) => String(n).padStart(6, '0');
const hudScoreOk = (s) => new RegExp(`SCORE\\s*${pad6(s.score)}`).test(L.joined(s));

// 射程 range の爆弾を置いて、指定のマス(target)を壊せる位置 P を探す
function findBombSpot(grid, targets, range, avoid = []) {
  for (const [c, r] of freeCells(grid)) {
    if (c === 1 && r === 1) continue;
    const sim = simulateFlames(grid, [{ col: c, row: r, range }], [0]);
    if (targets.some((t) => sim.broken.includes(`${t.col},${t.row}`))) return { c, r, sim };
  }
  return null;
}
async function bombAndWait(page, key = 'Space') {
  await tap(page, key, 45);
  await page.waitForFunction(() => window.__GAME__.snapshot().flames.length > 0, null, { timeout: 6000, polling: 'raf' });
  await page.waitForFunction(() => window.__GAME__.snapshot().flames.length === 0, null, { timeout: 3000, polling: 'raf' });
  await sleep(120);
}

async function m23m24(env) {
  const notes23 = [];
  let ok23 = true;
  // --- M23: 岩 +10、HUD 表示 ---
  let p = await env.open('debug=1&seed=1');
  let page = p.page;
  await startPlaying(page);
  await dbg(env, page, 'godMode', true);
  await dbg(env, page, 'killAllEnemies');
  await sleep(700);
  let s0 = await snap(page);
  const spot = findBombSpot(s0.grid, s0.grid.flatMap((row, r) => row.split('').map((ch, c) => ch === 'S' ? { col: c, row: r } : null)).filter(Boolean), 2);
  await dbg(env, page, 'teleport', spot.c, spot.r);
  await sleep(120);
  const before = await snap(page);
  await bombAndWait(page);
  const after = await snap(page);
  let broken = 0;
  for (let r = 0; r < 11; r++) for (let c = 0; c < 15; c++) if (before.grid[r][c] === 'S' && after.grid[r][c] === '.') broken++;
  const rockDelta = after.score - before.score;
  const rockOk = broken >= 1 && rockDelta === broken * 10;
  const hudOk = hudScoreOk(after);
  if (!rockOk) { ok23 = false; notes23.push(`岩 ${broken} 個で +${rockDelta}`); }
  if (!hudOk) { ok23 = false; notes23.push(`HUD の SCORE が snapshot と不一致: ${L.joined(after)}`); }
  await env.done(p);

  // --- M24: 隠しアイテム(参照アルゴリズムの予測と、clearBlocks / 実際の爆風での出現を比較) ---
  const ref = genStage(1, 1);
  p = await env.open('debug=1&seed=1');
  page = p.page;
  await startPlaying(page);
  await dbg(env, page, 'godMode', true);
  await dbg(env, page, 'killAllEnemies');
  await sleep(700);
  const b0 = await snap(page);
  const noItemsBefore = b0.items.length === 0;
  const itemSpot = ref.items.length ? findBombSpot(b0.grid, ref.items, 6) : null;
  let naturalOk = null, naturalItem = null;
  if (itemSpot) {
    await dbg(env, page, 'setPowerups', { range: 6 });
    await dbg(env, page, 'teleport', itemSpot.c, itemSpot.r);
    await sleep(120);
    await bombAndWait(page);
    const a = await snap(page);
    const expected = ref.items.filter((it) => itemSpot.sim.broken.includes(`${it.col},${it.row}`));
    naturalOk = expected.length > 0 && expected.every((it) => a.items.some((x) => x.type === it.type && x.col === it.col && x.row === it.row)) && a.items.length === expected.length;
    naturalItem = expected[0];
  }
  await dbg(env, page, 'clearBlocks');
  await sleep(200);
  const all = await snap(page);
  const norm = (arr) => JSON.stringify(arr.map((x) => `${x.type}@${x.col},${x.row}`).sort());
  // clearBlocks で出たアイテム = 参照の全アイテム(すでに拾われていないもの)
  const allOk = norm(all.items) === norm(ref.items) || norm(all.items.concat([])) === norm(ref.items);
  await env.done(p);

  // 各アイテムの効果と上限
  p = await env.open('debug=1&seed=1');
  page = p.page;
  await startPlaying(page);
  await dbg(env, page, 'godMode', true);
  await dbg(env, page, 'killAllEnemies');
  await dbg(env, page, 'clearBlocks');
  await sleep(700);
  await dbg(env, page, 'setPowerups', { maxBombs: 1, range: 2, boots: 0 });
  // clearBlocks で出たアイテムを片付けるため、スコア・パワーアップは pick 前後の差分で見る
  const pickup = async (type) => {
    await dbg(env, page, 'teleport', 1, 1);
    await sleep(150);
    await dbg(env, page, 'spawnItem', type, 2, 1);
    await sleep(120);
    const a = await snap(page);
    const listed = a.items.some((it) => it.type === type && it.col === 2 && it.row === 1);
    await tap(page, 'ArrowRight', 45);
    await sleep(420);
    const b = await snap(page);
    const sfx = await page.evaluate(() => window.__sfx.slice(-4).map((e) => e.name));
    return { a, b, listed, sfx, consumed: !b.items.some((it) => it.col === 2 && it.row === 1) };
  };
  const eff = {};
  const notes24 = [];
  let ok24 = true;
  const tests = [
    ['fire', (x) => x.player.range, 3, 'FIRE 3'],
    ['bomb', (x) => x.player.maxBombs, 2, 'BOMB 2'],
    ['boots', (x) => x.player.boots, 1, 'SPD 1'],
    ['life', (x) => x.lives, 4, 'x\\s*4'],
  ];
  for (const [type, get, expect, hud] of tests) {
    const r = await pickup(type);
    const v = get(r.b);
    const sc = r.b.score - r.a.score;
    const hudMatch = new RegExp(hud, 'i').test(L.joined(r.b));
    const lastPickupSfx = r.sfx.filter((n) => n === 'item' || n === 'life').pop();
    const sfxOk = lastPickupSfx === (type === 'life' ? 'life' : 'item');
    const good = r.listed && r.consumed && v === expect && sc === 50 && hudMatch && sfxOk;
    if (!good) { ok24 = false; notes24.push(`${type}: listed=${r.listed} consumed=${r.consumed} 値=${v}(期待 ${expect}) +${sc} hud=${hudMatch} sfx=${r.sfx}`); }
    eff[type] = `${type}: 値 ${v}、スコア +${sc}、HUD ${hudMatch ? 'OK' : 'NG'}、sfx ${r.sfx.filter((n) => n === 'item' || n === 'life').pop()}`;
  }
  // 速度: ブーツ 1 段 = 5.1、3 段 = 6.3(表示値と実測)
  const sp1 = (await snap(page)).player.speed;
  const ms1 = await moveSpeed(env, page);
  await dbg(env, page, 'setPowerups', { boots: 3 });
  const sp3 = (await snap(page)).player.speed;
  const ms3 = await moveSpeed(env, page);
  const spOk = Math.abs(sp1 - 5.1) < 0.02 && Math.abs(sp3 - 6.3) < 0.02 && Math.abs(ms1.speed - 5.1) / 5.1 <= 0.2 && Math.abs(ms3.speed - 6.3) / 6.3 <= 0.2;
  if (!spOk) { ok24 = false; notes24.push(`速度 ${sp1}/${sp3} 実測 ${ms1.speed}/${ms3.speed}`); }
  // 上限
  await dbg(env, page, 'setPowerups', { maxBombs: 5, range: 6, boots: 3 });
  await dbg(env, page, 'setLives', 5);
  const cap = {};
  for (const type of ['fire', 'bomb', 'boots', 'life']) {
    const r = await pickup(type);
    const sc = r.b.score - r.a.score;
    cap[type] = { range: r.b.player.range, maxBombs: r.b.player.maxBombs, boots: r.b.player.boots, lives: r.b.lives, sc, consumed: r.consumed };
  }
  const last = cap.life;
  const capOk = last.range === 6 && last.maxBombs === 5 && last.boots === 3 && last.lives === 5 && Object.values(cap).every((c) => c.sc === 50 && c.consumed);
  if (!capOk) { ok24 = false; notes24.push(`上限超過/消費 ${JSON.stringify(cap)}`); }
  await env.done(p);
  if (naturalOk === false || !allOk) { ok24 = false; notes24.push(`隠しアイテム: 自然な爆風での出現=${naturalOk} clearBlocks 後の一覧=${allOk ? '一致' : '不一致'}(参照 ${norm(ref.items)} / 実装 ${norm(all.items)})`); }
  env.rec('M24', ok24, `隠しアイテムは参照の予測どおり(爆風で壊したとき ${naturalOk === null ? '検証できず' : naturalOk ? '出現OK(' + (naturalItem && naturalItem.type) + ')' : 'NG'}、clearBlocks 後の全 ${ref.items.length} 個が一致=${allOk}、未破壊時は items 空=${noItemsBefore})。効果: ${Object.values(eff).join(' / ')}。速度 boots1=${sp1}(実測 ${ms1.speed && ms1.speed.toFixed(2)})、boots3=${sp3}(実測 ${ms3.speed && ms3.speed.toFixed(2)})。上限で取得しても超えず・+50・消費=${capOk}。${notes24.join(' ')}`);

  // --- M23: 敵のスコア(M22 の測定を流用)・アイテム +50 ---
  const m22 = env.results.M22;
  const enemyScoreNote = m22 ? (m22.pass ? '敵 4 種のスコアは M22 で実測(+100/+200/+300/+500)' : `敵のスコアは M22 参照(M22 は不合格: ${m22.note.slice(0, 120)}…)`) : '敵のスコアは M22 で測定(未実行)';
  const itemScoreOk = Object.values(cap).every((c) => c.sc === 50);
  if (!itemScoreOk) ok23 = false;
  env.rec('M23', ok23 && (m22 ? m22.pass === true : false), `岩 ${broken} 個で +${rockDelta}(= 10x${broken})${rockOk ? '' : ' NG'}、アイテム取得 +50(4 種とも)、HUD の SCORE は snapshot の値と${hudOk ? '一致' : '不一致'}。${enemyScoreNote}。${notes23.join(' ')}`);
}

// exit の隣から 1 歩で出口に乗る(clearBlocks 済みの前提)
async function stepOntoExit(env, page, holdMs = 700) {
  const s = await snap(page);
  const ex = s.exit;
  const dirs = [['ArrowLeft', 1, 0], ['ArrowRight', -1, 0], ['ArrowUp', 0, 1], ['ArrowDown', 0, -1]];
  for (const [key, dc, dr] of dirs) {
    const nc = ex.col + dc, nr = ex.row + dr;
    if (isWall(nc, nr)) continue;
    await dbg(env, page, 'teleport', nc, nr);
    await sleep(120);
    await page.keyboard.down(key);
    await sleep(holdMs);
    await page.keyboard.up(key);
    return { nc, nr, key };
  }
  return null;
}
async function neighborOfExit(env, page) {
  const s = await snap(page);
  const ex = s.exit;
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!isWall(ex.col + dc, ex.row + dr)) return { c: ex.col + dc, r: ex.row + dr };
  return null;
}

// ステージ 1〜5 をデバッグ関数で通しクリアする。各ステージの導入・クリア画面を検証して記録する
async function playThrough(env, page, log, from = 1) {
  const rec = { stages: [] };
  for (let stage = from; stage <= 5; stage++) {
    const cur = await snap(page);
    if (cur.state !== 'playing') await waitState(page, 'playing', 8000);
    await dbg(env, page, 'godMode', true);
    await dbg(env, page, 'clearBlocks');
    await dbg(env, page, 'killAllEnemies');
    await sleep(100);
    const nb = await neighborOfExit(env, page);
    await dbg(env, page, 'teleport', nb.c, nb.r);
    await sleep(150);
    const pre = await snap(page);
    const s0 = pre.score;
    // 歩いて出口へ
    const ex = pre.exit;
    const key = nb.c > ex.col ? 'ArrowLeft' : nb.c < ex.col ? 'ArrowRight' : nb.r > ex.row ? 'ArrowUp' : 'ArrowDown';
    await page.keyboard.down(key);
    await page.waitForFunction(() => window.__GAME__.snapshot().state !== 'playing', null, { timeout: 4000, polling: 16 }).catch(() => {});
    await page.keyboard.up(key);
    await sleep(120);
    const sc = await snap(page);
    const tr0 = await page.evaluate(() => window.__trans.filter((t) => t.s === 'stageClear' || t.s === 'gameClear').pop());
    const entry = { stage, enteredState: sc.state, timeLeftAtClear: sc.timeLeft, texts: sc.texts.slice(), s0 };
    log && log(`stage ${stage}: ${sc.state}`);
    if (stage < 5) {
      await waitState(page, 'stageIntro', 6000);
      await sleep(80); // 遷移ログ(20ms ポーリング)に反映されるのを待つ
      const tr = await page.evaluate(() => window.__trans);
      const tSc = tr.filter((t) => t.s === 'stageClear').pop().t, tIn = tr.filter((t) => t.s === 'stageIntro').pop().t;
      entry.clearDur = (tIn - tSc) / 1000;
      const ni = await snap(page);
      entry.nextIntro = ni.texts.slice();
      entry.nextStage = ni.stage;
      entry.s1 = ni.score;
      entry.next = ni;
      await waitState(page, 'playing', 6000);
    } else {
      await waitState(page, 'gameClear', 6000);
      await sleep(80);
      const tr = await page.evaluate(() => window.__trans);
      const tSc = tr.filter((t) => t.s === 'stageClear').pop().t, tGc = tr.filter((t) => t.s === 'gameClear').pop().t;
      entry.clearDur = (tGc - tSc) / 1000;
      entry.tGameClear = tGc;
      const gc = await snap(page);
      entry.gameClear = gc;
      entry.s1 = gc.score;
    }
    rec.stages.push(entry);
  }
  return rec;
}

async function m25m26m27(env) {
  const notes25 = [], notes26 = [], notes27 = [];
  let ok25 = true, ok26 = true, ok27 = true;
  const ref = genStage(1, 1);
  const p = await env.open('debug=1&seed=1');
  const page = p.page;
  await startPlaying(page);
  await dbg(env, page, 'godMode', true);
  const s0 = await snap(page);
  const hidden = s0.exit.revealed === false && s0.exit.open === false && s0.grid[s0.exit.row][s0.exit.col] === 'S';
  if (!hidden) { ok25 = false; notes25.push(`初期状態で出口が隠れていない ${JSON.stringify(s0.exit)}`); }
  // 爆風で出口の岩を壊す(range 6 で届く位置から)
  const spot = findBombSpot(s0.grid, [s0.exit], 6);
  let revealedByBomb = null;
  if (spot) {
    await dbg(env, page, 'setPowerups', { range: 6 });
    await dbg(env, page, 'teleport', spot.c, spot.r);
    await sleep(120);
    await bombAndWait(page);
    const a = await snap(page);
    revealedByBomb = a.exit.revealed === true && a.exit.open === false;
    if (!revealedByBomb) { ok25 = false; notes25.push(`爆風で出口の岩を壊しても revealed にならない ${JSON.stringify(a.exit)}`); }
  } else notes25.push('爆風で届く位置が見つからず debug.revealExit で代用');
  await dbg(env, page, 'clearBlocks');
  await dbg(env, page, 'revealExit');
  // 敵が生きている間は閉じている。乗っても何も起きない
  const closed = await snap(page);
  const closedOk = closed.exit.revealed === true && closed.exit.open === false && closed.enemies.some((e) => e.alive);
  if (!closedOk) { ok25 = false; notes25.push(`敵が生きているのに open=${closed.exit.open}`); }
  await stepOntoExit(env, page, 600);
  await sleep(500);
  const onClosed = await snap(page);
  const standing = onClosed.player.col === closed.exit.col && onClosed.player.row === closed.exit.row;
  const stillPlaying = onClosed.state === 'playing';
  if (!(standing && stillPlaying)) { ok25 = false; notes25.push(`閉じた出口に乗った: standing=${standing} state=${onClosed.state}`); }
  // 出口の隣へ戻ってから敵を全滅させる
  const nb = await neighborOfExit(env, page);
  await dbg(env, page, 'teleport', nb.c, nb.r);
  await sleep(150);
  await dbg(env, page, 'killAllEnemies');
  await sleep(120);
  const opened = await snap(page);
  const sfxNow = await page.evaluate(() => window.__sfx.map((e) => e.name));
  const openOk = opened.exit.open === true && sfxNow.includes('exitOpen') && opened.state === 'playing';
  if (!openOk) { ok25 = false; notes25.push(`敵全滅後 open=${opened.exit.open} exitOpen sfx=${sfxNow.includes('exitOpen')} state=${opened.state}`); }
  env.rec('M25', ok25, `初期は隠れている(revealed=false, open=false, 出口のマスは岩)=${hidden}、爆風で岩を壊すと revealed=${revealedByBomb}、敵が生きている間は open=false で、乗っても state=${onClosed.state}のまま=${stillPlaying}、敵全滅後 open=${opened.exit.open} で exitOpen が sfxLog に${sfxNow.includes('exitOpen') ? 'あり' : 'なし'}。${notes25.join(' ')}`);

  // ステージ 1〜5 を通す(開いた出口へ歩いて乗る)
  const through = await playThrough(env, page);
  const e1 = through.stages[0];
  const t1 = e1.texts.join(' | ');
  const bonus = Math.floor(e1.timeLeftAtClear) * 10;
  const textsOk = /STAGE CLEAR!/.test(t1) && /CLEAR BONUS\s*\+500/.test(t1) && new RegExp(`TIME BONUS\\s*\\+${bonus}\\b`).test(t1);
  const expectedFrom = (e) => 500 + Math.floor(e.timeLeftAtClear) * 10;
  const details = [];
  for (const e of through.stages) {
    const exp = expectedFrom(e);
    const got = e.s1 - e.s0;
    const good = got === exp && Math.abs(e.clearDur - 3.0) <= 0.3;
    if (!good) ok26 = false;
    details.push(`S${e.stage}: +${got}(期待 ${exp})、クリア画面 ${e.clearDur.toFixed(2)}s`);
    if (e.stage < 5) {
      const intro = e.nextIntro.join(' | ');
      const st = STAGES[e.stage + 1];
      const introOk = new RegExp(`STAGE\\s*${e.stage + 1}\\b`).test(intro) && intro.includes(st.name) && new RegExp(`ENEMIES\\s*${Object.values(st.en).reduce((a, b) => a + b, 0)}`).test(intro);
      if (!introOk) { ok26 = false; notes26.push(`次の導入が不正 S${e.stage + 1}: ${intro}`); }
    }
  }
  if (!textsOk) { ok26 = false; notes26.push(`stageClear の texts が不正: ${t1}(期待 TIME BONUS +${bonus})`); }
  const gcEntry = through.stages[4];
  env.rec('M26', ok26 && gcEntry.gameClear.state === 'gameClear', `開いた出口へ歩いて乗ると stageClear(texts: STAGE CLEAR! / CLEAR BONUS +500 / TIME BONUS +${bonus}${textsOk ? ' OK' : ' NG'})。加算スコア=500+floor(残り秒)x10 を全 5 ステージで確認、約 3.0s 後に次の導入(ステージ名・ENEMIES 数を確認)/ステージ 5 は gameClear: ${details.join('、')}。${notes26.join(' ')}`);

  // M27: gameClear
  const gc = gcEntry.gameClear;
  const gt = L.joined(gc);
  const need = { 'CONGRATULATIONS!': /CONGRATULATIONS!/, 'YOU ESCAPED THE MINE': /YOU ESCAPED THE MINE/, SCORE: /SCORE\s*\d+/, BEST: /BEST\s*\d+/, 'ENTER PLAY AGAIN': /ENTER\s+PLAY AGAIN/, 'ESC TITLE': /ESC\s+TITLE/ };
  const miss = Object.entries(need).filter(([, re]) => !re.test(gt)).map(([k]) => k);
  if (miss.length) { ok27 = false; notes27.push(`gameClear の texts 不足: ${miss.join(', ')}`); }
  // 入力ロック: gameClear 突入から 0.2 秒後の Enter は無視、0.8 秒後の Enter で新しいゲーム
  const sinceGc = (await page.evaluate(() => performance.now())) - gcEntry.tGameClear;
  const early = sinceGc < 450;
  if (early) { await tap(page, 'Enter', 40); await sleep(50); }
  const lockSnap = await snap(page);
  const lockOk = !early || lockSnap.state === 'gameClear';
  if (!lockOk) { ok27 = false; notes27.push(`0.6 秒以内の Enter で state=${lockSnap.state}`); }
  await sleep(Math.max(0, 900 - (await page.evaluate(() => performance.now()) - gcEntry.tGameClear)));
  await tap(page, 'Enter', 45);
  await waitState(page, 'stageIntro', 2000).catch(() => { ok27 = false; notes27.push('0.6 秒後の Enter で新しいゲームが始まらない'); });
  const ng = await snap(page);
  const resetOk = ng.stage === 1 && ng.score === 0 && ng.lives === 3 && ng.player.maxBombs === 1 && ng.player.range === 2 && ng.player.boots === 0;
  if (!resetOk) { ok27 = false; notes27.push(`新しいゲームの初期値が不正: stage=${ng.stage} score=${ng.score} lives=${ng.lives} pw=${ng.player.maxBombs}/${ng.player.range}/${ng.player.boots}`); }
  await env.done(p);
  // Esc → title(もう一度 gameClear まで進める)
  const q = await env.open('debug=1&seed=1');
  await startPlaying(q.page);
  const through2 = await playThrough(env, q.page);
  const tg2 = through2.stages[4].tGameClear;
  await sleep(Math.max(0, 900 - (await q.page.evaluate(() => performance.now()) - tg2)));
  await tap(q.page, 'Escape', 45);
  await sleep(300);
  const ttl = await snap(q.page);
  const escOk = ttl.state === 'title';
  if (!escOk) { ok27 = false; notes27.push(`gameClear で Esc → ${ttl.state}`); }
  await env.done(q);
  env.extra.through = through.stages.map((e) => ({ stage: e.stage, clearDur: e.clearDur, timeLeft: e.timeLeftAtClear }));
  env.rec('M27', ok27, `gameClear の texts 一式${miss.length ? ' 不足 ' + miss.join(',') : ' OK'}(${gc.texts.filter((t) => /CONGRAT|ESCAPED|SCORE|BEST|NEW RECORD|ENTER|ESC/.test(t)).join(' | ')})、突入 0.6 秒以内の Enter は${lockOk ? '無視' : '効いた NG'}、その後の Enter で stage 1・スコア 0・ライフ 3・パワーアップ初期値の新しいゲーム=${resetOk}、Esc でタイトル=${escOk}。${notes27.join(' ')}`);
}

module.exports = { m23m24, m25m26m27, playThrough, findBombSpot, bombAndWait, stepOntoExit, neighborOfExit };
