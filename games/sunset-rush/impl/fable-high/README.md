# SUNSET RUSH — impl/fable-high

夕焼けを追いかけて海岸線から夜の街まで駆け抜ける、制限時間つきの疑似 3D アーケードレーシング。
依存ゼロ(npm なし・ビルドなし)。`dist/` がそのままソースであり公開物です。

## 起動方法

```sh
cd games/sunset-rush/impl/fable-high/dist
python3 -m http.server 5100      # http://localhost:5100/ を開く(ポートは任意)
```

- `index.html?gallery=1` … アセットギャラリー
- `?seed=<整数>` / `?stage=<1〜3>` / `?debug=1` / `?mute=1` … 仕様書 §7.3 のとおり

## ファイル構成

```
dist/
  index.html        エントリ(CSS・タッチボタン・ギャラリー用コンテナを含む)
  js/main.js        起動(URL パラメータ、ゲームループ、window.__game)
  js/const.js       定数、ステージ表(セクション・チェックポイント・パレット)
  js/util.js        clamp / lerp / mulberry32 / FNV ハッシュ / 色ユーティリティ
  js/pix.js         ピクセル描画ヘルパー(RGBA バッファ → canvas)
  js/font.js        5x7 ビットマップフォント(font_pixel)のデータと描画
  js/art.js         文字列で描いたスプライト(自車・交通車・岩・低木・シダ・車止め)
  js/assets.js      全画像アセットを起動時に生成(文字列アート+手続き描画)
  js/audio.js       Web Audio 合成(エンジン音・BGM 3 曲のシーケンサ・効果音)
  js/course.js      セグメント生成、交通車・路側物・ゲートの配置(seed 付き乱数)
  js/game.js        状態遷移とシミュレーション(固定ステップ 1/60)
  js/render.js      疑似 3D 描画(投影・スキャンライン道路・スプライト)、HUD、各画面
  js/input.js       キーボード(KeyboardEvent.code)とタッチボタン
  js/gallery.js     ?gallery=1 のアセットギャラリー
```

## 作ったアセット(すべて自作。起動時にコードで生成)

外部素材・フォント・音声ファイルは一切使っていません。画像は `pix.js` の RGBA バッファに描いて offscreen canvas 化し、
音はすべて Web Audio のオシレータ/ノイズで合成しています。

### 画像(Must)

| ID | サイズ | フレーム | 作り方 |
| --- | --- | --- | --- |
| car_player | 40×22 | 3 | 文字列アート(後ろ姿の赤いスポーツカー)。左右フレームは上部の行を 1〜3px ずらして作成 |
| car_sedan / car_truck / car_sports | 36×20 / 44×34 / 38×18 | 各 3(色違い) | 文字列アート+パレット差し替え |
| rs_palm / rs_pine / rs_boulder / rs_lamp / rs_neon / rs_building | 表のとおり | 1 | 手続き描画(幹・葉・段々の三角・窓の格子など)+輪郭付け |
| rs_rock / rs_shrub / rs_fern | 32×22 / 32×20 / 28×16 | 1 | 文字列アート |
| gate_checkpoint / gate_goal | 160×64 | 1 | 手続き描画。バナー文字は font_pixel を 2 倍で焼き込み |
| bg_sky_1..3 | 640×180 | 1 | 帯グラデーション(境界をディザ)+縞入りの太陽/三日月/満月/星 |
| bg_far_1..3 | 640×96 | 1 | S1: 海・島・灯台・ヨット、S2: 周期ノイズの山並み+松のギザギザ、S3: 窓の灯った街のシルエット。すべて水平タイル可 |
| logo_title | 356×80 | 1 | 専用の太字レターフォーム(7×9)を 4 倍・斜体化し、行ごとのグラデーション+輪郭+影、背後に縞入りの太陽 |
| font_pixel | 5×7 | 52 グリフ | A〜Z、0〜9、`. , : ! ? + - / % ' [ ] < > =`、空白 |
| fx_smoke | 12×12 | 4 | 半透明の円を重ねた煙(拡大しつつ薄くなる) |

### 画像(Should)

bg_near_1..3(640×56 砂丘/松林/近景ビル)、rs_billboard(48×56)、rs_signpost(20×44)、rs_bollard(12×16)、
rs_building_b(64×112)、gate_start(160×64)、car_player_brake(3)、car_player_wheel(6 = 3 操舵 × 2 タイヤ位相)、
fx_dust(8×8 ×3)、fx_spark(6×6 ×3)、交通車の色違い(各 3 色)。

### 音

| ID | 内容 |
| --- | --- |
| bgm_1 | 128 BPM、8 小節ループ。ベース(のこぎり波)+リード(矩形波・ビブラート)+コードスタブ(三角波)+ドラム(キック/スネア/ハット) |
| bgm_2 | 138 BPM、A マイナー。16 分のベース+短調のリード+パッド+ドラム |
| bgm_3 | 152 BPM、E マイナー。16 分アルペジオ主体+ロングトーンのリード+ベース+ドラム |
| sfx_engine | のこぎり波+矩形波+三角波をローパスに通し、`60 + 140 × sp` Hz、ゲイン `0.05 + 0.07 × sp` |
| sfx_beep / sfx_go | 440 Hz 0.15 秒 / 880 Hz 0.4 秒 |
| sfx_checkpoint / sfx_goal / sfx_timeup / sfx_menu / sfx_crash | 上昇 3 音 / ファンファーレ約 1.4 秒 / 下降音列 / ブリップ / ノイズ+低音の減衰 0.4 秒 |
| sfx_overtake / sfx_offroad / sfx_timewarn / jingle_title | Should。風切り / ローパスノイズのループ / ティック / 上昇アルペジオ |

## 仕様の解釈と判断したこと

- **衝突と追い越しの順序**: 同じステップで衝突と追い越しが重なった場合は衝突を先に判定し、`hit` になった車には追い越し得点を入れない(§3.6「衝突した相手には…追い越し得点も入らない」に合わせた)。
- **路側物の z**: セグメント内位置は指定がないため、セグメント中央(`seg × 200 + 100`)に置いた。
- **solid を置けないセグメント**(`seg < 40`、ゲート ±4): 乱数は消費するが何も置かない(decor に差し替えない)。
- **カウントダウン中の交通車**: プレイヤー車は停止するが、交通車は走らせている(タイマーと自車だけ停止と解釈)。
- **タイトルの自動走行**: ステージ 1 の世界を 180 km/h で走り、交通車を避ける簡単なレーン選択を行う。末尾付近で `pos = 0` に戻し、配置を作り直す(同じ seed なので同一配置)。
- **カメラ背後のスプライト**: `p1.camZ ≤ CAM_DEPTH` のセグメント(常に n = 0)のスプライトは投影値が不定になるため描かない。丘の陰のセグメントは仕様どおり投影値と `clipY` で描く。
- **フォグ**: 深度 `d = n / DRAW_DIST` に対し `1 − exp(−d² × density)` をステージのフォグ色へブレンド(16 段階に量子化)。スプライトは `1 − fog²` の不透明度で溶かす。
- **点滅する残り時間**: 10 秒以下では赤と暗い赤を 0.25 秒ごとに交互に表示(読めるままにした)。
- **engineHz の報告**: `getState().audio.engineHz` はシーンから計算(countdown / playing / stageclear / timeup で `60 + 140 × sp`、それ以外は 0)。
- **audio.bgm**: countdown / playing / paused では `bgm_<stage>`、それ以外は `null`。
- **スタートゲート**(Should): セグメント 8 に置く。真下(スタート時)から見えるのはバナー下部だけになるため、start のバナーだけ少し高くして帯として見えるようにした。
- **検証時のポート**: 指示の 5107 は同時に動いていた別ゲームの担当が使用中だったため、そのプロセスは止めず、空いていた 5137 を使って検証した。

## 受け入れ基準の自己チェック(Playwright / Chromium で実測)

`impl/fable-high/` を静的配信し `/dist/index.html`(サブパス)経由で確認。

| # | 結果 | 根拠 |
| --- | --- | --- |
| 1 | 合格 | サブパス `/dist/` で動作。404・失敗リクエスト 0。参照はすべて `./` 相対 |
| 2 | 合格 | タイトル→S1→S2→S3→エンディング→タイトル→ゲームオーバーまで通し、console error/warning・pageerror・failed request・外部リクエストすべて 0 |
| 3 | 合格 | 1280×720 / 1920×1080 / 375×667 で canvas 640×360、16:9 維持、scrollWidth/Height = viewport、`image-rendering: pixelated` |
| 4 | 合格 | ロゴ・点滅 PRESS ENTER・BEST・操作説明を表示。0.7 秒差の 2 枚で道路と背景が動く |
| 5 | 合格 | Enter → countdown、3/2/1 とステージ名。↑ 押下中も speedKmh 0、timeLeft 30 |
| 6 | 合格 | GO! 表示、playing 5 秒後の timeLeft 24.27(開始 0.3 秒後計測、減少 1 秒/秒) |
| 7 | 合格 | 3.0 秒アクセルで 181 km/h |
| 8 | 合格 | 200 → 47.5(理論 50) |
| 9 | 合格 | 200 → 110.0 |
| 10 | 合格 | → で +、← で −。速度 0 では不変 |
| 11 | 合格 | warp(765)・200 km/h・1 秒後 playerX = −1.09 |
| 12 | 合格 | 直線区間で playerX 1.05、3 秒後 75.0 km/h |
| 13 | 合格 | カーブ・上り(頂上で向こう側が隠れる)・下りのスクリーンショットで確認 |
| 14 | 合格 | 右カーブ中に背景が左へ流れ、速度 0 で 2 枚が完全一致 |
| 15 | 合格 | スキャンライン塗りで継ぎ目なし。3 セグメント周期の縞 |
| 16 | 合格 | 3 車種を目視。trafficTotal 36 / 54 / 72 |
| 17 | 合格 | 追い越し時 overtakes +1、score +54(= 50 + 距離 4 m)。hit 車は加算なし |
| 18 | 合格 | 衝突直後 62.0 km/h、crashes +1、invulnerable 1.2 秒後 false、点滅・煙・火花 |
| 19 | 合格 | 直線で playerX 1.8 → ヤシ/岩に衝突(60 km/h、crashes 1) |
| 20 | 合格 | S1 ヤシ・岩・低木(+看板)、S2 松・大岩・シダ(+標識)、S3 街灯・ネオン・ビル(+車止め・別ビル) |
| 21 | 合格 | paused で 2 秒待って timeLeft・distanceM 不変。countdown / stageclear でも減らない |
| 22 | 合格 | warp(990) から 1 秒以内に +18 秒、+500、checkpointsPassed 1、バナー表示 |
| 23 | 合格 | setTime(2) → timeup(TIME UP)→ 約 2.5 秒後 gameover。GAME OVER / REACHED STAGE / SCORE / BEST 表示 |
| 24 | 合格 | 1381 → 5624(= +3200 + 1000 + 距離分)。GOAL! → 1.5 秒後にパネル |
| 25 | 合格 | stage 2、goalRemainingM 3594.2、timeLeft 32、trafficTotal 54、score 引き継ぎ |
| 26 | 合格 | S2 紫〜藍、S3 黒〜濃紺+ネオン。S3 開始 goalRemainingM 4194.2、timeLeft 32 |
| 27 | 合格 | ending、ALL CLEAR!、ランク文字(閾値どおり)、BEST。Enter でタイトル |
| 28 | 合格 | 追い越しなし走行で score 81 = floor(distanceM 81) |
| 29 | 合格 | P で paused、2 秒不変、P で復帰。R でリスタート、Q でタイトル |
| 30 | 合格 | R / gameover の Enter で stage=開始ステージ、score 0、overtakes 0、crashes 0、countdown から |
| 31 | 合格 | M で切り替え・表示更新、リロード後も保持、mute=1 で起動時ミュート |
| 32 | 合格 | NEW BEST! 表示、リロード後の BEST 更新。getItem/setItem が throw する状態でもエラーなしで gameover まで動作 |
| 33 | 合格 | HUD の全要素を表示。10 秒以下で赤く点滅 |
| 34 | 合格 | キー入力後 audio.state running。countdown/playing で bgm 非 null、stageclear/title で null。engineHz 60 / 130 / 200、title・paused で 0。ミュートはマスターゲイン 0 |
| 35 | 合格 | 矢印/Space を preventDefault。blur で押下状態クリア(加速し続けない)。repeat は無視 |
| 36 | 合格 | seed=42 で 2 回同じ layoutHash(a9d8baa6)、seed=43 で別値。R でも不変 |
| 37 | 合格 | CPU スロットリング(約 23 fps)で 3 秒アクセル 183 km/h、5 秒で timeLeft −5.1 |
| 38 | 合格 | ギャラリーに Must/Should 全画像(data-* 属性付き、複数色で描画)、音ボタン全 ID がエラーなく再生 |
| 39 | 合格 | 各ステージのスクリーンショットで自車 3 フレーム・3 車種・背景・路側物・ゲート・煙・ロゴ・文字を確認 |
| 40 | 合格 | `fillText` / `ctx.font` はソースに存在しない(grep) |
| 41 | 合格 | 通しプレイでフリーズ・状態混線なし |
| 42 | 合格 | 同一レーンの先行車に合わせて減速。60 秒走行で重なりなし(目視) |

Should: S-01 フォグ、S-02 近景、S-03 ブレーキランプ、S-04 タイヤアニメ、S-05 シェイク+火花、S-06 スピード線、S-07 スレスレ +20、
S-08 BGM 3 曲+ジングル、S-09 タッチボタン(pointer: coarse のみ表示。実機未確認)、S-10 砂煙+砂利音、S-11 timewarn、
S-12 夜の光演出(ヘッドライト・街灯/ネオンの発光・テールランプ)、S-13 +50 ポップアップ、S-14 色違い、S-15 blur で自動ポーズ、
S-16 F フルスクリーン・FPS 表示、S-17 スタートゲート・信号ライト、S-18 ロゴの浮遊+輝き・リザルトのカウントアップ を実装。

## 既知の問題

- スタートゲート(セグメント 8)は開始時に真下から見上げる形になるため、カウントダウン中は画面上部にバナーの帯が大きく映る(仕様の位置どおり)。
- タッチ操作はタッチ端末のエミュレーションでのみ確認しており、実機では未確認。
- BGM 停止時、すでにスケジュール済みの直近 0.1 秒ぶんの音は短くフェードして消える。
