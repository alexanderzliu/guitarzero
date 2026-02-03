import { useEffect, useRef, useCallback, useState } from 'react';
import type { Tab } from '../../types';
import { useGameEngine } from '../../hooks/useGameEngine';
import { useSessionRecorder } from '../../hooks/useSessionRecorder';
import { Highway } from '../Highway';
import { GameControls } from '../GameControls';
import { SessionResults } from './SessionResults';
import { playMetronomeClick } from '../../lib/audio/metronome';
import { getAudioCapture } from '../../lib/audio/audioCapture';
import { getStreakMultiplier, calculateAccuracy } from '../../lib/scoring';
import type { SessionRecord } from '../../lib/session';
import { midiToNoteName } from '../../lib/audio/midiUtils';

// ============================================================================
// Game Screen - "Garage Film" Aesthetic
// ============================================================================

/**
 * Get color class for streak display based on multiplier threshold.
 */
function getStreakColorClass(streak: number): string {
  if (streak >= 30) return 'text-[#fbbf24]'; // Golden
  if (streak >= 20) return 'text-[#dc2626]'; // Blood red
  if (streak >= 10) return 'text-[#d97706]'; // Amber
  return 'text-[#f5f0e6]'; // Cream
}

/**
 * Streak multiplier badge component.
 */
function StreakMultiplierBadge({ streak }: { streak: number }) {
  const multiplier = getStreakMultiplier(streak);
  if (multiplier <= 1) return null;
  return (
    <span className="text-sm ml-1 text-[#dc2626]">
      x{multiplier}
    </span>
  );
}

interface GameScreenProps {
  tab: Tab;
  onExit: () => void;
}

export function GameScreen({ tab, onExit }: GameScreenProps) {
  const [completedSession, setCompletedSession] = useState<SessionRecord | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  const recorder = useSessionRecorder(tab, playbackSpeed);

  const engine = useGameEngine({
    tab,
    initialSpeed: playbackSpeed,
    onPlayEvent: recorder.recordEvent,
  });

  const lastCountdownRef = useRef<number>(0);

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    engine.setSpeed(speed);
  };

  useEffect(() => {
    if (engine.gameState === 'finished' && !completedSession) {
      recorder.finishSession(engine.scoreState).then((session) => {
        if (session) {
          setCompletedSession(session);
        }
      });
    }
  }, [engine.gameState, engine.scoreState, recorder, completedSession]);

  useEffect(() => {
    if (engine.gameState !== 'countdown') {
      lastCountdownRef.current = 0;
      return;
    }

    if (engine.countdownValue !== lastCountdownRef.current && engine.beatActive) {
      lastCountdownRef.current = engine.countdownValue;

      const audioCapture = getAudioCapture();
      const audioContext = audioCapture.getAudioContext();
      if (audioContext) {
        const frequency = engine.countdownValue === 4 ? 1200 : 880;
        playMetronomeClick(audioContext, frequency);
      }
    }
  }, [engine.gameState, engine.countdownValue, engine.beatActive]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
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
          recorder.discardSession();
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
    [engine, recorder, onExit]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handlePlayAgain = useCallback(() => {
    setCompletedSession(null);
    recorder.discardSession();
    engine.stop();
    engine.start();
  }, [recorder, engine]);

  const handleResultsExit = useCallback(() => {
    setCompletedSession(null);
    engine.stop();
    onExit();
  }, [engine, onExit]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Header - minimal, stays out of the way */}
      <header className="px-6 py-3 border-b border-[#1a1614]">
        <div className="flex items-center justify-between">
          {/* Song Info */}
          <div>
            <h1 className="font-display text-2xl text-[#f5f0e6] tracking-wide">
              {tab.title}
            </h1>
            <p className="text-[#78716c] text-sm">{tab.artist || 'Unknown Artist'}</p>
          </div>

          {/* Score Display - the heart of the HUD */}
          <div className="flex items-center gap-8">
            {/* Score */}
            <div className="text-right">
              <div className="font-mono text-3xl font-bold text-[#f5f0e6] tabular-nums tracking-tight">
                {engine.scoreState.score.toLocaleString()}
              </div>
              <div className="font-display text-xs text-[#57534e] tracking-widest">
                SCORE
              </div>
            </div>

            {/* Streak */}
            <div className="text-right">
              <div className={`font-mono text-2xl font-bold tabular-nums ${getStreakColorClass(engine.scoreState.streak)}`}>
                {engine.scoreState.streak}
                <StreakMultiplierBadge streak={engine.scoreState.streak} />
              </div>
              <div className="font-display text-xs text-[#57534e] tracking-widest">
                STREAK
              </div>
            </div>

            {/* Accuracy */}
            <div className="text-right">
              <div className="font-mono text-2xl font-bold text-[#f5f0e6] tabular-nums">
                {calculateAccuracy(engine.scoreState)}%
              </div>
              <div className="font-display text-xs text-[#57534e] tracking-widest">
                ACCURACY
              </div>
            </div>
          </div>

          {/* Meta info - subtle */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-[#57534e] font-mono">
              {tab.tempoMap[0]?.bpm || '?'} BPM
            </span>
            <span className="text-[#57534e]">
              <span className="text-[#78716c]">
                {engine.currentPitch?.midi != null && engine.currentPitch.clarity > 0.5
                  ? `${midiToNoteName(engine.currentPitch.midi)}`
                  : '—'}
              </span>
            </span>
            {engine.speed < 1 && (
              <span className="px-2 py-0.5 bg-[#7f1d1d] text-[#fbbf24] text-xs font-mono rounded">
                {engine.speed}x
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Highway - the stage */}
      <div className="flex-1 p-3">
        <div className="h-full rounded overflow-hidden border border-[#1a1614]">
          <Highway
            notes={engine.visibleNotes}
            currentTimeSec={engine.currentTimeSec}
            lookAheadSec={engine.lookAheadSec}
            speed={engine.speed}
            gameState={engine.gameState}
            countdownValue={engine.countdownValue}
            beatActive={engine.beatActive}
            timeSinceLastOnsetSec={engine.timeSinceLastOnsetSec}
            lastOnsetMidi={engine.lastOnsetMidi}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Controls */}
      <div className="px-3 pb-3">
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
          onSpeedChange={handleSpeedChange}
          onLookAheadChange={engine.setLookAhead}
          onStartAudio={engine.startAudio}
          onExit={onExit}
          sections={engine.sections}
          loopConfig={engine.loopConfig}
          loopCount={engine.loopCount}
          onLoopSectionChange={engine.setLoopSection}
        />
      </div>

      {/* Session Results Overlay */}
      {completedSession && (
        <SessionResults
          session={completedSession}
          onPlayAgain={handlePlayAgain}
          onExit={handleResultsExit}
        />
      )}
    </div>
  );
}
