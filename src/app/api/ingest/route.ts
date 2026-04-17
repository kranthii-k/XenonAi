import { db } from '@/lib/db';
import { flaggedReviews, ingestionJobs } from '@/lib/db/schema';
import { runDeduplicationPipeline } from '@/lib/nlp/dedup';
import { analyzeBatch } from '@/lib/nlp/analyzer';
import * as crypto from 'crypto';
import Papa from 'papaparse';
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas for JSON input validation
// Accepts both: array of review objects, OR { reviews: [...] } wrapper
// ─────────────────────────────────────────────────────────────────────────────

const RawReviewSchema = z.object({
  id: z.string().optional(),
  product_id: z.string().optional(),
  text: z.string().min(1, 'Review text cannot be empty'),
  created_at: z.string().optional(),
});

const JsonPayloadSchema = z.union([
  z.array(RawReviewSchema),
  z.object({ reviews: z.array(RawReviewSchema) }),
]);

type ValidatedReview = z.infer<typeof RawReviewSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// CSV column name candidates (order = priority)
// ─────────────────────────────────────────────────────────────────────────────

const CSV_TEXT_COLUMNS = ['text', 'review', 'review_text', 'content', 'body', 'comment', 'feedback'];

function findTextColumn(row: Record<string, unknown>): string | null {
  const keys = Object.keys(row).map(k => k.toLowerCase().trim());
  for (const candidate of CSV_TEXT_COLUMNS) {
    const match = keys.find(k => k === candidate);
    if (match) {
      // Return original key from the row
      const originalKey = Object.keys(row).find(k => k.toLowerCase().trim() === match)!;
      return originalKey;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalise ValidatedReview → unified shape for dedup pipeline
// ─────────────────────────────────────────────────────────────────────────────

function toInputReview(r: ValidatedReview, productId: string, batchId: string) {
  return {
    id: r.id ?? crypto.randomUUID(),
    product_id: r.product_id ?? productId,
    batch_id: batchId,
    text: r.text.trim(),
    created_at: r.created_at ?? new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ingest
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const text = formData.get('text') as string | null;
    const productId = (formData.get('product_id') as string | null) ?? 'default-product';

    const batchId = crypto.randomUUID();
    const jobId = crypto.randomUUID();

    let inputReviews: ReturnType<typeof toInputReview>[] = [];
    let parseError: string | null = null;

    // ── Parse input ─────────────────────────────────────────────────────────

    if (file) {
      const content = await file.text();

      if (file.name.toLowerCase().endsWith('.json')) {
        // JSON path: validate with Zod
        let parsed: unknown;
        try {
          parsed = JSON.parse(content);
        } catch {
          return Response.json(
            { error: 'Invalid JSON file. Could not parse.', hint: 'Ensure the file is valid JSON.' },
            { status: 422 }
          );
        }

        const validation = JsonPayloadSchema.safeParse(parsed);
        if (!validation.success) {
          return Response.json(
            {
              error: 'JSON structure invalid.',
              hint: 'Expected an array of { text: string } objects, or { reviews: [...] }.',
              details: validation.error.flatten(),
            },
            { status: 422 }
          );
        }

        const reviewArray = Array.isArray(validation.data)
          ? validation.data
          : validation.data.reviews;

        inputReviews = reviewArray.map(r => toInputReview(r, productId, batchId));

      } else {
        // CSV path: detect text column explicitly
        const result = Papa.parse<Record<string, string>>(content, {
          header: true,
          skipEmptyLines: true,
        });

        if (result.errors.length > 0 && result.data.length === 0) {
          return Response.json(
            { error: 'CSV parse failed.', details: result.errors.slice(0, 3) },
            { status: 422 }
          );
        }

        if (result.data.length === 0) {
          return Response.json(
            { error: 'CSV file is empty or has no data rows.' },
            { status: 422 }
          );
        }

        const sampleRow = result.data[0];
        const textColumn = findTextColumn(sampleRow);

        if (!textColumn) {
          const foundColumns = Object.keys(sampleRow).join(', ');
          return Response.json(
            {
              error: 'Could not find a review text column in your CSV.',
              hint: `Expected one of: ${CSV_TEXT_COLUMNS.join(', ')}`,
              found_columns: foundColumns,
            },
            { status: 422 }
          );
        }

        inputReviews = result.data
          .map(row => ({
            id: crypto.randomUUID(),
            product_id: productId,
            batch_id: batchId,
            text: (row[textColumn] ?? '').toString().trim(),
            created_at: new Date().toISOString(),
          }))
          .filter(r => r.text.length > 0);

        if (inputReviews.length === 0) {
          return Response.json(
            { error: `Found column "${textColumn}" but all rows were empty.` },
            { status: 422 }
          );
        }
      }

    } else if (text && text.trim()) {
      // Manual paste: split by newlines
      inputReviews = text
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map((line, i) => ({
          id: `manual-${Date.now()}-${i}`,
          product_id: productId,
          batch_id: batchId,
          text: line,
          created_at: new Date().toISOString(),
        }));

    } else {
      return Response.json(
        { error: 'No input provided. Send a file or paste text.' },
        { status: 400 }
      );
    }

    if (parseError) {
      return Response.json({ error: parseError }, { status: 422 });
    }

    // ── Deduplication pipeline ───────────────────────────────────────────────

    const { clean, flagged } = runDeduplicationPipeline(inputReviews);

    // ── Persist flagged reviews to DB (NEVER silently dropped) ──────────────

    if (flagged.length > 0) {
      for (const f of flagged) {
        await db.insert(flaggedReviews).values({
          id: f.id,
          originalId: f.originalId,
          productId: f.product_id,
          batchId: f.batch_id ?? batchId,
          rawText: f.rawText,
          flagReason: f.flagReason,
          dedupClusterId: f.dedupClusterId ?? null,
          similarTo: f.similarTo ?? null,
          similarityScore: f.similarityScore ?? null,
          flaggedAt: f.flaggedAt,
        }).onConflictDoNothing();
      }
    }

    // ── Create ingestion job record ──────────────────────────────────────────

    const now = new Date().toISOString();
    await db.insert(ingestionJobs).values({
      id: jobId,
      productId,
      batchId,
      status: 'queued',
      totalReceived: inputReviews.length,
      totalQueued: clean.length,
      totalFlagged: flagged.length,
      totalProcessed: 0,
      createdAt: now,
      updatedAt: now,
    });

    // ── Fire analysis batch (non-blocking — job tracks progress) ─────────────

    analyzeBatch(clean, jobId).catch(async (err) => {
      console.error('[ingest] analyzeBatch error:', err);
      await db
        .update(ingestionJobs)
        .set({
          status: 'error',
          errorMessage: String(err),
          updatedAt: new Date().toISOString(),
        })
        // @ts-expect-error drizzle eq import
        .where((t: typeof ingestionJobs) => t.id === jobId);
    });

    return Response.json({
      job_id: jobId,
      batch_id: batchId,
      total_received: inputReviews.length,
      queued_for_analysis: clean.length,
      flagged: {
        total: flagged.length,
        breakdown: {
          bot_pattern: flagged.filter(f => f.flagReason === 'bot_pattern').length,
          exact_duplicate: flagged.filter(f => f.flagReason === 'exact_duplicate').length,
          near_duplicate: flagged.filter(f => f.flagReason === 'near_duplicate').length,
        },
      },
      message: `${clean.length} reviews queued. Poll /api/ingest/status?job_id=${jobId} for progress.`,
    });

  } catch (error) {
    console.error('[ingest] Unexpected error:', error);
    return Response.json(
      { error: 'Internal server error during ingestion.', detail: String(error) },
      { status: 500 }
    );
  }
}
