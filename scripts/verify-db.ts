import Database from 'better-sqlite3';

const db = new Database('sqlite.db');

console.log("--- REVIEWS TABLE ---");
const reviews = db.prepare('SELECT id, text, overall_sentiment, is_sarcastic, is_ambiguous FROM reviews').all();
console.table(reviews);

console.log("\n--- FEATURE SENTIMENTS TABLE ---");
const features = db.prepare('SELECT review_id, feature, sentiment, confidence, quote FROM feature_sentiments').all();
console.table(features);
