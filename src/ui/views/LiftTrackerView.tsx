import React, { useState } from 'react';
import { Award, Calendar, Dumbbell, Trash2, TrendingUp } from 'lucide-react';
import { Exercise, WorkoutSession } from '../../domain/models/types';
import { extractMainLiftHistory } from '../../domain/engine/oneRepMax';
import { SPLIT_LABELS } from '../../domain/engine/sequencer';

interface LiftTrackerViewProps {
  exercises: Exercise[];
  sessions: WorkoutSession[];
  onDeleteSession: (sessionId: string) => Promise<void>;
}

export const LiftTrackerView: React.FC<LiftTrackerViewProps> = ({
  exercises,
  sessions,
  onDeleteSession,
}) => {
  const anchorExercises = exercises.filter((e) => e.isPrimaryAnchorCandidate);
  const [selectedLiftId, setSelectedLiftId] = useState<string>('bb_flat_bench');

  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
  const selectedExercise = exerciseMap.get(selectedLiftId);
  const history = extractMainLiftHistory(sessions, selectedLiftId);

  const best1RM = history.reduce(
    (max, r) => (r.estimated1RM > max ? r.estimated1RM : max),
    0
  );
  const latestRecord = history[history.length - 1];

  return (
    <div className="space-y-6 pb-16">
      {/* Main Lift Selector */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              <TrendingUp className="h-4 w-4" />
              Main Lift 1RM & Top-Set Tracker
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white mt-0.5">
              {selectedExercise?.name}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3.5 py-2 text-right">
              <div className="text-[10px] uppercase tracking-wider text-emerald-300">
                Best Est. 1RM
              </div>
              <div className="text-lg font-bold text-white">
                {best1RM > 0 ? `${best1RM} kg` : '—'}
              </div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-right">
              <div className="text-[10px] uppercase tracking-wider text-zinc-400">
                Latest Top Set
              </div>
              <div className="text-lg font-bold text-white">
                {latestRecord
                  ? `${latestRecord.topWeightKg}kg × ${latestRecord.topReps}`
                  : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Anchor Lift Pills */}
        <div className="flex flex-wrap gap-2">
          {anchorExercises.map((ex) => {
            const count = sessions.filter((s) => s.primaryLiftId === ex.id).length;
            return (
              <button
                key={ex.id}
                onClick={() => setSelectedLiftId(ex.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold border transition ${
                  selectedLiftId === ex.id
                    ? 'border-emerald-500 bg-emerald-500 text-zinc-950'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                {ex.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Progression Bars */}
        {history.length === 0 ? (
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-6 text-center text-sm text-zinc-400">
            No logged sessions for <strong>{selectedExercise?.name}</strong> yet.
            Complete a session with this primary lift to see your progression chart!
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <div className="text-xs font-semibold text-zinc-400">
              Estimated 1RM Progression (Epley Formula)
            </div>
            <div className="grid gap-2">
              {history.map((rec) => {
                const pct = best1RM > 0 ? Math.round((rec.estimated1RM / best1RM) * 100) : 100;
                return (
                  <div
                    key={rec.sessionId}
                    className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400">
                        {new Date(rec.date).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <span className="font-semibold text-white">
                        Top Set: {rec.topWeightKg} kg × {rec.topReps} reps
                      </span>
                      <span className="font-bold text-emerald-400">
                        e1RM: {rec.estimated1RM} kg
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Full Session Log History */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <Calendar className="h-4 w-4 text-emerald-400" />
            Completed Workout Log ({sessions.length} sessions)
          </div>
        </div>

        <div className="space-y-3">
          {sessions.map((session) => {
            const primary = exerciseMap.get(session.primaryLiftId);
            return (
              <div
                key={session.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3.5 space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                        {SPLIT_LABELS[session.splitType]}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {new Date(session.date).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white mt-1 flex items-center gap-1.5">
                      <Dumbbell className="h-4 w-4 text-emerald-400" />
                      Anchor: {primary?.name}
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteSession(session.id)}
                    className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-950/40 hover:text-red-400"
                    title="Delete session log"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Primary sets */}
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {session.primaryLiftSets.map((s) => (
                    <span
                      key={s.setNumber}
                      className="rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-zinc-200"
                    >
                      S{s.setNumber}: <strong>{s.weightKg}kg × {s.reps}</strong>
                      {s.rpe ? ` @${s.rpe}` : ''}
                    </span>
                  ))}
                </div>

                {/* Supersets summary */}
                <div className="grid gap-1.5 sm:grid-cols-2 pt-1">
                  {session.supersets.map((ss, idx) => {
                    const exA = exerciseMap.get(ss.exerciseAId);
                    const exB = exerciseMap.get(ss.exerciseBId);
                    return (
                      <div
                        key={ss.id}
                        className="rounded-lg border border-zinc-800/80 bg-zinc-900/50 px-2.5 py-1.5 text-xs text-zinc-300"
                      >
                        <span className="font-semibold text-emerald-400">
                          {ss.executionMode === 'SPLIT_STANDALONE'
                            ? `[Split ${idx + 1}] `
                            : `[SS ${idx + 1}] `}
                        </span>
                        {exA?.name} + {exB?.name}
                      </div>
                    );
                  })}
                </div>

                {session.notes && (
                  <p className="text-xs italic text-zinc-400 pt-0.5">
                    "{session.notes}"
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
