/**
 * Claude Code ハーネスアダプター
 * ~/.claude/projects/**\/*.jsonl を監視し、Claude Code の JSONL ログ形式を解析する
 */

import * as os from "os";
import * as path from "path";
import type { HarnessAdapter, SpeakMessage } from "./harnessAdapter";
import { parseClaudeCodeLog } from "../parsers/claudeCodeParser";

export function createClaudeCodeAdapter(): HarnessAdapter {
  const claudeConfigDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
  const claudeProjectsDir = path.join(claudeConfigDir, "projects");

  return {
    mode: "jsonl" as const,

    getWatchPaths() {
      return [claudeProjectsDir];
    },

    getWatchOptions() {
      return {
        ignored: (filePath: string, stats?: { isFile(): boolean }) =>
          stats?.isFile() === true && !filePath.endsWith(".jsonl"),
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
        depth: 1,
      };
    },

    parseLine(line: string, logFilePath?: string): SpeakMessage[] {
      return parseClaudeCodeLog(line, logFilePath);
    },

    shouldProcessFile(filePath: string, activeSessionId: string): boolean {
      // ファイル名（拡張子なし）がセッションIDと一致する場合
      const basename = path.basename(filePath, ".jsonl");
      if (basename === activeSessionId) return true;

      // サブエージェント: 親ディレクトリ名がセッションIDと一致する場合
      const parentDir = path.basename(path.dirname(filePath));
      if (parentDir === activeSessionId) return true;

      return false;
    },
  };
}
