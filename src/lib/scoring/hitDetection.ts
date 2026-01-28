import type { ScoreResult, MidiNote } from '../../types';
import type { RenderNote } from '../tabs/tempoUtils';

// ============================================================================
// Hit Detection - Pure Functions for Scoring Logic
// ============================================================================

/**
 * Timing tolerance windows in milliseconds.
 * Perfect is tightest, ok is most lenient.
 */
export interface TimingTolerances {
  perfectMs: number;
  goodMs: number;
  okMs: number;
}

export const DEFAULT_TIMING_TOLERANCES: TimingTolerances = {
  perfectMs: 50, // ±50ms
  goodMs: 100, // ±100ms
  okMs: 200, // ±200ms (also used as miss threshold)
};

/**
 * Pitch tolerance in semitones.
 * Allows for tuning differences and pitch detection variance during attack transients.
 */
export const PITCH_TOLERANCE_SEMITONES = 2;

/**
 * Check if a detected MIDI pitch matches an expected note within tolerance.
 */
export function pitchMatches(
  detectedMidi: MidiNote | null,
  expectedMidi: MidiNote,
  toleranceSemitones: number = PITCH_TOLERANCE_SEMITONES
): boolean {
  if (detectedMidi === null) return false;
  const delta = Math.abs(detectedMidi - expectedMidi);
  if (delta <= toleranceSemitones) return true;

  // Common pitch detector failure mode on guitar is octave errors due to strong harmonics.
  const OCTAVE = 12;
  return (
    Math.abs(detectedMidi - (expectedMidi + OCTAVE)) <= toleranceSemitones ||
    Math.abs(detectedMidi - (expectedMidi - OCTAVE)) <= toleranceSemitones
  );
}

/**
 * Classify timing accuracy based on offset from expected time.
 * Returns null if outside the ok window (miss).
 */
export function classifyTiming(
  offsetMs: number,
  tolerances: TimingTolerances = DEFAULT_TIMING_TOLERANCES
): ScoreResult | null {
  const absOffset = Math.abs(offsetMs);

  if (absOffset <= tolerances.perfectMs) return 'perfect';
  if (absOffset <= tolerances.goodMs) return 'good';
  if (absOffset <= tolerances.okMs) return 'ok';

  return null; // Outside tolerance window
}

/**
 * Result of matching a detected note against expected notes.
 */
export interface NoteMatchResult {
  note: RenderNote;
  offsetMs: number;
  result: ScoreResult;
}

/**
 * Find notes that match a detected pitch within the timing window.
 * Returns all matching notes (for chords, multiple notes may match).
 */
export function findMatchingNotes(
  detectedMidi: MidiNote | null,
  detectedTimeSec: number,
  pendingNotes: RenderNote[],
  tolerances: TimingTolerances = DEFAULT_TIMING_TOLERANCES
): NoteMatchResult[] {
  const matches: NoteMatchResult[] = [];

  // Chords: treat a detected onset within the timing window as a chord "strum".
  // Pitch detection is unreliable for chords; we score the whole chord by timing.
  const chordGroups = new Map<string, RenderNote[]>();
  for (const note of pendingNotes) {
    if (!note.isChord) continue;
    const group = chordGroups.get(note.eventId);
    if (group) group.push(note);
    else chordGroups.set(note.eventId, [note]);
  }

  for (const chordNotes of chordGroups.values()) {
    if (chordNotes.length === 0) continue;

    const offsetSec = detectedTimeSec - chordNotes[0].timeSec;
    const offsetMs = offsetSec * 1000;
    if (Math.abs(offsetMs) > tolerances.okMs) continue;

    const result = classifyTiming(offsetMs, tolerances);
    if (!result) continue;

    for (const chordNote of chordNotes) {
      matches.push({ note: chordNote, offsetMs, result });
    }
  }

  // Single notes: require a pitch match.
  if (detectedMidi !== null) {
    for (const note of pendingNotes) {
      if (note.isChord) continue;

      // Check timing window first (cheaper)
      const offsetSec = detectedTimeSec - note.timeSec;
      const offsetMs = offsetSec * 1000;

      if (Math.abs(offsetMs) > tolerances.okMs) continue;

      // Check pitch match
      if (!pitchMatches(detectedMidi, note.midi)) continue;

      // Classify timing
      const result = classifyTiming(offsetMs, tolerances);
      if (result) {
        matches.push({ note, offsetMs, result });
      }
    }
  }

  return matches;
}

/**
 * Check which notes should be marked as missed.
 * A note is missed when current time exceeds its time + ok tolerance.
 */
export function findMissedNotes(
  currentTimeSec: number,
  pendingNotes: RenderNote[],
  tolerances: TimingTolerances = DEFAULT_TIMING_TOLERANCES
): RenderNote[] {
  const missThresholdSec = tolerances.okMs / 1000;

  return pendingNotes.filter((note) => {
    const timeSinceNote = currentTimeSec - note.timeSec;
    return timeSinceNote > missThresholdSec;
  });
}

/**
 * Create a unique key for a note (for tracking hit/miss state).
 */
export function getNoteKey(note: RenderNote): string {
  return `${note.eventId}-${note.noteIndex}`;
}

/**
 * Get notes within the active scoring window (not yet passed miss threshold).
 */
export function getActiveNotes(
  currentTimeSec: number,
  allNotes: RenderNote[],
  hitNotes: Set<string>,
  tolerances: TimingTolerances = DEFAULT_TIMING_TOLERANCES
): RenderNote[] {
  const windowSec = tolerances.okMs / 1000;

  return allNotes.filter((note) => {
    if (hitNotes.has(getNoteKey(note))) return false;

    const timeDiff = note.timeSec - currentTimeSec;
    return Math.abs(timeDiff) <= windowSec;
  });
}
