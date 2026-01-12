# Claude Code Avatar - 技術ドキュメント

## プロジェクト概要

**Claude Codeを擬人化するためのVRMアバターシステム**

このアプリケーションは、Claude Codeの発言をリアルタイムで音声化し、3DのVRMアバターでビジュアル化するためのWebフロントエンドアプリケーションです。Claude Codeプラグインと連携して、AIとの対話を視覚的・聴覚的に体験できます。

**主な用途:**
- Claude Codeの擬人化（プラグイン経由での利用が基本）
- API経由での汎用的なVRM音声読み上げ（オプション）

**技術スタック:**
- React + TypeScript + Vite
- Three.js + @react-three/fiber + @react-three/drei
- @pixiv/three-vrm + @pixiv/three-vrm-animation
- Web Audio API (AudioContext, AnalyserNode, GainNode)
- WebSocket (ws)
- localStorage + IndexedDB

**ポート:**
- Electronフロントエンド: 8563
- APIサーバー: 8564

**重要:** このアプリケーションはElectron専用アプリです。Webフロントエンドに加えて、プラグインからのAPIリクエストを受け付けるローカルサーバー（ポート8564）を同梱しています。

## アーキテクチャ

### 全体構成

```
┌─────────────────┐
│  Claude Code    │
│  (AI Assistant) │
└────────┬────────┘
         │ 発言を出力
         ↓
┌─────────────────────────┐
│ cc-avatar-plugin        │
│ ├─ hooks/               │
│ │  └─ SessionStart      │ ← context.mdを注入
│ └─ context/             │
│    └─ context.md        │ ← 感情判定ルール
└────────┬────────────────┘
         │ POST /speak
         │ {text, emotion}
         ↓
┌─────────────────────────┐
│ Electron App            │
│ ├─ Frontend (8563)      │
│ ├─ API Server (8564)    │
│ │  ├─ WebSocket /ws     │
│ │  └─ HTTP /speak       │
│ ├─ VOICEVOX Client      │
│ ├─ Audio Engine         │
│ └─ VRM Renderer         │
└────────┬────────────────┘
         │
         ↓
┌─────────────────────────┐
│ VOICEVOX Engine (50021) │
│ ├─ /audio_query         │
│ └─ /synthesis           │
└─────────────────────────┘
```

### ディレクトリ構造

```
cc-avatar/
├── src/
│   ├── components/
│   │   ├── VRMAvatar.tsx          # VRMアバター表示コンポーネント
│   │   └── SettingsModal.tsx      # 設定モーダルUI
│   ├── hooks/
│   │   ├── useVRM.ts              # VRMモデルローダー
│   │   ├── useVRMAnimation.ts     # VRMAアニメーションローダー
│   │   ├── useSpeech.ts           # 音声再生・キュー管理
│   │   ├── useLipSync.ts          # リップシンク（音声解析）
│   │   ├── useWebSocket.ts        # WebSocket接続管理
│   │   └── useLocalStorage.ts     # localStorage永続化
│   ├── services/
│   │   └── voicevox.ts            # VOICEVOX APIクライアント
│   ├── utils/
│   │   └── vrmStorage.ts          # IndexedDB VRMファイル管理
│   ├── App.tsx                    # メインアプリケーション
│   ├── App.css                    # スタイル
│   └── main.tsx                   # エントリーポイント
├── public/
│   ├── models/
│   │   └── avatar.glb             # デフォルトVRMアバター
│   ├── animations/
│   │   └── idle_loop.vrma         # 待機モーション
│   └── icons/
│       └── settings.svg           # 設定アイコン
├── cc-avatar-plugin/              # ★ Claude Codeプラグイン
│   ├── .claude-plugin/
│   │   └── plugin.json            # プラグイン基本情報
│   ├── context/
│   │   └── context.md             # 感情判定ルール（Claude Codeに注入）
│   └── hooks/
│       ├── hooks.json             # フック定義
│       └── scripts/
│           └── inject-context.sh  # コンテキスト注入スクリプト
├── vite.config.ts                 # Vite設定（WebSocketプラグイン含む）
├── prodServer.ts                  # 本番サーバー（WebSocket統合）
├── package.json
├── README.md                      # 人間向けドキュメント
└── CLAUDE.md                      # このファイル（AI向け技術ドキュメント）
```

### コンポーネント階層

```
App.tsx
├── Canvas (Three.js)
│   ├── VRMAvatar
│   │   ├── primitive (VRMモデル)
│   │   └── primitive (VRMAアニメーション)
│   ├── OrbitControls (カメラ操作)
│   ├── ambientLight (環境光)
│   └── directionalLight (指向性ライト)
└── SettingsModal (設定画面)
```

## データフロー

### Claude Codeプラグイン連携フロー

```
1. セッション開始
   Claude Code起動
   ↓
   SessionStartフック発火
   ↓
   inject-context.sh実行
   ↓
   context.mdの内容をClaude Codeに注入

2. 通常会話
   ユーザー入力
   ↓
   Claude Code応答生成
   ↓
   セリフ出力時、context.mdのルールに従って処理
   ↓
   感情判定（neutral/happy/angry/sad/relaxed/surprised）
   ↓
   バックグラウンドでPOST http://localhost:8564/speak
   {
     "text": "セリフ内容",
     "emotion": "happy"
   }
   ↓
   アバターアプリがリクエスト受信

3. 音声合成・再生
   アバターアプリ (APIサーバー 8564)
   ↓
   useSpeech.speakText()
   ↓
   キューに追加
   ↓
   VOICEVOX API呼び出し
   ├─ GET /audio_query?text=...&speaker=0
   └─ POST /synthesis?speaker=0 (body: query)
   ↓
   WAVデータ (ArrayBuffer)
   ↓
   AudioContext.decodeAudioData()
   ↓
   AudioBuffer生成
   ↓
   Audio Graph構築
   BufferSourceNode → AnalyserNode → GainNode → Destination
   ↓
   再生開始 + リップシンク開始
   ↓
   useLipSync: AnalyserNodeからデータ取得
   ↓
   RMS計算 → aa表情値更新
   ↓
   VRMAvatar: 口が動く + 感情表情適用
```

### 感情システムのデータフロー

```
Claude Codeのセリフ
   ↓
感情判定（context.mdのルール）
   ↓
APIリクエスト {text, emotion}
   ↓
App.tsx: handleWebSocketMessage
   ↓
useSpeech: speakText(text, emotion)
   ↓
キューに保存 [{text, emotion}, ...]
   ↓
順次処理開始
   ↓
VRMAvatar.applyEmotion(emotion)
   ├─ neutral: すべての表情リセット
   ├─ happy: happy/joy表情をアクティブ化
   ├─ angry: angry表情をアクティブ化
   ├─ sad: sad/sorrow表情をアクティブ化
   ├─ relaxed: relaxed表情をアクティブ化
   └─ surprised: surprised表情をアクティブ化
   ↓
音声再生と同時に表情適用
   ↓
リップシンクと感情表情の合成
```

## 主要機能の実装詳細

### 1. 音声キューシステム (`useSpeech.ts`)

複数のテキストが連続送信された場合、順序を保って再生します。

**特徴:**
- キュー構造: `Array<{text: string, emotion?: string}>`
- 1つずつ順次処理（オーバーラップなし）
- 再生完了時に自動的に次のアイテムを処理
- エラー発生時もキューは継続

**主要関数:**
```typescript
speakText(text: string, emotion?: string): void
  → キューに追加 & 処理開始

processQueue(): Promise<void>
  → キューの先頭を取り出して再生
  → 完了後、次のアイテムを処理
```

### 2. Web Audio API グラフ

```
BufferSourceNode → AnalyserNode → GainNode → AudioDestinationNode
                        ↓
                   useLipSync
                  (リップシンク)
```

**各ノードの役割:**
- **BufferSourceNode**: 音声データの再生元
- **AnalyserNode**: 波形解析（リップシンク用、音量の影響を受けない）
- **GainNode**: 音量調整（設定画面のVolume Scaleを適用）
- **AudioDestinationNode**: スピーカー出力

**重要ポイント:**
- AnalyserNodeは音量調整前のデータを解析するため、リップシンクに音量変更の影響なし
- GainNodeで音量を変えてもリップシンクは正常に動作

### 3. リップシンクアルゴリズム (`useLipSync.ts`)

**処理フロー:**
1. `AnalyserNode.getByteTimeDomainData()` で時間領域データ取得
2. RMS（二乗平均平方根）計算
   ```typescript
   rms = sqrt(sum(sample^2) / dataArray.length)
   ```
3. 正規化（0-1の範囲に変換）
   ```typescript
   normalized = min(rms / threshold, 1.0)
   ```
4. スムージング適用（急激な変化を抑制）
5. VRMの `aa` 表情値として適用

**パラメータ:**
- `fftSize`: 256（音声解析には十分、低いほど高速）
- `threshold`: 音量に応じて調整可能
- `smoothing`: 0.1〜0.3程度（チラつき防止）

### 4. 感情表現システム

#### 感情タイプ定義

```typescript
type Emotion = 'neutral' | 'happy' | 'angry' | 'sad' | 'relaxed' | 'surprised';
```

#### VRM表情マッピング

```typescript
const emotionMap = {
  neutral: [],  // すべてリセット
  happy: ['happy', 'joy'],
  angry: ['angry'],
  sad: ['sad', 'sorrow'],
  relaxed: ['relaxed'],
  surprised: ['surprised']
};
```

#### 表情適用ロジック

**`VRMAvatar.tsx` の `applyEmotion` 関数:**
1. VRMモデルの `expressionManager.expressionMap` から利用可能な表情を取得
2. 感情タイプに対応する表情名を検索
3. マッチした表情の値を1.0に設定
4. その他の表情は0.0にリセット（neutralの場合）

**重要:**
- VRMモデルによって表情名が異なる場合がある
- 標準的な表情名: `happy`, `angry`, `sad`, `surprised`, `relaxed`
- 代替表情名: `joy`, `sorrow` など
- 表情が存在しない場合は無視（エラーなし）

### 5. ストレージ構成

#### localStorage（設定値）

| キー | 型 | デフォルト値 | 説明 |
|------|-----|--------------|------|
| `speakerId` | number | 0 | VOICEVOXのSpeaker ID |
| `baseUrl` | string | "http://localhost:50021" | VOICEVOX Engine URL |
| `volumeScale` | number | 1.0 | 音量スケール（0.0〜2.0） |

#### IndexedDB（VRMファイル）

- **データベース名**: `VRMStorage`
- **オブジェクトストア**: `vrm-files`
- **キー**: `current-vrm`
- **値**: VRMファイル（Blob）

**なぜIndexedDB？**
- VRMファイルは5〜50MB（localStorageの容量制限を超える）
- バイナリBlobを効率的に保存
- 非同期APIでUIをブロックしない

### 6. VRMモデル要件

#### サポートフォーマット
- VRM 0.x (.vrm)
- VRM 1.0 (.vrm)
- GLB (.glb) ※VRM拡張を含む場合

#### 必須機能
- **表情ブレンドシェイプ**: `aa`（リップシンク用）
- **推奨表情**: `happy`, `angry`, `sad`, `surprised`, `relaxed`
- **ヒューマノイドボーン**: VRM標準ボーン構造

#### モデル読み込み
- ローダー: `@pixiv/three-vrm` の `VRMLoaderPlugin`
- VRMバージョンの自動検出
- デフォルトモデル: `/public/models/avatar.glb`
- カスタムモデル: IndexedDBに保存

### 7. VRMアニメーション (VRMA)

#### 待機アニメーション
- ファイル: `/public/animations/idle_loop.vrma`
- フォーマット: VRM Animation (VRMA)
- ローダー: `VRMAnimationLoaderPlugin`
- ループ: 有効（連続再生）

#### アニメーション合成
- ボディモーション: VRMAから適用
- 表情: リップシンクと感情表情が上書き
- 優先度: 表情 > VRMAの表情データ

## Claude Codeプラグイン

### プラグイン構造

```
cc-avatar-plugin/
├── .claude-plugin/
│   └── plugin.json         # プラグインメタデータ
├── context/
│   └── context.md          # セリフ出力時のルール定義
└── hooks/
    ├── hooks.json          # フック定義
    └── scripts/
        └── inject-context.sh  # コンテキスト注入スクリプト
```

## API仕様

### WebSocket API

**エンドポイント:** `ws://localhost:8564/ws`

**メッセージフォーマット:**
```typescript
interface WebSocketMessage {
  type: 'speak';
  text: string;
  emotion?: 'neutral' | 'happy' | 'angry' | 'sad' | 'relaxed' | 'surprised';
}
```

**サンプルコード:**
```javascript
const ws = new WebSocket('ws://localhost:8564/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'speak',
    text: 'こんにちは、世界！',
    emotion: 'happy'
  }));
};

ws.onmessage = (event) => {
  console.log('Received:', event.data);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('WebSocket closed');
};
```

### HTTP API

**エンドポイント:** `POST /speak`

**リクエストボディ:**
```typescript
interface SpeakRequest {
  text: string;
  emotion?: 'neutral' | 'happy' | 'angry' | 'sad' | 'relaxed' | 'surprised';
}
```

**レスポンス:**
```typescript
interface SpeakResponse {
  status: 'ok';
}
```

**サンプルコード:**
```bash
# 基本
curl -X POST http://localhost:8564/speak \
  -H "Content-Type: application/json" \
  -d '{"text":"こんにちは"}'

# 感情指定
curl -X POST http://localhost:8564/speak \
  -H "Content-Type: application/json" \
  -d '{"text":"嬉しいです！", "emotion":"happy"}'
```

## VOICEVOX連携

### APIフロー

```
1. 音声クエリ生成
   GET http://localhost:50021/audio_query?text={text}&speaker={speaker_id}
   → レスポンス: Query Object (JSON)
      {
        "accent_phrases": [...],
        "speedScale": 1.0,
        "pitchScale": 0.0,
        "volumeScale": 1.0,
        ...
      }

2. 音声合成
   POST http://localhost:50021/synthesis?speaker={speaker_id}
   Body: Query Object (上記のJSONをそのまま送信)
   → レスポンス: WAV audio data (ArrayBuffer)

3. 音声再生
   AudioContext.decodeAudioData(arrayBuffer)
   → AudioBuffer
   → BufferSourceNode再生
```

### エラーハンドリング

| エラー | 原因 | 対処法 |
|--------|------|--------|
| ネットワークエラー | VOICEVOXが起動していない | `voicevox_engine` を起動 |
| CORSエラー | CORS許可されていない | `--cors_policy_mode all` で起動 |
| 400エラー | 無効なSpeaker ID | 設定画面でSpeaker IDを確認 |
| 500エラー | VOICEVOXの内部エラー | VOICEVOXのログを確認 |

### Speaker ID

- デフォルト: 0（四国めたん - ノーマル）
- 設定画面から変更可能
- localStorageに永続化
- VOICEVOXの `/speakers` エンドポイントで利用可能なIDを取得可能

## 設定とカスタマイズ

### デフォルト定数 (App.tsx)

```typescript
const DEFAULT_VRM_URL = '/models/avatar.glb';
const ANIMATION_URL = '/animations/idle_loop.vrma';
const DEFAULT_VOICEVOX_URL = 'http://localhost:50021';
const DEFAULT_SPEAKER_ID = 0;
const DEFAULT_VOLUME_SCALE = 1.0;
```

### 設定モーダル項目

1. **VOICEVOX Engine URL**
   - テキスト入力
   - バリデーション: URL形式
   - デフォルト: `http://localhost:50021`

2. **Speaker ID**
   - 数値入力
   - バリデーション: 整数、0以上
   - デフォルト: 0

3. **Volume Scale**
   - レンジスライダー
   - 範囲: 0.00〜2.00
   - ステップ: 0.01
   - デフォルト: 1.00

4. **VRM File**
   - ファイル入力
   - 許可フォーマット: .vrm, .glb
   - IndexedDBに保存

5. **Reset All Settings**
   - ボタン
   - 全設定を初期化 + IndexedDBクリア

### ポート設定

**Electronアプリの構成:**
- **フロントエンド**: 8563（Vite Dev Server / Electron Window）
- **APIサーバー**: 8564（Express Server）

```typescript
// vite.config.ts（フロントエンド）
export default defineConfig({
  server: {
    port: 8563,
  },
});

// APIサーバーは別途8564で起動
```

## トラブルシューティング

### 1. 音声が再生されない

**症状:** 無音、再生されない

**原因:**
- AudioContextが初期化されていない（ユーザークリック必須）
- VOICEVOXエンジンが起動していない
- CORS許可されていない
- 無効なSpeaker ID

**確認手順:**
1. 画面をクリックして音声を有効化
2. `http://localhost:50021/docs` でVOICEVOXにアクセス
3. ブラウザコンソールでCORSエラーを確認
4. 設定画面でSpeaker IDを確認
5. VOICEVOXのログを確認

**解決方法:**
```bash
# VOICEVOXをCORS許可で再起動
voicevox_engine --cors_policy_mode all

# 別のSpeaker IDを試す
curl http://localhost:50021/speakers
```

### 2. アバターが表示されない

**症状:** 空白画面、エラーメッセージ

**原因:**
- VRMファイルが無効
- 必須ブレンドシェイプがない
- ファイルサイズが大きすぎる
- CORS問題（外部URL）

**確認手順:**
1. ブラウザコンソールでエラーを確認
2. VRMファイルをVRMビューアで検証
3. ファイルサイズを確認（50MB未満推奨）
4. ローカルファイルを使用

**解決方法:**
```bash
# VRMファイルの検証
# VRM Consortium公式ビューアで開く
# https://vrm.dev/

# デフォルトアバターに戻す
# 設定画面で "Reset All Settings"
```

### 3. リップシンクが動作しない

**症状:** 口が動かない

**原因:**
- VRMモデルに `aa` 表情がない
- 音量が低すぎる
- AnalyserNodeがデータを受信していない
- 表情名が一致しない

**確認手順:**
1. VRMモデルの表情リストを確認
2. 音量を最大にして再生
3. `useLipSync.ts` の閾値を調整
4. ブラウザコンソールで `aa` 表情の存在を確認

**解決方法:**
```typescript
// VRMAvatar.tsxで利用可能な表情を確認
console.log(vrm.expressionManager?.expressionMap);

// useLipSync.tsxの閾値を下げる
const threshold = 0.01; // デフォルトより低い値
```

### 4. 感情表現が動作しない

**症状:** 表情が変わらない

**原因:**
- VRMモデルに感情表情がない
- 表情名が一致しない
- emotionパラメータが正しく渡されていない

**確認手順:**
1. VRMモデルの表情を確認
2. ブラウザコンソールでemotionパラメータを確認
3. `applyEmotion` 関数のログを追加

**解決方法:**
```typescript
// VRMAvatar.tsxのemotionMapをカスタマイズ
const emotionMap = {
  happy: ['happy', 'joy', 'smile'],  // 代替名を追加
  // ...
};

// APIリクエストを確認
console.log('Emotion:', emotion);
```

### 5. WebSocket接続失敗

**症状:** WebSocketが接続できない

**原因:**
- サーバーが起動していない
- ポートが使用中
- ファイアウォールがブロック

**確認手順:**
```bash
# サーバーが起動しているか確認
lsof -i :8564

# APIエンドポイントをテスト
curl -X POST http://localhost:8564/speak \
  -H "Content-Type: application/json" \
  -d '{"text":"テスト"}'

# フロントエンドをテスト
curl http://localhost:8563

# WebSocketをテスト
wscat -c ws://localhost:8564/ws
```

**解決方法:**
```bash
# APIサーバーのプロセスを停止
kill -9 $(lsof -t -i:8564)

# フロントエンドのプロセスを停止
kill -9 $(lsof -t -i:8563)

# アプリを再起動
npm run dev
```

### 6. プラグインが動作しない

**症状:** Claude Codeがアバターに連携しない

**原因:**
- プラグインがインストールされていない
- プラグインが無効化されている
- context.mdのポート番号が間違っている

**確認手順:**
```bash
# プラグインディレクトリを確認
ls -la ~/.claude/plugins/

# プラグインの内容を確認
cat ~/.claude/plugins/cc-avatar-plugin/context/context.md
```

**解決方法:**
```bash
# プラグインを再インストール
rm -rf ~/.claude/plugins/cc-avatar-plugin
ln -s $(pwd)/cc-avatar-plugin ~/.claude/plugins/cc-avatar-plugin

# Claude Codeでプラグインを有効化
# /plugin コマンドで確認
```

**context.mdのポート確認:**
APIサーバーのポートは **8564** です。context.mdで正しく設定されていることを確認してください。
```bash
curl -X POST "http://localhost:8564/speak" \
    -d "{\"text\":\"...\", \"emotion\":\"...\"}"
```

## パフォーマンス最適化

### 最適化ポイント

1. **AnalyserNode FFT Size**
   - 256で十分（音声解析用）
   - 低いほど高速、CPU負荷軽減

2. **アニメーションループ**
   - `requestAnimationFrame` 使用
   - ブラウザの最適なタイミングで実行
   - 非表示時は自動的に停止

3. **VRM読み込み**
   - 非同期ローディング
   - ローディング状態のフィードバック
   - エラーハンドリング

4. **IndexedDB**
   - 非同期API使用
   - UIをブロックしない
   - 大容量ファイルに対応

### メモリ管理

- **AudioBuffer**: 再生後に自動ガベージコレクション
- **VRMモデル**: メモリキャッシュ（単一インスタンス）
- **WebSocket**: コンポーネントアンマウント時にクリーンアップ

### ブラウザ互換性

**必須機能:**
- AudioContext (Web Audio API)
- WebSocket
- IndexedDB
- WebGL 2.0 (Three.js用)
- ES6+ JavaScript

**テスト済みブラウザ:**
- Chrome 90+
- Firefox 88+
- Edge 90+
- Safari 14+（AudioContextに一部制約あり）

## セキュリティ考慮事項

### CORS設定

- VOICEVOXは `--cors_policy_mode all` で起動必須
- 本番環境では適切なCORS設定を構成
- 信頼できるオリジンのみ許可

### Content Security Policy

- WebSocket接続: 同一オリジンのみ
- 外部VRMファイル: 信頼できるソースのみ
- スクリプト実行: 制限付き

### ファイルアップロード

- VRMファイル: ブラウザのIndexedDBのみに保存
- サーバー側にユーザーデータを保存しない
- ファイル読み込み前にバリデーション

### プラグインセキュリティ

- コンテキスト注入: シェルスクリプト実行に注意
- APIエンドポイント: localhostのみ（本番環境では認証追加推奨）
- 機密情報: プラグインファイルに含めない

## 今後の拡張アイデア

- [ ] 背景カスタマイズ（色、画像、3D環境）
- [ ] カメラアングル制御（ズーム、回転、プリセット位置）
- [ ] Claude Code以外のLLM対応

## 開発コマンド

```bash
# 依存関係インストール
npm install

# 開発サーバー起動（HMR有効）
npm run dev

# 本番ビルド
npm run build

# 本番サーバー起動
npm run start

# リンター実行
npm run lint
```

## 環境セットアップ

### 必須サービス

1. **VOICEVOX Engine**: localhost:50021（または設定URL）
   ```bash
   voicevox_engine --cors_policy_mode all
   ```

2. **Node.js**: バージョン18以上

3. **Claude Code**: プラグインシステム対応バージョン

### オプションツール

- ブラウザ開発者ツール（デバッグ用）
- React DevTools拡張機能
- VRMビューア（モデルテスト用）
- wscat（WebSocketテスト用）

## テストチェックリスト

変更をテストする際の確認項目：

- [ ] ユーザーインタラクション後に音声が再生される
- [ ] リップシンクが音声に同期している
- [ ] 音声キューが順序通りに処理される
- [ ] 設定がページリロード後も保持される
- [ ] カスタムVRMが正しく読み込まれる
- [ ] 音量調整がリップシンクに影響しない
- [ ] 感情パラメータが適切な表情を適用する
- [ ] WebSocketメッセージが正しく処理される
- [ ] HTTP APIエンドポイントが正しく応答する
- [ ] エラー状態が適切に表示される
- [ ] ブラウザコンソールに致命的エラーがない
- [ ] Claude Codeプラグインが正しく連携する

## 主要依存関係

- **react**: ^18.3.1
- **three**: ^0.170.0
- **@react-three/fiber**: ^8.17.10
- **@react-three/drei**: ^9.117.3
- **@pixiv/three-vrm**: ^3.1.4
- **@pixiv/three-vrm-animation**: ^0.1.1
- **ws**: ^8.18.0

完全な依存関係リストは `package.json` を参照してください。