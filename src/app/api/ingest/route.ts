import { analyzeBatch } from '@/lib/nlp/analyzer';
import { detectBotPattern, hashReview } from '@/lib/nlp/dedup';
import { RawReview } from '@/types';
import * as crypto from 'crypto';
import Papa from 'papaparse';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const text = formData.get('text') as string | null;
    const productId = (formData.get('product_id') as string) || 'default-product';
    
    let rawReviews: RawReview[] = [];
    
    if (file) {
      const content = await file.text();
      if (file.name.endsWith('.json')) {
        rawReviews = JSON.parse(content);
        // Ensure id and product_id
        rawReviews = rawReviews.map(r => ({
          ...r,
          id: r.id || crypto.randomUUID(),
          product_id: r.product_id || productId,
          created_at: r.created_at || new Date().toISOString()
        }));
      } else {
        const parsed = Papa.parse(content, { header: true });
        rawReviews = (parsed.data as any[]).map((row: any) => ({
          id: crypto.randomUUID(),
          product_id: productId,
          text: row.text || row.review || Object.values(row)[0] as string,
          created_at: new Date().toISOString(),
        })).filter(r => r.text);
      }
    } else if (text) {
      rawReviews = text.split('\n')
        .filter(Boolean)
        .map((line, i) => ({ 
          id: `manual-${Date.now()}-${i}`, 
          product_id: productId, 
          text: line.trim(), 
          created_at: new Date().toISOString() 
        }));
    }
    
    const batchId = crypto.randomUUID();
    rawReviews = rawReviews.map(r => ({ ...r, batch_id: batchId }));

    const textList = rawReviews.map(r => r.text);
    const botHashes = detectBotPattern(textList);
    const dedupedReviews = rawReviews.filter(r => !botHashes.has(hashReview(r.text)));
    
    // Queue for analysis without blocking response
    analyzeBatch(dedupedReviews).catch(console.error);
    
    return Response.json({ 
      queued: dedupedReviews.length,
      flagged_bots: rawReviews.length - dedupedReviews.length,
      batch_id: batchId
    });
  } catch (error) {
    console.error('Ingest error:', error);
    return Response.json({ error: 'Ingestion failed' }, { status: 500 });
  }
}
