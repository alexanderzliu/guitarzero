import type { MutableRefObject } from 'react';
import type { MidiNote, OnsetEvent, PitchDetectionResult } from '../../types';
import type { UseAudioInputReturn } from '../useAudioInput';
import { getSongTimeSec } from './clock';

export interface DetectedOnset {
  detectedMidi: MidiNote;
  onsetSongTimeSec: number;
  onset: OnsetEvent;
}

export function updateLastValidPitch(
  lastValidPitchRef: MutableRefObject<{ midi: MidiNote; timestampSec: number } | null>,
  currentPitch: PitchDetectionResult | null
) {
  if (currentPitch?.midi == null) return;
  lastValidPitchRef.current = { midi: currentPitch.midi, timestampSec: currentPitch.timestampSec };
}

function resolveDetectedMidi(params: {
  onset: OnsetEvent;
  currentPitch: PitchDetectionResult | null;
  lastValidPitch: { midi: MidiNote; timestampSec: number } | null;
}): MidiNote | null {
  const { onset, currentPitch, lastValidPitch } = params;
  if (onset.midi != null) return onset.midi;
  if (currentPitch?.midi != null) return currentPitch.midi;
  const isRecent =
    !!lastValidPitch && onset.timestampSec - lastValidPitch.timestampSec < 0.5;
  return isRecent ? lastValidPitch!.midi : null;
}

export function drainDetectedOnsets(params: {
  audioInput: Pick<UseAudioInputReturn, 'currentPitch' | 'drainOnsets'>;
  playStartTimeSec: number;
  speed: number;
  lastOnsetRef: MutableRefObject<OnsetEvent | null>;
  lastValidPitchRef: MutableRefObject<{ midi: MidiNote; timestampSec: number } | null>;
}): DetectedOnset[] {
  const { audioInput, playStartTimeSec, speed, lastOnsetRef, lastValidPitchRef } = params;

  const currentPitch = audioInput.currentPitch;
  updateLastValidPitch(lastValidPitchRef, currentPitch);

  const onsetEvents = audioInput.drainOnsets() ?? [];
  if (onsetEvents.length === 0) return [];

  const detected: DetectedOnset[] = [];
  for (const onset of onsetEvents) {
    lastOnsetRef.current = onset;

    const detectedMidi = resolveDetectedMidi({
      onset,
      currentPitch,
      lastValidPitch: lastValidPitchRef.current,
    });
    if (detectedMidi == null) continue;

    const onsetSongTimeSec = getSongTimeSec(onset.timestampSec, playStartTimeSec, speed);
    detected.push({ detectedMidi, onsetSongTimeSec, onset });
  }

  return detected;
}

export function getOnsetFeedback(params: {
  audioTimeSec: number;
  lastOnsetRef: MutableRefObject<OnsetEvent | null>;
}): { timeSinceLastOnsetSec: number | null; lastOnsetMidi: MidiNote | null } {
  const lastOnset = params.lastOnsetRef.current;
  return {
    timeSinceLastOnsetSec: lastOnset ? params.audioTimeSec - lastOnset.timestampSec : null,
    lastOnsetMidi: lastOnset?.midi ?? null,
  };
}

