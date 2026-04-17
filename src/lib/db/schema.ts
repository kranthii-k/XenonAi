import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const reviews = sqliteTable('reviews', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull(),
  text: text('text').notNull(),
  createdAt: text('created_at').notNull(),
  batchId: text('batch_id'),
  language: text('language').default('en'),
  translatedText: text('translated_text'),
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
