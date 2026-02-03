import { useAudioInput } from '../../hooks/useAudioInput';
import { midiToNoteName } from '../../lib/audio/midiUtils';

// ============================================================================
// Debug Panel - "Garage Film" Aesthetic
// ============================================================================

interface LevelMeterProps {
  level: number;
  peak: number;
  label: string;
}

function LevelMeter({ level, peak, label }: LevelMeterProps) {
  const levelPercent = Math.max(0, Math.min(100, ((level + 60) / 60) * 100));
  const peakPercent = Math.max(0, Math.min(100, ((peak + 60) / 60) * 100));

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-[#78716c]">{label}</span>
        <span className="text-[#f5f0e6] font-mono">{level > -60 ? `${level.toFixed(1)} dB` : '-∞'}</span>
      </div>
      <div className="h-3 bg-[#0a0a0a] rounded overflow-hidden relative border border-[#292524]">
        <div
          className="h-full bg-gradient-to-r from-[#65a30d] via-[#d97706] to-[#dc2626] transition-all duration-75"
          style={{ width: `${levelPercent}%` }}
        />
        <div
          className="absolute top-0 h-full w-0.5 bg-[#f5f0e6] transition-all duration-150"
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
    <div className="bg-[#1a1614] border border-[#292524] rounded p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-[#f5f0e6] tracking-wide">AUDIO INPUT</h2>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isRunning ? 'bg-[#dc2626] animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.8)]' : 'bg-[#57534e]'
            }`}
          />
          <span className="text-xs text-[#78716c] font-mono">
            {isRunning ? 'RUNNING' : isStarting ? 'STARTING...' : 'STOPPED'}
          </span>
        </div>
      </div>

      {/* Device Selection */}
      <div className="space-y-2">
        <label className="font-display text-xs text-[#78716c] tracking-widest">INPUT DEVICE</label>
        <select
          className="w-full bg-[#0a0a0a] text-[#f5f0e6] rounded px-3 py-2 text-sm border border-[#292524] focus:outline-none focus:border-[#d97706] focus:shadow-[0_0_10px_rgba(217,119,6,0.3)]"
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
        className={`w-full py-3 px-4 rounded font-display tracking-wide transition-all ${
          isRunning
            ? 'bg-[#7f1d1d] hover:bg-[#991b1b] text-[#fbbf24] border border-[#dc2626]'
            : 'bg-[#dc2626] hover:bg-[#ef4444] text-[#f5f0e6] hover:shadow-[0_0_20px_rgba(220,38,38,0.5)]'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isStarting ? 'STARTING...' : isRunning ? 'STOP AUDIO' : 'START AUDIO'}
      </button>

      {/* Error Display */}
      {error && (
        <div className="bg-[#7f1d1d]/30 border border-[#dc2626]/50 rounded p-3 text-[#fbbf24] text-xs font-mono">
          {error}
        </div>
      )}

      {/* Level Meters */}
      {isRunning && currentLevel && (
        <div className="space-y-3 pt-2 border-t border-[#292524]">
          <LevelMeter level={currentLevel.rmsDb} peak={currentLevel.peakDb} label="Input Level" />
        </div>
      )}

      {/* Pitch Detection Display */}
      {isRunning && (
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#292524]">
          <div className="bg-[#0a0a0a] border border-[#292524] rounded p-3">
            <div className="font-display text-[10px] text-[#57534e] tracking-widest mb-1">DETECTED NOTE</div>
            <div className="font-display text-3xl text-[#f5f0e6]">
              {currentPitch?.frequency && currentPitch.clarity > 0.5
                ? midiToNoteName(currentPitch.midi!)
                : '—'}
            </div>
          </div>
          <div className="bg-[#0a0a0a] border border-[#292524] rounded p-3">
            <div className="font-display text-[10px] text-[#57534e] tracking-widest mb-1">FREQUENCY</div>
            <div className="font-mono text-2xl text-[#f5f0e6]">
              {currentPitch?.frequency && currentPitch.clarity > 0.5
                ? `${currentPitch.frequency.toFixed(1)}`
                : '—'}
              <span className="text-[#78716c] text-sm ml-1">Hz</span>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Stats */}
      {isRunning && (
        <div className="text-xs space-y-1 border-t border-[#292524] pt-3">
          <div className="flex justify-between">
            <span className="text-[#57534e]">Sample Rate</span>
            <span className="text-[#78716c] font-mono">{sampleRate} Hz</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#57534e]">Input Offset</span>
            <span className="text-[#78716c] font-mono">{(inputOffsetSec * 1000).toFixed(0)} ms</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#57534e]">Clarity</span>
            <span className="text-[#78716c] font-mono">
              {currentPitch?.clarity !== undefined
                ? `${(currentPitch.clarity * 100).toFixed(0)}%`
                : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#57534e]">MIDI Note</span>
            <span className="text-[#78716c] font-mono">{currentPitch?.midi ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#57534e]">Last Onset</span>
            <span className="text-[#78716c] font-mono">
              {lastOnset ? `${lastOnset.timestampSec.toFixed(2)}s` : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#57534e]">Onset MIDI</span>
            <span className="text-[#78716c] font-mono">{lastOnset?.midi ?? '—'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
