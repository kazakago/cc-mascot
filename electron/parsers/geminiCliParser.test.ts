/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import * as fsMod from "fs";

vi.mock("fs", () => ({
  readFileSync: vi.fn(),
}));

import { parseGeminiMessage, parseGeminiSessionFile } from "./geminiCliParser";

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

describe("parseGeminiSessionFile", () => {
  it("正常なセッションJSONからsessionIdとmessagesを取得する", () => {
    (fsMod.readFileSync as any).mockReturnValue(
      JSON.stringify({
        sessionId: "ses_abc123",
        messages: [
          { id: "m1", type: "user", content: [{ text: "質問" }] },
          { id: "m2", type: "gemini", content: "回答テキスト" },
        ],
      }),
    );

    const result = parseGeminiSessionFile("/fake/path/session.json");

    expect(result).not.toBeNull();
    expect(result?.sessionId).toBe("ses_abc123");
    expect(result?.messages).toHaveLength(2);
  });

  it("ファイル読み込みエラーの場合は null を返す", () => {
    (fsMod.readFileSync as any).mockImplementation(() => {
      throw new Error("File not found");
    });

    const result = parseGeminiSessionFile("/nonexistent/path.json");
    expect(result).toBeNull();
  });

  it("不正な JSON の場合は null を返す", () => {
    (fsMod.readFileSync as any).mockReturnValue("not-json");

    const result = parseGeminiSessionFile("/fake/path.json");
    expect(result).toBeNull();
  });

  it("messagesフィールドがない場合は空配列を返す", () => {
    (fsMod.readFileSync as any).mockReturnValue(JSON.stringify({ sessionId: "ses_xyz" }));

    const result = parseGeminiSessionFile("/fake/path.json");
    expect(result?.messages).toEqual([]);
  });

  it("sessionIdフィールドがない場合は null を返す", () => {
    (fsMod.readFileSync as any).mockReturnValue(JSON.stringify({ messages: [] }));

    const result = parseGeminiSessionFile("/fake/path.json");
    expect(result?.sessionId).toBeNull();
  });
});
