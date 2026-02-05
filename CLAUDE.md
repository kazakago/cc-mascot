# cc-mascot - 技術ドキュメント

## プロジェクト概要

**Claude Codeを擬人化するためのVRMキャラクターシステム**

このアプリケーションは、Claude Codeの発言をリアルタイムで音声化し、3DのVRMキャラクターでビジュアル化するためのElectronアプリケーションです。

### コンセプト

- **完全オフライン動作**: ローカル環境で完結、インターネット接続不要
- **日本語専用**: 日本語の音声合成とルールベース感情分析に最適化
- **プラグイン不要**: Claude Codeのログファイル監視による自動連携
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
- 対象: `~/.claude/projects/**/*.jsonl`

**ネイティブヘルパー（macOS専用）:**

- Swift CLI バイナリ (CoreAudio API)
- マイク使用状態の検出

**データ永続化:**

- localStorage (音声設定)
- IndexedDB (VRMファイル)
- Electron Store (エンジン設定、ウィンドウサイズ)

**開発ツール:**

- electron-mcp-server (Electronアプリのデバッグ・操作)
- ポート: localhost:9222 (開発モード時のみ)

## アーキテクチャ

### システム構成図

```
┌──────────────────────┐
│   Claude Code CLI    │
└──────────┬───────────┘
           │ ログ出力 (.jsonl)
           ↓
┌──────────────────────┐
│  ~/.claude/projects/ │
│  └─ **/*.jsonl       │
└──────────┬───────────┘
           │ chokidar監視 (リアルタイム差分読み取り)
           ↓
┌─────────────────────────────────────────────┐
│  Electron Main Process                      │
│  ├─ logMonitor.ts (ファイル監視)              │
│  ├─ claudeCodeParser.ts (JSONL解析)          │
│  ├─ textFilter.ts (Markdown除去)             │
│  ├─ ruleBasedEmotionClassifier.ts (感情判定) │
│  └─ IPC送信 ('speak' イベント)                │
└──────────┬──────────────────────────────────┘
           │ IPC通信
           ↓
┌──────────────────────────────────────────┐
│  Electron Renderer Process (Main Window) │
│  ├─ useSpeech (音声合成キュー)             │
│  ├─ useLipSync (リップシンク)              │
│  ├─ useVRM (VRMモデル読み込み)             │
│  ├─ useVRMAnimation (アニメーション)       │
│  ├─ useBlink (まばたき)                   │
│  └─ VRMAvatar (3D表示)                    │
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
- クリックスルー（キャラクター外）
- 右クリックで設定ウィンドウを開く

**設定ウィンドウ（通常ウィンドウ・常に最前面）:**

- エンジン選択（AivisSpeech/VOICEVOX/Custom）
- スピーカー選択
- 音量調整
- マイク使用中ミュート設定（macOSのみ）
- ウィンドウサイズ調整
- VRMファイル選択
- テスト音声再生

## 主要コンポーネント

### 1. ログ監視システム

**electron/logMonitor.ts**

設計方針:

- `~/.claude/projects/**/*.jsonl` を監視（depth=1、サブエージェントは除外）
- ファイルごとに位置を記録、差分のみ読み取り（既存ログは無視）
- デバウンス処理（100ms）で過剰な処理を防ぐ
- 非同期ストリーム読み込みで大容量ファイルにも対応

データフロー:

```
ファイル変更検出 (chokidar)
  ↓
差分読み取り (readline)
  ↓
行ごとにJSONLパース (claudeCodeParser)
  ↓
テキストフィルタリング (textFilter)
  ↓
感情判定 (ruleBasedEmotionClassifier)
  ↓
IPC送信 (speak イベント)
```

### 2. JSONL解析・感情判定

**electron/parsers/claudeCodeParser.ts**

解析ルール:

- `message.role === "assistant"` のみ処理
- `message.type === "message"` のみ処理
- `content[].type === "text"` のみ抽出（thinking, tool_useは除外）

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
- URL置換（"URL"に統一）
- インラインコード除去（`...` → 中身のみ残す）
- コロン除去

### 3. 音声合成システム

**src/hooks/useSpeech.ts**

設計方針:

- キュー構造で順序保証（オーバーラップなし）
- AudioContext初期化（Electron用に自動resume）
- エラー時もキュー継続
- volumeScale適用（GainNode）

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
- デフォルト: `/models/avatar.glb`
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
- デフォルト: `/animations/idle_loop.vrma`（待機モーション）
- 感情別アニメーション: `/animations/happy.vrma` など（オプション）

**src/hooks/useBlink.ts**

まばたき制御:

- ランダム間隔（2〜6秒）
- アニメーション時間（0.15秒）
- リップシンク・感情表現と独立

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
- クリックスルー: 楕円外はマウスイベント無視

設定ウィンドウ:

- サイズ: 600x700（固定ではないがリサイズ可能）
- 通常ウィンドウ・常に最前面
- 右クリックで開く
- 単一インスタンス（既に開いている場合はフォーカス）

IPC通信:

- `speak`: メイン→レンダラー（ログ監視で検出したメッセージ）
- `vrm-changed`: 設定→メイン→メイン（VRM変更通知）
- `speaker-changed`: 設定→メイン→メイン（スピーカー変更通知）
- `play-test-speech`: 設定→メイン→メイン（テスト音声再生）
- `set-ignore-mouse-events`: レンダラー→メイン（クリックスルー制御）
- `get/set-window-position`: レンダラー↔メイン（ウィンドウ位置）
- `get/set-window-size`: レンダラー↔メイン（ウィンドウサイズ）
- `get/set-engine-settings`: レンダラー↔メイン（エンジン設定）
- `get/set-mute-on-mic-active`: レンダラー↔メイン（ミュート設定）
- `mic-active-changed`: メイン→レンダラー（マイク使用状態変化）
- `get-mic-monitor-available`: レンダラー→メイン（機能利用可否）

### 8. マイク使用中ミュート（macOS専用）

**helpers/mic-monitor.swift**

macOSのCoreAudio HAL APIを使用してマイクの使用状態をリアルタイム監視するSwift CLIツール。

仕組み:

- `kAudioDevicePropertyDeviceIsRunningSomewhere` リスナーで全入力デバイスを監視
- デバイスの追加/削除（ホットプラグ）にも対応
- 状態変化時のみ stdout に JSON 行を出力: `{"micActive":true}` / `{"micActive":false}`
- `RunLoop.main.run()` で常駐

ビルド方法:

```bash
# macOSでのみ動作。swiftcでコンパイル
npm run build:mic-monitor
# → resources/mic-monitor にバイナリが出力される
```

ビルドスクリプト: `scripts/build-mic-monitor.mjs`

- macOS以外ではスキップ（Windows/Linuxではバイナリ不要）
- `swiftc -O -framework CoreAudio` でリリースビルド
- 出力先: `resources/mic-monitor`

Electronとの統合（electron/main.ts）:

- `muteOnMicActive` 設定が有効な場合のみヘルパーを起動（プライバシー配慮）
- `child_process.spawn()` で起動、stdout を行単位でパース
- アプリ終了時に SIGTERM で停止
- バイナリが見つからない場合（Windows/Linux）は機能を無効化
- 設定画面の `getMicMonitorAvailable` IPC で UI 表示を制御

パッケージング:

- `package.json` の `extraResources` でアプリバンドルに含める
- パッケージ時: `resources/mic-monitor` → `process.resourcesPath/mic-monitor`
- 開発時: `resources/mic-monitor` を直接参照

レンダラー側:

- `useSpeech` hook に `isMicMuted` prop を追加
- ミュート時は `gainNode.gain.value = 0`（発話処理・リップシンク・アニメーションは継続）
- `volumeScale` と `isMicMuted` の両方をリアルタイム監視

### 9. MCPサーバー（開発用）

**electron-mcp-server**

開発モード時（`npm run dev`）にChrome DevTools Protocol経由でElectronアプリに接続し、デバッグ・操作を可能にします。

## データストレージ

### localStorage（Renderer Process）

| キー          | 型     | デフォルト | 説明                            |
| ------------- | ------ | ---------- | ------------------------------- |
| `speakerId`   | number | 888753760  | 話者ID（AivisSpeechデフォルト） |
| `volumeScale` | number | 1.0        | 音量スケール（0.0〜2.0）        |

### IndexedDB（Renderer Process）

データベース名: `VRMStorage`
オブジェクトストア: `vrm-files`
キー: `current-vrm`
値: VRMファイル（Blob）

用途: VRMファイルは5〜50MBで大容量のため、IndexedDBに保存

### Electron Store（Main Process）

| キー                 | 型      | デフォルト | 説明                                    |
| -------------------- | ------- | ---------- | --------------------------------------- |
| `engineType`         | string  | "aivis"    | エンジンタイプ（aivis/voicevox/custom） |
| `voicevoxEnginePath` | string  | undefined  | カスタムエンジンパス                    |
| `windowSize`         | number  | 800        | ウィンドウサイズ（400〜1200）           |
| `muteOnMicActive`    | boolean | false      | マイク使用中にミュートするか            |

## ディレクトリ構造

```
cc-mascot/
├── electron/                    # Electronメインプロセス
│   ├── main.ts                  # エントリーポイント、ウィンドウ管理、エンジン起動
│   ├── preload.ts               # IPC API公開
│   ├── logMonitor.ts            # ログファイル監視
│   ├── parsers/
│   │   └── claudeCodeParser.ts  # JSONL解析
│   ├── filters/
│   │   └── textFilter.ts        # テキストフィルタリング
│   └── services/
│       └── ruleBasedEmotionClassifier.ts  # 感情判定
├── helpers/                     # ネイティブヘルパーソース
│   └── mic-monitor.swift        # マイク監視 Swift CLI（CoreAudio）
├── scripts/                     # ビルドスクリプト
│   └── build-mic-monitor.mjs    # Swift ヘルパーのコンパイル
├── resources/                   # パッケージングリソース
│   ├── icons/                   # アプリアイコン
│   └── mic-monitor              # コンパイル済みバイナリ（.gitignore対象）
├── src/                         # Electronレンダラープロセス
│   ├── App.tsx                  # メインウィンドウ
│   ├── SettingsApp.tsx          # 設定ウィンドウ
│   ├── components/
│   │   ├── VRMAvatar.tsx        # VRMキャラクター表示
│   │   └── Scene.tsx            # Three.jsシーン
│   ├── hooks/
│   │   ├── useSpeech.ts         # 音声合成・キュー管理
│   │   ├── useLipSync.ts        # リップシンク
│   │   ├── useVRM.ts            # VRMモデル読み込み
│   │   ├── useVRMAnimation.ts   # アニメーション
│   │   ├── useBlink.ts          # まばたき
│   │   └── useLocalStorage.ts   # localStorage永続化
│   ├── services/
│   │   └── voicevox.ts          # 音声合成API
│   ├── utils/
│   │   └── vrmStorage.ts        # IndexedDB操作
│   └── types/
│       └── emotion.ts           # 感情型定義
├── public/
│   ├── models/
│   │   └── avatar.glb           # デフォルトVRMモデル
│   └── animations/
│       ├── idle_loop.vrma       # 待機モーション
│       └── happy.vrma           # 喜びモーション
├── .mcp.json                    # MCPサーバー設定
├── .claude/
│   └── settings.json            # Claude Code設定
└── package.json
```

## パフォーマンス最適化

### 音声解析

- AnalyserNode fftSize=256（必要最小限）
- requestAnimationFrame使用（ブラウザ最適化）

### ファイル監視

- depth=1（サブディレクトリ除外）
- デバウンス100ms（過剰な処理防止）
- 差分読み取り（全体読み込み回避）

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
- [ ] ログ監視が動作するか（Claude Code応答で喋るか）
- [ ] 感情判定が正しく動作するか
- [ ] リップシンクが音声に同期するか
- [ ] まばたきが自然か
- [ ] 音声キューが順序通りに処理されるか
- [ ] 設定変更が保持されるか
- [ ] VRMファイルが正しく読み込まれるか
- [ ] ウィンドウドラッグが動作するか
- [ ] クリックスルーが動作するか
- [ ] 設定ウィンドウが開くか
- [ ] テスト音声が再生されるか

### マイクミュート関連（macOSのみ）

- [ ] `npm run build:mic-monitor` でSwiftバイナリがコンパイルされるか
- [ ] 設定画面に「マイク使用中はミュートにする」チェックボックスが表示されるか
- [ ] チェックを入れるとmic-monitorヘルパーが起動するか（mainプロセスログで確認）
- [ ] 他アプリがマイク使用中に発話音声がミュートになるか（リップシンクは継続）
- [ ] マイク使用終了でミュートが解除されるか
- [ ] チェックを外すとmic-monitorヘルパーが停止するか
- [ ] 設定がアプリ再起動後も保持されるか

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

# ネイティブヘルパービルド（初回必須）
# macOS: Swift + CoreAudio（要Xcode Command Line Tools）
# Windows: C++ + MSVC（要Visual Studio Build Tools）
npm run build:mic-monitor

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
# ※ネイティブヘルパーのビルドも自動実行される
npm run package
```

## 開発環境のセットアップ

### 共通

```bash
npm install
npm run build:mic-monitor  # 初回必須
```

### macOS固有の要件

マイク監視機能を使用する場合、Xcode Command Line Toolsが必要：

```bash
xcode-select --install
```

### Windows固有の要件

マイク監視機能を使用する場合、Visual Studio Build Tools with C++が必要：

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools --override "--passive --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

**注意:** インストール後、新しいターミナルで `npm run build:mic-monitor` を実行してください。

```

## 主要依存関係

**本番:**

- `@pixiv/three-vrm`: ^3.4.4
- `@pixiv/three-vrm-animation`: ^3.4.4
- `@react-three/fiber`: ^9.5.0
- `react`: ^19.2.0
- `three`: ^0.182.0
- `chokidar`: ^5.0.0
- `electron-store`: ^11.0.2

**開発:**

- `electron`: ^39.2.7
- `electron-mcp-server`: ^1.5.0
- `vite`: ^7.2.4
- `vitest`: ^4.0.17

完全な依存関係リストは `package.json` を参照してください。
```
