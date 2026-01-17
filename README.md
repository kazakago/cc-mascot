# cc-mascot

![VRM Avatar](https://img.shields.io/badge/VRM-3D_Avatar-blue)
![Claude Code](https://img.shields.io/badge/Claude-Code-green)
![License](https://img.shields.io/badge/license-Apache%202.0-blue)

Claude Codeからの返答をVRMアバターが喋ってくれる擬人化アプリケーションです。

- Claude Codeのログファイルを監視して自動的に発言を読み上げ
- 音声はVOICEVOX ENGINEを利用
  - スタイルを指定することで好きな声色に変更可能
  - VOICEVOX API互換のAivisSpeech等も利用可能
- 音声に同期したリップシンク
- 好きなVRMモデルに変更可能

## デモ

[WIP]

## セットアップ

### 1. VOICEVOXのインストール

下記URLよりVOICEVOXをインストールして起動してください  
https://voicevox.hiroshiba.jp/  

- VOICEVOXエンジンが起動していればVOICEVOXアプリケーション自体は立ち上がっていなくても問題ありません
- VOICEVOX API互換の[AivisSpeech](https://aivis-project.com/)も設定変更すれば利用可能です

### 2. cc-mascotアプリケーションのインストール

下記から最新バイナリをインストール、起動してください。
https://github.com/kazakago/cc-mascot/releases

### 3. Claude Codeで会話を開始

cc-mascotアプリを起動した状態でClaude Codeで会話すると、自動的にアバターが喋ります。

**仕組み:**
- `~/.claude/projects/` 配下のログファイルを監視
- Claude Codeの応答を自動検出して音声化
- プラグイン不要でシンプルに動作

## 設定変更

cc-mascotの右上の歯車アイコンをクリックすると設定変更が可能です

- **"Choose VRM File"**: VRMファイルを指定
- **VOICEVOX URL**: VOICEVOXエンジンのURL
- **Speaker ID**: 声の種類（VOICEVOX）
- **音量**: 音量調整

## リップシンクについて

音声に同期して自動的に口が動きます。
VRMファイルに `aa` 表情が含まれている必要があります。

## 全体的な仕組み

```
Claude Code
    ↓ セリフを出力
プラグイン (cc-mascot-plugin)
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