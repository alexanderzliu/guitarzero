/**
 * Ring buffer for accumulating audio samples in the AudioWorklet
 * Supports overlapping frame analysis with configurable window and hop sizes
 */
export class RingBuffer {
  private buffer: Float32Array;
  private writeIndex: number = 0;
  private samplesWritten: number = 0;
  private readonly windowSize: number;
  private readonly hopSize: number;
  private lastAnalysisIndex: number = 0;

  constructor(windowSize: number, hopSize: number) {
    this.windowSize = windowSize;
    this.hopSize = hopSize;
    // Buffer needs to hold at least 2x window size for safe reading
    this.buffer = new Float32Array(windowSize * 2);
  }

  /**
   * Write samples to the ring buffer
   */
  write(samples: Float32Array): void {
    for (let i = 0; i < samples.length; i++) {
      this.buffer[this.writeIndex] = samples[i];
      this.writeIndex = (this.writeIndex + 1) % this.buffer.length;
      this.samplesWritten++;
    }
  }

  /**
   * Check if a new analysis frame is ready (based on hop size)
   */
  isFrameReady(): boolean {
    return this.samplesWritten - this.lastAnalysisIndex >= this.hopSize;
  }

  /**
   * Get the current analysis window (copies data to output array)
   * Call only when isFrameReady() returns true
   */
  getFrame(output: Float32Array): void {
    if (output.length !== this.windowSize) {
      throw new Error(`Output array must be ${this.windowSize} samples`);
    }

    // Calculate read position (windowSize samples before current write position)
    let readIndex =
      (this.writeIndex - this.windowSize + this.buffer.length) % this.buffer.length;

    for (let i = 0; i < this.windowSize; i++) {
      output[i] = this.buffer[readIndex];
      readIndex = (readIndex + 1) % this.buffer.length;
    }

    this.lastAnalysisIndex = this.samplesWritten;
  }

  /**
   * Get number of samples written since last reset
   */
  getSamplesWritten(): number {
    return this.samplesWritten;
  }

  /**
   * Reset the buffer state
   */
  reset(): void {
    this.buffer.fill(0);
    this.writeIndex = 0;
    this.samplesWritten = 0;
    this.lastAnalysisIndex = 0;
  }
}
