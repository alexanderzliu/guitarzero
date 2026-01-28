import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Tab, GameState, ScoreResult, MidiNote, LoopConfig, OnsetEvent, PitchDetectionResult } from '../types';
import { useAudioInput } from './useAudioInput';
import {
  prepareRenderNotes,
  getVisibleNotes,
  getTabDuration,
  getBpmAtTick,
  type RenderNote,
} from '../lib/tabs/tempoUtils';
import type { ScoreState } from '../lib/scoring';
import type { PlayEventRecord } from '../lib/session';
import { createCountdownClock, getSongTimeSec, getPlayStartTimeForSongTime, applyPauseToPlayStart, isActiveGameplayState } from './gameEngine/clock';
import { buildLoopConfig, computeLoopRestart, getLoopStartSec, shouldRestartLoop } from './gameEngine/looping';
import { drainDetectedOnsets, getOnsetFeedback } from './gameEngine/onsetIntake';
import { createScoringEngine } from './gameEngine/scoringEngine';

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
  // Scoring state
  scoreState: ScoreState;
  lastHitResult: ScoreResult | null; // For UI feedback
  lastScoringMidi: MidiNote | null; // Pitch actually used for the last onset scoring attempt
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
  duration: number; // Total song duration in seconds

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

interface GameEngineUiState {
  gameState: GameState;
  currentTimeSec: number;
  countdownValue: number;
  beatActive: boolean;
  speed: number;
  lookAheadSec: number;
  visibleNotes: RenderNote[];
  loopConfig: LoopConfig | null;
  timeSinceLastOnsetSec: number | null;
  lastOnsetMidi: number | null;
  lastScoringMidi: MidiNote | null;
}

export function useGameEngine(config: GameEngineConfig): UseGameEngineReturn {
  const { tab, initialSpeed = DEFAULT_SPEED, initialLookAhead = DEFAULT_LOOK_AHEAD_SEC, onPlayEvent } = config;

  // Audio input for timing
  const audioInput = useAudioInput();

  // Pre-compute all render notes once (useMemo for synchronous availability)
  const allNotes = useMemo(() => prepareRenderNotes(tab), [tab]);
  const tabDuration = useMemo(() => getTabDuration(tab), [tab]);

  // Minimal UI-facing state (everything else stays in refs/engines)
  const [ui, setUi] = useState<GameEngineUiState>(() => ({
    gameState: 'idle',
    currentTimeSec: 0,
    countdownValue: COUNTDOWN_BEATS,
    beatActive: false,
    speed: initialSpeed,
    lookAheadSec: initialLookAhead,
    visibleNotes: [],
    loopConfig: null,
    timeSinceLastOnsetSec: null,
    lastOnsetMidi: null,
    lastScoringMidi: null,
  }));

  // Refs for RAF loop (avoid stale closures)
  const gameStateRef = useRef<GameState>('idle');
  const playStartTimeRef = useRef<number>(0);
  const pausedAtTimeRef = useRef<number>(0);
  const pausedFromCountdownRef = useRef<boolean>(false);
  const speedRef = useRef<number>(initialSpeed);
  const lookAheadRef = useRef<number>(initialLookAhead);
  const rafIdRef = useRef<number>(0);
  const gameLoopRef = useRef<() => void>(() => {});
  const loopConfigRef = useRef<LoopConfig | null>(null);
  const loopCountRef = useRef<number>(0);

  const scheduleNextFrame = useCallback(() => {
    rafIdRef.current = requestAnimationFrame(() => gameLoopRef.current());
  }, []);

  // Scoring engine (kept in a ref so it stays mutable and stable)
  const scoringEngineRef = useRef(createScoringEngine());

  // Onset intake refs
  const lastOnsetRef = useRef<OnsetEvent | null>(null);
  const pendingOnsetsRef = useRef<OnsetEvent[]>([]);
  const pitchHistoryRef = useRef<PitchDetectionResult[]>([]);
  const lastPitchTimestampRef = useRef<number>(-Infinity);

  // Refs for memoized values (to use in RAF loop)
  const allNotesRef = useRef(allNotes);
  const tabDurationRef = useRef(tabDuration);
  useEffect(() => {
    allNotesRef.current = allNotes;
    tabDurationRef.current = tabDuration;
  }, [allNotes, tabDuration]);

  // BPM for countdown timing
  const countdownBpm = getBpmAtTick(0, tab.tempoMap);
  const countdownClock = useMemo(
    () => createCountdownClock(countdownBpm, COUNTDOWN_BEATS),
    [countdownBpm]
  );

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
    const elapsedSec = audioTime - playStartTimeRef.current;

    // Track recent pitch samples so we can resolve "pitch at onset" using a sample *after* the attack.
    const currentPitch = audioInputRef.current.currentPitch;
    if (currentPitch && currentPitch.timestampSec > lastPitchTimestampRef.current) {
      pitchHistoryRef.current.push(currentPitch);
      lastPitchTimestampRef.current = currentPitch.timestampSec;
      if (pitchHistoryRef.current.length > 120) {
        pitchHistoryRef.current.splice(0, pitchHistoryRef.current.length - 120);
      }
    }

    if (gameStateRef.current === 'countdown') {
      // Discard any onset events during countdown so they don't get processed when play starts.
      audioInputRef.current.drainOnsets();
      pendingOnsetsRef.current = [];

      const frame = countdownClock.getFrame(elapsedSec);
      if (frame.isDone) {
        // Countdown finished, start playing
        gameStateRef.current = 'playing';
        const speed = speedRef.current;
        const loopStartSec = getLoopStartSec(loopConfigRef.current);
        playStartTimeRef.current = getPlayStartTimeForSongTime(audioTime, loopStartSec, speed);

        setUi((s) => ({
          ...s,
          gameState: 'playing',
          countdownValue: 0,
          beatActive: false,
          currentTimeSec: loopStartSec,
        }));
      } else {
        setUi((s) => ({ ...s, countdownValue: frame.countdownValue, beatActive: frame.beatActive }));
      }

      scheduleNextFrame();
      return;
    }

    if (gameStateRef.current === 'playing') {
      const speed = speedRef.current;
      const loopConfig = loopConfigRef.current;
      let songTimeSec = getSongTimeSec(audioTime, playStartTimeRef.current, speed);
      const duration = tabDurationRef.current;

      // Check for loop end (if looping is enabled)
      if (loopConfig && shouldRestartLoop(loopConfig, songTimeSec)) {
        // Discard any queued onsets so they don't "spill" into the loop restart.
        audioInputRef.current.drainOnsets();

        const restart = computeLoopRestart({
          audioTimeSec: audioInputRef.current.getCurrentTime(),
          loopConfig,
          speed,
        });
        playStartTimeRef.current = restart.playStartTimeSec;
        songTimeSec = restart.songTimeSec;

        // Reset scoring + feedback for new loop iteration
        scoringEngineRef.current.reset();
        lastOnsetRef.current = null;
        loopCountRef.current += 1;

        setUi((s) => ({
          ...s,
          currentTimeSec: songTimeSec,
          visibleNotes: [],
          timeSinceLastOnsetSec: null,
          lastOnsetMidi: null,
        }));

        scheduleNextFrame();
        return;
      }

      // Check for song end (no loop or past loop bounds)
      if (songTimeSec >= duration) {
        gameStateRef.current = 'finished';
        setUi((s) => ({
          ...s,
          gameState: 'finished',
          currentTimeSec: duration,
          visibleNotes: [],
        }));
        return; // Stop the loop
      }

      const detectedOnsets = drainDetectedOnsets({
        audioInput: audioInputRef.current,
        playStartTimeSec: playStartTimeRef.current,
        speed,
        inputOffsetSec: audioInputRef.current.inputOffsetSec ?? 0,
        recentPitches: pitchHistoryRef.current,
        pendingOnsetsRef,
        lastOnsetRef,
      });

      // Get visible notes with hit results and timestamps applied
      const lookAhead = lookAheadRef.current;
      const baseVisibleNotes = getVisibleNotes(
        allNotesRef.current,
        songTimeSec,
        lookAhead / speed, // Adjust look-ahead by speed
        LOOK_BEHIND_SEC
      );

      // Process scoring after we have the song clock (uses onset song times, not frame time)
      scoringEngineRef.current.processDetectedOnsets({
        detectedOnsets,
        allNotes: allNotesRef.current,
        onPlayEvent: onPlayEventRef.current,
      });
      scoringEngineRef.current.processMisses({
        songTimeSec,
        allNotes: allNotesRef.current,
        onPlayEvent: onPlayEventRef.current,
      });

      const visibleNotes = scoringEngineRef.current.annotateVisibleNotes(baseVisibleNotes);
      const onsetFeedback = getOnsetFeedback({ audioTimeSec: audioTime, lastOnsetRef });

      setUi((s) => ({
        ...s,
        currentTimeSec: songTimeSec,
        visibleNotes,
        timeSinceLastOnsetSec: onsetFeedback.timeSinceLastOnsetSec,
        lastOnsetMidi: onsetFeedback.lastOnsetMidi,
        lastScoringMidi:
          detectedOnsets.length > 0 ? detectedOnsets[detectedOnsets.length - 1].detectedMidi : s.lastScoringMidi,
      }));

      scheduleNextFrame();
    }
  }, [countdownClock, scheduleNextFrame]);

  useEffect(() => {
    gameLoopRef.current = gameLoop;
  }, [gameLoop]);

  /**
   * Start the game (begins countdown)
   */
  const start = useCallback(() => {
    if (!audioInputRef.current.isRunning) {
      console.warn('Audio must be running to start game');
      return;
    }

    // Drop any queued onsets from idle so they don't count when starting.
    audioInputRef.current.drainOnsets();
    pendingOnsetsRef.current = [];
    pitchHistoryRef.current = [];
    lastPitchTimestampRef.current = -Infinity;

    // Reset state
    gameStateRef.current = 'countdown';
    playStartTimeRef.current = audioInputRef.current.getCurrentTime();

    // Reset scoring + feedback
    scoringEngineRef.current.reset();
    lastOnsetRef.current = null;
    loopCountRef.current = 0;

    // If loop is active, start at loop start time
    const startTime = getLoopStartSec(loopConfigRef.current);

    setUi({
      gameState: 'countdown',
      currentTimeSec: startTime,
      countdownValue: COUNTDOWN_BEATS,
      beatActive: false,
      speed: speedRef.current,
      lookAheadSec: lookAheadRef.current,
      visibleNotes: [],
      loopConfig: loopConfigRef.current,
      timeSinceLastOnsetSec: null,
      lastOnsetMidi: null,
      lastScoringMidi: null,
    });

    // Start game loop
    scheduleNextFrame();
  }, [scheduleNextFrame]);

  /**
   * Pause the game (works during playing or countdown)
   */
  const pause = useCallback(() => {
    if (!isActiveGameplayState(gameStateRef.current)) return;

    pausedFromCountdownRef.current = gameStateRef.current === 'countdown';
    gameStateRef.current = 'paused';
    pausedAtTimeRef.current = audioInputRef.current.getCurrentTime();
    cancelAnimationFrame(rafIdRef.current);
    audioInputRef.current.drainOnsets();
    pendingOnsetsRef.current = [];
    lastOnsetRef.current = null;

    setUi((s) => ({
      ...s,
      gameState: 'paused',
    }));
  }, []);

  /**
   * Resume from pause
   */
  const resume = useCallback(() => {
    if (gameStateRef.current !== 'paused') return;

    // Ignore onsets that occurred while paused.
    audioInputRef.current.drainOnsets();
    pendingOnsetsRef.current = [];
    lastOnsetRef.current = null;

    // Adjust start time to account for pause duration
    const resumeAtTimeSec = audioInputRef.current.getCurrentTime();
    playStartTimeRef.current = applyPauseToPlayStart(playStartTimeRef.current, pausedAtTimeRef.current, resumeAtTimeSec);

    const resumeToCountdown = pausedFromCountdownRef.current;
    gameStateRef.current = resumeToCountdown ? 'countdown' : 'playing';

    setUi((s) => ({
      ...s,
      gameState: resumeToCountdown ? 'countdown' : 'playing',
    }));

    // Resume game loop
    scheduleNextFrame();
  }, [scheduleNextFrame]);

  /**
   * Stop and reset to beginning
   */
  const stop = useCallback(() => {
    cancelAnimationFrame(rafIdRef.current);
    gameStateRef.current = 'idle';
    audioInputRef.current.drainOnsets();
    pendingOnsetsRef.current = [];

    // Reset scoring + feedback
    scoringEngineRef.current.reset();
    lastOnsetRef.current = null;
    loopCountRef.current = 0;

    setUi({
      gameState: 'idle',
      currentTimeSec: 0,
      countdownValue: COUNTDOWN_BEATS,
      beatActive: false,
      speed: speedRef.current,
      lookAheadSec: lookAheadRef.current,
      visibleNotes: [],
      loopConfig: loopConfigRef.current,
      timeSinceLastOnsetSec: null,
      lastOnsetMidi: null,
      lastScoringMidi: null,
    });
  }, []);

  /**
   * Set playback speed
   */
  const setSpeed = useCallback((speed: number) => {
    const clampedSpeed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, speed));
    speedRef.current = clampedSpeed;
    setUi((s) => ({ ...s, speed: clampedSpeed }));
  }, []);

  /**
   * Set look-ahead time
   */
  const setLookAhead = useCallback((sec: number) => {
    const clampedSec = Math.max(MIN_LOOK_AHEAD_SEC, Math.min(MAX_LOOK_AHEAD_SEC, sec));
    lookAheadRef.current = clampedSec;
    setUi((s) => ({ ...s, lookAheadSec: clampedSec }));
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
        setUi((s) => ({ ...s, loopConfig: null }));
        return;
      }

      const newLoopConfig = buildLoopConfig(tab, sectionId);
      if (!newLoopConfig) {
        console.warn(`Section not found or empty: ${sectionId}`);
        return;
      }

      loopConfigRef.current = newLoopConfig;
      loopCountRef.current = 0;
      setUi((s) => ({ ...s, loopConfig: newLoopConfig }));
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
    ...ui,
    allNotes,
    duration: tabDuration,
    scoreState: scoringEngineRef.current.getScoreState(),
    lastHitResult: scoringEngineRef.current.getLastHitResult(),
    loopCount: loopCountRef.current,
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
