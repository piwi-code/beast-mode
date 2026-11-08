import React from 'react';
import { Activity, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import {
  Exercise,
  PlanConfig,
  WorkoutSession,
} from '../../domain/models/types';
import {
  MUSCLE_LABELS,
  computeMuscleVolumeSummaries,
} from '../../domain/engine/rulesEngine';

interface VolumeAnalyticsViewProps {
  plan: PlanConfig;
  exercises: Exercise[];
  sessions: WorkoutSession[];
  activeDraft: WorkoutSession;
}

export const VolumeAnalyticsView: React.FC<VolumeAnalyticsViewProps> = ({
  plan,
  exercises,
  sessions,
  activeDraft,
}) => {
  const summaries = computeMuscleVolumeSummaries(
    activeDraft,
    sessions,
    exercises,
    plan
  );

  const weeklyCeiling =
    plan.sessionsPerWeek === 2 ? 10 : plan.sessionsPerWeek === 3 ? 13 : 15;

  return (
    <div className="space-y-6 pb-16">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
          <Activity className="h-4 w-4" />
          Rolling 48h Recovery, 7-Day Weekly & 14-Day Fortnightly Muscle Volume
        </div>
        <p className="text-xs sm:text-sm text-zinc-400">
          Monitors working set distribution across muscle regions so supersets are spread evenly without overtraining a single region. Primary movers count as <strong>1.0 set</strong>; secondary movers count as <strong>0.5 set</strong>.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
              <Clock className="h-4 w-4" /> 48h Recovery Window
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Flags any muscle group with <strong>&gt; 6 working sets</strong> in the last 48 hours (e.g., Solo Upper → Lower → Buddy Upper turnaround).
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> 7-Day Weekly Band
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Target <strong>4 – {weeklyCeiling} sets/week</strong> for your {plan.sessionsPerWeek}-session/week schedule.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400">
              <AlertCircle className="h-4 w-4" /> 14-Day Fortnightly Spread
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Ensures rolling 2-week balance when running 2-day or 3-day asymmetric splits.
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Muscle Breakdown */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5 space-y-3">
        <h3 className="text-sm font-bold text-white">
          Muscle Group Volume Distribution (Includes Planned Session)
        </h3>

        <div className="space-y-3">
          {summaries.map((item) => {
            const pct7d = Math.min(
              100,
              Math.round((item.sets7d / (weeklyCeiling + 4)) * 100)
            );
            const barColor =
              item.status7d === 'OVERTRAINING_RISK'
                ? 'bg-red-500'
                : item.recovery48hFlag
                ? 'bg-amber-500'
                : item.status7d === 'UNDER'
                ? 'bg-sky-500'
                : 'bg-emerald-500';

            return (
              <div
                key={item.muscle}
                className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">
                      {MUSCLE_LABELS[item.muscle]}
                    </span>
                    {item.recovery48hFlag && (
                      <span className="rounded bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                        48h Fatigue Flag ({item.sets48h} sets)
                      </span>
                    )}
                    {item.status7d === 'OVERTRAINING_RISK' && (
                      <span className="rounded bg-red-500/20 border border-red-500/40 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                        Over-Concentrated (&gt;{weeklyCeiling}/wk)
                      </span>
                    )}
                    {item.status7d === 'UNDER' && (
                      <span className="rounded bg-sky-500/20 border border-sky-500/40 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                        Under-Stimulated — Good Superset Target
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-zinc-300">
                    <span>
                      48h: <strong>{item.sets48h}</strong>
                    </span>
                    <span>
                      7d: <strong className="text-white">{item.sets7d}</strong> / {weeklyCeiling}
                    </span>
                    <span>
                      14d: <strong>{item.sets14d}</strong>
                    </span>
                  </div>
                </div>

                <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${pct7d}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
