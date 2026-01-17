/**
 * Claude Code JSONL log parser
 * Parses Claude Code session logs and extracts assistant messages
 */

export interface SpeakMessage {
  type: 'speak';
  text: string;
  emotion?: 'neutral' | 'happy' | 'angry' | 'sad' | 'relaxed' | 'surprised';
}

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

/**
 * Parse a Claude Code JSONL log line and extract text messages
 * @param line - A single line from the JSONL log file
 * @returns Array of speak messages (may be empty if line doesn't contain text)
 */
export function parseClaudeCodeLog(line: string): SpeakMessage[] {
  const messages: SpeakMessage[] = [];

  try {
    const entry: LogEntry = JSON.parse(line);

    // Filter: must have message with assistant role
    if (!entry.message || entry.message.role !== 'assistant') {
      return messages;
    }

    // Filter: must have message with message type
    if (!entry.message || entry.message.type !== 'message') {
      return messages;
    }

    // Filter: must have content array
    if (!Array.isArray(entry.message.content)) {
      return messages;
    }

    // Extract text content items only
    for (const item of entry.message.content) {
      if (item.type === 'text' && item.text) {
        const text = item.text.trim();
        if (text) {
          messages.push({
            type: 'speak',
            text: text,
            emotion: 'neutral',
          });
        }
      }
    }
  } catch {
    // Invalid JSON line, skip silently
  }

  return messages;
}
