import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(req: Request) {
  try {
    const { url, productId } = await req.json();

    if (!url) {
      return Response.json({ error: 'URL is required' }, { status: 400 });
    }

    if (!url.includes('amazon') && !url.includes('flipkart')) {
      return Response.json({ error: 'Only Amazon and Flipkart URLs are supported' }, { status: 400 });
    }

    const bridgePath = path.join(process.cwd(), 'scripts', 'fetch-reviews.js');
    const escapedUrl = url.replace(/"/g, '\\"');
    const escapedProductId = (productId || 'manual-fetch').replace(/"/g, '\\"');

    // Execute the bridge script
    let stdout, stderr;
    try {
        const result = await execAsync(`node "${bridgePath}" "${escapedUrl}" "${escapedProductId}"`);
        stdout = result.stdout;
        stderr = result.stderr;
    } catch (error: any) {
        // exec throws on non-zero exit code
        return Response.json({ 
          error: 'Scraping engine crashed', 
          details: error.stderr || error.message 
        }, { status: 500 });
    }

    // Try to parse the result from stdout
    const lines = stdout.split('\n').filter(l => l.trim());
    let lastLine = lines[lines.length - 1];
    
    // Find the actual JSON line (sometimes logs come after or before)
    const jsonLine = lines.find(l => l.startsWith('{') && l.endsWith('}')) || lastLine;

    try {
        const parsed = JSON.parse(jsonLine);
        if (parsed.error) {
            return Response.json({ 
                error: parsed.error,
                is_blocked: parsed.error.includes('CAPTCHA') || parsed.error.includes('block')
            }, { status: parsed.error.includes('CAPTCHA') ? 403 : 400 });
        }

        return Response.json({
          message: 'Scraping and ingestion successful',
          scraped_count: lines.find(l => l.includes('Successfully scraped'))?.match(/\d+/)?.[0] || 0,
          ingest_result: parsed
        });
    } catch (e) {
        return Response.json({ 
            error: 'Failed to parse engine output', 
            raw_stdout: stdout,
            raw_stderr: stderr 
        }, { status: 500 });
    }

  } catch (error) {
    console.error('[api/fetch] Unexpected error:', error);
    return Response.json({ error: 'Internal server error', detail: String(error) }, { status: 500 });
  }
}
