import type { MutableRefObject } from 'react';
import type { MidiNote, OnsetEvent, PitchDetectionResult } from '../../types';
import type { UseAudioInputReturn } from '../useAudioInput';
import { getSongTimeSec } from './clock';

export interface DetectedOnset {
  detectedMidi: MidiNote | null;
  onsetSongTimeSec: number;
  onset: OnsetEvent;
}

function pickPitchAfterOnset(params: {
  onsetTimestampSec: number;
  recentPitches: PitchDetectionResult[];
}): PitchDetectionResult | null {
  const { onsetTimestampSec, recentPitches } = params;

  // Pitch detection has inherent latency (analysis window), so we look *after* the onset.
  // Keeping this window bounded helps avoid grabbing the next note in fast passages.
  const MAX_LOOKAHEAD_SEC = 0.25;
  const MIN_TRUSTED_CLARITY = 0.6;

  let best: PitchDetectionResult | null = null;
  for (let i = recentPitches.length - 1; i >= 0; i--) {
    const pitch = recentPitches[i];
    if (pitch.timestampSec < onsetTimestampSec) break; // history is time-ordered
    const dt = pitch.timestampSec - onsetTimestampSec;
    if (dt > MAX_LOOKAHEAD_SEC) continue;
    if (pitch.midi == null) continue;
    if (pitch.clarity < MIN_TRUSTED_CLARITY) continue;
    best = pitch;
    // Since we're iterating newest->oldest, the first good one is usually best.
    break;
  }
  return best;
}

function resolveDetectedMidi(params: {
  onset: OnsetEvent;
  currentPitch: PitchDetectionResult | null;
  recentPitches: PitchDetectionResult[];
}): MidiNote | null {
  const { onset, currentPitch, recentPitches } = params;

  // Prefer the stable pitch stream *after* the onset, to avoid "previous note" contamination.
  const bestPitch = pickPitchAfterOnset({ onsetTimestampSec: onset.timestampSec, recentPitches });
  if (bestPitch) return bestPitch.midi!;

  // Fall back to the onset's embedded pitch only if it looks reasonably confident.
  if (onset.midi != null && onset.clarity >= 0.6) return onset.midi;

  // If the current pitch sample is already after the onset, accept it even if we didn't
  // have a full history match (e.g., history not populated yet).
  if (currentPitch?.midi != null && currentPitch.timestampSec >= onset.timestampSec) {
    return currentPitch.midi;
  }

  return null;
}

export function drainDetectedOnsets(params: {
  audioInput: Pick<UseAudioInputReturn, 'currentPitch' | 'drainOnsets'>;
  playStartTimeSec: number;
  speed: number;
  inputOffsetSec: number;
  recentPitches: PitchDetectionResult[];
  pendingOnsetsRef: MutableRefObject<OnsetEvent[]>;
  lastOnsetRef: MutableRefObject<OnsetEvent | null>;
}): DetectedOnset[] {
  const {
    audioInput,
    playStartTimeSec,
    speed,
    inputOffsetSec,
    recentPitches,
    pendingOnsetsRef,
    lastOnsetRef,
  } = params;

  const currentPitch = audioInput.currentPitch;

  const onsetEvents = audioInput.drainOnsets() ?? [];
  if (onsetEvents.length > 0) {
    pendingOnsetsRef.current.push(...onsetEvents);
    // Keep this bounded.
    if (pendingOnsetsRef.current.length > 50) {
      pendingOnsetsRef.current.splice(0, pendingOnsetsRef.current.length - 50);
    }
  }

  if (pendingOnsetsRef.current.length === 0) return [];

  const detected: DetectedOnset[] = [];
  const remaining: OnsetEvent[] = [];
  const MAX_WAIT_SEC = 0.3;

  for (const onset of pendingOnsetsRef.current) {
    lastOnsetRef.current = onset;

    const detectedMidi = resolveDetectedMidi({
      onset,
      currentPitch,
      recentPitches,
    });

    // If we couldn't resolve a pitch yet, keep the onset around briefly so we can
    // match it against a pitch sample that arrives slightly after the attack.
    if (detectedMidi == null) {
      const newestPitchTime = recentPitches.length > 0 ? recentPitches[recentPitches.length - 1].timestampSec : null;
      const ageSec = newestPitchTime != null ? newestPitchTime - onset.timestampSec : 0;
      if (ageSec >= 0 && ageSec < MAX_WAIT_SEC) {
        remaining.push(onset);
        continue;
      }
    }

    // Apply calibrated input latency (positive offset means detected events arrive late).
    const onsetSongTimeSec = getSongTimeSec(onset.timestampSec - inputOffsetSec, playStartTimeSec, speed);
    detected.push({ detectedMidi, onsetSongTimeSec, onset });
  }

  pendingOnsetsRef.current = remaining;
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
