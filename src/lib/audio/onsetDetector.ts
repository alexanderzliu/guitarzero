/**
 * Onset detection for identifying note attacks
 * Uses energy-based detection with adaptive thresholding
 */

export interface OnsetDetectorConfig {
  thresholdDb: number; // Minimum level to trigger onset (-40 dB typical)
  riseThresholdDb: number; // dB increase required to detect onset (6 dB typical)
  debounceMs: number; // Minimum time between onsets (50ms typical)
  sampleRate: number;
  hopSamples: number;
}

export class OnsetDetector {
  private readonly config: OnsetDetectorConfig;
  private readonly hopDurationSec: number;

  private lastRmsDb: number = -Infinity;
  private lastOnsetTimeSec: number = -Infinity;
  private currentTimeSec: number = 0;

  constructor(config: OnsetDetectorConfig) {
    this.config = config;
    this.hopDurationSec = config.hopSamples / config.sampleRate;
  }

  /**
   * Process a frame and check for onset
   * @param rmsDb Current frame RMS in dB
   * @returns true if onset detected
   */
  process(rmsDb: number): boolean {
    const timeSinceLastOnset = this.currentTimeSec - this.lastOnsetTimeSec;
    const debounceTimeSec = this.config.debounceMs / 1000;

    // Check conditions for onset:
    // 1. Level is above absolute threshold
    // 2. Level rose significantly from previous frame
    // 3. Enough time has passed since last onset (debounce)
    const isAboveThreshold = rmsDb > this.config.thresholdDb;
    const isRising = rmsDb - this.lastRmsDb > this.config.riseThresholdDb;
    const isDebounced = timeSinceLastOnset > debounceTimeSec;

    const isOnset = isAboveThreshold && isRising && isDebounced;

    // Update state
    this.lastRmsDb = rmsDb;
    this.currentTimeSec += this.hopDurationSec;

    if (isOnset) {
      this.lastOnsetTimeSec = this.currentTimeSec;
    }

    return isOnset;
  }

  /**
   * Set the current time (sync with audio context)
   */
  setCurrentTime(timeSec: number): void {
    this.currentTimeSec = timeSec;
  }

  /**
   * Get time since last onset in seconds
   */
  getTimeSinceLastOnset(): number {
    return this.currentTimeSec - this.lastOnsetTimeSec;
  }

  /**
   * Reset detector state
   */
  reset(): void {
    this.lastRmsDb = -Infinity;
    this.lastOnsetTimeSec = -Infinity;
    this.currentTimeSec = 0;
  }
}

/**
 * Calculate RMS (Root Mean Square) of audio buffer
 */
export function calculateRms(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

/**
 * Convert linear amplitude to decibels
 */
export function linearToDb(linear: number): number {
  if (linear <= 0) return -Infinity;
  return 20 * Math.log10(linear);
}

/**
 * Convert decibels to linear amplitude
 */
export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Calculate peak amplitude in dB
 */
export function calculatePeakDb(buffer: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < buffer.length; i++) {
    const abs = Math.abs(buffer[i]);
    if (abs > peak) peak = abs;
  }
  return linearToDb(peak);
}
