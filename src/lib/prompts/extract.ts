export const buildExtractionPrompt = (text: string): string => `
You are a product review analyst. Analyze this customer review and return ONLY valid JSON.

Review: "${text}"

Return this exact structure:
{
  "overall_sentiment": "positive" | "negative" | "neutral" | "ambiguous",
  "overall_confidence": 0.0-1.0,
  "is_sarcastic": true | false,
  "is_ambiguous": true | false,
  "language_detected": "en" | "hi" | "mixed",
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
- If sarcastic OR ambiguous: set is_sarcastic/is_ambiguous to true.
- Confidence = your certainty in that extraction (0 = guessing, 1 = certain).
- Return ONLY the JSON object. No markdown, no explanation.
`;
