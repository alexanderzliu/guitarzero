import { useState } from 'react';
import { DebugPanel } from './components/DebugPanel';
import { CalibrationWizard } from './components/Calibration';
import { TabImportWizard } from './components/TabImport';
import { TabPreview } from './components/TabPreview';
import { TabList } from './components/TabList';
import { GameScreen } from './components/GameScreen';
import { loadCalibration } from './lib/storage/calibrationStorage';
import { listTabs, loadTab, deleteTab, type TabMetadata } from './lib/storage/tabStorage';
import type { Tab } from './types';

// ============================================================================
// GuitarZero - "Garage Film" Aesthetic
// ============================================================================

type AppView = 'main' | 'calibration' | 'tab-import' | 'tab-preview' | 'game';

function App() {
  const [view, setView] = useState<AppView>('main');
  const [tabs, setTabs] = useState<TabMetadata[]>(() => listTabs());
  const [selectedTab, setSelectedTab] = useState<Tab | null>(null);

  const handleTabImported = (tab: Tab) => {
    setTabs(listTabs());
    setSelectedTab(tab);
    setView('tab-preview');
  };

  const handleSelectTab = (id: string) => {
    const tab = loadTab(id);
    if (tab) {
      setSelectedTab(tab);
      setView('tab-preview');
    }
  };

  const handleDeleteTab = () => {
    if (selectedTab) {
      deleteTab(selectedTab.id);
      setTabs(listTabs());
      setSelectedTab(null);
      setView('main');
    }
  };

  // Full-screen views
  if (view === 'calibration') {
    return (
      <CalibrationWizard
        onComplete={() => setView('main')}
        onCancel={() => setView('main')}
      />
    );
  }

  if (view === 'tab-import') {
    return (
      <TabImportWizard
        onComplete={handleTabImported}
        onCancel={() => setView('main')}
      />
    );
  }

  if (view === 'tab-preview' && selectedTab) {
    return (
      <TabPreview
        tab={selectedTab}
        onClose={() => {
          setSelectedTab(null);
          setView('main');
        }}
        onDelete={handleDeleteTab}
        onPlay={() => setView('game')}
      />
    );
  }

  if (view === 'game' && selectedTab) {
    return (
      <GameScreen
        tab={selectedTab}
        onExit={() => setView('tab-preview')}
      />
    );
  }

  // Main view
  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header - Bold, poster-style */}
        <header className="text-center py-8">
          <h1 className="font-display text-6xl text-[#f5f0e6] tracking-wide mb-3">
            GUITARZERO
          </h1>
          <p className="text-[#78716c] text-lg">
            Real-time guitar training with pitch detection
          </p>
          {/* Subtle red line accent */}
          <div className="mt-6 mx-auto w-24 h-1 bg-[#dc2626] rounded shadow-[0_0_20px_rgba(220,38,38,0.5)]" />
        </header>

        {/* Main Content Grid - 2x2 layout for aligned cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DebugPanel />
          <CalibrationCard onStartCalibration={() => setView('calibration')} />
          <TabList
            tabs={tabs}
            onSelectTab={handleSelectTab}
            onImportTab={() => setView('tab-import')}
          />
          <InstructionsCard />
        </div>

        {/* Footer */}
        <footer className="text-center text-[#57534e] text-sm font-mono pt-8">
          v0.3 — Tab Display & Playhead
        </footer>
      </div>
    </div>
  );
}

// ============================================================================
// Cards
// ============================================================================

interface CalibrationCardProps {
  onStartCalibration: () => void;
}

function CalibrationCard({ onStartCalibration }: CalibrationCardProps) {
  const calibration = loadCalibration(null);

  return (
    <div className="bg-[#1a1614] border border-[#292524] rounded p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl text-[#f5f0e6] tracking-wide">
          LATENCY CALIBRATION
        </h2>
        {calibration ? (
          <span className="text-xs bg-[#365314]/50 text-[#65a30d] px-2 py-1 rounded font-mono">
            CALIBRATED
          </span>
        ) : (
          <span className="text-xs bg-[#7f1d1d]/50 text-[#fbbf24] px-2 py-1 rounded font-mono">
            NOT CALIBRATED
          </span>
        )}
      </div>

      {calibration ? (
        <div className="text-sm text-[#78716c] mb-4">
          <p>
            Current offset:{' '}
            <span className="text-[#f5f0e6] font-mono">
              {(calibration.offsetSec * 1000).toFixed(1)}ms
            </span>
          </p>
          <p className="text-xs text-[#57534e] mt-1">
            Last calibrated: {new Date(calibration.calibratedAt).toLocaleDateString()}
          </p>
        </div>
      ) : (
        <p className="text-sm text-[#78716c] mb-4">
          Calibrate your audio input for accurate timing detection during gameplay.
        </p>
      )}

      <button
        onClick={onStartCalibration}
        className="w-full py-3 px-4 bg-[#dc2626] hover:bg-[#ef4444] text-[#f5f0e6] rounded font-display tracking-wide transition-all hover:shadow-[0_0_20px_rgba(220,38,38,0.5)]"
      >
        {calibration ? 'RECALIBRATE' : 'START CALIBRATION'}
      </button>
    </div>
  );
}

function InstructionsCard() {
  return (
    <div className="bg-[#1a1614] border border-[#292524] rounded p-5">
      <h2 className="font-display text-xl text-[#f5f0e6] tracking-wide mb-4">
        HOW TO PLAY
      </h2>
      <div className="text-[#78716c] text-sm space-y-3">
        <div className="flex gap-3">
          <span className="text-[#dc2626] font-mono font-bold">1.</span>
          <p>Connect your guitar to your computer via USB audio interface</p>
        </div>
        <div className="flex gap-3">
          <span className="text-[#dc2626] font-mono font-bold">2.</span>
          <p>Select the audio input device and click "Start Audio"</p>
        </div>
        <div className="flex gap-3">
          <span className="text-[#dc2626] font-mono font-bold">3.</span>
          <p>Run the calibration wizard for accurate timing</p>
        </div>
        <div className="flex gap-3">
          <span className="text-[#dc2626] font-mono font-bold">4.</span>
          <p>Import a tab and start practicing</p>
        </div>
        <div className="mt-4 p-3 bg-[#0a0a0a] border border-[#292524] rounded">
          <p className="text-xs text-[#57534e]">
            <span className="text-[#d97706]">TIP:</span> For best results, use a clean tone with sustained notes. The pitch detection works best without heavy distortion.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
