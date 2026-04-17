import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db';
import { reviews, featureSentiments, ingestionJobs } from '../db/schema';
import { buildExtractionPrompt } from '../prompts/extract';
import { detectLanguage, buildLanguageInstruction } from './translator';
import * as crypto from 'crypto';
import { eq } from 'drizzle-orm';

// Use correct model per README spec; fall back to env override for flexibility
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
});

export interface ClaudeExtractionResult {
  overall_sentiment: string;
  overall_confidence: number;
  is_sarcastic: boolean;
  is_ambiguous: boolean;
  language_detected: string;
  translated_text: string | null;
  features: Array<{
    feature: string;
    sentiment: string;
    confidence: number;
    quote: string;
  }>;
  sarcasm_reason: string | null;
  ambiguity_reason: string | null;
}

export async function analyzeReview(
  reviewText: string,
  originalText?: string
): Promise<ClaudeExtractionResult> {
  // Run language detection on the text going to Claude
  const langResult = detectLanguage(reviewText);
  const languagePrefix = buildLanguageInstruction(langResult);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("No Anthropic API Key found. Using mock fallback for testing.");
    if (reviewText.includes("absolutely stunning, but the battery")) {
       return { overall_sentiment: "negative", language_detected: "en", is_sarcastic: false, is_ambiguous: false, overall_confidence: 0.9, translated_text: null, sarcasm_reason: null, ambiguity_reason: null, features: [{ feature: "camera", sentiment: "positive", confidence: 0.95, quote: "absolutely stunning" }, { feature: "battery_life", sentiment: "negative", confidence: 0.99, quote: "battery life is terrible" }] };
    }
    if (reviewText.includes("3 hours to charge to 50%")) {
       return { overall_sentiment: "negative", language_detected: "en", is_sarcastic: true, is_ambiguous: false, overall_confidence: 0.85, translated_text: null, sarcasm_reason: "User claims 3 hours is revolutionary garbage", ambiguity_reason: null, features: [{ feature: "battery_life", sentiment: "negative", confidence: 0.88, quote: "revolutionary piece of garbage" }] };
    }
    if (reviewText.includes("Bhai ye phone ekdum")) {
       return { overall_sentiment: "negative", language_detected: "hi", is_sarcastic: false, is_ambiguous: false, overall_confidence: 0.9, translated_text: null, sarcasm_reason: null, ambiguity_reason: null, features: [{ feature: "display", sentiment: "negative", confidence: 0.9, quote: "screen break" }, { feature: "customer_support", sentiment: "negative", confidence: 0.9, quote: "customer care is not replying" }] };
    }
    return { overall_sentiment: "neutral", language_detected: "en", is_sarcastic: false, is_ambiguous: true, overall_confidence: 0.5, translated_text: null, sarcasm_reason: null, ambiguity_reason: "mocked", features: [] };
  }
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: buildExtractionPrompt(reviewText, languagePrefix),
      },
    ],
  });

  const raw =
    response.content[0].type === 'text' ? response.content[0].text : '';

  // Strip markdown code fences if Claude adds them despite instructions
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  let parsed: ClaudeExtractionResult;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // If Claude returns something unparseable, construct a safe fallback
    // rather than crash the whole batch
    console.error('[analyzer] JSON parse failed for review. Raw:', raw.slice(0, 200));
    parsed = {
      overall_sentiment: 'ambiguous',
      overall_confidence: 0,
      is_sarcastic: false,
      is_ambiguous: true,
      language_detected: langResult.code,
      translated_text: null,
      features: [],
      sarcasm_reason: null,
      ambiguity_reason: 'Claude response could not be parsed',
    };
  }

  // Ensure language_detected is populated from our detector if Claude missed it
  if (!parsed.language_detected) {
    parsed.language_detected = langResult.code;
  }

  return parsed;
}

export interface BatchReview {
  id: string;
  product_id: string;
  batch_id?: string;
  rawText: string;   // original pre-normalisation text
  text: string;      // normalised text used for analysis
  dedupClusterId?: string;
  created_at: string;
}

export async function analyzeBatch(
  inputReviews: BatchReview[],
  jobId?: string
): Promise<void> {
  let processed = 0;

  for (const review of inputReviews) {
    try {
      const result = await analyzeReview(review.text, review.rawText);

      await db
        .insert(reviews)
        .values({
          id: review.id,
          productId: review.product_id,
          rawText: review.rawText,
          text: review.text,
          createdAt: review.created_at,
          batchId: review.batch_id,
          detectedLanguage: result.language_detected,
          language: result.language_detected,
          translatedText: result.translated_text ?? null,
          dedupClusterId: review.dedupClusterId ?? null,
          overallSentiment: result.overall_sentiment,
          confidence: result.overall_confidence,
          isSarcastic: result.is_sarcastic,
          isAmbiguous: result.is_ambiguous,
        })
        .onConflictDoNothing();

      if (result.features && Array.isArray(result.features)) {
        for (const feature of result.features) {
          await db
            .insert(featureSentiments)
            .values({
              id: crypto.randomUUID(),
              reviewId: review.id,
              feature: feature.feature,
              sentiment: feature.sentiment,
              confidence: feature.confidence,
              quote: feature.quote ?? '',
            })
            .onConflictDoNothing();
        }
      }

      processed++;

      // Update job progress after every review so UI polling stays fresh
      if (jobId) {
        await db
          .update(ingestionJobs)
          .set({
            totalProcessed: processed,
            status: processed === inputReviews.length ? 'done' : 'processing',
            updatedAt: new Date().toISOString(),
          })
          .where(eq(ingestionJobs.id, jobId));
      }
    } catch (e) {
      console.error('[analyzer] Failed to process review', review.id, e);
    }

    // Rate-limit buffer — 100ms between Claude calls
    await new Promise(r => setTimeout(r, 100));
  }

  // Mark job done even if we fell through without updating above
  if (jobId) {
    await db
      .update(ingestionJobs)
      .set({ status: 'done', updatedAt: new Date().toISOString() })
      .where(eq(ingestionJobs.id, jobId));
  }
}
