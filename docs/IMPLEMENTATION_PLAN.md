# Guitar Practice Gamification App - Implementation Plan

## Overview
A web-based "Guitar Hero for real guitar" app that:
- Parses PDF guitar tabs via AI into a custom format
- Captures real-time audio from a Fender Mustang LT25 via USB
- Detects played notes using pitch detection algorithms
- Displays scrolling tab notation with a playhead
- Scores accuracy and timing in real-time
- Provides post-game analytics for practice improvement

## Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | React + TypeScript | Modern, type-safe, great ecosystem |
| Styling | Tailwind CSS | Rapid UI development |
| Audio | Web Audio API + Pitchfinder | Browser-native, low latency on macOS |
| Tab Parsing | OpenAI GPT-4V or Claude (pluggable) | Parse PDF tabs to JSON (fallback: manual JSON import) |
| Data Storage | IndexedDB (Dexie.js) | Client-side persistence for sessions/analytics |
| Build | Vite | Fast dev server, modern bundling |

## Project Structure

```
guitar-hero-app/
├── src/
│   ├── components/
│   │   ├── TabDisplay/          # Scrolling tab notation UI (canvas)
│   │   ├── AudioInput/          # USB audio capture controls
│   │   ├── DebugPanel/          # Permanent debug UI (levels, pitch, latency)
│   │   ├── ScoreDisplay/        # Real-time score/accuracy
│   │   ├── Analytics/           # Post-game analytics dashboard
│   │   ├── Calibration/         # Latency calibration wizard
│   │   └── TabUploader/         # PDF upload + AI parsing
│   ├── lib/
│   │   ├── audio/
│   │   │   ├── audioCapture.ts      # Web Audio input handling
│   │   │   ├── pitchWorklet.ts      # AudioWorklet processor (runs in audio thread)
│   │   │   ├── ringBuffer.ts        # Ring buffer for overlapping frames
│   │   │   ├── yinDetector.ts       # YIN algorithm for monophonic pitch
│   │   │   ├── chromaDetector.ts    # Chroma features for chord matching
│   │   │   ├── onsetDetector.ts     # Note attack/onset detection
│   │   │   └── midiUtils.ts         # MIDI↔Hz↔note name conversions
│   │   ├── tabs/
│   │   │   ├── tabParser.ts         # AI PDF parsing integration (provider-pluggable)
│   │   │   ├── tabFormat.ts         # Custom tab format types + validation (see validation rules below)
│   │   │   ├── tempoMap.ts          # Tick↔sec conversion with tempo changes
│   │   │   └── tabPlayer.ts         # Playback engine (uses audioContext.currentTime)
│   │   ├── scoring/
│   │   │   ├── scoreEngine.ts       # Real-time hit/miss detection
│   │   │   ├── chordMatcher.ts      # Binary chord similarity scoring
│   │   │   └── sessionRecorder.ts   # Compact event recording
│   │   └── storage/
│   │       ├── db.ts                # Dexie IndexedDB setup with migrations
│   │       ├── migrations.ts        # Schema version migrations
│   │       └── models.ts            # Data models for tabs/sessions
│   ├── hooks/
│   │   ├── useAudioInput.ts         # Audio capture + worklet hook
│   │   ├── useGameEngine.ts         # Main game loop (single clock source)
│   │   ├── useCalibration.ts        # Latency calibration hook
│   │   └── useAnalytics.ts          # Analytics data hook
│   ├── pages/
│   │   ├── Home.tsx                 # Song selection
│   │   ├── Play.tsx                 # Main gameplay screen
│   │   ├── Results.tsx              # Post-game results (lazy analytics)
│   │   ├── Analytics.tsx            # Historical analytics
│   │   └── Settings.tsx             # Calibration, thresholds, debug toggle
│   ├── types/
│   │   └── index.ts                 # Shared TypeScript types
│   └── worklets/
│       └── pitch-detector.worklet.ts  # AudioWorklet code (separate bundle)
├── public/
├── package.json
└── vite.config.ts
```

## Custom Tab Format (JSON)

### Design Decisions
- **Musical time as source of truth**: Positions stored in ticks (PPQ), ms derived at runtime from tempo map
- **String numbering**: 6=low E, 1=high E (standard guitar convention, matches physical position)
- **Pitch representation**: MIDI note numbers as source of truth, Hz derived when needed
- **Chords as first-class events**: An Event can contain multiple Notes (binary chord matching)

```typescript
// PPQ (Pulses Per Quarter note) - standard is 480
const PPQ = 480;

interface Tab {
  id: string;
  title: string;
  artist: string;
  ppq: number;                    // Ticks per quarter note (480 standard)
  timeSignature: [number, number]; // e.g., [4, 4]
  tuning: MidiNote[];             // String 6→1: e.g., [40,45,50,55,59,64] for standard E
  tempoMap: TempoEvent[];         // BPM changes over time
  sections: Section[];
}

interface TempoEvent {
  tick: number;                   // Position in ticks
  bpm: number;
}

interface Section {
  id: string;
  name: string;                   // e.g., "Intro", "Verse 1", "Chorus"
  startTick: number;              // Position in ticks
  measures: Measure[];
}

interface Measure {
  id: string;
  number: number;                 // Measure number (1-indexed)
  events: NoteEvent[];            // Can be single notes or chords
}

interface NoteEvent {
  id: string;
  tick: number;                   // Position in ticks (relative to song start)
  durationTicks: number;          // Duration in ticks
  notes: Note[];                  // Single note = 1 element, chord = multiple
  technique?: Technique;
}

interface Note {
  string: number;                 // 6=low E, 5=A, 4=D, 3=G, 2=B, 1=high E
  fret: number;                   // 0-24
  midi: MidiNote;                 // MIDI note number (e.g., 64 = E4)
}

type MidiNote = number;           // 0-127, middle C = 60
type Technique = "bend" | "slide" | "hammer-on" | "pull-off" | "vibrato" | "mute";

// Helper: derive Hz from MIDI at runtime
const midiToHz = (midi: MidiNote): number => 440 * Math.pow(2, (midi - 69) / 12);

// Helper: derive SECONDS from ticks using tempo map (keep seconds internally, convert to ms only for UI)
const ticksToSec = (tick: number, tempoMap: TempoEvent[], ppq: number): number => {
  // Implementation finds applicable tempo and calculates seconds
  // seconds = (tick / ppq) * (60 / bpm)
};
```

### Standard Tuning Reference (String 6→1)
| Tuning | String 6 | String 5 | String 4 | String 3 | String 2 | String 1 |
|--------|----------|----------|----------|----------|----------|----------|
| Standard E | E2 (40) | A2 (45) | D3 (50) | G3 (55) | B3 (59) | E4 (64) |
| Drop D | D2 (38) | A2 (45) | D3 (50) | G3 (55) | B3 (59) | E4 (64) |
| Open G | D2 (38) | G2 (43) | D3 (50) | G3 (55) | B3 (59) | D4 (62) |

### Tab Format Validation (tabFormat.ts)
Run these validations on import to catch errors early and prevent downstream bugs:

1. **String numbering**: All `Note.string` values must be 1-6 (reject 0 or >6)
2. **Events sorted by tick**: `NoteEvent.tick` must be monotonically increasing within each measure
3. **Unique IDs**: All `id` fields (Tab, Section, Measure, NoteEvent) must be unique
4. **MIDI range**: `Note.midi` must be 0-127
5. **Fret range**: `Note.fret` must be 0-24
6. **Tempo map sorted**: `TempoEvent.tick` must be monotonically increasing
7. **Non-empty**: Tab must have at least one section, section at least one measure, measure at least one event
8. **Tuning length**: `Tab.tuning` must have exactly 6 elements

## Implementation Phases

### Phase 1: Project Setup & Audio Foundation
**Goal**: Get audio capture working with proper architecture

1. Initialize Vite + React + TypeScript project
2. Set up Tailwind CSS
3. Implement Web Audio API capture from USB input
4. Create AudioWorklet for off-main-thread DSP
5. Implement ring buffer for overlapping frame analysis
6. Add YIN pitch detection in worklet
7. **Create permanent debug UI** (critical for hardware debugging):
   - Input level meter
   - Detected pitch display (Hz + note name)
   - Latency offset display
   - Audio device selector
8. Implement **user latency calibration flow**
9. Test with Fender LT25 USB connection

**Deliverable**: Guitar input → AudioWorklet → detected notes on screen with debug view

---

### Phase 2: Tab Format & AI Parser
**Goal**: Convert PDF tabs to playable JSON format

1. Define TypeScript interfaces for tab format
2. Create tab upload component (drag & drop PDF)
3. Implement **provider-pluggable** AI parser (supports OpenAI GPT-4V or Anthropic Claude)
4. Design prompt engineering for accurate tab extraction
5. Build tab preview/editor for manual corrections
6. Add manual JSON import (for Claude Code fallback workflow)
7. Store parsed tabs in IndexedDB

**Deliverable**: Upload PDF → see parsed tab data → save for later

---

### Phase 3: Tab Display & Playhead
**Goal**: Scrolling tab notation with timing

1. Build canvas-based tab renderer (6 strings, fret numbers)
2. Implement horizontal scrolling with playhead
3. **Single clock source**: Derive all rendering from `audioContext.currentTime`
4. Implement tick→ms conversion using tempo map (supports BPM changes)
5. Add tempo/BPM control with real-time recalculation
6. Highlight upcoming notes (look-ahead window)
7. Add countdown/start sequence with metronome
8. Support slowdown practice mode (50%, 75%, 100%) - tempo map makes this trivial

**Deliverable**: Tab scrolls across screen synced to audio clock, speed adjustable

---

### Phase 4: Scoring Engine
**Goal**: Real-time hit/miss detection with binary chord matching

1. **Dual-detector selection** based on expected event:
   - Single note → YIN pitch detection
   - Chord (2+ notes) → Chroma/spectrum similarity (binary match)
2. **Onset/energy gating**:
   - Detect note attack before pitch matching
   - Prevents late auto-hits from ringing strings
   - Debounce to avoid retrigger on sustained notes
3. Define tolerance windows (configurable, exposed in debug UI):
   - **Timing tolerances defined in ticks** (automatically scales with playback speed):
     - Perfect: ±PPQ/8 ticks (~±0.0625 beats)
     - Good: ±PPQ/4 ticks (~±0.125 beats)
     - OK: ±PPQ/2 ticks (~±0.25 beats)
     - At 120 BPM: perfect = ±62.5ms, good = ±125ms, ok = ±250ms
   - Pitch: ±50 cents (half semitone) tolerance for single notes
   - Chord scoring window: within ±toleranceTicks of expected tick, take **max chroma similarity after onset** (prevents random sustains from scoring)
   - Strum window (notes within X ticks count as simultaneous)
4. Visual feedback:
   - Green flash for hit
   - Red for miss
   - Timing indicator (early/late)
5. Running score display

**Deliverable**: Play along with accurate hit/miss detection, chords scored as binary pass/fail

---

### Phase 5: Session Recording & Analytics
**Goal**: Detailed post-game feedback with efficient storage

1. **Compact event recording** (don't store full Note objects per frame):
   ```typescript
   interface PlayEvent {
     eventId: string;              // Reference to NoteEvent.id in tab
     timestampSec: number;         // audioContext.currentTime (seconds!)
     timingOffsetMs: number;       // Negative = early, positive = late (converted to ms for readability)
     result: "perfect" | "good" | "ok" | "miss";
     detectedMidi?: number;        // For single notes only
     chromaMatch?: number;         // For chords: 0-1 similarity score
   }

   interface Session {
     id: string;
     tabId: string;
     startTime: Date;
     playbackSpeed: number;        // 0.5, 0.75, 1.0
     events: PlayEvent[];          // Compact event log
     // Heavy analytics computed lazily on Results page
   }
   ```

   **Note**: `audioContext.currentTime` is in **seconds**, not ms. All audio timing uses seconds internally; convert to ms only for display/storage readability.
2. **Schema versioning from day one** (Dexie migrations)
3. Store completed sessions in IndexedDB
4. Build Results page (compute analytics lazily from event log):
   - Overall accuracy %
   - Section-by-section breakdown
   - Timing histogram (early/late distribution)
   - "Problem spots" - most missed notes
   - Tempo analysis (rushed/dragged sections)
5. Build Analytics page:
   - Progress over time per song
   - Improvement trends
   - Practice time stats

**Deliverable**: Finish a song → see detailed breakdown → track improvement

---

### Phase 6: Polish & UX
**Goal**: Make it feel good to use

1. Add metronome/click track option
2. Practice mode (loop a section)
3. Speed adjustment (50%, 75%, 100%)
4. Keyboard shortcuts (space = start/pause)
5. Visual polish and animations
6. Error handling and edge cases
7. Mobile-responsive layout (for viewing analytics)

**Deliverable**: Polished, usable practice tool

---

## Key Technical Details

### Audio Architecture

#### Latency Calibration (Critical)
- `audioContext.baseLatency` is insufficient - doesn't cover end-to-end input→processing chain
- **Implement user calibration flow**:
  1. Play metronome clicks at steady tempo
  2. User plays along with clicks (multiple attempts)
  3. Detect note onsets and compute offset from expected click times
  4. Take **median offset** across attempts (filters out reaction time variance)
  5. Provide **manual fine-tune slider** for final adjustment
- Store per-device `inputOffsetSec` in localStorage
- Use `audioContext.currentTime` (seconds) as the **single master clock** for all timing
- **Never mix** `performance.now()` and `audioContext.currentTime`

```typescript
interface AudioConfig {
  inputOffsetSec: number;         // User-calibrated device latency (seconds)
  sampleRate: number;             // Use audioContext.sampleRate (often 48000, not always 44100!)
  analysisWindowSamples: number;  // Ring buffer window: 2048 default, 4096 for low tunings (D2 in Open G)
  hopSamples: number;             // Analysis hop size (e.g., 512)
}

// Derive durations from actual sample rate, don't hardcode
const windowDurationSec = config.analysisWindowSamples / audioContext.sampleRate;
const hopDurationSec = config.hopSamples / audioContext.sampleRate;
```

**Notes**:
- AudioWorklet processes in 128-sample blocks (render quantum). The `analysisWindowSamples` and `hopSamples` are ring-buffer parameters, not worklet block sizes.
- **Make `analysisWindowSamples` configurable**: 2048 may be borderline for low strings like D2 (73.4 Hz) in Open G tuning. Offer 4096 as fallback option in settings.
- **Worklet→main messaging**: Send features/events at ~20-60 Hz (not raw PCM). Post detected pitch, onset events, chroma vectors - not audio samples.

#### AudioWorklet Architecture
Move DSP off main thread early to prevent glitches and improve timing consistency:

```
Main Thread                    Audio Thread (Worklet)
┌─────────────┐               ┌──────────────────────┐
│ Game Engine │◄─── events ───│ PitchDetectorWorklet │
│ UI Renderer │               │ - Ring buffer        │
│ Score Logic │               │ - YIN / Chroma       │
└─────────────┘               │ - Onset detection    │
                              └──────────────────────┘
```

#### Overlapping Frames
- Window: 2048 samples (~43ms at 48kHz, ~46ms at 44.1kHz)
- Hop: 512 samples (~11ms at 48kHz) - 75% overlap
- **Always compute durations from `audioContext.sampleRate`**, don't assume 44.1kHz
- Reduces perceived latency while maintaining frequency resolution

### Pitch Detection Strategy

#### Dual-Detector Approach
Choose detector based on expected event type:

| Event Type | Detector | Why |
|------------|----------|-----|
| Single note | YIN algorithm | Accurate monophonic pitch |
| Chord (2+ notes) | Chroma/spectrum similarity | Binary match, not per-note |

#### Onset/Energy Gating
- Detect note onset (attack) before pitch matching
- Prevents "late auto-hits" from ringing/sustaining strings
- Debounce window to avoid retriggering on same note

```typescript
interface DetectionConfig {
  // YIN (single notes)
  yinThreshold: number;           // 0.1-0.2 typical

  // Chroma (chords)
  chromaSimilarityThreshold: number;  // Empirically tuned

  // Gating
  onsetThresholdDb: number;       // -40 dB typical
  strumWindowMs: number;          // Allow notes within window to count as chord
  debounceMs: number;             // Prevent retrigger
}
```

**Note**: These thresholds will need empirical tuning. Keep them configurable and expose in debug UI.

### PDF Parsing Strategy
**Provider-pluggable**: Support both OpenAI GPT-4V and Anthropic Claude Vision
**Fallback**: Manual JSON import (paste from Claude Code or hand-authored)

Prompt approach:
```
Parse this guitar tab image into structured JSON.
For each note, extract:
- String number (6=low E, 5=A, 4=D, 3=G, 2=B, 1=high E)
- Fret number
- Position in measure (beat number)
- Any techniques (h=hammer-on, p=pull-off, /=slide, b=bend)

Output format: [structured JSON example matching Tab interface]
```

The app will include a "manual import" option where users can paste JSON directly.

### Chord Detection Approach (Binary Match)
Chords are scored as binary hit/miss using chroma similarity (not per-note detection):

1. **Compute expected chroma vector** from chord's MIDI notes (12-bin pitch class histogram)
2. **Compute detected chroma vector** from audio FFT
3. **Onset gating**: Only score on detected note attack (energy spike), not sustain
4. **Compare similarity** (cosine similarity or correlation)
5. **Binary threshold**: similarity ≥ threshold = hit, otherwise miss
6. **Strum window**: Notes arriving within Xms of each other count as simultaneous

This avoids the complexity and "unfairness" of per-note chord feedback while still being musically meaningful.

---

## Success Criteria for MVP

- [x] Can upload a PDF tab and get parsed JSON (or paste JSON manually)
- [x] Can play guitar through USB and see detected notes in debug panel
- [x] Latency calibration flow works and persists offset
- [x] Tab scrolls with playhead synced to audioContext clock
- [x] Speed adjustment (50%, 75%, 100%) works correctly
- [x] Single notes detected accurately with YIN
- [ ] Chords scored as binary hit/miss with chroma similarity
- [x] Real-time visual feedback (hit/miss/early/late)
- [x] Post-game results with section breakdown + timing analysis
- [x] Session history saved locally with schema versioning
- [x] Debug panel accessible for troubleshooting
- [ ] Works reliably on macOS Chrome/Safari

---

## Audio Approach (MVP)

- **Metronome/click track only** - no backing track audio in MVP
- Visual count-in before song starts
- Adjustable BPM for practice
- Optional metronome muting for advanced players

## Out of Scope (Future Features)

- Backing track audio playback (MP3/WAV upload)
- Multi-track/band support
- Cloud sync / accounts
- Mobile app
- Social/leaderboard features
- Video tutorials integration

---

## Estimated File Count
~25-30 files for MVP implementation
