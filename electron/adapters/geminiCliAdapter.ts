/**
 * Gemini CLI ハーネスアダプター
 * ~/.gemini/tmp/<project_name>/chats/*.jsonl を監視し、Gemini CLI の JSONL ログ形式を解析する
 *
 * ログパス: ~/.gemini/tmp/<project_name>/chats/session-YYYY-MM-DDTHH-mm-<short_id>.jsonl
 *
 * GEMINI_CLI_HOME 環境変数が設定されている場合、$GEMINI_CLI_HOME/.gemini/tmp を使用する
 * （未設定時は ~/.gemini/tmp）
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { HarnessAdapter, SpeakMessage } from "./harnessAdapter";
import { parseGeminiLogLine } from "../parsers/geminiCliParser";

function getGeminiTmpDir(): string {
  const geminiBase = process.env.GEMINI_CLI_HOME
    ? path.join(process.env.GEMINI_CLI_HOME, ".gemini")
    : path.join(os.homedir(), ".gemini");
  return path.join(geminiBase, "tmp");
}

/**
 * Gemini CLI用のアダプター（JSONL形式）
 */
export function createGeminiCliAdapter(): HarnessAdapter {
  const geminiTmpDir = getGeminiTmpDir();

  // ファイルパス → 処理済みメッセージIDのセット（追記型でも更新があるためIDで重複排除が必要）
  const processedIds = new Map<string, Set<string>>();

  return {
    getWatchPaths() {
      return [geminiTmpDir];
    },

    getWatchOptions() {
      return {
        // <project_name>/chats/*.jsonl の構造なので depth=2
        depth: 2,
        ignored: (filePath: string, stats?: { isFile(): boolean }) =>
          stats?.isFile() === true && !filePath.endsWith(".jsonl"),
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
      };
    },

    parseLine(line: string, logFilePath?: string): SpeakMessage[] {
      try {
        const data = JSON.parse(line);
        const id = data.id;

        // メッセージではない行（メタデータなど）や、既に処理済みのIDはスキップ
        if (!id || (logFilePath && processedIds.get(logFilePath)?.has(id))) {
          return [];
        }

        const parsed = parseGeminiLogLine(line);
        if (parsed.length > 0 && logFilePath) {
          if (!processedIds.has(logFilePath)) {
            processedIds.set(logFilePath, new Set());
          }
          processedIds.get(logFilePath)!.add(id);
        }

        return parsed;
      } catch {
        return [];
      }
    },

    shouldProcessFile(filePath: string, activeSessionId: string): boolean {
      try {
        // ファイルの最初の数行から sessionId を探す（通常は1行目にある）
        const content = fs.readFileSync(filePath, "utf8");
        const lines = content.split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;
          const data = JSON.parse(line);
          if (data.sessionId) {
            return data.sessionId === activeSessionId;
          }
          // メッセージ行が先に来た場合は諦める
          break;
        }
      } catch {
        // ignore
      }
      return false;
    },
  };
}
