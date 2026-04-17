const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'sqlite.db');
const db = new Database(dbPath);

const schema = {
  reviews: [
    { name: 'raw_text', type: 'TEXT' },
    { name: 'batch_id', type: 'TEXT' },
    { name: 'detected_language', type: "TEXT DEFAULT 'en'" },
    { name: 'language', type: "TEXT DEFAULT 'en'" },
    { name: 'translated_text', type: 'TEXT' },
    { name: 'dedup_cluster_id', type: 'TEXT' },
    { name: 'overall_sentiment', type: 'TEXT' },
    { name: 'confidence', type: 'REAL' },
    { name: 'is_sarcastic', type: 'INTEGER DEFAULT 0' },
    { name: 'is_ambiguous', type: 'INTEGER DEFAULT 0' },
    { name: 'sentiment_shift_detected', type: 'INTEGER DEFAULT 0' }
  ],
  flagged_reviews: [
    { name: 'raw_text', type: 'TEXT' },
    { name: 'batch_id', type: 'TEXT' }
  ]
};

for (const [table, columns] of Object.entries(schema)) {
  try {
    const info = db.pragma(`table_info(${table})`);
    const existingColumns = info.map(i => i.name);
    
    for (const col of columns) {
      if (!existingColumns.includes(col.name)) {
        console.log(`Adding ${col.name} to ${table}`);
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.type}`);
      }
    }
  } catch (e) {
    console.error(`Error migrating ${table}:`, e.message);
  }
}

console.log('Comprehensive migration complete.');
db.close();
