import { AnalyzedReview } from '../../types';

export interface WindowResult {
  feature: string;
  current_negative_pct: number;
  previous_negative_pct: number;
  current_positive_pct: number;
  previous_positive_pct: number;
  delta_negative: number;
  delta_positive: number;
  z_score: number;
  is_anomaly: boolean;
  issue_type: 'isolated' | 'emerging' | 'systemic' | 'praise_spike';
  unique_users_affected: number;
}

/**
 * Computes statistical trends across a rolling window of reviews.
 * 
 * Logic:
 * 1. Differentiates between negative and positive shifts.
 * 2. Uses Z-score to determine statistical significance (anomaly).
 * 3. Flags 'systemic' issues if multiple users are affected and Z-score > 2.0.
 */
export function computeRollingTrends(
  reviews: AnalyzedReview[],
  windowSize = 50
): WindowResult[] {
  const results: WindowResult[] = [];
  
  const allFeatures = [...new Set(
    reviews.flatMap(r => r.features.map(f => f.feature))
  )];
  
  const current = reviews.slice(-windowSize);
  const previous = reviews.slice(-windowSize * 2, -windowSize);
  
  for (const feature of allFeatures) {
    const currentNeg = current.filter(r =>
      r.features?.some(f => f.feature === feature && f.sentiment === 'negative')
    ).length / Math.max(current.length, 1);
    
    const previousNeg = previous.length > 0
      ? previous.filter(r =>
          r.features?.some(f => f.feature === feature && f.sentiment === 'negative')
        ).length / previous.length
      : 0;

    const currentPos = current.filter(r =>
      r.features?.some(f => f.feature === feature && f.sentiment === 'positive')
    ).length / Math.max(current.length, 1);
    
    const previousPos = previous.length > 0
      ? previous.filter(r =>
          r.features?.some(f => f.feature === feature && f.sentiment === 'positive')
        ).length / previous.length
      : 0;
    
    const deltaNeg = currentNeg - previousNeg;
    const deltaPos = currentPos - previousPos;
    
    // Z-score for negative trend: (delta) / stderr
    // stderr = sqrt( p*(1-p) / N )
    const p = previousNeg;
    const stderr = Math.sqrt((p * (1 - p)) / windowSize) || 0.01; // Avoid div by zero
    const z_score = deltaNeg / stderr;
    
    const negativeReviews = current.filter(r =>
      r.features?.some(f => f.feature === feature && f.sentiment === 'negative')
    );
    const uniqueUsers = new Set(negativeReviews.map(r => r.id)).size;
    
    let issue_type: WindowResult['issue_type'] = 'isolated';
    if (uniqueUsers > 2) {
      if (z_score > 2.0) issue_type = 'systemic';
      else if (deltaNeg > 0.1) issue_type = 'emerging';
      else if (deltaPos > 0.15) issue_type = 'praise_spike';
    }
    
    results.push({
      feature,
      current_negative_pct: currentNeg,
      previous_negative_pct: previousNeg,
      current_positive_pct: currentPos,
      previous_positive_pct: previousPos,
      delta_negative: deltaNeg,
      delta_positive: deltaPos,
      z_score,
      is_anomaly: z_score > 2.0 || deltaNeg > 0.25,
      issue_type,
      unique_users_affected: uniqueUsers
    });
  }
  
  return results.sort((a, b) => b.delta_negative - a.delta_negative);
}

// Generate human-readable alert messages
export function generateAlertMessage(r: WindowResult, productName: string): string {
  const curr = Math.round(r.current_negative_pct * 100);
  const prev = Math.round(r.previous_negative_pct * 100);
  const label = r.feature.replace(/_/g, ' ');
  
  if (r.issue_type === 'systemic') {
    return `${label} complaints in ${productName} have reached ${curr}% (up from ${prev}% in previous window). ` +
           `Affecting ${r.unique_users_affected} unique reviewers — likely a systemic batch issue. ` +
           `Recommended action: audit ${label} supply chain or vendor for this period.`;
  }
  return `${label} negative mentions rose to ${curr}% from ${prev}%. Monitor over next 50 reviews.`;
}
