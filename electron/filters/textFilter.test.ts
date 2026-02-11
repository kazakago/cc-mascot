import { describe, it, expect } from "vitest";
import { cleanTextForSpeech } from "./textFilter";

describe("cleanTextForSpeech", () => {
  describe("コードブロックの除去", () => {
    it("バッククォート3つのコードブロックを除去する", () => {
      const text = "以下のコードを使用します。\n```typescript\nconst x = 1;\n```\nこれで完了です。";
      const result = cleanTextForSpeech(text);

      expect(result).not.toContain("```");
      expect(result).not.toContain("const x = 1");
      expect(result).toContain("以下のコードを使用します。");
      expect(result).toContain("これで完了です。");
    });

    it("複数のコードブロックを除去する", () => {
      const text = "```\ncode1\n```\nテキスト\n```\ncode2\n```";
      const result = cleanTextForSpeech(text);

      expect(result).not.toContain("code1");
      expect(result).not.toContain("code2");
      expect(result).toContain("テキスト");
    });

    it("言語指定付きコードブロックを除去する", () => {
      const text = '```javascript\nconsole.log("hello");\n```';
      const result = cleanTextForSpeech(text);

      expect(result).not.toContain("console.log");
    });
  });

  describe("インラインコードの処理", () => {
    it("インラインコードのバッククォートを除去してコンテンツを保持する", () => {
      const text = "`useState`フックを使用します。";
      const result = cleanTextForSpeech(text);

      expect(result).not.toContain("`");
      expect(result).toContain("useState");
      expect(result).toContain("フックを使用します。");
    });

    it("複数のインラインコードを処理する", () => {
      const text = "`foo`と`bar`と`baz`があります。";
      const result = cleanTextForSpeech(text);

      expect(result).toContain("foo");
      expect(result).toContain("bar");
      expect(result).toContain("baz");
      expect(result).not.toContain("`");
    });
  });

  describe("XML/HTMLタグの除去", () => {
    it("XMLタグを除去する", () => {
      const text = "<example>これは例です</example>通常のテキスト";
      const result = cleanTextForSpeech(text);

      expect(result).not.toContain("<example>");
      expect(result).not.toContain("</example>");
      expect(result).toContain("これは例です");
      expect(result).toContain("通常のテキスト");
    });

    it("自己閉じタグを除去する", () => {
      const text = "テキスト<br/>改行後のテキスト";
      const result = cleanTextForSpeech(text);

      expect(result).not.toContain("<br/>");
    });

    it("属性付きタグを除去する", () => {
      const text = '<div class="test">コンテンツ</div>';
      const result = cleanTextForSpeech(text);

      expect(result).not.toContain("<div");
      expect(result).not.toContain("</div>");
      expect(result).toContain("コンテンツ");
    });
  });

  describe("マークダウン構文の除去", () => {
    it("見出しマーカーを除去する", () => {
      const text = "## 見出し2\n### 見出し3\n通常のテキスト";
      const result = cleanTextForSpeech(text);

      expect(result).not.toContain("##");
      expect(result).not.toContain("###");
      expect(result).toContain("見出し2");
      expect(result).toContain("見出し3");
    });

    it("水平線を除去する", () => {
      const text = "テキスト1\n---\nテキスト2\n***\nテキスト3";
      const result = cleanTextForSpeech(text);

      expect(result).not.toContain("---");
      expect(result).not.toContain("***");
      expect(result).toContain("テキスト1");
      expect(result).toContain("テキスト2");
    });

    it("テーブル構文を除去する", () => {
      const text = "| 列1 | 列2 |\n通常のテキスト";
      const result = cleanTextForSpeech(text);

      expect(result).not.toContain("| 列1 | 列2 |");
      expect(result).toContain("通常のテキスト");
    });

    it("引用符マーカーを除去する", () => {
      const text = "> これは引用です\n> 2行目の引用\n通常のテキスト";
      const result = cleanTextForSpeech(text);

      expect(result).not.toContain(">");
      expect(result).toContain("これは引用です");
      expect(result).toContain("2行目の引用");
    });

    it("リストマーカー（- と *）を除去する", () => {
      const text = "- アイテム1\n* アイテム2\n通常のテキスト";
      const result = cleanTextForSpeech(text);

      expect(result).toContain("アイテム1");
      expect(result).toContain("アイテム2");
      // リストマーカーの後のスペースも除去されるため、行頭の - や * がないことを確認
      expect(result).not.toMatch(/^-\s/m);
      expect(result).not.toMatch(/^\*\s/m);
    });

    it("番号付きリストは保持する", () => {
      const text = "1. 最初の項目\n2. 2番目の項目";
      const result = cleanTextForSpeech(text);

      expect(result).toContain("1.");
      expect(result).toContain("2.");
      expect(result).toContain("最初の項目");
    });
  });

  describe("URLの除去", () => {
    it("HTTPSのURLを除去する", () => {
      const text = "こちらをご覧ください https://example.com/path です。";
      const result = cleanTextForSpeech(text);

      expect(result).not.toContain("https://example.com/path");
      expect(result).toContain("こちらをご覧ください");
    });

    it("HTTPのURLを除去する", () => {
      const text = "リンク http://example.com はこちら。";
      const result = cleanTextForSpeech(text);

      expect(result).not.toContain("http://example.com");
    });

    it("複数のURLを除去する", () => {
      const text = "https://site1.com と https://site2.com を参照。";
      const result = cleanTextForSpeech(text);

      expect(result).not.toContain("site1.com");
      expect(result).not.toContain("site2.com");
      expect(result).toContain("と");
      expect(result).toContain("を参照。");
    });

    it("クエリパラメータ付きURLを除去する", () => {
      const text = "https://example.com?param=value&other=123";
      const result = cleanTextForSpeech(text);

      expect(result).not.toContain("example.com");
    });
  });

  describe("コロンの除去", () => {
    it("コロンを除去する", () => {
      const text = "次のように実装します: コードはこちら";
      const result = cleanTextForSpeech(text);

      expect(result).not.toContain(":");
      expect(result).toContain("次のように実装します");
      expect(result).toContain("コードはこちら");
    });

    it("複数のコロンを除去する", () => {
      const text = "項目1: 値1, 項目2: 値2";
      const result = cleanTextForSpeech(text);

      expect(result).not.toContain(":");
    });
  });

  describe("かっこの読み上げ変換", () => {
    it("半角かっこを読み上げテキストに変換する", () => {
      const text = "関数(引数)を呼び出す";
      const result = cleanTextForSpeech(text);

      expect(result).toBe("関数、かっこ、引数、かっこ閉じ、を呼び出す");
    });

    it("全角かっこを読み上げテキストに変換する", () => {
      const text = "テキスト（補足情報）です。";
      const result = cleanTextForSpeech(text);

      expect(result).toBe("テキスト、かっこ、補足情報、かっこ閉じ、です。");
    });

    it("半角と全角が混在する場合を処理する", () => {
      const text = "(半角)と（全角）の混在";
      const result = cleanTextForSpeech(text);

      expect(result).toBe("、かっこ、半角、かっこ閉じ、と、かっこ、全角、かっこ閉じ、の混在");
    });

    it("丸括弧以外の括弧はそのまま保持する", () => {
      const text = "【重要】彼は「了解」と言った。『本』です。";
      const result = cleanTextForSpeech(text);

      expect(result).toContain("【重要】");
      expect(result).toContain("「了解」");
      expect(result).toContain("『本』");
    });
  });

  describe("複合的なクリーニング", () => {
    it("複数の要素を含むテキストを総合的にクリーニングする", () => {
      const text = `
## テスト見出し

以下のコードを確認してください:

\`\`\`typescript
const greeting = "Hello";
\`\`\`

詳細は https://example.com を参照。

- リスト項目1
- リスト項目2

\`console.log\` を使用します。
      `.trim();

      const result = cleanTextForSpeech(text);

      // 除去されるべきもの
      expect(result).not.toContain("##");
      expect(result).not.toContain("```");
      expect(result).not.toContain("const greeting");
      expect(result).not.toContain("https://example.com");
      expect(result).not.toContain(":");
      expect(result).not.toContain("`");

      // 保持されるべきもの
      expect(result).toContain("テスト見出し");
      expect(result).toContain("以下のコードを確認してください");
      expect(result).toContain("詳細は");
      expect(result).not.toContain("URL");
      expect(result).toContain("リスト項目1");
      expect(result).toContain("console.log");
    });

    it("実際のClaude Code返信パターンをクリーニングする", () => {
      const text = `
了解しました。\`ruleBasedEmotionClassifier.ts\`のテストを実装します。

以下のようにテストファイルを作成します:

\`\`\`typescript
import { describe, it, expect } from 'vitest';
\`\`\`

詳細は https://vitest.dev を参照してください。
      `.trim();

      const result = cleanTextForSpeech(text);

      expect(result).toContain("了解しました");
      expect(result).toContain("ruleBasedEmotionClassifier.ts");
      expect(result).toContain("のテストを実装します");
      expect(result).not.toContain("URL");
      expect(result).not.toContain("```");
      expect(result).not.toContain("import");
      expect(result).not.toContain("vitest.dev");
    });
  });

  describe("エッジケース", () => {
    it("空文字列を処理する", () => {
      const result = cleanTextForSpeech("");
      expect(result).toBe("");
    });

    it("空白のみのテキストを処理する", () => {
      const result = cleanTextForSpeech("   \n\n   ");
      expect(result).toBe("   \n\n   ");
    });

    it("日本語のみのテキストはそのまま返す", () => {
      const text = "これは普通の日本語テキストです。";
      const result = cleanTextForSpeech(text);
      expect(result).toBe(text);
    });

    it("特殊文字を含むテキストを処理する", () => {
      const text = "テキスト「引用」とか（括弧）など。";
      const result = cleanTextForSpeech(text);
      expect(result).toContain("「引用」");
      expect(result).toContain("、かっこ、括弧、かっこ閉じ、");
    });

    it("改行を保持する", () => {
      const text = "1行目\n2行目\n3行目";
      const result = cleanTextForSpeech(text);
      expect(result).toContain("\n");
      expect(result).toContain("1行目");
      expect(result).toContain("2行目");
      expect(result).toContain("3行目");
    });
  });
});
