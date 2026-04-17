import * as crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1: Text Normalisation
// Produces a canonical string used for hashing and similarity comparison.
// The original text is preserved separately for storage and Claude analysis.
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    // Replace emoji with a space (preserves word boundaries)
    .replace(/[\u{1F300}-\u{1FFFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, ' ')
    // Collapse repeated punctuation (!!!!! → !)
    .replace(/([!?.,;])\1+/g, '$1')
    // Strip non-alphanumeric except spaces and basic punctuation
    .replace(/[^\w\s.,!?'-]/g, ' ')
    // Collapse all whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2: Exact Deduplication
// MD5 of the normalised text. Two reviews with different capitalisation,
// spacing, or emoji-spray still map to the same hash.
// ─────────────────────────────────────────────────────────────────────────────

export function hashReview(text: string): string {
  return crypto
    .createHash('md5')
    .update(normalizeText(text))
    .digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 3: Near-Duplicate Detection (Jaccard similarity on word sets)
// ─────────────────────────────────────────────────────────────────────────────

export function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(normalizeText(a).split(/\s+/).filter(Boolean));
  const setB = new Set(normalizeText(b).split(/\s+/).filter(Boolean));
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  const intersection = [...setA].filter(x => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dedup Pipeline Result Types
// ─────────────────────────────────────────────────────────────────────────────

export type FlagReason = 'exact_duplicate' | 'near_duplicate' | 'bot_pattern';

export interface DeduplicationResult {
  /** Reviews that passed all dedup checks — safe to analyze */
  clean: ProcessedReview[];
  /** Reviews that were flagged — must be stored in flagged_reviews, NOT dropped */
  flagged: FlaggedReview[];
}

export interface ProcessedReview {
  id: string;
  product_id: string;
  batch_id?: string;
  rawText: string;        // original, untouched
  text: string;           // normalised, used for analysis
  normalizedHash: string;
  dedupClusterId?: string;
  created_at: string;
}

export interface FlaggedReview {
  id: string;
  originalId: string;
  product_id: string;
  batch_id?: string;
  rawText: string;
  flagReason: FlagReason;
  dedupClusterId?: string;
  similarTo?: string;
  similarityScore?: number;
  flaggedAt: string;
}

interface InputReview {
  id: string;
  product_id: string;
  batch_id?: string;
  text: string;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// runDeduplicationPipeline
//
// Three-pass algorithm:
//   Pass 1 — Exact dedup: group by normalised MD5 hash
//             Keep ONE representative per hash group.
//             If a hash appears 2+ times, extras are flagged as 'exact_duplicate'.
//   Pass 2 — Bot pattern: among the kept reviews, if exact-dup count >= 3
//             the REPRESENTATIVE itself is also flagged as 'bot_pattern'.
//   Pass 3 — Near-dedup: O(n²) Jaccard over the surviving set.
//             Pairs with similarity > NEAR_DUP_THRESHOLD are clustered.
//             Within each cluster, keep the longest review; flag the rest as
//             'near_duplicate' with their similarity score.
// ─────────────────────────────────────────────────────────────────────────────

const NEAR_DUP_THRESHOLD = 0.80;   // 80% word-set overlap = near-duplicate
const BOT_PATTERN_MIN_COUNT = 3;   // same review >= 3 times = bot pattern

export function runDeduplicationPipeline(inputReviews: InputReview[]): DeduplicationResult {
  const clean: ProcessedReview[] = [];
  const flagged: FlaggedReview[] = [];
  const now = new Date().toISOString();

  // ── Pass 1: Exact dedup ──────────────────────────────────────────────────

  // Map: normalizedHash → list of reviews sharing that hash
  const hashGroups = new Map<string, InputReview[]>();

  for (const review of inputReviews) {
    const hash = hashReview(review.text);
    if (!hashGroups.has(hash)) hashGroups.set(hash, []);
    hashGroups.get(hash)!.push(review);
  }

  // Representatives survive pass 1; duplicates are flagged
  const survivors: ProcessedReview[] = [];

  for (const [hash, group] of hashGroups) {
    const isBotPattern = group.length >= BOT_PATTERN_MIN_COUNT;
    const representative = group[0];

    if (isBotPattern) {
      // Flag ALL copies including the representative as bot_pattern
      for (const r of group) {
        flagged.push({
          id: crypto.randomUUID(),
          originalId: r.id,
          product_id: r.product_id,
          batch_id: r.batch_id,
          rawText: r.text,
          flagReason: 'bot_pattern',
          flaggedAt: now,
        });
      }
    } else {
      // Keep representative; flag extras as exact_duplicate
      survivors.push({
        id: representative.id,
        product_id: representative.product_id,
        batch_id: representative.batch_id,
        rawText: representative.text,
        text: normalizeText(representative.text),
        normalizedHash: hash,
        created_at: representative.created_at,
      });

      for (const r of group.slice(1)) {
        flagged.push({
          id: crypto.randomUUID(),
          originalId: r.id,
          product_id: r.product_id,
          batch_id: r.batch_id,
          rawText: r.text,
          flagReason: 'exact_duplicate',
          similarTo: representative.id,
          similarityScore: 1.0,
          flaggedAt: now,
        });
      }
    }
  }

  // ── Pass 2: Near-duplicate clustering (O(n²) — fine at hackathon scale) ──

  // Union-Find for clustering
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
    return parent.get(x)!;
  };
  const union = (x: string, y: string) => {
    parent.set(find(x), find(y));
  };

  for (const s of survivors) parent.set(s.id, s.id);

  const nearDupPairs: Array<{ a: string; b: string; score: number }> = [];

  for (let i = 0; i < survivors.length; i++) {
    for (let j = i + 1; j < survivors.length; j++) {
      const score = jaccardSimilarity(survivors[i].rawText, survivors[j].rawText);
      if (score >= NEAR_DUP_THRESHOLD) {
        union(survivors[i].id, survivors[j].id);
        nearDupPairs.push({ a: survivors[i].id, b: survivors[j].id, score });
      }
    }
  }

  // Build cluster groups: clusterId → members
  const clusters = new Map<string, ProcessedReview[]>();
  for (const s of survivors) {
    const root = find(s.id);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(s);
  }

  // Within each cluster, keep the longest review; flag the rest
  for (const [clusterId, members] of clusters) {
    if (members.length === 1) {
      // No near-dup — just clean
      clean.push({ ...members[0] });
      continue;
    }

    // Sort by text length desc; keep longest as most informative
    members.sort((a, b) => b.rawText.length - a.rawText.length);
    const kept = members[0];
    clean.push({ ...kept, dedupClusterId: clusterId });

    for (const m of members.slice(1)) {
      const pair = nearDupPairs.find(p =>
        (p.a === m.id && p.b === kept.id) || (p.b === m.id && p.a === kept.id)
      );
      flagged.push({
        id: crypto.randomUUID(),
        originalId: m.id,
        product_id: m.product_id,
        batch_id: m.batch_id,
        rawText: m.rawText,
        flagReason: 'near_duplicate',
        dedupClusterId: clusterId,
        similarTo: kept.id,
        similarityScore: pair?.score,
        flaggedAt: now,
      });
    }
  }

  return { clean, flagged };
}
