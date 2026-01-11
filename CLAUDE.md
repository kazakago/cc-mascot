# VRM Avatar Speech Application

VRMアバターが外部から入力されたテキストを読み上げてくれるWebフロントエンドアプリケーション。

## 概要

このアプリケーションは、VRMフォーマットの3Dアバターを表示し、WebSocketまたはHTTP APIを通じて受け取ったテキストをVOICEVOXエンジンで音声合成し、リップシンク付きで再生します。

## 主な機能

- **VRMアバター表示**: VRM/GLBフォーマットの3Dモデルを表示
- **音声合成**: VOICEVOX互換エンジンを使用したテキスト読み上げ
- **リップシンク**: 音声に同期した口の動き（aa表情を使用）
- **待機モーション**: VRMAファイルによるアイドルアニメーション
- **WebSocket/HTTP API**: 外部アプリケーションからのテキスト入力
- **音声キュー**: 連続したテキスト入力を順番に処理
- **設定画面**: Speaker ID、VOICEVOX URL、音量、VRMファイルの変更
- **永続化**: 設定値とVRMファイルの保存（localStorage + IndexedDB）

## 技術スタック

- **フロントエンド**: React + TypeScript + Vite
- **3D**: Three.js + @react-three/fiber + @react-three/drei
- **VRM**: @pixiv/three-vrm + @pixiv/three-vrm-animation
- **音声**: Web Audio API (AudioContext, AnalyserNode, GainNode)
- **通信**: WebSocket (ws)
- **ストレージ**: localStorage + IndexedDB

## セットアップ

### 前提条件

- Node.js 18以上
- VOICEVOX Engine（ローカルで起動済み）

### インストール

```bash
npm install
```

### 開発サーバー起動

```bash
npm run dev
```

デフォルトで `http://localhost:8563` で起動します。

### ビルド

```bash
npm run build
```

### プロダクションサーバー起動

```bash
npm run start
```

## 使い方

### 1. 初回起動

1. ブラウザで `http://localhost:8563` にアクセス
2. "Click to enable audio" と表示されたらクリック（AudioContext有効化のため）
3. アバターが表示されます

### 2. テキストを読み上げさせる

#### WebSocket経由

```javascript
const ws = new WebSocket('ws://localhost:8563/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'speak',
    text: 'こんにちは、私はVRMアバターです'
  }));
};
```

#### HTTP API経由

```bash
curl -X POST http://localhost:8563/speak \
  -H "Content-Type: application/json" \
  -d '{"text":"こんにちは"}'
```

### 3. 設定変更

右上の歯車アイコンをクリックして設定画面を開きます。

**設定項目:**
- **VOICEVOX Engine URL**: VOICEVOXエンジンのURL（デフォルト: `http://localhost:50021`）
- **Speaker ID**: 音声の話者ID（デフォルト: 0）
- **Volume Scale**: 音量調整スライダー（0.00〜2.00、デフォルト: 1.00）
- **VRM File**: VRM/GLBファイルのインポート（ファイルピッカー）

**リセット:**
- "Reset All Settings" ボタンですべての設定とVRMファイルを初期化

### 4. VRMファイルのインポート

1. 設定画面を開く
2. "Choose VRM File" ボタンでVRM/GLBファイルを選択
3. "Save" をクリック
4. アバターが切り替わります

**注意:** ファイルはIndexedDBにコピーされるため、元ファイルを削除しても問題ありません。

## API仕様

### WebSocket API

**エンドポイント:** `ws://localhost:8563/ws`

**メッセージフォーマット:**
```json
{
  "type": "speak",
  "text": "読み上げるテキスト"
}
```

### HTTP API

**エンドポイント:** `POST /speak`

**リクエストボディ:**
```json
{
  "text": "読み上げるテキスト"
}
```

**レスポンス:**
```json
{
  "status": "ok"
}
```

## アーキテクチャ

### ディレクトリ構造

```
cc-avatar/
├── src/
│   ├── components/
│   │   ├── VRMAvatar.tsx        # VRMアバター表示コンポーネント
│   │   └── SettingsModal.tsx    # 設定モーダル
│   ├── hooks/
│   │   ├── useVRM.ts            # VRMローダー
│   │   ├── useVRMAnimation.ts   # VRMAアニメーション
│   │   ├── useSpeech.ts         # 音声再生とキュー管理
│   │   ├── useLipSync.ts        # リップシンク（音声解析）
│   │   ├── useWebSocket.ts      # WebSocket接続
│   │   └── useLocalStorage.ts   # localStorage永続化
│   ├── services/
│   │   └── voicevox.ts          # VOICEVOX API クライアント
│   ├── utils/
│   │   └── vrmStorage.ts        # IndexedDB VRMファイル管理
│   ├── App.tsx                  # メインアプリケーション
│   ├── App.css                  # スタイル
│   └── main.tsx                 # エントリーポイント
├── public/
│   ├── models/
│   │   └── avatar.glb           # デフォルトVRMアバター
│   ├── animations/
│   │   └── idle_loop.vrma       # 待機モーション
│   └── icons/
│       └── settings.svg         # 設定アイコン
├── vite.config.ts               # Vite設定（WebSocketプラグイン含む）
├── prodServer.ts                # プロダクションサーバー
└── package.json
```

### データフロー

```
外部アプリ
  ↓ WebSocket/HTTP
WebSocket Server (Viteプラグイン)
  ↓
App.tsx (handleWebSocketMessage)
  ↓
useSpeech (speakText)
  ↓ キューに追加
VOICEVOX API (speak)
  ↓ ArrayBuffer
AudioContext (decodeAudioData)
  ↓
AudioGraph: source → analyser → gain → destination
  ↓
useLipSync (AnalyserNode解析)
  ↓
VRMAvatar (aa表情値を更新)
```

### 音声処理の仕組み

#### 1. AudioContext初期化
ブラウザのセキュリティポリシーにより、ユーザーインタラクション（クリック等）が必要です。初期化前はオーバーレイを表示します。

#### 2. キューシステム
複数のテキストが連続して送信された場合、キューに保存して順番に処理します（`useSpeech.ts`）。

#### 3. Web Audio API グラフ
```
BufferSource → AnalyserNode → GainNode → Destination
                    ↓
                useLipSync
```

- **AnalyserNode**: 元の波形を解析してリップシンク用のデータを取得
- **GainNode**: 音量調整（設定画面のVolume Scaleを適用）

**重要:** GainNodeを使うことで、音量調整してもリップシンクに影響を与えません。

#### 4. リップシンク
AnalyserNodeから時間領域データ（getByteTimeDomainData）を取得し、RMS（二乗平均平方根）を計算して口の開き具合（aa表情の値）を決定します。

### ストレージ

#### localStorage
- `speakerId`: Speaker ID（数値）
- `baseUrl`: VOICEVOX Engine URL（文字列）
- `volumeScale`: 音量スケール（数値）

#### IndexedDB
- データベース名: `VRMStorage`
- オブジェクトストア: `vrm-files`
- キー: `current-vrm`
- 値: VRMファイル（Blob）

## 設定

### 環境変数

現在、環境変数での設定には対応していませんが、`vite.config.ts`で以下を変更できます：

```typescript
export default defineConfig({
  server: {
    port: 8563,  // 開発サーバーのポート番号
  },
});
```

### デフォルト値

以下の定数は `App.tsx` で定義されています：

```typescript
const DEFAULT_VRM_URL = '/models/avatar.glb';
const ANIMATION_URL = '/animations/idle_loop.vrma';
```

## トラブルシューティング

### 音声が再生されない

1. **AudioContextが初期化されていない**
   - 画面をクリックして "Click to enable audio" を消してください

2. **VOICEVOXエンジンが起動していない**
   - `http://localhost:50021` でVOICEVOXエンジンが起動していることを確認
   - 設定画面でURLが正しいか確認

3. **CORSエラー**
   - VOICEVOXエンジンを `--cors_policy_mode all` オプションで起動してください

### アバターが表示されない

1. **VRMファイルが読み込めない**
   - ブラウザの開発者ツールでエラーを確認
   - VRM/GLBファイルが正しいフォーマットか確認

2. **カメラの位置**
   - アバターが大きすぎる/小さすぎる場合は `VRMAvatar.tsx` の `position` と `Camera` の `position` を調整

### リップシンクが動かない

1. **表情が含まれていない**
   - VRMファイルに `aa` 表情が含まれているか確認

2. **音量が小さすぎる**
   - Volume Scaleを上げてみてください
   - `useLipSync.ts` の閾値を調整してください

## 開発時の注意点

### ブラウザセキュリティ
- AudioContextは必ずユーザーインタラクション後に初期化
- IndexedDBは非同期処理なので必ずPromiseを適切に処理

### パフォーマンス
- AnalyserNodeの `fftSize` は256で十分（リップシンク用）
- アニメーションループは `requestAnimationFrame` を使用
- VRMファイルは大きいのでIndexedDBに保存（localStorage不可）

### VRMファイル
- VRM 0.x と VRM 1.0 の両方をサポート（@pixiv/three-vrm）
- GLB拡張子でも読み込み可能
- 表情名は標準の `aa` を使用

## 今後の拡張案

- [ ] Electronアプリ化（VOICEVOXエンジンの自動起動）
- [ ] 複数のアバター切り替え
- [ ] 感情表現（喜び、怒り、悲しみなどの表情）
- [ ] 音声認識との連携
- [ ] 字幕表示
- [ ] カメラアングルの変更
- [ ] 背景のカスタマイズ

## ライセンス

このプロジェクトはApache License Version 2.0でライセンスされています。

使用している主なライブラリ：
- Three.js (MIT License)
- @pixiv/three-vrm (MIT License)
- React (MIT License)

## 参考資料

- [VOICEVOX Engine API仕様](https://voicevox.github.io/voicevox_engine/api/)
- [@pixiv/three-vrm ドキュメント](https://github.com/pixiv/three-vrm)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [参考にした記事](https://techracho.bpsinc.jp/ecn/2023_12_03/136723)
