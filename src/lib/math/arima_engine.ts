export interface ForecastPoint {
  cohort: string;
  actual: number | null;
  predicted: number;
}

/**
 * ArimaEngine
 * Wrapper around the 'arima' Wasm library for sentiment forecasting.
 * Uses dynamic require to prevent Next.js Turbopack from bundling it for the browser.
 */
export class ArimaEngine {
  /**
   * Forecasts the next N steps for a sentiment series.
   * Handles AutoARIMA parameter optimization.
   */
  static forecast(
    series: number[], 
    steps: number = 3, 
    cohortLabels: string[] = []
  ): ForecastPoint[] {
    // The 'arima' package needs some points for robust AutoARIMA.
    // If we have fewer than 10, we fallback to avoid "Series too short" errors.
    if (series.length < 10) {
      return this.fallbackLinear(series, steps, cohortLabels);
    }

    try {
      // Bypass Webpack/Turbopack static analysis by hiding the require
      const req = typeof window === 'undefined' ? eval('require') : null;
      if (!req) throw new Error('Not running in Node.js environment');
      
      const ARIMA = req('arima');
      
      const arima = new ARIMA({
        auto: true,
        p: 1, d: 0, q: 1,
        verbose: false
      }).train(series);

      const [predictions] = arima.predict(steps);

      // Build the results array
      const results: ForecastPoint[] = series.map((val, i) => ({
        cohort: cohortLabels[i] || `M${i}`,
        actual: val,
        predicted: val
      }));

      // Add forecasted points
      for (let i = 0; i < steps; i++) {
        const nextIndex = series.length + i;
        results.push({
          cohort: cohortLabels[nextIndex] || `M${nextIndex}`,
          actual: null,
          predicted: Number(predictions[i].toFixed(2))
        });
      }

      return results;
    } catch (error) {
      console.error('[ArimaEngine] Prediction failed, using fallback:', error);
      return this.fallbackLinear(series, steps, cohortLabels);
    }
  }

  /**
   * Fallback for short series or errors.
   * Uses simple linear trend if 2 points exist, otherwise constant.
   */
  private static fallbackLinear(series: number[], steps: number, labels: string[]): ForecastPoint[] {
    const results: ForecastPoint[] = series.map((val, i) => ({
      cohort: labels[i] || `M${i}`,
      actual: val,
      predicted: val
    }));

    let slope = 0;
    if (series.length >= 2) {
      slope = series[series.length - 1] - series[series.length - 2];
    }

    const lastVal = series.length > 0 ? series[series.length - 1] : 75; // Default 75% sentiment

    for (let i = 1; i <= steps; i++) {
      const nextIndex = series.length + i - 1;
      results.push({
        cohort: labels[nextIndex] || `M${nextIndex}`,
        actual: null,
        predicted: Number(Math.max(0, Math.min(100, lastVal + (slope * i))).toFixed(2))
      });
    }

    return results;
  }
}
