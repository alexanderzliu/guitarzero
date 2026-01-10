// Barrel export for scoring module
export {
  pitchMatches,
  classifyTiming,
  findMatchingNotes,
  findMissedNotes,
  getNoteKey,
  getActiveNotes,
  DEFAULT_TIMING_TOLERANCES,
  PITCH_TOLERANCE_SEMITONES,
  type TimingTolerances,
  type NoteMatchResult,
} from './hitDetection.js';

export {
  getBasePoints,
  getStreakMultiplier,
  calculatePoints,
  updateStreak,
  applyHitResult,
  getTotalNotes,
  getTotalHits,
  calculateAccuracy,
  getGrade,
  POINTS_BY_RESULT,
  STREAK_MULTIPLIERS,
  INITIAL_SCORE_STATE,
  type ScoreState,
} from './scoreCalculator.js';
