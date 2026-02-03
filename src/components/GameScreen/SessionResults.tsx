import type { SessionRecord, TimingBucket } from '../../lib/session/sessionTypes';
import {
  calculateTimingDistribution,
  getTimingTendency,
} from '../../lib/session/aggregateCalculator';

// ============================================================================
// Session Results - "Garage Film" Aesthetic
// The moment after the last note - dramatic, celebratory
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
    <div className="absolute inset-0 bg-[#0a0a0a]/98 flex items-center justify-center z-50">
      {/* Subtle red glow from behind */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(220, 38, 38, 0.2) 0%, transparent 70%)'
        }}
      />

      <div className="relative bg-[#1a1614] border border-[#292524] rounded p-8 max-w-2xl w-full mx-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="font-display text-4xl text-[#f5f0e6] tracking-wide mb-2">
            SESSION COMPLETE
          </h2>
          <p className="text-[#78716c]">{session.tabTitle}</p>
        </div>

        {/* Grade and Score - the hero moment */}
        <div className="flex items-center justify-center gap-12 mb-10">
          {/* Grade */}
          <div className="text-center">
            <div
              className={`font-display text-9xl tracking-tight ${getGradeColor(aggregate.grade)}`}
              style={{
                textShadow: getGradeGlow(aggregate.grade)
              }}
            >
              {aggregate.grade}
            </div>
            <div className="font-display text-xs text-[#57534e] tracking-widest mt-2">
              GRADE
            </div>
          </div>

          {/* Divider */}
          <div className="h-32 w-px bg-[#292524]" />

          {/* Score */}
          <div className="text-center">
            <div className="font-mono text-5xl font-bold text-[#f5f0e6] tabular-nums">
              {aggregate.score.toLocaleString()}
            </div>
            <div className="font-display text-xs text-[#57534e] tracking-widest mt-2">
              SCORE
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          <StatCard label="ACCURACY" value={`${aggregate.accuracy}%`} />
          <StatCard label="MAX STREAK" value={aggregate.maxStreak.toString()} />
          <StatCard
            label="PERFECT"
            value={aggregate.perfectCount.toString()}
            color="perfect"
          />
          <StatCard
            label="GOOD"
            value={aggregate.goodCount.toString()}
            color="good"
          />
          <StatCard
            label="OK"
            value={aggregate.okCount.toString()}
            color="ok"
          />
          <StatCard
            label="MISS"
            value={aggregate.missCount.toString()}
            color="miss"
          />
          <StatCard label="TOTAL NOTES" value={aggregate.totalNotes.toString()} />
          <StatCard label="TIMING" value={timingTendency} />
        </div>

        {/* Timing Histogram */}
        <div className="bg-[#0a0a0a] border border-[#292524] rounded p-4 mb-8">
          <h3 className="font-display text-xs text-[#78716c] tracking-widest mb-4">
            TIMING DISTRIBUTION
          </h3>
          <TimingHistogram buckets={timingDistribution} />
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={onPlayAgain}
            className="flex-1 py-4 px-6 bg-[#dc2626] hover:bg-[#ef4444] text-[#f5f0e6] rounded font-display text-lg tracking-wide transition-all hover:shadow-[0_0_30px_rgba(220,38,38,0.5)]"
          >
            PLAY AGAIN
          </button>
          <button
            onClick={onExit}
            className="flex-1 py-4 px-6 bg-[#292524] hover:bg-[#3f3f46] border border-[#57534e] text-[#f5f0e6] rounded font-display text-lg tracking-wide transition-all hover:border-[#dc2626]"
          >
            BACK TO TAB
          </button>
        </div>

        {/* Speed indicator */}
        {session.playbackSpeed < 1 && (
          <p className="text-center text-[#78716c] text-sm mt-4 font-mono">
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
  color?: 'perfect' | 'good' | 'ok' | 'miss';
}

function StatCard({ label, value, color }: StatCardProps) {
  const colorClass =
    color === 'perfect'
      ? 'text-[#fbbf24]'
      : color === 'good'
        ? 'text-[#f5f0e6]'
        : color === 'ok'
          ? 'text-[#d97706]'
          : color === 'miss'
            ? 'text-[#dc2626]'
            : 'text-[#f5f0e6]';

  return (
    <div className="bg-[#0a0a0a] border border-[#292524] rounded px-3 py-3 text-center">
      <div className={`font-mono text-xl font-bold tabular-nums ${colorClass}`}>
        {value}
      </div>
      <div className="font-display text-[10px] text-[#57534e] tracking-widest mt-1">
        {label}
      </div>
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
                  isCenter
                    ? 'bg-[#fbbf24] shadow-[0_0_10px_rgba(251,191,36,0.4)]'
                    : 'bg-[#57534e]'
                }`}
                style={{ height: `${Math.max(height, 4)}%` }}
              />
            </div>
            {/* Label */}
            <div className="text-[10px] text-[#78716c] mt-2 whitespace-nowrap font-mono">
              {bucket.label}
            </div>
            {/* Count */}
            <div className="text-[10px] text-[#57534e] tabular-nums font-mono">
              {bucket.count}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getGradeColor(grade: string): string {
  switch (grade) {
    case 'S':
      return 'text-[#fbbf24]'; // Golden
    case 'A':
      return 'text-[#f5f0e6]'; // Cream white
    case 'B':
      return 'text-[#d97706]'; // Amber
    case 'C':
      return 'text-[#a855f7]'; // Purple
    case 'D':
      return 'text-[#f97316]'; // Orange
    default:
      return 'text-[#dc2626]'; // Blood red for F
  }
}

function getGradeGlow(grade: string): string {
  switch (grade) {
    case 'S':
      return '0 0 60px rgba(251, 191, 36, 0.6), 0 0 120px rgba(251, 191, 36, 0.3)';
    case 'A':
      return '0 0 40px rgba(245, 240, 230, 0.4)';
    case 'B':
      return '0 0 40px rgba(217, 119, 6, 0.4)';
    case 'C':
      return '0 0 40px rgba(168, 85, 247, 0.4)';
    case 'D':
      return '0 0 40px rgba(249, 115, 22, 0.4)';
    default:
      return '0 0 40px rgba(220, 38, 38, 0.4)';
  }
}
