export const dynamic = 'force-dynamic';

/**
 * GET /api/health/n8n
 * Probes the local n8n instance to report connectivity status.
 * Used by the terminal UI to display the n8n online/offline badge.
 */
export async function GET() {
  const n8nUrl = process.env.N8N_WEBHOOK_URL
    ? new URL(process.env.N8N_WEBHOOK_URL).origin
    : 'http://localhost:5678';

  try {
    const res = await fetch(`${n8nUrl}/healthz`, {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      return new Response(JSON.stringify({ online: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw new Error(`n8n returned ${res.status}`);
  } catch {
    return new Response(JSON.stringify({ online: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
