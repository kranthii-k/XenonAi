import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const reviews = sqliteTable('reviews', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull(),
  rawText: text('raw_text').notNull(),          // original, pre-normalization
  text: text('text').notNull(),                  // normalized text used for analysis
  createdAt: text('created_at').notNull(),
  batchId: text('batch_id'),
  detectedLanguage: text('detected_language').default('en'),
  language: text('language').default('en'),      // after analysis confirmation
  translatedText: text('translated_text'),
  dedupClusterId: text('dedup_cluster_id'),      // links near-duplicates
  overallSentiment: text('overall_sentiment'),
  confidence: real('confidence'),
  isSarcastic: integer('is_sarcastic', { mode: 'boolean' }).default(false),
  isAmbiguous: integer('is_ambiguous', { mode: 'boolean' }).default(false),
});

export const featureSentiments = sqliteTable('feature_sentiments', {
  id: text('id').primaryKey(),
  reviewId: text('review_id').notNull().references(() => reviews.id),
  feature: text('feature').notNull(),
  sentiment: text('sentiment').notNull(),
  confidence: real('confidence').notNull(),
  quote: text('quote').notNull(),
});

// Flagged reviews: bot-detected, exact duplicates, near-duplicates
// NEVER deleted — always stored for auditability
export const flaggedReviews = sqliteTable('flagged_reviews', {
  id: text('id').primaryKey(),
  originalId: text('original_id').notNull(),    // the RawReview id
  productId: text('product_id').notNull(),
  batchId: text('batch_id'),
  rawText: text('raw_text').notNull(),
  flagReason: text('flag_reason').notNull(),     // 'exact_duplicate' | 'near_duplicate' | 'bot_pattern'
  dedupClusterId: text('dedup_cluster_id'),      // which cluster it belongs to
  similarTo: text('similar_to'),                 // id of the review it's near-duplicate of
  similarityScore: real('similarity_score'),     // jaccard score, null for exact
  flaggedAt: text('flagged_at').notNull(),
});

// Tracks ingestion job progress so UI can poll status
export const ingestionJobs = sqliteTable('ingestion_jobs', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull(),
  batchId: text('batch_id').notNull(),
  status: text('status').notNull().default('queued'), // 'queued' | 'processing' | 'done' | 'error'
  totalReceived: integer('total_received').notNull().default(0),
  totalQueued: integer('total_queued').notNull().default(0),   // after dedup
  totalFlagged: integer('total_flagged').notNull().default(0), // bot/dedup flags
  totalProcessed: integer('total_processed').notNull().default(0),
  errorMessage: text('error_message'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const trends = sqliteTable('trends', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull(),
  feature: text('feature').notNull(),
  batchIndex: integer('batch_index').notNull(),
  negativePct: real('negative_pct').notNull(),
  positivePct: real('positive_pct').notNull(),
  zScore: real('z_score').notNull(),
  isAnomaly: integer('is_anomaly', { mode: 'boolean' }).notNull(),
});

export const alerts = sqliteTable('alerts', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull(),
  feature: text('feature').notNull(),
  severity: text('severity').notNull(),
  message: text('message').notNull(),
  currentPct: real('current_pct').notNull(),
  previousPct: real('previous_pct').notNull(),
  delta: real('delta').notNull(),
  createdAt: text('created_at').notNull(),
});
