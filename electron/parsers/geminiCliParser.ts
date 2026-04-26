/**
 * Gemini CLI JSONログパーサー
 * Gemini CLIのセッションログを解析し、アシスタントメッセージを抽出する
 *
 * 実際のログフォーマット（~/.gemini/tmp/<project_name>/chats/session-*.json）:
 * {
 *   "sessionId": "...",
 *   "projectHash": "...",
 *   "startTime": "...",
 *   "lastUpdated": "...",
 *   "messages": [
 *     {"id": "...", "type": "user", "content": [{"text": "..."}]},
 *     {"id": "...", "type": "gemini", "content": "応答テキスト文字列", ...},
 *     ...
 *   ]
 * }
 *
 * 注意: type === "gemini" の content は文字列（string）であり、配列ではない
 */

import * as fs from "fs";
import { RuleBasedEmotionClassifier } from "../services/ruleBasedEmotionClassifier";
import type { SpeakMessage } from "../adapters/harnessAdapter";

const emotionClassifier = new RuleBasedEmotionClassifier();

interface GeminiMessage {
  id?: string;
  type: string;
  content?: string | Array<{ text?: string }>;
}

interface GeminiSessionFile {
  sessionId?: string;
  messages?: GeminiMessage[];
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
    // 将来的な形式変更（JSONL移行後）に備えて配列にも対応
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
 * Gemini CLIのセッションJSONファイルを解析してセッションIDとメッセージを取得する
 * @param filePath - セッションJSONファイルのパス
 * @returns { sessionId, messages } またはパース失敗時は null
 */
export function parseGeminiSessionFile(
  filePath: string,
): { sessionId: string | null; messages: GeminiMessage[] } | null {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data: GeminiSessionFile = JSON.parse(raw);
    return {
      sessionId: data.sessionId ?? null,
      messages: Array.isArray(data.messages) ? data.messages : [],
    };
  } catch {
    return null;
  }
}
