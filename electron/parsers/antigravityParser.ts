/**
 * Antigravity JSONLログパーサー
 * Antigravity (CLI & 2.0) のセッションログ（transcript.jsonl）を解析し、アシスタントメッセージを抽出する
 */

import { RuleBasedEmotionClassifier } from "../services/ruleBasedEmotionClassifier";
import type { SpeakMessage } from "../adapters/harnessAdapter";

const emotionClassifier = new RuleBasedEmotionClassifier();

interface AntigravityMessage {
  step_index?: number;
  source?: string;
  type?: string;
  status?: string;
  content?: string;
  tool_calls?: unknown[];
}

/**
 * AntigravityのJSONLログ行を解析してアシスタントメッセージを抽出する
 * @param line - JSONLログファイルの1行
 * @returns SpeakMessageの配列
 */
export function parseAntigravityLogLine(line: string): SpeakMessage[] {
  try {
    const data: AntigravityMessage = JSON.parse(line);

    // 発話抽出条件:
    // 1. source が MODEL であること
    // 2. type が PLANNER_RESPONSE であること
    // 3. content が存在し、トリムした長さが 0 より大きいこと
    // 4. tool_calls が存在しない、または空配列であること
    if (
      data.source === "MODEL" &&
      data.type === "PLANNER_RESPONSE" &&
      data.status === "DONE" &&
      typeof data.content === "string" &&
      data.content.trim().length > 0 &&
      (!data.tool_calls || data.tool_calls.length === 0)
    ) {
      const text = data.content.trim();
      const emotion = emotionClassifier.classify(text);
      return [{ type: "speak", text, emotion }];
    }

    return [];
  } catch {
    return [];
  }
}
