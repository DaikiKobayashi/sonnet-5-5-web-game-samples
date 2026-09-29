# sonnet-5-5-web-game-samples

Sonnet 5.5 の実力を測るために、**モデルを固定して**さまざまなブラウザゲームを作るプロジェクトです。

同じ仕様書から effort を変えて実装させ、出来栄えを比べます。

1. **仕様書**: Sonnet 5.5 の `xhigh` で 1 本書く(`games/<game-id>/SPEC.md`)。ジャンル・ルール・技術スタックも Sonnet 5.5 が決めます。
2. **実装**: その仕様書を、`low` / `medium` / `high` / `xhigh` / `max` の 5 段階の effort でそれぞれ実装する(`games/<game-id>/impl/<effort>/`)。
3. **評価**: ブラウザで実際に動かして、受け入れ基準の達成度などを比較する(`games/<game-id>/RESULTS.md`)。

ピクセルアートや効果音などの**アセットも、effort ごとにゼロから作らせて完全に分けています**。何が出来上がるかを見比べられます。

モデルと effort の固定は [`.claude/settings.json`](.claude/settings.json) と [`.claude/agents/`](.claude/agents/) にあります。
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
| (まだありません) | | | | |

## ライセンス

[MIT](LICENSE)
