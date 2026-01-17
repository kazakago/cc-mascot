import * as chokidar from 'chokidar';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';

// Track file positions to avoid re-reading
const filePositions = new Map<string, number>();

// Debounce map to prevent rapid-fire speech
const lastProcessed = new Map<string, number>();
const DEBOUNCE_MS = 100;

interface ContentItem {
  type: string;
  text?: string;
}

interface AssistantMessage {
  type: string;
  role: string;
  content: ContentItem[];
}

interface LogEntry {
  message?: AssistantMessage;
}

type BroadcastFn = (message: string) => void;

export function createLogMonitor(broadcast: BroadcastFn) {
  const claudeProjectsDir = path.join(os.homedir(), '.claude', 'projects');

  const watcher = chokidar.watch(claudeProjectsDir, {
    ignored: (path, stats) => stats?.isFile() === true && !path.endsWith('.jsonl'), // only watch jsonl files
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
    depth: 1, // Only main agent.
  });

  watcher.on('add', (filePath: string) => {
    initializeFilePosition(filePath);
  });

  watcher.on('change', (filePath: string) => {
    console.log(`[LogMonitor] File changes detected: ${filePath}`);
    processFileChanges(filePath, broadcast);
  });

  watcher.on('error', (error: unknown) => {
    console.error('[LogMonitor] Watcher error:', error);
  });

  watcher.on('ready', () => {
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

async function readNewLines(
  filePath: string,
  startPosition: number,
  endPosition: number
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const lines: string[] = [];
    const stream = fs.createReadStream(filePath, {
      start: startPosition,
      end: endPosition - 1,
      encoding: 'utf8',
    });

    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      if (line.trim()) {
        lines.push(line);
      }
    });

    rl.on('close', () => resolve(lines));
    rl.on('error', reject);
  });
}

function processLogLine(line: string, broadcast: BroadcastFn) {
  try {
    const entry: LogEntry = JSON.parse(line);

    // Filter: must have message with assistant role
    if (!entry.message || entry.message.role !== 'assistant') {
      return;
    }

    // Filter: must have message with message type
    if (!entry.message || entry.message.type !== 'message') {
      return;
    }

    // Filter: must have content array
    if (!Array.isArray(entry.message.content)) {
      return;
    }

    // Extract text content items only
    for (const item of entry.message.content) {
      if (item.type === 'text' && item.text) {
        const text = item.text.trim();
        if (text) {
          console.log(
            `[LogMonitor] Extracted text: ${text.substring(0, 50)}...`
          );
          broadcast(
            JSON.stringify({
              type: 'speak',
              text: text,
              emotion: 'neutral',
            })
          );
        }
      }
    }
  } catch {
    // Invalid JSON line, skip silently
  }
}
