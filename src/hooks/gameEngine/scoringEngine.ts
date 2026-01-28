import type { ScoreResult } from '../../types';
import {
  findMatchingNotes,
  findMissedNotes,
  getNoteKey,
  applyHitResult,
  DEFAULT_TIMING_TOLERANCES,
  INITIAL_SCORE_STATE,
  type ScoreState,
} from '../../lib/scoring';
import { createHitEvent, createMissEvent, type PlayEventRecord } from '../../lib/session';
import type { RenderNote } from '../../lib/tabs/tempoUtils';
import type { DetectedOnset } from './onsetIntake';

export interface ScoringEngine {
  reset: () => void;
  getScoreState: () => ScoreState;
  getLastHitResult: () => ScoreResult | null;
  processDetectedOnsets: (params: {
    detectedOnsets: DetectedOnset[];
    allNotes: RenderNote[];
    onPlayEvent?: (event: PlayEventRecord) => void;
  }) => ScoreResult | null;
  processMisses: (params: {
    songTimeSec: number;
    allNotes: RenderNote[];
    onPlayEvent?: (event: PlayEventRecord) => void;
  }) => ScoreResult | null;
  annotateVisibleNotes: (visibleNotes: RenderNote[]) => RenderNote[];
}

export function createScoringEngine(): ScoringEngine {
  let scoreState: ScoreState = INITIAL_SCORE_STATE;
  let lastHitResult: ScoreResult | null = null;
  let hitNotes: Set<string> = new Set();
  const noteResults: Map<string, ScoreResult> = new Map();
  const hitTimestamps: Map<string, number> = new Map();

  const reset = () => {
    scoreState = INITIAL_SCORE_STATE;
    lastHitResult = null;
    hitNotes = new Set();
    noteResults.clear();
    hitTimestamps.clear();
  };

  const processDetectedOnsets: ScoringEngine['processDetectedOnsets'] = (params) => {
    if (params.detectedOnsets.length === 0) return null;

    let frameLastHit: ScoreResult | null = null;

    for (const detected of params.detectedOnsets) {
      const pendingNotes = params.allNotes.filter((n) => !hitNotes.has(getNoteKey(n)));
      const matches = findMatchingNotes(
        detected.detectedMidi,
        detected.onsetSongTimeSec,
        pendingNotes,
        DEFAULT_TIMING_TOLERANCES
      );

      for (const match of matches) {
        const noteKey = getNoteKey(match.note);
        if (hitNotes.has(noteKey)) continue;

        hitNotes.add(noteKey);
        noteResults.set(noteKey, match.result);
        hitTimestamps.set(noteKey, detected.onsetSongTimeSec);
        scoreState = applyHitResult(scoreState, match.result);
        lastHitResult = match.result;
        frameLastHit = match.result;

        if (params.onPlayEvent) {
          params.onPlayEvent(
            createHitEvent(match.note, match.result, match.offsetMs, detected.detectedMidi, detected.onsetSongTimeSec)
          );
        }
      }
    }

    return frameLastHit;
  };

  const processMisses: ScoringEngine['processMisses'] = (params) => {
    const pendingNotes = params.allNotes.filter((n) => !hitNotes.has(getNoteKey(n)));
    const missedNotes = findMissedNotes(params.songTimeSec, pendingNotes, DEFAULT_TIMING_TOLERANCES);
    if (missedNotes.length === 0) return null;

    let frameLastHit: ScoreResult | null = null;
    for (const note of missedNotes) {
      const noteKey = getNoteKey(note);
      if (hitNotes.has(noteKey)) continue;
      hitNotes.add(noteKey);
      noteResults.set(noteKey, 'miss');
      scoreState = applyHitResult(scoreState, 'miss');
      lastHitResult = 'miss';
      frameLastHit = 'miss';

      if (params.onPlayEvent) {
        params.onPlayEvent(createMissEvent(note, params.songTimeSec));
      }
    }

    return frameLastHit;
  };

  const annotateVisibleNotes: ScoringEngine['annotateVisibleNotes'] = (visibleNotes) => {
    if (noteResults.size === 0 && hitTimestamps.size === 0) return visibleNotes;

    return visibleNotes.map((note) => {
      const noteKey = getNoteKey(note);
      const hitResult = noteResults.get(noteKey);
      if (!hitResult) return note;
      const hitTimestampSec = hitTimestamps.get(noteKey);
      return { ...note, hitResult, hitTimestampSec };
    });
  };

  return {
    reset,
    getScoreState: () => scoreState,
    getLastHitResult: () => lastHitResult,
    processDetectedOnsets,
    processMisses,
    annotateVisibleNotes,
  };
}
