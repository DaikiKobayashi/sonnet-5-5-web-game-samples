# Dynamite Mole (medium)

Plain JavaScript + Canvas 2D + Web Audio. No build, no dependencies. `dist/` is the source and the published site.

## 起動方法

```
cd games/dynamite-mole/impl/medium
python3 -m http.server 5102
# http://localhost:5102/dist/index.html
```

URL params: `?seed=N` `?stage=1-5` `?debug=1` `?mute=1` `?touch=1`.

## ファイル構成

```
dist/index.html   entry, canvas + touch UI (DOM)
dist/font.js      A18 bitmap font (5x7 glyphs in 8x8 cell), text recorder for snapshot().texts
dist/level.js     mulberry32, stage table, deterministic level generator (SPEC 3.3)
dist/art.js       all sprites/tiles/logo/background, generated in code
dist/audio.js     Web Audio sfx + chiptune BGM sequencer
dist/game.js      state machine, rules, rendering, input, __GAME__ hooks
dist/favicon.svg  A22
```

## 作ったアセット(すべてコード生成・自作)

| ID | 内容 | 作り方 |
| --- | --- | --- |
| A01 | モグラ 4 方向 x 歩行 4 フレーム + 待機呼吸(右は左の反転) 32x32 | 16x16 のドット絵を関数で描き、2 倍拡大。自動で暗い輪郭線を付与 |
| A02 | モグラ死亡 6 フレーム(白フラッシュ、X 目、星が回る、つぶれる) | 上記の派生 |
| A04-A07 | slime 4f / bat 4f / ghost 3f + 追跡時(赤目)3f / golem 4f + 被弾白フラッシュ(コードで白化) | 同上 |
| A08 | 敵死亡エフェクト 3 フレーム | 同上 |
| A09-A12 | 床(2 種 + 装飾変種)/ 外壁 / 柱 / 岩 + 崩壊 3 フレーム x 5 テーマ | パレットとテーマ別アクセント(木の梁 / キノコ / 結晶 / 溶岩の割れ目 / 発光点) をコードで描画 |
| A13 | 出口 閉 1 + 開 2(光る) | 同上 |
| A14 | ダイナマイト 3 フレーム(火花)+ 白点滅版 | 同上 |
| A15 | 炎 中心 / 腕(横縦)/ 先端(4 方向) x 2 フレーム | 描画 + 回転 |
| A16 | アイテム 4 種 x 2 フレーム(きらめき) | バッジ + アイコン |
| A17 | HUD ライフアイコン 16x16 | モグラから縮小 |
| A18 | ビットマップフォント A-Z 0-9 と記号 | 5x7 のグリフ定義 |
| A19 | ロゴ(DYNAMITE MOLE、440x120 以内) | フォントを拡大して縁取り・押し出し・グラデーション |
| A20 | タイトル背景 480x416(洞窟、鍾乳石、梁、結晶、ランタン)+ 蛍・火花・歩くモグラ | コード描画 |
| A21 | HUD パネル(レンガ)/ 枠付きパネル | コード描画 |
| A22 | favicon.svg | 手書き SVG |
| A23 | タッチ UI(DOM / CSS ボタン) | CSS |
| A24-A29 | 無敵点滅、被弾点滅、スコアポップアップ、画面シェイク(reduced-motion 対応)、パーティクル、環境光(プレイヤーのランタン、炎、ビネット) | コード |
| 音 | 15 種の SFX(合成)、BGM 6 曲(title + stage1-5 は別々の曲、残り 30 秒でテンポ 1.3 倍) | Web Audio。矩形/三角/のこぎり波 + ノイズ。メロディは調・進行・シードを曲ごとに決めて生成 |

ゲーム世界のドットはすべて 2x2 px(16x16 のグリッドを 2 倍)。文字は 2x 以上の整数倍率。

## 仕様の解釈

- `snapshot().texts` の `X3`: フォントは大文字のみのため `x` を `X` として描く(仕様どおり大文字化)。
- ロゴは画像だが、タイトル描画時に `DYNAMITE MOLE` を texts に記録する。
- 爆弾は Space/Z のキー入力の瞬間(tick を待たず)に置く。
- ステージクリアのボーナスは、仕様 5.5 に従い stageClear から次へ遷移する瞬間にスコアへ加算(画面には先に表示)。gameClear へ遷移するときも同様。
- 敵 AI の乱数はゲームプレイ用 RNG(seed XOR 0xC0FFEE)。
- 待機中の敵の 0.3 秒は、その間その敵の移動処理を止めるだけ(ステップの繰り越しはなし)。
- `hit` の点滅: 被弾後 0.8 秒、白フラッシュと非表示を繰り返す。
- ghost の「追跡」判定は、タイル到達ごとに行う。
- 出口は、岩が壊れて `revealed` になり、かつ `open` のときだけクリア判定。
- 死亡時、歩行中でも最寄りのタイルに位置を丸めて死亡演出を出す。
- タブ非表示で自動 `paused`(Should)。
- 死亡時にライフを減らしたあと `lives` は 0 でも HUD に `X0` と出る。

## 受け入れ基準の自己チェック

Playwright(Chromium)で実行したもの:

- M1 合格: `/dist/index.html` と `/medium/dist/index.html`(深いサブパス相当)で 404・コンソールエラー 0(favicon 含む)。
- M2 一部確認: stage 5 起点の gameClear、gameOver、リトライ、debug での各ステージ通過でエラー 0。5 ステージを実プレイで通しては未実施(debug 関数で短縮)。
- M3 合格: `localStorage` の getter が例外を投げる環境で起動・プレイ・gameClear まで エラー 0。
- M4 合格: 1280x720 / 800x600 / 390x844 でアスペクト比維持・スクロールなし・`image-rendering: pixelated`。
- M5-M7 合格: texts で確認(HUD の初期値含む)。stageIntro は 1.77 秒で playing、intro 中は移動不可・timeLeft 不変。
- M8-M10: level.js を SPEC どおりに実装。ステージ 1〜5 のスクリーンショットと、同じ seed の再現は目視/スナップショットで確認したが、8・9 の全項目の機械的な網羅検査(全ステージの不変条件チェック)は未実施。
- M11-M13 合格: 速度 4.47 タイル/秒、タップで 1 タイル、後押し優先の方向選択(ブロックのないマスで再確認していないため、判定は部分的)、爆弾 1 個制限、爆弾マスへ戻れない。
- M14-M15 合格: 導火線 約 2.5 秒(CPU 4x でも 2.55 秒)、炎 0.497 秒、柱で止まる、連鎖。
- M16-M19 合格: 死亡、1.2 秒、timeLeft 停止、復活 (1,1) と無敵、パワーアップ低下、gameOver の文言。
- M20-M22 合格: slime/bat 速度実測(2.10 / 3.35 タイル/秒、ステージ 3 の倍率込み)、ghost が近づく(距離 6 から 1.6)、golem hp 3→2→1→死亡。
- M23-M24 合格: アイテム 4 種の効果と +50、岩 +10、敵撃破スコア(実測は一部)。ブーツ 1 段で 5.1。
- M25-M27 合格: 出口 open / revealed、stageClear のテキスト・ボーナス(+500 + 秒*10)・約 3 秒で次ステージ、gameClear の文言、Esc でタイトル。
- M28 合格: 5 ステージのスクリーンショットで色相が別。
- M29 合格: タイムアップで死亡、復活後 60 秒。ライフ 1 でのタイムアップは gameOver。
- M30-M32 合格: 一時停止で timeLeft 固定、R でリスタート、ハイスコア保存・タイトル反映、NEW RECORD!。
- M33-M35 合格: unlocked、bgm、sfxLog(未確認: `gameOver` と `stageClear` は確認、`enemyDie/hit/item/life/exitOpen/pause/place/explode/break/playerDie` も log で確認)、M キーとリロード後の維持、`?mute=1`。
- M36-M37: 自作・統一ドット(2px)。スクリーンショットで確認。
- M38 合格: CPU 4x で導火線とタイマーが実時間どおり。
- M39 合格(キー入力がクリックなしで効く。スクロール防止は preventDefault を実装、スクロールバーなしを確認)。
- M40 合格: snapshot と debug の主要関数を使用して確認。
- Should: S1 タッチ(390x844 で収まりを確認、押下で移動)、S2 シェイク、S3 パーティクル、S4 ポップアップ、S5 ゴーストの赤目、S6 TIME 点滅と warn、S7 点滅加速、S8 BGM 6 曲とテンポアップ、S9 タブ非表示で paused、S10 タイトルのアニメ、S11 歩行 4 フレーム・呼吸・敵 3 フレーム以上、S12 環境光、S13 喜びジャンプと出口フラッシュ、S14 gameClear 専用ジングル、S15 導入画面の敵アイコン。うち S2/S5/S7/S8/S12/S13/S15 は実装したが、動作・見た目の詳細な検証は目視の範囲。BGM の音そのものは聴いて確認できていない(ヘッドレス)。

## 既知の問題

- 音は聴覚での確認をしていない。BGM/SFX のバランスは未調整の可能性がある。
- ヘッドレスでは `AudioContext` が動いても出力を確認できない。
- 通しの手動プレイ(5 ステージ)は debug 関数を使った短縮のみ。
