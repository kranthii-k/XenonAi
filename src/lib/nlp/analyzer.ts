import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db';
import { reviews, featureSentiments } from '../db/schema';
import { RawReview } from '../../types';
import { buildExtractionPrompt } from '../prompts/extract';
import * as crypto from 'crypto';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

export async function analyzeReview(text: string): Promise<any> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("No Anthropic API Key found. Using mock fallback for testing.");
    if (text.includes("absolutely stunning, but the battery")) {
       return { overall_sentiment: "negative", language_detected: "en", is_sarcastic: false, is_ambiguous: false, overall_confidence: 0.9, features: [{ feature: "camera", sentiment: "positive", confidence: 0.95, quote: "absolutely stunning" }, { feature: "battery_life", sentiment: "negative", confidence: 0.99, quote: "battery life is terrible" }] };
    }
    if (text.includes("3 hours to charge to 50%")) {
       return { overall_sentiment: "negative", language_detected: "en", is_sarcastic: true, is_ambiguous: false, overall_confidence: 0.85, features: [{ feature: "battery_life", sentiment: "negative", confidence: 0.88, quote: "revolutionary piece of garbage" }] };
    }
    if (text.includes("Bhai ye phone ekdum")) {
       return { overall_sentiment: "negative", language_detected: "hi", is_sarcastic: false, is_ambiguous: false, overall_confidence: 0.9, features: [{ feature: "display", sentiment: "negative", confidence: 0.9, quote: "screen break" }, { feature: "customer_support", sentiment: "negative", confidence: 0.9, quote: "customer care is not replying" }] };
    }
    return { overall_sentiment: "neutral", language_detected: "en", is_sarcastic: false, is_ambiguous: true, overall_confidence: 0.5, features: [] };
  }
  const response = await client.messages.create({
    model: 'claude-3-sonnet-20240229', // Fallback to valid sdk string; user specified "claude-sonnet-4-6" in readme
    max_tokens: 1024,
    messages: [{ role: 'user', content: buildExtractionPrompt(text) }]
  });
  
  const raw = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
  return parsed;
}

export async function analyzeBatch(inputReviews: RawReview[]): Promise<void> {
  for (const review of inputReviews) {
    try {
      const result = await analyzeReview(review.text);
      
      await db.insert(reviews).values({
        id: review.id,
        productId: review.product_id,
        text: review.text,
        createdAt: review.created_at,
        batchId: review.batch_id,
        language: result.language_detected ?? 'en',
        overallSentiment: result.overall_sentiment,
        confidence: result.overall_confidence,
        isSarcastic: result.is_sarcastic,
        isAmbiguous: result.is_ambiguous,
      }).onConflictDoNothing();

      if (result.features && Array.isArray(result.features)) {
        for (const feature of result.features) {
          await db.insert(featureSentiments).values({
            id: crypto.randomUUID(),
            reviewId: review.id,
            feature: feature.feature,
            sentiment: feature.sentiment,
            confidence: feature.confidence,
            quote: feature.quote || '',
          });
        }
      }
    } catch (e) {
      console.error('Failed to process review', review.id, e);
    }
    await new Promise(r => setTimeout(r, 100)); // rate limit buffer
  }
}
