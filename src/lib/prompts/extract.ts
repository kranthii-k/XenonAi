/**
 * Build the structured extraction prompt for Claude.
 *
 * @param text - The review text (normalised, but not stripped of meaning)
 * @param languagePrefix - Optional language instruction from translator.ts
 */
export const buildExtractionPrompt = (text: string, languagePrefix = ''): string => `
You are a product review analyst. Analyze this customer review and return ONLY valid JSON.

${languagePrefix}Review: "${text}"

Return this exact structure:
{
  "overall_sentiment": "positive" | "negative" | "neutral" | "ambiguous",
  "overall_confidence": 0.0-1.0,
  "is_sarcastic": true | false,
  "is_ambiguous": true | false,
  "language_detected": "en" | "hi" | "mixed" | "ta" | "te" | "kn" | "ml" | "mr" | "bn" | "unknown",
  "translated_text": "<English translation if non-English, else null>",
  "features": [
    {
      "feature": "battery_life" | "packaging" | "delivery_speed" | 
                 "build_quality" | "customer_support" | "price_value" | 
                 "taste" | "fragrance" | "effectiveness" | "other",
      "sentiment": "positive" | "negative" | "neutral",
      "confidence": 0.0-1.0,
      "quote": "<exact short phrase from review>"
    }
  ],
  "sarcasm_reason": "<why flagged as sarcastic, or null>",
  "ambiguity_reason": "<why ambiguous, or null>"
}

Rules:
- Only extract features ACTUALLY mentioned. Do not invent features.
- If sarcastic: the SENTIMENT should reflect true meaning, not surface words.
  Example: "Oh great, broke in a week" → overall_sentiment = negative, is_sarcastic = true.
- If ambiguous: set is_ambiguous = true, explain in ambiguity_reason.
- Confidence = your certainty in that extraction (0 = guessing, 1 = certain).
- For translated_text: provide English translation ONLY for non-English reviews. Set null for English.
- Return ONLY the JSON object. No markdown, no explanation, no code fences.
`.trim();
