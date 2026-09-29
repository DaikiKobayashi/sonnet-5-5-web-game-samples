# sonnet-5-5-web-game-samples

Sonnet 5.5 の実力を測るために、**モデルを固定して**さまざまなブラウザゲームを作るプロジェクトです。

- 各ゲームは `games/<game-id>/` に置いた、ビルド不要・依存ゼロの静的 Web ページです。
- モデルの固定設定は [`.claude/settings.json`](.claude/settings.json) にあります。
- 作業ルールは [`CLAUDE.md`](CLAUDE.md) を参照してください。

## はじめかた

必要なもの: Node.js 20 以上(開発サーバーとスキャフォールド用。ゲーム自体は静的ファイルのみ)。

```sh
npm run dev
# → http://localhost:8080 にゲーム一覧が表示されます
```

## 新しいゲームを追加する

```sh
npm run new -- my-game "ゲームのタイトル" "一行説明"
```

`games/my-game/` が雛形から作られ、`games/games.json` に登録されます。
`main.js` を書き換えてゲームを作り、`README.md` の評価メモ(プロンプト・出来栄え)を埋めてください。

## ディレクトリ構成

```
index.html        ゲーム一覧
games/            ゲーム本体(_template は雛形)
scripts/          開発サーバー・スキャフォールド
.claude/          Claude Code のプロジェクト設定(モデル固定)
```

## ライセンス

[MIT](LICENSE)
