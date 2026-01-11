import { useRef, useCallback } from 'react';
import type { Tab } from '../types';
import type { PlayEventRecord, SessionRecord } from '../lib/session/sessionTypes';
import { calculateAggregates } from '../lib/session/aggregateCalculator';
import { saveSession } from '../lib/storage/sessionDb';
import type { ScoreState } from '../lib/scoring';

// ============================================================================
// Session Recorder Hook - Captures Events and Persists on Completion
// ============================================================================

export interface UseSessionRecorderReturn {
  /** Add an event to the current recording */
  recordEvent: (event: PlayEventRecord) => void;
  /** Complete and save the session (call on natural finish) */
  finishSession: (scoreState: ScoreState) => Promise<SessionRecord | null>;
  /** Discard current recording (call on early exit) */
  discardSession: () => void;
  /** Get current event count */
  getEventCount: () => number;
}

export function useSessionRecorder(
  tab: Tab,
  playbackSpeed: number
): UseSessionRecorderReturn {
  const eventsRef = useRef<PlayEventRecord[]>([]);
  const startTimeRef = useRef<Date | null>(null);
  const isRecordingRef = useRef(false);

  const recordEvent = useCallback((event: PlayEventRecord) => {
    // Auto-start recording on first event
    if (!isRecordingRef.current) {
      isRecordingRef.current = true;
      startTimeRef.current = new Date();
    }
    eventsRef.current.push(event);
  }, []);

  const finishSession = useCallback(
    async (scoreState: ScoreState): Promise<SessionRecord | null> => {
      // Don't save if no events recorded
      if (eventsRef.current.length === 0) {
        return null;
      }

      const finishedAt = new Date();
      const startedAt = startTimeRef.current || finishedAt;
      const durationSec = (finishedAt.getTime() - startedAt.getTime()) / 1000;

      const session: SessionRecord = {
        id: crypto.randomUUID(),
        tabId: tab.id,
        tabTitle: tab.title,
        tabArtist: tab.artist,
        playbackSpeed,
        startedAt,
        finishedAt,
        durationSec,
        aggregate: calculateAggregates(
          eventsRef.current,
          scoreState.score,
          scoreState.maxStreak
        ),
        events: [...eventsRef.current], // Copy to avoid mutation
      };

      const saved = await saveSession(session);

      // Reset for potential replay
      eventsRef.current = [];
      isRecordingRef.current = false;
      startTimeRef.current = null;

      return saved ? session : null;
    },
    [tab, playbackSpeed]
  );

  const discardSession = useCallback(() => {
    eventsRef.current = [];
    isRecordingRef.current = false;
    startTimeRef.current = null;
  }, []);

  const getEventCount = useCallback(() => {
    return eventsRef.current.length;
  }, []);

  return {
    recordEvent,
    finishSession,
    discardSession,
    getEventCount,
  };
}
