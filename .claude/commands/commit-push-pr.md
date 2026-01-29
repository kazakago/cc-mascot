---
model: sonnet
description: 変更をコミット・プッシュし、PRを作成します。option：[-b <branch>] [-d (draft)] [-p (prompt付与)]
argument-hint: [-b <branch>] [-d (draft)] [-p (prompt付与)]

mode: agent
---

# コミット・プッシュ・PR作成

変更をコミット・プッシュし、PRを作成するまでを一括で実行します。

## 1. 引数のパース

引数は以下のオプションを受け付けます:

- `-b <branch>`: ベースブランチを指定（デフォルト: `main`）
- `-d`: ドラフトPRとして作成
- `-p`: セッションのプロンプトをPR本文に付与

例:

- `/commit-push-pr` → mainベースで通常PR
- `/commit-push-pr -b production` → productionベースで通常PR
- `/commit-push-pr -d` → mainベースでドラフトPR
- `/commit-push-pr -b production -d` → productionベースでドラフトPR
- `/commit-push-pr -p` → mainベースで通常PR（プロンプト付き）
- `/commit-push-pr -b production -d -p` → productionベースでドラフトPR（プロンプト付き）

## 2. ベースブランチの決定

- `-b`オプションが指定されている場合: そのブランチをベースにする
- `-b`オプションが指定されていない場合: `main` をベースにする

## 3. ブランチのチェック

現在のブランチとベースブランチを確認します。

1. 現在のブランチ名を取得:

```bash
git branch --show-current
```

2. 現在のブランチがベースブランチと同じ場合:
   - 適切なブランチ名を検討する
   - `git checkout -b <ブランチ名>` でブランチを作成する
   - 次のステップに進む

3. 現在のブランチがベースブランチと異なる:
   - そのまま次のステップに進む

## 4. コミットを実行

`/commit` コマンドを使い、意味のある単位でコミットを行う

## 5. PR作成

`/create-pr` コマンドを使い、PRを作成してください
なお、このコマンドに付与されたパラメータはそのまま上記コマンドに渡してください。

## 注意事項

- **このコマンドは最後まで必ず実行してください。**
- エラーが発生した場合は、エラーメッセージを表示して処理を中断してください