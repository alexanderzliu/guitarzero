import type { WorkletMessage, AudioConfig, PitchDetectionResult, OnsetEvent } from '../../types';
import { getCalibrationOffset } from '../storage/calibrationStorage';

export interface AudioCaptureCallbacks {
  onPitch?: (result: PitchDetectionResult) => void;
  onOnset?: (data: OnsetEvent) => void;
  onLevel?: (data: { rmsDb: number; peakDb: number }) => void;
  onError?: (error: Error) => void;
  onStateChange?: (state: 'starting' | 'running' | 'stopped' | 'error') => void;
}

export class AudioCapture {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private callbacks: AudioCaptureCallbacks = {};
  private config: AudioConfig;
  private deviceId: string | null = null;

  constructor(config?: Partial<AudioConfig>) {
    this.config = {
      inputOffsetSec: 0,
      sampleRate: 48000, // Will be updated from actual context
      analysisWindowSamples: 2048,
      hopSamples: 512,
      ...config,
    };
  }

  /**
   * Get list of available audio input devices
   */
  async getInputDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'audioinput');
  }

  /**
   * Set the input device to use
   */
  setDevice(deviceId: string | null): void {
    this.deviceId = deviceId;
  }

  /**
   * Get the currently selected device ID
   */
  getDeviceId(): string | null {
    return this.deviceId;
  }

  /**
   * Update callbacks on a running audio capture.
   * This allows a new component to receive events from an already-running capture.
   */
  setCallbacks(callbacks: AudioCaptureCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Start audio capture
   */
  async start(callbacks: AudioCaptureCallbacks): Promise<void> {
    this.callbacks = callbacks;
    this.callbacks.onStateChange?.('starting');

    try {
      // Load calibration offset for this device
      this.loadCalibrationFromStorage();

      // Create audio context
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate,
        latencyHint: 'interactive',
      });

      // Update config with actual sample rate
      this.config.sampleRate = this.audioContext.sampleRate;

      // Request microphone access
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          deviceId: this.deviceId ? { exact: this.deviceId } : undefined,
        },
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Create source node
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Load and create worklet from public folder
      await this.audioContext.audioWorklet.addModule('/pitch-detector.worklet.js');

      this.workletNode = new AudioWorkletNode(this.audioContext, 'pitch-detector', {
        processorOptions: {
          windowSize: this.config.analysisWindowSamples,
          hopSize: this.config.hopSamples,
        },
      });

      // Handle messages from worklet
      this.workletNode.port.onmessage = (event: MessageEvent<WorkletMessage>) => {
        const { type, data } = event.data;
        switch (type) {
          case 'pitch':
            this.callbacks.onPitch?.(data as PitchDetectionResult);
            break;
          case 'onset':
            this.callbacks.onOnset?.(data as OnsetEvent);
            break;
          case 'level':
            this.callbacks.onLevel?.(data as { rmsDb: number; peakDb: number });
            break;
        }
      };

      // Connect nodes
      this.sourceNode.connect(this.workletNode);
      // Don't connect to destination - we don't want to hear the input

      this.callbacks.onStateChange?.('running');
    } catch (error) {
      this.callbacks.onStateChange?.('error');
      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Stop audio capture
   */
  stop(): void {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.callbacks.onStateChange?.('stopped');
  }

  /**
   * Get current audio context time in seconds
   */
  getCurrentTime(): number {
    return this.audioContext?.currentTime ?? 0;
  }

  /**
   * Get current time adjusted for calibrated input latency.
   * Use this when comparing detected events to expected times.
   */
  getCalibratedTime(): number {
    const rawTime = this.getCurrentTime();
    return rawTime - this.config.inputOffsetSec;
  }

  /**
   * Get the audio context (for synchronizing with game clock)
   */
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  /**
   * Get current configuration
   */
  getConfig(): AudioConfig {
    return { ...this.config };
  }

  /**
   * Update configuration (requires restart)
   */
  updateConfig(config: Partial<AudioConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Load calibration offset for the current device from storage
   */
  loadCalibrationFromStorage(): void {
    const offset = getCalibrationOffset(this.deviceId);
    this.config.inputOffsetSec = offset;
  }

  /**
   * Set the input latency offset directly
   */
  setInputOffset(offsetSec: number): void {
    this.config.inputOffsetSec = offsetSec;
  }

  /**
   * Check if capture is currently running
   */
  isRunning(): boolean {
    return this.audioContext !== null && this.audioContext.state === 'running';
  }
}

// Singleton instance for the app
let audioCaptureInstance: AudioCapture | null = null;

export function getAudioCapture(config?: Partial<AudioConfig>): AudioCapture {
  if (!audioCaptureInstance) {
    audioCaptureInstance = new AudioCapture(config);
  }
  return audioCaptureInstance;
}
