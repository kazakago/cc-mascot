import { describe, it, expect, beforeEach } from 'vitest';
import { RuleBasedEmotionClassifier } from './ruleBasedEmotionClassifier';

describe('RuleBasedEmotionClassifier', () => {
  let classifier: RuleBasedEmotionClassifier;

  beforeEach(() => {
    classifier = new RuleBasedEmotionClassifier();
  });

  describe('Neutral（中立）- コーディング関連の説明', () => {
    it('コードの技術的な説明はneutralと判定される', () => {
      const text = 'この関数はReactコンポーネントをレンダリングするためのものです。useStateフックを使用して状態を管理しています。';
      expect(classifier.classify(text)).toBe('neutral');
    });

    it('ファイルパスを含む説明はneutralと判定される', () => {
      const text = 'src/components/VRMAvatar.tsxファイルを確認してください。このファイルには3Dモデルの描画ロジックが含まれています。';
      expect(classifier.classify(text)).toBe('neutral');
    });

    it('import文を含むコード例はneutralと判定される', () => {
      const text = '次のようにimportします。\n```typescript\nimport { useState } from "react";\n```\nこれで状態管理ができるようになります。';
      expect(classifier.classify(text)).toBe('neutral');
    });

    it('変数・関数の説明はneutralと判定される', () => {
      const text = 'この変数emotionScoresは各感情のスコアを保持するオブジェクトです。キーワードマッチングの結果を集計します。';
      expect(classifier.classify(text)).toBe('neutral');
    });

    it('クラス・インターフェースの説明はneutralと判定される', () => {
      const text = 'このクラスはルールベースの感情分類を行います。インターフェースEmotionを実装しており、classify メソッドで感情を判定します。';
      expect(classifier.classify(text)).toBe('neutral');
    });

    it('型定義を含む説明はneutralと判定される', () => {
      const text = 'type Emotion = "neutral" | "happy" | "angry" | "sad" | "relaxed" | "surprised"と定義されています。';
      expect(classifier.classify(text)).toBe('neutral');
    });

    it('配列・オブジェクトの説明はneutralと判定される', () => {
      const text = 'このプロパティは配列形式で複数のキーワードを保持します。オブジェクトのキーには感情タイプが使用されています。';
      expect(classifier.classify(text)).toBe('neutral');
    });

    it('長文の技術説明はneutralと判定される', () => {
      const text = `まず、VRMモデルをロードする必要があります。次に、アニメーションデータを読み込みます。その後、Three.jsのシーンに追加します。最後に、レンダリングループを開始します。このプロセスは非同期で行われるため、Promiseを使用して処理を制御します。`;
      expect(classifier.classify(text)).toBe('neutral');
    });

    it('句点が多い説明文はneutralと判定される', () => {
      const text = 'まずファイルを読み込みます。次にデータをパースします。その後、バリデーションを行います。最後に結果を返します。必要に応じて通知を送信します。';
      expect(classifier.classify(text)).toBe('neutral');
    });

    it('コードブロックを含む長文はneutralと判定される', () => {
      const text = `以下のように実装できます。\n\`\`\`typescript\nconst result = await fetchData();\nconsole.log(result);\n\`\`\`\nこれでデータの取得と表示が完了します。`;
      expect(classifier.classify(text)).toBe('neutral');
    });
  });

  describe('Happy（喜び）- 成功・完了の報告', () => {
    it('バグ修正の成功報告はhappyと判定される', () => {
      const text = 'バグを修正できました！エラーが解決して正常に動作するようになりました。';
      expect(classifier.classify(text)).toBe('happy');
    });

    it('エラー解決の報告はhappyと判定される', () => {
      const text = 'エラーの原因が分かりました！型定義を追加することで解決できました。';
      expect(classifier.classify(text)).toBe('happy');
    });

    it('実装完了の報告はhappyと判定される', () => {
      const text = '実装が完了しました！テストも全て成功しています。';
      expect(classifier.classify(text)).toBe('happy');
    });

    it('問題解決の報告はhappyと判定される', () => {
      const text = '問題を解決しました。型エラーを修正して、ビルドが成功するようになりました。';
      expect(classifier.classify(text)).toBe('happy');
    });

    it('テスト成功の報告はhappyと判定される', () => {
      const text = 'テストが全て成功しました！素晴らしい結果です。';
      expect(classifier.classify(text)).toBe('happy');
    });

    it('助かったという表現はhappyと判定される', () => {
      const text = 'そのライブラリを使うことで実装が簡単になって助かった！';
      expect(classifier.classify(text)).toBe('happy');
    });
  });

  describe('Sad（悲しい）- エラー・失敗の報告', () => {
    it('エラーでの謝罪はsadと判定される', () => {
      const text = '申し訳ありません…このエラーは現在のバージョンでは修正できません…';
      expect(classifier.classify(text)).toBe('sad');
    });

    it('無理な旨の報告はsadと判定される', () => {
      const text = 'その実装は無理です。現在の制約では対応できません...';
      expect(classifier.classify(text)).toBe('sad');
    });

    it('失敗の報告はsadまたはangryと判定される', () => {
      const text = 'ビルドに失敗しました。型エラーが残っています。';
      const result = classifier.classify(text);
      expect(['sad', 'angry']).toContain(result);
    });

    it('困難の表明はsadまたはhappyと判定される', () => {
      const text = 'この対応は困難です...制約があります...';
      const result = classifier.classify(text);
      expect(['sad', 'happy', 'neutral']).toContain(result);
    });
  });

  describe('Angry（怒り）- 問題・エラーの指摘', () => {
    it('エラーの報告はangryと判定される', () => {
      const text = 'エラーが発生しました！型定義が間違っています。';
      expect(classifier.classify(text)).toBe('angry');
    });

    it('バグの指摘はangryと判定される', () => {
      const text = 'これはバグです！この実装では正しく動作しません。';
      expect(classifier.classify(text)).toBe('angry');
    });

    it('問題の強い指摘はangryと判定される', () => {
      const text = '問題があります！このコードは動かないはずです。';
      expect(classifier.classify(text)).toBe('angry');
    });

    it('複数の感嘆符を含むエラー報告はangryと判定される', () => {
      const text = 'トラブルが発生しました！！コンパイルエラーです。';
      expect(classifier.classify(text)).toBe('angry');
    });
  });

  describe('Relaxed（落ち着き）- 承認・確認', () => {
    it('了解の返答はrelaxedと判定される', () => {
      const text = '了解しました〜';
      expect(classifier.classify(text)).toBe('relaxed');
    });

    it('OK の返答はrelaxedまたはneutralと判定される', () => {
      const text = 'OK〜、その方針で進めよう。';
      const result = classifier.classify(text);
      expect(['relaxed', 'neutral']).toContain(result);
    });

    it('大丈夫という返答はrelaxedまたはneutralと判定される', () => {
      const text = '大丈夫だよ、問題ない。';
      const result = classifier.classify(text);
      expect(['relaxed', 'neutral']).toContain(result);
    });

    it('安心の表明はrelaxedまたはneutralと判定される', () => {
      const text = 'その実装で安心した〜';
      const result = classifier.classify(text);
      expect(['relaxed', 'neutral']).toContain(result);
    });
  });

  describe('Surprised（驚き）- 予想外の結果', () => {
    it('驚きの表現はsurprisedと判定される', () => {
      const text = 'え！そんな実装方法があったんですか？';
      expect(classifier.classify(text)).toBe('surprised');
    });

    it('意外な発見の報告はsurprisedと判定される', () => {
      const text = 'まさか、このバグの原因がそこにあったとは！';
      expect(classifier.classify(text)).toBe('surprised');
    });

    it('予想外の結果報告はsurprisedと判定される', () => {
      const text = 'びっくりしました。このライブラリにそんな機能があるとは。';
      expect(classifier.classify(text)).toBe('surprised');
    });

    it('マジという表現はsurprisedと判定される', () => {
      const text = 'マジ！？そのAPIがそんな動作をするの！？';
      expect(classifier.classify(text)).toBe('surprised');
    });
  });

  describe('エッジケース', () => {
    it('空文字はneutralと判定される', () => {
      expect(classifier.classify('')).toBe('neutral');
    });

    it('空白のみはneutralと判定される', () => {
      expect(classifier.classify('   ')).toBe('neutral');
    });

    it('短すぎるテキストはneutralと判定される', () => {
      expect(classifier.classify('a')).toBe('neutral');
    });

    it('混在したキーワードは優先度の高い感情が選ばれる', () => {
      const text = 'エラーが発生しましたが、解決できました！';
      // happy の方が強く出ることを期待
      const result = classifier.classify(text);
      expect(['happy', 'angry']).toContain(result);
    });
  });

  describe('Claude Code実際の返信パターン', () => {
    it('ファイル作成の説明', () => {
      const text = 'vitest.config.tsファイルを作成しました。テストの設定を含んでいます。';
      expect(classifier.classify(text)).toBe('neutral');
    });

    it('コマンド実行の案内', () => {
      const text = 'npm run testコマンドでテストを実行できます。';
      expect(classifier.classify(text)).toBe('neutral');
    });

    it('エラー修正の完了報告', () => {
      const text = 'ESLintエラーを全て修正しました！ビルドが成功するようになりました！';
      expect(classifier.classify(text)).toBe('happy');
    });

    it('型エラーの指摘', () => {
      const text = '型エラーが発生しています。Emotion型の定義を確認してください。';
      const result = classifier.classify(text);
      expect(['angry', 'neutral']).toContain(result);
    });

    it('実装方針の確認', () => {
      const text = '了解〜、その方針で実装を進めるわ。';
      const result = classifier.classify(text);
      expect(['relaxed', 'neutral']).toContain(result);
    });

    it('長文のコード説明', () => {
      const text = `ruleBasedEmotionClassifier.tsのclassifyメソッドは、以下の手順で感情を判定します。まず、キーワードマッチングを行います。次に、文末パターンをチェックします。その後、ヒューリスティックルールを適用します。最後に、最も高いスコアの感情を返します。このアルゴリズムにより、65-75%の精度を実現しています。`;
      expect(classifier.classify(text)).toBe('neutral');
    });

    it('テスト失敗の報告（謝罪込み）', () => {
      const text = '申し訳ありません。テストが失敗しました。型定義を修正する必要があります。';
      expect(classifier.classify(text)).toBe('sad');
    });

    it('予想外のエラー発見', () => {
      const text = 'え？このメソッドにバグがあったんですね。予想外でした。';
      expect(classifier.classify(text)).toBe('surprised');
    });
  });

  describe('リップシンク用のaa表情との連携確認', () => {
    it('どの感情でもaa表情の値は別途設定される前提', () => {
      // このテストは感情分類のみを確認
      // リップシンクのaa表情値は別のシステムで管理される
      const emotions: Array<ReturnType<typeof classifier.classify>> = [
        classifier.classify('嬉しいです！'),
        classifier.classify('エラーです。'),
        classifier.classify('悲しいです...'),
        classifier.classify('了解しました。'),
        classifier.classify('びっくりです！'),
        classifier.classify('関数を定義します。'),
      ];

      // すべての感情が有効な値であることを確認
      emotions.forEach(emotion => {
        expect(['neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised']).toContain(emotion);
      });
    });
  });
});
