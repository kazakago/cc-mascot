# cc-mascot

![License](https://img.shields.io/badge/license-Apache%202.0-blue)

Claude Codeからの返答をVRMアバターが喋ってくれるデスクトップマスコットです。  
現時点ではMacOSでのみ動作確認しています。

## 特徴

- **オフライン動作**: インターネット接続不要でローカル環境で完結
- **日本語専用**: 日本語の音声合成とルールベース感情分析に最適化
- **自動ログ監視**: Claude Codeのログファイルを監視して自動的に発言を読み上げ
- **音声合成エンジン**: AivisSpeech / VOICEVOX / 互換エンジンに対応
  - アプリ起動時にエンジンを自動起動
  - スタイルを指定することで好きな声色に変更可能
- **リップシンク**: 音声に同期した自然な口の動き
- **感情表現**: テキストから感情を自動判定してアバターに反映
- **カスタマイズ**: 好きなVRMモデルに変更可能

## セットアップ

### 1. 音声合成エンジンのインストール

以下のいずれかをインストールしてください:

- AivisSpeech（デフォルト）
  - https://aivis-project.com/
- VOICEVOX
  - https://voicevox.hiroshiba.jp/

初回起動とモデルDLまで済ませれば上記アプリケーションを起動しておく必要はありません。  
cc-mascotが自動的にエンジンプロセスを起動します。

### 2. cc-mascotアプリケーションのインストール

下記から最新バイナリをインストール、起動してください。  
https://github.com/kazakago/cc-mascot/releases

### 3. Claude Codeで会話を開始

cc-mascotアプリを起動した状態でClaude Codeで会話すると、自動的にアバターが喋ります。

**仕組み:**

- `~/.claude/projects/` 配下のログファイルをリアルタイム監視
- Claude Codeの応答を自動検出
- テキストから感情を自動判定
- 音声合成してアバターが発話

## 設定変更

アバターウィンドウを**右クリック**すると設定画面が開きます。

### キャラクター

- **VRMモデル変更**: 好きなVRMファイル（.vrm / .glb）を選択
- **キャラクターサイズ**: ウィンドウサイズを調整（400〜1200px）

### オーディオ

- **音声合成エンジン**: AivisSpeech / VOICEVOX / カスタムパス から選択
- **音声スタイル**: 話者・スタイルを選択（エンジンから自動取得）
- **音量**: 音量調整（0.00〜2.00）
- **テスト音声**: テスト音声を再生してプレビュー

## リップシンクと表情変更について

音声に同期して自動的に口が動きます。  
表情変更にはVRMファイルに表情が含まれている必要があります。

## 全体的な仕組み

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
VRMアバター
    ↓
発話 & 口の動き & 感情表現
```

## 技術スタック

- **Electron**: デスクトップアプリケーション
- **React + TypeScript + Vite**: フロントエンド
- **Three.js + @react-three/fiber**: 3Dレンダリング
- **@pixiv/three-vrm**: VRMサポート
- **chokidar**: ファイル監視

## 参考

- https://github.com/pixiv/three-vrm
- https://aivis-project.com/
- https://voicevox.hiroshiba.jp/
