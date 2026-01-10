import { useEffect, useRef, useCallback } from 'react';
import type { Tab } from '../../types';
import { useGameEngine } from '../../hooks/useGameEngine';
import { Highway } from '../Highway';
import { GameControls } from '../GameControls';
import { playMetronomeClick } from '../../lib/audio/metronome';
import { getAudioCapture } from '../../lib/audio/audioCapture';
import { getStreakMultiplier, calculateAccuracy } from '../../lib/scoring';

// ============================================================================
// Game Screen Component - Main Orchestrator
// ============================================================================

/**
 * Get color class for streak display based on multiplier threshold.
 */
function getStreakColorClass(streak: number): string {
  if (streak >= 30) return 'text-yellow-400';
  if (streak >= 20) return 'text-purple-400';
  if (streak >= 10) return 'text-cyan-400';
  return 'text-white';
}

/**
 * Streak multiplier badge component.
 */
function StreakMultiplierBadge({ streak }: { streak: number }) {
  const multiplier = getStreakMultiplier(streak);
  if (multiplier <= 1) return null;
  return <span className="text-sm ml-1">x{multiplier}</span>;
}

interface GameScreenProps {
  tab: Tab;
  onExit: () => void;
}

export function GameScreen({ tab, onExit }: GameScreenProps) {
  const engine = useGameEngine({ tab });

  // Track last countdown value to trigger metronome
  const lastCountdownRef = useRef<number>(0);

  // Play metronome on countdown beats
  useEffect(() => {
    if (engine.gameState !== 'countdown') {
      lastCountdownRef.current = 0;
      return;
    }

    if (engine.countdownValue !== lastCountdownRef.current && engine.beatActive) {
      lastCountdownRef.current = engine.countdownValue;

      // Play click
      const audioCapture = getAudioCapture();
      const audioContext = audioCapture.getAudioContext();
      if (audioContext) {
        // Higher pitch for first beat
        const frequency = engine.countdownValue === 4 ? 1200 : 880;
        playMetronomeClick(audioContext, frequency);
      }
    }
  }, [engine.gameState, engine.countdownValue, engine.beatActive]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (engine.gameState === 'idle' || engine.gameState === 'finished') {
            engine.start();
          } else if (engine.gameState === 'playing' || engine.gameState === 'countdown') {
            engine.pause();
          } else if (engine.gameState === 'paused') {
            engine.resume();
          }
          break;

        case 'Escape':
          e.preventDefault();
          engine.stop();
          onExit();
          break;

        case 'KeyR':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            engine.stop();
            engine.start();
          }
          break;
      }
    },
    [engine, onExit]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">{tab.title}</h1>
            <p className="text-slate-400 text-sm">{tab.artist || 'Unknown Artist'}</p>
          </div>

          {/* Score Display */}
          <div className="flex items-center gap-6">
            {/* Score */}
            <div className="text-right">
              <div className="text-2xl font-bold text-white tabular-nums">
                {engine.scoreState.score.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 uppercase tracking-wide">Score</div>
            </div>

            {/* Streak */}
            <div className="text-right">
              <div className={`text-xl font-bold tabular-nums ${getStreakColorClass(engine.scoreState.streak)}`}>
                {engine.scoreState.streak}
                <StreakMultiplierBadge streak={engine.scoreState.streak} />
              </div>
              <div className="text-xs text-slate-500 uppercase tracking-wide">Streak</div>
            </div>

            {/* Accuracy */}
            <div className="text-right">
              <div className="text-xl font-bold text-white tabular-nums">
                {calculateAccuracy(engine.scoreState)}%
              </div>
              <div className="text-xs text-slate-500 uppercase tracking-wide">Accuracy</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-slate-500 text-sm">
              {tab.tempoMap[0]?.bpm || '?'} BPM
            </span>
            {engine.speed < 1 && (
              <span className="px-2 py-1 bg-yellow-900/50 text-yellow-400 text-sm rounded">
                {engine.speed}x Speed
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Highway (main content area) */}
      <div className="flex-1 p-4">
        <div className="h-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
          <Highway
            notes={engine.visibleNotes}
            currentTimeSec={engine.currentTimeSec}
            lookAheadSec={engine.lookAheadSec}
            speed={engine.speed}
            gameState={engine.gameState}
            countdownValue={engine.countdownValue}
            beatActive={engine.beatActive}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 pb-4">
        <GameControls
          gameState={engine.gameState}
          currentTimeSec={engine.currentTimeSec}
          duration={engine.duration}
          speed={engine.speed}
          lookAheadSec={engine.lookAheadSec}
          isAudioRunning={engine.isAudioRunning}
          onStart={engine.start}
          onPause={engine.pause}
          onResume={engine.resume}
          onStop={engine.stop}
          onSpeedChange={engine.setSpeed}
          onLookAheadChange={engine.setLookAhead}
          onStartAudio={engine.startAudio}
          onExit={onExit}
        />
      </div>
    </div>
  );
}
