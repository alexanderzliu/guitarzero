import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Tab, GameState } from '../types';
import { useAudioInput } from './useAudioInput';
import {
  prepareRenderNotes,
  getVisibleNotes,
  getTabDuration,
  getBpmAtTick,
  type RenderNote,
} from '../lib/tabs/tempoUtils';

// ============================================================================
// Game Engine Hook - State Machine for Tab Playback
// ============================================================================

const DEFAULT_LOOK_AHEAD_SEC = 4;
const DEFAULT_SPEED = 1.0;
const COUNTDOWN_BEATS = 4; // 4 beat count-in

export interface GameEngineConfig {
  tab: Tab;
  initialSpeed?: number;
  initialLookAhead?: number;
}

export interface GameEngineState {
  gameState: GameState;
  currentTimeSec: number;
  countdownValue: number; // 4, 3, 2, 1, 0
  beatActive: boolean; // True at the start of each countdown beat
  speed: number;
  lookAheadSec: number;
  visibleNotes: RenderNote[];
  duration: number; // Total song duration in seconds
}

export interface UseGameEngineReturn extends GameEngineState {
  // All pre-computed notes (for scoring in Phase 4)
  allNotes: RenderNote[];

  // Actions
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  setSpeed: (speed: number) => void;
  setLookAhead: (sec: number) => void;

  // Audio state passthrough
  isAudioRunning: boolean;
  startAudio: () => Promise<void>;
  getCurrentTime: () => number;
}

export function useGameEngine(config: GameEngineConfig): UseGameEngineReturn {
  const { tab, initialSpeed = DEFAULT_SPEED, initialLookAhead = DEFAULT_LOOK_AHEAD_SEC } = config;

  // Audio input for timing
  const audioInput = useAudioInput();

  // Pre-compute all render notes once (useMemo for synchronous availability)
  const allNotes = useMemo(() => prepareRenderNotes(tab), [tab]);
  const tabDuration = useMemo(() => getTabDuration(tab), [tab]);

  // Game state
  const [state, setState] = useState<GameEngineState>(() => ({
    gameState: 'idle',
    currentTimeSec: 0,
    countdownValue: COUNTDOWN_BEATS,
    beatActive: false,
    speed: initialSpeed,
    lookAheadSec: initialLookAhead,
    visibleNotes: [],
    duration: tabDuration,
  }));

  // Refs for RAF loop (avoid stale closures)
  const gameStateRef = useRef<GameState>('idle');
  const playStartTimeRef = useRef<number>(0);
  const pausedAtTimeRef = useRef<number>(0);
  const speedRef = useRef<number>(initialSpeed);
  const lookAheadRef = useRef<number>(initialLookAhead);
  const rafIdRef = useRef<number>(0);

  // Refs for memoized values (to use in RAF loop)
  const allNotesRef = useRef(allNotes);
  const tabDurationRef = useRef(tabDuration);
  useEffect(() => {
    allNotesRef.current = allNotes;
    tabDurationRef.current = tabDuration;
    setState((s) => ({ ...s, duration: tabDuration }));
  }, [allNotes, tabDuration]);

  // BPM for countdown timing
  const countdownBpm = getBpmAtTick(0, tab.tempoMap);
  const beatDuration = 60 / countdownBpm;
  const countdownDuration = COUNTDOWN_BEATS * beatDuration;

  // Get current audio time (ref to avoid stale closure)
  const audioInputRef = useRef(audioInput);
  useEffect(() => {
    audioInputRef.current = audioInput;
  }, [audioInput]);

  /**
   * Main game loop - runs via requestAnimationFrame
   */
  const gameLoop = useCallback(() => {
    const audioTime = audioInputRef.current.getCurrentTime();
    const elapsed = audioTime - playStartTimeRef.current;

    if (gameStateRef.current === 'countdown') {
      // Countdown phase
      if (elapsed >= countdownDuration) {
        // Countdown finished, start playing
        gameStateRef.current = 'playing';
        playStartTimeRef.current = audioTime; // Reset start time for song

        setState((s) => ({
          ...s,
          gameState: 'playing',
          countdownValue: 0,
          beatActive: false,
          currentTimeSec: 0,
        }));
      } else {
        // Still in countdown
        const beatIndex = Math.floor(elapsed / beatDuration);
        const beatProgress = (elapsed % beatDuration) / beatDuration;
        const countdownValue = COUNTDOWN_BEATS - beatIndex;
        const beatActive = beatProgress < 0.15; // Flash for 15% of beat

        setState((s) => ({
          ...s,
          countdownValue: Math.max(1, countdownValue),
          beatActive,
        }));
      }

      rafIdRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    if (gameStateRef.current === 'playing') {
      // Playing phase - advance song time
      const speed = speedRef.current;
      const songTime = elapsed * speed;
      const duration = tabDurationRef.current;

      // Check for song end
      if (songTime >= duration) {
        gameStateRef.current = 'finished';
        setState((s) => ({
          ...s,
          gameState: 'finished',
          currentTimeSec: duration,
          visibleNotes: [],
        }));
        return; // Stop the loop
      }

      // Get visible notes
      const lookAhead = lookAheadRef.current;
      const visibleNotes = getVisibleNotes(
        allNotesRef.current,
        songTime,
        lookAhead / speed, // Adjust look-ahead by speed
        0.5 // Look behind 0.5s for passed notes
      );

      setState((s) => ({
        ...s,
        currentTimeSec: songTime,
        visibleNotes,
      }));

      rafIdRef.current = requestAnimationFrame(gameLoop);
    }
  }, [countdownDuration, beatDuration]);

  /**
   * Start the game (begins countdown)
   */
  const start = useCallback(() => {
    if (!audioInputRef.current.isRunning) {
      console.warn('Audio must be running to start game');
      return;
    }

    // Reset state
    gameStateRef.current = 'countdown';
    playStartTimeRef.current = audioInputRef.current.getCurrentTime();

    setState({
      gameState: 'countdown',
      currentTimeSec: 0,
      countdownValue: COUNTDOWN_BEATS,
      beatActive: false,
      speed: speedRef.current,
      lookAheadSec: lookAheadRef.current,
      visibleNotes: [],
      duration: tabDurationRef.current,
    });

    // Start game loop
    rafIdRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop]);

  /**
   * Pause the game (works during playing or countdown)
   */
  const pause = useCallback(() => {
    if (gameStateRef.current !== 'playing' && gameStateRef.current !== 'countdown') return;

    const wasCountdown = gameStateRef.current === 'countdown';
    gameStateRef.current = 'paused';
    pausedAtTimeRef.current = audioInputRef.current.getCurrentTime();
    cancelAnimationFrame(rafIdRef.current);

    setState((s) => ({
      ...s,
      gameState: 'paused',
      // Preserve countdown value if paused during countdown
      countdownValue: wasCountdown ? s.countdownValue : 0,
    }));
  }, []);

  /**
   * Resume from pause
   */
  const resume = useCallback(() => {
    if (gameStateRef.current !== 'paused') return;

    // Adjust start time to account for pause duration
    const pauseDuration = audioInputRef.current.getCurrentTime() - pausedAtTimeRef.current;
    playStartTimeRef.current += pauseDuration;

    // Resume to the correct state based on countdown value
    const resumeToCountdown = state.countdownValue > 0;
    gameStateRef.current = resumeToCountdown ? 'countdown' : 'playing';

    setState((s) => ({
      ...s,
      gameState: resumeToCountdown ? 'countdown' : 'playing',
    }));

    // Resume game loop
    rafIdRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop, state.countdownValue]);

  /**
   * Stop and reset to beginning
   */
  const stop = useCallback(() => {
    cancelAnimationFrame(rafIdRef.current);
    gameStateRef.current = 'idle';

    setState({
      gameState: 'idle',
      currentTimeSec: 0,
      countdownValue: COUNTDOWN_BEATS,
      beatActive: false,
      speed: speedRef.current,
      lookAheadSec: lookAheadRef.current,
      visibleNotes: [],
      duration: tabDurationRef.current,
    });
  }, []);

  /**
   * Set playback speed
   */
  const setSpeed = useCallback((speed: number) => {
    const clampedSpeed = Math.max(0.25, Math.min(2.0, speed));
    speedRef.current = clampedSpeed;
    setState((s) => ({ ...s, speed: clampedSpeed }));
  }, []);

  /**
   * Set look-ahead time
   */
  const setLookAhead = useCallback((sec: number) => {
    const clampedSec = Math.max(2, Math.min(8, sec));
    lookAheadRef.current = clampedSec;
    setState((s) => ({ ...s, lookAheadSec: clampedSec }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  return {
    ...state,
    allNotes,
    start,
    pause,
    resume,
    stop,
    setSpeed,
    setLookAhead,
    isAudioRunning: audioInput.isRunning,
    startAudio: audioInput.start,
    getCurrentTime: audioInput.getCurrentTime,
  };
}
