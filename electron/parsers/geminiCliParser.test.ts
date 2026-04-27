/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";

import { parseGeminiLogLine, parseGeminiMessage } from "./geminiCliParser";

describe("parseGeminiMessage", () => {
  describe("アシスタント応答の抽出", () => {
    it("type=geminiで content が文字列の場合にテキストを抽出する", () => {
      const result = parseGeminiMessage({
        id: "msg2",
        type: "gemini",
        content: "こんにちは！何かお手伝いできますか？",
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: "speak",
        text: "こんにちは！何かお手伝いできますか？",
      });
      expect(result[0].emotion).toBeDefined();
    });

    it("content が配列形式でも抽出できる（将来の形式変更への対応）", () => {
      const result = parseGeminiMessage({
        id: "msg3",
        type: "gemini",
        content: [{ text: "配列形式のテキスト。" }, { text: "続き。" }],
      });

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("配列形式のテキスト。続き。");
    });

    it("空白のみの content は空配列を返す", () => {
      const result = parseGeminiMessage({
        id: "msg4",
        type: "gemini",
        content: "   ",
      });

      expect(result).toHaveLength(0);
    });

    it("content が undefined の場合は空配列を返す", () => {
      const result = parseGeminiMessage({
        id: "msg5",
        type: "gemini",
      });

      expect(result).toHaveLength(0);
    });
  });

  describe("アシスタント以外のメッセージは無視する", () => {
    it("type=userは無視する", () => {
      const result = parseGeminiMessage({
        id: "msg1",
        type: "user",
        content: [{ text: "ユーザーの入力" }],
      });

      expect(result).toHaveLength(0);
    });

    it("type=message_updateは無視する", () => {
      const result = parseGeminiMessage({
        id: "msg2",
        type: "message_update",
      });

      expect(result).toHaveLength(0);
    });
  });
});

describe("parseGeminiLogLine", () => {
  it("JSONLのgemini行からテキストを抽出する", () => {
    const line = JSON.stringify({
      id: "msg2",
      timestamp: "2026-04-26T23:40:11.674Z",
      type: "gemini",
      content: "回答テキスト",
      thoughts: [{ subject: "Thinking" }],
    });

    const result = parseGeminiLogLine(line);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "speak",
      text: "回答テキスト",
    });
  });

  it("sessionIdを含むメタデータ行は無視する", () => {
    const line = JSON.stringify({
      sessionId: "ses_abc123",
      projectHash: "project-hash",
      kind: "main",
    });

    expect(parseGeminiLogLine(line)).toEqual([]);
  });

  it("$set更新行は無視する", () => {
    const line = JSON.stringify({
      $set: { lastUpdated: "2026-04-26T23:40:11.674Z" },
    });

    expect(parseGeminiLogLine(line)).toEqual([]);
  });

  it("user行は無視する", () => {
    const line = JSON.stringify({
      id: "msg1",
      type: "user",
      content: [{ text: "質問" }],
    });

    expect(parseGeminiLogLine(line)).toEqual([]);
  });

  it("不正なJSONは空配列を返す", () => {
    expect(parseGeminiLogLine("not-json")).toEqual([]);
  });
});
