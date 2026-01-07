import { useState, useCallback, useEffect, useRef } from 'react';
import { AudioCapture, getAudioCapture } from '../lib/audio/audioCapture';
import type { PitchDetectionResult, AudioConfig } from '../types';

export interface AudioInputState {
  isRunning: boolean;
  isStarting: boolean;
  error: string | null;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string | null;
  currentPitch: PitchDetectionResult | null;
  currentLevel: { rmsDb: number; peakDb: number } | null;
  lastOnset: { timestampSec: number; rmsDb: number } | null;
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

  // Initialize audio capture on mount
  useEffect(() => {
    audioCaptureRef.current = getAudioCapture(config);
    refreshDevices();

    return () => {
      audioCaptureRef.current?.stop();
    };
  }, []);

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
      await audioCaptureRef.current.start({
        onPitch: (result) => {
          setState((s) => ({ ...s, currentPitch: result }));
        },
        onLevel: (level) => {
          setState((s) => ({ ...s, currentLevel: level }));
        },
        onOnset: (onset) => {
          setState((s) => ({ ...s, lastOnset: onset }));
        },
        onStateChange: (newState) => {
          setState((s) => ({
            ...s,
            isRunning: newState === 'running',
            isStarting: newState === 'starting',
          }));
        },
        onError: (error) => {
          setState((s) => ({
            ...s,
            error: error.message,
            isRunning: false,
            isStarting: false,
          }));
        },
      });

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
  }, [refreshDevices]);

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
