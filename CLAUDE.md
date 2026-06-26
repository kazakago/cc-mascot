# CC Mascot - 技術ドキュメント

## プロジェクト概要

**AIコーディングエージェントを擬人化するためのVRMキャラクターシステム**

このアプリケーションは、AIコーディングエージェントの発言をリアルタイムで音声化し、3DのVRMキャラクターでビジュアル化するためのElectronアプリケーションです。

対応AIコーディングエージェント: **Claude Code** / **Codex** / **Gemini CLI** / **Antigravity**

### コンセプト

- **オフライン動作**: ローカル環境で完結、インターネット接続不要
- **日本語専用**: 日本語の音声合成とルールベース感情分析に最適化
- **プラグイン不要**: ログファイル監視による自動連携（Claude Codeはオプションでプラグイン連携も可能）
- **シンプルな構成**: Electron + React + Three.js + VRM

### 技術スタック

- Electron (デスクトップアプリ化)
- React + TypeScript + Vite (フロントエンド)
- Three.js + @react-three/fiber (3Dレンダリング)
- @pixiv/three-vrm (VRMモデル対応)
- Web Audio API (音声解析・リップシンク)
- AivisSpeech / VOICEVOX (日本語TTS)
- chokidar (ログファイル監視)

---

## アーキテクチャ概要

### プロセス構成とデータフロー

本アプリは Electron の Main プロセスと Renderer プロセスで構成されています。

1. **ログ監視・解析 (Main プロセス)**
   - `chokidar` で各AIエージェントのログディレクトリ（JSONL形式）を監視。
   - セッションフィルタリング（`active-session`ファイル）に基づき、特定セッションのみを発話対象に抽出。
   - `HarnessAdapter` を通じてログファイルの差分を読み取り、テキストを抽出。
   - フィルタリング（Markdown/HTMLタグ除去など）を施した上で、文単位に分割。
   - 文ごとにルールベースで感情（happy, angry, sad, surprised, relaxed, neutral）を判定し、Renderer へ `speak` イベントをIPC送信。

2. **描画・音声再生 (Renderer プロセス)**
   - AivisSpeech / VOICEVOX (localhost:8564) APIを叩いて音声を生成。
   - 音声キューで再生順序を保証しつつ、Web Audio API (`AnalyserNode`) で音量を解析してリップシンク値を計算。
   - VRMモデルにリップシンク（`aa` 表情）と判定された感情（表情・アニメーション）を適用して3D描画。

### 主要コンポーネント構成

- **ログ監視・パース**: `electron/logMonitor.ts`, `electron/adapters/`, `electron/parsers/`
- **音声・リップシンク**: `src/hooks/useSpeech.ts`, `src/hooks/useLipSync.ts`
- **VRM描画・制御**: `src/hooks/useVRM.ts`, `src/hooks/useVRMAnimation.ts`, `src/hooks/useCursorTracking.ts`
- **セッションフィルタ**: `electron/activeSessionMonitor.ts` （プラグイン `plugin/` を通じて `active-session` を制御）

---

## ディレクトリ構造

```
cc-mascot/
├── electron/          # Electronメインプロセス（ログ監視・解析・感情判定・IPC）
│   ├── adapters/      # HarnessAdapterインターフェース・各ハーネス実装
│   ├── parsers/       # ハーネスごとのログパーサー
│   ├── filters/       # テキストフィルタリング
│   └── services/      # 感情分類器など共通サービス
├── src/               # Electronレンダラープロセス（React + Three.js + VRM）
├── public/            # 静的アセット（VRMモデル・VRMAアニメーション）
├── plugin/            # Claude Codeプラグイン（セッションフィルタリング用）
├── docs/              # GitHub Pages LP
└── package.json
```

---

## 開発環境のセットアップとコマンド

### セットアップ

```bash
# 依存関係のインストール
npm install
```

### 開発コマンド

```bash
# 開発モード起動
npm run dev

# ビルド
npm run build

# Lint実行
npm run lint

# フォーマット実行
npm run format

# テスト実行
npm run test:run
```

---

## タスク完了時のチェックリスト

コード編集作業完了時は、以下を実行して品質を確認すること。

- [ ] **テスト追加の検討** - 変更した箇所に関連するテストが必要か考える
- [ ] **ドキュメント更新の検討** - README.md, CLAUDE.md に追記・編集するものがないか検討し、あればユーザーに提案する
- [ ] `npm run lint` - エラーがないこと
- [ ] `npm run build` - 型エラーがなくビルドが通ること
- [ ] `npm run format` - コードフォーマットが適用されていること
- [ ] `npm run test:run` - 全てのテストが正常に通過すること
