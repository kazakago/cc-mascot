/**
 * Gemini CLI ハーネスアダプター
 * ~/.gemini/tmp/<project_name>/chats/*.json を監視し、Gemini CLI の JSON ログ形式を解析する
 *
 * ログパス: ~/.gemini/tmp/<project_name>/chats/session-YYYY-MM-DDTHH-mm-<short_id>.json
 * ファイル全体が更新のたびに書き換えられる形式のため、メッセージIDで重複排除する
 *
 * GEMINI_CLI_HOME 環境変数が設定されている場合、$GEMINI_CLI_HOME/.gemini/tmp を使用する
 * （未設定時は ~/.gemini/tmp）
 */

import * as os from "os";
import * as path from "path";
import type { JsonHarnessAdapter, SpeakMessage } from "./harnessAdapter";
import { parseGeminiMessage, parseGeminiSessionFile } from "../parsers/geminiCliParser";

export function createGeminiCliAdapter(): JsonHarnessAdapter {
  const geminiBase = process.env.GEMINI_CLI_HOME
    ? path.join(process.env.GEMINI_CLI_HOME, ".gemini")
    : path.join(os.homedir(), ".gemini");
  const geminiTmpDir = path.join(geminiBase, "tmp");

  // ファイルパス → 処理済みメッセージIDのセット
  const processedIds = new Map<string, Set<string>>();

  return {
    mode: "json",

    getWatchPaths() {
      return [geminiTmpDir];
    },

    getWatchOptions() {
      return {
        // <project_name>/chats/*.json の構造なので depth=2
        depth: 2,
        ignored: (filePath: string, stats?: { isFile(): boolean }) =>
          stats?.isFile() === true && !filePath.endsWith(".json"),
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
      };
    },

    parseFile(filePath: string): SpeakMessage[] {
      const result = parseGeminiSessionFile(filePath);
      if (!result) return [];

      if (!processedIds.has(filePath)) {
        processedIds.set(filePath, new Set());
      }
      const seen = processedIds.get(filePath)!;

      const newMessages: SpeakMessage[] = [];

      for (const message of result.messages) {
        const id = message.id;
        if (!id || seen.has(id)) continue;
        seen.add(id);

        const parsed = parseGeminiMessage(message);
        newMessages.push(...parsed);
      }

      return newMessages;
    },

    shouldProcessFile(filePath: string, activeSessionId: string): boolean {
      // ファイルを読み込んでセッションIDと照合する
      // 読み込みコストを避けるため、processedIds に登録済みであればキャッシュから判定
      // （parseFile を一度でも呼ぶと内部状態が構築される）
      const result = parseGeminiSessionFile(filePath);
      if (!result?.sessionId) return false;
      return result.sessionId === activeSessionId;
    },
  };
}
