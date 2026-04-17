export type Sentiment = 'positive' | 'negative' | 'neutral' | 'ambiguous';
export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface RawReview {
  id: string;
  product_id: string;
  text: string;
  created_at: string;
  batch_id?: string;
}

export interface FeatureSentiment {
  feature: string;       // "battery_life" | "packaging" | "delivery" etc.
  sentiment: Sentiment;
  confidence: number;    // 0–1
  quote: string;         // verbatim snippet from review
}

export interface AnalyzedReview extends RawReview {
  language: string;
  translated_text?: string;
  overall_sentiment: Sentiment;
  confidence: number;
  is_sarcastic: boolean;
  is_ambiguous: boolean;
  features: FeatureSentiment[];
}

export interface TrendSnapshot {
  product_id: string;
  feature: string;
  batch_index: number;
  negative_pct: number;
  positive_pct: number;
  z_score: number;
  is_anomaly: boolean;
}

export interface Alert {
  id: string;
  product_id: string;
  feature: string;
  severity: Severity;
  message: string;
  current_pct: number;
  previous_pct: number;
  delta: number;
  created_at: string;
}
