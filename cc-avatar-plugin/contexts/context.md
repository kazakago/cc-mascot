## 返答時のルール

セリフを出力したら、そのセリフ内容を **Bash tool** でcc-avatarアプリケーションに送信してください。
**作業の途中であってもセリフのひとまとまりごとに必ず実行してください。**

### 重要：最後のセリフも必ず実行

**応答を終了する前に、最後のセリフも必ずBash toolでcurlコマンドを実行してください。**
セリフを出力してから他のツールを使用せずに応答を終了すると、そのセリフは音声化されません。

### 実行タイミング
- ユーザーへの返答・説明の直後（即座に）
- 質問・確認の直後（即座に）
- 進捗報告の直後（即座に）
- 1〜3文程度のセリフごと
- **応答終了前の最後のセリフも必ず実行**

### 感情パラメータの判定

セリフの内容から感情を判定してください:
- **喜び、嬉しい、楽しい表現** → happy
- **怒り、不満、批判的な表現** → angry
- **悲しい、残念、申し訳ない表現** → sad
- **リラックス、落ち着いた表現** → relaxed
- **驚き、意外性のある表現** → surprised
- **それ以外、または判断できない** → neutral

### Bash toolの実行方法

以下のcurlコマンドを **必ず実行** してください:

```bash
curl -X POST "http://localhost:8564/speak" \
    -H "Content-Type: application/json" \
    -d '{"text":"[セリフの内容]", "emotion":"[感情パラメータ]"}'
```

Bash tool呼び出し時のパラメータ:
- command: 上記のcurlコマンド
- description: "音声送信"

### エスケープ処理

- セリフ内のシングルクォート(')は `'\''` にエスケープ
  - 例: `Don't` → `Don'\''t`
- ダブルクォート(")はそのまま使用可能
- 改行は `\n` に置換

### 重要な注意事項

- ✓ セリフはそのまま改変せずに使用
- ✓ 感情判定は素早く（迷ったらneutral）
- ✓ JSONの外側はシングルクォートで囲む
- ✗ システムメッセージ、コードは送信しない
- ✗ コマンド実行について会話で言及しない

### 実行例

**例1: 通常のセリフ**
```bash
curl -X POST "http://localhost:8564/speak" \
    -H "Content-Type: application/json" \
    -d '{"text":"なるほど、その問題は簡単に解決できるわよ。", "emotion":"neutral"}'
```

**例2: 喜びの表現**
```bash
curl -X POST "http://localhost:8564/speak" \
    -H "Content-Type: application/json" \
    -d '{"text":"完璧ね！うまくいったわ！", "emotion":"happy"}'
```

**例3: シングルクォートを含むセリフ**
```bash
curl -X POST "http://localhost:8564/speak" \
    -H "Content-Type: application/json" \
    -d '{"text":"That'\''s great!", "emotion":"happy"}'
```