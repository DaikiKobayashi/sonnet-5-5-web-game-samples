# 評価ハーネス(dynamite-mole)

`SPEC.md` の受け入れ基準(Must 40 件 / Should 15 件)を、実装担当の自己申告に頼らず **ブラウザ(Playwright / Chromium)で実測**するためのスクリプトです。
実装ディレクトリ(`../impl/<effort>/`)は HTTP で配信して読むだけで、変更しません。5 実装に同じコードを流します。

## 使い方

```sh
# 実装を README の手順どおり配信する(low 5101 ... max 5105)
cd games/dynamite-mole/impl/low && python3 -m http.server 5101 &     # 以下同様に medium 5102, high 5103, xhigh 5104, max 5105

cd games/dynamite-mole/eval
export NODE_PATH=$(npm root -g)          # グローバルの playwright を使う
node run.js low                          # 全群を実行(1 実装あたり約 12 分)。結果は results/low.json、画像は screens/low/
node run.js high --only=c --fn=m22       # 特定の群・関数だけ再実行(結果は既存の JSON にマージされる)
node sheets.js                           # screens/<effort>/sheet-*.png(目視評価用のコンタクトシート)を作る
node report.js                           # results/*.json と manual.json を集計して results/summary.{json,md} を作る
```

タイミングの測定(導火線 2.5 秒・CPU 4 倍スロットリングなど)を含むので、同時に流すのは 2 実装までにしてください。

## 構成

| ファイル | 内容 |
| --- | --- |
| `lib.js` | 共通処理。ページ操作、`snapshot()` の形式検証、キー入力(45ms 押し続ける)、仕様 3.3 の参照ジェネレータ、爆風シミュレータ |
| `checks_a.js` | 起動・配信・レイアウト・マップ生成・キー入力(M1, M3-M10, M39) |
| `checks_b.js` | 移動・爆弾・連鎖・CPU スロットリング(M11-M15, M38) |
| `checks_c.js` | 死亡と復活、敵の速度・AI・被弾(M16-M22) |
| `checks_d.js` | スコア・アイテム・出口・ステージクリア・ゲームクリア(M23-M27) |
| `checks_e.js` | タイマー・一時停止・リスタート・ハイスコア・BGM 状態・ミュート(M29-M35) |
| `checks_f.js` | Should のうち自動で測れるもの(S1, S2, S4, S6, S9)と環境光(S12) |
| `checks_g.js` | スクリーンショット・連続フレームの撮影、ランダム入力(ファズ)、M2/M34/M40 の集計 |
| `checks_h.js` | 音の測定(出力を捕捉して、ピーク・曲の相関・テンポ・ジングルの長さを数値化) |
| `report.js` | 集計。目視で判定した項目は `manual.json` で上書きする |
| `results/` | 測定結果(`<effort>.json`、`summary.json`、`summary.md`) |
| `screens/` | 比較用のスクリーンショット(全部ではなく、比較に必要なものだけをコミット) |

## 測定の考え方と限界

- 仕様 3.3 のステージ生成は、評価側で独自に実装した参照アルゴリズムと、`grid`・出口・敵の初期位置を照合している(15 レイアウト x 5 実装)。
- 通しプレイは、`?debug=1` のフック(`killAllEnemies` / `clearBlocks` / `teleport` など)で短縮している。ただし、爆風で岩を壊す・爆風で敵を倒す・歩いて出口に乗る、といった個々の仕組みは実入力で確認している。ボットが実入力だけで全ステージを遊び切る検証は未実施。
- 音は聴いていない。`AudioContext` の出力を捕捉して、数値(ピーク・相関・立ち上がり頻度)で測っている。
- 画素の比較(点滅・フレーム数・環境光)は、火の粉や環境光のゆらぎに影響される。そのため、色に依存しない輝度の ON/OFF や、画素差の小さいフレームを同一とみなすクラスタリングで測っている。
- 画づくり・演出の良し悪しは自動化できないので、スクリーンショットとコードを見て判定した(`manual.json`)。Chromium(ヘッドレス)以外・実機のタッチは未確認。
