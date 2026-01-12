# Guitar Practice App - Work Log

## Session 1: Phase 1 Implementation

### Date: January 7, 2026

### Overview
Implemented the audio foundation for a "Guitar Hero for real guitar" web application. This phase focuses on capturing audio from a USB guitar amp (Fender Mustang LT25) and detecting pitch in real-time.

---

## Completed Work

### 1. Project Setup
- Initialized Vite + React + TypeScript project
- Configured Tailwind CSS with dark theme
- Set up project directory structure following the plan

### 2. Core Types (`src/types/index.ts`)
Defined all TypeScript interfaces for:
- Tab format (Tab, Section, Measure, NoteEvent, Note)
- Audio configuration (AudioConfig, DetectionConfig)
- Worklet messages (PitchDetectionResult, OnsetEvent, ChromaVector)
- Scoring types (PlayEvent, Session, ScoreResult)
- Tolerance configuration (in ticks, scales with playback speed)
- Standard tunings (MIDI note arrays)

### 3. Audio Utilities

#### `src/lib/audio/midiUtils.ts`
- `midiToHz()` - Convert MIDI note to frequency
- `hzToMidi()` / `hzToMidiRounded()` - Convert frequency to MIDI
- `hzToCentsOffset()` - Get cents deviation from nearest note
- `midiToNoteName()` / `hzToNoteName()` - Get note names like "A4"
- `frequenciesMatch()` / `midiMatches()` - Pitch matching with tolerance
- `midiToStringFret()` / `stringFretToMidi()` - Guitar position helpers

#### `src/lib/audio/ringBuffer.ts`
- Ring buffer implementation for AudioWorklet
- Supports overlapping frame analysis (window + hop size)
- Efficient memory reuse for real-time processing

#### `src/lib/audio/yinDetector.ts`
- YIN algorithm implementation for monophonic pitch detection
- Based on de Cheveigné & Kawahara paper
- Features:
  - Difference function computation
  - Cumulative mean normalized difference
  - Absolute threshold with local minimum search
  - Parabolic interpolation for sub-sample accuracy
- Configurable frequency range (60Hz - 1500Hz covers guitar)

#### `src/lib/audio/onsetDetector.ts`
- Energy-based onset detection
- Adaptive thresholding with rise detection
- Debouncing to prevent false triggers
- Utility functions: `calculateRms()`, `linearToDb()`, `dbToLinear()`, `calculatePeakDb()`

#### `src/lib/audio/audioCapture.ts`
- Main Web Audio API wrapper
- Features:
  - Device enumeration and selection
  - AudioContext creation with low latency hints
  - MediaStream capture from USB input
  - AudioWorklet loading and connection
  - Message handling from worklet
- Singleton pattern for app-wide access

### 4. AudioWorklet (`public/pitch-detector.worklet.js`)
- Runs in separate audio thread for low latency
- Inline implementations (worklets can't import modules)
- Features:
  - Ring buffer for sample accumulation
  - YIN pitch detection
  - Onset detection
  - Level metering (RMS + peak)
- Throttled messaging (~30 Hz) to main thread
- Onset events sent immediately for timing accuracy

### 5. React Hook (`src/hooks/useAudioInput.ts`)
- `useAudioInput()` hook provides:
  - State: isRunning, isStarting, error, devices, currentPitch, currentLevel, lastOnset
  - Actions: start(), stop(), selectDevice(), refreshDevices()
  - Utilities: getAudioContext(), getCurrentTime()
- Manages AudioCapture lifecycle
- Updates React state from worklet messages

### 6. Debug Panel (`src/components/DebugPanel/`)
- Visual debug interface for audio testing
- Features:
  - Device selector dropdown
  - Start/Stop button with status indicator
  - Level meter with RMS and peak display
  - Detected note display (note name + frequency)
  - Detailed stats: sample rate, clarity %, MIDI note, last onset time
- Error display for troubleshooting

### 7. App Shell (`src/App.tsx`)
- Dark-themed layout with Tailwind
- Two-column grid: Debug panel + Instructions
- Ready for additional components

---

## Technical Decisions Made

### Audio Architecture
- **AudioWorklet over ScriptProcessorNode**: Lower latency, runs in dedicated thread
- **Ring buffer with overlapping frames**: 2048 sample window, 512 sample hop (75% overlap)
- **YIN algorithm for pitch**: Well-suited for monophonic guitar, good accuracy
- **Message throttling**: ~30 Hz updates to main thread (sufficient for UI, reduces overhead)

### Data Model
- **Ticks as timing source of truth**: PPQ-based, ms derived from tempo map
- **MIDI notes as pitch source of truth**: Hz derived when needed
- **String numbering**: 6=low E, 1=high E (standard guitar convention)
- **Chords as NoteEvent arrays**: Single notes and chords use same structure

### Configuration
- **Sample rate**: Uses `audioContext.sampleRate` (often 48kHz), not hardcoded
- **Analysis window**: Configurable, 4096 option for low tunings
- **Tolerances**: Defined in ticks, automatically scale with playback speed

---

## Files Created

```
src/
├── types/
│   └── index.ts                    # All TypeScript types
├── lib/
│   └── audio/
│       ├── midiUtils.ts            # MIDI/Hz/note conversions
│       ├── ringBuffer.ts           # Ring buffer for worklet
│       ├── yinDetector.ts          # YIN pitch detection
│       ├── onsetDetector.ts        # Note attack detection
│       └── audioCapture.ts         # Web Audio API wrapper
├── hooks/
│   └── useAudioInput.ts            # React audio hook
├── components/
│   └── DebugPanel/
│       ├── DebugPanel.tsx          # Debug UI component
│       └── index.ts                # Barrel export
├── App.tsx                         # Main app component
└── index.css                       # Tailwind imports + base styles

public/
└── pitch-detector.worklet.js       # AudioWorklet processor

docs/
├── IMPLEMENTATION_PLAN.md          # Full implementation plan
└── WORK_LOG.md                     # This file
```

---

## Remaining Work

### Phase 1 (in progress)
- [ ] Latency calibration flow (click-aligned hits + median offset + fine-tune slider)

### Phase 2: Tab Format & AI Parser
- [ ] Tab validation in tabFormat.ts
- [ ] PDF upload component
- [ ] OpenAI/Claude API integration for tab parsing
- [ ] Tab preview/editor
- [ ] Manual JSON import
- [ ] IndexedDB storage with Dexie

### Phase 3: Tab Display & Playhead
- [ ] Canvas-based tab renderer
- [ ] Horizontal scrolling with playhead
- [ ] Tempo map tick→sec conversion
- [ ] Speed adjustment (50%, 75%, 100%)
- [ ] Metronome with countdown

### Phase 4: Scoring Engine
- [ ] Dual detector (YIN for notes, chroma for chords)
- [ ] Onset gating
- [ ] Tolerance windows in ticks
- [ ] Visual hit/miss feedback

### Phase 5: Session Recording & Analytics
- [ ] Compact event recording
- [ ] Dexie migrations
- [ ] Results page with section breakdown
- [ ] Analytics page with progress tracking

### Phase 6: Polish & UX
- [ ] Practice mode (section looping)
- [ ] Keyboard shortcuts
- [ ] Visual polish
- [ ] Error handling

---

## How to Test

1. Run the dev server: `npm run dev`
2. Open http://localhost:5173
3. Connect your Fender Mustang LT25 via USB
4. Select the amp as the audio input device
5. Click "Start Audio"
6. Play notes on your guitar - detected pitch should appear in real-time

---

## Session 2: Phase 1 Completion - Latency Calibration

### Date: January 8, 2026

### Overview
Completed Phase 1 by implementing the latency calibration flow. This allows users to calibrate their audio input device to compensate for hardware/software latency.

---

## Completed Work

### 1. Calibration Storage (`src/lib/storage/calibrationStorage.ts`)
- Per-device calibration persistence in localStorage
- Functions: `saveCalibration()`, `loadCalibration()`, `getCalibrationOffset()`, `clearCalibration()`, `isCalibrated()`
- Stores offset in seconds, timestamp, and sample count

### 2. Calibration Hook (`src/hooks/useCalibration.ts`)
- Full state machine for calibration flow
- Phases: idle → countdown → listening → processing → results (or error)
- Uses `audioContext.currentTime` as master clock
- Visual beats at 90 BPM, 8 strums required
- Median offset calculation from detected vs expected times
- Manual fine-tune slider (±50ms)
- Uses refs to avoid stale closure issues in animation loop

### 3. Calibration Wizard (`src/components/Calibration/CalibrationWizard.tsx`)
- Full-screen calibration wizard UI
- Phases:
  - **Idle**: Instructions, device selection, start audio button
  - **Countdown**: 3-2-1 visual countdown with flashing indicator
  - **Listening**: Large flashing circle for 8 beats, strum counter
  - **Processing**: Spinner while calculating offset
  - **Results**: Shows detected latency, manual adjustment slider, save button
  - **Error**: Error message with retry option and tips

### 4. Updated AudioCapture (`src/lib/audio/audioCapture.ts`)
- Auto-loads calibration offset on `start()`
- New methods: `getCalibratedTime()`, `loadCalibrationFromStorage()`, `setInputOffset()`
- `inputOffsetSec` is now actively used for timing compensation

### 5. Updated App Shell (`src/App.tsx`)
- Added view switching between main view and calibration wizard
- Calibration card shows current offset and calibration status
- "Start Calibration" / "Recalibrate" button

---

## Files Created/Modified

```
src/
├── lib/
│   └── storage/
│       └── calibrationStorage.ts   # NEW: localStorage persistence
├── hooks/
│   └── useCalibration.ts           # NEW: Calibration state machine
├── components/
│   └── Calibration/
│       ├── CalibrationWizard.tsx   # NEW: Full calibration UI
│       └── index.ts                # NEW: Barrel export
└── App.tsx                         # MODIFIED: Added calibration navigation

src/lib/audio/audioCapture.ts       # MODIFIED: Added calibration methods
```

---

## Technical Decisions

### Calibration Flow
- **Visual-only beats**: No audio metronome (avoids audio routing complexity)
- **90 BPM tempo**: ~667ms between beats, comfortable for strumming
- **8 samples**: Good balance between accuracy and user patience
- **Median offset**: Filters outliers from reaction time variance

### Timing Architecture
- **phaseRef for real-time checks**: Avoids race conditions between animation loop and React state
- **audioInputRef for current values**: Avoids stale closures in `requestAnimationFrame` callback
- **Onset detection via useEffect**: Captures onset events when `lastOnset` changes

---

## Remaining Work

### Phase 1 ✅ COMPLETE

### Phase 2: Tab Format & AI Parser
- [ ] Tab validation in tabFormat.ts
- [ ] PDF upload component
- [ ] OpenAI/Claude API integration for tab parsing
- [ ] Tab preview/editor
- [ ] Manual JSON import
- [ ] IndexedDB storage with Dexie

### Phase 3-6: (unchanged from previous session)

---

## How to Test Calibration

1. Run the dev server: `npm run dev`
2. Open http://localhost:5173
3. Click "Start Calibration" on the main page
4. Select your audio input device
5. Click "Start Audio" to begin capture
6. Click "Begin Calibration"
7. Watch for the flashing circle and strum on each flash
8. Review the detected offset and adjust if needed
9. Click "Save & Continue"

---

## Notes for Next Session

- Phase 1 is now complete
- Ready to begin Phase 2: Tab Format & AI Parser
- The calibration offset is automatically loaded when audio starts
- Consider adding calibration status to the Debug Panel for visibility

---

## Session 3: Phase 5 Implementation - Session Recording & Analytics

### Date: January 11, 2026

### Overview
Implemented session recording and analytics system following Clean Architecture pattern. Sessions are stored in IndexedDB via Dexie.js with full event capture for post-game analysis.

---

## Completed Work

### 1. Domain Layer (`src/lib/session/`)

#### `sessionTypes.ts`
Pure TypeScript types with no framework dependencies:
- `PlayEventRecord` - Individual note hit/miss event with timing offset
- `SessionAggregate` - Pre-computed statistics (accuracy, grade, counts)
- `SessionRecord` - Full session with events and aggregates
- `SessionMetadata` - Lightweight session info for lists
- `ProblemSpot` - Frequently missed notes across sessions
- `TimingBucket` - Histogram bucket for timing distribution

#### `aggregateCalculator.ts`
Pure functions for session statistics:
- `calculateAggregates()` - Compute stats from event list
- `calculateGrade()` - Letter grade (S/A/B/C/D/F) from accuracy
- `identifyProblemSpots()` - Find frequently missed notes across sessions
- `calculateTimingDistribution()` - Build timing histogram buckets
- `getTimingTendency()` - "Early", "Late", or "On Time" summary

#### `eventCapture.ts`
Factory functions for creating events:
- `createHitEvent()` - Create event for successful note hit
- `createMissEvent()` - Create event for missed note
- `generateEventId()` - Unique ID generation

### 2. Data Layer (`src/lib/storage/`)

#### `sessionDb.ts`
Dexie IndexedDB database with versioned schema:
- Table: `sessions` with indexes on `id`, `tabId`, `finishedAt`, `[tabId+finishedAt]`
- CRUD operations: `saveSession()`, `getSession()`, `deleteSession()`
- Query functions: `getSessionsForTab()`, `getFullSessionsForTab()`
- Stats functions: `getBestScoreForTab()`, `getSessionCountForTab()`

### 3. Application Layer (`src/hooks/`)

#### `useSessionRecorder.ts`
Recording hook for gameplay:
- `recordEvent()` - Add event to current recording
- `finishSession()` - Complete and save session to IndexedDB
- `discardSession()` - Clear recording on early exit
- `getEventCount()` - Get current event count
- Uses refs to avoid re-renders during gameplay

#### `useSessionHistory.ts`
History fetching hook for tab preview:
- `sessions` - List of session metadata
- `stats` - Aggregated statistics (best score, avg accuracy, problem spots)
- `isLoading` - Loading state
- `refresh()` - Reload from database
- `deleteSession()` - Remove a session

### 4. Presentation Layer (`src/components/`)

#### `GameScreen/SessionResults.tsx`
Full-page results overlay after song completion:
- Large grade display (S/A/B/C/D/F) with color coding
- Score display with formatting
- Stats grid: accuracy, max streak, perfect/good/ok/miss counts
- Timing histogram visualization
- Play Again / Back to Tab buttons

#### `TabPreview/SessionHistory.tsx`
Session history display in tab preview:
- Stats summary (best score, avg accuracy, total sessions)
- Problem spots section with miss rates
- Recent sessions list with grade, score, accuracy
- Delete session functionality with hover reveal

### 5. Integration

#### `useGameEngine.ts` (modified)
- Added `onPlayEvent` callback to config
- Added `onPlayEventRef` to avoid stale closures in RAF loop
- Emit `createHitEvent()` on successful note match
- Emit `createMissEvent()` on missed notes

#### `GameScreen.tsx` (modified)
- Integrated `useSessionRecorder` hook
- Pass `recorder.recordEvent` to game engine
- Save session on natural completion (`gameState === 'finished'`)
- Discard session on early exit (Escape key)
- Render `SessionResults` overlay when session complete
- Handle Play Again and Exit from results

#### `TabPreview.tsx` (modified)
- Integrated `useSessionHistory` hook
- Added `SessionHistory` component to display past sessions

---

## Files Created

```
src/lib/session/
├── sessionTypes.ts          # Domain types
├── aggregateCalculator.ts   # Pure calculation functions
├── eventCapture.ts          # Event factory functions
└── index.ts                 # Barrel exports

src/lib/storage/
└── sessionDb.ts             # Dexie database + queries

src/hooks/
├── useSessionRecorder.ts    # Recording hook
└── useSessionHistory.ts     # History fetching hook

src/components/
├── GameScreen/
│   └── SessionResults.tsx   # Results overlay
└── TabPreview/
    └── SessionHistory.tsx   # History display
```

## Files Modified

```
src/hooks/useGameEngine.ts          # Added onPlayEvent callback
src/components/GameScreen/GameScreen.tsx   # Session recording integration
src/components/TabPreview/TabPreview.tsx   # Session history integration
package.json                        # Added dexie dependency
```

---

## Technical Decisions

### Architecture
- **Clean Architecture**: Separated domain, data, application, and presentation layers
- **Pure domain layer**: No React or Dexie dependencies in session types/calculators
- **Ref-based callback**: `onPlayEventRef` avoids stale closure in RAF loop

### Storage
- **Dexie.js**: Provides IndexedDB with versioned migrations
- **Compound index**: `[tabId+finishedAt]` for efficient per-tab queries
- **Events stored inline**: Each session contains full event array (~75KB for 500 notes)
- **Pre-computed aggregates**: Stats calculated once on save, not on every read

### Event Capture
- **Live capture during gameplay**: Events emitted from game engine RAF loop
- **Timing offset in milliseconds**: Negative = early, positive = late
- **Detected MIDI stored**: For debugging pitch detection accuracy

### Session Lifecycle
- **Save on natural completion only**: Partial sessions discarded on exit
- **Auto-start recording**: First event triggers recording start
- **Session includes playback speed**: For accurate historical comparison

---

## Remaining Work

### Phase 1-4 ✅ COMPLETE

### Phase 5 ✅ COMPLETE
- [x] Compact event recording with timing offsets
- [x] Dexie IndexedDB with migrations
- [x] Results page with grade, stats, timing histogram
- [x] Session history in TabPreview
- [x] Problem spot identification

### Phase 6: Polish & UX
- [ ] Metronome/click track option
- [ ] Practice mode (loop a section)
- [ ] Speed adjustment improvements
- [ ] Keyboard shortcuts refinement
- [ ] Visual polish and animations
- [ ] Error handling and edge cases

---

## How to Test

1. Run the dev server: `npm run dev`
2. Import a tab and start playing
3. Complete the song naturally (don't exit early)
4. View the results overlay with grade and stats
5. Click "Back to Tab" to see session in history
6. Play again to see progress tracking
7. Check DevTools > Application > IndexedDB > "guitar-hero-sessions" to verify storage

---

## Session 4: Phase 6 Implementation - Practice Mode & Visual Polish

### Date: January 12, 2026

### Overview
Implemented practice mode with section looping and visual hit animations. Users can now select any section from a dropdown to loop continuously, with scores resetting each iteration. Notes now pulse/scale on successful hits for satisfying visual feedback.

---

## Completed Work

### 1. New Types (`src/types/index.ts`)

#### `LoopConfig`
Configuration for practice mode section looping:
- `sectionId` - ID of the section being looped
- `sectionName` - Display name for UI
- `startSec` / `endSec` - Time boundaries in seconds

### 2. Tempo Utilities (`src/lib/tabs/tempoUtils.ts`)

#### `getSectionTimeBounds()`
Helper function to calculate section time boundaries:
- Finds section by ID
- Returns `{ startSec, endSec }` or `null` if section not found/empty
- Handles last section by finding max tick from measures

#### `RenderNote.hitTimestampSec`
New optional field to track when a hit occurred (for animation timing).

### 3. Game Engine (`src/hooks/useGameEngine.ts`)

#### State Additions
- `loopConfig: LoopConfig | null` - Current loop configuration
- `loopCount: number` - Number of times loop has repeated

#### Refs for RAF Loop
- `loopConfigRef` - Avoid stale closure for loop config
- `loopCountRef` - Track loop iterations
- `hitTimestampsRef` - Store hit timestamps for animation

#### Loop Detection Logic
In the game loop, when `songTime >= loopConfig.endSec`:
1. Reset `playStartTimeRef` to loop start offset
2. Reset all scoring state (score, hits, results, timestamps)
3. Increment loop counter
4. Update React state

#### `setLoopSection()` Callback
- Takes `sectionId | null` to enable/disable looping
- Uses `getSectionTimeBounds()` to calculate time bounds
- Validates section exists and has measures

### 4. Highway Renderer (`src/lib/rendering/highwayRenderer.ts`)

#### Hit Animation
- `HIT_ANIMATION_DURATION_SEC = 0.2` - 200ms animation duration
- `getHitAnimationScale()` - Returns scale 1.0 → 1.3 → 1.0 using sine wave
- Uses explicit `=== undefined` check for `hitTimestampSec` (can be 0 at loop start)

#### `drawNote()` Modifications
- Accepts `currentTimeSec` parameter
- Applies scale to note dimensions, border radius, font sizes
- Enhanced glow during animation (`shadowBlur: 25` vs `15`)

### 5. Game Controls (`src/components/GameControls/GameControls.tsx`)

#### New Props
- `sections: Array<{ id: string; name: string }>` - Available sections
- `loopConfig: LoopConfig | null` - Current loop state
- `loopCount: number` - Current iteration
- `onLoopSectionChange: (sectionId: string | null) => void` - Callback

#### Section Loop Control UI
- Dropdown selector with "Full song" default
- Disabled during countdown/playback
- Loop counter badge (`Loop #N`) when looping

### 6. Game Screen (`src/components/GameScreen/GameScreen.tsx`)

- Pass new props to `GameControls`
- Fixed stale closure bug by adding `recorder` to `handleKeyDown` dependencies

---

## Files Modified

```
src/types/index.ts                           # Added LoopConfig interface
src/lib/tabs/tempoUtils.ts                   # Added hitTimestampSec, getSectionTimeBounds()
src/hooks/useGameEngine.ts                   # Loop state, detection, setLoopSection
src/lib/rendering/highwayRenderer.ts         # Hit animation with sine wave scale
src/components/GameControls/GameControls.tsx # Section dropdown UI
src/components/GameScreen/GameScreen.tsx     # Wire new props
```

---

## Technical Decisions

### Animation Timing
- **Sine wave interpolation**: Smooth pulse (1.0 → 1.3 → 1.0) over 200ms
- **Scale applied to all dimensions**: Note width/height, border radius, font sizes
- **Enhanced glow during animation**: More visible feedback

### Loop Reset
- **Full scoring reset**: Score, streak, hit notes, results, timestamps all cleared
- **Proper time offset**: `playStartTimeRef = audioTime - (loopStartSec / speed)`
- **Loop counter increment**: Visible feedback in UI

### Edge Cases
- **hitTimestampSec at 0**: Use `=== undefined` instead of falsy check
- **Empty sections**: Validation in `getSectionTimeBounds()` returns null
- **Section not found**: Warning logged, no state change

---

## Remaining Work

### Phase 1-6 ✅ COMPLETE

### Future Enhancements
- [ ] Metronome/click track option
- [ ] Difficulty adjustment
- [ ] Additional themes
- [ ] Mobile-responsive layout
- [ ] Chroma-based chord detection

---

## How to Test

1. Run the dev server: `npm run dev`
2. Import a tab with multiple sections
3. Start audio capture
4. Select a section from the "Loop" dropdown
5. Start playback - verify it loops at section end
6. Verify score/streak reset when loop restarts
7. Verify loop counter increments
8. Hit notes and verify pulse/scale animation
9. Select "Full song" to disable looping
