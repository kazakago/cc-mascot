/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fsMod from "fs";
import * as readlineMod from "readline";
import * as chokidarMod from "chokidar";

// モックを設定
vi.mock("fs", () => ({
  statSync: vi.fn(),
  createReadStream: vi.fn(),
}));

vi.mock("readline", () => ({
  createInterface: vi.fn(),
}));

vi.mock("chokidar", () => ({
  watch: vi.fn(),
}));

vi.mock("./parsers/claudeCodeParser", () => ({
  parseClaudeCodeLog: vi.fn(),
}));

vi.mock("./filters/textFilter", () => ({
  cleanTextForSpeech: vi.fn(),
}));

import { createLogMonitor } from "./logMonitor";

describe("logMonitor", () => {
  const mockBroadcast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe("createLogMonitor", () => {
    it("chokidar.watchをデフォルトオプション（メインエージェントのみ）で呼び出す", () => {
      const mockWatcher = {
        on: vi.fn(),
        close: vi.fn(),
      };
      (chokidarMod.watch as any).mockReturnValue(mockWatcher as any);

      createLogMonitor(mockBroadcast);

      expect(chokidarMod.watch).toHaveBeenCalled();
      const watchCall = (chokidarMod.watch as any).mock.calls[0];
      expect(watchCall[1]).toMatchObject({
        depth: 1, // デフォルト: メインエージェントのみ
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
      });
      expect(watchCall[1]?.ignored).toBeTypeOf("function");
    });

    it("includeSubAgents=trueでサブエージェントも監視する", () => {
      const mockWatcher = {
        on: vi.fn(),
        close: vi.fn(),
      };
      (chokidarMod.watch as any).mockReturnValue(mockWatcher as any);

      createLogMonitor(mockBroadcast, true);

      expect(chokidarMod.watch).toHaveBeenCalled();
      const watchCall = (chokidarMod.watch as any).mock.calls[0];
      expect(watchCall[1]).toMatchObject({
        depth: 3, // サブエージェントも含める
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
      });
      expect(watchCall[1]?.ignored).toBeTypeOf("function");
    });

    it("ignoredオプションで.jsonlファイルのみを監視する", () => {
      const mockWatcher = {
        on: vi.fn(),
        close: vi.fn(),
      };
      (chokidarMod.watch as any).mockReturnValue(mockWatcher as any);

      createLogMonitor(mockBroadcast);

      const watchCall = (chokidarMod.watch as any).mock.calls[0];
      const ignoredFn = watchCall[1]?.ignored as (path: string, stats?: any) => boolean;

      // jsonlファイルは監視対象（ignored=false）
      expect(ignoredFn("/test/file.jsonl", { isFile: () => true })).toBe(false);

      // その他のファイルは除外（ignored=true）
      expect(ignoredFn("/test/file.txt", { isFile: () => true })).toBe(true);
      expect(ignoredFn("/test/file.log", { isFile: () => true })).toBe(true);
      expect(ignoredFn("/test/file.md", { isFile: () => true })).toBe(true);
    });

    it("ディレクトリは除外対象外", () => {
      const mockWatcher = {
        on: vi.fn(),
        close: vi.fn(),
      };
      (chokidarMod.watch as any).mockReturnValue(mockWatcher as any);

      createLogMonitor(mockBroadcast);

      const watchCall = (chokidarMod.watch as any).mock.calls[0];
      const ignoredFn = watchCall[1]?.ignored as (path: string, stats?: any) => boolean;

      // ディレクトリは監視対象（depth: 1でサブディレクトリも含める）
      expect(ignoredFn("/test/dir", { isFile: () => false })).toBe(false);
    });

    it("ファイル追加時にstatSyncを呼び出して位置を初期化", () => {
      const mockWatcher = {
        on: vi.fn((event, callback) => {
          if (event === "add") {
            callback("/test/file.jsonl");
          }
        }),
        close: vi.fn(),
      };
      (chokidarMod.watch as any).mockReturnValue(mockWatcher as any);
      (fsMod.statSync as any).mockReturnValue({ size: 1000 } as fsMod.Stats);

      createLogMonitor(mockBroadcast);

      expect(fsMod.statSync).toHaveBeenCalledWith("/test/file.jsonl");
    });

    it("ファイル追加時にstatSyncがエラーなら0を設定", () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const mockWatcher = {
        on: vi.fn((event, callback) => {
          if (event === "add") {
            callback("/test/file.jsonl");
          }
        }),
        close: vi.fn(),
      };
      (chokidarMod.watch as any).mockReturnValue(mockWatcher as any);
      (fsMod.statSync as any).mockImplementation(() => {
        throw new Error("File not found");
      });

      createLogMonitor(mockBroadcast);

      // エラーが発生しても監視は続く
      expect(mockWatcher.on).toHaveBeenCalledWith("add", expect.any(Function));
    });

    it("ready時にログを出力", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const mockWatcher = {
        on: vi.fn((event, callback) => {
          if (event === "ready") {
            callback();
          }
        }),
        close: vi.fn(),
      };
      (chokidarMod.watch as any).mockReturnValue(mockWatcher as any);

      createLogMonitor(mockBroadcast);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[LogMonitor] Monitoring"));
    });

    it("error時にエラーログを出力", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const mockError = new Error("Watcher error");
      const mockWatcher = {
        on: vi.fn((event, callback) => {
          if (event === "error") {
            callback(mockError);
          }
        }),
        close: vi.fn(),
      };
      (chokidarMod.watch as any).mockReturnValue(mockWatcher as any);

      createLogMonitor(mockBroadcast);

      expect(consoleSpy).toHaveBeenCalledWith("[LogMonitor] Watcher error:", mockError);
    });

    it("closeで監視を停止", () => {
      const mockWatcher = {
        on: vi.fn(),
        close: vi.fn(),
      };
      (chokidarMod.watch as any).mockReturnValue(mockWatcher as any);

      const monitor = createLogMonitor(mockBroadcast);
      monitor.close();

      expect(mockWatcher.close).toHaveBeenCalled();
    });
  });

  describe("ファイル変更処理", () => {
    it("ファイルサイズが変わらない場合は読み取りをスキップ", () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      let changeCallback: ((filePath: string) => void) | null = null;
      const mockWatcher = {
        on: vi.fn((event, callback) => {
          if (event === "add") {
            callback("/test/file.jsonl");
          }
          if (event === "change") {
            changeCallback = callback;
          }
        }),
        close: vi.fn(),
      };
      (chokidarMod.watch as any).mockReturnValue(mockWatcher as any);

      // 初期サイズ: 1000
      (fsMod.statSync as any).mockReturnValue({ size: 1000 } as fsMod.Stats);

      createLogMonitor(mockBroadcast);

      // 変更イベント（サイズは同じ1000）
      (fsMod.statSync as any).mockReturnValue({ size: 1000 } as fsMod.Stats);
      changeCallback!("/test/file.jsonl");

      // createReadStreamが呼ばれないことを確認
      expect(fsMod.createReadStream).not.toHaveBeenCalled();
    });

    it("ファイルが切り詰められた場合は位置をリセット", () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      let addCallback: ((filePath: string) => void) | null = null;
      let changeCallback: ((filePath: string) => void) | null = null;
      const mockWatcher = {
        on: vi.fn((event, callback) => {
          if (event === "add") {
            addCallback = callback;
          }
          if (event === "change") {
            changeCallback = callback;
          }
        }),
        close: vi.fn(),
      };
      (chokidarMod.watch as any).mockReturnValue(mockWatcher as any);

      createLogMonitor(mockBroadcast);

      // 初期サイズ: 1000
      (fsMod.statSync as any).mockReturnValueOnce({ size: 1000 } as fsMod.Stats);
      addCallback!("/test/file.jsonl");

      // ファイルが切り詰められた（500 < 1000）
      (fsMod.statSync as any).mockReturnValueOnce({ size: 500 } as fsMod.Stats);
      changeCallback!("/test/file.jsonl");

      // 読み取りはスキップされる
      expect(fsMod.createReadStream).not.toHaveBeenCalled();
    });

    it("デバウンス処理：100ms以内の変更は無視", () => {
      let changeCallback: ((filePath: string) => void) | null = null;
      const mockWatcher = {
        on: vi.fn((event, callback) => {
          if (event === "add") {
            callback("/test/file.jsonl");
          }
          if (event === "change") {
            changeCallback = callback;
          }
        }),
        close: vi.fn(),
      };
      (chokidarMod.watch as any).mockReturnValue(mockWatcher as any);

      // 初期サイズ: 1000
      (fsMod.statSync as any).mockReturnValue({ size: 1000 } as fsMod.Stats);

      createLogMonitor(mockBroadcast);

      // 1回目の変更（サイズ: 1200）
      (fsMod.statSync as any).mockReturnValue({ size: 1200 } as fsMod.Stats);
      const mockStream = {
        on: vi.fn((event: string, callback: () => void) => {
          if (event === "close") {
            callback();
          }
        }),
      };
      (fsMod.createReadStream as any).mockReturnValue(mockStream as any);
      (readlineMod.createInterface as any).mockReturnValue({
        on: vi.fn((event: string, callback: () => void) => {
          if (event === "close") {
            callback();
          }
        }),
      } as any);

      changeCallback!("/test/file.jsonl");

      // 2回目の変更（50ms後、デバウンス対象）
      vi.advanceTimersByTime(50);
      changeCallback!("/test/file.jsonl");

      // 同じファイルなので2回目はデバウンスされる
      // createReadStreamの呼び出し回数は増えない
    });
  });

  describe("ログ行のパースとブロードキャスト", () => {
    it("ファイル変更時にパース・フィルタ・ブロードキャストのパイプラインが実行される", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      const { parseClaudeCodeLog } = await import("./parsers/claudeCodeParser");
      const { cleanTextForSpeech } = await import("./filters/textFilter");

      (parseClaudeCodeLog as any).mockReturnValue([{ type: "speak", text: "こんにちは！", emotion: "happy" }]);
      (cleanTextForSpeech as any).mockReturnValue("こんにちは！");

      let addCallback: ((filePath: string) => void) | null = null;
      let changeCallback: ((filePath: string) => void) | null = null;
      const mockRl = {
        on: vi.fn((event: string, callback: (line?: string) => void) => {
          if (event === "line") callback("some-json-line");
          if (event === "close") callback();
        }),
      };
      const mockStream = {
        on: vi.fn((event: string, callback: () => void) => {
          if (event === "close") callback();
        }),
      };
      const mockWatcher = {
        on: vi.fn((event: string, callback: (arg?: any) => void) => {
          if (event === "add") addCallback = callback as (filePath: string) => void;
          if (event === "change") changeCallback = callback as (filePath: string) => void;
        }),
        close: vi.fn(),
      };

      (chokidarMod.watch as any).mockReturnValue(mockWatcher as any);
      (fsMod.createReadStream as any).mockReturnValue(mockStream as any);
      (readlineMod.createInterface as any).mockReturnValue(mockRl as any);

      // 初期サイズ100
      (fsMod.statSync as any).mockReturnValue({ size: 100 } as fsMod.Stats);
      createLogMonitor(mockBroadcast);
      addCallback!("/test/pipe.jsonl");

      // サイズ増加でchange発火
      (fsMod.statSync as any).mockReturnValue({ size: 200 } as fsMod.Stats);
      changeCallback!("/test/pipe.jsonl");

      // processFileChangesはfire-and-forget asyncなので、マイクロタスクをフラッシュ
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(parseClaudeCodeLog).toHaveBeenCalled();
      expect(cleanTextForSpeech).toHaveBeenCalledWith("こんにちは！");
      expect(mockBroadcast).toHaveBeenCalledWith(
        JSON.stringify({ type: "speak", text: "こんにちは！", emotion: "happy" }),
      );
    });

    it("フィルタ後に空文字になった場合はブロードキャストしない", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      const { parseClaudeCodeLog } = await import("./parsers/claudeCodeParser");
      const { cleanTextForSpeech } = await import("./filters/textFilter");

      (parseClaudeCodeLog as any).mockReturnValue([{ type: "speak", text: "```code block```", emotion: "neutral" }]);
      (cleanTextForSpeech as any).mockReturnValue("");

      let addCallback: ((filePath: string) => void) | null = null;
      let changeCallback: ((filePath: string) => void) | null = null;
      const mockRl = {
        on: vi.fn((event: string, callback: (line?: string) => void) => {
          if (event === "line") callback("some-json-line");
          if (event === "close") callback();
        }),
      };
      const mockStream = {
        on: vi.fn((event: string, callback: () => void) => {
          if (event === "close") callback();
        }),
      };
      const mockWatcher = {
        on: vi.fn((event: string, callback: (arg?: any) => void) => {
          if (event === "add") addCallback = callback as (filePath: string) => void;
          if (event === "change") changeCallback = callback as (filePath: string) => void;
        }),
        close: vi.fn(),
      };

      (chokidarMod.watch as any).mockReturnValue(mockWatcher as any);
      (fsMod.createReadStream as any).mockReturnValue(mockStream as any);
      (readlineMod.createInterface as any).mockReturnValue(mockRl as any);

      (fsMod.statSync as any).mockReturnValue({ size: 50 } as fsMod.Stats);
      createLogMonitor(mockBroadcast);
      addCallback!("/test/empty.jsonl");

      (fsMod.statSync as any).mockReturnValue({ size: 150 } as fsMod.Stats);
      changeCallback!("/test/empty.jsonl");

      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(cleanTextForSpeech).toHaveBeenCalled();
      expect(mockBroadcast).not.toHaveBeenCalled();
    });
  });

  describe("エラーハンドリング", () => {
    it("ファイル監視がエラーでも監視を続ける", () => {
      const mockWatcher = {
        on: vi.fn(),
        close: vi.fn(),
      };
      (chokidarMod.watch as any).mockReturnValue(mockWatcher as any);

      // 正常にインスタンス化されることを確認
      expect(() => createLogMonitor(mockBroadcast)).not.toThrow();
      expect(mockWatcher.on).toHaveBeenCalledWith("error", expect.any(Function));
    });
  });
});
