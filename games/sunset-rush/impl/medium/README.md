# SUNSET RUSH (medium)

## 起動方法

```sh
cd games/sunset-rush/impl/medium/dist
python3 -m http.server 5100     # http://localhost:5100/
```
ビルド不要、依存ゼロ。`?gallery=1` でアセットギャラリー、`?debug=1&seed=42&stage=2&mute=1` などが使える。

## ファイル構成

- `dist/index.html` エントリ(canvas 640x360、タッチボタン DOM)
- `dist/js/main.js` ゲーム本体(状態遷移・物理・疑似3D描画・HUD・入力・`window.__game`)
- `dist/js/course.js` 定数、ステージ表、セグメント生成、交通車・路側物の配置、乱数
- `dist/js/art.js` 全画像アセットをコードで生成
- `dist/js/font.js` `font_pixel`(5x7、52 グリフ)と drawText
- `dist/js/audio.js` Web Audio 合成(エンジン、BGM シーケンサ、SFX)
- `dist/js/gallery.js` アセットギャラリー

## 作ったアセット(すべて起動時にコードで描画。外部ファイルなし)

- 車: car_player 40x22 (3 フレーム) と car_player_brake、car_sedan / truck / sports(各 1 フレーム + 色違い 2 種)
- 路側物: rs_palm rs_rock rs_billboard(S1)、rs_pine rs_boulder rs_signpost(S2)、rs_lamp rs_neon rs_bollard(S3)、decor: rs_shrub rs_fern rs_building rs_building_b
- ゲート: gate_checkpoint / gate_goal / gate_start(160x64)
- 背景: bg_sky_1..3(640x180)、bg_far_1..3(640x96)、bg_near_1..3(640x56)。水平シームレス
- logo_title(232x76、斜体+グラデ+縁取りのドット絵ロゴ)、font_pixel(5x7、52 グリフ)
- fx_smoke(12x12 x4)、fx_dust(8x8 x3)、fx_spark(6x6 x3)
- 音: bgm_1/2/3(128/138/150 BPM、8 小節ループ、ベース+リード+ドラム)、sfx_engine、beep、go、checkpoint、crash、goal、timeup、menu、overtake、offroad、timewarn、jingle_title

## 仕様の解釈

- 路側物の solid は各ステージ 3 種(Should の #3 を含む)、S3 の decor は 2 種から一様抽選。
- 交通車の色違いは抽選で決める(seed 由来なので layoutHash に含まれる)。
- countdown 中は交通車を動かさない。タイトルの背景走行は交通車を追い越し済み扱い(当たり・得点なし)。
- ブラウザ blur / 非表示では、キー状態をクリアし、playing 中なら自動で paused にする(S-15)。
- `audio.engineHz` は getState 側で scene とスピードから算出して返す(60 + 140 sp)。
- GO! 後 1 秒までステージ名を出したままにする。

## 受け入れ基準の自己チェック

Playwright(Chromium)で実測: 5・6・7(3 秒後 180 km/h)・8(ブレーキ 152.5 減)・9(惰性後 110)・10・11(直線でない位置でも交通車に当たらなければ x=-1.08)・12(76 km/h 付近)・18/19(衝突後 60 km/h、無敵 1.2 秒)・21・22(+17〜18 秒、+500 付近)・23・24・25・26・27・29・31・32(localStorage 例外でも最後まで動作)・33・34(state=running、bgm、engineHz)・35(blur)・36(seed 42 で同一ハッシュ、43 で別)・38(ギャラリー全 canvas に絵あり、音ボタンあり)・1〜3(サブパス配信、375x667 / 1920x1080 でスクロールなし、404・コンソールエラー 0)は **合格**。
13・14・15・16・17・20・26 の見た目はスクリーンショットで目視確認(S1〜S3 の色調の違い、坂・カーブ、縞、+50 加算、3 車種)。42(同一レーンの重なり)は実装ロジックのみで、長時間の目視確認はしていない。
37: CPU スロットル x6 でも 3 秒後 182 km/h、timeLeft 減少 3.05 秒だったが、実 fps は 61 のままで 30fps までは落とせていない(固定ステップのアキュムレータ実装なので理論上は成立)。
Should は S-01〜S-07、S-09(タッチ UI は実機・エミュレーション未検証)、S-10〜S-18 の多くを実装。BGM の音色そのものは耳で確認していない(生成・実行エラーなしのみ)。

## 既知の問題

- タッチ操作は未検証。
- 音の聴感品質は未確認。
- `car_player_wheel` は未実装(Should)。
