import { AnalyzedReview } from '../../types';

export interface WindowResult {
  feature: string;
  current_negative_pct: number;
  previous_negative_pct: number;
  delta: number;
  z_score: number;
  is_anomaly: boolean;
  issue_type: 'isolated' | 'emerging' | 'systemic';
  unique_users_affected: number;
}

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
      r.features.some(f => f.feature === feature && f.sentiment === 'negative')
    ).length / Math.max(current.length, 1);
    
    const previousNeg = previous.length > 0
      ? previous.filter(r =>
          r.features.some(f => f.feature === feature && f.sentiment === 'negative')
        ).length / previous.length
      : 0;
    
    const delta = currentNeg - previousNeg;
    
    // Z-score: how many standard deviations above historical mean?
    const historicalMean = previousNeg;
    const historicalStd = Math.sqrt(previousNeg * (1 - previousNeg) / windowSize);
    const z_score = historicalStd > 0 ? delta / historicalStd : 0;
    
    const matchingReviews = current.filter(r =>
      r.features.some(f => f.feature === feature && f.sentiment === 'negative')
    );
    const uniqueUsers = new Set(matchingReviews.map(r => r.id)).size;
    
    const issue_type =
      uniqueUsers <= 2 ? 'isolated' :
      z_score > 2.0 ? 'systemic' : 'emerging';
    
    results.push({
      feature, current_negative_pct: currentNeg, previous_negative_pct: previousNeg,
      delta, z_score, is_anomaly: z_score > 2.0, issue_type, unique_users_affected: uniqueUsers
    });
  }
  
  return results.sort((a, b) => b.delta - a.delta);
}

// Generate human-readable alert messages
export function generateAlertMessage(r: WindowResult, productName: string): string {
  const curr = Math.round(r.current_negative_pct * 100);
  const prev = Math.round(r.previous_negative_pct * 100);
  const label = r.feature.replace(/_/g, ' ');
  
  if (r.issue_type === 'systemic') {
    return \`\${label} complaints in \${productName} have reached \${curr}% (up from \${prev}% in previous window). \` +
           \`Affecting \${r.unique_users_affected} unique reviewers — likely a systemic batch issue. \` +
           \`Recommended action: audit \${label} supply chain or vendor for this period.\`;
  }
  return \`\${label} negative mentions rose to \${curr}% from \${prev}%. Monitor over next 50 reviews.\`;
}
