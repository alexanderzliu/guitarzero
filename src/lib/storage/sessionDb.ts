import Dexie, { type Table } from 'dexie';
import type { SessionRecord, SessionMetadata } from '../session/sessionTypes';

// ============================================================================
// Session Database - Dexie.js IndexedDB Repository
// ============================================================================

/**
 * Dexie database for session persistence.
 * Uses versioned schema for future migrations.
 */
class SessionDatabase extends Dexie {
  sessions!: Table<SessionRecord, string>;

  constructor() {
    super('GuitarHeroSessions');

    // Schema version 1
    this.version(1).stores({
      // Primary key: id
      // Indexes: tabId (for filtering), finishedAt (for sorting)
      // Compound index: [tabId+finishedAt] for efficient tab history queries
      sessions: 'id, tabId, finishedAt, [tabId+finishedAt]',
    });
  }
}

// Singleton database instance
const db = new SessionDatabase();

/**
 * Save a completed session to IndexedDB.
 * Fails silently with console.error to avoid interrupting user flow.
 */
export async function saveSession(session: SessionRecord): Promise<boolean> {
  try {
    await db.sessions.add(session);
    return true;
  } catch (error) {
    console.error('Failed to save session:', error);
    return false;
  }
}

/**
 * Get sessions for a specific tab, ordered by most recent first.
 * Returns metadata only (without events) for list views.
 */
export async function getSessionsForTab(
  tabId: string,
  limit: number = 10
): Promise<SessionMetadata[]> {
  try {
    const sessions = await db.sessions
      .where('tabId')
      .equals(tabId)
      .reverse()
      .sortBy('finishedAt');

    return sessions.slice(0, limit).map(toMetadata);
  } catch (error) {
    console.error('Failed to get sessions for tab:', error);
    return [];
  }
}

/**
 * Get full session details including events.
 * Used for detailed analysis or replay.
 */
export async function getSession(id: string): Promise<SessionRecord | undefined> {
  try {
    return await db.sessions.get(id);
  } catch (error) {
    console.error('Failed to get session:', error);
    return undefined;
  }
}

/**
 * Get all sessions for a tab with full event data.
 * Used for cross-session analysis (problem spots, progress tracking).
 */
export async function getFullSessionsForTab(
  tabId: string,
  limit: number = 20
): Promise<SessionRecord[]> {
  try {
    const sessions = await db.sessions
      .where('tabId')
      .equals(tabId)
      .reverse()
      .sortBy('finishedAt');

    return sessions.slice(0, limit);
  } catch (error) {
    console.error('Failed to get full sessions for tab:', error);
    return [];
  }
}

/**
 * Get best score for a tab.
 */
export async function getBestScoreForTab(tabId: string): Promise<number> {
  try {
    const sessions = await db.sessions.where('tabId').equals(tabId).toArray();

    if (sessions.length === 0) return 0;
    return Math.max(...sessions.map((s) => s.aggregate.score));
  } catch (error) {
    console.error('Failed to get best score:', error);
    return 0;
  }
}

/**
 * Get session count for a tab.
 */
export async function getSessionCountForTab(tabId: string): Promise<number> {
  try {
    return await db.sessions.where('tabId').equals(tabId).count();
  } catch (error) {
    console.error('Failed to get session count:', error);
    return 0;
  }
}

/**
 * Delete a session by ID.
 */
export async function deleteSession(id: string): Promise<boolean> {
  try {
    await db.sessions.delete(id);
    return true;
  } catch (error) {
    console.error('Failed to delete session:', error);
    return false;
  }
}

/**
 * Delete all sessions for a tab.
 * Useful when deleting a tab.
 */
export async function deleteSessionsForTab(tabId: string): Promise<boolean> {
  try {
    await db.sessions.where('tabId').equals(tabId).delete();
    return true;
  } catch (error) {
    console.error('Failed to delete sessions for tab:', error);
    return false;
  }
}

/**
 * Project SessionRecord to SessionMetadata (without events).
 */
function toMetadata(session: SessionRecord): SessionMetadata {
  return {
    id: session.id,
    tabId: session.tabId,
    tabTitle: session.tabTitle,
    tabArtist: session.tabArtist,
    finishedAt: session.finishedAt,
    playbackSpeed: session.playbackSpeed,
    accuracy: session.aggregate.accuracy,
    score: session.aggregate.score,
    grade: session.aggregate.grade,
    maxStreak: session.aggregate.maxStreak,
  };
}

// Export the database instance for direct access if needed
export { db };
