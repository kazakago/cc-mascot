import * as chokidar from "chokidar";
import * as fs from "fs";
import * as readline from "readline";
import type { HarnessAdapter, JsonlHarnessAdapter, SpeakMessage } from "./adapters/harnessAdapter";
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
 * - mode: "jsonl" → 差分読み取り（ファイル位置ベース）、parseLine を使用
 * - mode: "json"  → ファイル全体読み取り、parseFile を使用（メッセージIDで重複排除）
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
  // JSONL モード用: ファイル位置・デバウンス状態（インスタンスごとに独立）
  const filePositions = new Map<string, number>();
  const lastProcessed = new Map<string, number>();

  // --- JSONL モード用ヘルパー ---

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

  async function processJsonlFile(filePath: string) {
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

      const jsonlAdapter = adapter as JsonlHarnessAdapter;
      for (const line of newContent) {
        const messages = jsonlAdapter.parseLine(line, filePath);
        for (const message of messages) {
          broadcastMessages(message);
        }
      }
    } catch (err) {
      console.error(`[LogMonitor] Error processing ${filePath}:`, err);
    }
  }

  // --- JSON モード用ヘルパー ---

  async function processJsonFile(filePath: string) {
    const now = Date.now();
    const lastTime = lastProcessed.get(filePath) || 0;
    if (now - lastTime < DEBOUNCE_MS) return;
    lastProcessed.set(filePath, now);

    try {
      if (adapter.mode !== "json") return;
      const messages = adapter.parseFile(filePath);
      for (const message of messages) {
        broadcastMessages(message);
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
    if (adapter.mode === "jsonl") {
      // JSONL: ファイル位置を現在の末尾に初期化（既存ログの再生を防ぐ）
      initializeFilePosition(filePath);
    } else {
      // JSON: 初回 parseFile で既存メッセージIDを登録（再生を防ぐ）
      adapter.parseFile(filePath);
    }
  });

  watcher.on("change", (filePath: string) => {
    const activeSessionId = getActiveSessionId?.() ?? null;
    if (activeSessionId && !adapter.shouldProcessFile(filePath, activeSessionId)) {
      if (adapter.mode === "jsonl") {
        // JSONL: フィルタ解除後に過去ログが再生されないよう位置を進める
        skipFileChanges(filePath);
      }
      // JSON: parseFile を呼ばないだけでよい（IDは未登録のまま残るが、
      //        現状 Gemini CLI にはセッション固定の手段がないため許容）
      return;
    }

    console.log(`[LogMonitor] File changes detected: ${filePath}`);
    if (adapter.mode === "jsonl") {
      processJsonlFile(filePath);
    } else {
      processJsonFile(filePath);
    }
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
