import { afterEach, describe, expect, it } from "vitest";
import { createClaudeCodeAdapter } from "./claudeCodeAdapter";

describe("createClaudeCodeAdapter", () => {
  const originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;

  afterEach(() => {
    if (originalClaudeConfigDir === undefined) {
      delete process.env.CLAUDE_CONFIG_DIR;
    } else {
      process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir;
    }
  });

  it("CLAUDE_CONFIG_DIR配下のprojectsを監視する", () => {
    process.env.CLAUDE_CONFIG_DIR = "/tmp/custom-claude";

    const adapter = createClaudeCodeAdapter();

    expect(adapter.getWatchPaths()).toEqual(["/tmp/custom-claude/projects"]);
    expect(adapter.getWatchOptions()).toMatchObject({
      depth: 1,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    });
  });

  it("jsonl以外のファイルを除外する", () => {
    const adapter = createClaudeCodeAdapter();
    const ignored = adapter.getWatchOptions().ignored as (filePath: string, stats?: { isFile(): boolean }) => boolean;

    expect(ignored("/tmp/session.jsonl", { isFile: () => true })).toBe(false);
    expect(ignored("/tmp/session.log", { isFile: () => true })).toBe(true);
    expect(ignored("/tmp/projects", { isFile: () => false })).toBe(false);
  });

  it("ファイル名のセッションIDでフィルタ判定する", () => {
    const adapter = createClaudeCodeAdapter();
    const sessionId = "session-123";
    const filePath = `/Users/user/.claude/projects/project/${sessionId}.jsonl`;

    expect(adapter.shouldProcessFile(filePath, sessionId)).toBe(true);
    expect(adapter.shouldProcessFile(filePath, "other-session")).toBe(false);
  });

  it("親ディレクトリ名のセッションIDでサブエージェントログをフィルタ判定する", () => {
    const adapter = createClaudeCodeAdapter();
    const sessionId = "parent-session-123";
    const filePath = `/Users/user/.claude/projects/project/${sessionId}/sub-agent.jsonl`;

    expect(adapter.shouldProcessFile(filePath, sessionId)).toBe(true);
  });

  it("parseLineでClaude CodeログをSpeakMessageに変換する", () => {
    const adapter = createClaudeCodeAdapter();
    const result = adapter.parseLine(
      JSON.stringify({
        message: {
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "Claude Codeの返答です。" }],
        },
      }),
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "speak",
      text: "Claude Codeの返答です。",
    });
  });
});
