import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Dumbbell,
  FileText,
  Share2,
  TrendingUp,
} from 'lucide-react';
import { Exercise, WorkoutSession } from '../../domain/models/types';
import { extractCategoryLiftHistory } from '../../domain/engine/oneRepMax';
import { SPLIT_LABELS, SPLIT_SHORT_LABELS } from '../../domain/engine/sequencer';
import { buildSessionSummary } from '../../domain/engine/sessionSummary';
import { shareSessionImage } from '../share/sessionShareImage';

interface HistoryViewProps {
  exercises: Exercise[];
  completedSessions: WorkoutSession[];
  onUpdateSessionNotes: (sessionId: string, notes: string) => Promise<void>;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  exercises,
  completedSessions,
  onUpdateSessionNotes,
}) => {
  const sortedCompleted = [...completedSessions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    sortedCompleted[0]?.id ?? null
  );
  const [notesSavedToast, setNotesSavedToast] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
  const selectedSession = sortedCompleted.find(
    (s) => s.id === selectedSessionId
  );

  const benchRecords = extractCategoryLiftHistory(
    completedSessions,
    'BENCH',
    exercises
  );
  const squatRecords = extractCategoryLiftHistory(
    completedSessions,
    'SQUAT',
    exercises
  );
  const deadliftRecords = extractCategoryLiftHistory(
    completedSessions,
    'DEADLIFT',
    exercises
  );

  const bigThreeCards = [
    {
      title: 'Bench Press',
      subtitle: 'Flat Barbell & DB Bench',
      records: benchRecords,
      accent: 'text-emerald-400',
      bar: 'bg-emerald-500',
    },
    {
      title: 'Back Squat',
      subtitle: 'Barbell Knee-Dominant',
      records: squatRecords,
      accent: 'text-sky-400',
      bar: 'bg-sky-500',
    },
    {
      title: 'Deadlift / RDL',
      subtitle: 'Barbell Posterior Hinge',
      records: deadliftRecords,
      accent: 'text-amber-400',
      bar: 'bg-amber-500',
    },
  ];

  // Build 28-day recent calendar strip
  const past28Days = Array.from({ length: 28 }, (_, idx) => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    d.setDate(d.getDate() - (27 - idx));
    return d;
  });

  const toDateKey = (isoOrDate: string | Date) => {
    const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 pb-20">
      {/* 1. BIG 3 MAIN LIFTS PROGRESS CHARTS */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5 space-y-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <TrendingUp className="h-4 w-4" />
            Main Lifts Progress Charts (Bench • Squat • Deadlift)
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Tracks top-set load and Estimated 1RM (Epley) across all completed sessions.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {bigThreeCards.map((card) => {
            const best1RM = card.records.reduce(
              (m, r) => (r.estimated1RM > m ? r.estimated1RM : m),
              0
            );
            const latest = card.records[card.records.length - 1];

            return (
              <div
                key={card.title}
                className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3.5 flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className={`text-sm font-bold ${card.accent}`}>
                      {card.title}
                    </h3>
                    <div className="text-[11px] text-zinc-500">
                      {card.subtitle}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase text-zinc-400">
                      Best e1RM
                    </div>
                    <div className="text-base font-extrabold text-white">
                      {best1RM > 0 ? `${best1RM} kg` : '—'}
                    </div>
                  </div>
                </div>

                {card.records.length === 0 ? (
                  <div className="py-6 text-center text-xs text-zinc-500">
                    No completed sessions logged yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Mini vertical bar chart */}
                    <div className="h-24 flex items-end gap-1.5 pt-4 px-1 border-b border-zinc-800/80">
                      {card.records.slice(-8).map((r) => {
                        const heightPct =
                          best1RM > 0
                            ? Math.max(
                                25,
                                Math.round((r.estimated1RM / best1RM) * 100)
                              )
                            : 50;
                        return (
                          <button
                            key={r.sessionId}
                            onClick={() => setSelectedSessionId(r.sessionId)}
                            className="flex-1 flex flex-col items-center gap-1 group"
                            title={`${new Date(
                              r.date
                            ).toLocaleDateString()}: ${r.topWeightKg}kg × ${
                              r.topReps
                            } (e1RM ${r.estimated1RM}kg)`}
                          >
                            <span className="text-[9px] text-zinc-400 group-hover:text-white font-semibold">
                              {r.estimated1RM}
                            </span>
                            <div
                              className={`w-full rounded-t ${card.bar} opacity-85 group-hover:opacity-100 transition-all`}
                              style={{ height: `${heightPct}%` }}
                            />
                          </button>
                        );
                      })}
                    </div>

                    {latest && (
                      <div className="flex items-center justify-between text-[11px] text-zinc-400">
                        <span>
                          Latest: <strong className="text-zinc-200">{latest.topWeightKg}kg × {latest.topReps}</strong>
                        </span>
                        <span>
                          {new Date(latest.date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. 28-DAY SESSION CALENDAR & SELECTOR */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              <Calendar className="h-4 w-4" />
              Training History Calendar (Last 4 Weeks)
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Select any recorded session day on the calendar or list below to inspect logged sets and update session notes.
            </p>
          </div>
          <span className="text-xs font-semibold text-zinc-400">
            Total Completed: {sortedCompleted.length}
          </span>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {past28Days.map((d) => {
            const key = toDateKey(d);
            const matches = sortedCompleted.filter(
              (s) => toDateKey(s.date) === key
            );
            const firstMatch = matches[0];
            const isSelected =
              firstMatch && firstMatch.id === selectedSessionId;

            return (
              <button
                key={key}
                disabled={!firstMatch}
                onClick={() => firstMatch && setSelectedSessionId(firstMatch.id)}
                className={`rounded-xl border p-2 text-left min-h-[64px] flex flex-col justify-between transition ${
                  isSelected
                    ? 'border-emerald-400 bg-emerald-500/20'
                    : firstMatch
                    ? 'border-emerald-500/30 bg-zinc-900 hover:border-emerald-500/60 cursor-pointer'
                    : 'border-zinc-800/50 bg-zinc-950/40 opacity-50 cursor-default'
                }`}
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-zinc-500">
                    {d.toLocaleDateString(undefined, { weekday: 'short' })}
                  </span>
                  <span className="font-bold text-zinc-300">{d.getDate()}</span>
                </div>
                {firstMatch && (
                  <div className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 truncate">
                    {SPLIT_SHORT_LABELS[firstMatch.splitType]}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Session Pill Selector */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800/80">
          {sortedCompleted.map((s) => {
            const active = s.id === selectedSessionId;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedSessionId(s.id)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'border-emerald-500 bg-emerald-500 text-zinc-950'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                {new Date(s.date).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                — {SPLIT_SHORT_LABELS[s.splitType]}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. SELECTED SESSION INSPECTOR (Read-only sets + Editable Session Notes) */}
      {selectedSession && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-zinc-800 pb-3">
            <div>
              <span className="text-xs font-semibold text-emerald-400">
                {new Date(selectedSession.date).toLocaleDateString(undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <h3 className="text-lg font-bold text-white">
                {SPLIT_LABELS[selectedSession.splitType]}
              </h3>
            </div>
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                disabled={sharing}
                onClick={async () => {
                  setSharing(true);
                  setShareMessage(null);
                  try {
                    const outcome = await shareSessionImage(
                      buildSessionSummary(selectedSession, exerciseMap)
                    );
                    if (outcome === 'downloaded') {
                      setShareMessage('Image saved to your downloads.');
                    }
                  } catch {
                    setShareMessage('Could not create the image.');
                  } finally {
                    setSharing(false);
                  }
                }}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-extrabold text-zinc-950 transition hover:bg-emerald-400 active:scale-95 disabled:opacity-60"
              >
                <Share2 className="h-4 w-4" />
                {sharing ? 'Preparing…' : 'Share'}
              </button>
              {shareMessage && (
                <span className="text-[11px] text-zinc-400">{shareMessage}</span>
              )}
            </div>
          </div>

          {/* Primary Lift Recorded Sets */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Dumbbell className="h-4 w-4 text-emerald-400" />
              Primary Lift: {exerciseMap.get(selectedSession.primaryLiftId)?.name}
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedSession.primaryLiftSets.map((s) => (
                <span
                  key={s.setNumber}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-200"
                >
                  Set {s.setNumber}: <strong>{s.weightKg} kg × {s.reps} reps</strong>
                  {s.rpe ? (
                    <span title="RPE = Rate of Perceived Exertion: how hard the set felt out of 10. RPE 8 means about 2 reps left in the tank.">
                      {` @ RPE ${s.rpe}`}
                    </span>
                  ) : (
                    ''
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Supersets Recorded */}
          <div className="grid gap-3 sm:grid-cols-2">
            {selectedSession.supersets.map((ss, idx) => {
              const exA = exerciseMap.get(ss.exerciseAId);
              const exB = exerciseMap.get(ss.exerciseBId);
              return (
                <div
                  key={ss.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-400">
                      {ss.executionMode === 'SPLIT_STANDALONE'
                        ? `Split Singles #${idx + 1}`
                        : `Superset #${idx + 1} (${ss.targetSets} Sets)`}
                    </span>
                    <span className="text-zinc-500">{ss.customName}</span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="font-semibold text-white">
                      A: {exA?.name}
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[11px] text-zinc-300">
                      {ss.setsA.map((s) => (
                        <span
                          key={s.setNumber}
                          className="rounded bg-zinc-900 px-2 py-0.5"
                        >
                          {s.weightKg}kg × {s.reps}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1 text-xs pt-1">
                    <div className="font-semibold text-white">
                      B: {exB?.name}
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[11px] text-zinc-300">
                      {ss.setsB.map((s) => (
                        <span
                          key={s.setNumber}
                          className="rounded bg-zinc-900 px-2 py-0.5"
                        >
                          {s.weightKg}kg × {s.reps}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Finishers Recorded */}
          {selectedSession.finishers.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3.5 space-y-1.5">
              <div className="text-xs font-bold text-emerald-400">
                Finishers
              </div>
              {selectedSession.finishers.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between text-xs text-zinc-200"
                >
                  <span>{exerciseMap.get(f.exerciseId)?.name}</span>
                  <span className="text-zinc-400">
                    {f.loadKg ? `${f.loadKg} kg • ` : ''}
                    {f.completedRounds || f.rounds} rounds
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Editable Notes Section */}
          <div className="space-y-2 pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-300">
                <FileText className="h-3.5 w-3.5 text-emerald-400" />
                Session Notes (Editable)
              </label>
              {notesSavedToast && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Saved
                </span>
              )}
            </div>
            <textarea
              rows={2}
              value={selectedSession.notes ?? ''}
              placeholder="Add post-workout notes or observations for this session..."
              onChange={(e) => {
                onUpdateSessionNotes(selectedSession.id, e.target.value);
                setNotesSavedToast(true);
                setTimeout(() => setNotesSavedToast(false), 2000);
              }}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs sm:text-sm text-white"
            />
          </div>
        </div>
      )}
    </div>
  );
};
