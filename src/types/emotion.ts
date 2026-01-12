// Emotion types for VRM avatar expressions
export type Emotion = 'neutral' | 'happy' | 'angry' | 'sad' | 'relaxed' | 'surprised';

/**
 * Maps user-facing emotion names to VRM expression names
 * - neutral: 通常
 * - happy: 喜び
 * - angry: 怒り
 * - sad: 悲しみ
 * - relaxed: 楽しみ
 * - surprised: 驚き
 */
export const EMOTION_TO_EXPRESSION: Record<Emotion, string> = {
  neutral: 'neutral',
  happy: 'happy',
  angry: 'angry',
  sad: 'sad',
  relaxed: 'relaxed',
  surprised: 'surprised',
};

/**
 * Get VRM expression name from emotion
 */
export function getExpressionName(emotion: Emotion): string {
  return EMOTION_TO_EXPRESSION[emotion];
}
