import { describe, it, expect } from "vitest";
import { parseAntigravityLogLine } from "./antigravityParser";

describe("parseAntigravityLogLine", () => {
  it("source=MODEL, type=PLANNER_RESPONSE で content がある場合に発話を抽出する", () => {
    const line = JSON.stringify({
      step_index: 7,
      source: "MODEL",
      type: "PLANNER_RESPONSE",
      status: "DONE",
      created_at: "2026-05-21T11:35:54Z",
      content: "こんにちは！何かお手伝いできるかしら？",
    });

    const result = parseAntigravityLogLine(line);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "speak",
      text: "こんにちは！何かお手伝いできるかしら？",
    });
    expect(result[0].emotion).toBeDefined();
  });

  it("tool_calls がある場合は content があっても無視する（ツール呼び出しフェーズ）", () => {
    const line = JSON.stringify({
      step_index: 2,
      source: "MODEL",
      type: "PLANNER_RESPONSE",
      status: "DONE",
      created_at: "2026-05-21T12:29:08Z",
      tool_calls: [{ name: "view_file", args: {} }],
      content: "ファイルを読み込みます",
    });

    const result = parseAntigravityLogLine(line);

    expect(result).toHaveLength(0);
  });

  it("source が MODEL 以外（USER_EXPLICIT など）の行は無視する", () => {
    const line = JSON.stringify({
      step_index: 0,
      source: "USER_EXPLICIT",
      type: "USER_INPUT",
      status: "DONE",
      created_at: "2026-05-21T11:35:37Z",
      content: "ls",
    });

    const result = parseAntigravityLogLine(line);

    expect(result).toHaveLength(0);
  });

  it("source=MODEL でも type が PLANNER_RESPONSE 以外の行（ツール結果など）は無視する", () => {
    const line = JSON.stringify({
      step_index: 3,
      source: "MODEL",
      type: "LIST_DIRECTORY",
      status: "DONE",
      created_at: "2026-05-21T11:35:39Z",
      content: "Created At: ...",
    });

    const result = parseAntigravityLogLine(line);

    expect(result).toHaveLength(0);
  });

  it("content が空の場合は無視する", () => {
    const line = JSON.stringify({
      step_index: 1,
      source: "MODEL",
      type: "PLANNER_RESPONSE",
      status: "DONE",
      created_at: "2026-05-21T12:29:08Z",
      content: "   ",
    });

    const result = parseAntigravityLogLine(line);

    expect(result).toHaveLength(0);
  });

  it("status が DONE 以外の行（例: RUNNING）は無視する", () => {
    const line = JSON.stringify({
      step_index: 7,
      source: "MODEL",
      type: "PLANNER_RESPONSE",
      status: "RUNNING",
      created_at: "2026-05-21T11:35:54Z",
      content: "考え中よ...",
    });

    const result = parseAntigravityLogLine(line);

    expect(result).toHaveLength(0);
  });

  it("不正な JSON は空配列を返す", () => {
    expect(parseAntigravityLogLine("not-a-json")).toHaveLength(0);
  });
});
