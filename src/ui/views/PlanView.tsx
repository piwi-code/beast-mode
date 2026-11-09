import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  Play,
  Plus,
  ShieldAlert,
  UserX,
  Users,
  Sparkles,
  Split,
  Trash2,
  Wand2,
} from 'lucide-react';
import {
  Exercise,
  ExerciseSlotEvaluation,
  PlanConfig,
  SessionFinisherBlock,
  SessionSplitType,
  SessionSupersetBlock,
  SupersetPair,
  WorkoutSession,
} from '../../domain/models/types';
import {
  SPLIT_SHORT_LABELS,
  buildDraftSessionFromSuggestion,
  getRotationForPlan,
  rebuildSessionForSplit,
  suggestNextSession,
} from '../../domain/engine/sequencer';
import {
  MUSCLE_LABELS,
  calculateSessionAxialLoad,
  computeMuscleVolumeSummaries,
  evaluateExerciseSlot,
  getWeeklySetCeiling,
  rankSupersetsForSession,
} from '../../domain/engine/rulesEngine';
import {
  getFinisherSuggestionIds,
  getPrimaryLiftSuggestionIds,
} from '../../domain/catalog/pickerOptions';
import { ExercisePicker, SupersetPicker } from '../components/ExercisePicker';
import { ScrollCarousel } from '../components/ScrollCarousel';
import { BuddyBadge, BuddyToggle } from '../components/BuddyToggle';
import { isBuddyDay, setSessionBuddy } from '../../domain/engine/splits';

interface PlanViewProps {
  plan: PlanConfig;
  exercises: Exercise[];
  curatedSupersets: SupersetPair[];
  plannedSessions: WorkoutSession[];
  completedSessions: WorkoutSession[];
  onSaveSession: (session: WorkoutSession) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onActivateSession: (session: WorkoutSession) => Promise<void>;
}

function toDateKey(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const PlanView: React.FC<PlanViewProps> = ({
  plan,
  exercises,
  curatedSupersets,
  plannedSessions,
  completedSessions,
  onSaveSession,
  onDeleteSession,
  onActivateSession,
}) => {
  // Collapsed by default on mobile so landing on Plan is clean and card-focused
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(
    null
  );
  const [showLoadingPanel, setShowLoadingPanel] = useState<boolean>(false);

  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
  const finisherSuggestions = getFinisherSuggestionIds(exercises);
  const sortedPlanned = [...plannedSessions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Pull rotation strictly from the active plan configured on Page 5 (Settings)
  const planSplits = getRotationForPlan(plan);

  // 14-day calendar strip starting today
  const next14Days = Array.from({ length: 14 }, (_, idx) => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    d.setDate(d.getDate() + idx);
    return d;
  });

  const handleScheduleDay = async (targetDate: Date) => {
    const dateIso = targetDate.toISOString();
    const priorAll = [...completedSessions, ...sortedPlanned].filter(
      (s) => new Date(s.date).getTime() < targetDate.getTime()
    );
    const suggestion = suggestNextSession(plan, priorAll, targetDate);
    const draft = buildDraftSessionFromSuggestion(
      suggestion,
      exercises,
      curatedSupersets,
      dateIso,
      'PLANNED'
    );
    await onSaveSession(draft);
    setExpandedSessionId(draft.id);
  };

  const handleAutoPopulateWeek = async () => {
    const existingCount = sortedPlanned.length;
    const needed = Math.max(1, plan.sessionsPerWeek - existingCount);
    let workingHistory = [...completedSessions, ...sortedPlanned];

    for (let i = 0; i < needed; i++) {
      const targetDay = new Date();
      targetDay.setHours(9, 0, 0, 0);
      targetDay.setDate(targetDay.getDate() + (i + 1) * 2);
      const suggestion = suggestNextSession(plan, workingHistory, targetDay);
      const draft = buildDraftSessionFromSuggestion(
        suggestion,
        exercises,
        curatedSupersets,
        targetDay.toISOString(),
        'PLANNED'
      );
      await onSaveSession(draft);
      workingHistory = [...workingHistory, draft];
    }
  };

  const handleSwitchSessionSplit = async (
    session: WorkoutSession,
    newSplit: SessionSplitType
  ) => {
    if (newSplit === session.splitType) return;
    await onSaveSession(
      rebuildSessionForSplit(
        session,
        newSplit,
        plan,
        [...completedSessions, ...sortedPlanned],
        exercises,
        curatedSupersets
      )
    );
  };

  const volumeSummaries = computeMuscleVolumeSummaries(
    sortedPlanned,
    completedSessions,
    exercises,
    plan
  );
  const weeklyCeiling = getWeeklySetCeiling(plan);
  const overworkCount = volumeSummaries.filter(
    (v) => v.statusProjected === 'OVERTRAINING_RISK' || v.recovery48hFlag
  ).length;

  const renderSlotBadgeAndQuickSwitch = (
    evalResult: ExerciseSlotEvaluation,
    onQuickSwitch: (replacementId: string) => void
  ) => {
    const replacementEx = evalResult.suggestedReplacementId
      ? exerciseMap.get(evalResult.suggestedReplacementId)
      : undefined;

    const styles: Record<
      ExerciseSlotEvaluation['health'],
      { badge: string; icon: React.ReactNode }
    > = {
      OPTIMAL: {
        badge: 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300',
        icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />,
      },
      WRONG_STYLE: {
        badge: 'border-sky-500/40 bg-sky-950/40 text-sky-200',
        icon: <Info className="h-3.5 w-3.5 text-sky-400 shrink-0" />,
      },
      PROJECTED_OVERWORK: {
        badge: 'border-amber-500/50 bg-amber-950/40 text-amber-200',
        icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />,
      },
      INTRA_SESSION_OVERWORK: {
        badge: 'border-red-500/60 bg-red-950/50 text-red-200',
        icon: <ShieldAlert className="h-3.5 w-3.5 text-red-400 shrink-0" />,
      },
      NEEDS_SPOTTER: {
        badge: 'border-red-500/60 bg-red-950/50 text-red-200',
        icon: <UserX className="h-3.5 w-3.5 text-red-400 shrink-0" />,
      },
    };

    const st = styles[evalResult.health];

    return (
      <div className="space-y-1.5 mt-1.5">
        <div
          className={`rounded-xl border px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2 ${st.badge}`}
        >
          <div className="flex items-center gap-1.5 font-semibold">
            {st.icon}
            <span>{evalResult.headline}</span>
          </div>

          {replacementEx && evalResult.suggestedReplacementId && (
            <button
              type="button"
              onClick={() => onQuickSwitch(evalResult.suggestedReplacementId!)}
              className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 hover:bg-emerald-500 hover:text-zinc-950 border border-zinc-700 px-2.5 py-1 text-xs font-bold text-emerald-300 active:scale-95 transition"
            >
              <Wand2 className="h-3.5 w-3.5" />
              Switch → {replacementEx.shortName ?? replacementEx.name}
            </button>
          )}
        </div>

        {evalResult.reasons.length > 0 && (
          <ul className="text-[11px] text-zinc-400 space-y-0.5 pl-1">
            {evalResult.reasons.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-24">
      {/* 1. MOBILE-FRIENDLY 14-DAY CALENDAR HORIZON (Swipeable on mobile) */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              <Calendar className="h-3.5 w-3.5" />
              14-Day Horizon • {plan.name}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Tap a day to plan a session, or tap any card below to expand exercises.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAutoPopulateWeek}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-500 active:scale-95 hover:bg-emerald-400 px-3.5 text-xs font-extrabold text-zinc-950 transition"
          >
            <Sparkles className="h-4 w-4" />
            Auto-Plan Week
          </button>
        </div>

        {/* Swipe carousel on mobile (arrows at edges), 7-col grid on desktop */}
        <ScrollCarousel
          ariaLabel="Next 14 days"
          className="flex sm:grid sm:grid-cols-7 gap-2 scroll-px-1 px-1 -mx-1"
        >
          {next14Days.map((day, idx) => {
            const key = toDateKey(day);
            const dayPlanned = sortedPlanned.filter(
              (s) => toDateKey(s.date) === key
            );
            const dayCompleted = completedSessions.filter(
              (s) => toDateKey(s.date) === key
            );
            const isToday = idx === 0;

            return (
              <div
                key={key}
                className={`snap-start shrink-0 w-[88px] sm:w-auto sm:min-w-0 rounded-xl border p-2.5 flex flex-col justify-between min-h-[84px] transition ${
                  dayPlanned.length > 0
                    ? 'border-emerald-500/50 bg-emerald-950/25'
                    : isToday
                    ? 'border-zinc-700 bg-zinc-900'
                    : 'border-zinc-800/80 bg-zinc-950/60'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={`font-semibold ${
                      isToday ? 'text-emerald-400' : 'text-zinc-400'
                    }`}
                  >
                    {day.toLocaleDateString(undefined, { weekday: 'short' })}
                  </span>
                  {isBuddyDay(plan, day) && (
                    <Users
                      className="h-3 w-3 text-emerald-400/70"
                      aria-label="Buddy day"
                    />
                  )}
                  <span className="font-extrabold text-zinc-200">
                    {day.getDate()}
                  </span>
                </div>

                <div className="my-1.5 space-y-1">
                  {dayCompleted.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300 truncate"
                    >
                      ✓ {SPLIT_SHORT_LABELS[c.splitType]}
                    </div>
                  ))}
                  {dayPlanned.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setExpandedSessionId(
                          expandedSessionId === p.id ? null : p.id
                        )
                      }
                      className="flex w-full items-center gap-1 text-left rounded-md bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-1 text-[10px] font-extrabold text-emerald-300"
                      title={p.withBuddy ? 'Buddy session' : 'Solo session'}
                    >
                      <span className="truncate">{SPLIT_SHORT_LABELS[p.splitType]}</span>
                      <BuddyBadge withBuddy={p.withBuddy} />
                    </button>
                  ))}
                </div>

                {dayPlanned.length === 0 && (
                  <button
                    type="button"
                    onClick={() => handleScheduleDay(day)}
                    className="mt-auto w-full rounded-lg border border-dashed border-zinc-800 active:border-emerald-500 py-1 text-[11px] font-semibold text-zinc-400 hover:text-emerald-300 transition"
                  >
                    + Plan
                  </button>
                )}
              </div>
            );
          })}
        </ScrollCarousel>
      </div>

      {/* 2. PLANNED SESSION CARDS (Collapsed by default, tap to expand) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Planned Sessions ({sortedPlanned.length})
          </h3>
          <span className="text-[11px] text-zinc-500">
            Tap a card to configure exercises
          </span>
        </div>

        {sortedPlanned.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 text-center space-y-3">
            <p className="text-xs sm:text-sm text-zinc-400">
              No upcoming sessions scheduled. Tap <strong>+ Plan</strong> on any day above or auto-populate your {plan.name} rotation.
            </p>
            <button
              type="button"
              onClick={handleAutoPopulateWeek}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-500 px-5 text-xs font-extrabold text-zinc-950"
            >
              <Sparkles className="h-4 w-4" /> Auto-Populate Next Sessions
            </button>
          </div>
        ) : (
          sortedPlanned.map((session, sIdx) => {
            const isExpanded = expandedSessionId === session.id;
            const primaryEx = exerciseMap.get(session.primaryLiftId);
            const axial = calculateSessionAxialLoad(session, exerciseMap);
            const includeInLoad = session.includeInProjectedLoad !== false;

            const priorSessions = [
              ...completedSessions,
              ...sortedPlanned.slice(0, sIdx),
            ];

            const primaryEval = evaluateExerciseSlot({
              exerciseId: session.primaryLiftId,
              slotRole: 'PRIMARY',
              session,
              priorSessions,
              exercises,
              plan,
            });

            const rankedCurated = rankSupersetsForSession(
              session,
              curatedSupersets,
              priorSessions,
              exercises,
              plan
            );

            // Count slot health across the session for a quick summary dot on the collapsed card
            const allSlotEvaluations: ExerciseSlotEvaluation['health'][] = [
              primaryEval.health,
            ];
            session.supersets.forEach((ss) => {
              allSlotEvaluations.push(
                evaluateExerciseSlot({
                  exerciseId: ss.exerciseAId,
                  slotRole: 'SUPERSET_A',
                  partnerExerciseId: ss.exerciseBId,
                  session,
                  priorSessions,
                  exercises,
                  plan,
                }).health
              );
              allSlotEvaluations.push(
                evaluateExerciseSlot({
                  exerciseId: ss.exerciseBId,
                  slotRole: 'SUPERSET_B',
                  partnerExerciseId: ss.exerciseAId,
                  session,
                  priorSessions,
                  exercises,
                  plan,
                }).health
              );
            });

            const hasRed =
              allSlotEvaluations.includes('INTRA_SESSION_OVERWORK') ||
              allSlotEvaluations.includes('NEEDS_SPOTTER');
            const hasOrange = allSlotEvaluations.includes('PROJECTED_OVERWORK');
            const hasBlue = allSlotEvaluations.includes('WRONG_STYLE');

            const statusDotColor = hasRed
              ? 'bg-red-400'
              : hasOrange
              ? 'bg-amber-400'
              : hasBlue
              ? 'bg-sky-400'
              : 'bg-emerald-400';

            return (
              <div
                key={session.id}
                className={`rounded-2xl border transition ${
                  isExpanded
                    ? 'border-emerald-500/40 bg-zinc-900/90'
                    : 'border-zinc-800 bg-zinc-900/60'
                }`}
              >
                {/* Touch-Friendly Collapsed Card Header */}
                <div className="p-3.5 sm:p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedSessionId(isExpanded ? null : session.id)
                      }
                      className="flex items-center gap-3 text-left flex-1 min-w-0"
                    >
                      <div className="rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-center shrink-0">
                        <div className="text-[10px] font-bold uppercase text-emerald-400">
                          {new Date(session.date).toLocaleDateString(
                            undefined,
                            {
                              weekday: 'short',
                            }
                          )}
                        </div>
                        <div className="text-sm font-extrabold text-white">
                          {new Date(session.date).toLocaleDateString(
                            undefined,
                            {
                              month: 'short',
                              day: 'numeric',
                            }
                          )}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusDotColor}`}
                          />
                          <span className="text-base font-extrabold text-white truncate">
                            {SPLIT_SHORT_LABELS[session.splitType]}
                          </span>
                          <span
                            className="shrink-0 text-zinc-400"
                            title={session.withBuddy ? 'Buddy session' : 'Solo session'}
                          >
                            <BuddyBadge
                              withBuddy={session.withBuddy}
                              showSolo
                              className="h-4 w-4"
                            />
                          </span>
                        </div>
                        <div className="text-xs text-zinc-400 truncate mt-0.5">
                          {primaryEx?.name} + {session.supersets.length} SS +{' '}
                          {session.finishers.length} Finisher
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onActivateSession(session)}
                        className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-500 active:scale-95 hover:bg-emerald-400 px-3.5 text-xs font-extrabold text-zinc-950 transition"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" />
                        Start
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedSessionId(isExpanded ? null : session.id)
                        }
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-300"
                        aria-label="Toggle session details"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Compact Sub-bar: Future Load Checkbox & Cancel */}
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-xs">
                    <label className="inline-flex items-center gap-2 text-zinc-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={includeInLoad}
                        onChange={(e) =>
                          onSaveSession({
                            ...session,
                            includeInProjectedLoad: e.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded accent-emerald-500"
                      />
                      <span>Include in Future Loading</span>
                    </label>

                    <div className="flex items-center gap-3">
                      <span
                        className={`text-[11px] font-semibold ${
                          axial > 4 ? 'text-red-400' : 'text-zinc-500'
                        }`}
                      >
                        Axial {axial}/4
                      </span>
                      <button
                        type="button"
                        onClick={() => onDeleteSession(session.id)}
                        className="inline-flex items-center gap-1 text-zinc-400 hover:text-red-400 font-semibold"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Cancel
                      </button>
                    </div>
                  </div>
                </div>

                {/* EXPANDED EXERCISE SELECTION PANEL */}
                {isExpanded && (
                  <div className="border-t border-zinc-800 p-3.5 sm:p-5 space-y-4 bg-zinc-950/50 rounded-b-2xl">
                    {/* Plan Rotation Split Selector & Date */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-800/80">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {planSplits.map((sp) => (
                          <button
                            key={sp}
                            type="button"
                            onClick={() => handleSwitchSessionSplit(session, sp)}
                            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                              session.splitType === sp
                                ? 'bg-emerald-500 text-zinc-950'
                                : 'bg-zinc-800 text-zinc-300'
                            }`}
                          >
                            {SPLIT_SHORT_LABELS[sp]}
                          </button>
                        ))}
                      </div>

                      <input
                        type="date"
                        value={toDateKey(session.date)}
                        onChange={(e) => {
                          if (!e.target.value) return;
                          const d = new Date(`${e.target.value}T09:00:00`);
                          onSaveSession({
                            ...session,
                            date: d.toISOString(),
                          });
                        }}
                        className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white"
                      />
                    </div>

                    <BuddyToggle
                      className="w-full sm:w-auto"
                      checked={Boolean(session.withBuddy)}
                      onChange={(next) =>
                        onSaveSession(setSessionBuddy(session, next, exerciseMap))
                      }
                    />

                    {/* 1. PRIMARY ANCHOR LIFT */}
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3.5 space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                        1. Primary Anchor Lift
                      </div>
                      <ExercisePicker
                        exercises={exercises}
                        value={session.primaryLiftId}
                        sheetTitle="Choose primary lift"
                        suggestedIds={getPrimaryLiftSuggestionIds(
                          session.splitType,
                          Boolean(session.withBuddy)
                        )}
                        suggestedLabel={`Recommended for ${SPLIT_SHORT_LABELS[session.splitType]}`}
                        onChange={(id) =>
                          onSaveSession({
                            ...session,
                            primaryLiftId: id,
                          })
                        }
                      />

                      {renderSlotBadgeAndQuickSwitch(primaryEval, (repId) =>
                        onSaveSession({ ...session, primaryLiftId: repId })
                      )}
                    </div>

                    {/* 2. SUPERSETS / SINGLE EXERCISES */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                          2. Supersets ({session.supersets.length} / 4)
                        </span>
                        {session.supersets.length < 4 && (
                          <button
                            type="button"
                            onClick={() => {
                              const topRec =
                                rankedCurated[0]?.superset ??
                                curatedSupersets[0];
                              const newBlock: SessionSupersetBlock = {
                                id: `ss_plan_${Date.now()}`,
                                supersetPairId: topRec.id,
                                customName: topRec.name,
                                exerciseAId: topRec.exerciseAId,
                                exerciseBId: topRec.exerciseBId,
                                executionMode: 'PAIRED',
                                targetSets: 3,
                                setsA: [1, 2, 3].map((n) => ({
                                  setNumber: n,
                                  weightKg: 35,
                                  reps: 10,
                                  completed: false,
                                })),
                                setsB: [1, 2, 3].map((n) => ({
                                  setNumber: n,
                                  weightKg: 20,
                                  reps: 12,
                                  completed: false,
                                })),
                              };
                              onSaveSession({
                                ...session,
                                supersets: [...session.supersets, newBlock],
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-xl bg-zinc-800 px-3 py-1.5 text-xs font-bold text-emerald-300"
                          >
                            <Plus className="h-3.5 w-3.5" /> Add Superset
                          </button>
                        )}
                      </div>

                      {session.supersets.map((ss, idx) => {
                        const evalA = evaluateExerciseSlot({
                          exerciseId: ss.exerciseAId,
                          slotRole: 'SUPERSET_A',
                          partnerExerciseId: ss.exerciseBId,
                          session,
                          priorSessions,
                          exercises,
                          plan,
                        });
                        const evalB = evaluateExerciseSlot({
                          exerciseId: ss.exerciseBId,
                          slotRole: 'SUPERSET_B',
                          partnerExerciseId: ss.exerciseAId,
                          session,
                          priorSessions,
                          exercises,
                          plan,
                        });

                        return (
                          <div
                            key={ss.id}
                            className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3.5 space-y-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <SupersetPicker
                                className="flex-1 min-w-[200px]"
                                supersets={curatedSupersets}
                                exercises={exercises}
                                value={ss.supersetPairId}
                                eyebrow={`Superset #${idx + 1}`}
                                sheetTitle={`Superset #${idx + 1} preset`}
                                suggestedIds={rankedCurated
                                  .slice(0, 3)
                                  .map((r) => r.superset.id)}
                                suggestedLabel="Best fit for this session"
                                onChange={(pickedId) => {
                                  const picked = curatedSupersets.find(
                                    (c) => c.id === pickedId
                                  );
                                  if (!picked) return;
                                  onSaveSession({
                                    ...session,
                                    supersets: session.supersets.map((b) =>
                                      b.id === ss.id
                                        ? {
                                            ...b,
                                            supersetPairId: picked.id,
                                            customName: picked.name,
                                            exerciseAId: picked.exerciseAId,
                                            exerciseBId: picked.exerciseBId,
                                          }
                                        : b
                                    ),
                                  });
                                }}
                              />

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSaveSession({
                                      ...session,
                                      supersets: session.supersets.map((b) =>
                                        b.id === ss.id
                                          ? {
                                              ...b,
                                              executionMode:
                                                b.executionMode === 'PAIRED'
                                                  ? 'SPLIT_STANDALONE'
                                                  : 'PAIRED',
                                            }
                                          : b
                                      ),
                                    })
                                  }
                                  className="inline-flex h-9 items-center gap-1 rounded-xl border border-zinc-700 bg-zinc-950 px-2.5 text-xs font-semibold text-zinc-300"
                                >
                                  <Split className="h-3.5 w-3.5" />
                                  {ss.executionMode === 'PAIRED'
                                    ? 'Paired'
                                    : 'Singles'}
                                </button>

                                {session.supersets.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onSaveSession({
                                        ...session,
                                        supersets: session.supersets.filter(
                                          (b) => b.id !== ss.id
                                        ),
                                      })
                                    }
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-red-400"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              {(['A', 'B'] as const).map((slot) => {
                                const exId =
                                  slot === 'A'
                                    ? ss.exerciseAId
                                    : ss.exerciseBId;
                                const slotEval = slot === 'A' ? evalA : evalB;

                                return (
                                  <div
                                    key={slot}
                                    className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-2.5"
                                  >
                                    <ExercisePicker
                                      exercises={exercises}
                                      value={exId}
                                      eyebrow={`Exercise ${idx + 1}${slot}`}
                                      sheetTitle={`Exercise ${idx + 1}${slot}`}
                                      onChange={(pickedId) =>
                                        onSaveSession({
                                          ...session,
                                          supersets: session.supersets.map(
                                            (b) =>
                                              b.id === ss.id
                                                ? {
                                                    ...b,
                                                    supersetPairId: undefined,
                                                    customName:
                                                      'Custom Pairing',
                                                    ...(slot === 'A'
                                                      ? { exerciseAId: pickedId }
                                                      : { exerciseBId: pickedId }),
                                                  }
                                                : b
                                          ),
                                        })
                                      }
                                    />
                                    {renderSlotBadgeAndQuickSwitch(
                                      slotEval,
                                      (repId) =>
                                        onSaveSession({
                                          ...session,
                                          supersets: session.supersets.map(
                                            (b) =>
                                              b.id === ss.id
                                                ? {
                                                    ...b,
                                                    supersetPairId: undefined,
                                                    customName:
                                                      'Custom Pairing',
                                                    ...(slot === 'A'
                                                      ? { exerciseAId: repId }
                                                      : { exerciseBId: repId }),
                                                  }
                                                : b
                                          ),
                                        })
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 3. FINISHERS */}
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                          3. Finishers ({session.finishers.length} / 2)
                        </span>
                        {session.finishers.length < 2 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newFin: SessionFinisherBlock = {
                                id: `fin_${Date.now()}`,
                                exerciseId: 'farmers_carry_turf',
                                rounds: 3,
                                protocolNote: '3 rounds controlled tempo',
                                loadKg: 25,
                                completedRounds: 0,
                              };
                              onSaveSession({
                                ...session,
                                finishers: [...session.finishers, newFin],
                              });
                            }}
                            className="text-xs font-bold text-emerald-400"
                          >
                            + Add Finisher
                          </button>
                        )}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {session.finishers.map((fin) => {
                          const evalFin = evaluateExerciseSlot({
                            exerciseId: fin.exerciseId,
                            slotRole: 'FINISHER',
                            session,
                            priorSessions,
                            exercises,
                            plan,
                          });
                          return (
                            <div
                              key={fin.id}
                              className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-2.5 space-y-1.5"
                            >
                              <div className="flex items-center gap-2">
                                <ExercisePicker
                                  className="flex-1 min-w-0"
                                  exercises={exercises}
                                  value={fin.exerciseId}
                                  sheetTitle="Choose finisher"
                                  suggestedIds={finisherSuggestions}
                                  suggestedLabel="Finisher favourites"
                                  onChange={(pickedId) =>
                                    onSaveSession({
                                      ...session,
                                      finishers: session.finishers.map((f) =>
                                        f.id === fin.id
                                          ? {
                                              ...f,
                                              exerciseId: pickedId,
                                            }
                                          : f
                                      ),
                                    })
                                  }
                                />
                                {session.finishers.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onSaveSession({
                                        ...session,
                                        finishers: session.finishers.filter(
                                          (f) => f.id !== fin.id
                                        ),
                                      })
                                    }
                                    className="p-2 text-zinc-500 hover:text-red-400"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                              {renderSlotBadgeAndQuickSwitch(evalFin, (repId) =>
                                onSaveSession({
                                  ...session,
                                  finishers: session.finishers.map((f) =>
                                    f.id === fin.id
                                      ? { ...f, exerciseId: repId }
                                      : f
                                  ),
                                })
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 4. SESSION NOTES */}
                    <input
                      type="text"
                      placeholder="Session planning notes (optional)..."
                      value={session.notes ?? ''}
                      onChange={(e) =>
                        onSaveSession({ ...session, notes: e.target.value })
                      }
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white"
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 3. COLLAPSIBLE CURRENT vs PROJECTED MUSCLE LOADING PANEL */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowLoadingPanel(!showLoadingPanel)}
          className="w-full p-4 flex items-center justify-between gap-3 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-white">
                Current vs. Future Muscle Loading
              </div>
              <div className="text-xs text-zinc-400">
                {overworkCount > 0
                  ? `${overworkCount} muscle group(s) near/over ${weeklyCeiling}-set ceiling`
                  : `All muscle groups within ${weeklyCeiling}-set weekly ceiling`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-emerald-400">
              {showLoadingPanel ? 'Hide' : 'Expand'}
            </span>
            {showLoadingPanel ? (
              <ChevronUp className="h-5 w-5 text-zinc-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-zinc-400" />
            )}
          </div>
        </button>

        {showLoadingPanel && (
          <div className="p-4 pt-1 border-t border-zinc-800 space-y-3">
            <p className="text-xs text-zinc-400">
              Solid bar = Current 7-day completed sets. Lighter bar = Projected sets after checked Planned Sessions are executed.
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {volumeSummaries.map((v) => {
                const maxScale = weeklyCeiling + 4;
                const currentPct = Math.min(
                  100,
                  Math.round((v.sets7dCurrent / maxScale) * 100)
                );
                const projectedPct = Math.min(
                  100,
                  Math.round((v.sets7dProjected / maxScale) * 100)
                );
                const futureDeltaPct = Math.max(0, projectedPct - currentPct);

                return (
                  <div
                    key={v.muscle}
                    className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white">
                        {MUSCLE_LABELS[v.muscle]}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-400">
                          Now: <strong>{v.sets7dCurrent}</strong>
                        </span>
                        <span className="text-emerald-400 font-bold">
                          → {v.sets7dProjected} / {weeklyCeiling}
                        </span>
                      </div>
                    </div>

                    <div className="h-2.5 w-full rounded-full bg-zinc-800 overflow-hidden flex">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${currentPct}%` }}
                      />
                      {futureDeltaPct > 0 && (
                        <div
                          className={`h-full transition-all ${
                            v.statusProjected === 'OVERTRAINING_RISK'
                              ? 'bg-red-400'
                              : 'bg-emerald-300/60'
                          }`}
                          style={{ width: `${futureDeltaPct}%` }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
