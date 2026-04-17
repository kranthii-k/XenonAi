import * as crypto from 'crypto';

export function hashReview(text: string): string {
  return crypto.createHash('md5')
    .update(text.toLowerCase().replace(/\s+/g, ' ').trim())
    .digest('hex');
}

export function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...setA].filter(x => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

export function detectBotPattern(reviews: string[]): Set<string> {
  const freq = new Map<string, number>();
  reviews.forEach(r => {
    const h = hashReview(r);
    freq.set(h, (freq.get(h) ?? 0) + 1);
  });
  return new Set([...freq.entries()]
    .filter(([, count]) => count >= 3)
    .map(([hash]) => hash));
}
