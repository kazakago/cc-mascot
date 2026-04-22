import * as chokidar from "chokidar";
import * as fs from "fs";
import * as readline from "readline";
import type { HarnessAdapter, SpeakMessage } from "./adapters/harnessAdapter";
import { cleanTextForSpeech, splitIntoSentences } from "./filters/textFilter";
import { RuleBasedEmotionClassifier } from "./services/ruleBasedEmotionClassifier";

// Track file positions to avoid re-reading
const filePositions = new Map<string, number>();

// Debounce map to prevent rapid-fire speech
const lastProcessed = new Map<string, number>();
const DEBOUNCE_MS = 100;

// Emotion classifier for per-sentence re-classification
const emotionClassifier = new RuleBasedEmotionClassifier();

type BroadcastFn = (message: string) => void;

/**
 * Create a log monitor that watches harness session logs via the given adapter
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
  const watcher = chokidar.watch(adapter.getWatchPaths(), adapter.getWatchOptions());

  watcher.on("add", (filePath: string) => {
    initializeFilePosition(filePath);
  });

  watcher.on("change", (filePath: string) => {
    // Filter by active session ID if set
    const activeSessionId = getActiveSessionId?.() ?? null;
    if (activeSessionId && !adapter.shouldProcessFile(filePath, activeSessionId)) {
      // Advance file position without processing so content is discarded
      skipFileChanges(filePath);
      return;
    }
    console.log(`[LogMonitor] File changes detected: ${filePath}`);
    processFileChanges(filePath, broadcast, adapter);
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

function initializeFilePosition(filePath: string) {
  try {
    const stats = fs.statSync(filePath);
    filePositions.set(filePath, stats.size);
  } catch {
    filePositions.set(filePath, 0);
  }
}

/**
 * Advance the file position to the end without processing content.
 * This discards filtered-out messages so they aren't replayed when the filter is removed.
 */
function skipFileChanges(filePath: string) {
  try {
    const stats = fs.statSync(filePath);
    filePositions.set(filePath, stats.size);
  } catch {
    // ignore
  }
}

async function processFileChanges(filePath: string, broadcast: BroadcastFn, adapter: HarnessAdapter) {
  // Debounce check
  const now = Date.now();
  const lastTime = lastProcessed.get(filePath) || 0;
  if (now - lastTime < DEBOUNCE_MS) {
    return;
  }
  lastProcessed.set(filePath, now);

  const startPosition = filePositions.get(filePath) || 0;

  try {
    const stats = fs.statSync(filePath);
    const currentSize = stats.size;

    // File might have been truncated or rotated
    if (currentSize < startPosition) {
      filePositions.set(filePath, currentSize);
      return;
    }

    // No new content
    if (currentSize === startPosition) {
      return;
    }

    // Read new content
    const newContent = await readNewLines(filePath, startPosition, currentSize);
    filePositions.set(filePath, currentSize);

    // Process each new line
    for (const line of newContent) {
      processLogLine(line, broadcast, adapter, filePath);
    }
  } catch (err) {
    console.error(`[LogMonitor] Error processing ${filePath}:`, err);
  }
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

/**
 * Process a single log line and broadcast speak messages
 */
function processLogLine(line: string, broadcast: BroadcastFn, adapter: HarnessAdapter, logFilePath?: string) {
  const messages: SpeakMessage[] = adapter.parseLine(line, logFilePath);

  for (const message of messages) {
    const cleanedText = cleanTextForSpeech(message.text);

    if (cleanedText) {
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
  }
}
