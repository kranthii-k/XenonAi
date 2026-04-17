import LanguageDetect from 'languagedetect';

const detector = new LanguageDetect();

// Languages the system tracks explicitly
const SUPPORTED_LANGUAGES: Record<string, string> = {
  english: 'en',
  hindi: 'hi',
  tamil: 'ta',
  telugu: 'te',
  kannada: 'kn',
  malayalam: 'ml',
  marathi: 'mr',
  bengali: 'bn',
  punjabi: 'pa',
  gujarati: 'gu',
};

export interface LanguageDetectionResult {
  code: string;           // ISO 639-1 code ('en', 'hi', 'mixed', 'unknown')
  name: string;           // human-readable
  confidence: number;     // 0–1
  isMixed: boolean;       // Hinglish, code-switching, etc.
  needsTranslation: boolean;
}

/**
 * Detect the primary language of a review.
 *
 * Strategy:
 *   1. Run languagedetect on the full text
 *   2. If top result is English with >= 0.3 confidence → 'en'
 *   3. If top result is a known Indian language → return that code
 *   4. If English score is in the top 2 AND another language is also detected
 *      with score > 0.2 → 'mixed' (Hinglish / code-switching)
 *   5. Fallback → 'unknown', treat as English for Claude
 */
export function detectLanguage(text: string): LanguageDetectionResult {
  // Require at least 5 characters for meaningful detection
  if (!text || text.trim().length < 5) {
    return { code: 'en', name: 'English', confidence: 0, isMixed: false, needsTranslation: false };
  }

  const detections = detector.detect(text, 5); // top-5 candidates

  if (!detections || detections.length === 0) {
    return { code: 'unknown', name: 'Unknown', confidence: 0, isMixed: false, needsTranslation: false };
  }

  // detections: Array<[languageName, score]>
  const top = detections[0];
  const topName = top[0].toLowerCase();
  const topScore = top[1] as number;

  // Check if English appears in top-2
  const englishEntry = detections.slice(0, 3).find(([name]) => name.toLowerCase() === 'english');
  const englishScore = englishEntry ? (englishEntry[1] as number) : 0;

  // Map top language to code
  const topCode = SUPPORTED_LANGUAGES[topName] ?? topName.slice(0, 2).toLowerCase();

  // Mixed language detection: English is present but not the only one
  const nonEnglishInTop = detections.slice(0, 3).find(
    ([name, score]) => name.toLowerCase() !== 'english' && (score as number) > 0.15
  );
  const isMixed = !!(englishScore > 0.15 && nonEnglishInTop && topCode !== 'en');

  if (isMixed) {
    return {
      code: 'mixed',
      name: 'Mixed (Hinglish / Code-switched)',
      confidence: Math.max(topScore, englishScore),
      isMixed: true,
      needsTranslation: false, // Claude handles Hinglish natively
    };
  }

  if (topCode === 'en' || topName === 'english') {
    return {
      code: 'en',
      name: 'English',
      confidence: topScore,
      isMixed: false,
      needsTranslation: false,
    };
  }

  const knownCode = SUPPORTED_LANGUAGES[topName];
  if (knownCode) {
    return {
      code: knownCode,
      name: topName.charAt(0).toUpperCase() + topName.slice(1),
      confidence: topScore,
      isMixed: false,
      needsTranslation: knownCode !== 'en', // non-English needs translation note for Claude
    };
  }

  // Likely short text or noise — default to English
  return {
    code: 'en',
    name: 'English (assumed)',
    confidence: 0.1,
    isMixed: false,
    needsTranslation: false,
  };
}

/**
 * Build a language-aware prefix for Claude prompts.
 * If the review is not in English, we instruct Claude to
 * first internally translate, then analyze — no external API needed.
 */
export function buildLanguageInstruction(langResult: LanguageDetectionResult): string {
  if (langResult.code === 'en') return '';
  if (langResult.isMixed) {
    return `Note: This review appears to be in Hinglish or a mixed language. 
Internally translate to English before analysis, then proceed.\n\n`;
  }
  if (langResult.needsTranslation) {
    return `Note: This review is in ${langResult.name}. 
Internally translate to English before analysis, then proceed.\n\n`;
  }
  return '';
}
