const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'sqlite.db');
const db = new Database(dbPath);

const schema = {
  reviews: [
    { name: 'id', type: 'TEXT PRIMARY KEY' },
    { name: 'product_id', type: 'TEXT NOT NULL' },
    { name: 'raw_text', type: 'TEXT NOT NULL' },
    { name: 'text', type: 'TEXT NOT NULL' },
    { name: 'created_at', type: 'TEXT NOT NULL' },
    { name: 'batch_id', type: 'TEXT' },
    { name: 'detected_language', type: 'TEXT DEFAULT "en"' },
    { name: 'language', type: 'TEXT DEFAULT "en"' },
    { name: 'translated_text', type: 'TEXT' },
    { name: 'dedup_cluster_id', type: 'TEXT' },
    { name: 'overall_sentiment', type: 'TEXT' },
    { name: 'confidence', type: 'REAL' },
    { name: 'is_sarcastic', type: 'INTEGER DEFAULT 0' },
    { name: 'is_ambiguous', type: 'INTEGER DEFAULT 0' },
    { name: 'cohort', type: 'TEXT' },
    { name: 'days_since_launch', type: 'INTEGER' }
  ],
  products: [
    { name: 'id', type: 'TEXT PRIMARY KEY' },
    { name: 'name', type: 'TEXT NOT NULL' },
    { name: 'launch_date', type: 'TEXT NOT NULL' },
    { name: 'category', type: 'TEXT NOT NULL' }
  ],
  feature_sentiments: [
    { name: 'id', type: 'TEXT PRIMARY KEY' },
    { name: 'review_id', type: 'TEXT NOT NULL REFERENCES reviews(id)' },
    { name: 'feature', type: 'TEXT NOT NULL' },
    { name: 'sentiment', type: 'TEXT NOT NULL' },
    { name: 'confidence', type: 'REAL NOT NULL' },
    { name: 'quote', type: 'TEXT NOT NULL' }
  ],
  feature_forecasts: [
    { name: 'id', type: 'TEXT PRIMARY KEY' },
    { name: 'product_id', type: 'TEXT NOT NULL REFERENCES products(id)' },
    { name: 'feature', type: 'TEXT NOT NULL' },
    { name: 'data_json', type: 'TEXT NOT NULL' },
    { name: 'last_updated', type: 'TEXT NOT NULL' }
  ],
  trends: [
    { name: 'id', type: 'TEXT PRIMARY KEY' },
    { name: 'product_id', type: 'TEXT NOT NULL' },
    { name: 'feature', type: 'TEXT NOT NULL' },
    { name: 'batch_index', type: 'INTEGER NOT NULL' },
    { name: 'negative_pct', type: 'REAL NOT NULL' },
    { name: 'positive_pct', type: 'REAL NOT NULL' },
    { name: 'z_score', type: 'REAL NOT NULL' },
    { name: 'is_anomaly', type: 'INTEGER NOT NULL' }
  ],
  alerts: [
    { name: 'id', type: 'TEXT PRIMARY KEY' },
    { name: 'product_id', type: 'TEXT NOT NULL' },
    { name: 'feature', type: 'TEXT NOT NULL' },
    { name: 'severity', type: 'TEXT NOT NULL' },
    { name: 'message', type: 'TEXT NOT NULL' },
    { name: 'current_pct', type: 'REAL NOT NULL' },
    { name: 'previous_pct', type: 'REAL NOT NULL' },
    { name: 'delta', type: 'REAL NOT NULL' },
    { name: 'created_at', type: 'TEXT NOT NULL' }
  ],
  ingestion_jobs: [
    { name: 'id', type: 'TEXT PRIMARY KEY' },
    { name: 'product_id', type: 'TEXT NOT NULL' },
    { name: 'batch_id', type: 'TEXT NOT NULL' },
    { name: 'status', type: "TEXT NOT NULL DEFAULT 'queued'" },
    { name: 'total_received', type: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'total_queued', type: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'total_flagged', type: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'total_processed', type: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'error_message', type: 'TEXT' },
    { name: 'created_at', type: 'TEXT NOT NULL' },
    { name: 'updated_at', type: 'TEXT NOT NULL' }
  ],
  flagged_reviews: [
    { name: 'id', type: 'TEXT PRIMARY KEY' },
    { name: 'original_id', type: 'TEXT NOT NULL' },
    { name: 'product_id', type: 'TEXT NOT NULL' },
    { name: 'batch_id', type: 'TEXT' },
    { name: 'raw_text', type: 'TEXT NOT NULL' },
    { name: 'flag_reason', type: 'TEXT NOT NULL' },
    { name: 'dedup_cluster_id', type: 'TEXT' },
    { name: 'similar_to', type: 'TEXT' },
    { name: 'similarity_score', type: 'REAL' },
    { name: 'flagged_at', type: 'TEXT NOT NULL' }
  ]
};

console.log('--- Starting Comprehensive Database Migration ---');

for (const [table, columns] of Object.entries(schema)) {
  try {
    const tableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`).get();
    
    if (!tableExists) {
      console.log(`Creating table: ${table}`);
      const colDefs = columns.map(c => `${c.name} ${c.type}`).join(', ');
      
      // Special handling for constraints in CREATE TABLE
      let sql = `CREATE TABLE ${table} (${colDefs})`;
      if (table === 'feature_forecasts') {
        sql = sql.replace(')', ', UNIQUE(product_id, feature))');
      }
      
      db.exec(sql);
      continue;
    }

    // Incremental column updates
    const info = db.pragma(`table_info(${table})`);
    const existingColumns = info.map(i => i.name);
    
    for (const col of columns) {
      if (!existingColumns.includes(col.name)) {
        console.log(`Adding column: ${col.name} to ${table}`);
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.type}`);
      }
    }
  } catch (e) {
    console.error(`Error migrating ${table}:`, e.message);
  }
}

console.log('Comprehensive migration complete.');
db.close();
