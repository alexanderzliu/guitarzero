# Architecture

This document explains how the Guitar Hero app works under the hood.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Browser                                    │
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │  USB Audio   │───►│ AudioWorklet │───►│  Main Thread (React) │  │
│  │  Interface   │    │  (YIN Pitch) │    │                      │  │
│  └──────────────┘    └──────────────┘    │  ┌────────────────┐  │  │
│                            │              │  │  Game Engine   │  │  │
│                            │ pitch/onset  │  │  (RAF Loop)    │  │  │
│                            ▼              │  └───────┬────────┘  │  │
│                      ┌───────────┐        │          │           │  │
│                      │ Message   │───────►│  ┌───────▼────────┐  │  │
│                      │ Port      │        │  │  Hit Detection │  │  │
│                      └───────────┘        │  │  & Scoring     │  │  │
│                                           │  └───────┬────────┘  │  │
│                                           │          │           │  │
│                                           │  ┌───────▼────────┐  │  │
│                                           │  │ Canvas Render  │  │  │
│                                           │  │ (Highway)      │  │  │
│                                           │  └────────────────┘  │  │
│                                           └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Audio Pipeline

### 1. Audio Capture (`lib/audio/audioCapture.ts`)

The `AudioCapture` class manages the Web Audio API:

```
MediaStream (USB input)
    │
    ▼
MediaStreamAudioSourceNode
    │
    ▼
AudioWorkletNode (pitch-detector.worklet.ts)
    │
    ▼
MessagePort → Main thread callbacks
```

Key responsibilities:
- Device enumeration and selection
- AudioContext lifecycle management
- Worklet loading and message handling
- Calibration offset management

### 2. AudioWorklet (`worklets/pitch-detector.worklet.ts`)

Runs in a dedicated audio thread for low-latency processing:

```typescript
// Processing pipeline (every 128 samples)
process(inputs) {
  ringBuffer.push(samples)

  if (ringBuffer.isFull()) {
    // YIN pitch detection
    const pitch = yinDetector.detect(ringBuffer.getData())

    // Onset detection (note attacks)
    const onset = onsetDetector.detect(samples)

    // Send to main thread (~30Hz throttled)
    port.postMessage({ pitch, onset, level })
  }
}
```

**Ring Buffer**: 2048 samples with 512-sample hop (75% overlap) provides good frequency resolution while maintaining low latency.

**YIN Algorithm**: Monophonic pitch detection based on autocorrelation. Returns frequency in Hz and clarity (0-1 confidence).

**Onset Detection**: Energy-based attack detection with adaptive thresholding. Triggers on note attacks to avoid false positives from sustaining notes.

### 3. Calibration (`hooks/useCalibration.ts`)

Measures end-to-end audio latency:

1. Display visual metronome at 90 BPM
2. User strums on each beat (8 samples)
3. Compare onset detection time vs expected beat time
4. Calculate median offset to filter reaction time variance
5. Store per-device offset in localStorage

The calibration offset is applied to all timing comparisons during gameplay.

## Game Engine

### State Machine (`hooks/useGameEngine.ts`)

```
idle → countdown → playing → finished
         │            │
         └────────────┘
              pause
```

States:
- **idle**: Waiting to start
- **countdown**: 4-beat countdown with metronome clicks
- **playing**: Active gameplay with scoring
- **finished**: Song complete, showing results

### Game Loop (requestAnimationFrame)

```typescript
function gameLoop(timestamp) {
  // 1. Calculate song time from audio clock
  const audioTime = audioContext.currentTime
  const songTime = (audioTime - playStartTime) * playbackSpeed

  // 2. Check for loop boundary
  if (loopConfig && songTime >= loopConfig.endSec) {
    resetToLoopStart()
  }

  // 3. Process pending notes in time window
  for (note of getVisibleNotes(songTime)) {
    if (hasOnsetNear(note.timeSec) && pitchMatches(note.midi)) {
      markHit(note)
      updateScore(note)
    } else if (note.timeSec < songTime - tolerance) {
      markMiss(note)
    }
  }

  // 4. Render highway
  renderFrame(canvas, visibleNotes, songTime)

  requestAnimationFrame(gameLoop)
}
```

### Timing

All timing derives from `audioContext.currentTime` (in seconds). Never mix with `performance.now()`.

```
audioContext.currentTime ──► playStartTime offset ──► songTime
                                    │
                                    ▼
                          songTime * playbackSpeed = actual position
```

## Scoring System

### Hit Detection (`lib/scoring/hitDetection.ts`)

A note is considered "hit" when:
1. An onset event occurs within the timing window
2. The detected pitch matches the expected MIDI note (±1 semitone tolerance)

```typescript
// Timing windows (applied to calibrated time)
Perfect: ±50ms   → 100 points
Good:    ±100ms  → 75 points
OK:      ±200ms  → 50 points
Miss:    >200ms  → 0 points
```

### Score Calculation (`lib/scoring/scoreCalculator.ts`)

```typescript
score = basePoints * streakMultiplier

// Streak multiplier
hits 0-9:   1x
hits 10-19: 2x
hits 20-29: 3x
hits 30+:   4x

// Streak resets on miss
```

## Tab Format & Timing

### Tick-Based Timing

Musical positions are stored in ticks (PPQ = pulses per quarter note):

```typescript
// Convert ticks to seconds
function tickToSec(tick: number, tempoMap: TempoEvent[], ppq: number): number {
  // Find applicable tempo at this tick
  const tempo = getTempoAtTick(tick, tempoMap)
  const ticksFromTempoStart = tick - tempo.tick
  const beatsFromTempoStart = ticksFromTempoStart / ppq
  const secondsFromTempoStart = beatsFromTempoStart * (60 / tempo.bpm)
  return tempo.startTimeSec + secondsFromTempoStart
}
```

This allows:
- Speed adjustment without recalculating positions
- Proper handling of tempo changes mid-song
- Standard MIDI-compatible timing

### Note Scheduling (`lib/tabs/tempoUtils.ts`)

On tab load, all notes are pre-processed into `RenderNote` objects with absolute time in seconds:

```typescript
interface RenderNote {
  id: string
  timeSec: number      // Absolute position in seconds
  durationSec: number
  string: number       // 1-6
  fret: number
  midi: number
  sectionId: string
  measureNumber: number
}
```

## Rendering

### Highway Display (`lib/rendering/highwayRenderer.ts`)

Canvas-based rendering at 60fps:

```
                    Hit Zone
                       │
┌──────────────────────┼──────┐
│ 1 ───────────────────┼────── │  ← high E
│ 2 ───────────────────┼────── │
│ 3 ──────[3]──────────┼────── │  ← note approaching
│ 4 ───────────────────┼────── │
│ 5 ───────────────────┼────── │
│ 6 ───────────────────┼────── │  ← low E
└──────────────────────┼──────┘
                       │
        ◄── notes scroll this way
```

Notes scroll right-to-left. Position calculated as:

```typescript
const x = hitZoneX + (note.timeSec - songTime) * pixelsPerSecond
```

### Visual Feedback

- **Pending notes**: White with fret number
- **Hit notes**: Color glow based on timing (cyan/green/yellow)
- **Missed notes**: Red, faded
- **Hit animation**: 200ms pulse/scale effect using sine wave interpolation

## Data Persistence

### localStorage

- **Tabs**: Full tab JSON with metadata index for fast listing
- **Calibration**: Per-device offset in seconds

### IndexedDB (Dexie.js)

- **Sessions**: Play events with timing offsets, aggregated stats, grades

```typescript
interface SessionRecord {
  id: string
  tabId: string
  startedAt: Date
  finishedAt: Date
  playbackSpeed: number
  events: PlayEventRecord[]  // Hit/miss events with timing
  aggregates: SessionAggregate  // Pre-computed stats
}
```

## Component Architecture

```
App
├── TabList              # Song selection
├── TabImport            # JSON import wizard
├── TabPreview           # Tab details + session history
│   └── SessionHistory
├── GameScreen           # Main gameplay
│   ├── GameControls     # Speed, loop, look-ahead
│   ├── Highway          # Canvas display
│   └── SessionResults   # Post-game overlay
├── Calibration          # Latency wizard
└── DebugPanel           # Audio diagnostics
```

### Key Hooks

| Hook | Purpose |
|------|---------|
| `useAudioInput` | Audio capture state and controls |
| `useGameEngine` | Game loop, scoring, state machine |
| `useCalibration` | Calibration flow state machine |
| `useSessionRecorder` | Captures play events during gameplay |
| `useSessionHistory` | Queries past sessions for a tab |

## Performance Considerations

### AudioWorklet Thread Isolation

The pitch detection worklet cannot import from the main bundle. Implementations of RingBuffer, YIN, and onset detection are duplicated in the worklet file.

### Canvas Optimization

```typescript
canvas.getContext('2d', {
  alpha: false,        // No transparency needed
  desynchronized: true // Reduce latency
})
```

### Memory Management

- Game loop uses refs to avoid re-renders during gameplay
- Session events stored in ref array, committed to IndexedDB only on completion
- Cleanup on unmount: `cancelAnimationFrame`, `AudioContext.close()`
