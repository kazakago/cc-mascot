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

interface BaseHarnessAdapter {
  /**
   * 監視対象のディレクトリ・ファイルパスのリスト
   */
  getWatchPaths(): string[];

  /**
   * chokidar に渡すウォッチオプション
   */
  getWatchOptions(): WatchOptions;

  /**
   * セッションIDに基づいてファイルを処理すべきか判定する
   * @param filePath - 判定対象のファイルパス
   * @param activeSessionId - 現在アクティブなセッションID
   */
  shouldProcessFile(filePath: string, activeSessionId: string): boolean;
}

/**
 * JSONL形式（追記型）のログファイルを扱うアダプター
 * 差分読み取り（ファイル位置ベース）でログを処理する
 */
export interface JsonlHarnessAdapter extends BaseHarnessAdapter {
  mode: "jsonl";

  /**
   * ログの1行を解析してSpeakMessageの配列に変換する
   * @param line - ログファイルの1行
   * @param logFilePath - ログファイルのパス（文脈参照が必要な実装で使用）
   */
  parseLine(line: string, logFilePath?: string): SpeakMessage[];
}

/**
 * JSON形式（全体書き換え型）のログファイルを扱うアダプター
 * ファイル全体を読み取り、メッセージIDで重複排除してログを処理する
 */
export interface JsonHarnessAdapter extends BaseHarnessAdapter {
  mode: "json";

  /**
   * ファイル全体を読み取り、未処理のメッセージのみ返す
   * アダプター内部でメッセージIDを追跡し重複排除する
   * @param filePath - ログファイルのパス
   */
  parseFile(filePath: string): SpeakMessage[];
}

export type HarnessAdapter = JsonlHarnessAdapter | JsonHarnessAdapter;
