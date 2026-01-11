import type { ScoreResult, MidiNote } from '../../types';

// ============================================================================
// Session Domain Types - Pure TypeScript, no framework dependencies
// ============================================================================

/**
 * Extended PlayEvent with additional capture data.
 * Stored as raw events for replay/analysis.
 */
export interface PlayEventRecord {
  eventId: string; // Reference to NoteEvent.id in tab
  noteKey: string; // eventId-noteIndex for correlation
  timestampSec: number; // When the event occurred in song time
  timingOffsetMs: number; // Negative = early, positive = late
  result: ScoreResult;
  detectedMidi?: MidiNote; // What pitch was detected (hits only)
  expectedMidi: MidiNote; // What pitch was expected
  expectedTimeSec: number; // When the note was expected
}

/**
 * Pre-computed aggregates for fast display.
 * Calculated once at session end, stored alongside events.
 */
export interface SessionAggregate {
  totalNotes: number;
  perfectCount: number;
  goodCount: number;
  okCount: number;
  missCount: number;
  hitCount: number; // perfect + good + ok
  accuracy: number; // 0-100 percentage
  score: number;
  maxStreak: number;
  averageOffsetMs: number; // For timing analysis (negative = tends early)
  grade: string; // S/A/B/C/D/F
}

/**
 * Problem spot - a note that was frequently missed.
 */
export interface ProblemSpot {
  eventId: string;
  missCount: number;
  totalAttempts: number;
  missRate: number; // 0-1
}

/**
 * Timing distribution bucket for histogram.
 */
export interface TimingBucket {
  rangeMs: [number, number]; // e.g., [-50, -25]
  count: number;
  label: string; // e.g., "Early", "Perfect", "Late"
}

/**
 * Complete session record stored in IndexedDB.
 */
export interface SessionRecord {
  id: string; // UUID
  tabId: string; // Reference to Tab.id
  tabTitle: string; // Denormalized for display without join
  tabArtist: string;
  playbackSpeed: number; // 0.25-2.0
  startedAt: Date;
  finishedAt: Date;
  durationSec: number; // Actual playtime
  aggregate: SessionAggregate;
  events: PlayEventRecord[];
}

/**
 * Minimal session metadata for list views (without events).
 */
export interface SessionMetadata {
  id: string;
  tabId: string;
  tabTitle: string;
  tabArtist: string;
  finishedAt: Date;
  playbackSpeed: number;
  accuracy: number;
  score: number;
  grade: string;
  maxStreak: number;
}
