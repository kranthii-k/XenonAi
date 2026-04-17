import { db } from '../db';
import { reviews, featureSentiments, ingestionJobs } from '../db/schema';
import { buildExtractionPrompt } from '../prompts/extract';
import { detectLanguage, buildLanguageInstruction } from './translator';
import * as crypto from 'crypto';
import { eq } from 'drizzle-orm';

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
  // Run language detection natively in Node
  const langResult = detectLanguage(reviewText);

  let parsed: ClaudeExtractionResult;
  try {
    const res = await fetch('http://127.0.0.1:5000/extract', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: reviewText })
    });
    
    if (!res.ok) throw new Error("Local ML Server failed");
    
    parsed = await res.json();
  } catch (e) {
    console.error('[analyzer] Python ML request failed. Assuming neutral fallback.', e);
    parsed = {
      overall_sentiment: 'neutral',
      overall_confidence: 0.5,
      is_sarcastic: false,
      is_ambiguous: true,
      language_detected: langResult.code,
      translated_text: null,
      features: [],
      sarcasm_reason: null,
      ambiguity_reason: 'ML server offline or failed',
    };
  }

  // Ensure language_detected is populated if ML engine missed it
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
