import type { GameState, LoopConfig } from '../../types';
import { formatTime } from '../../lib/tabs/tempoUtils';

// ============================================================================
// Game Controls - "Garage Film" Aesthetic
// ============================================================================

interface GameControlsProps {
  gameState: GameState;
  currentTimeSec: number;
  duration: number;
  speed: number;
  lookAheadSec: number;
  isAudioRunning: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSpeedChange: (speed: number) => void;
  onLookAheadChange: (sec: number) => void;
  onStartAudio: () => void;
  onExit: () => void;
  sections: Array<{ id: string; name: string }>;
  loopConfig: LoopConfig | null;
  loopCount: number;
  onLoopSectionChange: (sectionId: string | null) => void;
}

export function GameControls({
  gameState,
  currentTimeSec,
  duration,
  speed,
  lookAheadSec,
  isAudioRunning,
  onStart,
  onPause,
  onResume,
  onStop,
  onSpeedChange,
  onLookAheadChange,
  onStartAudio,
  onExit,
  sections,
  loopConfig,
  loopCount,
  onLoopSectionChange,
}: GameControlsProps) {
  const isPlaying = gameState === 'playing';
  const isPaused = gameState === 'paused';
  const isIdle = gameState === 'idle';
  const isCountdown = gameState === 'countdown';
  const isFinished = gameState === 'finished';

  const speedPresets = [
    { label: '0.25x', value: 0.25 },
    { label: '0.5x', value: 0.5 },
    { label: '0.75x', value: 0.75 },
    { label: '1x', value: 1.0 },
  ];

  return (
    <div className="bg-[#1a1614] border border-[#292524] rounded p-4 space-y-4">
      {/* Audio Warning */}
      {!isAudioRunning && (
        <div className="flex items-center justify-between p-3 bg-[#7f1d1d]/30 border border-[#dc2626]/50 rounded">
          <span className="text-[#fbbf24] text-sm">Audio required for timing</span>
          <button
            onClick={onStartAudio}
            className="px-3 py-1 bg-[#dc2626] hover:bg-[#ef4444] text-[#f5f0e6] text-sm rounded transition-all hover:shadow-[0_0_15px_rgba(220,38,38,0.5)]"
          >
            Start Audio
          </button>
        </div>
      )}

      {/* Main Controls Row */}
      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        {isIdle || isFinished ? (
          <button
            onClick={onStart}
            disabled={!isAudioRunning}
            className="flex items-center gap-2 px-6 py-3 bg-[#dc2626] hover:bg-[#ef4444] disabled:bg-[#7f1d1d] disabled:opacity-50 text-[#f5f0e6] rounded font-semibold transition-all hover:shadow-[0_0_20px_rgba(220,38,38,0.6)]"
          >
            <PlayIcon />
            <span className="font-display tracking-wide">
              {isFinished ? 'PLAY AGAIN' : 'PLAY'}
            </span>
          </button>
        ) : isPlaying || isCountdown ? (
          <button
            onClick={onPause}
            className="flex items-center gap-2 px-6 py-3 bg-[#d97706] hover:bg-[#f59e0b] text-[#f5f0e6] rounded font-semibold transition-all hover:shadow-[0_0_20px_rgba(217,119,6,0.6)]"
          >
            <PauseIcon />
            <span className="font-display tracking-wide">PAUSE</span>
          </button>
        ) : isPaused ? (
          <button
            onClick={onResume}
            className="flex items-center gap-2 px-6 py-3 bg-[#dc2626] hover:bg-[#ef4444] text-[#f5f0e6] rounded font-semibold transition-all hover:shadow-[0_0_20px_rgba(220,38,38,0.6)]"
          >
            <PlayIcon />
            <span className="font-display tracking-wide">RESUME</span>
          </button>
        ) : null}

        {/* Stop Button */}
        {!isIdle && (
          <button
            onClick={onStop}
            className="flex items-center gap-2 px-4 py-3 bg-[#292524] hover:bg-[#3f3f46] border border-[#57534e] text-[#f5f0e6] rounded transition-all hover:border-[#dc2626]"
          >
            <StopIcon />
            <span className="font-display tracking-wide">STOP</span>
          </button>
        )}

        {/* Progress Display */}
        <div className="flex-1 text-center">
          <span className="font-mono text-lg text-[#f5f0e6] tabular-nums">
            {formatTime(currentTimeSec)}
          </span>
          <span className="text-[#57534e] mx-2">/</span>
          <span className="font-mono text-lg text-[#78716c] tabular-nums">
            {formatTime(duration)}
          </span>
        </div>

        {/* Exit Button */}
        <button
          onClick={onExit}
          className="px-4 py-3 bg-[#292524] hover:bg-[#3f3f46] border border-[#57534e] text-[#78716c] hover:text-[#f5f0e6] rounded transition-all hover:border-[#dc2626]"
        >
          <span className="font-display tracking-wide">EXIT</span>
        </button>
      </div>

      {/* Settings Row */}
      <div className="flex items-center gap-6 pt-3 border-t border-[#292524]">
        {/* Speed Control */}
        <div className="flex items-center gap-3">
          <label className="font-display text-xs text-[#78716c] tracking-widest">SPEED</label>
          <div className="flex gap-1">
            {speedPresets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => onSpeedChange(preset.value)}
                disabled={isPlaying || isCountdown}
                className={`px-3 py-1 text-sm font-mono rounded transition-all ${
                  speed === preset.value
                    ? 'bg-[#dc2626] text-[#f5f0e6] shadow-[0_0_10px_rgba(220,38,38,0.4)]'
                    : 'bg-[#292524] text-[#78716c] hover:text-[#f5f0e6] hover:bg-[#3f3f46] border border-[#3f3f46] disabled:opacity-40'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Look-ahead Control */}
        <div className="flex items-center gap-3">
          <label className="font-display text-xs text-[#78716c] tracking-widest">LOOK-AHEAD</label>
          <input
            type="range"
            min="2"
            max="8"
            step="0.5"
            value={lookAheadSec}
            onChange={(e) => onLookAheadChange(parseFloat(e.target.value))}
            disabled={isPlaying || isCountdown}
            className="w-24 accent-[#dc2626]"
          />
          <span className="font-mono text-sm text-[#f5f0e6] w-8">{lookAheadSec}s</span>
        </div>

        {/* Section Loop Control */}
        {sections.length > 0 && (
          <div className="flex items-center gap-3">
            <label className="font-display text-xs text-[#78716c] tracking-widest">LOOP</label>
            <select
              value={loopConfig?.sectionId || ''}
              onChange={(e) => onLoopSectionChange(e.target.value || null)}
              disabled={isPlaying || isCountdown}
              className="px-2 py-1 bg-[#0a0a0a] text-[#f5f0e6] text-sm rounded border border-[#292524] focus:border-[#d97706] focus:outline-none disabled:opacity-40"
            >
              <option value="">Full song</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
            {loopConfig && loopCount > 0 && (
              <span className="font-mono text-sm text-[#d97706]">#{loopCount}</span>
            )}
          </div>
        )}

        {/* Practice Mode Indicator */}
        <div className="ml-auto">
          {speed < 1 && (
            <span className="font-display text-xs text-[#fbbf24] tracking-widest">
              PRACTICE MODE
            </span>
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="text-center text-[#57534e] text-xs space-x-4">
        <span>
          <kbd className="bg-[#292524] text-[#78716c] px-2 py-0.5 rounded font-mono text-xs">Space</kbd>
          {' '}Play/Pause
        </span>
        <span>
          <kbd className="bg-[#292524] text-[#78716c] px-2 py-0.5 rounded font-mono text-xs">Esc</kbd>
          {' '}Exit
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Icons
// ============================================================================

function PlayIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 6h12v12H6z" />
    </svg>
  );
}
