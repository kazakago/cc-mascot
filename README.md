# cc-mascot

![License](https://img.shields.io/badge/license-Apache%202.0-blue) [![Validate](https://github.com/kazakago/cc-mascot/actions/workflows/validate.yml/badge.svg)](https://github.com/kazakago/cc-mascot/actions/workflows/validate.yml)

Claude Codeからの返答をVRMキャラクターが喋ってくれるデスクトップマスコットです。

https://github.com/user-attachments/assets/6f67d2fb-e613-4c40-b369-ae8c9092e7f7

<img width="600" alt="スクリーンショット 2026-02-07 14 56 09" src="https://github.com/user-attachments/assets/e8867e42-8197-45ef-8fef-b8f88a70290c" />

## 特徴

- **オフライン動作**: インターネット接続不要でローカル環境で完結
- **日本語特化**: 日本語の音声合成とルールベース感情分析に最適化
- **自動ログ監視**: Claude Codeのログファイルを監視して自動的に発言を読み上げ
- **音声合成エンジン**: AivisSpeech / VOICEVOX / 互換エンジンに対応
- **リップシンク**: 音声に同期した自然な口の動き
- **感情表現**: テキストから感情を自動判定してキャラクターに反映
- **視線追従**: マウスカーソルの方向への視線追従
- **カスタマイズ**: 好きなVRMモデルや音声スタイルに変更可能

## 利用環境

- MacOS
  - M1以降のみ対応
- Windows
  - WSL環境へインストールしたClaudeCodeには非対応

## セットアップ

### 1. 音声合成エンジンのインストール

以下の音声合成エンジンをインストールしてください。

**[AivisSpeech](https://aivis-project.com/)**

インストーラー版によるグローバルインストールを推奨します。  
デフォルトパス以外に音声合成エンジンを配置した場合、設定変更でパスを指定してください。

初回起動とモデルDLまで済ませれば上記アプリケーションを起動しておく必要はありません。  
cc-mascotが自動的にエンジンプロセスを起動します。

> [!TIP]
> 本アプリケーションはVOICEVOX API互換のエンジンを利用して動作します。  
> 設定変更することで **[VOICEVOX](https://voicevox.hiroshiba.jp/)** も利用可能です。

### 2. cc-mascotアプリケーションのインストール

下記から最新バイナリをインストールしてください。  
https://github.com/kazakago/cc-mascot/releases

### 3. cc-mascotアプリケーションの起動

アプリケーションを起動すると、VRMキャラクターと**システムトレイにアイコン**が表示されます。

### 4. Claude Codeで会話を開始

アプリを起動した状態でClaude Codeで会話すると、自動的にキャラクターが喋ります。

**仕組み:**

- `~/.claude/projects/` 配下のログファイルをリアルタイム監視
- Claude Codeの応答を自動検出
- テキストから感情を自動判定
- 音声合成してキャラクターが発話

## 基本操作

### キャラクターの操作

- **ドラッグ移動**: キャラクター上でドラッグすると好きな位置に移動できます
- **右クリック**: キャラクター上で右クリックすると設定画面が開きます

### システムトレイから設定を開く

システムトレイアイコンのメニューから「設定を開く」でも設定画面にアクセスできます。

### リップシンクと表情変更について

音声に同期して自動的に口が動きます。  
表情変更にはVRMファイルに表情が含まれている必要があります。

## 設定変更

### キャラクター

- **VRMモデル変更**: 好きなVRMファイル（.vrm / .glb）を選択
- **キャラクターサイズ**: ウィンドウサイズを調整（400〜1200px）

### オーディオ

- **音声合成エンジン**: AivisSpeech / VOICEVOX / カスタムパス から選択
- **音声スタイル**: 話者・スタイルを選択（エンジンから自動取得）
- **音量**: 音量調整（0.00〜2.00）
- **マイク使用中はミュートにする**: OSのマイク使用を検出して制御
- **サブエージェントの発言を含める**: サブエージェントまで発話対象とするか
- **テスト音声**: テスト音声を再生してプレビュー

## 開発者向け

### 全体的な仕組み

```
Claude Code
    ↓ JSONLログ出力
~/.claude/projects/**/*.jsonl
    ↓ chokidar監視
Electron Main Process
    ↓ ログパース & 感情判定
Electron Renderer Process
    ↓ 音声合成API呼び出し
音声合成エンジン
    ↓ WAV音声データ
Web Audio API
    ↓ リップシンク解析
VRMキャラクター
    ↓
発話 & 口の動き & 感情表現
```

### 開発環境のセットアップ

```bash
git clone https://github.com/kazakago/cc-mascot.git
cd cc-mascot
npm install
npm run build
npm run build:mic-monitor
npm run dev
```

### 技術スタック

- **Electron**: デスクトップアプリケーション
- **React + TypeScript + Vite**: フロントエンド
- **Three.js + @react-three/fiber**: 3Dレンダリング
- **@pixiv/three-vrm**: VRMサポート
- **chokidar**: ファイル監視

### 参考

- https://github.com/pixiv/three-vrm
- https://aivis-project.com/
- https://voicevox.hiroshiba.jp/
