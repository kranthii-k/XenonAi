/**
 * scripts/run-scraper.ts
 *
 * Fetches real product reviews from Reddit's public JSON API.
 * No auth required — uses public .json endpoints.
 *
 * Run with: npx tsx scripts/run-scraper.ts
 */

import fs from 'fs';
import path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Config: subreddit → product_id mapping
// ─────────────────────────────────────────────────────────────────────────────

const SOURCES = [
  { product_id: 'smartphones',    subreddit: 'smartphones',    limit: 60, type: 'posts'    },
  { product_id: 'earbuds',        subreddit: 'headphones',     limit: 60, type: 'posts'    },
  { product_id: 'laptops',        subreddit: 'laptops',        limit: 60, type: 'posts'    },
  { product_id: 'refrigerator',   subreddit: 'Appliances',     limit: 40, type: 'posts'    },
  { product_id: 'microwave-oven', subreddit: 'cookware',       limit: 30, type: 'posts'    },
  { product_id: 'geyser',         subreddit: 'HomeImprovement',limit: 30, type: 'posts'    },
];

const HEADERS = {
  'User-Agent': 'XenonAI-ReviewScraper/1.0 (open-source research tool)',
  'Accept': 'application/json',
};

const OUTPUT_PATH = path.join(process.cwd(), 'public', 'data', 'scraped-reviews.json');
const MIN_LENGTH = 10;   // chars — drop micro-posts
const MAX_LENGTH = 1200; // chars — drop enormous walls of text

// ─────────────────────────────────────────────────────────────────────────────
// Text cleaner
// ─────────────────────────────────────────────────────────────────────────────

function cleanText(raw: string): string {
  return raw
    // Remove URLs
    .replace(/https?:\/\/[^\s)>\]]+/g, '')
    // Remove markdown image/link syntax  ![...](...) or [...](...) 
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Remove markdown bold/italic (**text**, *text*, __text__, _text_)
    .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, '$2')
    // Remove markdown headers (## Heading)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Remove Reddit-specific markup (e.g. >!spoiler!<, ^superscript)
    .replace(/>!.*?!</g, '')
    .replace(/\^[\w]+/g, '')
    // Remove subreddit/user mentions
    .replace(/\/?r\/\w+/g, '')
    .replace(/\/?u\/\w+/g, '')
    // Collapse multiple line breaks to one space
    .replace(/[\r\n]+/g, ' ')
    // Collapse multiple spaces
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Reddit JSON fetcher
// ─────────────────────────────────────────────────────────────────────────────

interface RedditPost {
  data: {
    selftext?: string;
    title?: string;
    body?: string;
    score: number;
    is_self?: boolean;
    stickied?: boolean;
  };
}

async function fetchSubredditPosts(
  subreddit: string,
  limit: number
): Promise<string[]> {
  const url = `https://www.reddit.com/r/${subreddit}/top.json?limit=${limit}&t=month`;

  try {
    const res = await fetch(url, { headers: HEADERS });

    if (!res.ok) {
      console.warn(`  [${subreddit}] HTTP ${res.status} — skipping`);
      return [];
    }

    const json = await res.json() as { data?: { children?: RedditPost[] } };
    const children = json?.data?.children ?? [];

    const texts: string[] = [];

    for (const child of children) {
      const d = child.data;
      if (d.stickied) continue; // Skip mod-pinned posts

      // Use selftext (post body) for text posts, title as fallback
      const candidates = [d.selftext, d.body, d.title].filter(Boolean) as string[];

      for (const raw of candidates) {
        if (raw === '[deleted]' || raw === '[removed]') continue;
        if (raw.trim() === '') continue;

        const cleaned = cleanText(raw);
        if (cleaned.length >= MIN_LENGTH && cleaned.length <= MAX_LENGTH) {
          texts.push(cleaned);
          break; // one text per post
        }
      }
    }

    return texts;
  } catch (err) {
    console.warn(`  [${subreddit}] Fetch failed: ${(err as Error).message}`);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌐 Xenon AI — Real-World Review Scraper');
  console.log('─'.repeat(45));

  const results: { product_id: string; text: string }[] = [];

  for (const source of SOURCES) {
    process.stdout.write(`  Fetching r/${source.subreddit} → ${source.product_id}... `);

    // Polite rate-limit: wait 1.2s between Reddit requests
    await new Promise(r => setTimeout(r, 1200));

    const texts = await fetchSubredditPosts(source.subreddit, source.limit);

    for (const text of texts) {
      results.push({ product_id: source.product_id, text });
    }

    console.log(`${texts.length} reviews collected`);
  }

  if (results.length === 0) {
    console.error('\n❌ No reviews scraped. Reddit may be rate-limiting — try again in a minute.');
    process.exit(1);
  }

  // Ensure output directory exists
  const dir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2), 'utf-8');

  console.log('\n─'.repeat(45));
  console.log(`✅ ${results.length} real reviews written to: public/data/scraped-reviews.json`);

  // Breakdown by product
  const counts: Record<string, number> = {};
  for (const r of results) counts[r.product_id] = (counts[r.product_id] ?? 0) + 1;
  for (const [pid, count] of Object.entries(counts)) {
    console.log(`   ${pid.padEnd(20)} ${count} reviews`);
  }
  console.log('');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
