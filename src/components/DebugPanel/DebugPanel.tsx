import { useAudioInput } from '../../hooks/useAudioInput';
import { midiToNoteName } from '../../lib/audio/midiUtils';

interface LevelMeterProps {
  level: number; // in dB
  peak: number; // in dB
  label: string;
}

function LevelMeter({ level, peak, label }: LevelMeterProps) {
  // Convert dB to percentage (assuming -60dB to 0dB range)
  const levelPercent = Math.max(0, Math.min(100, ((level + 60) / 60) * 100));
  const peakPercent = Math.max(0, Math.min(100, ((peak + 60) / 60) * 100));

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span>{level > -60 ? `${level.toFixed(1)} dB` : '-∞'}</span>
      </div>
      <div className="h-3 bg-slate-700 rounded overflow-hidden relative">
        <div
          className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-75"
          style={{ width: `${levelPercent}%` }}
        />
        <div
          className="absolute top-0 h-full w-0.5 bg-white transition-all duration-150"
          style={{ left: `${peakPercent}%` }}
        />
      </div>
    </div>
  );
}

export function DebugPanel() {
  const {
    isRunning,
    isStarting,
    error,
    devices,
    selectedDeviceId,
    currentPitch,
    currentLevel,
    lastOnset,
    sampleRate,
    inputOffsetSec,
    start,
    stop,
    selectDevice,
  } = useAudioInput();

  return (
    <div className="bg-slate-800 rounded-lg p-4 space-y-4 font-mono text-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-200">Audio Debug</h2>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isRunning ? 'bg-green-500 animate-pulse' : 'bg-slate-500'
            }`}
          />
          <span className="text-slate-400 text-xs">
            {isRunning ? 'Running' : isStarting ? 'Starting...' : 'Stopped'}
          </span>
        </div>
      </div>

      {/* Device Selection */}
      <div className="space-y-2">
        <label className="text-xs text-slate-400">Input Device</label>
        <select
          className="w-full bg-slate-700 text-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={selectedDeviceId || ''}
          onChange={(e) => selectDevice(e.target.value || null)}
          disabled={isRunning}
        >
          <option value="">Default Device</option>
          {devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Device ${device.deviceId.slice(0, 8)}...`}
            </option>
          ))}
        </select>
      </div>

      {/* Start/Stop Button */}
      <button
        onClick={isRunning ? stop : start}
        disabled={isStarting}
        className={`w-full py-2 px-4 rounded font-medium transition-colors ${
          isRunning
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isStarting ? 'Starting...' : isRunning ? 'Stop' : 'Start Audio'}
      </button>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded p-2 text-red-300 text-xs">
          {error}
        </div>
      )}

      {/* Level Meters */}
      {isRunning && currentLevel && (
        <div className="space-y-3">
          <LevelMeter level={currentLevel.rmsDb} peak={currentLevel.peakDb} label="Input Level" />
        </div>
      )}

      {/* Pitch Detection Display */}
      {isRunning && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-700 rounded p-3">
            <div className="text-xs text-slate-400 mb-1">Detected Note</div>
            <div className="text-2xl font-bold text-white">
              {currentPitch?.frequency && currentPitch.clarity > 0.5
                ? midiToNoteName(currentPitch.midi!)
                : '—'}
            </div>
          </div>
          <div className="bg-slate-700 rounded p-3">
            <div className="text-xs text-slate-400 mb-1">Frequency</div>
            <div className="text-2xl font-bold text-white">
              {currentPitch?.frequency && currentPitch.clarity > 0.5
                ? `${currentPitch.frequency.toFixed(1)} Hz`
                : '—'}
            </div>
          </div>
        </div>
      )}

      {/* Detailed Stats */}
      {isRunning && (
        <div className="text-xs text-slate-400 space-y-1 border-t border-slate-700 pt-3">
          <div className="flex justify-between">
            <span>Sample Rate</span>
            <span className="text-slate-300">{sampleRate} Hz</span>
          </div>
          <div className="flex justify-between">
            <span>Input Offset</span>
            <span className="text-slate-300">{(inputOffsetSec * 1000).toFixed(0)} ms</span>
          </div>
          <div className="flex justify-between">
            <span>Clarity</span>
            <span className="text-slate-300">
              {currentPitch?.clarity !== undefined
                ? `${(currentPitch.clarity * 100).toFixed(0)}%`
                : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>MIDI Note</span>
            <span className="text-slate-300">{currentPitch?.midi ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span>Last Onset</span>
            <span className="text-slate-300">
              {lastOnset ? `${lastOnset.timestampSec.toFixed(2)}s` : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Onset MIDI</span>
            <span className="text-slate-300">{lastOnset?.midi ?? '—'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
