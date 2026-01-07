# Guitar Zero

A "Guitar Hero for real guitar" web application that gamifies practicing guitar by detecting what you play in real-time and scoring your accuracy.

## Features (Planned)

- **Real-time pitch detection** from USB guitar input
- **PDF tab parsing** via AI (GPT-4V/Claude)
- **Scrolling tab display** with playhead
- **Accuracy scoring** with timing tolerance
- **Post-game analytics** for practice improvement

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS
- Web Audio API + AudioWorklet
- IndexedDB (Dexie.js)

## Development

```bash
npm install
npm run dev
```

## Hardware

Tested with:
- Fender Mustang LT25 amp (USB audio)
- Squier Telecaster

## License

MIT
