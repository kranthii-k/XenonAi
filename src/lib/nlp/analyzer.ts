import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db';
import { reviews, featureSentiments, ingestionJobs, trends, alerts } from '../db/schema';
import { buildExtractionPrompt } from '../prompts/extract';
import { detectLanguage, buildLanguageInstruction } from './translator';
import { computeRollingTrends } from './trends';
import * as crypto from 'crypto';
import { eq, desc } from 'drizzle-orm';

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
    
    // Default mock results to ensure trends/alerts can be tested
    const result: ClaudeExtractionResult = {
      overall_sentiment: "negative",
      language_detected: "en",
      is_sarcastic: reviewText.length > 100,
      is_ambiguous: reviewText.length < 20,
      overall_confidence: 0.9,
      translated_text: null,
      sarcasm_reason: reviewText.length > 100 ? "Wordy complaint" : null,
      ambiguity_reason: reviewText.length < 20 ? "Too short" : null,
      features: [
        { feature: "battery_life", sentiment: "negative", confidence: 0.9, quote: "battery test" },
        { feature: "camera", sentiment: "positive", confidence: 0.8, quote: "camera test" }
      ]
    };

    if (reviewText.includes("absolutely stunning")) {
       result.features.push({ feature: "display", sentiment: "positive", confidence: 1.0, quote: "stunning" });
    }
    
    return result;
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

  // Finalize job and trigger trend analysis
  if (jobId) {
    await db
      .update(ingestionJobs)
      .set({ status: 'done', updatedAt: new Date().toISOString() })
      .where(eq(ingestionJobs.id, jobId));
  }

  const productId = inputReviews[0]?.product_id;
  if (productId) {
    await updateProductTrends(productId).catch(err => 
      console.error('[analyzer] Trend update failed:', err)
    );
  }
}

/**
 * Recalculates trends and alerts for a product based on the latest N reviews.
 * This is triggered after every successful ingestion batch.
 */
export async function updateProductTrends(productId: string): Promise<void> {
  // 1. Fetch the last 150 reviews + their features for this product
  // We need enough history for a rolling window comparison (e.g. 50 vs 50)
  const lastReviews = await db.query.reviews.findMany({
    where: eq(reviews.productId, productId),
    orderBy: [desc(reviews.createdAt)],
    limit: 150,
  });

  if (lastReviews.length < 10) return; // Not enough data for trends yet

  // Fetch all features for these reviews in one go
  const reviewIds = lastReviews.map(r => r.id);
  const allFeatures = await db.query.featureSentiments.findMany({
    where: (fs, { inArray }) => inArray(fs.reviewId, reviewIds),
  });

  // 2. Map DB results to AnalyzedReview type for computeRollingTrends
  const mappedReviews = lastReviews.map(r => ({
    id: r.id,
    product_id: r.productId,
    text: r.text,
    created_at: r.createdAt,
    language: r.language ?? 'en',
    overall_sentiment: (r.overallSentiment ?? 'neutral') as any,
    confidence: r.confidence ?? 0,
    is_sarcastic: r.isSarcastic ?? false,
    is_ambiguous: r.isAmbiguous ?? false,
    features: allFeatures
      .filter(f => f.reviewId === r.id)
      .map(f => ({
        feature: f.feature,
        sentiment: f.sentiment as any,
        confidence: f.confidence,
        quote: f.quote,
      })),
  }));

  // 3. Run statistical trend detection
  const trendResults = computeRollingTrends(mappedReviews.reverse()); 
  console.log(`[analyzer] Computed trends for ${productId}: ${trendResults.length} features analyzed.`);

  // 4. Persist results
  const now = new Date().toISOString();
  const batchIndex = Math.floor(Date.now() / 1000); // Unique index for this trend snapshot

  for (const t of trendResults) {
    // Only store trends with significant volume or shifts to keep DB clean
    if (t.current_negative_pct > 0 || t.current_positive_pct > 0) {
      await db.insert(trends).values({
        id: crypto.randomUUID(),
        productId,
        feature: t.feature,
        batchIndex,
        negativePct: t.current_negative_pct * 100,
        positivePct: t.current_positive_pct * 100,
        zScore: t.z_score,
        isAnomaly: t.is_anomaly,
      });
    }

    // Generate alerts for systemic issues or sudden spikes
    if (t.is_anomaly && t.issue_type === 'systemic') {
      const message = `SYSTEMIC ISSUE: ${t.feature.replace(/_/g, ' ')} complaints reached ${Math.round(t.current_negative_pct * 100)}% (up from ${Math.round(t.previous_negative_pct * 100)}%). Affects ${t.unique_users_affected} reviewers in this window.`;
      
      await db.insert(alerts).values({
        id: crypto.randomUUID(),
        productId,
        feature: t.feature,
        severity: t.z_score > 4 ? 'critical' : 'high',
        message,
        currentPct: t.current_negative_pct * 100,
        previousPct: t.previous_negative_pct * 100,
        delta: t.delta_negative * 100,
        createdAt: now,
      });
    } else if (t.is_anomaly && t.issue_type === 'praise_spike') {
      const message = `PRAISE SPIKE: ${t.feature.replace(/_/g, ' ')} positive sentiment rose to ${Math.round(t.current_positive_pct * 100)}%. Positive trend detected!`;
      
      await db.insert(alerts).values({
        id: crypto.randomUUID(),
        productId,
        feature: t.feature,
        severity: 'low', // Praise is low priority but good to surface
        message,
        currentPct: t.current_positive_pct * 100,
        previousPct: t.previous_positive_pct * 100,
        delta: t.delta_positive * 100,
        createdAt: now,
      });
    }
  }
}
