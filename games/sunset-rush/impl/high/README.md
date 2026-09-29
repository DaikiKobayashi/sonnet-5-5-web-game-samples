# SUNSET RUSH (high)

疑似 3D(セグメント投影)アーケードレーサー。依存ゼロ・ビルドなし。`dist/` がそのまま実装のソースで公開物です。

## 起動方法

```sh
cd games/sunset-rush/impl/high/dist
python3 -m http.server 5100      # http://localhost:5100/ を開く
```

- アセットギャラリー: `index.html?gallery=1`
- 検証用 URL パラメータ: `seed=<整数>` `stage=<1-3>` `debug=1` `mute=1` `gallery=1`
- サブパス配信の確認: `impl/high/` をルートに配信して `/dist/index.html` を開く(参照はすべて相対パス)。

## ファイル構成

```
dist/
  index.html         canvas#game(640x360)、タッチボタン(DOM)、ギャラリー用コンテナ
  js/main.js         ルーティング(ゲーム / ギャラリー)
  js/boot.js         起動・入力・ゲームループ(固定ステップ 1/60、最大 6 ステップ/フレーム)・localStorage
  js/game.js         状態遷移・物理・交通車・路側物・衝突・スコア・検証フック
  js/course.js       ステージ表とセクション表からのセグメント生成
  js/render.js       疑似 3D 描画・スプライト・HUD・各画面オーバーレイ
  js/audio.js        Web Audio 合成(BGM 3 曲・SFX・エンジン・砂利音)
  js/assets.js       画像アセットの登録(すべてコード生成)
  js/sprites_cars.js / sprites_scenery.js / backgrounds.js / pix.js / font.js / const.js / util.js
  js/gallery.js      アセットギャラリー
```

## 作ったアセット(すべてコードで生成。外部素材・CDN なし)

| 種類 | ID | サイズ / フレーム | 作り方 |
| --- | --- | --- | --- |
| 自車 | `car_player` / `car_player_brake` / `car_player_wheel` | 40x22 x3 / x3 / x6(2x3) | 矩形・線で描いた赤いスポーツカー後ろ姿。左右フレームは行ごとのシアーで作成。ブレーキ版はテール点灯、wheel 版はタイヤの溝が 0.1 秒周期で動く |
| 交通車 | `car_sedan` `car_truck` `car_sports`(+`_v1` `_v2` 色違い) | 36x20 / 44x34 / 38x18 | 車種ごとの描画関数+パレット差し替え(各 3 色) |
| 路側物 | `rs_palm` `rs_rock` `rs_shrub` `rs_billboard` / `rs_pine` `rs_boulder` `rs_fern` `rs_signpost` / `rs_lamp` `rs_neon` `rs_bollard` `rs_building` `rs_building_b` | 仕様 6.2 / 6.3 のとおり | 4 階調の陰影付き塊描画、葉の曲線、階段状の松、窓の点灯パターンなどをコードで描画 |
| ゲート | `gate_checkpoint` `gate_goal` `gate_start` | 160x64 | 柱+看板ビーム(ハザード帯 / チェッカー / 赤白帯)。文字は自作フォントの字形を使用 |
| 背景 | `bg_sky_1..3` 640x180、`bg_far_1..3` 640x96、`bg_near_1..3` 640x56 | 各 1 | 空はベイヤーディザ付きグラデ+太陽/月/雲/星、遠景は海と島 / 山並みと松林 / 街のシルエット、近景は丘とヤシ / 松林 / ビル。すべて水平にシームレス(周期を 640 の約数にして描画) |
| ロゴ | `logo_title` | 256x112 | 自作フォントの字形を拡大→角落とし→スキュー→縦グラデ+走査線+押し出し+輪郭、背後に縞入りの太陽 |
| フォント | `font_pixel` | 5x7 x52 グリフ | A-Z、0-9、`. , : ! ? + - / % ' [ ] < > =`、空白を手書きの文字列テーブルから生成。色ごとに tint したアトラスをキャッシュ |
| エフェクト | `fx_smoke` / `fx_dust` / `fx_spark` | 12x12 x4 / 8x8 x3 / 6x6 x3 | ドット単位で描画 |
| 音(BGM) | `bgm_1`(D 長調 128BPM)`bgm_2`(A 短調 138BPM)`bgm_3`(E 短調 152BPM アルペジオ主体) | 16 小節ループ | ベース+リード+ドラム(キック・スネア・ハット)+コード/アルペジオを Web Audio で 16 分音符スケジューラ合成 |
| 音(SFX) | `sfx_engine` `sfx_beep` `sfx_go` `sfx_checkpoint` `sfx_crash` `sfx_goal` `sfx_timeup` `sfx_menu` `sfx_overtake` `sfx_offroad` `sfx_timewarn` `jingle_title` `jingle_clear` | — | 発振器+ノイズ+フィルタ+エンベロープ。エンジンはのこぎり+矩形をローパスに通し `60+140*sp` Hz |

## 仕様の解釈と判断

- 描画は遠→近の順(painter)で、道路セグメント→そのセグメントのスプライトの順に描く。`clipY` は仕様どおり記録し、スプライトを `clipY` より下で切り取る。丘の陰のセグメントは道路を描かない。隣接セグメントは 1px 重ねて継ぎ目を防ぐ。
- カメラに近すぎる(カメラからの距離 250u 未満)スプライトは描かない(巨大化の防止)。
- 遠距離フォグは道路色を段階的にステージのフォグ色へ混ぜ、遠いスプライトはアルファで溶かす(S-01)。
- 路側物・ゲートの z はセグメント先頭 +100u に置いた。ゲートの位置(セグメント)は仕様どおり。スタートゲートはセグメント 8。
- 路側物の solid は各ステージ 3 種(Should の 3 種目を含む)から一様抽選。decor は S1 が 1 種、S2 が 1 種、S3 が 2 種。
- 乱数の消費順は、交通車は「セグメント揺らぎ → z → レーン → 車種 → 速度 → 色違い」、路側物は各サイドで「種別 → 種類 → offset」を常に 3 回消費(置かない場合も)。
- `stageclear` の Enter はパネル表示(1.5 秒後)以降のみ受け付ける。距離スコアは `playing` 中のみ加算。
- タイトルの自動走行は、交通車を避けるように空いたレーンへ寄る簡易処理。末尾付近で先頭に戻す(世界を作り直す)。
- 「スレスレ」は 180 km/h 以上で横方向の隙間が 0 以上 0.12 未満の追い越しで +20 と `NEAR MISS +20` を表示。
- S-15 は、ページ非表示(`visibilitychange`)では自動一時停止するが、`blur` では押下状態のクリアのみ(受け入れ基準 35 の「blur で車が加速し続けない」を素直に観測できるようにするため)。
- `debug=1` の `debug.masterGain()` は検証用に追加(仕様のメソッド以外は追加のみ)。
- ミュート状態は `mute=1` の場合は保存しない(`M` を押しても保存しない)。`mute=1` なしなら押すたびに保存。
- `stageclear` 中も背景の視差・交通車は進む(車は自動減速)。

## 受け入れ基準の自己チェック(Playwright + Chromium で実測。サブパス `/dist/index.html` 経由)

| # | 結果 | 根拠 |
| --- | --- | --- |
| 1 | 合格 | `impl/high/` を配信し `/dist/index.html` で 404 なし。参照はすべて `./js/...` |
| 2 | 合格 | タイトル→S1→S2→S3→ending→title を通しでコンソールエラー・失敗リクエスト 0、外部リクエスト 0 |
| 3 | 合格 | 1920x1080 / 1280x720 / 375x667 で canvas が 16:9、scrollWidth=viewport、`image-rendering: pixelated`、backing 640x360 |
| 4 | 合格 | ロゴ・点滅 PRESS ENTER・BEST・操作説明を目視、背景は自動走行(スクリーンショットで確認) |
| 5 | 合格 | Enter で countdown、カウント中の ↑ でも speed 0・timeLeft 30 のまま。STAGE 1 / SEASIDE 表示 |
| 6 | 合格 | GO! 表示後 timeLeft が約 1/秒で減少(5 秒後 25 付近を確認するテストは 3 秒で 26.7 など整合) |
| 7 | 合格 | 3.0 秒アクセルで 180 km/h(実測 180) |
| 8 | 合格 | 200 km/h から 1 秒ブレーキで 150 減 |
| 9 | 合格 | 200 km/h から 2 秒惰性で 109 |
| 10 | 合格 | → で playerX 増、← / A で減。速度 0 では変化しない(ロジック上 dxp=0) |
| 11 | 合格 | warp(765)・200km/h・操舵なしで 1 秒後 playerX = -1.07 |
| 12 | 合格 | playerX=1.05 で 3 秒後 75 km/h、草の面を走行する画面を確認 |
| 13 | 合格 | カーブ・上り/下りの頂上で向こう側が隠れる画面を確認(S2 warp 1235 付近) |
| 14 | 合格 | 右カーブで背景が左へ流れる実装(仕様式どおり)。speed 0 で Δpos=0 なので停止。※動きは式で確認、連続スクリーンショット比較は未実施 |
| 15 | 合格 | 縞・継ぎ目なしをスクリーンショットで確認 |
| 16 | 合格 | 3 車種(+色違い)がステージ 1〜3 で出現。trafficTotal 36 / 54 / 72 |
| 17 | 合格 | 追い越しで overtakes+1、score+約 52(50 + 距離点)を実測。衝突した車は加算なし(実装) |
| 18 | 合格 | 衝突直後 speed 61、crashes+1、invulnerable true、点滅・煙・火花・シェイクを確認 |
| 19 | 合格 | playerX=1.8 走行で路側物に衝突(crashes 1、invulnerable true) |
| 20 | 合格 | 各ステージの solid 2〜3 種・decor をスクリーンショットで確認 |
| 21 | 合格 | 一時停止中 2 秒 timeLeft/distanceM 不変(実測)。countdown 中は減らない(実測)。stageclear 中は実装上減らない |
| 22 | 合格 | warp(990) で約 0.7 秒後 timeLeft +17.3(+18 から経過分減算)、score +544(500+距離)、checkpointsPassed 1、バナー・ゲートを確認 |
| 23 | 合格 | setTime(2) → timeup → 約 2.5 秒後 gameover。GAME OVER / REACHED STAGE / SCORE / BEST を表示 |
| 24 | 合格 | warp(2950) で stageclear、score +2944(残り 19 → 1900 + 1000 + 距離点)、1.5 秒後にパネル |
| 25 | 合格 | stage 2: goalRemainingM 3594.2、timeLeft 32、trafficTotal 54、score 引き継ぎ |
| 26 | 合格 | S2 紫〜藍、S3 黒〜濃紺+ネオンをスクリーンショットで確認。S3 goalRemainingM 4194.2、timeLeft 32 |
| 27 | 合格 | S3 クリアで ending、ALL CLEAR!・スコア・ランク・BEST 表示、rank 判定は閾値どおり、Enter でタイトル |
| 28 | 合格 | 距離点 1 点/m(HUD と getState が同じ score を参照) |
| 29 | 合格 | P/Esc で paused、PAUSED 表示、R で countdown、Q で title(実測) |
| 30 | 合格 | R で stage=開始ステージ、score/overtakes/crashes 0、countdown。gameover の Enter で再開、Esc/Q でタイトル |
| 31 | 合格 | M で muted 切替・HUD 表示変化。localStorage の muted がリロード後に復元、`mute=1` で起動時ミュート |
| 32 | 合格 | 更新時 NEW BEST! 表示、best が保存されリロード後のタイトルに反映。getItem/setItem が例外でもエラーなく最後まで進行 |
| 33 | 合格 | HUD 全項目をスクリーンショットで確認。timeLeft ≤ 10 で赤点滅(実装。目視の点滅確認は未実施) |
| 34 | 合格 | 最初のキー入力後 audio.state=running。countdown/playing で bgm=bgm_N、title/stageclear/timeup で null。engineHz: countdown 60、150km/h で 128.6、300km/h で 199.3、title/paused で 0。M で masterGain 0(debug.masterGain で確認) |
| 35 | 合格 | 矢印・Space は preventDefault。blur で押下クリア(1 秒後に速度が下がることを確認)。keydown の repeat は決定に使わない |
| 36 | 合格 | seed=42 を 2 回読み込みで layoutHash 一致(dc15c15a)、seed=43 は別(7d54578b)、R リスタートで不変 |
| 37 | 合格 | CPU 12 倍スロットル(約 17fps)で timeLeft の減少と速度が整合(3 秒相当で 165 km/h、sim 時間 2.75 秒ぶん)。60fps 時と同じ式で進む |
| 38 | 合格 | ギャラリーの data-asset-id / data-frames / frame-w / frame-h を確認、全 canvas に絵あり。音ボタン(Must の ID すべて+mute)を押してエラーなし |
| 39 | 合格 | 3 フレームの自車・3 車種・各ステージの背景と路側物・ゲート・煙・ロゴ・フォントが画面に描かれることを確認 |
| 40 | 合格 | ソース内に `fillText` / `ctx.font` の使用なし(grep) |
| 41 | 合格 | 通しプレイ(warp 使用)でフリーズ・状態の混線なし |
| 42 | 合格 | 実装上、同レーンの先行車が 1000u 以内なら有効速度を min で合わせる。目視で重なりなし(長時間の網羅観察は未実施) |

Should: S-01 フォグ、S-02 近景、S-03 ブレーキ灯、S-04 タイヤアニメ、S-05 画面シェイク・火花・車の傾き、S-06 速度線(250km/h 以上)、S-07 スレスレ、S-08 bgm_2/3 とジングル、S-09 タッチ(エミュレーションでボタン表示・押下中のみ加速を確認)、S-10 砂煙・砂利音、S-11 timewarn、S-12 夜の光演出(ヘッドライト・街灯/ネオンのグロー・テールランプ)、S-13 +50 ポップアップ、S-14 色違い、S-15 一部(非表示時のみ)、S-16 F でフルスクリーン+debug の FPS、S-17 スタートゲート・信号ライト。S-18 はロゴの浮遊・輝きのみ(リザルトのカウントアップ・フェードは未実装)。

## 既知の問題

- BGM・効果音は Web Audio の合成で、オフライン描画でクリップしないことは確認したが、実際に聞いた確認(音色の良し悪し)はできていない。
- 一部の受け入れ項目(14 の連続比較、33 の点滅目視、42 の長時間観察)は式・実装の確認に留まる。
- S-15 の blur 自動ポーズは意図的に非対応(上記)。
- ロゴはスキューと角落としの都合で拡大表示すると字形がやや崩れる(実寸では読める)。
