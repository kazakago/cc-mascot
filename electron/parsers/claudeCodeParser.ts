/**
 * Claude Code JSONL log parser
 * Parses Claude Code session logs and extracts assistant messages
 */

import { RuleBasedEmotionClassifier } from "../services/ruleBasedEmotionClassifier";

// グローバル感情分類器インスタンス
const emotionClassifier = new RuleBasedEmotionClassifier();

export interface SpeakMessage {
  type: "speak";
  text: string;
  emotion?: "neutral" | "happy" | "angry" | "sad" | "relaxed" | "surprised";
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
 * @param includeSubAgents - Whether to include sub-agent messages
 * @returns Array of speak messages (may be empty if line doesn't contain text)
 */
export function parseClaudeCodeLog(line: string, includeSubAgents = false): SpeakMessage[] {
  const messages: SpeakMessage[] = [];

  try {
    const entry: LogEntry = JSON.parse(line);

    // Case 1: Standard assistant messages
    // Filter: must have message with assistant role and message type
    if (entry.message?.role === "assistant" && entry.message?.type === "message") {
      // Filter: must have content array
      if (Array.isArray(entry.message.content)) {
        // Extract text content items only
        for (const item of entry.message.content) {
          if (item.type === "text" && item.text) {
            const text = item.text.trim();
            if (text) {
              // 感情分類器でテキストから感情を自動判定
              const emotion = emotionClassifier.classify(text);
              messages.push({
                type: "speak",
                text: text,
                emotion: emotion,
              });
            }
          }
        }
      }
    }

    // Case 2: Local command stdout messages (user role with specific tag)
    // Note: This handles a specific case where Claude Code emits command output
    // as user role messages wrapped in <local-command-stdout> tags.
    // This behavior may be specific to the current version and could change.
    // Only process when sub-agents are excluded (includeSubAgents === false).
    else if (!includeSubAgents && entry.message?.role === "user" && entry.message?.type === "message") {
      if (Array.isArray(entry.message.content)) {
        for (const item of entry.message.content) {
          if (item.type === "text" && item.text) {
            const text = item.text.trim();
            // Check if content is wrapped in <local-command-stdout> tags
            if (text.startsWith("<local-command-stdout>") && text.endsWith("</local-command-stdout>")) {
              // Extract content between tags
              const content = text
                .replace(/^<local-command-stdout>/, "")
                .replace(/<\/local-command-stdout>$/, "")
                .trim();

              if (content) {
                // 感情分類器でテキストから感情を自動判定
                const emotion = emotionClassifier.classify(content);
                messages.push({
                  type: "speak",
                  text: content,
                  emotion: emotion,
                });
              }
            }
          }
        }
      }
    }
  } catch {
    // Invalid JSON line, skip silently
  }

  return messages;
}
