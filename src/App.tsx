import { DebugPanel } from './components/DebugPanel';

function App() {
  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <header className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2">Guitar Practice</h1>
          <p className="text-slate-400">Real-time guitar training with pitch detection</p>
        </header>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Debug Panel */}
          <div>
            <DebugPanel />
          </div>

          {/* Placeholder for future components */}
          <div className="bg-slate-800 rounded-lg p-4">
            <h2 className="text-lg font-bold text-slate-200 mb-4">Instructions</h2>
            <div className="text-slate-400 text-sm space-y-3">
              <p>
                1. Connect your guitar to your computer via USB (Fender Mustang LT25)
              </p>
              <p>
                2. Select the audio input device from the dropdown
              </p>
              <p>
                3. Click "Start Audio" to begin pitch detection
              </p>
              <p>
                4. Play some notes! The detected pitch will appear in real-time.
              </p>
              <div className="mt-4 p-3 bg-slate-700 rounded">
                <p className="text-xs text-slate-500">
                  Tip: For best results, make sure your amp's USB output is set as the audio
                  input. The detection works best with clean, sustained notes.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-slate-500 text-sm">
          Phase 1: Audio Foundation - Testing pitch detection
        </footer>
      </div>
    </div>
  );
}

export default App;
