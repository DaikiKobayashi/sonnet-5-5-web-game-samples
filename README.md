# sonnet-5-5-web-game-samples

Sonnet 5.5 の実力を測るために、**モデルを固定して**さまざまなブラウザゲームを作るプロジェクトです。

主軸は Sonnet 5.5 の検証です。同じ仕様書から effort を変えて実装させ、出来栄えを比べます。
加えて参考として、**他のモデルをデフォルトの effort で動かした場合**(Opus 5.5 = `medium`、Fable 5.1 = `high`)も同じ仕様書から作らせて並べます。

1. **仕様書**: Sonnet 5.5 の `xhigh` で 1 本書く(`games/<game-id>/SPEC.md`)。ジャンル・ルール・技術スタックも Sonnet 5.5 が決めます。
2. **実装**: その仕様書を、Sonnet 5.5 の `low` / `medium` / `high` / `xhigh` / `max` と、参考の Opus 5.5(`opus-medium`)・Fable 5.1(`fable-high`)でそれぞれ実装する(`games/<game-id>/impl/<variant>/`)。
3. **評価**: **Opus 5.5** が、実装を見る前に評価計画を立て(`EVAL.md`)、ブラウザで実測して比較する(`eval/`、`RESULTS.md`)。
   作り手(Sonnet 5.5)と評価者を分けています。

ピクセルアートや効果音などの**アセットも、実装ごとにゼロから作らせて完全に分けています**。何が出来上がるかを見比べられます。

制作側のモデルと effort の固定は [`.claude/settings.json`](.claude/settings.json) と [`.claude/agents/`](.claude/agents/) にあります。
作業手順は [`CLAUDE.md`](CLAUDE.md)、結果の書式は [`docs/results-template.md`](docs/results-template.md) を参照してください。

## 遊ぶ(GitHub Pages)

公開ページ: <https://daikikobayashi.github.io/sonnet-5-5-web-game-samples/>(Pages を有効化したあと)

Home でゲームを選ぶ → 開きたい effort のボタンを押す → その effort で作られたゲームが開きます。
ローカルで確認するには:

```sh
node scripts/build-site.mjs --serve   # http://localhost:8080
```

## ゲーム一覧

| ゲーム | 概要 | 技術スタック | 仕様書 | 結果 |
| --- | --- | --- | --- | --- |
| [Dynamite Mole](https://daikikobayashi.github.io/sonnet-5-5-web-game-samples/games/dynamite-mole/) | ダイナマイトで岩を吹き飛ばし、洞窟の敵を倒して出口を目指すボンバーマン系のグリッドアクション(全 5 ステージ、敵 4 種) | Vanilla JS + Canvas 2D + Web Audio(依存・ビルドなし) | [`SPEC.md`](games/dynamite-mole/SPEC.md) | [`RESULTS.md`](games/dynamite-mole/RESULTS.md)(Must は 5 実装とも 40/40、Should は low 14/15・他 15/15。参考実装は `opus-medium` / `fable-high` とも Must 40/40・Should 14/15) |
| [SUNSET RUSH](https://daikikobayashi.github.io/sonnet-5-5-web-game-samples/games/sunset-rush/) | 夕焼けを追いかけて海岸線から夜の街まで駆け抜ける、制限時間つきの疑似 3D アーケードレーサー(全 3 ステージ、チェックポイントで時間延長、ランク S〜C) | Vanilla JS + Canvas 2D + Web Audio(依存・ビルドなし) | [`SPEC.md`](games/sunset-rush/SPEC.md) | [`RESULTS.md`](games/sunset-rush/RESULTS.md)(Must は 5 実装とも 42/42、Should は low 11/18・medium / high / xhigh 17/18・max 18/18。参考実装は `opus-medium` が Must 42/42・Should 18/18、`fable-high` が Must 42/42・Should 17/18) |

参考実装(`opus-medium` / `fable-high`)は別枠で、モデル間の優劣を断定するものではありません。
また、2 つのゲームは評価の枠組みが違う(`sunset-rush` は評価担当が先に評価計画を固定、`dynamite-mole` は評価計画なし)ため、結果を同じ物差しで比べないでください。

## ライセンス

[MIT](LICENSE)
