import type { ScoreResult } from '../../types';

// ============================================================================
// Score Calculator - Points and Streak Logic
// ============================================================================

/**
 * Points awarded for each result type.
 */
export const POINTS_BY_RESULT: Record<ScoreResult, number> = {
  perfect: 100,
  good: 75,
  ok: 50,
  miss: 0,
};

/**
 * Streak multiplier thresholds and their bonus multipliers.
 */
export const STREAK_MULTIPLIERS = [
  { threshold: 30, multiplier: 4 },
  { threshold: 20, multiplier: 3 },
  { threshold: 10, multiplier: 2 },
  { threshold: 0, multiplier: 1 },
] as const;

/**
 * Get base points for a score result.
 */
export function getBasePoints(result: ScoreResult): number {
  return POINTS_BY_RESULT[result];
}

/**
 * Get streak multiplier based on current streak count.
 */
export function getStreakMultiplier(streak: number): number {
  for (const { threshold, multiplier } of STREAK_MULTIPLIERS) {
    if (streak >= threshold) return multiplier;
  }
  return 1;
}

/**
 * Calculate points with streak bonus applied.
 */
export function calculatePoints(result: ScoreResult, streak: number): number {
  const base = getBasePoints(result);
  const multiplier = getStreakMultiplier(streak);
  return base * multiplier;
}

/**
 * Update streak based on hit result.
 * Streak increases on any hit, resets to 0 on miss.
 */
export function updateStreak(currentStreak: number, result: ScoreResult): number {
  if (result === 'miss') return 0;
  return currentStreak + 1;
}

/**
 * Scoring state managed by the game engine.
 */
export interface ScoreState {
  score: number;
  streak: number;
  maxStreak: number;
  perfectCount: number;
  goodCount: number;
  okCount: number;
  missCount: number;
}

/**
 * Initial scoring state.
 */
export const INITIAL_SCORE_STATE: ScoreState = {
  score: 0,
  streak: 0,
  maxStreak: 0,
  perfectCount: 0,
  goodCount: 0,
  okCount: 0,
  missCount: 0,
};

/**
 * Apply a hit result to the score state (immutable update).
 */
export function applyHitResult(
  state: ScoreState,
  result: ScoreResult
): ScoreState {
  const newStreak = updateStreak(state.streak, result);
  const points = calculatePoints(result, state.streak);

  return {
    score: state.score + points,
    streak: newStreak,
    maxStreak: Math.max(state.maxStreak, newStreak),
    perfectCount: state.perfectCount + (result === 'perfect' ? 1 : 0),
    goodCount: state.goodCount + (result === 'good' ? 1 : 0),
    okCount: state.okCount + (result === 'ok' ? 1 : 0),
    missCount: state.missCount + (result === 'miss' ? 1 : 0),
  };
}

/**
 * Get total notes played (hits + misses).
 */
export function getTotalNotes(state: ScoreState): number {
  return state.perfectCount + state.goodCount + state.okCount + state.missCount;
}

/**
 * Get total successful hits.
 */
export function getTotalHits(state: ScoreState): number {
  return state.perfectCount + state.goodCount + state.okCount;
}

/**
 * Calculate accuracy percentage.
 */
export function calculateAccuracy(state: ScoreState): number {
  const total = getTotalNotes(state);
  if (total === 0) return 100;

  return Math.round((getTotalHits(state) / total) * 100);
}

/**
 * Get a letter grade based on accuracy.
 */
export function getGrade(accuracy: number): string {
  if (accuracy >= 95) return 'S';
  if (accuracy >= 90) return 'A';
  if (accuracy >= 80) return 'B';
  if (accuracy >= 70) return 'C';
  if (accuracy >= 60) return 'D';
  return 'F';
}
