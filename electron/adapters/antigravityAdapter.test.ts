/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fsMod from "fs";
import * as path from "path";

vi.mock("fs", () => ({
  readFileSync: vi.fn(),
}));

import { createAntigravityAdapter } from "./antigravityAdapter";

describe("createAntigravityAdapter", () => {
  const originalAntigravityCliHome = process.env.ANTIGRAVITY_CLI_HOME;
  const originalAntigravityHome = process.env.ANTIGRAVITY_HOME;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalAntigravityCliHome === undefined) {
      delete process.env.ANTIGRAVITY_CLI_HOME;
    } else {
      process.env.ANTIGRAVITY_CLI_HOME = originalAntigravityCliHome;
    }

    if (originalAntigravityHome === undefined) {
      delete process.env.ANTIGRAVITY_HOME;
    } else {
      process.env.ANTIGRAVITY_HOME = originalAntigravityHome;
    }
  });

  it("ANTIGRAVITY_CLI_HOMEおよびANTIGRAVITY_HOME配下のbrainディレクトリを監視する", () => {
    process.env.ANTIGRAVITY_CLI_HOME = "/tmp/custom-cli";
    process.env.ANTIGRAVITY_HOME = "/tmp/custom-app";

    const adapter = createAntigravityAdapter();

    expect(adapter.getWatchPaths()).toEqual([
      "/tmp/custom-cli/.gemini/antigravity-cli/brain",
      "/tmp/custom-app/.gemini/antigravity/brain",
    ]);
    expect(adapter.getWatchOptions()).toMatchObject({
      depth: 4,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    });
  });

  it("transcript.jsonl以外のファイルを除外する", () => {
    const adapter = createAntigravityAdapter();
    const ignored = adapter.getWatchOptions().ignored as (filePath: string, stats?: { isFile(): boolean }) => boolean;

    expect(ignored("/tmp/brain/ses/logs/transcript.jsonl", { isFile: () => true })).toBe(false);
    expect(ignored("/tmp/brain/ses/logs/transcript.json", { isFile: () => true })).toBe(true);
    expect(ignored("/tmp/brain/ses/logs", { isFile: () => false })).toBe(false);
  });

  it("parseLineで未処理の step_index だけを返す", () => {
    const adapter = createAntigravityAdapter();
    const filePath = "/tmp/brain/ses/logs/transcript.jsonl";

    const line1 = JSON.stringify({
      step_index: 1,
      source: "MODEL",
      type: "PLANNER_RESPONSE",
      status: "DONE",
      content: "最初の回答よ。",
    });
    const line2 = JSON.stringify({
      step_index: 2,
      source: "MODEL",
      type: "PLANNER_RESPONSE",
      status: "DONE",
      content: "次の回答よ。",
    });

    const first = adapter.parseLine(line1, filePath);
    const second = adapter.parseLine(line1, filePath); // 同じ step_index
    const third = adapter.parseLine(line2, filePath);

    expect(first.map((m) => m.text)).toEqual(["最初の回答よ。"]);
    expect(second).toEqual([]);
    expect(third.map((m) => m.text)).toEqual(["次の回答よ。"]);
  });

  it("既存ログから処理済み step_index を復元する", () => {
    const adapter = createAntigravityAdapter();
    const filePath = "/tmp/brain/ses/logs/transcript.jsonl";

    (fsMod.readFileSync as any).mockReturnValue(
      [
        JSON.stringify({ step_index: 1, source: "USER_EXPLICIT", type: "USER_INPUT", status: "DONE", content: "hi" }),
        JSON.stringify({ step_index: 2, source: "MODEL", type: "PLANNER_RESPONSE", status: "DONE", content: "回答よ。" }),
      ].join("\n"),
    );

    adapter.initializeFile?.(filePath);

    // すでに initializeFile で復元された step_index 2 は parseLine で無視される
    const line = JSON.stringify({ step_index: 2, source: "MODEL", type: "PLANNER_RESPONSE", status: "DONE", content: "回答よ。" });
    expect(adapter.parseLine(line, filePath)).toEqual([]);
  });

  it("shouldProcessFileでファイルパスから会話IDを抽出して判定する", () => {
    const adapter = createAntigravityAdapter();

    // パス区切り文字による問題を避けるために path.join を使用
    const matchedPath = path.join("/Users/kensuke/.gemini/antigravity-cli/brain", "session-123", ".system_generated/logs/transcript.jsonl");
    const unmatchedPath = path.join("/Users/kensuke/.gemini/antigravity-cli/brain", "session-456", ".system_generated/logs/transcript.jsonl");

    expect(adapter.shouldProcessFile(matchedPath, "session-123")).toBe(true);
    expect(adapter.shouldProcessFile(unmatchedPath, "session-123")).toBe(false);
  });

  it("INVOKE_SUBAGENT を検出して、該当サブエージェントのログを無視（スキップ）する", () => {
    const adapter = createAntigravityAdapter();
    const mainLogPath = "/tmp/brain/main-session/logs/transcript.jsonl";
    const subLogPath = "/tmp/brain/sub-session-999/logs/transcript.jsonl";

    // 1. メインログで INVOKE_SUBAGENT を検出させる
    const invokeLine = JSON.stringify({
      step_index: 10,
      source: "MODEL",
      type: "INVOKE_SUBAGENT",
      status: "DONE",
      content: 'Created the following subagents:\n{\n  "conversationId": "sub-session-999",\n  "logAbsoluteUri": "..."\n}',
    });
    adapter.parseLine(invokeLine, mainLogPath);

    // 2. その後、サブセッションからの発話をパースしようとすると無視されること
    const subLine = JSON.stringify({
      step_index: 0,
      source: "MODEL",
      type: "PLANNER_RESPONSE",
      status: "DONE",
      content: "サブエージェントの返答よ。",
    });
    const result = adapter.parseLine(subLine, subLogPath);
    expect(result).toEqual([]);

    // 3. shouldProcessFile でも ignoredSessionIds に含まれるセッションIDは false を返すこと
    expect(adapter.shouldProcessFile(subLogPath, "sub-session-999")).toBe(false);
  });

  it("status が DONE 以外の INVOKE_SUBAGENT 行はブラックリスト登録しない", () => {
    const adapter = createAntigravityAdapter();
    const mainLogPath = "/tmp/brain/main-session/logs/transcript.jsonl";
    const subLogPath = "/tmp/brain/sub-session-888/logs/transcript.jsonl";

    // RUNNING状態の INVOKE_SUBAGENT はブラックリスト登録されないはず
    const invokeLine = JSON.stringify({
      step_index: 10,
      source: "MODEL",
      type: "INVOKE_SUBAGENT",
      status: "RUNNING",
      content: 'Created the following subagents:\n{\n  "conversationId": "sub-session-888",\n  "logAbsoluteUri": "..."\n}',
    });
    adapter.parseLine(invokeLine, mainLogPath);

    // サブセッションからの発話はスキップされず、正しくパースされること
    const subLine = JSON.stringify({
      step_index: 0,
      source: "MODEL",
      type: "PLANNER_RESPONSE",
      status: "DONE",
      content: "サブエージェントの返答よ。",
    });
    const result = adapter.parseLine(subLine, subLogPath);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("サブエージェントの返答よ。");
  });

  it("同時に複数のサブエージェントが起動された場合（INVOKE_SUBAGENT 内に複数 conversationId がある場合）、すべてのサブエージェントを無視する", () => {
    const adapter = createAntigravityAdapter();
    const mainLogPath = "/tmp/brain/main-session/logs/transcript.jsonl";
    const subLogPath1 = "/tmp/brain/sub-session-111/logs/transcript.jsonl";
    const subLogPath2 = "/tmp/brain/sub-session-222/logs/transcript.jsonl";

    // 1. メインログで複数の conversationId を含む INVOKE_SUBAGENT を検出させる
    const invokeLine = JSON.stringify({
      step_index: 10,
      source: "MODEL",
      type: "INVOKE_SUBAGENT",
      status: "DONE",
      content: 'Created the following subagents:\n{\n  "conversationId": "sub-session-111",\n  "logAbsoluteUri": "..."\n}\n{\n  "conversationId": "sub-session-222",\n  "logAbsoluteUri": "..."\n}',
    });
    adapter.parseLine(invokeLine, mainLogPath);

    // 2. 両方のサブセッションからの発話が無視されること
    const subLine = JSON.stringify({
      step_index: 0,
      source: "MODEL",
      type: "PLANNER_RESPONSE",
      status: "DONE",
      content: "サブエージェントの返答よ。",
    });

    expect(adapter.parseLine(subLine, subLogPath1)).toEqual([]);
    expect(adapter.parseLine(subLine, subLogPath2)).toEqual([]);

    // 3. shouldProcessFile でも両方のセッションが false になること
    expect(adapter.shouldProcessFile(subLogPath1, "sub-session-111")).toBe(false);
    expect(adapter.shouldProcessFile(subLogPath2, "sub-session-222")).toBe(false);
  });
});
