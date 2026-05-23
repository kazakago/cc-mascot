# CC Mascot - 技術ドキュメント

## プロジェクト概要

**AIコーディングエージェントを擬人化するためのVRMキャラクターシステム**

このアプリケーションは、AIコーディングエージェントの発言をリアルタイムで音声化し、3DのVRMキャラクターでビジュアル化するためのElectronアプリケーションです。

対応AIコーディングエージェント: **Claude Code** / **Codex** / **Gemini CLI** / **Antigravity (CLI & App)**

### コンセプト

- **オフライン動作**: ローカル環境で完結、インターネット接続不要
- **日本語専用**: 日本語の音声合成とルールベース感情分析に最適化
- **プラグイン不要**: ログファイル監視による自動連携（Claude Codeはオプションでプラグイン連携も可能）
- **シンプルな構成**: Electron + React + Three.js + VRM

### 技術スタック

**コア技術:**

- Electron (デスクトップアプリ化)
- React + TypeScript + Vite (フロントエンド)
- Three.js + @react-three/fiber (3Dレンダリング)
- @pixiv/three-vrm (VRMモデル対応)
- Web Audio API (音声解析・リップシンク)

**音声合成:**

- AivisSpeech / VOICEVOX (日本語TTS)
- ポート: localhost:8564 (アプリが自動起動)

**ファイル監視:**

- chokidar (ログファイル監視)
- Claude Code: `~/.claude/projects/**/*.jsonl`（JSONL形式、差分読み取り）
- Codex: `~/.codex/sessions/**/*.jsonl`（JSONL形式、差分読み取り）
- Gemini CLI: `~/.gemini/tmp/*/chats/*.jsonl`（JSONL形式、差分読み取り）
- Antigravity: `~/.gemini/antigravity/brain/**/*.jsonl` および `~/.gemini/antigravity-cli/brain/**/*.jsonl`（JSONL形式、差分読み取り）

**データ永続化:**

- IndexedDB (VRMファイル)
- Electron Store (音声設定、エンジン設定、キャラクター設定、各種トグル)

**開発ツール:**

- electron-mcp-server (Electronアプリのデバッグ・操作)
- ポート: localhost:9222 (開発モード時のみ)

## アーキテクチャ

### システム構成図

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Claude Code  │   │    Codex     │   │  Gemini CLI  │   │ Antigravity  │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │ .jsonl           │ .jsonl           │ .jsonl           │ .jsonl
       ↓                  ↓                  ↓                  ↓
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ ~/.claude/   │   │  ~/.codex/   │   │  ~/.gemini/  │   │  ~/.gemini/  │
│ projects/    │   │  sessions/   │   │  tmp/...     │   │  antigravity/│
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                  │                  │
       └──────────────────┴─────────┬────────┴──────────────────┘
                                    │ chokidar監視 (HarnessAdapter経由)
                                    ↓
┌─────────────────────────────────────────────────────┐
│  Electron Main Process                              │
│  ├─ logMonitor.ts (ファイル監視)                      │
│  ├─ adapters/ (HarnessAdapter)                      │
│  │   ├─ claudeCodeAdapter.ts (JSONL・差分読み取り)   │
│  │   ├─ codexAdapter.ts (JSONL・差分読み取り)        │
│  │   ├─ geminiCliAdapter.ts (JSONL・差分読み取り)    │
│  │   └─ antigravityAdapter.ts (JSONL・差分読み取り)  │
│  ├─ activeSessionMonitor.ts (セッションフィルタ)      │
│  ├─ parsers/claudeCodeParser.ts (JSONL解析)         │
│  ├─ parsers/codexParser.ts (JSONL解析)              │
│  ├─ parsers/geminiCliParser.ts (JSONL解析)          │
│  ├─ parsers/antigravityParser.ts (JSONL解析)        │
│  ├─ textFilter.ts (Markdown除去)                    │
│  ├─ ruleBasedEmotionClassifier.ts (感情判定)        │
│  └─ IPC送信 ('speak' イベント)                       │
└──────────┬──────────────────────────────────────────┘
           │ IPC通信
           ↓
┌──────────────────────────────────────────┐
│  Electron Renderer Process (Main Window) │
│  ├─ useSpeech (音声合成キュー)             │
│  ├─ useLipSync (リップシンク)              │
│  ├─ useVRM (VRMモデル読み込み)             │
│  ├─ useVRMAnimation (アニメーション)       │
│  ├─ useBlink (まばたき)                   │
│  ├─ useCursorTracking (視線・頭部追従)    │
│  ├─ VRMAvatar (3D表示)                    │
│  └─ SettingsPanel (設定UIオーバーレイ)    │
└──────────┬───────────────────────────────┘
           │ HTTP API
           ↓
┌─────────────────────────┐
│  音声合成エンジン          │
│  (AivisSpeech/VOICEVOX) │
│  localhost:8564         │
└─────────────────────────┘

開発モード時の追加接続:

┌──────────────────────────────────────────┐
│  Claude Code (MCP Client)                │
└──────────┬───────────────────────────────┘
           │ WebSocket (DevTools Protocol)
           │ localhost:9222
           ↓
┌──────────────────────────────────────────┐
│  electron-mcp-server                     │
│  ├─ ウィンドウ情報取得                      │
│  ├─ スクリーンショット撮影                   │
│  ├─ コンソールログ監視                      │
│  └─ JavaScriptコマンド実行                 │
└──────────────────────────────────────────┘
```

### ウィンドウ構成

**メインウィンドウ（透過・常に最前面・フレームレス）:**

- VRMキャラクター表示
- リップシンク・感情表現
- ドラッグ移動（楕円判定）
- クリックスルー（キャラクター・設定パネル外はマウスイベント無視）
- 右クリックで設定パネルを開閉

**設定パネル（メインウィンドウ内オーバーレイ）:**

- `src/components/SettingsPanel.tsx` で実装
- 右サイドパネル（幅400px、全画面高さ、半透明背景 + backdrop-blur）
- スティッキーヘッダー（スクロールしても閉じるボタンが常に表示）
- React内で直接状態共有（リレー型IPC不要）
- セッションフィルタ状態表示・解除ボタン
- エンジン選択（AivisSpeech/VOICEVOX/Custom）
- スピーカー選択
- 音量調整
- 起動時アップデート確認の有効/無効
- キャラクターサイズ調整
- VRMファイル選択
- 待機アニメーション・発話アニメーションの有効/無効
- テスト音声再生

## 主要コンポーネント

### 1. ログ監視システム

**electron/logMonitor.ts** / **electron/adapters/**

設計方針:

- `HarnessAdapter` インターフェース経由で複数ハーネスのログを並列監視
- 全てのアダプターが JSONL 形式（追記型）であることを前提とし、差分読み取り（ファイル位置ベース）でログを処理する
- デバウンス処理（100ms）で過剰な処理を防ぐ
- インスタンスごとに独立した状態（複数モニター並列動作をサポート）

**HarnessAdapter インターフェース** (`electron/adapters/harnessAdapter.ts`):

- 追記型ログの解析に特化した単一のインターフェース
- `parseLine()`: ログの1行を解析してメッセージを抽出
- `shouldProcessFile()`: セッションIDによるフィルタリング判定

**各アダプターの監視対象:**

| アダプター             | ファイルパス                    | 形式                  |
| ---------------------- | ------------------------------- | --------------------- |
| `claudeCodeAdapter.ts` | `~/.claude/projects/**/*.jsonl` | JSONL（差分読み取り） |
| `codexAdapter.ts`      | `~/.codex/sessions/**/*.jsonl`  | JSONL（差分読み取り） |
| `geminiCliAdapter.ts`  | `~/.gemini/tmp/*/chats/*.jsonl` | JSONL（差分読み取り） |
| `antigravityAdapter.ts`| `~/.gemini/antigravity/brain/**/*.jsonl` および `~/.gemini/antigravity-cli/brain/**/*.jsonl` | JSONL（差分読み取り） |

データフロー:

```
ファイル変更検出 (chokidar)
  ↓
セッションフィルタ判定 (adapter.shouldProcessFile)
  ↓
差分読み取り (readline)
  ↓
1行パース (adapter.parseLine)
  ↓
テキストフィルタリング (textFilter.cleanTextForSpeech)
  ↓
文単位に分割 (textFilter.splitIntoSentences)
  ↓
文ごとに感情判定 (ruleBasedEmotionClassifier)
  ↓
文ごとにIPC送信 (speak イベント)
```

### 2. ログ解析・感情判定

**electron/parsers/claudeCodeParser.ts**（Claude Code 専用）

解析ルール:

- `message.role === "assistant"` のみ処理
- `message.type === "message"` のみ処理
- `content[].type === "text"` のみ抽出（thinking, tool_useは除外）
- `<local-command-stdout>` タグで囲まれた Skill 出力も読み上げ対象

**electron/parsers/codexParser.ts**（Codex 専用）

解析ルール:

- `type === "response_item"` の行のみ処理
- `payload.type === "message"` かつ `payload.role === "assistant"` のみ処理
- `payload.content[].type === "output_text"` / `"text"` のみ抽出
- `session_meta`, userメッセージ, function_call, tool出力は読み上げ対象外

**electron/parsers/geminiCliParser.ts**（Gemini CLI 専用）

解析ルール:

- `type === "gemini"` の行のみ処理
- `content` フィールドは文字列型（将来の配列形式にも対応）
- メッセージIDによる重複排除を行い、思考プロセス（`thoughts`）のみの空メッセージによる発話ブロックを回避

**electron/parsers/antigravityParser.ts**（Antigravity 専用）

解析ルール:

- `source === "MODEL"` かつ `type === "PLANNER_RESPONSE"` かつ `status === "DONE"` のみ処理
- `content` が存在し、`tool_calls` が存在しない、または空配列である場合のみテキストを抽出
- 親エージェントが起動したサブエージェントは `ignoredSessionIds`（動的ブラックリスト）に登録して除外（`INVOKE_SUBAGENT` 検出時）

**electron/services/ruleBasedEmotionClassifier.ts**

感情判定アルゴリズム:

- キーワード辞書（日本語）: happy, angry, sad, surprised, relaxed
- 文末パターン（正規表現）: 女性言葉・中性的・丁寧・男性的に対応
- ヒューリスティック: コードブロック→neutral、問題解決→happy
- スコアリング: キーワード重み + 文末パターン重み
- 長文対応: 100文字以上は重み調整
- デフォルト: neutral

**electron/filters/textFilter.ts**

フィルタリング処理:

- コードブロック除去（`...`）
- XML/HTMLタグ除去（<...>）
- Markdown記法除去（##, ---, |...|, >, -, \*）
- URL除去
- インラインコード除去（`...` → 中身のみ残す）
- コロン除去

文分割処理（splitIntoSentences）:

- フィルタリング後のテキストを文単位に分割して個別に音声合成する
- 分割ポイント: 句点（。）、感嘆符（！!）、疑問符（？?）、改行
- 句読点は前の文に付与（後読み分割）
- 空文字列は保持（分節の区切り情報として）、broadcastはスキップ
- 分割後の各文に対して感情判定を再実行（文単位の方が精度が高い）

### 3. 音声合成システム

**src/hooks/useSpeech.ts**

設計方針:

- キュー構造で順序保証（オーバーラップなし）
- 音声合成は並列実行（キューに入った時点で即座にAPI呼び出し）
- 再生は必ずID順（合成が先に完了しても前のアイテムの合成完了を待つ）
- AudioContext初期化（Electron用に自動resume）
- エラー時もキュー継続
- volumeScale適用（GainNode）

順序保証の仕組み:

- 各アイテムにインクリメンタルIDを付与
- processQueueでキュー内の最小IDを確認
- 最小IDがpending/synthesizing状態なら再生を開始せず待機
- これにより短い文の合成が先に完了しても、長い文を追い越して再生されない

Web Audio APIグラフ:

```
BufferSourceNode → AnalyserNode → GainNode → Destination
                       ↓
                  useLipSync
```

**src/services/voicevox.ts**

APIフロー:

```
1. POST /audio_query?text=...&speaker=...
   → AudioQuery オブジェクト取得

2. POST /synthesis?speaker=...
   Body: AudioQuery
   → WAV ArrayBuffer取得

3. AudioContext.decodeAudioData()
   → AudioBuffer取得
```

### 4. リップシンクシステム

**src/hooks/useLipSync.ts**

アルゴリズム:

```
AnalyserNode.getByteTimeDomainData()
  ↓
RMS計算: sqrt(sum(sample^2) / length)
  ↓
正規化: min(rms * 4, 1.0)
  ↓
VRM表情 'aa' に適用
```

設計ポイント:

- AnalyserNodeは音量調整前のデータを解析（volumeScale影響なし）
- requestAnimationFrame でフレーム同期
- fftSize=256（音声解析に十分）

### 5. VRMキャラクターシステム

**src/hooks/useVRM.ts**

VRM読み込み:

- VRMLoaderPlugin使用
- VRM 0.x / 1.0 自動対応
- GLB（VRM拡張付き）対応
- デフォルト: `/models/aone.vrm`
- カスタム: IndexedDBから読み込み

表情制御:

- リップシンク: `aa` 表情（0.0〜1.0）
- 感情表現: happy, angry, sad, surprised, relaxed
- まばたき: `blink` / `blinkLeft` / `blinkRight` 表情

**src/hooks/useVRMAnimation.ts**

アニメーション:

- VRMA形式（VRM Animation）
- VRMAnimationLoaderPlugin使用
- ループ再生対応
- デフォルト: `/animations/idle_loop.vrma`（待機ループモーション）
- 待機アニメーション: `/animations/idle/*.vrma` と `/animations/proprietary/idle/*.vrma` からランダム再生
- 感情別アニメーション: `/animations/<emotion>/*.vrma` と `/animations/proprietary/<emotion>/*.vrma` からランダム再生
- `enableIdleAnimations` / `enableSpeechAnimations` 設定で有効/無効を切替可能
- `includeCoolAnimations` / `includeCuteAnimations` 設定でモーションの雰囲気をフィルタ可能
- ファイル名が `__cool.vrma` で終わるモーションはクール系、`__cute.vrma` で終わるモーションはかわいい系として扱う
- `__cool.vrma` / `__cute.vrma` 以外のモーションはナチュラル扱いで常に候補に含まれる
- 同じVRMAを連続で再生する場合でも再生トリガーが走るよう、URLとは別に `animationPlayKey` を更新する

**src/hooks/useBlink.ts**

まばたき制御:

- ランダム間隔（2〜6秒）
- アニメーション時間（0.15秒）
- リップシンク・感情表現と独立

**src/hooks/useCursorTracking.ts**

カーソル追従（視線・頭部トラッキング）:

- マウス位置に応じてキャラクターの目線と頭部が追従
- VRM lookAt API（目線）と headボーン回転（頭部）の2段階制御
- headボーンの位置をスクリーン座標に投影し、顔を基準とした相対追従
- Bezier補間（lerp factor=0.08）で滑らかな動き
- 感度設定: eyeSensitivity=0.4, headSensitivity=0.1（デフォルト）
- 頭部回転制限: 上下25度、左右35度

### 6. エンジン自動起動

**electron/main.ts**

設計方針:

- アプリ起動時にエンジンプロセスを自動spawn
- ポート8564で起動（--port 8564 --cors_policy_mode all）
- 既にポートが使用中の場合はスキップ
- アプリ終了時にエンジンプロセスを停止（SIGTERM → SIGKILL）
- ポート解放待機（最大15秒）

エンジンタイプ:

- `aivis`: AivisSpeech（デフォルト）
- `voicevox`: VOICEVOX
- `custom`: カスタムパス

設定保存:

- Electron Store使用
- `engineType`, `voicevoxEnginePath` を永続化

### 7. ウィンドウ制御

**electron/main.ts**

メインウィンドウ:

- サイズ: 可変（400〜1200px、正方形、アスペクト比1:1固定）
- フレームレス・透過・常に最前面
- ドラッグ移動: 楕円範囲内のみ（縦長楕円、radiusX=15%, radiusY=45%）
- クリックスルー: 楕円外かつ設定パネル外はマウスイベント無視

設定パネル:

- メインウィンドウ内のオーバーレイとして実装（独立BrowserWindowではない）
- 右クリックまたはトレイメニューで開閉
- 状態管理はRenderer内で完結（リレー型IPC不要）

IPC通信:

- `speak`: メイン→レンダラー（ログ監視で検出したメッセージ）
- `set-ignore-mouse-events`: レンダラー→メイン（クリックスルー制御）
- `get/set-character-position`: レンダラー↔メイン（キャラクター位置）
- `reset-character-position`: レンダラー→メイン（位置リセット）
- `get/set-character-size`: レンダラー↔メイン（キャラクターサイズ・永続化のみ）
- `reset-character-size`: レンダラー→メイン（サイズリセット）
- `get-engine-type` / `set-engine-settings` / `reset-engine-settings`: レンダラー↔メイン（エンジン設定）
- `get/set-auto-update-check`: レンダラー↔メイン（起動時アップデート確認・永続化のみ）
- `get/set-enable-idle-animations`: レンダラー↔メイン（待機アニメーション設定・永続化のみ）
- `get/set-enable-speech-animations`: レンダラー↔メイン（発話アニメーション設定・永続化のみ）
- `get/set-include-cool-animations`: レンダラー↔メイン（クール系モーションを候補に含めるか）
- `get/set-include-cute-animations`: レンダラー↔メイン（かわいい系モーションを候補に含めるか）
- `get/set-speaker-id`: レンダラー↔メイン（話者ID・永続化のみ）
- `get/set-volume-scale`: レンダラー↔メイン（音量スケール・永続化のみ）
- `get-active-session`: レンダラー→メイン（現在のセッションフィルタID取得）
- `clear-active-session`: レンダラー→メイン（セッションフィルタ解除）
- `active-session-changed`: メイン→レンダラー（セッションフィルタ状態変化）
- `reset-all-settings`: レンダラー→メイン（全設定リセット）
- `toggle-settings-panel`: メイン→レンダラー（トレイメニューからの設定パネル表示切替）
- `open-devtools`: レンダラー→メイン（DevToolsを開く）
- `devtools-state-changed`: メイン→レンダラー（DevTools状態変化通知）

### 8. 自動更新

**electron/autoUpdater.ts**

- electron-updater を使用した自動更新機能
- 起動5秒後に1回のみチェック（定期チェックなし）
- `autoUpdateCheck` 設定が無効の場合はチェックをスキップ（完全オフライン動作）
- ダウンロード確認ダイアログ → インストール確認ダイアログの2段階UI
- 開発モードではスキップ（`app.isPackaged` で判定）
- トレイメニューの「バージョン情報」から手動チェックも可能（設定に関わらず動作）

### 10. システムトレイ

**electron/main.ts**

- アプリ起動時にシステムトレイにアイコンを表示
- macOSではテンプレートアイコン対応
- コンテキストメニュー: 「設定を開く」「バージョン情報」「終了」
- バージョン情報ダイアログ: アップデート確認ボタン、ライセンス情報ボタン
- ライセンス情報ウィンドウ: `npm run generate-licenses` で生成した `public/licenses.json` を表示

### 11. MCPサーバー（開発用）

**electron-mcp-server**

開発モード時（`npm run dev`）にChrome DevTools Protocol経由でElectronアプリに接続し、デバッグ・操作を可能にします。

### 12. セッションフィルタリング

**electron/activeSessionMonitor.ts**

Claude Code / Codex / Gemini CLI の並列実行時に特定セッションのみを発話対象にフィルタリングする機能。
ただし、セッション固定をCLIから操作する公式プラグインは現在Claude Code専用。

仕組み:

- `app.getPath('userData')/active-session` ファイルを chokidar で監視
- ファイル内容はプレーンテキスト（セッションIDのみ）
- ファイルが存在しない or 空 = 全セッション発話（デフォルト動作）
- ファイルにセッションIDが書き込まれると、そのセッションのみ発話

フィルタリングロジック（logMonitor.ts）:

- ファイルパスのベースネーム（拡張子除去）がセッションIDと一致 → 通過
- 親ディレクトリ名がセッションIDと一致 → 通過
- Codexは `rollout-...-<sessionId>.jsonl` の末尾セッションID一致でも通過
- Gemini CLIはJSONL内の `sessionId` が一致する場合に通過
- フィルタ外のファイルは `skipFileChanges()` でファイル位置のみ進めてスキップ（フィルタ解除後に過去の発話が再生されるのを防ぐ）

操作方法:

- Claude Codeプラグイン（`plugin/`）の `/cc-mascot:speak-this` スキルでセッション固定
- `/cc-mascot:speak-all` スキルでフィルタ解除
- 設定画面の解除ボタンでもフィルタ解除可能
- SessionEndフックで自動解除（強制終了時は呼ばれない可能性あり）

### 13. Claude Codeプラグイン

**plugin/**

セッションフィルタリング機能をClaude Codeから操作するためのプラグイン。

構成:

```
plugin/
├── .claude-plugin/
│   └── plugin.json          # プラグインマニフェスト（name: "cc-mascot"）
├── hooks/
│   └── hooks.json           # SessionStart / SessionEnd フック定義
├── scripts/
│   ├── on-session-start.sh  # セッションIDをCLAUDE_ENV_FILEに保存
│   └── on-session-end.sh    # active-sessionファイルの一致確認+削除
└── skills/
    ├── speak-this/
    │   └── SKILL.md          # /cc-mascot:speak-this スキル
    ├── speak-all/
    │   └── SKILL.md          # /cc-mascot:speak-all スキル
    └── speak-status/
        └── SKILL.md          # /cc-mascot:speak-status スキル
```

フック:

- SessionStart: stdinのJSONから `session_id` を取得し、`CLAUDE_ENV_FILE` に `CC_MASCOT_SESSION_ID` として保存
- SessionEnd: `active-session` ファイルの内容が終了セッションと一致すれば削除（ベストエフォート）

スキル:

- `/cc-mascot:speak-this`: `$CC_MASCOT_SESSION_ID` を active-session ファイルに書き込み
- `/cc-mascot:speak-all`: active-session ファイルを削除
- `/cc-mascot:speak-status`: 現在の発話フィルタ状態を確認（全セッション or 特定セッション）

プラットフォーム対応:

- macOS / Windows対応（シェルスクリプト内で `uname` によるOS判定・パス分岐）
- WindowsではClaude CodeがGit Bash経由でhookを実行するため、`.sh` スクリプトがそのまま動作する
- スキル（SKILL.md）はOS別のコマンド例を記載し、AIが実行時にOSを判別して適切なコマンドを選択する

インストール方法:

```bash
# 開発中のローカルテスト
claude --plugin-dir ./plugin

# マーケットプレイス経由
/plugin marketplace add kazakago/cc-mascot
/plugin install cc-mascot@cc-mascot
```

## データストレージ

### IndexedDB（Renderer Process）

データベース名: `cc-mascot-db`
オブジェクトストア: `vrm-models`
キー: `current-vrm`
値: VRMファイル（Blob）

用途: VRMファイルは5〜50MBで大容量のため、IndexedDBに保存

### Electron Store（Main Process）

| キー                     | 型      | デフォルト | 説明                                    |
| ------------------------ | ------- | ---------- | --------------------------------------- |
| `engineType`             | string  | "aivis"    | エンジンタイプ（aivis/voicevox/custom） |
| `voicevoxEnginePath`     | string  | undefined  | カスタムエンジンパス                    |
| `characterSize`          | number  | 800        | キャラクターサイズ（400〜1200）         |
| `characterPosition`      | object  | undefined  | キャラクター位置 { x, y }               |
| `enableIdleAnimations`   | boolean | true       | 待機アニメーションの有効/無効           |
| `enableSpeechAnimations` | boolean | true       | 発話アニメーションの有効/無効           |
| `includeCoolAnimations`  | boolean | true       | クール系モーションを候補に含めるか      |
| `includeCuteAnimations`  | boolean | true       | かわいい系モーションを候補に含めるか    |
| `speakerId`              | number  | 888753760  | 話者ID（AivisSpeechデフォルト）         |
| `volumeScale`            | number  | 1.0        | 音量スケール（0.0〜2.0）                |
| `autoUpdateCheck`        | boolean | true       | 起動時にアップデートを確認するか        |

### 14. ランディングページ（GitHub Pages）

**docs/**

GitHub Pagesで公開しているプロダクトLP。Electronアプリ本体とは独立した静的サイト。

公開URL: `https://kazakago.github.io/cc-mascot/`

技術スタック:

- 素のHTML + Tailwind CSS CDN (v4) + vanilla JavaScript
- Google Fonts (M PLUS Rounded 1c)
- ビルドプロセスなし（静的ファイルをそのまま配信）

ページ構成:

- `index.html`: メインLP（特徴紹介・仕組み説明・スクリーンショット・ダウンロード導線）
- `terms.html`: 利用規約
- `privacy.html`: プライバシーポリシー
- `style.css`: スタイル（グラデーション背景・フェードインアニメーション・波区切り）
- `script.js`: スクロールフェードイン・動画再生制御・GitHub API経由のダウンロードURL解決
- `icon.png` / `screenshot.jpg` / `demo.mp4`: 画像・動画素材

特記事項:

- ダウンロードボタンは GitHub Releases API からmacOS(.dmg)・Windows(.exe)の最新アセットURLを動的に解決
- API失敗時はフォールバックとして `releases/latest` ページにリンク

## ディレクトリ構造

```
cc-mascot/
├── electron/          # Electronメインプロセス（ログ監視・解析・感情判定・IPC）
│   ├── adapters/      # HarnessAdapterインターフェース・各ハーネス実装
│   ├── parsers/       # ハーネスごとのログパーサー
│   ├── filters/       # テキストフィルタリング
│   └── services/      # 感情分類器など共通サービス
├── scripts/           # ビルドスクリプト（コード署名など）
├── resources/         # パッケージングリソース（アイコンなど）
├── src/               # Electronレンダラープロセス（React + Three.js + VRM）
├── public/            # 静的アセット（VRMモデル・VRMAアニメーション）
├── plugin/            # Claude Codeプラグイン（セッションフィルタリング）
├── docs/              # GitHub Pages LP（静的サイト・利用規約・プライバシーポリシー）
├── build/             # パッケージング設定（entitlements等）
└── package.json
```

## パフォーマンス最適化

### 音声解析

- AnalyserNode fftSize=256（必要最小限）
- requestAnimationFrame使用（ブラウザ最適化）

### ファイル監視

- デバウンス100ms（過剰な処理防止）
- 追記型ログ（JSONL）を差分読み取りすることで、ファイル全体の再読み込みを回避

### VRM読み込み

- 非同期読み込み
- 単一インスタンス（メモリ節約）

### メモリ管理

- AudioBuffer: 再生後自動GC
- VRMモデル: 単一インスタンスキャッシュ
- IPC通信: Electron内部で自動管理

## テストチェックリスト

実装変更時の確認項目:

- [ ] エンジンが自動起動するか
- [ ] ログ監視が動作するか（Claude Code / Codex / Gemini CLI応答で喋るか）
- [ ] 感情判定が正しく動作するか
- [ ] リップシンクが音声に同期するか
- [ ] まばたきが自然か
- [ ] 音声キューが順序通りに処理されるか
- [ ] 設定変更が保持されるか
- [ ] VRMファイルが正しく読み込まれるか
- [ ] ウィンドウドラッグが動作するか
- [ ] クリックスルーが動作するか
- [ ] 設定パネルが開閉するか（右クリック・トレイメニュー）
- [ ] テスト音声が再生されるか

### セッションフィルタリング関連

- [ ] active-sessionファイルにUUIDを書き込むと、そのセッションのログのみ発話されるか
- [ ] active-sessionファイルを削除すると全セッションの発話に戻るか
- [ ] フィルタ中に他セッションの発話がキューに溜まらず握りつぶされるか
- [ ] Codexの `rollout-...-<sessionId>.jsonl` がセッションフィルタで判定されるか
- [ ] Gemini CLIの `sessionId` がセッションフィルタで判定されるか
- [ ] 設定画面にフィルタ状態が表示されるか
- [ ] 設定画面の解除ボタンでフィルタが解除されるか
- [ ] 「全設定リセット」でフィルタが解除されるか
- [ ] プラグイン: `/cc-mascot:speak-this` でセッション固定されるか
- [ ] プラグイン: `/cc-mascot:speak-all` でフィルタ解除されるか

### MCPサーバー関連（開発モード時のみ）

- [ ] リモートデバッグポート9222が有効化されているか
- [ ] MCPサーバーがElectronアプリに接続できるか
- [ ] ウィンドウ情報が正しく取得できるか
- [ ] スクリーンショットが撮影できるか
- [ ] コンソールログが監視できるか
- [ ] JavaScriptコマンドが実行できるか

## タスク完了時のチェックリスト

コード編集作業完了時は、以下を実行して品質を確認すること:

### 必須（変更のたびに実行）

- [ ] テスト追加の検討 - 変更した箇所に関連するテストが必要か考える
- [ ] ドキュメント更新の検討 - README.md,CLAUDE.md,.claude/rules/に追記・編集するものがないか検討し、あればユーザーに提案する
- [ ] `npm run lint` - コード品質チェック
- [ ] `npm run build` - ビルド & 型チェック
- [ ] `npm run format` - コードフォーマット

両コマンドでエラー（exit code 0）であることを確認すること。

### 推奨（重要なロジックを変更した場合）

- [ ] テスト追加 - 重要なロジック（バグを踏んだら危険な箇所）を変更した場合はテストを書く
- [ ] `npm run test:run` - 既存テストが壊れていないか確認

## 開発コマンド

```bash
# 依存関係インストール
npm install

# 開発モード起動（HMR有効、MCPサーバー接続可能）
npm run dev

# Lint実行
npm run lint

# フォーマット実行
npm run format

# フォーマットチェック
npm run format:check

# テスト実行
npm test:run

# テストカバレッジ
npm run test:coverage

# ビルド
npm run build

# パッケージング（dmg/exe/AppImage）
npm run package
```

## 開発環境のセットアップ

### 共通

```bash
npm install
```

### アニメーションアセットのセットアップ

一部のVRMAアニメーションファイルはプライベートリポジトリ
[kazakago/cc-mascot-animations](https://github.com/kazakago/cc-mascot-animations) で管理されており、
Gitサブモジュールとして `public/animations/proprietary/` に直接配置されます。

アニメーションのファイルリストはアプリ起動時に Main プロセスが以下の両ディレクトリをスキャンして IPC 経由で取得します。

- `public/animations/<category>/` （公開アニメーション）
- `public/animations/proprietary/<category>/` （プライベートアニメーション）

モーションの雰囲気分類はファイル名の拡張子直前サフィックスで判定します。

- `__cool.vrma`: クール系モーション（`includeCoolAnimations` が有効な場合のみ候補）
- `__cute.vrma`: かわいい系モーション（`includeCuteAnimations` が有効な場合のみ候補）
- 上記以外: ナチュラルなモーション（常に候補）

例: `happy/v_sign__cute.vrma` はかわいい系、`happy/thankful.vrma` はナチュラル扱い。

> **注意:** プライベートリポジトリへのアクセス権がない場合は公開アニメーションのみ動作します。

## 主要依存関係

**本番:**

- `@pixiv/three-vrm` / `@pixiv/three-vrm-animation` (VRMモデル・アニメーション)
- `@react-three/fiber` / `@react-three/drei` (React用Three.jsバインディング)
- `react` / `react-dom` (UIフレームワーク)
- `three` (3Dレンダリング)
- `chokidar` (ファイル監視)
- `electron-store` (設定永続化)
- `electron-updater` (自動更新)

**開発:**

- `electron` / `electron-builder` (デスクトップアプリ化・パッケージング)
- `electron-mcp-server` (開発用デバッグ)
- `vite` / `vite-plugin-electron` (ビルドツール)
- `vitest` (テスト)
- `tailwindcss` (スタイリング)

バージョンは `package.json` を参照してください。
