import type {
  SessionAggregate,
  PlayEventRecord,
  ProblemSpot,
  TimingBucket,
} from './sessionTypes';
import { getGrade } from '../scoring';

// ============================================================================
// Aggregate Calculator - Pure Functions for Session Statistics
// ============================================================================

/**
 * Calculate all aggregates from raw play events.
 * Called once when session ends.
 */
export function calculateAggregates(
  events: PlayEventRecord[],
  score: number,
  maxStreak: number
): SessionAggregate {
  const counts = countResults(events);
  const hitCount = counts.perfect + counts.good + counts.ok;
  const totalNotes = hitCount + counts.miss;
  const accuracy = totalNotes > 0 ? Math.round((hitCount / totalNotes) * 100) : 100;

  return {
    totalNotes,
    perfectCount: counts.perfect,
    goodCount: counts.good,
    okCount: counts.ok,
    missCount: counts.miss,
    hitCount,
    accuracy,
    score,
    maxStreak,
    averageOffsetMs: calculateAverageOffset(events),
    grade: getGrade(accuracy),
  };
}

/**
 * Count results by type.
 */
function countResults(
  events: PlayEventRecord[]
): Record<'perfect' | 'good' | 'ok' | 'miss', number> {
  return events.reduce(
    (acc, e) => {
      acc[e.result] = (acc[e.result] || 0) + 1;
      return acc;
    },
    { perfect: 0, good: 0, ok: 0, miss: 0 }
  );
}

/**
 * Calculate average timing offset (excluding misses).
 * Negative = tends to play early, positive = tends to play late.
 */
function calculateAverageOffset(events: PlayEventRecord[]): number {
  const hits = events.filter((e) => e.result !== 'miss');
  if (hits.length === 0) return 0;

  const sum = hits.reduce((acc, e) => acc + e.timingOffsetMs, 0);
  return Math.round(sum / hits.length);
}

/**
 * Identify problem spots - notes that are frequently missed.
 * Analyzes across multiple sessions for a given tab.
 */
export function identifyProblemSpots(
  sessions: { events: PlayEventRecord[] }[],
  minAttempts: number = 3,
  minMissRate: number = 0.5
): ProblemSpot[] {
  // Aggregate by eventId across all sessions
  const eventStats = new Map<string, { misses: number; total: number }>();

  for (const session of sessions) {
    for (const event of session.events) {
      const stats = eventStats.get(event.eventId) || { misses: 0, total: 0 };
      stats.total++;
      if (event.result === 'miss') {
        stats.misses++;
      }
      eventStats.set(event.eventId, stats);
    }
  }

  // Filter to notes with enough attempts and high miss rate
  const problemSpots: ProblemSpot[] = [];
  for (const [eventId, stats] of eventStats) {
    if (stats.total >= minAttempts) {
      const missRate = stats.misses / stats.total;
      if (missRate >= minMissRate) {
        problemSpots.push({
          eventId,
          missCount: stats.misses,
          totalAttempts: stats.total,
          missRate,
        });
      }
    }
  }

  // Sort by miss rate descending
  return problemSpots.sort((a, b) => b.missRate - a.missRate);
}

/**
 * Calculate timing distribution for histogram display.
 */
export function calculateTimingDistribution(
  events: PlayEventRecord[]
): TimingBucket[] {
  const buckets: TimingBucket[] = [
    { rangeMs: [-200, -100], count: 0, label: 'Very Early' },
    { rangeMs: [-100, -50], count: 0, label: 'Early' },
    { rangeMs: [-50, 50], count: 0, label: 'Perfect' },
    { rangeMs: [50, 100], count: 0, label: 'Late' },
    { rangeMs: [100, 200], count: 0, label: 'Very Late' },
  ];

  // Only count hits, not misses
  const hits = events.filter((e) => e.result !== 'miss');

  for (const event of hits) {
    const offset = event.timingOffsetMs;
    for (const bucket of buckets) {
      if (offset >= bucket.rangeMs[0] && offset < bucket.rangeMs[1]) {
        bucket.count++;
        break;
      }
    }
  }

  return buckets;
}

/**
 * Get timing tendency description.
 */
export function getTimingTendency(averageOffsetMs: number): string {
  if (Math.abs(averageOffsetMs) < 10) return 'On time';
  if (averageOffsetMs < -50) return 'Tends early';
  if (averageOffsetMs < 0) return 'Slightly early';
  if (averageOffsetMs > 50) return 'Tends late';
  return 'Slightly late';
}
