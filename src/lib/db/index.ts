import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';

// Singleton pattern for the database connection to prevent multiple handles in Dev
const globalForDb = global as unknown as { sqlite: Database.Database, db: any };

const dbPath = path.join(process.cwd(), 'sqlite.db');

export const sqlite = globalForDb.sqlite || new Database(dbPath);
if (process.env.NODE_ENV !== 'production') globalForDb.sqlite = sqlite;

// Enable WAL mode for better concurrent read performance
sqlite.pragma('journal_mode = WAL');

export const db = globalForDb.db || drizzle(sqlite, { schema });
if (process.env.NODE_ENV !== 'production') globalForDb.db = db;

// Ensure all tables exist (idempotent schema bootstrap)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    batch_id TEXT,
    detected_language TEXT DEFAULT 'en',
    language TEXT DEFAULT 'en',
    translated_text TEXT,
    dedup_cluster_id TEXT,
    overall_sentiment TEXT,
    confidence REAL,
    is_sarcastic INTEGER DEFAULT 0,
    is_ambiguous INTEGER DEFAULT 0,
    cohort TEXT,
    days_since_launch INTEGER
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    launch_date TEXT NOT NULL,
    category TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feature_sentiments (
    id TEXT PRIMARY KEY,
    review_id TEXT NOT NULL REFERENCES reviews(id),
    feature TEXT NOT NULL,
    sentiment TEXT NOT NULL,
    confidence REAL NOT NULL,
    quote TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feature_forecasts (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    feature TEXT NOT NULL,
    data_json TEXT NOT NULL,
    last_updated TEXT NOT NULL,
    UNIQUE(product_id, feature)
  );

  CREATE TABLE IF NOT EXISTS flagged_reviews (
    id TEXT PRIMARY KEY,
    original_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    batch_id TEXT,
    raw_text TEXT NOT NULL,
    flag_reason TEXT NOT NULL,
    dedup_cluster_id TEXT,
    similar_to TEXT,
    similarity_score REAL,
    flagged_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ingestion_jobs (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    batch_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    total_received INTEGER NOT NULL DEFAULT 0,
    total_queued INTEGER NOT NULL DEFAULT 0,
    total_flagged INTEGER NOT NULL DEFAULT 0,
    total_processed INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS trends (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    feature TEXT NOT NULL,
    batch_index INTEGER NOT NULL,
    negative_pct REAL NOT NULL,
    positive_pct REAL NOT NULL,
    z_score REAL NOT NULL,
    is_anomaly INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    feature TEXT NOT NULL,
    severity TEXT NOT NULL,
    message TEXT NOT NULL,
    current_pct REAL NOT NULL,
    previous_pct REAL NOT NULL,
    delta REAL NOT NULL,
    created_at TEXT NOT NULL
  );
`);
