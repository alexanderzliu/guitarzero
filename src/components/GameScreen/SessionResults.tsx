import type { SessionRecord, TimingBucket } from '../../lib/session/sessionTypes';
import {
  calculateTimingDistribution,
  getTimingTendency,
} from '../../lib/session/aggregateCalculator';

// ============================================================================
// Session Results - Inline Results Display After Game Completion
// ============================================================================

interface SessionResultsProps {
  session: SessionRecord;
  onPlayAgain: () => void;
  onExit: () => void;
}

export function SessionResults({ session, onPlayAgain, onExit }: SessionResultsProps) {
  const { aggregate } = session;
  const timingDistribution = calculateTimingDistribution(session.events);
  const timingTendency = getTimingTendency(aggregate.averageOffsetMs);

  return (
    <div className="absolute inset-0 bg-slate-900/98 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-white mb-1">Session Complete</h2>
          <p className="text-slate-400">{session.tabTitle}</p>
        </div>

        {/* Grade and Score */}
        <div className="flex items-center justify-center gap-8 mb-8">
          {/* Grade */}
          <div className="text-center">
            <div
              className={`text-8xl font-bold ${getGradeColor(aggregate.grade)}`}
            >
              {aggregate.grade}
            </div>
            <div className="text-slate-500 text-sm uppercase tracking-wide mt-1">
              Grade
            </div>
          </div>

          {/* Score */}
          <div className="text-center">
            <div className="text-5xl font-bold text-white tabular-nums">
              {aggregate.score.toLocaleString()}
            </div>
            <div className="text-slate-500 text-sm uppercase tracking-wide mt-1">
              Score
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <StatCard label="Accuracy" value={`${aggregate.accuracy}%`} />
          <StatCard label="Max Streak" value={aggregate.maxStreak.toString()} />
          <StatCard
            label="Perfect"
            value={aggregate.perfectCount.toString()}
            color="green"
          />
          <StatCard
            label="Good"
            value={aggregate.goodCount.toString()}
            color="blue"
          />
          <StatCard
            label="OK"
            value={aggregate.okCount.toString()}
            color="yellow"
          />
          <StatCard
            label="Miss"
            value={aggregate.missCount.toString()}
            color="red"
          />
          <StatCard label="Total Notes" value={aggregate.totalNotes.toString()} />
          <StatCard label="Timing" value={timingTendency} />
        </div>

        {/* Timing Histogram */}
        <div className="bg-slate-700 rounded-xl p-4 mb-6">
          <h3 className="text-sm font-medium text-slate-300 mb-3">
            Timing Distribution
          </h3>
          <TimingHistogram buckets={timingDistribution} />
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={onPlayAgain}
            className="flex-1 py-3 px-6 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
          >
            Play Again
          </button>
          <button
            onClick={onExit}
            className="flex-1 py-3 px-6 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
          >
            Back to Tab
          </button>
        </div>

        {/* Speed indicator */}
        {session.playbackSpeed < 1 && (
          <p className="text-center text-slate-500 text-sm mt-4">
            Played at {session.playbackSpeed}x speed
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

interface StatCardProps {
  label: string;
  value: string;
  color?: 'green' | 'blue' | 'yellow' | 'red';
}

function StatCard({ label, value, color }: StatCardProps) {
  const colorClass =
    color === 'green'
      ? 'text-green-400'
      : color === 'blue'
        ? 'text-blue-400'
        : color === 'yellow'
          ? 'text-yellow-400'
          : color === 'red'
            ? 'text-red-400'
            : 'text-white';

  return (
    <div className="bg-slate-700 rounded-lg px-3 py-2 text-center">
      <div className={`text-lg font-bold tabular-nums ${colorClass}`}>{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

interface TimingHistogramProps {
  buckets: TimingBucket[];
}

function TimingHistogram({ buckets }: TimingHistogramProps) {
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div className="flex items-end justify-between gap-2 h-24">
      {buckets.map((bucket, index) => {
        const height = (bucket.count / maxCount) * 100;
        const isCenter = bucket.label === 'Perfect';

        return (
          <div key={index} className="flex-1 flex flex-col items-center">
            {/* Bar */}
            <div className="w-full flex-1 flex items-end">
              <div
                className={`w-full rounded-t transition-all ${
                  isCenter ? 'bg-green-500' : 'bg-slate-500'
                }`}
                style={{ height: `${Math.max(height, 4)}%` }}
              />
            </div>
            {/* Label */}
            <div className="text-xs text-slate-400 mt-2 whitespace-nowrap">
              {bucket.label}
            </div>
            {/* Count */}
            <div className="text-xs text-slate-500 tabular-nums">{bucket.count}</div>
          </div>
        );
      })}
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
