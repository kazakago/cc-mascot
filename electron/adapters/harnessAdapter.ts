/**
 * ハーネスアダプターインターフェース
 * Claude Code、Codex、Gemini CLI など各種AIコーディングハーネスの
 * ログ監視・解析ロジックを抽象化する
 */

import type { ChokidarOptions } from "chokidar";

/** 読み上げメッセージ */
export interface SpeakMessage {
  type: "speak";
  text: string;
  emotion?: "neutral" | "happy" | "angry" | "sad" | "relaxed" | "surprised";
}

/**
 * ログファイルを扱うアダプター
 * 全てのアダプターは現在 JSONL 形式（追記型）を前提とし、
 * 差分読み取り（ファイル位置ベース）でログを処理する
 */
export interface HarnessAdapter {
  /**
   * 監視対象のディレクトリ・ファイルパスのリスト
   */
  getWatchPaths(): string[];

  /**
   * chokidar に渡すウォッチオプション
   */
  getWatchOptions(): ChokidarOptions;

  /**
   * ログの1行を解析してSpeakMessageの配列に変換する
   * @param line - ログファイルの1行
   * @param logFilePath - ログファイルのパス（文脈参照が必要な実装で使用）
   */
  parseLine(line: string, logFilePath?: string): SpeakMessage[];

  /**
   * 監視開始時に既存ファイルからアダプター固有の状態を復元する
   * @param filePath - 初期化対象のログファイルパス
   */
  initializeFile?(filePath: string): void;

  /**
   * セッションIDに基づいてファイルを処理すべきか判定する
   * @param filePath - 判定対象のファイルパス
   * @param activeSessionId - 現在アクティブなセッションID
   */
  shouldProcessFile(filePath: string, activeSessionId: string): boolean;
}
