# Guitar Hero for Real Guitar

A web-based guitar training application that provides real-time feedback as you play along with tabs. Think Guitar Hero, but with your actual guitar.

## Features

### Phase 1: Audio Foundation ✅
- **Real-time pitch detection** using YIN algorithm in AudioWorklet
- **Onset detection** for accurate note attack timing
- **Device selection** for USB audio interfaces (e.g., Fender Mustang LT25)
- **Latency calibration** wizard to measure and compensate for audio input delay
- **Debug panel** showing detected pitch, confidence, and audio state

### Phase 2: Tab Format & Import ✅
- **Tab JSON format** with sections, measures, events, and notes
- **Comprehensive validation** (MIDI 0-127, fret 0-24, string 1-6, tempo ordering)
- **Import wizard** with paste → validate → preview → save workflow
- **Tab preview** with expandable sections showing measures and notes
- **localStorage persistence** with metadata index for fast listing

### Phase 3: Tab Display & Playhead ✅
- **Scrolling highway** with notes flowing right-to-left toward a hit zone
- **6-string display** in standard tab layout (high E at top)
- **Color-coded notes** with fret numbers and technique indicators
- **Tempo map support** handles BPM changes throughout the song
- **Speed control** (0.25x, 0.5x, 0.75x, 1x) for practice mode
- **Configurable look-ahead** (2-8 seconds) to adjust note preview
- **4-beat countdown** with metronome clicks synced to song tempo
- **Pause/resume** during both countdown and playback
- **Keyboard shortcuts** (Space = play/pause, Escape = exit)

### Phase 4: Scoring Engine ✅
- **Real-time hit detection** using onset events + pitch matching
- **Timing tolerance windows**: perfect (±50ms), good (±100ms), ok (±200ms)
- **Pitch tolerance** of ±1 semitone for matching
- **Visual feedback** with color-coded notes (cyan/green/yellow/red glow)
- **Score tracking** with points (100/75/50/0) and streak multipliers (1x→4x)
- **Header display** showing score, streak, and accuracy percentage

### Phase 5: Session Recording & Analytics ✅
- **Play event recording** with timing offsets for each note
- **Results overlay** with letter grade (S/A/B/C/D/F) and stats
- **Timing histogram** showing early/late distribution
- **Session history** in tab preview with best scores
- **Problem spot identification** across sessions
- **IndexedDB persistence** via Dexie.js

### Phase 6: Polish & UX ✅
- **Practice mode with section looping** - select any section to loop continuously
- **Hit animations** - notes pulse/scale on successful hits (200ms sine wave)
- **Loop counter** displays current iteration number
- **Score reset** at the beginning of each loop

## Tech Stack

- **React 19** + **TypeScript** + **Vite**
- **Web Audio API** with AudioWorklets for low-latency processing
- **HTML5 Canvas** for highway rendering
- **Tailwind CSS** for styling
- **localStorage** for persistence

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Project Structure

```
src/
├── components/
│   ├── Calibration/       # Latency calibration wizard
│   ├── DebugPanel/        # Audio debug display
│   ├── GameControls/      # Play/pause, speed, look-ahead controls
│   ├── GameScreen/        # Main gameplay orchestrator
│   ├── Highway/           # Canvas-based tab display
│   ├── TabImport/         # JSON import wizard
│   ├── TabList/           # Tab library list
│   └── TabPreview/        # Read-only tab viewer
├── hooks/
│   ├── useAudioInput.ts   # Audio capture hook
│   ├── useCalibration.ts  # Calibration state machine
│   └── useGameEngine.ts   # Game state machine with RAF loop
├── lib/
│   ├── audio/
│   │   ├── audioCapture.ts    # AudioContext management
│   │   ├── metronome.ts       # Countdown click sounds
│   │   ├── midiUtils.ts       # MIDI ↔ note name conversion
│   │   ├── onsetDetector.ts   # Note attack detection
│   │   ├── ringBuffer.ts      # Circular buffer for samples
│   │   └── yinDetector.ts     # YIN pitch detection
│   ├── rendering/
│   │   └── highwayRenderer.ts # Canvas drawing functions
│   ├── scoring/
│   │   ├── hitDetection.ts    # Pitch matching, timing classification
│   │   ├── scoreCalculator.ts # Points, streak, accuracy
│   │   └── index.ts           # Barrel export
│   ├── storage/
│   │   ├── calibrationStorage.ts  # Calibration persistence
│   │   └── tabStorage.ts          # Tab CRUD operations
│   └── tabs/
│       ├── tabValidator.ts    # Tab JSON validation
│       └── tempoUtils.ts      # Tick/time conversion, note scheduling
├── types/
│   └── index.ts           # TypeScript interfaces
└── worklets/
    └── pitch-detector.worklet.ts  # AudioWorklet processor
```

## Tab JSON Format

```json
{
  "id": "unique-tab-id",
  "title": "Song Name",
  "artist": "Artist Name",
  "ppq": 480,
  "timeSignature": [4, 4],
  "tuning": [40, 45, 50, 55, 59, 64],
  "tempoMap": [{ "tick": 0, "bpm": 120 }],
  "sections": [{
    "id": "section-1",
    "name": "Intro",
    "startTick": 0,
    "measures": [{
      "id": "measure-1",
      "number": 1,
      "events": [{
        "id": "event-1",
        "tick": 0,
        "durationTicks": 480,
        "notes": [{ "string": 1, "fret": 0, "midi": 64 }]
      }]
    }]
  }]
}
```

### Validation Rules
- `string`: 1-6 (high E to low E)
- `fret`: 0-24
- `midi`: 0-127
- `tuning`: exactly 6 MIDI notes
- `tempoMap`: sorted by tick, first event at tick 0
- All IDs must be unique across the tab

## Development Roadmap

- [x] Phase 1: Audio foundation with pitch detection
- [x] Phase 1: Latency calibration system
- [x] Phase 2: Tab format and validation
- [x] Phase 2: Tab import wizard
- [x] Phase 2: Tab preview and storage
- [x] Phase 3: Highway visualization with scrolling notes
- [x] Phase 3: Speed control and look-ahead settings
- [x] Phase 3: Countdown with metronome
- [x] Phase 4: Hit detection comparing played vs expected notes
- [x] Phase 4: Scoring system with timing tolerance
- [x] Phase 4: Visual feedback and score display
- [x] Phase 5: Session recording and results
- [x] Phase 5: Progress tracking with problem spots
- [x] Phase 6: Practice mode with section looping
- [x] Phase 6: Hit animations and visual polish

## License

MIT
