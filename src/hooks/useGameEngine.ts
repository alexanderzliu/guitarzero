import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Tab, GameState, ScoreResult, MidiNote } from '../types';
import { useAudioInput } from './useAudioInput';
import {
  prepareRenderNotes,
  getVisibleNotes,
  getTabDuration,
  getBpmAtTick,
  type RenderNote,
} from '../lib/tabs/tempoUtils';
import {
  findMatchingNotes,
  findMissedNotes,
  getNoteKey,
  applyHitResult,
  DEFAULT_TIMING_TOLERANCES,
  INITIAL_SCORE_STATE,
  type ScoreState,
} from '../lib/scoring';

// ============================================================================
// Game Engine Hook - State Machine for Tab Playback
// ============================================================================

const DEFAULT_LOOK_AHEAD_SEC = 4;
const DEFAULT_SPEED = 1.0;
const COUNTDOWN_BEATS = 4; // 4 beat count-in
const LOOK_BEHIND_SEC = 0.5; // Time window to show passed notes
const MIN_SPEED = 0.25;
const MAX_SPEED = 2.0;
const MIN_LOOK_AHEAD_SEC = 2;
const MAX_LOOK_AHEAD_SEC = 8;

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
  // Scoring state
  scoreState: ScoreState;
  lastHitResult: ScoreResult | null; // For UI feedback
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

  // Current audio detection (for debug display)
  currentPitch: { midi: MidiNote | null; clarity: number } | null;
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
    scoreState: INITIAL_SCORE_STATE,
    lastHitResult: null,
  }));

  // Refs for RAF loop (avoid stale closures)
  const gameStateRef = useRef<GameState>('idle');
  const playStartTimeRef = useRef<number>(0);
  const pausedAtTimeRef = useRef<number>(0);
  const speedRef = useRef<number>(initialSpeed);
  const lookAheadRef = useRef<number>(initialLookAhead);
  const rafIdRef = useRef<number>(0);

  // Scoring refs (mutable during RAF loop)
  const scoreStateRef = useRef<ScoreState>(INITIAL_SCORE_STATE);
  const hitNotesRef = useRef<Set<string>>(new Set()); // Track which notes have been scored
  const noteResultsRef = useRef<Map<string, ScoreResult>>(new Map()); // Store results for rendering
  const lastOnsetRef = useRef<{ timestampSec: number; rmsDb: number } | null>(null);

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
          scoreState: scoreStateRef.current,
        }));
        return; // Stop the loop
      }

      // ===== Hit Detection =====
      let lastHitResult: ScoreResult | null = null;

      // Check for onset events (note attacks)
      const currentOnset = audioInputRef.current.lastOnset;
      if (currentOnset && currentOnset !== lastOnsetRef.current) {
        lastOnsetRef.current = currentOnset;

        // Get current pitch at onset time
        const currentPitch = audioInputRef.current.currentPitch;
        const detectedMidi = currentPitch?.midi ?? null;

        if (detectedMidi !== null) {
          // Find notes that haven't been hit yet
          const pendingNotes = allNotesRef.current.filter(
            (n) => !hitNotesRef.current.has(getNoteKey(n))
          );

          // Find matching notes
          const matches = findMatchingNotes(
            detectedMidi,
            songTime,
            pendingNotes,
            DEFAULT_TIMING_TOLERANCES
          );

          // Process matches (best match first based on timing)
          for (const match of matches) {
            const noteKey = getNoteKey(match.note);
            if (!hitNotesRef.current.has(noteKey)) {
              hitNotesRef.current.add(noteKey);
              noteResultsRef.current.set(noteKey, match.result);
              scoreStateRef.current = applyHitResult(scoreStateRef.current, match.result);
              lastHitResult = match.result;
            }
          }
        }
      }

      // ===== Miss Detection =====
      // Find notes that have passed the miss threshold
      const pendingNotes = allNotesRef.current.filter(
        (n) => !hitNotesRef.current.has(getNoteKey(n))
      );
      const missedNotes = findMissedNotes(songTime, pendingNotes, DEFAULT_TIMING_TOLERANCES);

      for (const note of missedNotes) {
        const noteKey = getNoteKey(note);
        hitNotesRef.current.add(noteKey);
        noteResultsRef.current.set(noteKey, 'miss');
        scoreStateRef.current = applyHitResult(scoreStateRef.current, 'miss');
        lastHitResult = 'miss';
      }

      // Get visible notes with hit results applied
      const lookAhead = lookAheadRef.current;
      const visibleNotes = getVisibleNotes(
        allNotesRef.current,
        songTime,
        lookAhead / speed, // Adjust look-ahead by speed
        LOOK_BEHIND_SEC
      ).map((note) => {
        const noteKey = getNoteKey(note);
        const hitResult = noteResultsRef.current.get(noteKey);
        return hitResult ? { ...note, hitResult } : note;
      });

      setState((s) => ({
        ...s,
        currentTimeSec: songTime,
        visibleNotes,
        scoreState: scoreStateRef.current,
        lastHitResult: lastHitResult ?? s.lastHitResult,
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

    // Reset scoring state
    scoreStateRef.current = INITIAL_SCORE_STATE;
    hitNotesRef.current = new Set();
    noteResultsRef.current = new Map();
    lastOnsetRef.current = null;

    setState({
      gameState: 'countdown',
      currentTimeSec: 0,
      countdownValue: COUNTDOWN_BEATS,
      beatActive: false,
      speed: speedRef.current,
      lookAheadSec: lookAheadRef.current,
      visibleNotes: [],
      duration: tabDurationRef.current,
      scoreState: INITIAL_SCORE_STATE,
      lastHitResult: null,
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

    // Reset scoring state
    scoreStateRef.current = INITIAL_SCORE_STATE;
    hitNotesRef.current = new Set();
    noteResultsRef.current = new Map();
    lastOnsetRef.current = null;

    setState({
      gameState: 'idle',
      currentTimeSec: 0,
      countdownValue: COUNTDOWN_BEATS,
      beatActive: false,
      speed: speedRef.current,
      lookAheadSec: lookAheadRef.current,
      visibleNotes: [],
      duration: tabDurationRef.current,
      scoreState: INITIAL_SCORE_STATE,
      lastHitResult: null,
    });
  }, []);

  /**
   * Set playback speed
   */
  const setSpeed = useCallback((speed: number) => {
    const clampedSpeed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, speed));
    speedRef.current = clampedSpeed;
    setState((s) => ({ ...s, speed: clampedSpeed }));
  }, []);

  /**
   * Set look-ahead time
   */
  const setLookAhead = useCallback((sec: number) => {
    const clampedSec = Math.max(MIN_LOOK_AHEAD_SEC, Math.min(MAX_LOOK_AHEAD_SEC, sec));
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
    currentPitch: audioInput.currentPitch
      ? { midi: audioInput.currentPitch.midi, clarity: audioInput.currentPitch.clarity }
      : null,
  };
}
