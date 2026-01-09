import { useState, useEffect } from 'react';
import { DebugPanel } from './components/DebugPanel';
import { CalibrationWizard } from './components/Calibration';
import { TabImportWizard } from './components/TabImport';
import { TabPreview } from './components/TabPreview';
import { TabList } from './components/TabList';
import { loadCalibration } from './lib/storage/calibrationStorage';
import { listTabs, loadTab, deleteTab, type TabMetadata } from './lib/storage/tabStorage';
import type { Tab } from './types';

type AppView = 'main' | 'calibration' | 'tab-import' | 'tab-preview';

function App() {
  const [view, setView] = useState<AppView>('main');
  const [tabs, setTabs] = useState<TabMetadata[]>([]);
  const [selectedTab, setSelectedTab] = useState<Tab | null>(null);

  // Load tabs on mount
  useEffect(() => {
    setTabs(listTabs());
  }, []);

  const handleTabImported = (tab: Tab) => {
    setTabs(listTabs()); // Refresh tab list
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
      />
    );
  }

  // Main view
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
          {/* Left Column: Debug Panel + Tab Library */}
          <div className="space-y-4">
            <DebugPanel />
            <TabList
              tabs={tabs}
              onSelectTab={handleSelectTab}
              onImportTab={() => setView('tab-import')}
            />
          </div>

          {/* Right Column: Calibration + Instructions */}
          <div className="space-y-4">
            {/* Calibration Card */}
            <CalibrationCard onStartCalibration={() => setView('calibration')} />

            {/* Instructions Card */}
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
                  4. Import a tab and start practicing!
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
        </div>

        {/* Footer */}
        <footer className="text-center text-slate-500 text-sm">
          Phase 2: Tab Format & Import
        </footer>
      </div>
    </div>
  );
}

interface CalibrationCardProps {
  onStartCalibration: () => void;
}

function CalibrationCard({ onStartCalibration }: CalibrationCardProps) {
  const calibration = loadCalibration(null); // Check default device

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-slate-200">Latency Calibration</h2>
        {calibration ? (
          <span className="text-xs bg-green-900/50 text-green-400 px-2 py-1 rounded">
            Calibrated
          </span>
        ) : (
          <span className="text-xs bg-yellow-900/50 text-yellow-400 px-2 py-1 rounded">
            Not calibrated
          </span>
        )}
      </div>

      {calibration ? (
        <div className="text-sm text-slate-400 mb-3">
          <p>
            Current offset:{' '}
            <span className="text-slate-200 font-mono">
              {(calibration.offsetSec * 1000).toFixed(1)}ms
            </span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Last calibrated: {new Date(calibration.calibratedAt).toLocaleDateString()}
          </p>
        </div>
      ) : (
        <p className="text-sm text-slate-400 mb-3">
          Calibrate your audio input for accurate timing detection during gameplay.
        </p>
      )}

      <button
        onClick={onStartCalibration}
        className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors text-sm"
      >
        {calibration ? 'Recalibrate' : 'Start Calibration'}
      </button>
    </div>
  );
}

export default App;
