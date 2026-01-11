import { useState, useCallback, useRef, useEffect } from 'react';
import { useAudioInput } from './useAudioInput';
import { saveCalibration, loadCalibration } from '../lib/storage/calibrationStorage';

// ============================================================================
// Calibration Hook - State machine for latency calibration flow
// ============================================================================

const CALIBRATION_BPM = 90;
const BEAT_INTERVAL_SEC = 60 / CALIBRATION_BPM; // ~0.667 seconds
const REQUIRED_SAMPLES = 8;
const COUNTDOWN_BEATS = 3;
const ONSET_MATCH_WINDOW_SEC = 0.4; // Tolerance for matching onset to expected beat

export type CalibrationPhase =
  | 'idle'
  | 'countdown'
  | 'listening'
  | 'processing'
  | 'results'
  | 'error';

export interface CalibrationState {
  phase: CalibrationPhase;
  countdownValue: number; // 3, 2, 1
  currentBeat: number; // 0-7 during listening
  beatActive: boolean; // true when visual flash should show
  collectedSamples: number;
  calculatedOffsetSec: number | null;
  manualAdjustmentSec: number;
  error: string | null;
}

export interface UseCalibrationReturn extends CalibrationState {
  // Audio state passthrough
  isAudioRunning: boolean;
  isAudioStarting: boolean;
  audioError: string | null;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string | null;

  // Actions
  startAudio: () => Promise<void>;
  stopAudio: () => void;
  selectDevice: (deviceId: string | null) => void;
  startCalibration: () => void;
  cancelCalibration: () => void;
  setManualAdjustment: (offsetSec: number) => void;
  saveAndFinish: () => void;
  getFinalOffset: () => number;
}

/**
 * Calculate median of an array of numbers
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function useCalibration(): UseCalibrationReturn {
  const audioInput = useAudioInput();

  const [state, setState] = useState<CalibrationState>({
    phase: 'idle',
    countdownValue: COUNTDOWN_BEATS,
    currentBeat: 0,
    beatActive: false,
    collectedSamples: 0,
    calculatedOffsetSec: null,
    manualAdjustmentSec: 0,
    error: null,
  });

  // Refs for timing - these avoid stale closure issues in animation loop
  const expectedBeatTimesRef = useRef<number[]>([]);
  const detectedOnsetsRef = useRef<number[]>([]);
  const calibrationStartTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const lastProcessedOnsetRef = useRef<number>(0);

  // Ref for audioInput to avoid stale closures in animation loop
  const audioInputRef = useRef(audioInput);
  useEffect(() => {
    audioInputRef.current = audioInput;
  }, [audioInput]);

  // Ref for current phase to check in onset effect without race conditions
  const phaseRef = useRef<CalibrationPhase>('idle');

  // Track onset events during calibration
  useEffect(() => {
    // Use ref to avoid race condition with phase state updates
    if (phaseRef.current !== 'listening') return;

    const onset = audioInput.lastOnset;
    if (!onset) return;

    // Avoid processing the same onset twice
    if (onset.timestampSec <= lastProcessedOnsetRef.current) return;
    lastProcessedOnsetRef.current = onset.timestampSec;

    // Only accept onsets that are reasonably close to an expected beat
    const isNearExpectedBeat = expectedBeatTimesRef.current.some(
      (expectedTime) => Math.abs(onset.timestampSec - expectedTime) < ONSET_MATCH_WINDOW_SEC
    );

    if (isNearExpectedBeat && detectedOnsetsRef.current.length < REQUIRED_SAMPLES) {
      detectedOnsetsRef.current.push(onset.timestampSec);
      setState((s) => ({ ...s, collectedSamples: detectedOnsetsRef.current.length }));
    }
  }, [audioInput.lastOnset]);

  /**
   * Process collected samples and calculate offset
   */
  const processResults = useCallback(() => {
    setState((s) => ({ ...s, phase: 'processing' }));
    phaseRef.current = 'processing';

    const detected = detectedOnsetsRef.current;
    const expected = expectedBeatTimesRef.current;

    if (detected.length < 3) {
      setState((s) => ({
        ...s,
        phase: 'error',
        error: `Not enough strums detected (${detected.length}/${REQUIRED_SAMPLES}). Please try again and strum clearly on each flash.`,
      }));
      phaseRef.current = 'error';
      return;
    }

    // Match each detected onset to nearest expected beat
    const offsets: number[] = [];
    const usedExpected = new Set<number>();

    for (const detectedTime of detected) {
      let bestMatch = -1;
      let bestDiff = Infinity;

      for (let i = 0; i < expected.length; i++) {
        if (usedExpected.has(i)) continue;
        const diff = Math.abs(detectedTime - expected[i]);
        if (diff < bestDiff && diff < 0.4) {
          bestDiff = diff;
          bestMatch = i;
        }
      }

      if (bestMatch >= 0) {
        usedExpected.add(bestMatch);
        // Offset = detected - expected (positive = detected late = input lag)
        offsets.push(detectedTime - expected[bestMatch]);
      }
    }

    if (offsets.length < 3) {
      setState((s) => ({
        ...s,
        phase: 'error',
        error: 'Could not match enough strums to beats. Please try again.',
      }));
      phaseRef.current = 'error';
      return;
    }

    const medianOffset = median(offsets);

    setState((s) => ({
      ...s,
      phase: 'results',
      calculatedOffsetSec: medianOffset,
      collectedSamples: offsets.length,
    }));
    phaseRef.current = 'results';
  }, []);

  /**
   * Main calibration loop using requestAnimationFrame
   * Uses refs to avoid stale closure issues
   */
  const runCalibrationLoop = useCallback(() => {
    // Use ref to get latest audioInput values
    const currentTime = audioInputRef.current.getCurrentTime();
    const elapsed = currentTime - calibrationStartTimeRef.current;

    // Countdown phase
    const countdownDuration = COUNTDOWN_BEATS * BEAT_INTERVAL_SEC;
    if (elapsed < countdownDuration) {
      const countdownBeat = Math.floor(elapsed / BEAT_INTERVAL_SEC);
      const beatProgress = (elapsed % BEAT_INTERVAL_SEC) / BEAT_INTERVAL_SEC;
      const beatActive = beatProgress < 0.15; // Flash for 15% of beat duration
      // Ensure countdown shows 3, 2, 1 (not 0)
      const countdownValue = Math.max(1, COUNTDOWN_BEATS - countdownBeat);

      setState((s) => ({
        ...s,
        phase: 'countdown',
        countdownValue,
        beatActive,
      }));
      phaseRef.current = 'countdown';

      animationFrameRef.current = requestAnimationFrame(runCalibrationLoop);
      return;
    }

    // Listening phase
    const listeningElapsed = elapsed - countdownDuration;
    const listeningDuration = REQUIRED_SAMPLES * BEAT_INTERVAL_SEC;

    if (listeningElapsed < listeningDuration) {
      const currentBeat = Math.floor(listeningElapsed / BEAT_INTERVAL_SEC);
      const beatProgress = (listeningElapsed % BEAT_INTERVAL_SEC) / BEAT_INTERVAL_SEC;
      const beatActive = beatProgress < 0.15;

      // Update phase ref BEFORE setState so onset effect can see it immediately
      phaseRef.current = 'listening';

      setState((s) => ({
        ...s,
        phase: 'listening',
        currentBeat,
        beatActive,
      }));

      animationFrameRef.current = requestAnimationFrame(runCalibrationLoop);
      return;
    }

    // Processing phase - calculate offset
    processResults();
  }, [processResults]);

  /**
   * Start the calibration process
   */
  const startCalibration = useCallback(() => {
    if (!audioInputRef.current.isRunning) {
      setState((s) => ({
        ...s,
        phase: 'error',
        error: 'Audio must be running to calibrate. Click "Start Audio" first.',
      }));
      phaseRef.current = 'error';
      return;
    }

    // Reset state
    detectedOnsetsRef.current = [];
    lastProcessedOnsetRef.current = 0;

    // Record start time and calculate expected beat times
    const startTime = audioInputRef.current.getCurrentTime();
    calibrationStartTimeRef.current = startTime;

    // Expected beats start after countdown
    const countdownDuration = COUNTDOWN_BEATS * BEAT_INTERVAL_SEC;
    expectedBeatTimesRef.current = Array.from(
      { length: REQUIRED_SAMPLES },
      (_, i) => startTime + countdownDuration + i * BEAT_INTERVAL_SEC
    );

    phaseRef.current = 'countdown';
    setState({
      phase: 'countdown',
      countdownValue: COUNTDOWN_BEATS,
      currentBeat: 0,
      beatActive: false,
      collectedSamples: 0,
      calculatedOffsetSec: null,
      manualAdjustmentSec: 0,
      error: null,
    });

    // Start the animation loop
    animationFrameRef.current = requestAnimationFrame(runCalibrationLoop);
  }, [runCalibrationLoop]);

  /**
   * Cancel calibration
   */
  const cancelCalibration = useCallback(() => {
    cancelAnimationFrame(animationFrameRef.current);
    phaseRef.current = 'idle';
    setState({
      phase: 'idle',
      countdownValue: COUNTDOWN_BEATS,
      currentBeat: 0,
      beatActive: false,
      collectedSamples: 0,
      calculatedOffsetSec: null,
      manualAdjustmentSec: 0,
      error: null,
    });
  }, []);

  /**
   * Set manual adjustment
   */
  const setManualAdjustment = useCallback((offsetSec: number) => {
    setState((s) => ({ ...s, manualAdjustmentSec: offsetSec }));
  }, []);

  /**
   * Get final offset (calculated + manual adjustment)
   */
  const getFinalOffset = useCallback(() => {
    return (state.calculatedOffsetSec ?? 0) + state.manualAdjustmentSec;
  }, [state.calculatedOffsetSec, state.manualAdjustmentSec]);

  /**
   * Save calibration and finish
   */
  const saveAndFinish = useCallback(() => {
    const finalOffset = getFinalOffset();
    saveCalibration(
      audioInputRef.current.selectedDeviceId,
      finalOffset,
      state.collectedSamples
    );

    cancelCalibration();
  }, [state.collectedSamples, getFinalOffset, cancelCalibration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Load existing calibration on device change
  useEffect(() => {
    const existing = loadCalibration(audioInput.selectedDeviceId);
    if (existing && state.phase === 'idle') {
      setState((s) => ({
        ...s,
        calculatedOffsetSec: existing.offsetSec,
      }));
    }
  }, [audioInput.selectedDeviceId, state.phase]);

  return {
    ...state,
    // Audio state passthrough
    isAudioRunning: audioInput.isRunning,
    isAudioStarting: audioInput.isStarting,
    audioError: audioInput.error,
    devices: audioInput.devices,
    selectedDeviceId: audioInput.selectedDeviceId,
    // Actions
    startAudio: audioInput.start,
    stopAudio: audioInput.stop,
    selectDevice: audioInput.selectDevice,
    startCalibration,
    cancelCalibration,
    setManualAdjustment,
    saveAndFinish,
    getFinalOffset,
  };
}
