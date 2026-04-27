/**
 * Gemini CLI JSONLログパーサー
 * Gemini CLIのセッションログを解析し、アシスタントメッセージを抽出する
 *
 * 実際のログフォーマット（~/.gemini/tmp/<project_name>/chats/session-*.jsonl）:
 * {"sessionId": "...", "startTime": "...", ...}
 * {"id": "...", "type": "user", "content": [{"text": "..."}]}
 * {"id": "...", "type": "gemini", "content": "応答テキスト文字列", "thoughts": [...], ...}
 */

import { RuleBasedEmotionClassifier } from "../services/ruleBasedEmotionClassifier";
import type { SpeakMessage } from "../adapters/harnessAdapter";

const emotionClassifier = new RuleBasedEmotionClassifier();

interface GeminiMessage {
  id?: string;
  type: string;
  content?: string | Array<{ text?: string }>;
  thoughts?: unknown[];
  toolCalls?: unknown[];
}

/**
 * Gemini CLIのメッセージオブジェクトからテキストを抽出する
 * @param message - messages 配列の1要素
 * @returns SpeakMessageの配列
 */
export function parseGeminiMessage(message: GeminiMessage): SpeakMessage[] {
  if (message.type !== "gemini") return [];

  const content = message.content;
  let text = "";

  if (typeof content === "string") {
    // type === "gemini" の場合、content は文字列
    text = content.trim();
  } else if (Array.isArray(content)) {
    // 将来的な形式変更に備えて配列にも対応
    text = content
      .map((item) => item.text ?? "")
      .join("")
      .trim();
  }

  if (!text) return [];

  const emotion = emotionClassifier.classify(text);
  return [{ type: "speak", text, emotion }];
}

/**
 * Gemini CLIのJSONLログ行を解析してアシスタントメッセージを抽出する
 * @param line - JSONLログファイルの1行
 * @returns SpeakMessage의 配列
 */
export function parseGeminiLogLine(line: string): SpeakMessage[] {
  try {
    const data: GeminiMessage = JSON.parse(line);
    // メタデータ行などは無視
    if (!data.id || data.type !== "gemini") return [];
    return parseGeminiMessage(data);
  } catch {
    return [];
  }
}
