/**
 * ハーネスアダプターインターフェース
 * Claude Code、Codex、Gemini CLI など各種AIコーディングハーネスの
 * ログ監視・解析ロジックを抽象化する
 */

import type { WatchOptions } from "chokidar";

/** 読み上げメッセージ */
export interface SpeakMessage {
  type: "speak";
  text: string;
  emotion?: "neutral" | "happy" | "angry" | "sad" | "relaxed" | "surprised";
}

export interface HarnessAdapter {
  /**
   * 監視対象のディレクトリ・ファイルパスのリスト
   */
  getWatchPaths(): string[];

  /**
   * chokidar に渡すウォッチオプション
   */
  getWatchOptions(): WatchOptions;

  /**
   * ログの1行を解析してSpeakMessageの配列に変換する
   * @param line - ログファイルの1行
   * @param logFilePath - ログファイルのパス（文脈参照が必要な実装で使用）
   */
  parseLine(line: string, logFilePath?: string): SpeakMessage[];

  /**
   * セッションIDに基づいてファイルを処理すべきか判定する
   * @param filePath - 判定対象のファイルパス
   * @param activeSessionId - 現在アクティブなセッションID
   */
  shouldProcessFile(filePath: string, activeSessionId: string): boolean;
}
