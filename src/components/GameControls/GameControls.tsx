import type { GameState } from '../../types';
import { formatTime } from '../../lib/tabs/tempoUtils';

// ============================================================================
// Game Controls Component - Play/Pause, Speed, Look-ahead
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
}: GameControlsProps) {
  const isPlaying = gameState === 'playing';
  const isPaused = gameState === 'paused';
  const isIdle = gameState === 'idle';
  const isCountdown = gameState === 'countdown';
  const isFinished = gameState === 'finished';

  // Speed presets
  const speedPresets = [
    { label: '0.25x', value: 0.25 },
    { label: '0.5x', value: 0.5 },
    { label: '0.75x', value: 0.75 },
    { label: '1x', value: 1.0 },
  ];

  return (
    <div className="bg-slate-800 rounded-lg p-4 space-y-4">
      {/* Audio Warning */}
      {!isAudioRunning && (
        <div className="flex items-center justify-between p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg">
          <span className="text-yellow-400 text-sm">Audio required for timing</span>
          <button
            onClick={onStartAudio}
            className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded transition-colors"
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
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            <PlayIcon />
            {isFinished ? 'Play Again' : 'Play'}
          </button>
        ) : isPlaying || isCountdown ? (
          <button
            onClick={onPause}
            className="flex items-center gap-2 px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors"
          >
            <PauseIcon />
            Pause
          </button>
        ) : isPaused ? (
          <button
            onClick={onResume}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
          >
            <PlayIcon />
            Resume
          </button>
        ) : null}

        {/* Stop Button (only when not idle) */}
        {!isIdle && (
          <button
            onClick={onStop}
            className="flex items-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <StopIcon />
            Stop
          </button>
        )}

        {/* Progress Display */}
        <div className="flex-1 text-center">
          <span className="text-slate-200 font-mono text-lg">
            {formatTime(currentTimeSec)} / {formatTime(duration)}
          </span>
        </div>

        {/* Exit Button */}
        <button
          onClick={onExit}
          className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
        >
          Exit
        </button>
      </div>

      {/* Settings Row */}
      <div className="flex items-center gap-6 pt-2 border-t border-slate-700">
        {/* Speed Control */}
        <div className="flex items-center gap-3">
          <label className="text-slate-400 text-sm">Speed:</label>
          <div className="flex gap-1">
            {speedPresets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => onSpeedChange(preset.value)}
                disabled={isPlaying || isCountdown}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  speed === preset.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Look-ahead Control */}
        <div className="flex items-center gap-3">
          <label className="text-slate-400 text-sm">Look-ahead:</label>
          <input
            type="range"
            min="2"
            max="8"
            step="0.5"
            value={lookAheadSec}
            onChange={(e) => onLookAheadChange(parseFloat(e.target.value))}
            disabled={isPlaying || isCountdown}
            className="w-24 accent-blue-500"
          />
          <span className="text-slate-300 text-sm w-8">{lookAheadSec}s</span>
        </div>

        {/* Current Speed Display */}
        <div className="ml-auto text-slate-500 text-sm">
          {speed < 1 && <span className="text-yellow-400">Practice mode ({speed}x)</span>}
        </div>
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="text-center text-slate-500 text-xs">
        <span className="bg-slate-700 px-2 py-0.5 rounded">Space</span> Play/Pause
        <span className="mx-2">•</span>
        <span className="bg-slate-700 px-2 py-0.5 rounded">Esc</span> Exit
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
