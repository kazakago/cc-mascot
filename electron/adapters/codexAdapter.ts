/**
 * Codex harness adapter.
 * Watches ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl and parses Codex JSONL logs.
 */

import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import type { HarnessAdapter, SpeakMessage } from "./harnessAdapter";
import { parseCodexLog } from "../parsers/codexParser";

export function createCodexAdapter(): HarnessAdapter {
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
  const codexSessionsDir = path.join(codexHome, "sessions");
  const subagentLogFiles = new Map<string, boolean>();

  function isSubagentLogFile(filePath: string): boolean {
    const cached = subagentLogFiles.get(filePath);
    if (cached !== undefined) return cached;

    try {
      const fd = fs.openSync(filePath, "r");
      try {
        const buffer = Buffer.alloc(8192);
        const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
        const firstChunk = buffer.subarray(0, bytesRead).toString("utf8");
        const isSubagent = /"source"\s*:\s*\{\s*"subagent"\s*:/.test(firstChunk);
        subagentLogFiles.set(filePath, isSubagent);
        return isSubagent;
      } finally {
        fs.closeSync(fd);
      }
    } catch {
      subagentLogFiles.set(filePath, false);
      return false;
    }
  }

  return {
    getWatchPaths() {
      return [codexSessionsDir];
    },

    getWatchOptions() {
      return {
        ignored: (filePath: string, stats?: { isFile(): boolean }) =>
          stats?.isFile() === true && !filePath.endsWith(".jsonl"),
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
        depth: 4,
      };
    },

    parseLine(line: string, logFilePath?: string): SpeakMessage[] {
      if (logFilePath && isSubagentLogFile(logFilePath)) return [];
      return parseCodexLog(line);
    },

    shouldProcessFile(filePath: string, activeSessionId: string): boolean {
      const basename = path.basename(filePath, ".jsonl");
      return basename === activeSessionId || basename.endsWith(`-${activeSessionId}`);
    },
  };
}
