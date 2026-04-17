import { db } from '../db';
import { reviews, featureSentiments, featureForecasts, products } from '../db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { ArimaEngine } from '../math/arima_engine';
import { COHORT_MAP } from '../utils/cohorts';
import crypto from 'crypto';

/**
 * Forecaster Service
 * Handles the generation of sentiment M24 projections.
 */
export class Forecaster {
  /**
   * Generates or updates forecasts for all features of a product.
   */
  static async updateProductForecasts(productId: string) {
    console.log(`[Forecaster] Updating forecasts for ${productId}`);
    
    // 1. Get all features recorded for this product
    const featuresQuery = await db.select({ 
      feature: featureSentiments.feature 
    })
    .from(featureSentiments)
    .innerJoin(reviews, eq(featureSentiments.reviewId, reviews.id))
    .where(eq(reviews.productId, productId))
    .groupBy(featureSentiments.feature);

    const featureList = featuresQuery.map(f => f.feature);

    for (const feature of featureList) {
      await this.forecastFeature(productId, feature);
    }
  }

  /**
   * Forecasts a specific feature's sentiment trajectory.
   */
  private static async forecastFeature(productId: string, feature: string) {
    // 2. Aggregate average positive sentiment per cohort
    // We filter out 'M24+' to only use the standard baseline for training.
    const rawSeries = await db.select({
      cohort: reviews.cohort,
      avgPositive: sql<number>`AVG(CASE WHEN ${featureSentiments.sentiment} = 'positive' THEN 100 ELSE 0 END)`
    })
    .from(featureSentiments)
    .innerJoin(reviews, eq(featureSentiments.reviewId, reviews.id))
    .where(and(
      eq(reviews.productId, productId),
      eq(featureSentiments.feature, feature)
    ))
    .groupBy(reviews.cohort);

    // 3. Align with COHORT_MAP
    const cohortLabels = COHORT_MAP.map(c => c.label);
    const seriesData = cohortLabels.map(label => {
      const match = rawSeries.find(s => s.cohort === label);
      return match ? Number(match.avgPositive) : null;
    });

    // Find where actual data ends
    const firstNull = seriesData.indexOf(null);
    const knownData = firstNull === -1 ? seriesData : seriesData.slice(0, firstNull);
    
    // We want to forecast the remaining cohorts up to the end of COHORT_MAP
    const stepsToForecast = cohortLabels.length - knownData.length;
    
    if (stepsToForecast <= 0) return; // Already at M24 or beyond

    // 4. Run ARIMA/Fallback
    const cleanedSeries = this.interpolate(knownData as number[]);
    const forecast = ArimaEngine.forecast(cleanedSeries, stepsToForecast, cohortLabels);

    // 5. Persist to DB
    const now = new Date().toISOString();
    await db.insert(featureForecasts).values({
      id: crypto.randomUUID(),
      productId,
      feature,
      dataJson: JSON.stringify(forecast),
      lastUpdated: now
    }).onConflictDoUpdate({
      target: [featureForecasts.productId, featureForecasts.feature],
      set: {
        dataJson: JSON.stringify(forecast),
        lastUpdated: now
      }
    });
  }

  /**
   * Fill nulls in series with last known value or 75% baseline.
   */
  private static interpolate(series: (number | null)[]): number[] {
    const result: number[] = [];
    let lastKnown = 75; 

    for (const val of series) {
      if (val !== null) {
        lastKnown = val;
        result.push(val);
      } else {
        result.push(lastKnown);
      }
    }
    
    return result;
  }
}
