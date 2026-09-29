# CLAUDE.md

## このプロジェクトの目的

Sonnet 5.5 の実力を測るため、**モデルを固定したまま**さまざまなブラウザゲームを作る。
特に「同じ仕様書から、effort を変えて実装させたとき、出来栄えがどう変わるか」を比較する。

## モデル固定ポリシー

- モデルの設定は `.claude/settings.json` に集約している(`model` / `availableModels` / `env`)。
  サブエージェントも同じモデルで動くよう `CLAUDE_CODE_SUBAGENT_MODEL(_FORCE)` を指定済み。
- この設定を **ユーザーの明示的な指示なく変更しない**。
- `/model` や `--model` での上書きは技術的に可能なので、セッションのモデルが固定値と違うと気づいたら、
  作業を続ける前にユーザーへ伝える。

## 進め方: 仕様書 1 本 → 5 段階の effort で実装

effort は `low` / `medium` / `high` / `xhigh` / `max`(Sonnet 5.5 が対応する 5 段階)。ユーザーの言う「超高」は `xhigh`。

| 工程 | 担当(`.claude/agents/`) | effort | 出力 |
| --- | --- | --- | --- |
| 仕様書の作成 | `game-spec-writer` | `xhigh` | `games/<game-id>/SPEC.md` |
| 実装 | `game-implementer-low` / `-medium` / `-high` / `-xhigh` / `-max` | 名前どおり | `games/<game-id>/impl/<effort>/` |

effort は各エージェント定義の frontmatter で固定してあり、セッション側の effort を上書きする。
**このセッション(オーケストレーター)は仕様書も実装も自分では書かない**。必ず上のエージェントに任せる
(自分で書くと effort が条件からずれるため)。オーケストレーターの役割は、起動・統合・評価・記録。

### 手順

1. **お題を決める**: ユーザーがお題を指定すればそれを、「お任せ」なら仕様書担当に任せる。`game-id`(kebab-case)を決める。
2. **仕様書**: `game-spec-writer` に `game-id` とお題を渡して起動する。返ってきた `SPEC.md` を読み、
   受け入れ基準が観察可能か・数値が具体的かを確認する(不足なら仕様書担当に差し戻す。自分で書き換えない)。
3. **仕様書を固定**: `games/<game-id>/game.json`(`id` / `title` / `description` / `stack` / `createdAt`。
   仕様書の内容から書く。公開サイトの表示に使う)を作り、`SPEC.md` と一緒に main にコミットして **push する**。
   実装担当の worktree は既定ブランチから分岐するので、push 前に起動すると仕様書が見えない。
   以降 `SPEC.md` は書き換えない(直すなら 5 実装をやり直す)。
4. **実装**: 5 体の `game-implementer-*` を **同じメッセージで並列に**起動する。渡すのは `game-id` だけ
   (それ以上のヒントを個別に渡さない。条件を揃える)。各担当は独立した worktree で `impl/<effort>/` に書き、
   worktree 内でコミットする。
5. **統合**: 各担当が返したブランチを main にマージする(書き込み先が別ディレクトリなので衝突しない)。
   完了通知の usage(tokens / tool uses / 所要時間)は `RESULTS.md` に転記するため控えておく。
   マージ後は、5 つとも `impl/<effort>/dist/index.html` があるかを確認する(なければ公開サイトに載らないので、その事実を記録する)。
   使い終えた worktree とブランチを片付ける。
6. **評価**: 各実装を README の手順で起動し、`SPEC.md` の受け入れ基準を **ブラウザ(Playwright)で 1 つずつ確認する**。
   実装担当の自己申告をそのまま信じない。ポートは実装ごとに分ける(low 5101 … max 5105)。
7. **記録**: `docs/results-template.md` を `games/<game-id>/RESULTS.md` にコピーして埋める。
   ルート `README.md` のゲーム一覧に追記する。以上を 1 コミットにして main に push する。
8. **公開の確認**: `node scripts/build-site.mjs --serve` でローカルにサイトを作り、Home → ゲーム → effort → 各実装の
   遷移とアセットの表示を確認する。main への push で GitHub Pages に自動デプロイされる(下記)。

### 守ること(比較の公平性)

- **エージェント定義はセッション起動時に読み込まれる**。`.claude/agents/` を追加・変更したセッションでは、その定義を呼び出せない。
  `game-spec-writer` / `game-implementer-*` が見つからないときは、`general-purpose` など effort を固定できないエージェントで代用せず、
  作業を止めて「新しいセッションで再実行してほしい」とユーザーに伝える(定義を編集したら、次の実行は新しいセッションで行う)。
- 実装ディレクトリは、実装担当が完了した後に**オーケストレーターが修正しない**。バグがあってもそのまま評価し、所見に書く。
- 5 体には**同じ入力**(同じ `game-id`、同じ本文のエージェント定義)だけを与える。5 つの実装定義は effort とポート以外が同一に保たれている。
  変更するときは 5 本を同時に同じ内容で直す。
- 数値・合否は実測したものだけを書く。測っていないものは「未計測」と書く。
- 技術スタックは仕様書担当が決め、全実装で共通にする(スタックの違いが effort の差に混ざらないようにするため)。
- **アセット(ピクセルアート・背景・UI・効果音など)は実装ごとにゼロから自作させ、完全に分離する**。
  仕様書にはアセットの実データを載せず、方針・サイズ・最低ラインだけを書く。実装間でコピーや共有をさせない
  (effort ごとにどんなアセットができるかを見比べるため)。オーケストレーターも実装のアセットを差し替え・流用しない。

## 構成

```
.claude/settings.json          モデル固定の設定
.claude/agents/                仕様書担当 1 + 実装担当 5(effort を固定)
docs/results-template.md       実装比較の結果テンプレート
games/<game-id>/
  game.json                    公開サイトの表示用メタデータ
  SPEC.md                      仕様書(xhigh で作成、実装開始後は固定)
  RESULTS.md                   実装比較の結果
  impl/<effort>/               各 effort の実装(それぞれ独立・コードもアセットも共有なし)
    dist/                      公開用の静的サイト(dist/index.html がエントリ)
scripts/build-site.mjs         GitHub Pages 用サイトの生成(依存なし)
.github/workflows/pages.yml    main への push で Pages にデプロイ
README.md                      プロジェクト概要とゲーム一覧
```

## 公開サイト(GitHub Pages)

Home でゲームを選ぶ → そのゲームの effort 選択ページ → 押した effort の実装ページ、と遷移する。

```
/                          Home(ゲーム一覧)
/games/<game-id>/          effort 選択(low / medium / high / xhigh / max。dist がない effort は無効表示)
/games/<game-id>/<effort>/ 実装(impl/<effort>/dist/ の中身をそのままコピーして配信)
```

- 各実装の `dist/` は静的ファイルだけで動き、**相対パスのみ**を使う(サブパス配信のため)。この決まりは仕様書とエージェント定義に入っている。
- 実装ごとのアセットは、それぞれの `dist/` に閉じている。サイト生成はコピーするだけで、実装間で何も共有しない。
- ゲームの表示名・説明は `games/<game-id>/game.json` から読む。実装の有無は `dist/index.html` の存在で判定する。
- **初回のみ、リポジトリの Settings → Pages → Build and deployment → Source を「GitHub Actions」にする必要がある**
  (ワークフローからは切り替えられない。ユーザーの操作)。

## 共通ルール

- 著作権のあるアセットは使わない。音・画像はコードで生成するか自作する。
- 生成物(`node_modules` など)はコミットしない。配信物としてビルド成果物が必要な場合は、README に書いたうえでコミットしてよい。
- 実装は、実際にブラウザで起動して確認してからコミットする。クラウド環境には Chromium と Playwright が入っている
  (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`。`playwright install` は実行しない)。

## Git 運用

- **main ブランチに直接コミットする**(ユーザー了承済み)。ブランチや PR は、ユーザーが求めたときのみ作る
  (実装担当の worktree ブランチは統合後に片付ける)。
- 1 ゲームの区切りで、仕様書 / 実装の統合 / 結果記録をそれぞれコミットする。
- コミットメッセージ: `docs(<game-id>): spec` / `feat(<game-id>/<effort>): ...` / `docs(<game-id>): results` / `chore: ...`。
