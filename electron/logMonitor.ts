import * as chokidar from "chokidar";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as readline from "readline";
import { parseClaudeCodeLog, SpeakMessage } from "./parsers/claudeCodeParser";
import { cleanTextForSpeech } from "./filters/textFilter";

// Track file positions to avoid re-reading
const filePositions = new Map<string, number>();

// Debounce map to prevent rapid-fire speech
const lastProcessed = new Map<string, number>();
const DEBOUNCE_MS = 100;

type BroadcastFn = (message: string) => void;

/**
 * Create a log monitor that watches Claude Code session logs
 * @param broadcast - Callback function to send messages to the renderer process
 */
export function createLogMonitor(broadcast: BroadcastFn) {
  const claudeProjectsDir = path.join(os.homedir(), ".claude", "projects");

  const watcher = chokidar.watch(claudeProjectsDir, {
    ignored: (path, stats) => stats?.isFile() === true && !path.endsWith(".jsonl"), // only watch jsonl files
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
    depth: 1, // Only main agent.
  });

  watcher.on("add", (filePath: string) => {
    initializeFilePosition(filePath);
  });

  watcher.on("change", (filePath: string) => {
    console.log(`[LogMonitor] File changes detected: ${filePath}`);
    processFileChanges(filePath, broadcast);
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

async function processFileChanges(filePath: string, broadcast: BroadcastFn) {
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
      processLogLine(line, broadcast);
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
 * @param line - A single line from the JSONL log file
 * @param broadcast - Callback function to send messages to the renderer process
 */
function processLogLine(line: string, broadcast: BroadcastFn) {
  // Parse the log line using Claude Code parser
  const messages: SpeakMessage[] = parseClaudeCodeLog(line);

  // Process each message
  for (const message of messages) {
    // Apply text filtering to clean up markdown and other syntax
    const cleanedText = cleanTextForSpeech(message.text);

    if (cleanedText) {
      console.log(`[LogMonitor] Extracted text: ${cleanedText.substring(0, 50)}...`);

      broadcast(
        JSON.stringify({
          ...message,
          text: cleanedText,
        }),
      );
    }
  }
}
