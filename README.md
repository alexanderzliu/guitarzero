# Guitar Hero for Real Guitar

A web-based guitar training app that provides real-time feedback as you play along with scrolling tablature. Connect your guitar via USB audio interface, and the app detects what you're playing using pitch detection algorithms.

## Features

- **Real-time pitch detection** - YIN algorithm running in an AudioWorklet for low-latency note detection
- **Scrolling tab display** - Notes flow right-to-left toward a hit zone on a 6-string highway
- **Scoring system** - Timing-based scoring with perfect/good/ok/miss grades and streak multipliers
- **Practice mode** - Loop any section, adjust playback speed (0.25x-1x), configurable look-ahead
- **Session analytics** - Track progress with timing histograms, problem spot identification, and session history
- **Latency calibration** - Wizard to measure and compensate for audio input delay

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173, connect your USB audio interface, and import a tab to start playing.

## How It Works

1. **Import a tab** - Paste JSON in the tab format (see below) or use the import wizard
2. **Calibrate** - Run the calibration wizard to measure your audio latency
3. **Play** - Select a tab, optionally choose a section to loop, and hit play
4. **Review** - See your results with timing analysis and track improvement over time

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

### Field Reference

| Field | Description |
|-------|-------------|
| `ppq` | Pulses per quarter note (standard: 480) |
| `tuning` | 6 MIDI notes for strings 1-6 (high E to low E). Standard: `[64, 59, 55, 50, 45, 40]` |
| `tempoMap` | BPM changes over time. First entry must be at tick 0 |
| `string` | 1 = high E, 6 = low E |
| `fret` | 0-24 |
| `midi` | MIDI note number (0-127). Middle C = 60, E4 = 64 |

### Validation Rules

- String: 1-6
- Fret: 0-24
- MIDI: 0-127
- Tuning: exactly 6 MIDI notes
- Tempo map: sorted by tick, first at tick 0
- All IDs must be unique

## Tech Stack

| Layer | Technology |
|-------|------------|
| UI | React 19 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS |
| Audio | Web Audio API + AudioWorklet |
| Visualization | HTML5 Canvas |
| Storage | localStorage (tabs, calibration) + IndexedDB via Dexie (sessions) |

## Project Structure

```
src/
├── components/
│   ├── Calibration/       # Latency calibration wizard
│   ├── DebugPanel/        # Audio debug display
│   ├── GameControls/      # Play/pause, speed, loop controls
│   ├── GameScreen/        # Main gameplay + results overlay
│   ├── Highway/           # Canvas-based scrolling tab display
│   ├── TabImport/         # JSON import wizard
│   ├── TabList/           # Tab library list
│   └── TabPreview/        # Tab viewer + session history
├── hooks/
│   ├── useAudioInput.ts      # Audio capture state
│   ├── useCalibration.ts     # Calibration state machine
│   ├── useGameEngine.ts      # Game loop + scoring
│   ├── useSessionRecorder.ts # Session event capture
│   └── useSessionHistory.ts  # Session history queries
├── lib/
│   ├── audio/             # Pitch detection, onset detection, audio capture
│   ├── rendering/         # Canvas drawing
│   ├── scoring/           # Hit detection, score calculation
│   ├── session/           # Session types, aggregates, event capture
│   ├── storage/           # Persistence (localStorage, IndexedDB)
│   └── tabs/              # Tab validation, tempo utilities
├── types/
│   └── index.ts           # TypeScript interfaces
└── worklets/
    └── pitch-detector.worklet.ts  # AudioWorklet for pitch detection
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Play / Pause |
| Escape | Exit to tab preview |

## License

MIT
