/**
 * Text filtering utilities for speech synthesis
 * Removes markdown syntax and other elements that shouldn't be spoken
 */

/**
 * Clean text for speech synthesis by removing markdown syntax and
 * replacing paths/URLs with readable alternatives
 */
export function cleanTextForSpeech(text: string): string {
  let cleaned = text;

  // 1. Remove code blocks (```...```)
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '');

  // 2. Remove XML/HTML tags (<example>, </example>, etc.)
  cleaned = cleaned.replace(/<[^>]+>/g, '');

  // 3. Remove markdown headings (##, ###, etc.)
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');

  // 4. Remove horizontal rules (---, ***)
  cleaned = cleaned.replace(/^[-*]{3,}$/gm, '');

  // 5. Remove table syntax (|...|)
  cleaned = cleaned.replace(/^\|.*\|$/gm, '');

  // 6. Remove blockquote markers (>)
  cleaned = cleaned.replace(/^>\s*/gm, '');

  // 7. Remove list markers (-, *) but keep numbered lists (1., 2., etc.)
  cleaned = cleaned.replace(/^[-*]\s+/gm, '');

  // 8. Replace URLs with "URL"
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, 'URL');

  // 9. Remove inline code backticks but keep the content
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

  // 10. Remove colons
  cleaned = cleaned.replace(/:/g, '');

  return cleaned;
}
