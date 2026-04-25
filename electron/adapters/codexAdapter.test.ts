import { afterEach, describe, expect, it } from "vitest";
import { createCodexAdapter } from "./codexAdapter";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

describe("createCodexAdapter", () => {
  const originalCodexHome = process.env.CODEX_HOME;
  const tempDirs: string[] = [];

  afterEach(() => {
    if (originalCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = originalCodexHome;
    }

    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("CODEX_HOME配下のsessionsを監視する", () => {
    process.env.CODEX_HOME = "/tmp/custom-codex";

    const adapter = createCodexAdapter();

    expect(adapter.getWatchPaths()).toEqual(["/tmp/custom-codex/sessions"]);
    expect(adapter.getWatchOptions()).toMatchObject({
      depth: 4,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    });
  });

  it("jsonl以外のファイルを除外する", () => {
    const adapter = createCodexAdapter();
    const ignored = adapter.getWatchOptions().ignored as (filePath: string, stats?: { isFile(): boolean }) => boolean;

    expect(ignored("/tmp/session.jsonl", { isFile: () => true })).toBe(false);
    expect(ignored("/tmp/session.log", { isFile: () => true })).toBe(true);
    expect(ignored("/tmp/sessions", { isFile: () => false })).toBe(false);
  });

  it("rolloutファイル名末尾のセッションIDでフィルタ判定する", () => {
    const adapter = createCodexAdapter();
    const sessionId = "019dc55e-a263-7c20-ba91-a1c328a62499";
    const filePath = `/Users/user/.codex/sessions/2026/04/26/rollout-2026-04-26T01-00-06-${sessionId}.jsonl`;

    expect(adapter.shouldProcessFile(filePath, sessionId)).toBe(true);
    expect(adapter.shouldProcessFile(filePath, "other-session")).toBe(false);
  });

  it("サブエージェントのrolloutファイルは読み上げ対象から除外する", () => {
    const adapter = createCodexAdapter();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-adapter-"));
    tempDirs.push(tempDir);
    const filePath = path.join(tempDir, "rollout-subagent.jsonl");
    fs.writeFileSync(
      filePath,
      `${JSON.stringify({
        type: "session_meta",
        payload: {
          id: "subagent-session",
          source: { subagent: { thread_spawn: { parent_thread_id: "parent-session" } } },
        },
      })}\n`,
      "utf8",
    );

    const line = JSON.stringify({
      type: "response_item",
      payload: {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "サブエージェントの発言です。" }],
      },
    });

    expect(adapter.parseLine(line, filePath)).toHaveLength(0);
  });

  it("長いsession_metaを持つサブエージェントのrolloutファイルも除外する", () => {
    const adapter = createCodexAdapter();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-adapter-"));
    tempDirs.push(tempDir);
    const filePath = path.join(tempDir, "rollout-long-subagent.jsonl");
    fs.writeFileSync(
      filePath,
      `${JSON.stringify({
        type: "session_meta",
        payload: {
          id: "subagent-session",
          source: { subagent: { thread_spawn: { parent_thread_id: "parent-session" } } },
          base_instructions: { text: "x".repeat(20000) },
        },
      })}\n`,
      "utf8",
    );

    const line = JSON.stringify({
      type: "response_item",
      payload: {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "長いメタ情報の後の発言です。" }],
      },
    });

    expect(adapter.parseLine(line, filePath)).toHaveLength(0);
  });

  it("通常のrolloutファイルは読み上げ対象にする", () => {
    const adapter = createCodexAdapter();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-adapter-"));
    tempDirs.push(tempDir);
    const filePath = path.join(tempDir, "rollout-main.jsonl");
    fs.writeFileSync(
      filePath,
      `${JSON.stringify({
        type: "session_meta",
        payload: { id: "main-session", source: "vscode" },
      })}\n`,
      "utf8",
    );

    const line = JSON.stringify({
      type: "response_item",
      payload: {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "通常のCodex発言です。" }],
      },
    });

    expect(adapter.parseLine(line, filePath)).toHaveLength(1);
  });
});
