import { useState, useCallback, useEffect, useRef } from 'react';
import { AudioCapture, getAudioCapture } from '../lib/audio/audioCapture';
import type { PitchDetectionResult, AudioConfig, OnsetEvent } from '../types';

export interface AudioInputState {
  isRunning: boolean;
  isStarting: boolean;
  error: string | null;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string | null;
  currentPitch: PitchDetectionResult | null;
  currentLevel: { rmsDb: number; peakDb: number } | null;
  lastOnset: OnsetEvent | null;
  sampleRate: number;
}

export interface UseAudioInputReturn extends AudioInputState {
  start: () => Promise<void>;
  stop: () => void;
  selectDevice: (deviceId: string | null) => void;
  refreshDevices: () => Promise<void>;
  getAudioContext: () => AudioContext | null;
  getCurrentTime: () => number;
}

export function useAudioInput(config?: Partial<AudioConfig>): UseAudioInputReturn {
  const [state, setState] = useState<AudioInputState>({
    isRunning: false,
    isStarting: false,
    error: null,
    devices: [],
    selectedDeviceId: null,
    currentPitch: null,
    currentLevel: null,
    lastOnset: null,
    sampleRate: 48000,
  });

  const audioCaptureRef = useRef<AudioCapture | null>(null);

  // Create callbacks that update this hook's state
  // Memoized so we can reuse for both start() and re-registering on mount
  const createCallbacks = useCallback(() => ({
    onPitch: (result: PitchDetectionResult) => {
      setState((s) => ({ ...s, currentPitch: result }));
    },
    onLevel: (level: { rmsDb: number; peakDb: number }) => {
      setState((s) => ({ ...s, currentLevel: level }));
    },
    onOnset: (onset: OnsetEvent) => {
      setState((s) => ({ ...s, lastOnset: onset }));
    },
    onStateChange: (newState: 'starting' | 'running' | 'stopped' | 'error') => {
      setState((s) => ({
        ...s,
        isRunning: newState === 'running',
        isStarting: newState === 'starting',
      }));
    },
    onError: (error: Error) => {
      setState((s) => ({
        ...s,
        error: error.message,
        isRunning: false,
        isStarting: false,
      }));
    },
  }), []);

  // Initialize audio capture on mount
  // Note: We do NOT stop audio on unmount - the singleton should persist
  // across view changes so the game can use the same audio stream
  useEffect(() => {
    audioCaptureRef.current = getAudioCapture(config);
    refreshDevices();

    // Sync local state with singleton state (in case audio was already started)
    const capture = audioCaptureRef.current;
    if (capture.isRunning()) {
      // Re-register callbacks so THIS component receives events
      capture.setCallbacks(createCallbacks());
      setState((s) => ({
        ...s,
        isRunning: true,
        selectedDeviceId: capture.getDeviceId(),
      }));
    } else {
      // Sync device ID even if not running
      setState((s) => ({
        ...s,
        selectedDeviceId: capture.getDeviceId(),
      }));
    }
  }, [createCallbacks]);

  const refreshDevices = useCallback(async () => {
    try {
      // Need to request permission first to get device labels
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === 'audioinput');
      setState((s) => ({ ...s, devices: audioInputs }));
    } catch (error) {
      console.error('Failed to enumerate devices:', error);
    }
  }, []);

  const selectDevice = useCallback((deviceId: string | null) => {
    audioCaptureRef.current?.setDevice(deviceId);
    setState((s) => ({ ...s, selectedDeviceId: deviceId }));
  }, []);

  const start = useCallback(async () => {
    if (!audioCaptureRef.current) return;

    setState((s) => ({ ...s, isStarting: true, error: null }));

    try {
      await audioCaptureRef.current.start(createCallbacks());

      // Update sample rate from actual context
      const config = audioCaptureRef.current.getConfig();
      setState((s) => ({ ...s, sampleRate: config.sampleRate }));

      // Refresh devices to get labels (now that we have permission)
      await refreshDevices();
    } catch (error) {
      setState((s) => ({
        ...s,
        error: error instanceof Error ? error.message : 'Failed to start audio',
        isStarting: false,
      }));
    }
  }, [createCallbacks, refreshDevices]);

  const stop = useCallback(() => {
    audioCaptureRef.current?.stop();
    setState((s) => ({
      ...s,
      isRunning: false,
      currentPitch: null,
      currentLevel: null,
    }));
  }, []);

  const getAudioContext = useCallback(() => {
    return audioCaptureRef.current?.getAudioContext() ?? null;
  }, []);

  const getCurrentTime = useCallback(() => {
    return audioCaptureRef.current?.getCurrentTime() ?? 0;
  }, []);

  return {
    ...state,
    start,
    stop,
    selectDevice,
    refreshDevices,
    getAudioContext,
    getCurrentTime,
  };
}
