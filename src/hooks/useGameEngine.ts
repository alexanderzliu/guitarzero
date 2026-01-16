import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Tab, GameState, ScoreResult, MidiNote, LoopConfig } from '../types';
import { useAudioInput } from './useAudioInput';
import {
  prepareRenderNotes,
  getVisibleNotes,
  getTabDuration,
  getBpmAtTick,
  getSectionTimeBounds,
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
import { createHitEvent, createMissEvent, type PlayEventRecord } from '../lib/session';

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
  /** Callback fired for each play event (hit or miss) during gameplay */
  onPlayEvent?: (event: PlayEventRecord) => void;
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
  // Practice mode looping
  loopConfig: LoopConfig | null;
  loopCount: number; // How many times we've looped
  // Onset detection feedback
  timeSinceLastOnsetSec: number | null; // Time since last detected onset
  lastOnsetMidi: number | null; // MIDI note of last onset
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
  setLoopSection: (sectionId: string | null) => void;

  // Section info for practice mode UI
  sections: Array<{ id: string; name: string }>;

  // Audio state passthrough
  isAudioRunning: boolean;
  startAudio: () => Promise<void>;
  getCurrentTime: () => number;

  // Current audio detection (for debug display)
  currentPitch: { midi: MidiNote | null; clarity: number } | null;
}

export function useGameEngine(config: GameEngineConfig): UseGameEngineReturn {
  const { tab, initialSpeed = DEFAULT_SPEED, initialLookAhead = DEFAULT_LOOK_AHEAD_SEC, onPlayEvent } = config;

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
    loopConfig: null,
    loopCount: 0,
    timeSinceLastOnsetSec: null,
    lastOnsetMidi: null,
  }));

  // Refs for RAF loop (avoid stale closures)
  const gameStateRef = useRef<GameState>('idle');
  const playStartTimeRef = useRef<number>(0);
  const pausedAtTimeRef = useRef<number>(0);
  const speedRef = useRef<number>(initialSpeed);
  const lookAheadRef = useRef<number>(initialLookAhead);
  const rafIdRef = useRef<number>(0);
  const loopConfigRef = useRef<LoopConfig | null>(null);
  const loopCountRef = useRef<number>(0);

  // Scoring refs (mutable during RAF loop)
  const scoreStateRef = useRef<ScoreState>(INITIAL_SCORE_STATE);
  const hitNotesRef = useRef<Set<string>>(new Set()); // Track which notes have been scored
  const noteResultsRef = useRef<Map<string, ScoreResult>>(new Map()); // Store results for rendering
  const hitTimestampsRef = useRef<Map<string, number>>(new Map()); // Store hit timestamps for animation
  const lastOnsetRef = useRef<{ timestampSec: number; rmsDb: number; midi: number | null; clarity: number } | null>(null);

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

  // Callback ref for play events (to avoid stale closure in RAF loop)
  const onPlayEventRef = useRef(onPlayEvent);
  useEffect(() => {
    onPlayEventRef.current = onPlayEvent;
  }, [onPlayEvent]);

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
      const loopConfig = loopConfigRef.current;
      let songTime = elapsed * speed;
      const duration = tabDurationRef.current;

      // Check for loop end (if looping is enabled)
      if (loopConfig && songTime >= loopConfig.endSec) {
        // Reset to loop start
        const audioTime = audioInputRef.current.getCurrentTime();
        const loopStartOffset = loopConfig.startSec / speed;
        playStartTimeRef.current = audioTime - loopStartOffset;
        songTime = loopConfig.startSec;

        // Reset scoring state for new loop iteration
        scoreStateRef.current = INITIAL_SCORE_STATE;
        hitNotesRef.current = new Set();
        noteResultsRef.current = new Map();
        hitTimestampsRef.current = new Map();
        lastOnsetRef.current = null;
        loopCountRef.current += 1;

        setState((s) => ({
          ...s,
          currentTimeSec: songTime,
          scoreState: INITIAL_SCORE_STATE,
          loopCount: loopCountRef.current,
          lastHitResult: null,
        }));

        rafIdRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      // Check for song end (no loop or past loop bounds)
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

        // Use pitch from the onset event (captured at exact onset time)
        const detectedMidi = currentOnset.midi;

        if (detectedMidi !== null) {
          // Convert onset timestamp (audio context time) to song time
          // onset.timestampSec is in audio context time, we need to convert to song time
          const onsetElapsed = currentOnset.timestampSec - playStartTimeRef.current;
          const onsetSongTime = onsetElapsed * speed;

          // Find notes that haven't been hit yet
          const pendingNotes = allNotesRef.current.filter(
            (n) => !hitNotesRef.current.has(getNoteKey(n))
          );

          // Find matching notes using the ONSET time, not current time
          const matches = findMatchingNotes(
            detectedMidi,
            onsetSongTime,
            pendingNotes,
            DEFAULT_TIMING_TOLERANCES
          );

          // Process matches (best match first based on timing)
          for (const match of matches) {
            const noteKey = getNoteKey(match.note);
            if (!hitNotesRef.current.has(noteKey)) {
              hitNotesRef.current.add(noteKey);
              noteResultsRef.current.set(noteKey, match.result);
              hitTimestampsRef.current.set(noteKey, onsetSongTime); // Store hit time for animation
              scoreStateRef.current = applyHitResult(scoreStateRef.current, match.result);
              lastHitResult = match.result;

              // Emit play event for session recording
              if (onPlayEventRef.current) {
                onPlayEventRef.current(
                  createHitEvent(match.note, match.result, match.offsetMs, detectedMidi, onsetSongTime)
                );
              }
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

        // Emit play event for session recording
        if (onPlayEventRef.current) {
          onPlayEventRef.current(createMissEvent(note, songTime));
        }
      }

      // Get visible notes with hit results and timestamps applied
      const lookAhead = lookAheadRef.current;
      const visibleNotes = getVisibleNotes(
        allNotesRef.current,
        songTime,
        lookAhead / speed, // Adjust look-ahead by speed
        LOOK_BEHIND_SEC
      ).map((note) => {
        const noteKey = getNoteKey(note);
        const hitResult = noteResultsRef.current.get(noteKey);
        const hitTimestampSec = hitTimestampsRef.current.get(noteKey);
        if (hitResult) {
          return { ...note, hitResult, hitTimestampSec };
        }
        return note;
      });

      // Calculate time since last onset for visual feedback
      const audioTime = audioInputRef.current.getCurrentTime();
      const lastOnset = lastOnsetRef.current;
      const timeSinceLastOnsetSec = lastOnset
        ? audioTime - lastOnset.timestampSec
        : null;

      setState((s) => ({
        ...s,
        currentTimeSec: songTime,
        visibleNotes,
        scoreState: scoreStateRef.current,
        lastHitResult: lastHitResult ?? s.lastHitResult,
        timeSinceLastOnsetSec,
        lastOnsetMidi: lastOnset?.midi ?? null,
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
    hitTimestampsRef.current = new Map();
    lastOnsetRef.current = null;
    loopCountRef.current = 0;

    // If loop is active, start at loop start time
    const loopConfig = loopConfigRef.current;
    const startTime = loopConfig ? loopConfig.startSec : 0;

    setState({
      gameState: 'countdown',
      currentTimeSec: startTime,
      countdownValue: COUNTDOWN_BEATS,
      beatActive: false,
      speed: speedRef.current,
      lookAheadSec: lookAheadRef.current,
      visibleNotes: [],
      duration: tabDurationRef.current,
      scoreState: INITIAL_SCORE_STATE,
      lastHitResult: null,
      loopConfig: loopConfigRef.current,
      loopCount: 0,
      timeSinceLastOnsetSec: null,
      lastOnsetMidi: null,
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
    hitTimestampsRef.current = new Map();
    lastOnsetRef.current = null;
    loopCountRef.current = 0;

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
      loopConfig: loopConfigRef.current,
      loopCount: 0,
      timeSinceLastOnsetSec: null,
      lastOnsetMidi: null,
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

  /**
   * Set loop section for practice mode.
   * Pass null to disable looping.
   */
  const setLoopSection = useCallback(
    (sectionId: string | null) => {
      if (sectionId === null) {
        loopConfigRef.current = null;
        loopCountRef.current = 0;
        setState((s) => ({ ...s, loopConfig: null, loopCount: 0 }));
        return;
      }

      const section = tab.sections.find((s) => s.id === sectionId);
      const bounds = getSectionTimeBounds(tab, sectionId);
      if (!section || !bounds) {
        console.warn(`Section not found or empty: ${sectionId}`);
        return;
      }

      const newLoopConfig: LoopConfig = {
        sectionId,
        sectionName: section.name,
        startSec: bounds.startSec,
        endSec: bounds.endSec,
      };

      loopConfigRef.current = newLoopConfig;
      loopCountRef.current = 0;
      setState((s) => ({ ...s, loopConfig: newLoopConfig, loopCount: 0 }));
    },
    [tab]
  );

  // Extract section info for UI
  const sections = useMemo(
    () => tab.sections.map((s) => ({ id: s.id, name: s.name })),
    [tab]
  );

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
    setLoopSection,
    sections,
    isAudioRunning: audioInput.isRunning,
    startAudio: audioInput.start,
    getCurrentTime: audioInput.getCurrentTime,
    currentPitch: audioInput.currentPitch
      ? { midi: audioInput.currentPitch.midi, clarity: audioInput.currentPitch.clarity }
      : null,
  };
}
