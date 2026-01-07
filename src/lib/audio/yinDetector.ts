/**
 * YIN pitch detection algorithm implementation
 * Based on: "YIN, a fundamental frequency estimator for speech and music"
 * by Alain de Cheveigné and Hideki Kawahara
 *
 * This implementation is designed to run in an AudioWorklet
 */

export interface YinResult {
  frequency: number | null; // null if no pitch detected
  clarity: number; // 0-1, lower is better for YIN (inverted for API)
}

/**
 * YIN pitch detector class
 * Reuses buffers for efficiency in real-time processing
 */
export class YinDetector {
  private readonly sampleRate: number;
  private readonly threshold: number;
  private readonly minFrequency: number;
  private readonly maxFrequency: number;

  // Pre-allocated buffers
  private readonly yinBuffer: Float32Array;

  constructor(
    bufferSize: number,
    sampleRate: number,
    threshold = 0.15,
    minFrequency = 60, // D2 is ~73Hz, allow some margin
    maxFrequency = 1500 // Well above high E string
  ) {
    this.sampleRate = sampleRate;
    this.threshold = threshold;
    this.minFrequency = minFrequency;
    this.maxFrequency = maxFrequency;

    // YIN uses half the buffer size
    this.yinBuffer = new Float32Array(Math.floor(bufferSize / 2));
  }

  /**
   * Detect pitch from audio buffer
   */
  detect(audioBuffer: Float32Array): YinResult {
    const halfBufferSize = this.yinBuffer.length;

    // Calculate min/max tau from frequency bounds
    const minTau = Math.floor(this.sampleRate / this.maxFrequency);
    const maxTau = Math.min(halfBufferSize - 1, Math.floor(this.sampleRate / this.minFrequency));

    // Step 1 & 2: Difference function and cumulative mean normalized difference
    this.differenceFunction(audioBuffer, halfBufferSize);
    this.cumulativeMeanNormalizedDifference(halfBufferSize);

    // Step 3: Absolute threshold
    const tau = this.absoluteThreshold(minTau, maxTau);

    if (tau === -1) {
      return { frequency: null, clarity: 0 };
    }

    // Step 4: Parabolic interpolation for sub-sample accuracy
    const betterTau = this.parabolicInterpolation(tau);

    // Calculate frequency
    const frequency = this.sampleRate / betterTau;

    // Clarity is 1 - d'(tau), so lower YIN value = higher clarity
    const clarity = 1 - this.yinBuffer[tau];

    return { frequency, clarity };
  }

  /**
   * Step 1 & 2 combined: Compute the difference function
   */
  private differenceFunction(audioBuffer: Float32Array, halfBufferSize: number): void {
    for (let tau = 0; tau < halfBufferSize; tau++) {
      let sum = 0;
      for (let i = 0; i < halfBufferSize; i++) {
        const delta = audioBuffer[i] - audioBuffer[i + tau];
        sum += delta * delta;
      }
      this.yinBuffer[tau] = sum;
    }
  }

  /**
   * Step 2: Cumulative mean normalized difference function
   */
  private cumulativeMeanNormalizedDifference(halfBufferSize: number): void {
    this.yinBuffer[0] = 1;
    let runningSum = 0;

    for (let tau = 1; tau < halfBufferSize; tau++) {
      runningSum += this.yinBuffer[tau];
      this.yinBuffer[tau] = (this.yinBuffer[tau] * tau) / runningSum;
    }
  }

  /**
   * Step 3: Find the first tau below threshold after a local minimum
   */
  private absoluteThreshold(minTau: number, maxTau: number): number {
    // Find first value below threshold
    for (let tau = minTau; tau < maxTau; tau++) {
      if (this.yinBuffer[tau] < this.threshold) {
        // Look for local minimum
        while (tau + 1 < maxTau && this.yinBuffer[tau + 1] < this.yinBuffer[tau]) {
          tau++;
        }
        return tau;
      }
    }

    // No pitch found below threshold - return the global minimum as fallback
    let minTauValue = minTau;
    let minValue = this.yinBuffer[minTau];

    for (let tau = minTau + 1; tau < maxTau; tau++) {
      if (this.yinBuffer[tau] < minValue) {
        minValue = this.yinBuffer[tau];
        minTauValue = tau;
      }
    }

    // Only return if it's reasonably good
    if (minValue < this.threshold * 2) {
      return minTauValue;
    }

    return -1;
  }

  /**
   * Step 4: Parabolic interpolation for better precision
   */
  private parabolicInterpolation(tau: number): number {
    if (tau === 0 || tau >= this.yinBuffer.length - 1) {
      return tau;
    }

    const s0 = this.yinBuffer[tau - 1];
    const s1 = this.yinBuffer[tau];
    const s2 = this.yinBuffer[tau + 1];

    // Parabolic interpolation formula
    const adjustment = (s2 - s0) / (2 * (2 * s1 - s2 - s0));

    if (isFinite(adjustment)) {
      return tau + adjustment;
    }

    return tau;
  }
}
