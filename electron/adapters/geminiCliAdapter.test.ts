/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fsMod from "fs";

vi.mock("fs", () => ({
  readFileSync: vi.fn(),
}));

import { createGeminiCliAdapter } from "./geminiCliAdapter";

describe("createGeminiCliAdapter (JSONL)", () => {
  const originalGeminiCliHome = process.env.GEMINI_CLI_HOME;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalGeminiCliHome === undefined) {
      delete process.env.GEMINI_CLI_HOME;
    } else {
      process.env.GEMINI_CLI_HOME = originalGeminiCliHome;
    }
  });

  it("GEMINI_CLI_HOME配下の.gemini/tmpを監視する", () => {
    process.env.GEMINI_CLI_HOME = "/tmp/custom-gemini-home";

    const adapter = createGeminiCliAdapter();

    expect(adapter.getWatchPaths()).toEqual(["/tmp/custom-gemini-home/.gemini/tmp"]);
    expect(adapter.getWatchOptions()).toMatchObject({
      depth: 2,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    });
  });

  it("jsonl以外のファイルを除外する", () => {
    const adapter = createGeminiCliAdapter();
    const ignored = adapter.getWatchOptions().ignored as (filePath: string, stats?: { isFile(): boolean }) => boolean;

    expect(ignored("/tmp/session.jsonl", { isFile: () => true })).toBe(false);
    expect(ignored("/tmp/session.json", { isFile: () => true })).toBe(true);
    expect(ignored("/tmp/chats", { isFile: () => false })).toBe(false);
  });

  it("parseLineで未処理のGeminiメッセージだけを返す", () => {
    const adapter = createGeminiCliAdapter();
    const filePath = "/tmp/session.jsonl";

    const line1 = JSON.stringify({ id: "gemini-1", type: "gemini", content: "最初の回答です。" });
    const line2 = JSON.stringify({ id: "gemini-2", type: "gemini", content: "次の回答です。" });

    const first = adapter.parseLine(line1, filePath);
    const second = adapter.parseLine(line1, filePath); // 同じID
    const third = adapter.parseLine(line2, filePath);

    expect(first.map((m) => m.text)).toEqual(["最初の回答です。"]);
    expect(second).toEqual([]);
    expect(third.map((m) => m.text)).toEqual(["次の回答です。"]);
  });

  it("空メッセージではIDを消費しない", () => {
    const adapter = createGeminiCliAdapter();
    const filePath = "/tmp/session.jsonl";

    const lineEmpty = JSON.stringify({ id: "gemini-1", type: "gemini", content: "", thoughts: [{}] });
    const lineFull = JSON.stringify({ id: "gemini-1", type: "gemini", content: "本番の回答です。" });

    const first = adapter.parseLine(lineEmpty, filePath);
    const second = adapter.parseLine(lineFull, filePath); // 同じIDだが、前回が空だったので処理されるべき

    expect(first).toEqual([]);
    expect(second.map((m) => m.text)).toEqual(["本番の回答です。"]);
  });

  it("既存ログから処理済みIDを復元する", () => {
    const adapter = createGeminiCliAdapter();
    const filePath = "/tmp/session.jsonl";
    const initialLine = JSON.stringify({ id: "gemini-1", type: "gemini", content: "回答です。" });
    const updatedLine = JSON.stringify({
      id: "gemini-1",
      type: "gemini",
      content: "回答です。",
      toolCalls: [{ name: "activate_skill", args: { name: "merge-pr" } }],
    });

    (fsMod.readFileSync as any).mockReturnValue(
      [
        JSON.stringify({ sessionId: "session-123" }),
        JSON.stringify({ id: "user-1", type: "user", content: [{ text: "hi" }] }),
        initialLine,
      ].join("\n"),
    );

    adapter.initializeFile?.(filePath);

    expect(adapter.parseLine(updatedLine, filePath)).toEqual([]);
  });

  it("既存ログ内の空メッセージではIDを消費しない", () => {
    const adapter = createGeminiCliAdapter();
    const filePath = "/tmp/session.jsonl";
    const lineEmpty = JSON.stringify({ id: "gemini-1", type: "gemini", content: "", thoughts: [{}] });
    const lineFull = JSON.stringify({ id: "gemini-1", type: "gemini", content: "本番の回答です。" });

    (fsMod.readFileSync as any).mockReturnValue(lineEmpty);

    adapter.initializeFile?.(filePath);

    expect(adapter.parseLine(lineFull, filePath).map((m) => m.text)).toEqual(["本番の回答です。"]);
  });

  it("セッションIDでフィルタ判定する", () => {
    const adapter = createGeminiCliAdapter();
    const filePath = "/tmp/session.jsonl";

    (fsMod.readFileSync as any).mockReturnValue(
      JSON.stringify({ sessionId: "session-123" }) +
        "\n" +
        JSON.stringify({ id: "user-1", type: "user", content: [{ text: "hi" }] }),
    );

    expect(adapter.shouldProcessFile(filePath, "session-123")).toBe(true);
    expect(adapter.shouldProcessFile(filePath, "other-session")).toBe(false);
  });
});
