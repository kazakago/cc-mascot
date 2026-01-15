# Claude Code Avatar - 技術ドキュメント

## プロジェクト概要

**Claude Codeを擬人化するためのVRMアバターシステム**

このアプリケーションは、Claude Codeの発言をリアルタイムで音声化し、3DのVRMアバターでビジュアル化するためのElectronアプリケーションです。Claude Codeのログファイルを監視して、AIの応答を自動的に検出・音声化します。

**主な用途:**
- Claude Codeの擬人化（ログ監視による自動検出）

**技術スタック:**
- React + TypeScript + Vite
- Electron (IPC通信)
- Three.js + @react-three/fiber + @react-three/drei
- @pixiv/three-vrm + @pixiv/three-vrm-animation
- Web Audio API (AudioContext, AnalyserNode, GainNode)
- chokidar（ログファイル監視）
- localStorage + IndexedDB

**ポート:**
- Electronフロントエンド: 8563

**重要:** このアプリケーションはElectron専用アプリです。`~/.claude/projects/` 配下のログファイルを自動監視し、Claude Codeの応答を検出します。

## アーキテクチャ

### 全体構成

```
┌─────────────────┐
│  Claude Code    │
│  (AI Assistant) │
└────────┬────────┘
         │ ログ出力
         ↓
┌─────────────────────────┐
│ ~/.claude/projects/     │
│ └─ **/*.jsonl           │ ← セッションログ
└────────┬────────────────┘
         │ chokidar監視
         ↓
┌─────────────────────────┐
│ Electron App            │
│ ├─ Main Process         │
│ │  ├─ LogMonitor        │ ← ログファイル監視・JSONL解析
│ │  └─ IPC送信           │
│ ├─ Renderer Process     │
│ │  ├─ IPC受信           │
│ │  ├─ VOICEVOX Client   │
│ │  ├─ Audio Engine      │
│ │  └─ VRM Renderer      │
│ └─ Frontend (8563)      │
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
│   │   └── useLocalStorage.ts     # localStorage永続化
│   ├── services/
│   │   └── voicevox.ts            # VOICEVOX APIクライアント
│   ├── utils/
│   │   └── vrmStorage.ts          # IndexedDB VRMファイル管理
│   ├── App.tsx                    # メインアプリケーション
│   ├── App.css                    # スタイル
│   └── main.tsx                   # エントリーポイント
├── electron/
│   ├── main.ts                    # Electronメインプロセス
│   ├── preload.ts                 # プリロードスクリプト
│   └── logMonitor.ts              # ★ ログファイル監視モジュール
├── public/
│   ├── models/
│   │   └── avatar.glb             # デフォルトVRMアバター
│   ├── animations/
│   │   └── idle_loop.vrma         # 待機モーション
│   └── icons/
│       └── settings.svg           # 設定アイコン
├── vite.config.ts                 # Vite設定
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

### ログ監視フロー

```
1. アプリ起動
   Electron App起動
   ↓
   LogMonitor初期化
   ↓
   chokidarで ~/.claude/projects/**/*.jsonl を監視開始
   ↓
   既存ファイルの位置をEOFに初期化（既存ログは処理しない）

2. Claude Code応答検出
   Claude Codeがユーザーに応答
   ↓
   ~/.claude/projects/{project}/{session}.jsonl に追記
   ↓
   chokidarが変更を検出
   ↓
   LogMonitorが差分を読み取り
   ↓
   JSONLパース＆フィルタリング
   ├─ type === "assistant" をチェック
   ├─ message.role === "assistant" をチェック
   └─ message.content[].type === "text" を抽出
   ↓
   Electron IPCでフロントエンドに送信
   mainWindow.webContents.send('speak', message)
   {type: "speak", text: "...", emotion: "neutral"}

3. 音声合成・再生
   フロントエンド (IPC受信: window.electron.onSpeak)
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
   VRMAvatar: 口が動く
```

### JSONL構造

Claude Codeのログファイル（JSONL形式）:
```json
{
  "type": "assistant",
  "message": {
    "type": "message",
    "role": "assistant",
    "content": [
      {"type": "text", "text": "喋らせる内容"},
      {"type": "thinking", "thinking": "..."},
      {"type": "tool_use", "name": "...", "input": {...}}
    ]
  }
}
```

**フィルタリングルール:**
- トップレベルの `type === "assistant"` のみ処理
- `message.role === "assistant"` を確認
- `message.content[]` 内の `type === "text"` のみ抽出
- `thinking`, `tool_use` などはスキップ

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

## API仕様

### Electron IPC API

**Main Process → Renderer Process:**

Main Processからログ監視で検出したメッセージを送信：
```typescript
mainWindow.webContents.send('speak', message);
```

**Renderer Processで受信:**
```typescript
// preload.tsで公開
window.electron.onSpeak((message: string) => {
  const data = JSON.parse(message);
  // { type: 'speak', text: '...', emotion: 'neutral' }
});
```

**メッセージフォーマット:**
```typescript
interface SpeakMessage {
  type: 'speak';
  text: string;
  emotion?: 'neutral' | 'happy' | 'angry' | 'sad' | 'relaxed' | 'surprised';
}
```

**実装例 (App.tsx):**
```typescript
useEffect(() => {
  if (window.electron?.onSpeak) {
    window.electron.onSpeak((message: string) => {
      const data = JSON.parse(message);
      if (data.type === 'speak' && data.text) {
        speakText(data.text, data.emotion || 'neutral');
      }
    });
  }
}, [speakText]);
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
- **IPC通信**: Electron内部通信（ポート不要）

```typescript
// vite.config.ts（フロントエンド）
export default defineConfig({
  server: {
    port: 8563,
  },
});
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

### 5. IPC通信が動作しない

**症状:** ログ監視は動作しているがアバターが喋らない

**原因:**
- preload.tsが正しく読み込まれていない
- window.electronが未定義
- IPCリスナーが登録されていない

**確認手順:**
```javascript
// ブラウザのコンソールで確認
console.log('window.electron:', window.electron);

// IPCリスナーをテスト
window.electron?.onSpeak((message) => {
  console.log('IPC message:', message);
});
```

**解決方法:**
```bash
# アプリを再起動
npm run dev

# preload.jsが正しくビルドされているか確認
ls -la dist-electron/preload.js
```

### 6. ログ監視が動作しない

**症状:** Claude Codeの応答がアバターに反映されない

**原因:**
- ログディレクトリが存在しない
- ファイル権限の問題
- chokidarが正しく動作していない

**確認手順:**
```bash
# ログディレクトリを確認
ls -la ~/.claude/projects/

# JSONLファイルを確認
find ~/.claude/projects -name "*.jsonl" | head -5

# アプリのコンソールログを確認（[LogMonitor]で始まるログ）
```

**解決方法:**
```bash
# アプリを再起動
npm run dev

# ファイル権限を確認
chmod -R u+r ~/.claude/projects/
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
- **IPC通信**: Electron内部で自動管理

### ブラウザ互換性

**必須機能:**
- AudioContext (Web Audio API)
- IndexedDB
- WebGL 2.0 (Three.js用)
- ES6+ JavaScript

**注意:** このアプリはElectron専用のため、通常のブラウザでは動作しません

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

- IPC通信: Electron内部通信のみ（外部アクセス不可）
- 外部VRMファイル: 信頼できるソースのみ
- スクリプト実行: contextIsolationで保護

### ファイルアップロード

- VRMファイル: ブラウザのIndexedDBのみに保存
- サーバー側にユーザーデータを保存しない
- ファイル読み込み前にバリデーション

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

### オプションツール

- Electron開発者ツール（デバッグ用）
- React DevTools拡張機能
- VRMビューア（モデルテスト用）

## テストチェックリスト

変更をテストする際の確認項目：

- [ ] ユーザーインタラクション後に音声が再生される
- [ ] リップシンクが音声に同期している
- [ ] 音声キューが順序通りに処理される
- [ ] 設定がページリロード後も保持される
- [ ] カスタムVRMが正しく読み込まれる
- [ ] 音量調整がリップシンクに影響しない
- [ ] IPC通信が正しく動作する（window.electronが定義されている）
- [ ] ログ監視が正しく動作する（[LogMonitor]ログが出る）
- [ ] Claude Codeの応答がアバターで音声化される
- [ ] エラー状態が適切に表示される
- [ ] Electron開発者ツールに致命的エラーがない

## 主要依存関係

- **react**: ^18.3.1
- **three**: ^0.170.0
- **@react-three/fiber**: ^8.17.10
- **@react-three/drei**: ^9.117.3
- **@pixiv/three-vrm**: ^3.1.4
- **@pixiv/three-vrm-animation**: ^0.1.1
- **electron**: Electron本体
- **chokidar**: ^5.0.0（ログファイル監視）

完全な依存関係リストは `package.json` を参照してください。