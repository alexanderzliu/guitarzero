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

### Phase 3: Gameplay (Planned)
- Highway visualization with scrolling notes
- Real-time hit detection comparing played notes to expected
- Scoring system with accuracy feedback
- Practice mode with adjustable tempo

### Phase 4: Polish (Planned)
- Song progress and completion tracking
- Difficulty adjustment
- Performance statistics
- Additional visualizations

## Tech Stack

- **React 19** + **TypeScript** + **Vite**
- **Web Audio API** with AudioWorklets for low-latency processing
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
│   ├── TabImport/         # JSON import wizard
│   ├── TabList/           # Tab library list
│   └── TabPreview/        # Read-only tab viewer
├── hooks/
│   ├── useAudioInput.ts   # Audio capture hook
│   └── useCalibration.ts  # Calibration state machine
├── lib/
│   ├── audio/
│   │   ├── audioCapture.ts    # AudioContext management
│   │   ├── midiUtils.ts       # MIDI ↔ note name conversion
│   │   ├── onsetDetector.ts   # Note attack detection
│   │   ├── ringBuffer.ts      # Circular buffer for samples
│   │   └── yinDetector.ts     # YIN pitch detection
│   ├── storage/
│   │   ├── calibrationStorage.ts  # Calibration persistence
│   │   └── tabStorage.ts          # Tab CRUD operations
│   └── tabs/
│       └── tabValidator.ts    # Tab JSON validation
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
- [ ] Phase 3: Highway visualization
- [ ] Phase 3: Hit detection and scoring
- [ ] Phase 4: Practice mode
- [ ] Phase 4: Statistics and progress tracking

## License

MIT
