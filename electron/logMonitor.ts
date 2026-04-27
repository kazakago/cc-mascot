import * as chokidar from "chokidar";
import * as fs from "fs";
import * as readline from "readline";
import type { HarnessAdapter, SpeakMessage } from "./adapters/harnessAdapter";
import { cleanTextForSpeech, splitIntoSentences } from "./filters/textFilter";
import { RuleBasedEmotionClassifier } from "./services/ruleBasedEmotionClassifier";

const DEBOUNCE_MS = 100;

// Emotion classifier for per-sentence re-classification
const emotionClassifier = new RuleBasedEmotionClassifier();

type BroadcastFn = (message: string) => void;

/**
 * Create a log monitor that watches harness session logs via the given adapter.
 * Each call creates an independent monitor with its own file-position and debounce state.
 *
 * 全てのアダプターが JSONL 形式（追記型）であることを前提とし、
 * 差分読み取り（ファイル位置ベース）でログを処理する。
 *
 * @param broadcast - Callback function to send messages to the renderer process
 * @param adapter - Harness adapter that provides watch paths, options, and log parsing
 * @param getActiveSessionId - Optional getter that returns the active session ID for filtering.
 *                             When it returns a non-null value, only logs from that session are broadcast.
 */
export function createLogMonitor(
  broadcast: BroadcastFn,
  adapter: HarnessAdapter,
  getActiveSessionId?: () => string | null,
) {
  // ファイル位置・デバウンス状態（インスタンスごとに独立）
  const filePositions = new Map<string, number>();
  const lastProcessed = new Map<string, number>();

  function initializeFilePosition(filePath: string) {
    try {
      const stats = fs.statSync(filePath);
      filePositions.set(filePath, stats.size);
    } catch {
      filePositions.set(filePath, 0);
    }
  }

  function skipFileChanges(filePath: string) {
    try {
      const stats = fs.statSync(filePath);
      filePositions.set(filePath, stats.size);
    } catch {
      // ignore
    }
  }

  async function processFile(filePath: string) {
    const now = Date.now();
    const lastTime = lastProcessed.get(filePath) || 0;
    if (now - lastTime < DEBOUNCE_MS) return;
    lastProcessed.set(filePath, now);

    const startPosition = filePositions.get(filePath) || 0;

    try {
      const stats = fs.statSync(filePath);
      const currentSize = stats.size;

      if (currentSize < startPosition) {
        filePositions.set(filePath, currentSize);
        return;
      }
      if (currentSize === startPosition) return;

      const newContent = await readNewLines(filePath, startPosition, currentSize);
      filePositions.set(filePath, currentSize);

      for (const line of newContent) {
        const messages = adapter.parseLine(line, filePath);
        for (const message of messages) {
          broadcastMessages(message);
        }
      }
    } catch (err) {
      console.error(`[LogMonitor] Error processing ${filePath}:`, err);
    }
  }

  // --- 共通: メッセージのクリーニング・分割・ブロードキャスト ---

  function broadcastMessages(message: SpeakMessage) {
    const cleanedText = cleanTextForSpeech(message.text);
    if (!cleanedText) return;

    const sentences = splitIntoSentences(cleanedText);
    for (const sentence of sentences) {
      if (!sentence) continue;

      const emotion = emotionClassifier.classify(sentence);
      console.log(`[LogMonitor] Extracted text: ${sentence.substring(0, 50)}...`);

      broadcast(
        JSON.stringify({
          ...message,
          text: sentence,
          emotion,
        }),
      );
    }
  }

  // --- chokidar 監視 ---

  const watcher = chokidar.watch(adapter.getWatchPaths(), adapter.getWatchOptions());

  watcher.on("add", (filePath: string) => {
    // ファイル位置を現在の末尾に初期化（既存ログの再生を防ぐ）
    initializeFilePosition(filePath);
    adapter.initializeFile?.(filePath);
  });

  watcher.on("change", (filePath: string) => {
    const activeSessionId = getActiveSessionId?.() ?? null;
    if (activeSessionId && !adapter.shouldProcessFile(filePath, activeSessionId)) {
      // フィルタ解除後に過去ログが再生されないよう位置を進める
      skipFileChanges(filePath);
      return;
    }

    console.log(`[LogMonitor] File changes detected: ${filePath}`);
    processFile(filePath);
  });

  watcher.on("error", (error: unknown) => {
    console.error("[LogMonitor] Watcher error:", error);
  });

  watcher.on("ready", () => {
    console.log(`[LogMonitor] Monitoring ${filePositions.size} files`);
  });

  return {
    close: () => {
      watcher.close();
      filePositions.clear();
      lastProcessed.clear();
    },
  };
}

async function readNewLines(filePath: string, startPosition: number, endPosition: number): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const lines: string[] = [];
    const stream = fs.createReadStream(filePath, {
      start: startPosition,
      end: endPosition - 1,
      encoding: "utf8",
    });

    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    rl.on("line", (line) => {
      if (line.trim()) {
        lines.push(line);
      }
    });

    rl.on("close", () => resolve(lines));
    rl.on("error", reject);
  });
}
