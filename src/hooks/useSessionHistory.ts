import { useState, useEffect, useCallback } from 'react';
import type { SessionMetadata, ProblemSpot } from '../lib/session/sessionTypes';
import {
  getSessionsForTab,
  getBestScoreForTab,
  getSessionCountForTab,
  getFullSessionsForTab,
  deleteSession as deleteSessionFromDb,
} from '../lib/storage/sessionDb';
import { identifyProblemSpots } from '../lib/session/aggregateCalculator';

// ============================================================================
// Session History Hook - Fetch and Cache Sessions for a Tab
// ============================================================================

export interface SessionStats {
  totalSessions: number;
  bestScore: number;
  averageAccuracy: number;
  problemSpots: ProblemSpot[];
}

export interface UseSessionHistoryReturn {
  /** List of session metadata (without events) */
  sessions: SessionMetadata[];
  /** Aggregated statistics */
  stats: SessionStats;
  /** Loading state */
  isLoading: boolean;
  /** Refresh session list from database */
  refresh: () => Promise<void>;
  /** Delete a specific session */
  deleteSession: (id: string) => Promise<void>;
}

export function useSessionHistory(tabId: string): UseSessionHistoryReturn {
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [stats, setStats] = useState<SessionStats>({
    totalSessions: 0,
    bestScore: 0,
    averageAccuracy: 0,
    problemSpots: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);

    try {
      // Fetch sessions and stats in parallel
      const [sessionList, bestScore, totalSessions, fullSessions] = await Promise.all([
        getSessionsForTab(tabId, 20),
        getBestScoreForTab(tabId),
        getSessionCountForTab(tabId),
        getFullSessionsForTab(tabId, 10), // Get recent sessions for problem spot analysis
      ]);

      setSessions(sessionList);

      // Calculate average accuracy
      const averageAccuracy =
        sessionList.length > 0
          ? Math.round(
              sessionList.reduce((sum, s) => sum + s.accuracy, 0) / sessionList.length
            )
          : 0;

      // Identify problem spots from recent sessions
      const problemSpots = identifyProblemSpots(fullSessions, 3, 0.4);

      setStats({
        totalSessions,
        bestScore,
        averageAccuracy,
        problemSpots: problemSpots.slice(0, 5), // Top 5 problem spots
      });
    } catch (error) {
      console.error('Failed to load session history:', error);
    }

    setIsLoading(false);
  }, [tabId]);

  const deleteSession = useCallback(
    async (id: string) => {
      await deleteSessionFromDb(id);
      await refresh();
    },
    [refresh]
  );

  // Load on mount and when tabId changes
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    sessions,
    stats,
    isLoading,
    refresh,
    deleteSession,
  };
}
