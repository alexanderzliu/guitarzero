import type { ScoreResult, MidiNote } from '../../types';
import type { PlayEventRecord } from './sessionTypes';
import type { RenderNote } from '../tabs/tempoUtils';
import { getNoteKey } from '../scoring';

// ============================================================================
// Event Capture - Build PlayEventRecords During Gameplay
// ============================================================================

/**
 * Create a PlayEventRecord from a successful hit detection match.
 */
export function createHitEvent(
  note: RenderNote,
  result: ScoreResult,
  offsetMs: number,
  detectedMidi: MidiNote,
  currentTimeSec: number
): PlayEventRecord {
  return {
    eventId: note.eventId,
    noteKey: getNoteKey(note),
    timestampSec: currentTimeSec,
    timingOffsetMs: offsetMs,
    result,
    detectedMidi,
    expectedMidi: note.midi,
    expectedTimeSec: note.timeSec,
  };
}

/**
 * Create a PlayEventRecord for a missed note.
 * The timing offset is calculated as how late we are past the note.
 */
export function createMissEvent(
  note: RenderNote,
  currentTimeSec: number
): PlayEventRecord {
  return {
    eventId: note.eventId,
    noteKey: getNoteKey(note),
    timestampSec: currentTimeSec,
    timingOffsetMs: (currentTimeSec - note.timeSec) * 1000,
    result: 'miss',
    expectedMidi: note.midi,
    expectedTimeSec: note.timeSec,
    // detectedMidi is undefined for misses
  };
}
