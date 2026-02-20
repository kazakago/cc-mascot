/**
 * Claude Code JSONLログパーサー
 * Claude Codeのセッションログを解析し、アシスタントメッセージを抽出する
 */

import * as fs from "fs";
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
  content: ContentItem[] | string;
}

interface LogEntry {
  parentUuid?: string;
  message?: AssistantMessage;
}

/**
 * local-command-stdout メッセージがSkill結果かCLIコマンド出力かを判定する
 * ログファイルからparentUuidに一致する親メッセージを探し、<command-name>タグの有無で判定する
 * @param parentUuid - local-command-stdoutメッセージのparentUuid
 * @param logFilePath - JSONLログファイルのパス
 * @returns Skill結果の場合true（<command-name>タグなし）、CLIコマンドの場合false
 */
function isSkillOutput(parentUuid: string, logFilePath: string): boolean {
  try {
    const fileContent = fs.readFileSync(logFilePath, "utf8");
    const lines = fileContent.split("\n");

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.uuid === parentUuid) {
          // 親メッセージを発見 - <command-name>タグを含むか確認
          const content = entry.message?.content;
          if (typeof content === "string") {
            // 親が<command-name>を含む場合はCLIコマンド（Skillではない）
            return !content.includes("<command-name>");
          }
          // 親のcontentが文字列でない or 存在しない場合はSkill結果として扱う
          return true;
        }
      } catch {
        // 不正なJSON行はスキップ
      }
    }
  } catch {
    // ファイル読み込みエラー - デフォルトにフォールスルー
  }

  // 親メッセージが見つからない場合はSkill結果として扱う（読み上げ対象）
  return true;
}

/**
 * Claude CodeのJSONLログ行を解析してテキストメッセージを抽出する
 * @param line - JSONLログファイルの1行
 * @param includeSubAgents - サブエージェントのメッセージを含めるかどうか
 * @param logFilePath - JSONLログファイルのパス（local-command-stdoutの親メッセージ参照用、省略可）
 * @returns SpeakMessageの配列（テキストを含まない行の場合は空配列）
 */
export function parseClaudeCodeLog(line: string, includeSubAgents = false, logFilePath?: string): SpeakMessage[] {
  const messages: SpeakMessage[] = [];

  try {
    const entry: LogEntry = JSON.parse(line);

    // ケース1: 通常のアシスタントメッセージ
    // フィルタ: assistantロールかつmessageタイプのみ処理
    if (entry.message?.role === "assistant" && entry.message?.type === "message") {
      // フィルタ: contentが配列であること
      if (Array.isArray(entry.message.content)) {
        // テキストタイプのコンテンツのみ抽出
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

    // ケース2: ローカルコマンド標準出力メッセージ（userロール、特定タグ付き）
    // Claude Codeがコマンド出力を<local-command-stdout>タグで囲んだuserロールメッセージとして出力する特殊ケースに対応。
    // 加えて、親メッセージの<command-name>タグ有無でSkill結果（読み上げ）とCLIコマンド出力（スキップ）を判別する。
    // この挙動は将来変更される可能性がある。
    //
    // サブエージェント無効時のみ処理する（includeSubAgents === false）。
    else if (!includeSubAgents && entry.message?.role === "user") {
      // contentが文字列であるか確認（配列ではない）
      if (typeof entry.message.content === "string") {
        const text = entry.message.content.trim();
        // <local-command-stdout>タグで囲まれているか確認
        if (text.startsWith("<local-command-stdout>") && text.endsWith("</local-command-stdout>")) {
          // logFilePathが指定されている場合、Skill結果かCLIコマンド出力かを判定
          if (logFilePath && entry.parentUuid) {
            if (!isSkillOutput(entry.parentUuid, logFilePath)) {
              // CLIコマンド出力 - スキップ（読み上げない）
              return messages;
            }
          }

          // タグ間のコンテンツを抽出
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
  } catch {
    // 不正なJSON行は無視
  }

  return messages;
}
