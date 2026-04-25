/**
 * Codex JSONL log parser.
 * Codex stores sessions under ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl.
 */

import { RuleBasedEmotionClassifier } from "../services/ruleBasedEmotionClassifier";
import type { SpeakMessage } from "../adapters/harnessAdapter";

const emotionClassifier = new RuleBasedEmotionClassifier();

interface CodexContentItem {
  type?: string;
  text?: string;
}

interface CodexResponseItemPayload {
  type?: string;
  role?: string;
  content?: CodexContentItem[] | string;
}

interface CodexLogEntry {
  type?: string;
  payload?: CodexResponseItemPayload;
}

function extractText(content: CodexResponseItemPayload["content"]): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";

  return content
    .filter((item) => item.type === "output_text" || item.type === "text")
    .map((item) => item.text ?? "")
    .join("")
    .trim();
}

/**
 * Parse one Codex JSONL line and extract assistant output text.
 */
export function parseCodexLog(line: string): SpeakMessage[] {
  try {
    const entry: CodexLogEntry = JSON.parse(line);
    const payload = entry.payload;

    if (entry.type !== "response_item") return [];
    if (payload?.type !== "message" || payload.role !== "assistant") return [];

    const text = extractText(payload.content);
    if (!text) return [];

    return [
      {
        type: "speak",
        text,
        emotion: emotionClassifier.classify(text),
      },
    ];
  } catch {
    return [];
  }
}
