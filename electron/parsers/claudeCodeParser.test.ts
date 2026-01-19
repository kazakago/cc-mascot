import { describe, it, expect } from 'vitest';
import { parseClaudeCodeLog, SpeakMessage } from './claudeCodeParser';

describe('parseClaudeCodeLog', () => {
  describe('正常なJSONLログの解析', () => {
    it('assistantメッセージからテキストを抽出する', () => {
      const line = JSON.stringify({
        message: {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'text', text: 'こんにちは！テストメッセージです。' },
          ],
        },
      });

      const result = parseClaudeCodeLog(line);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: 'speak',
        text: 'こんにちは！テストメッセージです。',
      });
      expect(result[0].emotion).toBeDefined();
    });

    it('複数のテキストコンテンツを抽出する', () => {
      const line = JSON.stringify({
        message: {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'text', text: '最初のメッセージ' },
            { type: 'text', text: '2番目のメッセージ' },
            { type: 'text', text: '3番目のメッセージ' },
          ],
        },
      });

      const result = parseClaudeCodeLog(line);

      expect(result).toHaveLength(3);
      expect(result[0].text).toBe('最初のメッセージ');
      expect(result[1].text).toBe('2番目のメッセージ');
      expect(result[2].text).toBe('3番目のメッセージ');
    });

    it('前後の空白をトリムする', () => {
      const line = JSON.stringify({
        message: {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'text', text: '  前後に空白があります  ' },
          ],
        },
      });

      const result = parseClaudeCodeLog(line);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('前後に空白があります');
    });

    it('感情が自動的に分類される', () => {
      const happyLine = JSON.stringify({
        message: {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'text', text: 'バグを修正できました！' },
          ],
        },
      });

      const result = parseClaudeCodeLog(happyLine);

      expect(result).toHaveLength(1);
      expect(result[0].emotion).toBe('happy');
    });
  });

  describe('フィルタリング - 除外すべきメッセージ', () => {
    it('userメッセージは無視する', () => {
      const line = JSON.stringify({
        message: {
          type: 'message',
          role: 'user',
          content: [
            { type: 'text', text: 'ユーザーのメッセージ' },
          ],
        },
      });

      const result = parseClaudeCodeLog(line);

      expect(result).toHaveLength(0);
    });

    it('typeがmessage以外は無視する', () => {
      const line = JSON.stringify({
        message: {
          type: 'other_type',
          role: 'assistant',
          content: [
            { type: 'text', text: 'テキスト' },
          ],
        },
      });

      const result = parseClaudeCodeLog(line);

      expect(result).toHaveLength(0);
    });

    it('messageプロパティがない場合は無視する', () => {
      const line = JSON.stringify({
        other: 'data',
      });

      const result = parseClaudeCodeLog(line);

      expect(result).toHaveLength(0);
    });

    it('contentが配列でない場合は無視する', () => {
      const line = JSON.stringify({
        message: {
          type: 'message',
          role: 'assistant',
          content: 'not an array',
        },
      });

      const result = parseClaudeCodeLog(line);

      expect(result).toHaveLength(0);
    });

    it('thinking タイプのコンテンツは無視する', () => {
      const line = JSON.stringify({
        message: {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'text', text: '喋るテキスト' },
            { type: 'thinking', thinking: '内部思考プロセス' },
          ],
        },
      });

      const result = parseClaudeCodeLog(line);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('喋るテキスト');
    });

    it('tool_use タイプのコンテンツは無視する', () => {
      const line = JSON.stringify({
        message: {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'text', text: '喋るテキスト' },
            { type: 'tool_use', name: 'Read', input: {} },
          ],
        },
      });

      const result = parseClaudeCodeLog(line);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('喋るテキスト');
    });

    it('空文字列のテキストは無視する', () => {
      const line = JSON.stringify({
        message: {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'text', text: '' },
            { type: 'text', text: '   ' }, // 空白のみ
            { type: 'text', text: '有効なテキスト' },
          ],
        },
      });

      const result = parseClaudeCodeLog(line);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('有効なテキスト');
    });

    it('textプロパティがないコンテンツは無視する', () => {
      const line = JSON.stringify({
        message: {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'text' }, // textプロパティなし
            { type: 'text', text: '有効なテキスト' },
          ],
        },
      });

      const result = parseClaudeCodeLog(line);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('有効なテキスト');
    });
  });

  describe('エラーハンドリング', () => {
    it('不正なJSONは空配列を返す', () => {
      const line = 'this is not valid JSON {';

      const result = parseClaudeCodeLog(line);

      expect(result).toHaveLength(0);
    });

    it('空文字列は空配列を返す', () => {
      const result = parseClaudeCodeLog('');

      expect(result).toHaveLength(0);
    });

    it('nullやundefinedを含むJSONでもクラッシュしない', () => {
      const line = JSON.stringify({
        message: null,
      });

      const result = parseClaudeCodeLog(line);

      expect(result).toHaveLength(0);
    });
  });

  describe('実際のClaude Codeログパターン', () => {
    it('コード説明メッセージを処理する', () => {
      const line = JSON.stringify({
        message: {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'この関数はファイルを読み込んで処理します。例外ハンドリングも含まれています。',
            },
          ],
        },
      });

      const result = parseClaudeCodeLog(line);

      expect(result).toHaveLength(1);
      expect(result[0].emotion).toBe('neutral');
    });

    it('ツール使用を含むメッセージから適切にテキストを抽出する', () => {
      const line = JSON.stringify({
        message: {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'text', text: 'ファイルを確認します。' },
            { type: 'tool_use', name: 'Read', input: { file_path: '/path/to/file' } },
          ],
        },
      });

      const result = parseClaudeCodeLog(line);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('ファイルを確認します。');
    });

    it('長文のコード説明を処理する', () => {
      const longText = 'このコードは複雑な処理を行います。'.repeat(10);
      const line = JSON.stringify({
        message: {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'text', text: longText },
          ],
        },
      });

      const result = parseClaudeCodeLog(line);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe(longText);
    });

    it('日本語の技術用語を含むメッセージを処理する', () => {
      const line = JSON.stringify({
        message: {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'text', text: 'TypeScriptの型定義を追加しました。インターフェースとクラスを実装しています。' },
          ],
        },
      });

      const result = parseClaudeCodeLog(line);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('TypeScriptの型定義を追加しました。インターフェースとクラスを実装しています。');
      expect(result[0].emotion).toBe('neutral');
    });
  });

  describe('SpeakMessageの型検証', () => {
    it('正しいSpeakMessage型を返す', () => {
      const line = JSON.stringify({
        message: {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'text', text: 'テストメッセージ' },
          ],
        },
      });

      const result = parseClaudeCodeLog(line);

      expect(result[0]).toHaveProperty('type', 'speak');
      expect(result[0]).toHaveProperty('text');
      expect(result[0]).toHaveProperty('emotion');
      expect(['neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised']).toContain(result[0].emotion);
    });
  });
});
