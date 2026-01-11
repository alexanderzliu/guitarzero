import type { SessionMetadata, ProblemSpot } from '../../lib/session/sessionTypes';
import type { SessionStats } from '../../hooks/useSessionHistory';

// ============================================================================
// Session History - Display Past Sessions for a Tab
// ============================================================================

interface SessionHistoryProps {
  sessions: SessionMetadata[];
  stats: SessionStats;
  isLoading: boolean;
  onDeleteSession?: (id: string) => void;
}

export function SessionHistory({
  sessions,
  stats,
  isLoading,
  onDeleteSession,
}: SessionHistoryProps) {
  if (isLoading) {
    return (
      <div className="bg-slate-800 rounded-xl p-6">
        <h2 className="text-lg font-bold text-slate-200 mb-4">Session History</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-pulse text-slate-500">Loading sessions...</div>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl p-6">
        <h2 className="text-lg font-bold text-slate-200 mb-4">Session History</h2>
        <p className="text-slate-400 text-center py-8">
          No sessions yet. Play this tab to start tracking your progress!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-200">Session History</h2>
        <span className="text-sm text-slate-500">
          {stats.totalSessions} session{stats.totalSessions !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-3">
        <StatBox label="Best Score" value={stats.bestScore.toLocaleString()} />
        <StatBox label="Avg Accuracy" value={`${stats.averageAccuracy}%`} />
        <StatBox
          label="Total Sessions"
          value={stats.totalSessions.toString()}
        />
      </div>

      {/* Problem Spots */}
      {stats.problemSpots.length > 0 && (
        <ProblemSpotsSection problemSpots={stats.problemSpots} />
      )}

      {/* Session List */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-slate-400">Recent Sessions</h3>
        {sessions.map((session) => (
          <SessionItem
            key={session.id}
            session={session}
            onDelete={onDeleteSession ? () => onDeleteSession(session.id) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

interface StatBoxProps {
  label: string;
  value: string;
}

function StatBox({ label, value }: StatBoxProps) {
  return (
    <div className="bg-slate-700 rounded-lg px-3 py-2 text-center">
      <div className="text-lg font-bold text-white tabular-nums">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

interface SessionItemProps {
  session: SessionMetadata;
  onDelete?: () => void;
}

function SessionItem({ session, onDelete }: SessionItemProps) {
  const gradeColor = getGradeColor(session.grade);
  const dateStr = formatDate(session.finishedAt);

  return (
    <div className="bg-slate-700 rounded-lg px-4 py-3 flex items-center justify-between group">
      <div className="flex items-center gap-4">
        {/* Grade */}
        <span className={`text-2xl font-bold ${gradeColor} w-8`}>
          {session.grade}
        </span>

        {/* Stats */}
        <div>
          <div className="text-white font-medium tabular-nums">
            {session.score.toLocaleString()} pts
          </div>
          <div className="text-slate-400 text-sm">
            {session.accuracy}% accuracy · {session.maxStreak} max streak
          </div>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <div className="text-right text-sm">
          <div className="text-slate-400">{dateStr}</div>
          {session.playbackSpeed < 1 && (
            <div className="text-slate-500">{session.playbackSpeed}x speed</div>
          )}
        </div>

        {/* Delete button */}
        {onDelete && (
          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-all"
            title="Delete session"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

interface ProblemSpotsSectionProps {
  problemSpots: ProblemSpot[];
}

function ProblemSpotsSection({ problemSpots }: ProblemSpotsSectionProps) {
  return (
    <div className="bg-slate-700/50 rounded-lg p-4">
      <h3 className="text-sm font-medium text-slate-300 mb-2">
        Problem Spots
      </h3>
      <p className="text-xs text-slate-500 mb-3">
        Notes you frequently miss - practice these sections!
      </p>
      <div className="flex flex-wrap gap-2">
        {problemSpots.map((spot) => (
          <div
            key={spot.eventId}
            className="bg-red-900/30 text-red-400 text-xs px-2 py-1 rounded"
            title={`Missed ${spot.missCount}/${spot.totalAttempts} times (${Math.round(spot.missRate * 100)}%)`}
          >
            Note {spot.eventId.slice(0, 8)}... ({Math.round(spot.missRate * 100)}%
            miss)
          </div>
        ))}
      </div>
    </div>
  );
}

function getGradeColor(grade: string): string {
  switch (grade) {
    case 'S':
      return 'text-yellow-400';
    case 'A':
      return 'text-green-400';
    case 'B':
      return 'text-blue-400';
    case 'C':
      return 'text-purple-400';
    case 'D':
      return 'text-orange-400';
    default:
      return 'text-red-400';
  }
}

function formatDate(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return d.toLocaleDateString();
  }
}
