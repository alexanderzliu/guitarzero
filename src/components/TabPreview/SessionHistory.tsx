import type { SessionMetadata, ProblemSpot } from '../../lib/session/sessionTypes';
import type { SessionStats } from '../../hooks/useSessionHistory';

// ============================================================================
// Session History - "Garage Film" Aesthetic
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
      <div className="bg-[#1a1614] border border-[#292524] rounded p-6">
        <h2 className="font-display text-lg text-[#f5f0e6] tracking-wide mb-4">SESSION HISTORY</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-pulse text-[#57534e]">Loading sessions...</div>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="bg-[#1a1614] border border-[#292524] rounded p-6">
        <h2 className="font-display text-lg text-[#f5f0e6] tracking-wide mb-4">SESSION HISTORY</h2>
        <p className="text-[#78716c] text-center py-8">
          No sessions yet. Play this tab to start tracking your progress!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1614] border border-[#292524] rounded p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-[#f5f0e6] tracking-wide">SESSION HISTORY</h2>
        <span className="text-sm text-[#57534e] font-mono">
          {stats.totalSessions} session{stats.totalSessions !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-3">
        <StatBox label="Best Score" value={stats.bestScore.toLocaleString()} highlight />
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
        <h3 className="text-sm text-[#78716c]">Recent Sessions</h3>
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
  highlight?: boolean;
}

function StatBox({ label, value, highlight }: StatBoxProps) {
  return (
    <div className="bg-[#0a0a0a] border border-[#292524] rounded px-3 py-2 text-center">
      <div className={`text-lg font-mono font-bold tabular-nums ${highlight ? 'text-[#d97706]' : 'text-[#f5f0e6]'}`}>
        {value}
      </div>
      <div className="text-xs text-[#57534e]">{label}</div>
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
    <div className="bg-[#0a0a0a] border border-[#292524] rounded px-4 py-3 flex items-center justify-between group hover:border-[#78716c] transition-colors">
      <div className="flex items-center gap-4">
        {/* Grade */}
        <span className={`text-2xl font-display ${gradeColor} w-8`}>
          {session.grade}
        </span>

        {/* Stats */}
        <div>
          <div className="text-[#f5f0e6] font-mono font-semibold tabular-nums">
            {session.score.toLocaleString()} pts
          </div>
          <div className="text-[#78716c] text-sm font-mono">
            {session.accuracy}% accuracy · {session.maxStreak} max streak
          </div>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <div className="text-right text-sm">
          <div className="text-[#78716c]">{dateStr}</div>
          {session.playbackSpeed < 1 && (
            <div className="text-[#57534e] font-mono">{session.playbackSpeed}x speed</div>
          )}
        </div>

        {/* Delete button */}
        {onDelete && (
          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 p-1 text-[#57534e] hover:text-[#dc2626] transition-all"
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
    <div className="bg-[#0a0a0a] border border-[#292524] rounded p-4">
      <h3 className="text-sm font-semibold text-[#d6d3cd] mb-2">
        Problem Spots
      </h3>
      <p className="text-xs text-[#57534e] mb-3">
        Notes you frequently miss - practice these sections!
      </p>
      <div className="flex flex-wrap gap-2">
        {problemSpots.map((spot) => (
          <div
            key={spot.eventId}
            className="bg-[#7f1d1d]/30 border border-[#dc2626]/30 text-[#dc2626] text-xs font-mono px-2 py-1 rounded"
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
      return 'text-[#fbbf24]'; // Gold - perfect
    case 'A':
      return 'text-[#f5f0e6]'; // Cream - excellent
    case 'B':
      return 'text-[#d97706]'; // Amber - good
    case 'C':
      return 'text-[#78716c]'; // Smoke - okay
    case 'D':
      return 'text-[#57534e]'; // Smoke dim - poor
    default:
      return 'text-[#dc2626]'; // Blood red - fail
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
