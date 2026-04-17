/**
 * fetch-reviews.js
 * Bridge script that runs the Python scraper and pipes it into the ingest API.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const url = process.argv[2];
const productId = process.argv[3] || 'manual-fetch';

if (!url) {
  console.error('Usage: node scripts/fetch-reviews.js <URL> [productId]');
  process.exit(1);
}

const pythonPath = path.join(process.cwd(), 'ml_server', 'venv', 'bin', 'python');
const scraperPath = path.join(process.cwd(), 'ml_server', 'scraper.py');

console.log(`[bridge] Triggering scraper for: ${url}`);
console.log(`[bridge] Product ID: ${productId}`);

const child = spawn(pythonPath, [scraperPath, '--url', url]);

let stdout = '';
let stderr = '';

child.stdout.on('data', (data) => {
  stdout += data.toString();
});

child.stderr.on('data', (data) => {
  stderr += data.toString();
});

child.on('close', async (code) => {
  try {
    // Extract JSON from stdout (skip any log messages starting with [*])
    const jsonStr = stdout.split('\n').filter(l => !l.startsWith('[*]') && l.trim()).join('\n');
    let reviews;
    try {
        reviews = JSON.parse(jsonStr);
    } catch (e) {
        console.error('[bridge] Failed to parse scraper output:', e);
        console.error('Raw stdout:', stdout);
        process.exit(1);
    }

    if (reviews.error) {
      console.log(JSON.stringify({ error: reviews.error }));
      process.exit(0); // Exit successfully so API can parse the JSON error
    }

    if (!Array.isArray(reviews) || reviews.length === 0) {
      console.log(JSON.stringify({ error: 'No reviews found on page' }));
      process.exit(0);
    }

    console.log(`[bridge] Successfully scraped ${reviews.length} reviews. Ingesting...`);

    const formData = new FormData();
    const blob = new Blob([JSON.stringify({ reviews })], { type: 'application/json' });
    formData.append('file', blob, 'scraped.json');
    formData.append('product_id', productId);

    const res = await fetch('http://localhost:3000/api/ingest', {
      method: 'POST',
      body: formData,
    });

    const result = await res.json();
    console.log('[bridge] Ingestion result:', result);

  } catch (err) {
    console.error('[bridge] Failed to process scraper output:', err);
    console.log('Raw output was:', stdout);
    process.exit(1);
  }
});
