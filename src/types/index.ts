// ============================================================================
// Core Types for Guitar Practice App
// ============================================================================

// PPQ (Pulses Per Quarter note) - standard is 480
export const DEFAULT_PPQ = 480;

// MIDI note number (0-127, middle C = 60)
export type MidiNote = number;

// Technique annotations
export type Technique = 'bend' | 'slide' | 'hammer-on' | 'pull-off' | 'vibrato' | 'mute';

// ============================================================================
// Tab Format Types
// ============================================================================

export interface Tab {
  id: string;
  title: string;
  artist: string;
  ppq: number;
  timeSignature: [number, number]; // e.g., [4, 4]
  tuning: MidiNote[]; // String 6→1: e.g., [40,45,50,55,59,64] for standard E
  tempoMap: TempoEvent[];
  sections: Section[];
}

export interface TempoEvent {
  tick: number;
  bpm: number;
}

export interface Section {
  id: string;
  name: string;
  startTick: number;
  measures: Measure[];
}

export interface Measure {
  id: string;
  number: number;
  events: NoteEvent[];
}

export interface NoteEvent {
  id: string;
  tick: number;
  durationTicks: number;
  notes: Note[];
  technique?: Technique;
}

export interface Note {
  string: number; // 6=low E, 5=A, 4=D, 3=G, 2=B, 1=high E
  fret: number; // 0-24
  midi: MidiNote;
}

// ============================================================================
// Audio Configuration Types
// ============================================================================

export interface AudioConfig {
  inputOffsetSec: number;
  sampleRate: number;
  analysisWindowSamples: number; // 2048 default, 4096 for low tunings
  hopSamples: number;
}

export interface DetectionConfig {
  // YIN (single notes)
  yinThreshold: number; // 0.1-0.2 typical

  // Chroma (chords)
  chromaSimilarityThreshold: number;

  // Gating
  onsetThresholdDb: number; // -40 dB typical
  strumWindowMs: number;
  debounceMs: number;
}

// ============================================================================
// Worklet Message Types
// ============================================================================

export interface PitchDetectionResult {
  timestampSec: number;
  frequency: number | null; // null if no pitch detected
  midi: MidiNote | null;
  clarity: number; // 0-1, confidence of pitch detection
  rmsDb: number; // signal level in dB
}

export interface OnsetEvent {
  timestampSec: number;
  rmsDb: number;
}

export interface ChromaVector {
  timestampSec: number;
  bins: Float32Array; // 12 bins, one per pitch class
}

export type WorkletMessage =
  | { type: 'pitch'; data: PitchDetectionResult }
  | { type: 'onset'; data: OnsetEvent }
  | { type: 'chroma'; data: ChromaVector }
  | { type: 'level'; data: { rmsDb: number; peakDb: number } };

// ============================================================================
// Scoring Types
// ============================================================================

export type ScoreResult = 'perfect' | 'good' | 'ok' | 'miss';

export interface PlayEvent {
  eventId: string;
  timestampSec: number;
  timingOffsetMs: number; // Negative = early, positive = late
  result: ScoreResult;
  detectedMidi?: MidiNote;
  chromaMatch?: number; // 0-1 for chords
}

export interface Session {
  id: string;
  tabId: string;
  startTime: Date;
  playbackSpeed: number;
  events: PlayEvent[];
}

// ============================================================================
// Tolerance Config (in ticks, scales with speed)
// ============================================================================

export interface ToleranceConfig {
  perfectTicks: number; // PPQ/8 = 60 ticks at 480 PPQ
  goodTicks: number; // PPQ/4 = 120 ticks
  okTicks: number; // PPQ/2 = 240 ticks
}

export const DEFAULT_TOLERANCES: ToleranceConfig = {
  perfectTicks: DEFAULT_PPQ / 8, // ±0.0625 beats
  goodTicks: DEFAULT_PPQ / 4, // ±0.125 beats
  okTicks: DEFAULT_PPQ / 2, // ±0.25 beats
};

// ============================================================================
// Standard Tunings (String 6→1, MIDI note numbers)
// ============================================================================

export const TUNINGS = {
  standard: [40, 45, 50, 55, 59, 64] as MidiNote[], // E2 A2 D3 G3 B3 E4
  dropD: [38, 45, 50, 55, 59, 64] as MidiNote[], // D2 A2 D3 G3 B3 E4
  openG: [38, 43, 50, 55, 59, 62] as MidiNote[], // D2 G2 D3 G3 B3 D4
} as const;

// ============================================================================
// UI State Types
// ============================================================================

export type GameState = 'idle' | 'countdown' | 'playing' | 'paused' | 'finished';

export interface GameContext {
  state: GameState;
  currentTick: number;
  playbackSpeed: number;
  score: number;
  streak: number;
  events: PlayEvent[];
}

// ============================================================================
// Practice Mode Types
// ============================================================================

/**
 * Configuration for section looping in practice mode.
 * When set, playback loops between startSec and endSec.
 */
export interface LoopConfig {
  sectionId: string;
  sectionName: string;
  startSec: number;
  endSec: number;
}
