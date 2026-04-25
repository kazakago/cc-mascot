import { describe, it, expect } from "vitest";
import { parseCodexLog } from "./codexParser";

describe("parseCodexLog", () => {
  it("assistantのresponse_itemからoutput_textを抽出する", () => {
    const line = JSON.stringify({
      type: "response_item",
      payload: {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "こんにちは。Codexの返答です。" }],
      },
    });

    const result = parseCodexLog(line);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "speak",
      text: "こんにちは。Codexの返答です。",
    });
    expect(result[0].emotion).toBeDefined();
  });

  it("複数のテキストコンテンツを連結する", () => {
    const line = JSON.stringify({
      type: "response_item",
      payload: {
        type: "message",
        role: "assistant",
        content: [
          { type: "output_text", text: "最初。" },
          { type: "output_text", text: "続き。" },
        ],
      },
    });

    const result = parseCodexLog(line);

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("最初。続き。");
  });

  it("assistant以外のメッセージは無視する", () => {
    const line = JSON.stringify({
      type: "response_item",
      payload: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "ユーザー入力" }],
      },
    });

    expect(parseCodexLog(line)).toHaveLength(0);
  });

  it("ツール呼び出しなどmessage以外のresponse_itemは無視する", () => {
    const line = JSON.stringify({
      type: "response_item",
      payload: {
        type: "function_call",
        name: "exec_command",
      },
    });

    expect(parseCodexLog(line)).toHaveLength(0);
  });

  it("session_metaは無視する", () => {
    const line = JSON.stringify({
      type: "session_meta",
      payload: { id: "session-id" },
    });

    expect(parseCodexLog(line)).toHaveLength(0);
  });

  it("不正なJSONは空配列を返す", () => {
    expect(parseCodexLog("not-json")).toHaveLength(0);
  });
});
