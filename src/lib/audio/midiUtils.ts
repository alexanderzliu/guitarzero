import type { MidiNote } from '../../types';

// Note names for display
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/**
 * Convert MIDI note number to frequency in Hz
 * A4 (MIDI 69) = 440 Hz
 */
export function midiToHz(midi: MidiNote): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Convert frequency in Hz to MIDI note number (continuous, not rounded)
 */
export function hzToMidi(hz: number): number {
  if (hz <= 0) return 0;
  return 69 + 12 * Math.log2(hz / 440);
}

/**
 * Convert frequency to nearest MIDI note number (rounded)
 */
export function hzToMidiRounded(hz: number): MidiNote {
  return Math.round(hzToMidi(hz));
}

/**
 * Get the cents offset from the nearest MIDI note
 * Returns value in range [-50, 50]
 */
export function hzToCentsOffset(hz: number): number {
  const midiContinuous = hzToMidi(hz);
  const midiRounded = Math.round(midiContinuous);
  return (midiContinuous - midiRounded) * 100;
}

/**
 * Get note name from MIDI number (e.g., 60 -> "C4")
 */
export function midiToNoteName(midi: MidiNote): string {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

/**
 * Get note name from frequency (e.g., 440 -> "A4")
 */
export function hzToNoteName(hz: number): string {
  return midiToNoteName(hzToMidiRounded(hz));
}

/**
 * Check if two frequencies are within tolerance (in cents)
 * Default tolerance: 50 cents (half semitone)
 */
export function frequenciesMatch(hz1: number, hz2: number, toleranceCents = 50): boolean {
  if (hz1 <= 0 || hz2 <= 0) return false;
  const cents = Math.abs(1200 * Math.log2(hz1 / hz2));
  return cents <= toleranceCents;
}

/**
 * Check if detected MIDI matches expected MIDI within tolerance
 */
export function midiMatches(detected: MidiNote, expected: MidiNote, toleranceCents = 50): boolean {
  const detectedHz = midiToHz(detected);
  const expectedHz = midiToHz(expected);
  return frequenciesMatch(detectedHz, expectedHz, toleranceCents);
}

/**
 * Get guitar string and fret for a MIDI note given a tuning
 * Returns null if note is not playable in the given tuning
 * Prefers lower positions (lower fret numbers)
 */
export function midiToStringFret(
  midi: MidiNote,
  tuning: MidiNote[],
  maxFret = 24
): { string: number; fret: number } | null {
  // Check each string from highest (1) to lowest (6)
  // Return the first valid position (lowest fret)
  for (let stringNum = 1; stringNum <= 6; stringNum++) {
    const openNote = tuning[6 - stringNum]; // tuning is 6→1, so index 0 = string 6
    const fret = midi - openNote;
    if (fret >= 0 && fret <= maxFret) {
      return { string: stringNum, fret };
    }
  }
  return null;
}

/**
 * Get MIDI note from string and fret given a tuning
 */
export function stringFretToMidi(string: number, fret: number, tuning: MidiNote[]): MidiNote {
  const openNote = tuning[6 - string]; // tuning is 6→1
  return openNote + fret;
}
