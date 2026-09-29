// SUNSET RUSH - エントリポイント(ゲームループ・入力・音・保存・検証フックの結線)

import { STEP, STAGES, MAX_SPEED, KMH, PLAYER_Z, UNITS_PER_M, W, H } from './constants.js';
import { Game } from './game.js';
import { getAssets } from './assets.js';
import { Renderer } from './render.js';
import { AudioSys } from './audio.js';
import { Input, setupTouch } from './input.js';
import * as HUD from './hud.js';
import { drawText } from './font.js';

const params = new URLSearchParams(location.search);

// ------------------------------------------------------------------ 保存(localStorage は必ず try/catch)

const STORE_KEY = 'sunset-rush:v1';

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      return {
        best: Number.isFinite(o.best) ? Math.max(0, Math.floor(o.best)) : 0,
        muted: !!o.muted,
      };
    }
  } catch (e) { /* 使えない環境でもそのまま動く */ }
  return { best: 0, muted: false };
}

function saveStore(data) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  } catch (e) { /* 保存されないだけ */ }
}

function startGame() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;

  const store = loadStore();
  let storedMuted = store.muted;
  const muteParam = params.get('mute') === '1';
  const startMuted = muteParam ? true : store.muted;

  // seed(§3.10): URL の seed、なければ起動時に 1 つ決めてページの寿命の間使う
  const sp = params.get('seed');
  const seed = sp !== null && /^-?\d+$/.test(sp)
    ? Number(sp) >>> 0
    : ((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0);
  const stageParam = parseInt(params.get('stage'), 10);
  const startStage = stageParam >= 1 && stageParam <= 3 ? stageParam : 1;
  const debug = params.get('debug') === '1';

  const assets = getAssets();
  const renderer = new Renderer(ctx, assets);
  const audio = new AudioSys(startMuted);
  let fade = 0;
  let jingled = false;

  const SFX = {
    beep: 'sfx_beep', go: 'sfx_go', crash: 'sfx_crash', checkpoint: 'sfx_checkpoint', goal: 'sfx_goal',
    timeup: 'sfx_timeup', menu: 'sfx_menu', overtake: 'sfx_overtake', nearmiss: 'sfx_nearmiss',
    timewarn: 'sfx_timewarn', jingle_clear: 'jingle_clear',
  };

  let game = null;
  const emit = (name, arg) => {
    if (!game) return;
    switch (name) {
      case 'sfx':
        if (SFX[arg]) audio.play(SFX[arg]);
        break;
      case 'save':
        saveStore({ best: game.best, muted: storedMuted });
        break;
      case 'mute':
        audio.setMuted(arg);
        storedMuted = arg;
        saveStore({ best: game.best, muted: storedMuted });
        break;
      case 'scene':
        if (arg === 'paused') audio.suspend();
        else audio.resume();
        if (arg === 'title' || arg === 'countdown' || arg === 'gameover' || arg === 'ending') fade = 0.6;
        break;
      default:
        break;
    }
  };

  game = new Game({ seed, startStage, best: store.best, muted: startMuted, emit });
  fade = 0;

  // ---------------------------------------------------------------- 入力

  function onPress(code) {
    audio.ensure();
    if (!jingled && game.scene === 'title' && code !== 'Enter' && code !== 'Space') {
      jingled = true;
      audio.play('jingle_title');
    }
    switch (code) {
      case 'Enter':
      case 'Space': game.confirm(); break;
      case 'KeyP': game.pauseToggle(); break;
      case 'Escape': game.escape(); break;
      case 'KeyR': game.restart(); break;
      case 'KeyQ': game.quitToTitle(); break;
      case 'KeyM': game.toggleMute(); break;
      case 'KeyF': toggleFullscreen(); break;
      default: break;
    }
  }

  function toggleFullscreen() {
    try {
      const p = document.fullscreenElement
        ? document.exitFullscreen()
        : document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* 何もしない */ }
  }

  const input = new Input({
    onPress,
    // フォーカスを失ったら、走行中は自動で一時停止(S-15)
    onBlur: () => {
      if (game.scene === 'playing' && (document.hidden || !document.hasFocus())) game.pauseToggle();
    },
  });

  // 画面タップ(タッチ端末): タイトル・リザルト等で決定、一時停止中は再開
  const tap = (fromCanvas) => {
    audio.ensure();
    if (!fromCanvas) return;
    const sc = game.scene;
    if (sc === 'paused') game.pauseToggle();
    else game.confirm();
  };
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    tap(true);
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  setupTouch(input, {
    onTap: tap,
    onPauseButton: () => game.pauseToggle(),
  });
  window.addEventListener('pointerdown', () => audio.ensure(), { passive: true });

  // ---------------------------------------------------------------- 音の同期(毎フレーム)

  function bgmFor(sc) {
    return sc === 'countdown' || sc === 'playing' || sc === 'paused' ? STAGES[game.stage - 1].bgm : null;
  }
  function engineOn(sc) {
    return sc === 'countdown' || sc === 'playing' || sc === 'stageclear' || sc === 'timeup';
  }

  function syncAudio() {
    if (!audio.ctx) return;
    const sc = game.scene;
    const bgm = bgmFor(sc);
    if (bgm) audio.startBgm(bgm);
    else audio.stopBgm();
    const sp01 = game.speed / MAX_SPEED;
    if (engineOn(sc)) {
      audio.startEngine();
      audio.setEngine(sp01);
    } else {
      audio.stopEngine();
    }
    audio.setOffroad(sc === 'playing' && game.offroad && game.speed > 300, sp01);
  }

  // ---------------------------------------------------------------- 描画

  let fpsEma = 60;
  function render(dtWall, wall) {
    ctx.imageSmoothingEnabled = false;
    const sc = game.scene;
    renderer.drawWorld(game, { hideCar: sc === 'title', noShake: sc === 'paused' });
    switch (sc) {
      case 'title':
        HUD.drawTitle(ctx, game, assets, wall);
        break;
      case 'countdown':
        HUD.drawHud(ctx, game);
        HUD.drawCountdown(ctx, game);
        break;
      case 'playing':
        HUD.drawHud(ctx, game);
        if (game.cpBanner === 0) {
          if (game.sceneTimer < 60) HUD.drawStageIntro(ctx, game);
          if (game.goBanner > 0) HUD.drawGoSignal(ctx);
        }
        break;
      case 'paused':
        HUD.drawHud(ctx, game);
        HUD.drawPause(ctx);
        break;
      case 'stageclear':
        HUD.drawHud(ctx, game);
        HUD.drawStageClear(ctx, game, wall);
        break;
      case 'timeup':
        HUD.drawHud(ctx, game);
        HUD.drawTimeUp(ctx);
        break;
      case 'gameover':
        HUD.drawGameOver(ctx, game, wall);
        break;
      case 'ending':
        HUD.drawEnding(ctx, game, wall);
        break;
      default:
        break;
    }
    if (game.fadeReq) { fade = 0.8; game.fadeReq = 0; }
    if (fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, fade)})`;
      ctx.fillRect(0, 0, W, H);
      fade = Math.max(0, fade - dtWall * 4);
    }
    if (debug) {
      fpsEma += (1 / Math.max(dtWall, 0.001) - fpsEma) * 0.08;
      drawText(ctx, `FPS ${Math.round(fpsEma)}`, 632, 298, { scale: 1, color: '#7cff8a', outline: '#000000', align: 'right' });
    }
  }

  // ---------------------------------------------------------------- ゲームループ(固定ステップ 1/60)

  let last = null;
  let acc = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    if (last === null) last = ts;
    const dt = Math.min((ts - last) / 1000, 0.1);
    last = ts;
    acc += dt;
    let steps = 0;
    while (acc >= STEP - 1e-9 && steps < 6) {
      const gi = game.input;
      gi.throttle = input.throttle;
      gi.brake = input.brake;
      gi.left = input.left;
      gi.right = input.right;
      game.step();
      acc -= STEP;
      steps++;
    }
    if (steps >= 6 && acc >= STEP) acc = 0; // 追いつけないぶんは捨てる
    if (acc < 0) acc = 0;
    syncAudio();
    render(dt, ts / 1000);
  }
  requestAnimationFrame(frame);

  // ---------------------------------------------------------------- 検証フック

  function getState() {
    const sc = game.scene;
    const sp01 = game.speed / MAX_SPEED;
    return {
      scene: sc,
      seed,
      stage: game.stage,
      score: Math.floor(game.score),
      best: game.best,
      timeLeft: game.timeLeft,
      speedKmh: game.speed / KMH,
      playerX: game.playerX,
      distanceM: game.pos / UNITS_PER_M,
      goalRemainingM: Math.max(0, (game.course.goalZ - (game.pos + PLAYER_Z)) / UNITS_PER_M),
      checkpointsPassed: game.checkpointsPassed,
      overtakes: game.overtakes,
      crashes: game.crashes,
      invulnerable: game.invulnTimer > 0,
      trafficTotal: game.trafficTotal,
      layoutHash: game.layoutHash,
      muted: game.muted,
      rank: sc === 'ending' ? game.rank : null,
      audio: {
        state: audio.state,
        bgm: bgmFor(sc),
        engineHz: engineOn(sc) ? 60 + 140 * sp01 : 0,
      },
    };
  }

  window.__game = { getState };
  if (debug) {
    window.__game.debug = {
      warp: (m) => game.warp(m),
      setTime: (s) => game.setTime(s),
      setPlayerX: (x) => game.setPlayerX(x),
      setSpeedKmh: (v) => game.setSpeedKmh(v),
      // 以下は自己検証用の読み取り専用の補助(仕様の 4 メソッド以外)
      traffic: () => game.traffic.map((c) => ({
        type: c.type, lane: c.lane, x: c.x, z: c.z, speed: c.speed, eff: c.eff, hit: c.hit, passed: c.passed,
      })),
      audio: () => ({
        masterGain: audio.master ? audio.master.gain.value : null,
        ctxState: audio.state,
        bgmId: audio.bgmId,
      }),
    };
  }
}

// ------------------------------------------------------------------ 起動
// (const の初期化が終わってから呼ぶため、ファイルの末尾に置く)

if (params.get('gallery') === '1') {
  import('./gallery.js').then((m) => m.startGallery());
} else {
  startGame();
}
