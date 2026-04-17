import { differenceInDays, parseISO } from 'date-fns';

/**
 * Cohort Buckets (Days from launch)
 * As per schematic: M1, M3, M6, M9, M12, M18, M24
 */
export const COHORT_MAP = [
  { label: 'M1', maxDays: 45 },    // 0-45
  { label: 'M3', maxDays: 135 },   // 46-135
  { label: 'M6', maxDays: 225 },   // 136-225
  { label: 'M9', maxDays: 315 },   // 226-315
  { label: 'M12', maxDays: 405 },  // 316-405
  { label: 'M18', maxDays: 585 },  // 406-585
  { label: 'M24', maxDays: 9999 }  // 586+
];

export function getCohortAndDays(reviewDate: string, launchDate: string) {
  const rDate = typeof reviewDate === 'string' ? parseISO(reviewDate) : new Date(reviewDate);
  const lDate = typeof launchDate === 'string' ? parseISO(launchDate) : new Date(launchDate);
  
  const days = differenceInDays(rDate, lDate);
  
  for (const bucket of COHORT_MAP) {
    if (days <= bucket.maxDays) {
      return { cohort: bucket.label, daysSinceLaunch: days };
    }
  }
  
  return { cohort: 'M24+', daysSinceLaunch: days };
}
