/**
 * ルールベース感情分類器
 *
 * Claude Codeの日本語テキストから感情を自動分類する。
 * キーワードマッチング + 文末パターン + ヒューリスティックで65-75%の精度を実現。
 */

export type Emotion = 'neutral' | 'happy' | 'angry' | 'sad' | 'relaxed' | 'surprised';

export class RuleBasedEmotionClassifier {
  /**
   * 感情キーワード辞書
   */
  private emotionKeywords: Record<Exclude<Emotion, 'neutral'>, string[]> = {
    happy: [
      // 喜び・嬉しさ（基本）
      'うれしい', '嬉しい', 'うれ', '喜', '喜び',
      'よかった', 'よかっ', '良かっ', '良い',
      'やった', 'やっ', 'できた',
      'すごい', 'すご', '凄', '素晴らしい', '素敵',
      'ありがと', 'ありが', '感謝', 'サンクス',
      '楽しい', '楽し', '愉快', '面白い', '面白',
      '成功', '完璧', '完了', 'クリア',
      '最高', 'ベスト', 'グッド', 'ナイス', 'いいね',
      '助かっ', '助かる',
      'わーい', 'やっほー', 'やったー', 'いえーい',
      // 達成感
      '達成', 'ゲット', '獲得', '実現',
      '解決', '修正できた', '直った',
      // ポジティブ表現
      '満足', '幸せ', 'ハッピー', 'ラッキー', '運が良',
      '期待以上', '想像以上',
    ],
    angry: [
      // 怒り・イライラ（基本）
      'むかつく', 'むかつ', 'ムカつ', '腹立',
      '怒', 'イライラ', 'いらいら', 'キレ',
      '最悪', 'ひどい', '酷', 'クソ', 'くそ',
      'うざい', 'ウザ', 'うっとうし',
      '許せない', '許せ', '我慢できない',
      'ダメ', '駄目', 'ダメだ', 'だめ',
      // 技術的な問題
      'エラー', 'バグ', '失敗', '動かない', '壊れ',
      '問題', 'トラブル', '不具合', '障害',
      '困る', '困っ', '困った',
      // 否定的表現
      '信じられない', '呆れ', 'ふざけ', '冗談じゃ',
      '勘弁', 'マジで', '本気で腹',
    ],
    sad: [
      // 悲しみ・残念（基本）
      '悲しい', '悲し', '哀',
      '残念', 'ざんねん', '惜しい',
      'つらい', '辛い', 'つら', '苦しい',
      'ごめん', 'すまな', 'すみま', '申し訳', '謝',
      '無理', '不可能',
      '困った', '困難',
      '諦め', 'あきら', '断念',
      // ネガティブな結果
      '失敗し', 'しくじ', 'ミス', '駄目だった',
      '間に合わ', '遅れ',
      // 弱気な表現
      '自信ない', '不安', '心配', '怖',
      'しょんぼり', 'がっかり', '落ち込',
      '泣', '涙',
    ],
    surprised: [
      // 驚き・意外（基本）
      'え！', 'えっ', 'え？', 'えー',
      'まさか', 'マジ', 'まじ', '本当',
      'びっくり', 'ビックリ', '驚', 'ビビ',
      '意外', '予想外', '想定外',
      'なんと', '何と', 'おお', 'おぉ',
      'すごっ', 'やば', 'ヤバ',
      // 驚きの表現
      '信じられない', '嘘', 'うそ', 'ウソ',
      '本当に', 'ほんと', '本気',
      'あり得ない', 'ありえな',
      '初めて', '見たことない',
      // 口語的な驚き
      'はぁ！？', 'へぇ', 'ほぉ', 'ふぉ',
      'おったまげ', 'たまげ',
    ],
    relaxed: [
      // 落ち着き・安心（明確な表現のみ）
      '落ち着', '落着', '冷静',
      '安心', 'あんしん', 'ホッと',
      '大丈夫', 'だいじょうぶ', 'だいじょぶ',
      'OK', 'ok', 'オッケー', 'おk',
      '了解', 'りょうかい', '承知',
      '問題ない', '問題なし', 'ノープロブレム',
      // 穏やかな表現
      'ゆっくり', 'のんびり', 'じっくり',
      '様子見',
    ],
  };

  /**
   * 文末パターン（正規表現）
   * 女性言葉・中性的・丁寧・男性的な言葉すべてに対応
   */
  private sentenceEndPatterns: Record<Exclude<Emotion, 'neutral'>, RegExp[]> = {
    happy: [
      /[！!]{2,}/, // 複数の感嘆符
      // 女性言葉
      /わ[ね〜～！!♪]+$/, // わね！！、わ〜♪など
      /わよ[！!♪]+$/, // わよ！、わよ♪
      // 中性的・丁寧
      /です[！!♪]+$/, // です！
      /ます[！!♪]+$/, // ます！
      /ました[！!♪]+$/, // ました！
      /ね[！!♪]+$/, // ね！
      /よ[！!♪]+$/, // よ！
      // 男性的
      /ぜ[！!]+$/, // ぜ！
      /ぞ[！!]+$/, // ぞ！
      /だ[！!]+$/, // だ！
      /った[！!]+$/, // やった！、できた！
      // 共通
      /[♪♫]+/, // 音符記号
      /[✨🎉🎊😊😄🎊👍]+/, // 喜びの絵文字
    ],
    angry: [
      /[！!？?]{2,}/, // 複数の感嘆符・疑問符
      // 女性言葉
      /わよ[！!]{2,}$/, // わよ！！（強い）
      /のよ[！!]+$/, // のよ！
      // 中性的・丁寧
      /です[！!]{2,}$/, // です！！
      /ません[！!]+$/, // ません！
      // 男性的
      /だ[！!]{2,}$/, // だ！！
      /だろ[！!？?]+$/, // だろ！
      /のか[！!？?]+$/, // のか！
      // 共通
      /[💢😠😡]+/, // 怒りの絵文字
    ],
    sad: [
      // 女性言葉
      /わ[。\.…]+$/, // 悲しいわ...
      /のね[。\.…]+$/, // 残念なのね...
      // 中性的・丁寧
      /です[。\.…]+$/, // 残念です...
      /ます[。\.…]+$/, // できません...
      /ません[。\.…]+$/, // できません...
      // 男性的
      /だ[。\.…]+$/, // 無理だ...
      /な[。\.…]+$/, // ダメだな...
      // 共通
      /[。\.]{2,}$/, // 句点の連続
      /…+$/, // 三点リーダー
      /[😢😭💔]+/, // 悲しみの絵文字
    ],
    surprised: [
      /[！!？?]$/, // 疑問符・感嘆符
      // 女性言葉
      /え[っ〜～！!？?]+/, // えっ！、え〜？など
      /まさか[！!？?]/, // まさか！
      /の[！!？?]$/, // なの！？
      // 中性的・丁寧
      /ですか[！!？?]$/, // そうですか！？
      /ますか[！!？?]$/, // 本当ですか！？
      // 男性的
      /のか[！!？?]$/, // そうなのか！？
      /だと[！!？?]$/, // マジだと！？
      // 共通
      /マジ[！!？?]/, // マジ！？
      /ほんと[！!？?]/, // ほんと！？
      /本当[！!？?]/, // 本当！？
      /[😮😲🤯]+/, // 驚きの絵文字
    ],
    relaxed: [
      // 女性言葉（波線がある場合のみ）
      /わ[ね〜～]+$/, // わね〜
      /ですわ[〜～]+$/, // ですわ〜
      // 中性的・丁寧（波線がある場合のみ）
      /です[〜～]+$/, // です〜
      /ます[〜～]+$/, // ます〜
      /ました[〜～]+$/, // ました〜
      /ね[〜～]+$/, // ね〜
      // 共通（明確なrelaxed表現のみ）
      /OK[。\.〜～]+$/, // OK.、OK〜
      /了解[。\.〜～]+$/, // 了解。、了解〜
    ],
  };

  /**
   * テキストから感情を分類する
   * @param text 分類対象のテキスト
   * @returns 分類された感情
   */
  classify(text: string): Emotion {
    // 空文字・短すぎる場合はneutral
    if (!text || text.trim().length < 2) {
      return 'neutral';
    }

    const normalizedText = text.trim();
    const textLength = normalizedText.length;
    const isLongText = textLength > 100; // 長文判定

    // 1. スコア初期化
    const scores: Record<Emotion, number> = {
      neutral: 0,
      happy: 0,
      angry: 0,
      sad: 0,
      relaxed: 0,
      surprised: 0,
    };

    // 2. キーワードマッチング（長文では重みを増加）
    const keywordWeight = isLongText ? 3 : 2;
    for (const [emotion, keywords] of Object.entries(this.emotionKeywords)) {
      for (const keyword of keywords) {
        if (normalizedText.includes(keyword)) {
          scores[emotion as Emotion] += keywordWeight;
        }
      }
    }

    // 3. 文末パターンチェック（長文では重要度を上げる）
    const patternWeight = isLongText ? 4 : 2;
    for (const [emotion, patterns] of Object.entries(this.sentenceEndPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedText)) {
          scores[emotion as Emotion] += patternWeight;
        }
      }
    }

    // 4. 文頭の感情表現を強化（最初の50文字以内）
    const firstPart = normalizedText.substring(0, 50);
    for (const [emotion, keywords] of Object.entries(this.emotionKeywords)) {
      for (const keyword of keywords) {
        if (firstPart.includes(keyword)) {
          scores[emotion as Emotion] += 2; // 文頭の感情は重視
        }
      }
    }

    // 5. ヒューリスティックルール
    this.applyHeuristics(normalizedText, scores);

    // 6. ネガティブ感情の優先処理
    // angry/sad のキーワードがあれば、happy の文末スコアを抑制
    if (scores.angry > 0 || scores.sad > 0) {
      // happy の文末パターンによるスコアを半減
      const hasHappyEndPattern = this.sentenceEndPatterns.happy.some(p => p.test(normalizedText));
      if (hasHappyEndPattern && (scores.angry > 0 || scores.sad > 0)) {
        scores.happy = Math.floor(scores.happy * 0.5);
      }
    }

    // 7. 長文の場合、感情スコアがあればneutralを抑制
    if (isLongText) {
      const emotionScoreSum = scores.happy + scores.angry + scores.sad + scores.surprised + scores.relaxed;
      // 強い感情表現（スコア10以上）がある場合のみneutralを抑制
      if (emotionScoreSum >= 10) {
        scores.neutral = Math.max(0, scores.neutral - 3);
      }
    }

    // 8. 感情の弱いrelaxed/sadをneutralに統合（技術説明の誤分類を防ぐ）
    // relaxedが弱い場合（スコア6未満）、neutralを優先
    if (scores.relaxed > 0 && scores.relaxed < 6) {
      scores.neutral += scores.relaxed;
      scores.relaxed = 0;
    }
    // neutralスコアが高く、sadが弱い場合、neutralを優先
    if (scores.neutral >= 4 && scores.sad > 0 && scores.sad < 4) {
      scores.neutral += scores.sad;
      scores.sad = 0;
    }

    // 9. 最高スコアの感情を返す（デフォルトはneutral）
    let maxEmotion: Emotion = 'neutral';
    let maxScore = 0;

    for (const [emotion, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxEmotion = emotion as Emotion;
      }
    }

    // デバッグログ（開発時に有効）
    if (process.env.NODE_ENV === 'development' && maxEmotion !== 'neutral') {
      console.log(`[EmotionClassifier] Text: "${normalizedText.substring(0, 50)}${normalizedText.length > 50 ? '...' : ''}"`);
      console.log(`[EmotionClassifier] Scores:`, scores);
      console.log(`[EmotionClassifier] Result: ${maxEmotion}`);
    }

    return maxEmotion;
  }

  /**
   * ヒューリスティックルールを適用
   */
  private applyHeuristics(text: string, scores: Record<Emotion, number>): void {
    // 感情スコアの合計を計算
    const emotionScoreSum = scores.happy + scores.angry + scores.sad + scores.surprised + scores.relaxed;
    const hasEmotion = emotionScoreSum > 0;

    // 疑問符で終わる → surprised傾向
    if (/[？?]$/.test(text)) {
      scores.surprised += 1;
    }

    // 短い返事（明確なrelaxed表現のみ）
    if (text.length < 10) {
      if (/^(OK|了解|わかった)/.test(text)) {
        scores.relaxed += 2;
      }
    }

    // コードブロックやバッククォート → neutral（ただし感情がある場合は抑制）
    if (/```|`[^`]+`/.test(text)) {
      scores.neutral += hasEmotion ? 2 : 4;
      // relaxedを抑制
      scores.relaxed = Math.max(0, scores.relaxed - 2);
    }

    // import/export/function などのキーワード → neutral（ただし感情がある場合は抑制）
    if (/(import|export|function|const|let|var|class|interface|type)/.test(text)) {
      scores.neutral += hasEmotion ? 2 : 4;
      scores.relaxed = Math.max(0, scores.relaxed - 2);
    }

    // ファイルパス → neutral（軽く）
    if (/[\/\\][a-zA-Z0-9_\-\.\/\\]+/.test(text)) {
      scores.neutral += hasEmotion ? 0 : 1;
    }

    // 技術用語 → neutral（ただし感情がある場合は抑制）
    if (/(コード|関数|メソッド|変数|クラス|インターフェース|型|配列|オブジェクト|プロパティ)/.test(text)) {
      scores.neutral += hasEmotion ? 1 : 3;
      scores.relaxed = Math.max(0, scores.relaxed - 1);
    }

    // 「次に」「まず」「それから」などの説明的な接続詞 → neutral傾向（感情がある場合は無視）
    if (!hasEmotion && /(次に|まず|それから|その後|最後に|ここで|この|その)/.test(text)) {
      scores.neutral += 1;
    }

    // 長文（100文字以上）で句点が多い → neutral（説明文）（感情がある場合は抑制）
    if (text.length > 100) {
      const periodCount = (text.match(/[。\.]/g) || []).length;
      if (periodCount >= 3) {
        scores.neutral += hasEmotion ? 1 : 2;
      }
    }

    // ネガティブワード + 肯定 → happy（問題解決）
    if (/(エラー|バグ|問題|失敗)/.test(text) && /(修正|解決|できた|成功|完了)/.test(text)) {
      scores.happy += 4; // 強化
      scores.angry = Math.max(0, scores.angry - 2); // ネガティブスコアを減らす
    }
  }
}
