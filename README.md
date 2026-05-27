<p align="center">
  <img src="docs/icon.png" alt="CC Mascot" width="64" height="64">
</p>
<h1 align="center">CC Mascot</h1>
<p align="center">AIコーディングエージェントからの返答をVRMキャラクターがリアルタイムで読み上げ。<br />感情表現・リップシンク・視線追従で、コーディングに楽しいパートナーを。</p>
<p align="center">
  <a href="https://kazakago.github.io/cc-mascot/">https://kazakago.github.io/cc-mascot/</a>
</p>
<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue" alt="License"></a>
  <a href="https://github.com/kazakago/cc-mascot/actions/workflows/validate.yml"><img src="https://github.com/kazakago/cc-mascot/actions/workflows/validate.yml/badge.svg" alt="Validate"></a>
</p>

https://github.com/user-attachments/assets/f2742eac-1df3-436a-b79c-f7221e677474

<img alt="スクリーンショット 2026-02-07 14 56 09" src="docs/screenshot.jpg" />

## 特徴

- **オフライン動作**: インターネット接続不要でローカル環境で完結
- **日本語特化**: 日本語の音声合成とルールベース感情分析に最適化
- **自動ログ監視**: AIコーディングエージェントのログファイルを監視して自動的に発言を読み上げ
- **音声合成エンジン**: AivisSpeech / VOICEVOX / 互換エンジンに対応
- **リップシンク**: 音声に同期した自然な口の動き
- **感情表現**: テキストから感情を自動判定してキャラクターに反映
- **視線追従**: マウスカーソルの方向への視線追従
- **カスタマイズ**: 好きなVRMモデルや音声スタイルに変更可能

## 利用環境

- macOS
  - Apple Silicon搭載機種のみ対応
- Windows
  - WSL環境にインストールしたエージェントには非対応

## 対応エージェント

- [Claude Code](https://claude.com/product/claude-code)
- [Codex](https://openai.com/codex/)
- [Gemini CLI](https://geminicli.com/)
- [Antigravity](https://antigravity.google/)

## セットアップ

### 1. 音声合成エンジンのインストール

以下の音声合成エンジンをインストールしてください。

**[AivisSpeech](https://aivis-project.com/)**

インストーラー版によるグローバルインストールを推奨します。  
グローバルのデフォルトパス以外に音声合成エンジンを配置した場合、設定変更でエンジンパスを指定してください。  
設定変更はキャラクターを右クリックまたはシステムトレイアイコンから入れます。

> [!TIP]
> 参考: AivisSpeechのプログラムディレクトリ配下のエンジンまでのパス
>
> - macOS: `AivisSpeech.app/Contents/Resources/AivisSpeech-Engine/run`
> - Windows: `AivisSpeech/AivisSpeech-Engine/run.exe`

初回起動とモデルDLまで済ませれば上記アプリケーションを起動しておく必要はありません。  
CC Mascotが自動的にエンジンプロセスを起動します。

本アプリケーションはVOICEVOX API互換のエンジンを利用して動作します。  
設定変更することで **[VOICEVOX](https://voicevox.hiroshiba.jp/)** も利用可能です。

### 2. CC Mascotアプリケーションのインストール

下記から最新バイナリをインストールしてください。  
https://github.com/kazakago/cc-mascot/releases

> [!NOTE]
> ダウンロードすることで、[利用規約](https://kazakago.github.io/cc-mascot/terms.html)および[プライバシーポリシー](https://kazakago.github.io/cc-mascot/privacy.html)に同意したものとみなします。

### 3. CC Mascotアプリケーションの起動

アプリケーションを起動すると、VRMキャラクターと**システムトレイにアイコン**が表示されます。

音声合成エンジンが見つからない場合はその旨を示すダイアログが起動時に表示されるので 「1. 音声合成エンジンのインストール」を参照して対応してください。

### 4. AIコーディングエージェントで会話を開始

アプリを起動した状態でAIコーディングエージェントで会話すると、自動的にキャラクターが喋ります。

**仕組み:**

- 各エージェントのログファイルをリアルタイム監視
- エージェントの応答を自動検出
- テキストから感情を自動判定
- 音声合成してキャラクターが発話

## 基本操作

### キャラクターの操作

- **ドラッグ移動**: キャラクター上でドラッグすると好きな位置に移動できます
- **右クリック**: キャラクター上で右クリックすると設定画面が開きます

### システムトレイメニュー

- **設定を開く**: 設定画面にアクセスできます。
- **バージョン情報**: バージョン情報とライセンス情報、アップデートを確認できます。
- **終了**: CC Mascotを終了します。

### リップシンクと表情変更

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

### モーション

- **待機アニメーションを使用する**: 待機中にたまにリアクションを取ります。
- **発話アニメーションを使用する**: 発話時に感情に合わせたリアクションを取ります。

### その他の設定

- **起動時にアップデートを確認する**: インターネット通信を行い、新しいバージョンがあるかチェックします。

## セッションフィルタリング（Claude Code専用プラグイン）

> [!NOTE]
> この機能は **Claude Code** 専用です。

Claude Codeを複数セッション並列で使用している場合、デフォルトではすべてのセッションを発話対象しますが、別途専用のClaude Codeプラグインを用いることで特定のセッションのみを発話対象としてフィルタリングできます。

セッションを絞り込まないのであればこのプラグインはインストールする必要はありません。

### プラグインのインストール

```bash
/plugin marketplace add kazakago/cc-mascot
/plugin install cc-mascot@cc-mascot
```

### 使い方

| コマンド        | 説明                               |
| --------------- | ---------------------------------- |
| `/speak-this`   | このセッションの発話のみに絞り込む |
| `/speak-all`    | すべてのセッションの発話に戻す     |
| `/speak-status` | 現在の発話フィルタ状態を確認する   |

`/speak-this`でフィルタしてもそのセッションが終了されると自動的に解除されます。  
CC Mascotの設定画面からもフィルタの状態確認・解除が可能です。

また、これらのコマンド自体はCC Mascotが起動していなくても動作します。

## 開発者向け

### 全体的な仕組み

```
Claude Code                  Codex                         Gemini CLI                     Antigravity
    ↓ JSONLログ出力              ↓ JSONLログ出力                 ↓ JSONLログ出力                 ↓ JSONLログ出力
~/.claude/projects/**/*.jsonl  ~/.codex/sessions/**/*.jsonl  ~/.gemini/tmp/*/chats/*.jsonl  ~/.gemini/antigravity(/-cli)/brain/**/transcript.jsonl
    ↓ chokidar監視（HarnessAdapter経由で各形式に対応）
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
npm run dev
```

> [!NOTE]
> 配布しているバイナリに含まれるアニメーションファイル（`.vrma`）の一部はこのリポジトリには含まれていません。  
> プライベートなサブモジュールとして依存関係を設定していますが、アクセス権がない場合は限られたアニメーションのみで動作します。

### 技術スタック

- **Electron**: デスクトップアプリケーション
- **React + TypeScript + Vite**: フロントエンド
- **Three.js + @react-three/fiber**: 3Dレンダリング
- **@pixiv/three-vrm**: VRMサポート
- **Tailwind CSS**: スタイリング
- **chokidar**: ファイル監視
- **electron-updater**: 自動更新

### 参考

- https://github.com/pixiv/three-vrm
- https://aivis-project.com/
- https://voicevox.hiroshiba.jp/

## ライセンス

- [Apache License 2.0](LICENSE)

## 利用規約・プライバシーポリシー

- [利用規約](https://kazakago.github.io/cc-mascot/terms.html)
- [プライバシーポリシー](https://kazakago.github.io/cc-mascot/privacy.html)
