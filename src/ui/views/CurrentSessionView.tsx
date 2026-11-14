import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Flame,
  Info,
  Layers,
  Minus,
  Play,
  Plus,
  ShieldAlert,
  Shuffle,
  UserX,
  SlidersHorizontal,
  Sparkles,
  Split,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wand2,
  XCircle,
} from 'lucide-react';
import {
  Exercise,
  ExerciseSlotEvaluation,
  LoggedSet,
  PlanConfig,
  SessionFinisherBlock,
  SessionSplitType,
  SessionSupersetBlock,
  SupersetPair,
  WorkoutSession,
} from '../../domain/models/types';
import {
  SPLIT_SHORT_LABELS,
  buildFinisherBlock,
  changeFinisherExercise,
  pickExtraFinisherId,
  rebuildSessionForSplit,
  resizeSupersetTargetSets,
  suggestNextSession,
} from '../../domain/engine/sequencer';
import {
  calculateSessionAxialLoad,
  evaluateExerciseSlot,
  rankSupersetsForSession,
} from '../../domain/engine/rulesEngine';
import {
  getFinisherSuggestionIds,
  getPrimaryLiftSuggestionIds as primaryLiftSuggestions,
} from '../../domain/catalog/pickerOptions';
import { ExercisePicker } from '../components/ExercisePicker';
import { BuddyBadge, BuddyToggle } from '../components/BuddyToggle';
import {
  ALL_SPLITS,
  isBuddyDay,
  setSessionBuddy,
} from '../../domain/engine/splits';
import { estimateOneRepMax } from '../../domain/engine/oneRepMax';
import { getDropSetWeights, suggestLoad } from '../../domain/engine/loads';

interface CurrentSessionViewProps {
  plan: PlanConfig;
  exercises: Exercise[];
  curatedSupersets: SupersetPair[];
  activeSession: WorkoutSession | null;
  plannedSessions: WorkoutSession[];
  completedSessions: WorkoutSession[];
  onStartRecommendedSession: (withBuddy?: boolean) => Promise<void>;
  onActivatePlannedSession: (session: WorkoutSession) => Promise<void>;
  onUpdateActiveSession: (session: WorkoutSession) => Promise<void>;
  onCompleteActiveSession: (session: WorkoutSession) => Promise<void>;
  onAbandonActiveSession: (sessionId: string) => Promise<void>;
}

export const CurrentSessionView: React.FC<CurrentSessionViewProps> = ({
  plan,
  exercises,
  curatedSupersets,
  activeSession,
  plannedSessions,
  completedSessions,
  onStartRecommendedSession,
  onActivatePlannedSession,
  onUpdateActiveSession,
  onCompleteActiveSession,
  onAbandonActiveSession,
}) => {
  // Accordion state: only expand one main card at a time on mobile ('PRIMARY' | superset.id | 'FINISHERS' | 'NOTES')
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>('PRIMARY');
  // Toggle for showing exercise swap dropdowns & pivot controls (hidden by default for clean gym-floor logging)
  const [showSessionOptions, setShowSessionOptions] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  // Buddy availability for "Recommend & Start" (defaults from Settings → buddy days)
  const [startWithBuddy, setStartWithBuddy] = useState(() =>
    isBuddyDay(plan, new Date())
  );

  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
  const finisherSuggestions = getFinisherSuggestionIds(exercises);

  // Empty State when no session is currently ACTIVE
  if (!activeSession) {
    const suggestion = suggestNextSession(
      plan,
      completedSessions,
      new Date(),
      startWithBuddy
    );
    const recPrimary = exerciseMap.get(suggestion.recommendedPrimaryLiftId);

    return (
      <div className="space-y-4 pb-24">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 sm:p-7 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
            <Dumbbell className="h-6 w-6" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
              Active Plan: {plan.name}
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white">
              Ready to Train?
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              Next up in your {plan.sessionsPerWeek}x/wk rotation is{' '}
              <strong className="text-zinc-200">
                {SPLIT_SHORT_LABELS[suggestion.splitType]}
              </strong>{' '}
              anchored by <strong className="text-emerald-300">{recPrimary?.name}</strong>.
            </p>
          </div>

          <div className="flex justify-center">
            <BuddyToggle
              checked={startWithBuddy}
              onChange={setStartWithBuddy}
            />
          </div>

          <button
            onClick={() => onStartRecommendedSession(startWithBuddy)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 active:scale-[0.99] hover:bg-emerald-400 px-6 py-4 text-sm font-extrabold text-zinc-950 shadow-lg shadow-emerald-500/20 transition"
          >
            <Sparkles className="h-5 w-5" />
            Recommend &amp; Start {SPLIT_SHORT_LABELS[suggestion.splitType]} Now
          </button>
        </div>

        {plannedSessions.length > 0 && (
          <div className="space-y-2.5">
            <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-zinc-400">
              Or Tap a Planned Session to Start
            </h3>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {plannedSessions.map((ps) => {
                const pEx = exerciseMap.get(ps.primaryLiftId);
                return (
                  <button
                    key={ps.id}
                    onClick={() => onActivatePlannedSession(ps)}
                    className="w-full text-left rounded-2xl border border-zinc-800 bg-zinc-900/70 active:bg-zinc-800 p-4 flex items-center justify-between gap-3 transition"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-emerald-400">
                        {new Date(ps.date).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                      <div className="flex items-center gap-1.5 text-base font-bold text-white truncate">
                        {SPLIT_SHORT_LABELS[ps.splitType]}
                        <span className="text-xs font-semibold text-zinc-400">
                          · {ps.withBuddy ? 'Buddy' : 'Solo'}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400 truncate">
                        {pEx?.name} • {ps.supersets.length} Supersets
                      </div>
                    </div>
                    <span className="inline-flex h-11 px-4 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 text-xs font-extrabold text-zinc-950 shrink-0">
                      <Play className="h-4 w-4 fill-current" />
                      Start
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Active Session Mode
  const primaryEx = exerciseMap.get(activeSession.primaryLiftId);
  const axialLoad = calculateSessionAxialLoad(activeSession, exerciseMap);
  const topE1RM = Math.max(
    0,
    ...activeSession.primaryLiftSets.map((s) =>
      estimateOneRepMax(s.weightKg, s.reps)
    )
  );
  const rankedCurated = rankSupersetsForSession(
    activeSession,
    curatedSupersets,
    completedSessions,
    exercises,
    plan
  );

  // Calculate overall session completion progress
  const primaryDoneCount = activeSession.primaryLiftSets.filter(
    (s) => s.completed
  ).length;
  const primaryTotalCount = activeSession.primaryLiftSets.length;

  const totalSupersetSets = activeSession.supersets.reduce(
    (acc, ss) => acc + ss.setsA.length + ss.setsB.length,
    0
  );
  const completedSupersetSets = activeSession.supersets.reduce(
    (acc, ss) =>
      acc +
      ss.setsA.filter((s) => s.completed).length +
      ss.setsB.filter((s) => s.completed).length,
    0
  );
  const totalFinisherRounds = activeSession.finishers.reduce(
    (acc, f) => acc + f.rounds,
    0
  );
  const completedFinisherRounds = activeSession.finishers.reduce(
    (acc, f) => acc + f.completedRounds,
    0
  );

  const totalItems =
    primaryTotalCount + totalSupersetSets + totalFinisherRounds;
  const completedItems =
    primaryDoneCount + completedSupersetSets + completedFinisherRounds;
  const progressPct =
    totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const toggleBlock = (id: string) => {
    setExpandedBlockId((prev) => (prev === id ? null : id));
  };

  const handlePivotWholeSession = async (newSplit: SessionSplitType) => {
    if (newSplit === activeSession.splitType) return;
    await onUpdateActiveSession(
      rebuildSessionForSplit(
        activeSession,
        newSplit,
        plan,
        completedSessions,
        exercises,
        curatedSupersets
      )
    );
    setShowSessionOptions(false);
  };

  const handleUpdatePrimarySet = (idx: number, patch: Partial<LoggedSet>) => {
    const nextSets = activeSession.primaryLiftSets.map((s, i) =>
      i === idx ? { ...s, ...patch } : s
    );
    onUpdateActiveSession({
      ...activeSession,
      primaryLiftSets: nextSets,
    });
  };

  const handleUpdateSupersetSet = (
    blockId: string,
    slot: 'A' | 'B',
    setIndex: number,
    patch: Partial<LoggedSet>
  ) => {
    onUpdateActiveSession({
      ...activeSession,
      supersets: activeSession.supersets.map((ss) => {
        if (ss.id !== blockId) return ss;
        const key = slot === 'A' ? 'setsA' : 'setsB';
        return {
          ...ss,
          [key]: ss[key].map((s, i) => (i === setIndex ? { ...s, ...patch } : s)),
        };
      }),
    });
  };

  const renderCompactSlotStatus = (
    evalResult: ExerciseSlotEvaluation,
    onQuickSwitch: (repId: string) => void
  ) => {
    if (evalResult.health === 'OPTIMAL') return null;

    const repEx = evalResult.suggestedReplacementId
      ? exerciseMap.get(evalResult.suggestedReplacementId)
      : undefined;

    const colorMap: Record<ExerciseSlotEvaluation['health'], string> = {
      OPTIMAL: 'border-emerald-500/30 bg-emerald-950/30 text-emerald-300',
      NEEDS_SPOTTER: 'border-red-500/60 bg-red-950/50 text-red-200',
      WRONG_STYLE: 'border-sky-500/40 bg-sky-950/40 text-sky-200',
      PROJECTED_OVERWORK: 'border-amber-500/50 bg-amber-950/40 text-amber-200',
      INTRA_SESSION_OVERWORK: 'border-red-500/60 bg-red-950/50 text-red-200',
    };

    return (
      <div
        className={`rounded-xl border p-2.5 text-xs flex flex-wrap items-center justify-between gap-2 ${
          colorMap[evalResult.health]
        }`}
      >
        <div className="flex items-center gap-1.5 font-medium">
          {evalResult.health === 'WRONG_STYLE' && (
            <Info className="h-4 w-4 text-sky-400 shrink-0" />
          )}
          {evalResult.health === 'PROJECTED_OVERWORK' && (
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          )}
          {evalResult.health === 'INTRA_SESSION_OVERWORK' && (
            <ShieldAlert className="h-4 w-4 text-red-400 shrink-0" />
          )}
          {evalResult.health === 'NEEDS_SPOTTER' && (
            <UserX className="h-4 w-4 text-red-400 shrink-0" />
          )}
          <span>
            {evalResult.headline}
            {evalResult.reasons[0] ? `: ${evalResult.reasons[0]}` : ''}
          </span>
        </div>

        {repEx && evalResult.suggestedReplacementId && (
          <button
            onClick={() => onQuickSwitch(evalResult.suggestedReplacementId!)}
            className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-bold text-emerald-300 active:scale-95 transition"
          >
            <Wand2 className="h-3.5 w-3.5" /> Switch → {repEx.shortName ?? repEx.name}
          </button>
        )}
      </div>
    );
  };

  // Mobile-friendly Set Row with +/- touch steppers and large Done button
  // Mobile-friendly set row. Uses a container query (see .set-row in
  // index.css): one line when there is room, otherwise the steppers sit side
  // by side with a full-width Done button underneath. Never overflows.
  const renderStepper = (
    label: string,
    value: number,
    step: number,
    min: number,
    onValue: (v: number) => void,
    area: 'weight' | 'reps'
  ) => (
    <div className="flex min-w-0 items-center gap-1" style={{ gridArea: area }}>
      <button
        type="button"
        onClick={() => onValue(Math.max(min, +(value - step).toFixed(2)))}
        className="flex h-11 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 active:bg-zinc-700 text-zinc-200"
        aria-label={`Decrease ${label}`}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <label className="min-w-0 flex-1 text-center">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          value={value}
          onChange={(e) => onValue(Number(e.target.value))}
          className="w-full min-w-0 bg-transparent text-center text-sm font-extrabold text-white focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="block text-[9px] uppercase text-zinc-500 -mt-1">
          {label}
        </span>
      </label>
      <button
        type="button"
        onClick={() => onValue(+(value + step).toFixed(2))}
        className="flex h-11 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 active:bg-zinc-700 text-zinc-200"
        aria-label={`Increase ${label}`}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  const renderTouchSetRow = (
    set: LoggedSet,
    onChange: (patch: Partial<LoggedSet>) => void
  ) => (
    <div
      key={set.setNumber}
      className={`set-row-wrap rounded-xl border p-2 transition ${
        set.completed
          ? 'border-emerald-500/50 bg-emerald-950/25'
          : 'border-zinc-800 bg-zinc-950/80'
      }`}
    >
      <div className="set-row">
        {/* Set number doubles as the big tap-to-complete button */}
        <button
          type="button"
          onClick={() => onChange({ completed: !set.completed })}
          aria-pressed={set.completed}
          aria-label={`Set ${set.setNumber} ${set.completed ? 'done' : 'not done'}`}
          style={{ gridArea: 'done' }}
          className={`flex h-11 min-w-[48px] items-center justify-center gap-1 rounded-xl px-2.5 text-xs font-extrabold active:scale-95 transition ${
            set.completed
              ? 'bg-emerald-500 text-zinc-950 shadow-sm shadow-emerald-500/30'
              : 'bg-zinc-800 text-zinc-300'
          }`}
        >
          {set.completed ? (
            <Check className="h-4 w-4 stroke-[3]" />
          ) : (
            <>
              <Check className="h-3.5 w-3.5 stroke-[3] opacity-40" />
              <span>S{set.setNumber}</span>
            </>
          )}
          <span className="set-row-done-label">
            {set.completed ? `Set ${set.setNumber} done` : '· tap when done'}
          </span>
        </button>

        {renderStepper('kg', set.weightKg, 2.5, 0, (v) => onChange({ weightKg: v }), 'weight')}
        {renderStepper('reps', set.reps, 1, 1, (v) => onChange({ reps: v }), 'reps')}
      </div>
    </div>
  );

  // Explains a break reduction / progression bump for an exercise. If the
  // sets on screen differ from the suggestion, offers a one-tap apply.
  const renderLoadHint = (
    exerciseId: string | undefined,
    sets: LoggedSet[],
    onApply: (next: LoggedSet[]) => void
  ) => {
    if (!exerciseId || sets.every((s) => s.completed)) return null;
    const suggestion = suggestLoad(
      exerciseId,
      sets.length,
      completedSessions,
      exerciseMap,
      new Date(activeSession.date)
    );
    const adj = suggestion.adjustment;
    if (!adj) return null;
    const applied = sets.every(
      (s, i) => s.completed || s.weightKg === suggestion.sets[i].weightKg
    );
    const isBreak = adj.kind === 'BREAK';
    return (
      <div
        className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${
          isBreak
            ? 'border-sky-500/40 bg-sky-950/40 text-sky-200'
            : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
        }`}
      >
        <div className="flex min-w-0 flex-1 items-start gap-1.5">
          {isBreak ? (
            <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
          ) : (
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          )}
          <span>{adj.note}</span>
        </div>
        {!applied && (
          <button
            type="button"
            onClick={() =>
              onApply(
                sets.map((s, i) =>
                  s.completed ? s : { ...s, ...suggestion.sets[i] }
                )
              )
            }
            className="inline-flex h-9 items-center rounded-lg bg-zinc-900 px-3 text-xs font-bold text-emerald-300 active:scale-95 transition"
          >
            Use {adj.toKg} kg
          </button>
        )}
      </div>
    );
  };

  const primaryEval = evaluateExerciseSlot({
    exerciseId: activeSession.primaryLiftId,
    slotRole: 'PRIMARY',
    session: activeSession,
    priorSessions: completedSessions,
    exercises,
    plan,
  });

  const isPrimaryExpanded = expandedBlockId === 'PRIMARY';

  return (
    <div className="space-y-3.5 pb-28">
      {/* COMPACT MOBILE TOP STATUS BAR */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                Active Workout • {progressPct}% Done
              </span>
            </div>
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-extrabold text-white truncate">
              {SPLIT_SHORT_LABELS[activeSession.splitType]}
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-400">
                <BuddyBadge withBuddy={activeSession.withBuddy} />·{' '}
                {activeSession.withBuddy ? 'Buddy' : 'Solo'}
              </span>
            </h2>
          </div>

          <button
            onClick={() => setShowSessionOptions(!showSessionOptions)}
            className={`inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition ${
              showSessionOptions
                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                : 'border-zinc-800 bg-zinc-950 text-zinc-300'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Options / Pivot</span>
          </button>
        </div>

        {/* Thin Session Progress Bar */}
        <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Collapsible Session Options Drawer (Pivot Split, Axial Load, Abandon) */}
        {showSessionOptions && (
          <div className="pt-3 border-t border-zinc-800 space-y-3">
            <BuddyToggle
              className="w-full"
              checked={Boolean(activeSession.withBuddy)}
              onChange={(next) =>
                onUpdateActiveSession(
                  setSessionBuddy(activeSession, next, exerciseMap)
                )
              }
            />
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">
                Spinal Axial Load:{' '}
                <strong
                  className={axialLoad > 4 ? 'text-red-400' : 'text-white'}
                >
                  {axialLoad} / 4 ceiling
                </strong>
              </span>
              <button
                onClick={() => onAbandonActiveSession(activeSession.id)}
                className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-950/30 px-2.5 py-1 text-xs font-semibold text-red-300"
              >
                <XCircle className="h-3.5 w-3.5" /> Abandon Session
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-zinc-400">
                Pivot entire session to a different split (keeps Buddy/Solo):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ALL_SPLITS.map((sp) => (
                  <button
                    key={sp}
                    onClick={() => handlePivotWholeSession(sp)}
                    className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                      activeSession.splitType === sp
                        ? 'bg-emerald-500 text-zinc-950'
                        : 'bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    {SPLIT_SHORT_LABELS[sp]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CARD 1: PRIMARY ANCHOR LIFT (Collapsible Card) */}
      <div
        className={`rounded-2xl border transition ${
          isPrimaryExpanded
            ? 'border-emerald-500/40 bg-zinc-900/90'
            : 'border-zinc-800 bg-zinc-900/60'
        }`}
      >
        <button
          type="button"
          onClick={() => toggleBlock('PRIMARY')}
          className="w-full p-4 flex items-center justify-between gap-3 text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-extrabold text-xs ${
                primaryDoneCount === primaryTotalCount && primaryTotalCount > 0
                  ? 'bg-emerald-500 text-zinc-950'
                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {primaryDoneCount === primaryTotalCount && primaryTotalCount > 0 ? (
                <Check className="h-5 w-5 stroke-[3]" />
              ) : (
                '1'
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                Primary Lift • {primaryDoneCount}/{primaryTotalCount} Sets
              </div>
              <div className="text-base font-extrabold text-white truncate">
                {primaryEx?.name}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {topE1RM > 0 && (
              <span className="rounded-lg bg-zinc-950 border border-zinc-800 px-2 py-1 text-[11px] font-bold text-emerald-300">
                1RM {topE1RM}kg
              </span>
            )}
            {isPrimaryExpanded ? (
              <ChevronUp className="h-5 w-5 text-zinc-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-zinc-400" />
            )}
          </div>
        </button>

        {isPrimaryExpanded && (
          <div className="px-3.5 pb-4 pt-1 border-t border-zinc-800/80 space-y-3">
            {/* Swap Primary Lift Toggle */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-xs text-zinc-400">
                Tap +/- to adjust weight &amp; reps
              </span>
              <button
                type="button"
                onClick={() =>
                  setEditingBlockId(
                    editingBlockId === 'PRIMARY' ? null : 'PRIMARY'
                  )
                }
                className="text-xs font-semibold text-emerald-400"
              >
                {editingBlockId === 'PRIMARY' ? 'Done Swapping' : 'Swap Lift'}
              </button>
            </div>

            {editingBlockId === 'PRIMARY' && (
              <ExercisePicker
                exercises={exercises}
                value={activeSession.primaryLiftId}
                sheetTitle="Swap primary lift"
                suggestedIds={primaryLiftSuggestions(
                  activeSession.splitType,
                  Boolean(activeSession.withBuddy)
                )}
                suggestedLabel={`Recommended for ${SPLIT_SHORT_LABELS[activeSession.splitType]}`}
                onChange={(id) => {
                  onUpdateActiveSession({
                    ...activeSession,
                    primaryLiftId: id,
                  });
                  setEditingBlockId(null);
                }}
              />
            )}

            {renderCompactSlotStatus(primaryEval, (repId) =>
              onUpdateActiveSession({
                ...activeSession,
                primaryLiftId: repId,
              })
            )}

            {renderLoadHint(
              activeSession.primaryLiftId,
              activeSession.primaryLiftSets,
              (next) =>
                onUpdateActiveSession({ ...activeSession, primaryLiftSets: next })
            )}

            <div className="space-y-2">
              {activeSession.primaryLiftSets.map((set, idx) =>
                renderTouchSetRow(set, (patch) =>
                  handleUpdatePrimarySet(idx, patch)
                )
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  const last =
                    activeSession.primaryLiftSets[
                      activeSession.primaryLiftSets.length - 1
                    ];
                  onUpdateActiveSession({
                    ...activeSession,
                    primaryLiftSets: [
                      ...activeSession.primaryLiftSets,
                      {
                        setNumber: activeSession.primaryLiftSets.length + 1,
                        weightKg: last?.weightKg ?? 80,
                        reps: last?.reps ?? 6,
                        completed: false,
                      },
                    ],
                  });
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-zinc-800 px-3.5 text-xs font-bold text-zinc-200"
              >
                <Plus className="h-4 w-4" /> Add Set
              </button>

              {activeSession.primaryLiftSets.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    onUpdateActiveSession({
                      ...activeSession,
                      primaryLiftSets: activeSession.primaryLiftSets.slice(
                        0,
                        -1
                      ),
                    })
                  }
                  className="text-xs font-semibold text-zinc-500 hover:text-red-400 px-2 py-1"
                >
                  Remove Last Set
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CARDS 2..N: SUPERSET BLOCKS (Collapsible Mobile Cards) */}
      {activeSession.supersets.map((block, bIdx) => {
        const isExpanded = expandedBlockId === block.id;
        const isEditing = editingBlockId === block.id;
        const isSplit = block.executionMode === 'SPLIT_STANDALONE';
        const exA = exerciseMap.get(block.exerciseAId);
        const exB = exerciseMap.get(block.exerciseBId);

        const doneA = block.setsA.filter((s) => s.completed).length;
        const doneB = block.setsB.filter((s) => s.completed).length;
        const totalBlockSets = block.setsA.length + block.setsB.length;
        const doneBlockSets = doneA + doneB;
        const allBlockDone =
          totalBlockSets > 0 && doneBlockSets === totalBlockSets;

        const evalA = evaluateExerciseSlot({
          exerciseId: block.exerciseAId,
          slotRole: 'SUPERSET_A',
          partnerExerciseId: block.exerciseBId,
          session: activeSession,
          priorSessions: completedSessions,
          exercises,
          plan,
        });
        const evalB = evaluateExerciseSlot({
          exerciseId: block.exerciseBId,
          slotRole: 'SUPERSET_B',
          partnerExerciseId: block.exerciseAId,
          session: activeSession,
          priorSessions: completedSessions,
          exercises,
          plan,
        });

        return (
          <div
            key={block.id}
            className={`rounded-2xl border transition ${
              isExpanded
                ? 'border-emerald-500/40 bg-zinc-900/90'
                : 'border-zinc-800 bg-zinc-900/60'
            }`}
          >
            {/* Card Header (Tap to Expand/Collapse) */}
            <button
              type="button"
              onClick={() => toggleBlock(block.id)}
              className="w-full p-4 flex items-center justify-between gap-3 text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-extrabold text-xs ${
                    allBlockDone
                      ? 'bg-emerald-500 text-zinc-950'
                      : 'bg-zinc-800 text-emerald-400'
                  }`}
                >
                  {allBlockDone ? (
                    <Check className="h-5 w-5 stroke-[3]" />
                  ) : (
                    `SS${bIdx + 1}`
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    <span>
                      {isSplit ? 'Split Singles' : 'Superset'} • {block.targetSets}{' '}
                      Sets
                    </span>
                    <span className="text-zinc-400">
                      ({doneBlockSets}/{totalBlockSets} Done)
                    </span>
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-white truncate">
                    {exA?.name} + {exB?.name}
                  </div>
                </div>
              </div>

              {isExpanded ? (
                <ChevronUp className="h-5 w-5 text-zinc-400 shrink-0" />
              ) : (
                <ChevronDown className="h-5 w-5 text-zinc-400 shrink-0" />
              )}
            </button>

            {isExpanded && (
              <div className="px-3.5 pb-4 pt-2 border-t border-zinc-800/80 space-y-4">
                {/* Quick Action Toolbar: 2 vs 3 Sets, Split Singles, Swap/Remove */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* 2 Sets vs 3 Sets Pill */}
                  <div className="inline-flex rounded-xl border border-zinc-700 bg-zinc-950 p-1">
                    {([2, 3] as const).map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() =>
                          onUpdateActiveSession({
                            ...activeSession,
                            supersets: activeSession.supersets.map((s) =>
                              s.id === block.id
                                ? resizeSupersetTargetSets(s, cnt)
                                : s
                            ),
                          })
                        }
                        className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                          block.targetSets === cnt
                            ? 'bg-emerald-500 text-zinc-950'
                            : 'text-zinc-400'
                        }`}
                      >
                        {cnt} Sets
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateActiveSession({
                          ...activeSession,
                          supersets: activeSession.supersets.map((s) =>
                            s.id === block.id
                              ? {
                                  ...s,
                                  executionMode: isSplit
                                    ? 'PAIRED'
                                    : 'SPLIT_STANDALONE',
                                }
                              : s
                          ),
                        })
                      }
                      className={`inline-flex h-9 items-center gap-1 rounded-xl border px-3 text-xs font-bold ${
                        isSplit
                          ? 'border-amber-500/50 bg-amber-950/40 text-amber-200'
                          : 'border-zinc-700 bg-zinc-800 text-zinc-200'
                      }`}
                    >
                      {isSplit ? (
                        <>
                          <Shuffle className="h-3.5 w-3.5" /> Paired
                        </>
                      ) : (
                        <>
                          <Split className="h-3.5 w-3.5" /> Split Singles
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setEditingBlockId(isEditing ? null : block.id)
                      }
                      className="inline-flex h-9 items-center rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 text-xs font-semibold text-emerald-400"
                    >
                      {isEditing ? 'Done' : 'Swap'}
                    </button>

                    {activeSession.supersets.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateActiveSession({
                            ...activeSession,
                            supersets: activeSession.supersets.filter(
                              (s) => s.id !== block.id
                            ),
                          })
                        }
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-red-400"
                        aria-label="Remove superset"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Exercise A & Exercise B Sub-Sections */}
                <div className="space-y-4">
                  {(['A', 'B'] as const).map((slot) => {
                    const ex = slot === 'A' ? exA : exB;
                    const sets = slot === 'A' ? block.setsA : block.setsB;
                    const slotEval = slot === 'A' ? evalA : evalB;

                    return (
                      <div
                        key={slot}
                        className="rounded-xl border border-zinc-800/90 bg-zinc-950/60 p-3 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-xs font-extrabold text-emerald-300">
                              {bIdx + 1}
                              {slot}
                            </span>
                            <span className="text-sm font-bold text-white truncate">
                              {ex?.name}
                            </span>
                          </div>
                          <span className="text-[11px] text-zinc-500 shrink-0">
                            {ex?.defaultReps ?? '10-12'} reps
                          </span>
                        </div>

                        {isEditing && (
                          <ExercisePicker
                            exercises={exercises}
                            value={ex?.id}
                            size="sm"
                            sheetTitle={`Swap exercise ${bIdx + 1}${slot}`}
                            onChange={(pickedId) =>
                              onUpdateActiveSession({
                                ...activeSession,
                                supersets: activeSession.supersets.map((s) =>
                                  s.id === block.id
                                    ? {
                                        ...s,
                                        supersetPairId: undefined,
                                        customName: 'Custom Pairing',
                                        ...(slot === 'A'
                                          ? { exerciseAId: pickedId }
                                          : { exerciseBId: pickedId }),
                                      }
                                    : s
                                ),
                              })
                            }
                          />
                        )}

                        {renderCompactSlotStatus(slotEval, (repId) =>
                          onUpdateActiveSession({
                            ...activeSession,
                            supersets: activeSession.supersets.map((s) =>
                              s.id === block.id
                                ? {
                                    ...s,
                                    supersetPairId: undefined,
                                    customName: 'Custom Pairing',
                                    ...(slot === 'A'
                                      ? { exerciseAId: repId }
                                      : { exerciseBId: repId }),
                                  }
                                : s
                            ),
                          })
                        )}

                        {renderLoadHint(ex?.id, sets, (next) =>
                          onUpdateActiveSession({
                            ...activeSession,
                            supersets: activeSession.supersets.map((s) =>
                              s.id === block.id
                                ? {
                                    ...s,
                                    ...(slot === 'A'
                                      ? { setsA: next }
                                      : { setsB: next }),
                                  }
                                : s
                            ),
                          })
                        )}

                        <div className="space-y-2">
                          {sets.map((s, sIdx) =>
                            renderTouchSetRow(s, (patch) =>
                              handleUpdateSupersetSet(
                                block.id,
                                slot,
                                sIdx,
                                patch
                              )
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add Another Superset Button (Compact) */}
      {activeSession.supersets.length < 4 && (
        <button
          type="button"
          onClick={() => {
            const topRec = rankedCurated[0]?.superset ?? curatedSupersets[0];
            const newBlock: SessionSupersetBlock = {
              id: `ss_act_${Date.now()}`,
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
            onUpdateActiveSession({
              ...activeSession,
              supersets: [...activeSession.supersets, newBlock],
            });
            setExpandedBlockId(newBlock.id);
          }}
          className="w-full rounded-2xl border border-dashed border-zinc-800 hover:border-emerald-500/50 py-3 text-xs font-bold text-zinc-400 hover:text-emerald-300 flex items-center justify-center gap-1.5 transition"
        >
          <Layers className="h-4 w-4" /> + Add Superset ({activeSession.supersets.length}/4)
        </button>
      )}

      {/* CARD 3: FINISHERS (Collapsible Mobile Card) */}
      <div
        className={`rounded-2xl border transition ${
          expandedBlockId === 'FINISHERS'
            ? 'border-emerald-500/40 bg-zinc-900/90'
            : 'border-zinc-800 bg-zinc-900/60'
        }`}
      >
        <button
          type="button"
          onClick={() => toggleBlock('FINISHERS')}
          className="w-full p-4 flex items-center justify-between gap-3 text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-extrabold text-xs ${
                completedFinisherRounds === totalFinisherRounds &&
                totalFinisherRounds > 0
                  ? 'bg-emerald-500 text-zinc-950'
                  : 'bg-zinc-800 text-amber-400'
              }`}
            >
              <Flame className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                Finisher • {completedFinisherRounds}/{totalFinisherRounds} Rounds
              </div>
              <div className="text-sm sm:text-base font-extrabold text-white truncate">
                {activeSession.finishers
                  .map((f) => exerciseMap.get(f.exerciseId)?.name)
                  .join(' + ')}
              </div>
            </div>
          </div>

          {expandedBlockId === 'FINISHERS' ? (
            <ChevronUp className="h-5 w-5 text-zinc-400 shrink-0" />
          ) : (
            <ChevronDown className="h-5 w-5 text-zinc-400 shrink-0" />
          )}
        </button>

        {expandedBlockId === 'FINISHERS' && (
          <div className="px-3.5 pb-4 pt-2 border-t border-zinc-800/80 space-y-3">
            {activeSession.finishers.map((fin) => {
              const ex = exerciseMap.get(fin.exerciseId);
              return (
                <div
                  key={fin.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3.5 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <ExercisePicker
                        exercises={exercises}
                        value={fin.exerciseId}
                        size="sm"
                        sheetTitle="Choose finisher"
                        suggestedIds={finisherSuggestions}
                        suggestedLabel="Finisher favourites"
                        onChange={(pickedId) =>
                          onUpdateActiveSession({
                            ...activeSession,
                            finishers: activeSession.finishers.map((f) =>
                              f.id === fin.id
                                ? changeFinisherExercise(
                                    f,
                                    exerciseMap.get(pickedId),
                                    pickedId
                                  )
                                : f
                            ),
                          })
                        }
                      />
                    </div>
                    {activeSession.finishers.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateActiveSession({
                            ...activeSession,
                            finishers: activeSession.finishers.filter(
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

                  {fin.protocolNote && (
                    <p className="text-xs font-semibold text-emerald-300 leading-relaxed">
                      Each round: {fin.protocolNote}
                    </p>
                  )}
                  {ex?.dropSetDrops && (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200">
                      <span className="font-semibold text-zinc-400">
                        {ex.equipment === 'BARBELL' ? 'Bars to set out: ' : 'Weights: '}
                      </span>
                      <span className="font-extrabold">
                        {getDropSetWeights(
                          fin.loadKg ?? ex.finisherLoadKg ?? 20,
                          ex.loadStepKg,
                          ex.dropSetDrops
                        ).join(' → ')}{' '}
                        kg
                      </span>
                    </div>
                  )}
                  {ex?.executionDirections && (
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {ex.executionDirections}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-zinc-400">
                        {ex?.dropSetDrops ? 'Start (kg):' : 'Load (kg):'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateActiveSession({
                            ...activeSession,
                            finishers: activeSession.finishers.map((f) =>
                              f.id === fin.id
                                ? {
                                    ...f,
                                    loadKg: Math.max(
                                      0,
                                      (f.loadKg ?? 25) - (ex?.loadStepKg ?? 2.5)
                                    ),
                                  }
                                : f
                            ),
                          })
                        }
                        className="flex h-9 w-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-200"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-10 text-center text-sm font-extrabold text-white">
                        {fin.loadKg ?? 25}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateActiveSession({
                            ...activeSession,
                            finishers: activeSession.finishers.map((f) =>
                              f.id === fin.id
                                ? {
                                    ...f,
                                    loadKg:
                                      (f.loadKg ?? 25) + (ex?.loadStepKg ?? 2.5),
                                  }
                                : f
                            ),
                          })
                        }
                        className="flex h-9 w-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-200"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: fin.rounds }, (_, i) => i + 1).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() =>
                            onUpdateActiveSession({
                              ...activeSession,
                              finishers: activeSession.finishers.map((f) =>
                                f.id === fin.id
                                  ? {
                                      ...f,
                                      completedRounds:
                                        f.completedRounds === r ? r - 1 : r,
                                    }
                                  : f
                              ),
                            })
                          }
                          className={`h-10 px-3.5 rounded-xl text-xs font-extrabold transition ${
                            fin.completedRounds >= r
                              ? 'bg-emerald-500 text-zinc-950'
                              : 'bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          R{r}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            {activeSession.finishers.length < 2 && (
              <button
                type="button"
                onClick={() => {
                  const finId = pickExtraFinisherId(activeSession, exercises);
                  const newFin = buildFinisherBlock(
                    exerciseMap.get(finId),
                    finId
                  );
                  onUpdateActiveSession({
                    ...activeSession,
                    finishers: [...activeSession.finishers, newFin],
                  });
                }}
                className="text-xs font-bold text-emerald-400"
              >
                + Add Second Finisher
              </button>
            )}
          </div>
        )}
      </div>

      {/* SESSION NOTES & STICKY-STYLE COMPLETE BAR */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-3">
        <input
          type="text"
          placeholder="Tap to add session notes (e.g., bar speed, partner swaps)..."
          value={activeSession.notes ?? ''}
          onChange={(e) =>
            onUpdateActiveSession({
              ...activeSession,
              notes: e.target.value,
            })
          }
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs sm:text-sm text-white"
        />

        <button
          type="button"
          onClick={() => onCompleteActiveSession(activeSession)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 active:scale-[0.99] hover:bg-emerald-400 py-4 text-sm font-extrabold text-zinc-950 shadow-lg shadow-emerald-500/20 transition"
        >
          <CheckCircle2 className="h-5 w-5" />
          Complete Workout &amp; Save to History
        </button>
      </div>
    </div>
  );
};
