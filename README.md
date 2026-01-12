# cc-avatar

![VRM Avatar](https://img.shields.io/badge/VRM-3D_Avatar-blue)
![Claude Code](https://img.shields.io/badge/Claude-Code-green)
![License](https://img.shields.io/badge/license-Apache%202.0-blue)

Claude Codeからの返答をVRMアバターが喋ってくれる擬人化アプリケーションです。

- Claude Codeプラグインを通じて発言をリアルタイムで読み上げ
- 音声はVOICEVOX ENGINEを利用
  - スタイルを指定することで好きな声色に変更可能
  - VOICEVOX API互換のAivisSpeech等も利用可能
- 音声に同期したリップシンク
- 感情に応じた表情変化
  - 感情はClaude Code自身が分類
  - 表情対応しているVRMモデルのみ
- 好きなVRMモデルに変更可能

## デモ

[WIP]

## セットアップ

### 1. VOICEVOXのインストール

下記URLよりVOICEVOXをインストールして起動してください  
https://voicevox.hiroshiba.jp/  

- VOICEVOXエンジンが起動していればVOICEVOXアプリケーション自体は立ち上がっていなくても問題ありません
- VOICEVOX API互換の[AivisSpeech](https://aivis-project.com/)も設定変更すれば利用可能です

### 2. cc-avatarアプリケーションのインストール

下記から最新バイナリをインストール、起動してください。  
https://github.com/kazakago/cc-avatar/releases

### 3. Claude Codeプラグインのインストール

Claude Code上で下記手順でプラグインをインストール  

```bash
/plugin marketplace add kazakago/cc-avatar
/plugin install cc-avatar-plugin@cc-avatar-marketplace
```

### 4. Claude Codeを再起動してからなにか喋らせる

cc-avatarに表示されてるアバターが喋ってくれるはず

## 設定変更

cc-avatarの右上の歯車アイコンをクリックすると設定変更が可能です

- **"Choose VRM File"**: VRMファイルを指定
- **VOICEVOX URL**: VOICEVOXエンジンのURL
- **Speaker ID**: 声の種類（VOICEVOX）
- **音量**: 音量調整

## 感情表現について

Claude Codeの返答内容に応じて、自動的に表情が変わります  
ただしVRMファイルが対応している場合に限ります。

- **通常**: neutral（無表情）
- **喜び**: happy（笑顔）
- **怒り**: angry（怒り顔）
- **悲しみ**: sad（悲しい顔）
- **楽しい**: relaxed（リラックス）
- **驚き**: surprised（驚き顔）

## API経由での直接利用

プラグインを使わず、APIから直接呼び出すこともできます。

### HTTP API

```bash
curl -X POST http://localhost:8564/speak \
  -H "Content-Type: application/json" \
  -d '{"text":"こんにちは", "emotion":"happy"}'
```

emotionはVRMの仕様で対応しているものを指定したときのみ動作します
https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm-1.0/expressions.ja.md#%E6%84%9F%E6%83%85

### WebSocket API

```javascript
const ws = new WebSocket('ws://localhost:8564/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'speak',
    text: 'こんにちは、世界！',
    emotion: 'happy'
  }));
};
```

## 全体的な仕組み

```
Claude Code
    ↓ セリフを出力
プラグイン (cc-avatar-plugin)
    ↓ 感情判定 & API送信
アバターアプリ
    ↓ VOICEVOX API呼び出し
VOICEVOX ENGINE
    ↓ 
発話 & アバターがアニメーション
```

## 技術スタック

- **React + TypeScript + Vite**: フロントエンド
- **Three.js**: 3Dレンダリング
- **@pixiv/three-vrm**: VRMサポート
- **VOICEVOX**: 音声合成
- **Web Audio API**: リップシンク
- **Claude Code Plugin System**: プラグイン連携

## トラブルシューティング

### アバターが喋らない

下記を確認してください

1. アバターアプリが起動しているか
2. VOICEVOXエンジンが起動しているか
3. Claude Codeでプラグインが有効になっているか

## 参考

- https://code.claude.com/docs/ja/plugins
- https://github.com/pixiv/three-vrm
- https://voicevox.github.io/voicevox_engine/api/
- https://techracho.bpsinc.jp/ecn/2023_12_03/136723