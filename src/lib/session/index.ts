// ============================================================================
// Session Module - Barrel Exports
// ============================================================================

// Types
export type {
  PlayEventRecord,
  SessionAggregate,
  SessionRecord,
  SessionMetadata,
  ProblemSpot,
  TimingBucket,
} from './sessionTypes';

// Aggregate calculation
export {
  calculateAggregates,
  identifyProblemSpots,
  calculateTimingDistribution,
  getTimingTendency,
} from './aggregateCalculator';

// Event capture
export { createHitEvent, createMissEvent } from './eventCapture';
