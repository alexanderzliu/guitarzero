/**
 * AudioWorklet Processor for pitch detection
 * Runs in the audio thread for low-latency processing
 *
 * This file is loaded separately as a worklet module.
 * It includes inline implementations since worklets can't import from main bundle.
 *
 * DUPLICATION NOTICE
 * ==================
 * AudioWorklets run in a separate thread and cannot import from the main bundle.
 * This file contains duplicated implementations of:
 *
 * - RingBuffer       → sync with: src/lib/audio/ringBuffer.ts
 * - YinDetector      → sync with: src/lib/audio/yinDetector.ts
 * - calculateRms     → sync with: src/lib/audio/onsetDetector.ts
 * - linearToDb       → sync with: src/lib/audio/onsetDetector.ts
 * - hzToMidi         → sync with: src/lib/audio/midiUtils.ts
 *
 * WHEN MODIFYING: Update both locations to keep implementations in sync.
 */

// ============================================================================
// Inline Ring Buffer (can't import in worklet)
// ============================================================================
class RingBuffer {
  private buffer: Float32Array;
  private writeIndex = 0;
  private samplesWritten = 0;
  private readonly windowSize: number;
  private readonly hopSize: number;
  private lastAnalysisIndex = 0;

  constructor(windowSize: number, hopSize: number) {
    this.windowSize = windowSize;
    this.hopSize = hopSize;
    this.buffer = new Float32Array(windowSize * 2);
  }

  write(samples: Float32Array): void {
    for (let i = 0; i < samples.length; i++) {
      this.buffer[this.writeIndex] = samples[i];
      this.writeIndex = (this.writeIndex + 1) % this.buffer.length;
      this.samplesWritten++;
    }
  }

  isFrameReady(): boolean {
    return this.samplesWritten - this.lastAnalysisIndex >= this.hopSize;
  }

  getFrame(output: Float32Array): void {
    let readIndex =
      (this.writeIndex - this.windowSize + this.buffer.length) % this.buffer.length;
    for (let i = 0; i < this.windowSize; i++) {
      output[i] = this.buffer[readIndex];
      readIndex = (readIndex + 1) % this.buffer.length;
    }
    this.lastAnalysisIndex = this.samplesWritten;
  }
}

// ============================================================================
// Inline YIN Detector
// ============================================================================
class YinDetector {
  private readonly bufferSize: number;
  private readonly sampleRate: number;
  private readonly threshold: number;
  private readonly minTau: number;
  private readonly maxTau: number;
  private readonly yinBuffer: Float32Array;

  constructor(bufferSize: number, sampleRate: number, threshold = 0.15) {
    this.bufferSize = bufferSize;
    this.sampleRate = sampleRate;
    this.threshold = threshold;

    const halfSize = Math.floor(bufferSize / 2);
    this.yinBuffer = new Float32Array(halfSize);

    // Min/max tau from frequency bounds (60Hz - 1500Hz)
    this.minTau = Math.floor(sampleRate / 1500);
    this.maxTau = Math.min(halfSize - 1, Math.floor(sampleRate / 60));
  }

  detect(audioBuffer: Float32Array): { frequency: number | null; clarity: number } {
    const halfSize = this.yinBuffer.length;

    // Difference function
    for (let tau = 0; tau < halfSize; tau++) {
      let sum = 0;
      for (let i = 0; i < halfSize; i++) {
        const delta = audioBuffer[i] - audioBuffer[i + tau];
        sum += delta * delta;
      }
      this.yinBuffer[tau] = sum;
    }

    // Cumulative mean normalized difference
    this.yinBuffer[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < halfSize; tau++) {
      runningSum += this.yinBuffer[tau];
      this.yinBuffer[tau] = (this.yinBuffer[tau] * tau) / runningSum;
    }

    // Find threshold crossing
    let tau = -1;
    for (let t = this.minTau; t < this.maxTau; t++) {
      if (this.yinBuffer[t] < this.threshold) {
        while (t + 1 < this.maxTau && this.yinBuffer[t + 1] < this.yinBuffer[t]) {
          t++;
        }
        tau = t;
        break;
      }
    }

    if (tau === -1) {
      return { frequency: null, clarity: 0 };
    }

    // Parabolic interpolation
    let betterTau = tau;
    if (tau > 0 && tau < halfSize - 1) {
      const s0 = this.yinBuffer[tau - 1];
      const s1 = this.yinBuffer[tau];
      const s2 = this.yinBuffer[tau + 1];
      const adj = (s2 - s0) / (2 * (2 * s1 - s2 - s0));
      if (isFinite(adj)) betterTau = tau + adj;
    }

    const frequency = this.sampleRate / betterTau;
    const clarity = 1 - this.yinBuffer[tau];

    return { frequency, clarity };
  }
}

// ============================================================================
// Utility functions
// ============================================================================
function calculateRms(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

function linearToDb(linear: number): number {
  if (linear <= 0) return -100;
  return 20 * Math.log10(linear);
}

function hzToMidi(hz: number): number {
  if (hz <= 0) return 0;
  return 69 + 12 * Math.log2(hz / 440);
}

// ============================================================================
// Main Worklet Processor
// ============================================================================
interface ProcessorOptions {
  windowSize?: number;
  hopSize?: number;
  yinThreshold?: number;
  onsetThresholdDb?: number;
  debounceMs?: number;
}

class PitchDetectorProcessor extends AudioWorkletProcessor {
  private ringBuffer: RingBuffer;
  private yinDetector: YinDetector;
  private frameBuffer: Float32Array;

  private lastRmsDb = -100;
  private lastOnsetTime = -Infinity;
  private frameCount = 0;
  private messagesPerSecond = 30; // Target ~30 messages/sec

  // Config
  private readonly windowSize: number;
  private readonly hopSize: number;
  private readonly onsetThresholdDb: number;
  private readonly onsetRiseDb = 6;
  private readonly debounceMs: number;

  constructor(options?: { processorOptions?: ProcessorOptions }) {
    super();

    const opts = options?.processorOptions || {};
    this.windowSize = opts.windowSize || 2048;
    this.hopSize = opts.hopSize || 512;
    this.onsetThresholdDb = opts.onsetThresholdDb || -40;
    this.debounceMs = opts.debounceMs || 50;

    this.ringBuffer = new RingBuffer(this.windowSize, this.hopSize);
    this.yinDetector = new YinDetector(this.windowSize, sampleRate, opts.yinThreshold || 0.15);
    this.frameBuffer = new Float32Array(this.windowSize);
  }

  process(inputs: Float32Array[][], _outputs: Float32Array[][], _parameters: Record<string, Float32Array>): boolean {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const samples = input[0];
    this.ringBuffer.write(samples);

    // Process when we have enough samples
    while (this.ringBuffer.isFrameReady()) {
      this.ringBuffer.getFrame(this.frameBuffer);
      this.analyzeFrame();
    }

    return true;
  }

  private analyzeFrame(): void {
    // Calculate levels
    const rms = calculateRms(this.frameBuffer);
    const rmsDb = linearToDb(rms);

    // Detect pitch
    const { frequency, clarity } = this.yinDetector.detect(this.frameBuffer);

    // Detect onset
    const timeSinceLastOnset = (currentTime - this.lastOnsetTime) * 1000;
    const isRising = rmsDb - this.lastRmsDb > this.onsetRiseDb;
    const isAboveThreshold = rmsDb > this.onsetThresholdDb;
    const isDebounced = timeSinceLastOnset > this.debounceMs;

    if (isAboveThreshold && isRising && isDebounced) {
      this.lastOnsetTime = currentTime;
      this.port.postMessage({
        type: 'onset',
        data: { timestampSec: currentTime, rmsDb },
      });
    }

    this.lastRmsDb = rmsDb;

    // Throttle pitch/level messages to ~30/sec
    this.frameCount++;
    const framesPerMessage = Math.floor((sampleRate / this.hopSize) / this.messagesPerSecond);

    if (this.frameCount >= framesPerMessage) {
      this.frameCount = 0;

      // Send pitch result
      this.port.postMessage({
        type: 'pitch',
        data: {
          timestampSec: currentTime,
          frequency,
          midi: frequency ? Math.round(hzToMidi(frequency)) : null,
          clarity,
          rmsDb,
        },
      });

      // Send level update
      let peak = 0;
      for (let i = 0; i < this.frameBuffer.length; i++) {
        const abs = Math.abs(this.frameBuffer[i]);
        if (abs > peak) peak = abs;
      }
      const peakDb = linearToDb(peak);

      this.port.postMessage({
        type: 'level',
        data: { rmsDb, peakDb },
      });
    }
  }
}

registerProcessor('pitch-detector', PitchDetectorProcessor);
