# <ゲーム名> — 実装比較の結果

> `games/<game-id>/RESULTS.md` にコピーして使う。数値は実測したものだけを書く。

## 条件

| 項目 | 内容 |
| --- | --- |
| 実施日 | YYYY-MM-DD |
| お題 | (ユーザーの指示をそのまま。お任せなら「お任せ」) |
| 仕様書 | [`SPEC.md`](SPEC.md)(`game-spec-writer`、Sonnet 5.5 / effort `xhigh`) |
| 評価 | [`EVAL.md`](EVAL.md)(計画)と [`eval/`](eval/)(測定データ)。`game-evaluator`、Opus 5.5 / effort `high` |
| 技術スタック | (仕様書が決めたもの) |
| 受け入れ基準 | Must N 件 / Should M 件 |

## 実装ごとの結果

`tokens` / `tool uses` / `所要時間` は、実装担当の完了通知に含まれる usage の値。

| variant | 起動する | 受け入れ基準 Must | 受け入れ基準 Should | コンソールエラー | tokens | tool uses | 所要時間 | 実装 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| low | | /N | /M | | | | | [`impl/low`](impl/low/) |
| medium | | /N | /M | | | | | [`impl/medium`](impl/medium/) |
| high | | /N | /M | | | | | [`impl/high`](impl/high/) |
| xhigh | | /N | /M | | | | | [`impl/xhigh`](impl/xhigh/) |
| max | | /N | /M | | | | | [`impl/max`](impl/max/) |
| opus-medium(Opus 5.5・参考) | | /N | /M | | | | | [`impl/opus-medium`](impl/opus-medium/) |
| fable-high(Fable 5.1・参考) | | /N | /M | | | | | [`impl/fable-high`](impl/fable-high/) |

「起動する」「受け入れ基準」は、実装担当の自己申告ではなく、**評価担当がブラウザで実測した結果**を書く。
`EVAL.md` の計画から外れた点(測れなかった項目・手順の変更)は、この下に理由を書く。

### 客観指標(実測)

| variant | 平均 FPS | 最小 FPS | ロード時間 | ファイル数 | dist サイズ | モバイル幅の崩れ |
| --- | --- | --- | --- | --- | --- | --- |
| low | | | | | | |
| medium | | | | | | |
| high | | | | | | |
| xhigh | | | | | | |
| max | | | | | | |
| opus-medium | | | | | | |
| fable-high | | | | | | |

### 主観評価(1〜5、根拠はスクリーンショット。ルーブリックは `EVAL.md`)

| variant | 画づくり | アニメ・演出 | 手触り | 音 | UI |
| --- | --- | --- | --- | --- | --- |
| low | | | | | |
| medium | | | | | |
| high | | | | | |
| xhigh | | | | | |
| max | | | | | |
| opus-medium | | | | | |
| fable-high | | | | | |

## 所見

### 実装の違い

- 動作・完成度:
- ゲームとしての手触り・面白さ:
- アセット(画づくり・アニメーション・音)の違い:
- コード品質(構造・読みやすさ・テスト):
- 仕様の解釈の違い:

### effort による差(Sonnet 5.5)

- 差が出た点 / 出なかった点:
- effort を上げる価値があった項目:
- 自己申告と実測のズレ(自己チェックの正直さ):

### 他モデル(デフォルト effort)との違い

(参考。優劣の断定はしない。Opus 5.5 = medium、Fable 5.1 = high)

### 仕様書の問題点

(実装比較中に見つかった、仕様の曖昧さ・矛盾。仕様書は実装開始後に書き換えない。)
