/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fsMod from "fs";

vi.mock("fs", () => ({
  readFileSync: vi.fn(),
}));

import { createGeminiCliAdapter } from "./geminiCliAdapter";

describe("createGeminiCliAdapter", () => {
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

  it("json以外のファイルを除外する", () => {
    const adapter = createGeminiCliAdapter();
    const ignored = adapter.getWatchOptions().ignored as (filePath: string, stats?: { isFile(): boolean }) => boolean;

    expect(ignored("/tmp/session.json", { isFile: () => true })).toBe(false);
    expect(ignored("/tmp/session.jsonl", { isFile: () => true })).toBe(true);
    expect(ignored("/tmp/chats", { isFile: () => false })).toBe(false);
  });

  it("parseFileで未処理のGeminiメッセージだけを返す", () => {
    const adapter = createGeminiCliAdapter();
    const filePath = "/tmp/.gemini/tmp/project/chats/session.json";

    (fsMod.readFileSync as any).mockReturnValue(
      JSON.stringify({
        sessionId: "session-123",
        messages: [
          { id: "user-1", type: "user", content: [{ text: "質問" }] },
          { id: "gemini-1", type: "gemini", content: "最初の回答です。" },
          { id: "gemini-2", type: "gemini", content: "次の回答です。" },
        ],
      }),
    );

    const first = adapter.parseFile(filePath);
    const second = adapter.parseFile(filePath);

    expect(first.map((message) => message.text)).toEqual(["最初の回答です。", "次の回答です。"]);
    expect(second).toEqual([]);
  });

  it("同じメッセージIDでも別ファイルなら処理対象にする", () => {
    const adapter = createGeminiCliAdapter();

    (fsMod.readFileSync as any).mockReturnValue(
      JSON.stringify({
        sessionId: "session-123",
        messages: [{ id: "gemini-1", type: "gemini", content: "回答です。" }],
      }),
    );

    expect(adapter.parseFile("/tmp/project-a/chats/session.json")).toHaveLength(1);
    expect(adapter.parseFile("/tmp/project-b/chats/session.json")).toHaveLength(1);
  });

  it("IDがないメッセージはスキップする", () => {
    const adapter = createGeminiCliAdapter();

    (fsMod.readFileSync as any).mockReturnValue(
      JSON.stringify({
        sessionId: "session-123",
        messages: [{ type: "gemini", content: "IDなしの回答です。" }],
      }),
    );

    expect(adapter.parseFile("/tmp/session.json")).toEqual([]);
  });

  it("セッションIDでフィルタ判定する", () => {
    const adapter = createGeminiCliAdapter();

    (fsMod.readFileSync as any).mockReturnValue(
      JSON.stringify({
        sessionId: "session-123",
        messages: [],
      }),
    );

    expect(adapter.shouldProcessFile("/tmp/session.json", "session-123")).toBe(true);
    expect(adapter.shouldProcessFile("/tmp/session.json", "other-session")).toBe(false);
  });

  it("セッションファイルを読めない場合は空配列とfalseを返す", () => {
    const adapter = createGeminiCliAdapter();

    (fsMod.readFileSync as any).mockImplementation(() => {
      throw new Error("File not found");
    });

    expect(adapter.parseFile("/tmp/missing.json")).toEqual([]);
    expect(adapter.shouldProcessFile("/tmp/missing.json", "session-123")).toBe(false);
  });
});
