/**
 * Antigravity ハーネスアダプター
 * ~/.gemini/antigravity-cli/brain/ や ~/.gemini/antigravity/brain/ 配下の
 * transcript.jsonl を監視し、Antigravity の JSONL ログ形式を解析する
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { HarnessAdapter, SpeakMessage } from "./harnessAdapter";
import { parseAntigravityLogLine } from "../parsers/antigravityParser";

function getAntigravityBrainDirs(): string[] {
  const geminiBaseCli = process.env.ANTIGRAVITY_CLI_HOME
    ? path.join(process.env.ANTIGRAVITY_CLI_HOME, ".gemini")
    : path.join(os.homedir(), ".gemini");

  const geminiBaseApp = process.env.ANTIGRAVITY_HOME
    ? path.join(process.env.ANTIGRAVITY_HOME, ".gemini")
    : path.join(os.homedir(), ".gemini");

  return [path.join(geminiBaseCli, "antigravity-cli", "brain"), path.join(geminiBaseApp, "antigravity", "brain")];
}

// ファイルパス → 処理済み step_index のセット
const processedStepIndices = new Map<string, Set<number>>();

// 親エージェントが起動したサブエージェントの会話ID（発話対象外とするため動的に収集）
const ignoredSessionIds = new Set<string>();

export function createAntigravityAdapter(): HarnessAdapter {
  const brainDirs = getAntigravityBrainDirs();

  function getProcessedSteps(filePath: string): Set<number> {
    let steps = processedStepIndices.get(filePath);
    if (!steps) {
      steps = new Set();
      processedStepIndices.set(filePath, steps);
    }
    return steps;
  }

  return {
    getWatchPaths() {
      return brainDirs;
    },

    getWatchOptions() {
      return {
        // brain/<conversation-id>/.system_generated/logs/transcript.jsonl の構造なので depth=4
        depth: 4,
        ignored: (filePath: string, stats?: { isFile(): boolean }) =>
          stats?.isFile() === true && !filePath.endsWith("transcript.jsonl"),
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
      };
    },

    initializeFile(filePath: string): void {
      try {
        const content = fs.readFileSync(filePath, "utf8");
        const steps = getProcessedSteps(filePath);
        for (const line of content.split("\n")) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.step_index !== undefined) {
              steps.add(data.step_index);
            }
            // ログの初期化時にもサブエージェント起動情報を検出して無視リストに登録
            if (data.type === "INVOKE_SUBAGENT" && data.status === "DONE" && typeof data.content === "string") {
              const regex = /"conversationId":\s*"([^"]+)"/g;
              let match;
              while ((match = regex.exec(data.content)) !== null) {
                ignoredSessionIds.add(match[1]);
              }
            }
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
    },

    parseLine(line: string, logFilePath?: string): SpeakMessage[] {
      try {
        const data = JSON.parse(line);
        const stepIndex = data.step_index;
        const processedForFile = logFilePath ? getProcessedSteps(logFilePath) : undefined;

        // step_index がない場合や、既に処理済みの場合はスキップ
        if (stepIndex === undefined || processedForFile?.has(stepIndex)) {
          return [];
        }

        // 動的ブラックリストの検知：
        // INVOKE_SUBAGENT タイプのステップの場合、起動されたサブエージェントIDを抽出して無視リストに入れる
        if (data.type === "INVOKE_SUBAGENT" && data.status === "DONE" && typeof data.content === "string") {
          const regex = /"conversationId":\s*"([^"]+)"/g;
          let match;
          while ((match = regex.exec(data.content)) !== null) {
            ignoredSessionIds.add(match[1]);
            console.log(`[AntigravityAdapter] Subagent detected and blacklisted: ${match[1]}`);
          }
        }

        // ログファイルのパスから会話IDを抽出し、無視リストに入っているか確認
        if (logFilePath) {
          const parts = logFilePath.split(path.sep);
          const brainIndex = parts.indexOf("brain");
          if (brainIndex !== -1 && brainIndex + 1 < parts.length) {
            const conversationId = parts[brainIndex + 1];
            if (ignoredSessionIds.has(conversationId)) {
              // ログ位置は進めるため重複排除に登録だけして空配列を返す
              processedForFile?.add(stepIndex);
              return [];
            }
          }
        }

        const parsed = parseAntigravityLogLine(line);
        if (parsed.length > 0 && processedForFile) {
          processedForFile.add(stepIndex);
        }

        return parsed;
      } catch {
        return [];
      }
    },

    shouldProcessFile(filePath: string, activeSessionId: string): boolean {
      try {
        // パス例: .../brain/<conversation-id>/.system_generated/logs/transcript.jsonl
        const parts = filePath.split(path.sep);
        const brainIndex = parts.indexOf("brain");
        if (brainIndex !== -1 && brainIndex + 1 < parts.length) {
          const conversationId = parts[brainIndex + 1];
          // 無視リスト（サブエージェント）に入っている場合は処理しない
          if (ignoredSessionIds.has(conversationId)) {
            return false;
          }
          return conversationId === activeSessionId;
        }
      } catch {
        // ignore
      }
      return false;
    },
  };
}
