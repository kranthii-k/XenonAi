import { db } from '@/lib/db';
import { ingestionJobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/ingest/status?job_id=<uuid>
 *
 * Returns current progress of an ingestion + analysis job.
 * The UI polls this every 2 seconds to show a progress bar.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('job_id');

  if (!jobId) {
    return Response.json(
      { error: 'Missing job_id query parameter.' },
      { status: 400 }
    );
  }

  const job = await db.query.ingestionJobs.findFirst({
    where: eq(ingestionJobs.id, jobId),
  });

  if (!job) {
    return Response.json({ error: 'Job not found.' }, { status: 404 });
  }

  const progressPct =
    job.totalQueued > 0
      ? Math.round((job.totalProcessed / job.totalQueued) * 100)
      : job.status === 'done'
      ? 100
      : 0;

  return Response.json({
    job_id: job.id,
    batch_id: job.batchId,
    status: job.status,
    progress_pct: progressPct,
    total_received: job.totalReceived,
    queued_for_analysis: job.totalQueued,
    total_flagged: job.totalFlagged,
    total_processed: job.totalProcessed,
    error: job.errorMessage ?? null,
  });
}
