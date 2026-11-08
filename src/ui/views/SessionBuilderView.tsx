import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Dumbbell,
  Flame,
  Layers,
  Plus,
  ShieldAlert,
  Shuffle,
  Split,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  Exercise,
  LoggedSet,
  PlanConfig,
  SessionFinisherBlock,
  SessionSplitType,
  SessionSupersetBlock,
  SupersetPair,
  WorkoutSession,
} from '../../domain/models/types';
import {
  SPLIT_LABELS,
  buildDraftSessionFromSuggestion,
  getPrimaryLiftCandidatesForSplit,
  suggestNextSession,
} from '../../domain/engine/sequencer';
import {
  MUSCLE_LABELS,
  calculateSessionAxialLoad,
  computeMuscleVolumeSummaries,
  evaluateSessionSafeguards,
  rankSupersetsForSession,
} from '../../domain/engine/rulesEngine';
import { estimateOneRepMax } from '../../domain/engine/oneRepMax';

interface SessionBuilderViewProps {
  plan: PlanConfig;
  exercises: Exercise[];
  curatedSupersets: SupersetPair[];
  sessions: WorkoutSession[];
  activeDraft: WorkoutSession;
  onUpdateDraft: (updated: WorkoutSession) => void;
  onSaveSession: (session: WorkoutSession) => Promise<void>;
}

const ALL_SPLITS: SessionSplitType[] = [
  'SOLO_UPPER',
  'SOLO_LOWER',
  'BUDDY_UPPER',
  'BUDDY_LOWER',
  'PPL_PUSH',
  'PPL_PULL',
  'PPL_LEGS',
];

export const SessionBuilderView: React.FC<SessionBuilderViewProps> = ({
  plan,
  exercises,
  curatedSupersets,
  sessions,
  activeDraft,
  onUpdateDraft,
  onSaveSession,
}) => {
  const [showAddSupersetModal, setShowAddSupersetModal] = useState(false);
  const [customExA, setCustomExA] = useState<string>('machine_row_narrow');
  const [customExB, setCustomExB] = useState<string>('cable_fly_low_high');
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
  const suggestion = suggestNextSession(plan, sessions);
  const axialLoad = calculateSessionAxialLoad(activeDraft, exerciseMap);
  const safeguards = evaluateSessionSafeguards(
    activeDraft,
    sessions,
    exercises,
    plan
  );
  const rankedSupersets = rankSupersetsForSession(
    activeDraft,
    curatedSupersets,
    sessions,
    exercises,
    plan
  );
  const volumeSummaries = computeMuscleVolumeSummaries(
    activeDraft,
    sessions,
    exercises,
    plan
  );

  const primaryExercise = exerciseMap.get(activeDraft.primaryLiftId);
  const primaryCandidates = getPrimaryLiftCandidatesForSplit(activeDraft.splitType);
  const allAnchorExercises = exercises.filter((e) => e.isPrimaryAnchorCandidate);
  const finisherCandidates = exercises.filter((e) => e.isFinisherCandidate);

  const handleSwitchSplit = (newSplit: SessionSplitType) => {
    const customSuggestion = {
      ...suggestion,
      splitType: newSplit,
      splitLabel: SPLIT_LABELS[newSplit],
      recommendedPrimaryLiftId: getPrimaryLiftCandidatesForSplit(newSplit).recommended,
    };
    const rebuilt = buildDraftSessionFromSuggestion(
      customSuggestion,
      exercises,
      curatedSupersets
    );
    onUpdateDraft(rebuilt);
  };

  const handlePrimaryLiftChange = (newLiftId: string) => {
    onUpdateDraft({
      ...activeDraft,
      primaryLiftId: newLiftId,
    });
  };

  const handleUpdatePrimarySet = (
    index: number,
    patch: Partial<LoggedSet>
  ) => {
    const nextSets = activeDraft.primaryLiftSets.map((s, idx) =>
      idx === index ? { ...s, ...patch } : s
    );
    onUpdateDraft({
      ...activeDraft,
      primaryLiftSets: nextSets,
    });
  };

  const handleAddPrimarySet = () => {
    const last =
      activeDraft.primaryLiftSets[activeDraft.primaryLiftSets.length - 1];
    onUpdateDraft({
      ...activeDraft,
      primaryLiftSets: [
        ...activeDraft.primaryLiftSets,
        {
          setNumber: activeDraft.primaryLiftSets.length + 1,
          weightKg: last?.weightKg ?? 60,
          reps: last?.reps ?? 6,
          rpe: last?.rpe ?? 8,
          completed: false,
        },
      ],
    });
  };

  const handleRemovePrimarySet = (index: number) => {
    if (activeDraft.primaryLiftSets.length <= 1) return;
    const filtered = activeDraft.primaryLiftSets
      .filter((_, idx) => idx !== index)
      .map((s, idx) => ({ ...s, setNumber: idx + 1 }));
    onUpdateDraft({
      ...activeDraft,
      primaryLiftSets: filtered,
    });
  };

  const handleToggleSupersetMode = (blockId: string) => {
    onUpdateDraft({
      ...activeDraft,
      supersets: activeDraft.supersets.map((ss) =>
        ss.id === blockId
          ? {
              ...ss,
              executionMode:
                ss.executionMode === 'PAIRED' ? 'SPLIT_STANDALONE' : 'PAIRED',
            }
          : ss
      ),
    });
  };

  const handleSwapSupersetExercise = (
    blockId: string,
    slot: 'A' | 'B',
    newExerciseId: string
  ) => {
    onUpdateDraft({
      ...activeDraft,
      supersets: activeDraft.supersets.map((ss) => {
        if (ss.id !== blockId) return ss;
        return {
          ...ss,
          supersetPairId: undefined,
          customName: 'Custom Superset Pairing',
          exerciseAId: slot === 'A' ? newExerciseId : ss.exerciseAId,
          exerciseBId: slot === 'B' ? newExerciseId : ss.exerciseBId,
        };
      }),
    });
  };

  const handleUpdateSupersetSet = (
    blockId: string,
    slot: 'A' | 'B',
    setIndex: number,
    patch: Partial<LoggedSet>
  ) => {
    onUpdateDraft({
      ...activeDraft,
      supersets: activeDraft.supersets.map((ss) => {
        if (ss.id !== blockId) return ss;
        const key = slot === 'A' ? 'setsA' : 'setsB';
        const updatedSets = ss[key].map((s, idx) =>
          idx === setIndex ? { ...s, ...patch } : s
        );
        return { ...ss, [key]: updatedSets };
      }),
    });
  };

  const handleAddCuratedSuperset = (pair: SupersetPair) => {
    if (activeDraft.supersets.length >= 4) return;
    const newBlock: SessionSupersetBlock = {
      id: `ss_block_${Date.now()}`,
      supersetPairId: pair.id,
      customName: pair.name,
      exerciseAId: pair.exerciseAId,
      exerciseBId: pair.exerciseBId,
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
    onUpdateDraft({
      ...activeDraft,
      supersets: [...activeDraft.supersets, newBlock],
    });
    setShowAddSupersetModal(false);
  };

  const handleAddCustomSuperset = () => {
    if (activeDraft.supersets.length >= 4) return;
    const exA = exerciseMap.get(customExA);
    const exB = exerciseMap.get(customExB);
    const newBlock: SessionSupersetBlock = {
      id: `ss_custom_${Date.now()}`,
      customName: `${exA?.name ?? 'Exercise A'} + ${exB?.name ?? 'Exercise B'}`,
      exerciseAId: customExA,
      exerciseBId: customExB,
      executionMode: 'PAIRED',
      targetSets: 3,
      setsA: [1, 2, 3].map((n) => ({
        setNumber: n,
        weightKg: 30,
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
    onUpdateDraft({
      ...activeDraft,
      supersets: [...activeDraft.supersets, newBlock],
    });
    setShowAddSupersetModal(false);
  };

  const handleRemoveSuperset = (blockId: string) => {
    onUpdateDraft({
      ...activeDraft,
      supersets: activeDraft.supersets.filter((s) => s.id !== blockId),
    });
  };

  const handleAddFinisher = (exerciseId: string) => {
    if (activeDraft.finishers.length >= 2) return;
    const isSled = exerciseId === 'turf_sled_push_pull';
    const newFin: SessionFinisherBlock = {
      id: `fin_${Date.now()}`,
      exerciseId,
      rounds: 3,
      protocolNote: isSled
        ? '15–20m Forward Push + 15–20m Backward Drag (60–90s rest or You-Go-I-Go)'
        : '3 rounds controlled tempo (60s rest)',
      loadKg: isSled ? 25 : 20,
      completedRounds: 0,
    };
    onUpdateDraft({
      ...activeDraft,
      finishers: [...activeDraft.finishers, newFin],
    });
  };

  const handleRemoveFinisher = (finId: string) => {
    onUpdateDraft({
      ...activeDraft,
      finishers: activeDraft.finishers.filter((f) => f.id !== finId),
    });
  };

  const handleCompleteAndLogSession = async () => {
    const finalized: WorkoutSession = {
      ...activeDraft,
      date: new Date().toISOString(),
      totalAxialLoad: axialLoad,
      status: 'COMPLETED',
      primaryLiftSets: activeDraft.primaryLiftSets.map((s) => ({
        ...s,
        completed: true,
      })),
    };
    await onSaveSession(finalized);
    setSaveBanner(
      `Logged ${SPLIT_LABELS[finalized.splitType]}! Next suggested session queued.`
    );
    setTimeout(() => setSaveBanner(null), 5000);
  };

  const topE1RM = Math.max(
    0,
    ...activeDraft.primaryLiftSets.map((s) =>
      estimateOneRepMax(s.weightKg, s.reps)
    )
  );

  return (
    <div className="space-y-6 pb-20">
      {saveBanner && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/60 p-4 text-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <span className="text-sm font-medium">{saveBanner}</span>
          </div>
        </div>
      )}

      {/* NEXT SESSION SEQUENCER BANNER */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
              <Sparkles className="h-3.5 w-3.5" />
              Smart Session Sequencer ({plan.sessionsPerWeek}x/wk {plan.scheduleFamily === 'PPL' ? 'PPL' : 'Upper/Lower'})
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white">
              {SPLIT_LABELS[activeDraft.splitType]}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">{suggestion.rationale}</p>
          </div>

          {/* Axial Load Gauge */}
          <div
            className={`rounded-xl border px-3.5 py-2.5 text-right ${
              axialLoad > 4
                ? 'border-red-500/50 bg-red-950/40 text-red-200'
                : axialLoad >= 3
                ? 'border-amber-500/40 bg-amber-950/30 text-amber-200'
                : 'border-zinc-800 bg-zinc-950/70 text-zinc-300'
            }`}
          >
            <div className="text-[11px] uppercase tracking-wider opacity-75">
              Spinal Axial Load
            </div>
            <div className="text-lg font-bold">
              {axialLoad} <span className="text-xs font-normal opacity-70">/ 4 ceiling</span>
            </div>
          </div>
        </div>

        {/* Override Split Selector */}
        <div className="mt-4 pt-3 border-t border-zinc-800/80 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-400 mr-1">
            Session Split:
          </span>
          {ALL_SPLITS.map((sp) => (
            <button
              key={sp}
              onClick={() => handleSwitchSplit(sp)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                activeDraft.splitType === sp
                  ? 'bg-emerald-500 text-zinc-950 font-semibold'
                  : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {sp.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* SAFEGUARD & FATIGUE ALERTS */}
      {safeguards.length > 0 && (
        <div className="space-y-2.5">
          {safeguards.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-xl border p-3.5 ${
                alert.severity === 'CRITICAL'
                  ? 'border-red-500/50 bg-red-950/40 text-red-100'
                  : 'border-amber-500/40 bg-amber-950/30 text-amber-100'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {alert.severity === 'CRITICAL' ? (
                  <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1 text-xs sm:text-sm">
                  <div className="font-semibold">{alert.title}</div>
                  <p className="opacity-90">{alert.message}</p>
                  {alert.recommendation && (
                    <p className="text-xs font-medium text-emerald-300 pt-0.5">
                      → Fix: {alert.recommendation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SECTION 1: PRIMARY ANCHOR LIFT */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              <Dumbbell className="h-4 w-4" />
              1. Primary Anchor Lift
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
              {primaryExercise?.name}
            </h3>
            {primaryExercise?.runnerBenefitNote && (
              <p className="text-xs text-zinc-400 mt-0.5">
                🏃 Runner Note: {primaryExercise.runnerBenefitNote}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
              Axial: <strong>{primaryExercise?.axialLoadScore ?? 0}</strong>
            </span>
            <span className="rounded-lg bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 text-xs text-emerald-300">
              Est 1RM: <strong>{topE1RM} kg</strong>
            </span>
          </div>
        </div>

        {/* Switch Primary Anchor Option */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-400">Choose Anchor:</span>
          {[
            primaryCandidates.recommended,
            ...primaryCandidates.alternatives,
          ].map((candId) => {
            const ex = exerciseMap.get(candId);
            if (!ex) return null;
            const isSelected = activeDraft.primaryLiftId === candId;
            return (
              <button
                key={candId}
                onClick={() => handlePrimaryLiftChange(candId)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium border transition ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {ex.name}
                {candId === primaryCandidates.recommended ? ' ★' : ''}
              </button>
            );
          })}
          <select
            value={activeDraft.primaryLiftId}
            onChange={(e) => handlePrimaryLiftChange(e.target.value)}
            className="ml-auto rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300"
          >
            {allAnchorExercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                All Anchors: {ex.name}
              </option>
            ))}
          </select>
        </div>

        {/* Set Logger Table */}
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 px-2">
            <div className="col-span-2">Set</div>
            <div className="col-span-3">Load (kg)</div>
            <div className="col-span-3">Reps</div>
            <div className="col-span-2">RPE</div>
            <div className="col-span-2 text-right">Done</div>
          </div>

          {activeDraft.primaryLiftSets.map((set, idx) => (
            <div
              key={idx}
              className={`grid grid-cols-12 items-center gap-2 rounded-xl border p-2 transition ${
                set.completed
                  ? 'border-emerald-500/40 bg-emerald-950/20'
                  : 'border-zinc-800/80 bg-zinc-950/60'
              }`}
            >
              <div className="col-span-2 flex items-center gap-1.5">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-zinc-800 text-xs font-bold text-zinc-200">
                  {set.setNumber}
                </span>
                {activeDraft.primaryLiftSets.length > 1 && (
                  <button
                    onClick={() => handleRemovePrimarySet(idx)}
                    className="text-zinc-600 hover:text-red-400"
                    title="Remove set"
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="col-span-3">
                <input
                  type="number"
                  step="2.5"
                  value={set.weightKg}
                  onChange={(e) =>
                    handleUpdatePrimarySet(idx, {
                      weightKg: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm font-semibold text-white"
                />
              </div>
              <div className="col-span-3">
                <input
                  type="number"
                  value={set.reps}
                  onChange={(e) =>
                    handleUpdatePrimarySet(idx, {
                      reps: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm font-semibold text-white"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  step="0.5"
                  min="5"
                  max="10"
                  value={set.rpe ?? 8}
                  onChange={(e) =>
                    handleUpdatePrimarySet(idx, {
                      rpe: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
                />
              </div>
              <div className="col-span-2 flex justify-end">
                <button
                  onClick={() =>
                    handleUpdatePrimarySet(idx, { completed: !set.completed })
                  }
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    set.completed
                      ? 'bg-emerald-500 text-zinc-950'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {set.completed ? '✓' : 'Log'}
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={handleAddPrimarySet}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 pt-1"
          >
            <Plus className="h-3.5 w-3.5" /> Add Working Set
          </button>
        </div>
      </div>

      {/* SECTION 2: SUPERSETS (2, 3, or 4 blocks — Paired vs Split Standalone) */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              <Layers className="h-4 w-4" />
              2. Modular Supersets ({activeDraft.supersets.length} / 4 max)
            </div>
            <p className="text-xs text-zinc-400">
              Add 2–4 supersets. Tap <strong>Split to Single Exercises</strong> on the day if gym stations are busy.
            </p>
          </div>

          {activeDraft.supersets.length < 4 && (
            <button
              onClick={() => setShowAddSupersetModal(!showAddSupersetModal)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-zinc-950 hover:bg-emerald-400 transition"
            >
              <Plus className="h-4 w-4" /> Add Superset ({activeDraft.supersets.length}/4)
            </button>
          )}
        </div>

        {/* Add Superset Drawer */}
        {showAddSupersetModal && (
          <div className="rounded-2xl border border-emerald-500/40 bg-zinc-900 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white">
                Recommended Curated Supersets (Ranked by Split & Weekly Muscle Balance)
              </h4>
              <button
                onClick={() => setShowAddSupersetModal(false)}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {rankedSupersets.map(({ superset, tags }) => {
                const exA = exerciseMap.get(superset.exerciseAId);
                const exB = exerciseMap.get(superset.exerciseBId);
                return (
                  <div
                    key={superset.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                          {superset.pairingType}
                        </span>
                        {tags.map((t) => (
                          <span
                            key={t}
                            className="rounded bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      <div className="text-sm font-bold text-white">
                        {superset.name}
                      </div>
                      <div className="text-xs text-emerald-300 mt-0.5">
                        A1: {exA?.name} + A2: {exB?.name}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1">
                        {superset.rationale}
                      </p>
                    </div>
                    <button
                      onClick={() => handleAddCuratedSuperset(superset)}
                      className="mt-2 w-full rounded-lg bg-zinc-800 hover:bg-emerald-500 hover:text-zinc-950 py-1.5 text-xs font-semibold text-zinc-200 transition"
                    >
                      + Add Superset to Session
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Custom Pair Builder */}
            <div className="pt-3 border-t border-zinc-800 space-y-2">
              <div className="text-xs font-semibold text-zinc-300">
                Or Build Custom Pairing (Validated Live by Rules Engine):
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={customExA}
                  onChange={(e) => setCustomExA(e.target.value)}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-white"
                >
                  {exercises.map((e) => (
                    <option key={e.id} value={e.id}>
                      A: {e.name}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-zinc-500">+</span>
                <select
                  value={customExB}
                  onChange={(e) => setCustomExB(e.target.value)}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-white"
                >
                  {exercises.map((e) => (
                    <option key={e.id} value={e.id}>
                      B: {e.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddCustomSuperset}
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-zinc-950"
                >
                  Add Custom Pair
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Active Superset Cards */}
        {activeDraft.supersets.map((block, bIdx) => {
          const exA = exerciseMap.get(block.exerciseAId);
          const exB = exerciseMap.get(block.exerciseBId);
          const isSplit = block.executionMode === 'SPLIT_STANDALONE';

          return (
            <div
              key={block.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300">
                    {bIdx + 1}
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {block.customName || `Superset #${bIdx + 1}`}
                    </h4>
                    <span className="text-[11px] text-zinc-400">
                      {isSplit
                        ? 'Mode: Split Standalone (Complete all sets of A, then all sets of B)'
                        : 'Mode: Paired Superset (Alternate A1 ↔ A2 each set)'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleSupersetMode(block.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                      isSplit
                        ? 'border-amber-500/50 bg-amber-950/40 text-amber-200'
                        : 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:border-emerald-500/50'
                    }`}
                    title="Split into standalone exercises if gym stations are busy"
                  >
                    {isSplit ? (
                      <>
                        <Shuffle className="h-3.5 w-3.5" /> Re-Pair as Superset
                      </>
                    ) : (
                      <>
                        <Split className="h-3.5 w-3.5" /> Split to Single Exercises
                      </>
                    )}
                  </button>

                  {activeDraft.supersets.length > 1 && (
                    <button
                      onClick={() => handleRemoveSuperset(block.id)}
                      className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-950/40 hover:text-red-400"
                      title="Remove superset"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Exercise A & Exercise B Sub-cards */}
              <div
                className={`grid gap-3 ${
                  isSplit ? 'grid-cols-1' : 'sm:grid-cols-2'
                }`}
              >
                {(['A', 'B'] as const).map((slot) => {
                  const ex = slot === 'A' ? exA : exB;
                  const sets = slot === 'A' ? block.setsA : block.setsB;
                  const badge = isSplit
                    ? `Standalone ${bIdx + 1}${slot}`
                    : `${bIdx + 1}${slot}`;

                  return (
                    <div
                      key={slot}
                      className="rounded-xl border border-zinc-800/90 bg-zinc-950/70 p-3 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                          {badge}
                        </span>
                        <select
                          value={ex?.id ?? ''}
                          onChange={(e) =>
                            handleSwapSupersetExercise(
                              block.id,
                              slot,
                              e.target.value
                            )
                          }
                          className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs font-semibold text-white"
                        >
                          {exercises.map((optionEx) => (
                            <option key={optionEx.id} value={optionEx.id}>
                              {optionEx.name} (Axial {optionEx.axialLoadScore})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-wrap gap-1 text-[10px] text-zinc-400">
                        {ex?.primaryMuscles.map((m) => (
                          <span
                            key={m}
                            className="rounded bg-zinc-900 px-1.5 py-0.5 text-zinc-300"
                          >
                            {MUSCLE_LABELS[m]}
                          </span>
                        ))}
                        <span className="ml-auto text-zinc-500">
                          Grip Tax: {ex?.gripTax ?? 0}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {sets.map((s, sIdx) => (
                          <div
                            key={sIdx}
                            className="flex items-center gap-2 text-xs"
                          >
                            <span className="w-6 text-zinc-500 font-medium">
                              #{s.setNumber}
                            </span>
                            <input
                              type="number"
                              value={s.weightKg}
                              onChange={(e) =>
                                handleUpdateSupersetSet(block.id, slot, sIdx, {
                                  weightKg: Number(e.target.value),
                                })
                              }
                              className="w-16 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-white"
                            />
                            <span className="text-zinc-500">kg ×</span>
                            <input
                              type="number"
                              value={s.reps}
                              onChange={(e) =>
                                handleUpdateSupersetSet(block.id, slot, sIdx, {
                                  reps: Number(e.target.value),
                                })
                              }
                              className="w-14 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-white"
                            />
                            <button
                              onClick={() =>
                                handleUpdateSupersetSet(block.id, slot, sIdx, {
                                  completed: !s.completed,
                                })
                              }
                              className={`ml-auto rounded px-2 py-1 text-[11px] font-semibold ${
                                s.completed
                                  ? 'bg-emerald-500 text-zinc-950'
                                  : 'bg-zinc-800 text-zinc-400'
                              }`}
                            >
                              {s.completed ? '✓' : 'Done'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* SECTION 3: FINISHERS & SLED DOSING PROTOCOL (1 or 2 blocks) */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              <Flame className="h-4 w-4" />
              3. Conditioners / Finishers ({activeDraft.finishers.length} / 2 max)
            </div>
            <p className="text-xs text-zinc-400">
              Includes the standardized Turf Sled Forward Push + Backward Drag dosing protocol for lower days and Postural Face Pulls for upper days.
            </p>
          </div>

          {activeDraft.finishers.length < 2 && (
            <div className="flex items-center gap-1.5">
              {finisherCandidates.map((fc) => (
                <button
                  key={fc.id}
                  onClick={() => handleAddFinisher(fc.id)}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:border-emerald-500"
                >
                  + {fc.name.split('(')[0].trim()}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {activeDraft.finishers.map((fin) => {
            const ex = exerciseMap.get(fin.exerciseId);
            const isSled = fin.exerciseId === 'turf_sled_push_pull';
            return (
              <div
                key={fin.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3.5 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-white">
                      {ex?.name}
                    </div>
                    <p className="text-xs text-emerald-300 mt-0.5">
                      {fin.protocolNote}
                    </p>
                  </div>
                  {activeDraft.finishers.length > 1 && (
                    <button
                      onClick={() => handleRemoveFinisher(fin.id)}
                      className="text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {isSled && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-2 text-[11px] text-emerald-200 space-y-0.5">
                    <div>
                      <strong>Sled Protocol:</strong> 15–20m Forward Push → immediate 15–20m Backward Drag holding mid-posts.
                    </div>
                    <div>
                      <strong>Target Load:</strong> Sled tare + 20–30 kg plate load | <strong>Rest:</strong> 60–90s (or You-Go-I-Go).
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-400">Load (kg):</span>
                    <input
                      type="number"
                      value={fin.loadKg ?? 25}
                      onChange={(e) =>
                        onUpdateDraft({
                          ...activeDraft,
                          finishers: activeDraft.finishers.map((f) =>
                            f.id === fin.id
                              ? { ...f, loadKg: Number(e.target.value) }
                              : f
                          ),
                        })
                      }
                      className="w-16 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-white"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-zinc-400 mr-1">Rounds:</span>
                    {[1, 2, 3].map((r) => (
                      <button
                        key={r}
                        onClick={() =>
                          onUpdateDraft({
                            ...activeDraft,
                            finishers: activeDraft.finishers.map((f) =>
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
                        className={`h-7 w-7 rounded-lg text-xs font-bold transition ${
                          fin.completedRounds >= r
                            ? 'bg-emerald-500 text-zinc-950'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* COMPACT WEEKLY / FORTNIGHTLY MUSCLE IMPACT PREVIEW */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Session + Rolling 7-Day & 14-Day Muscle Volume Impact
          </h4>
          <span className="text-[11px] text-zinc-500">
            Green = Optimal | Amber = High/48h Fatigue | Blue = Needs Volume
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {volumeSummaries.map((v) => {
            const badgeColor =
              v.status7d === 'OVERTRAINING_RISK' || v.recovery48hFlag
                ? 'border-amber-500/50 bg-amber-950/30 text-amber-200'
                : v.status7d === 'OPTIMAL' || v.status7d === 'HIGH'
                ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200'
                : 'border-zinc-800 bg-zinc-950 text-zinc-400';

            return (
              <div
                key={v.muscle}
                className={`rounded-xl border p-2 text-xs ${badgeColor}`}
              >
                <div className="font-semibold truncate">
                  {MUSCLE_LABELS[v.muscle]}
                </div>
                <div className="mt-1 flex items-baseline justify-between text-[11px]">
                  <span>7d: <strong>{v.sets7d}</strong></span>
                  <span className="opacity-75">14d: {v.sets14d}</span>
                </div>
                {v.plannedSessionSets > 0 && (
                  <div className="text-[10px] text-emerald-400 mt-0.5">
                    +{v.plannedSessionSets} sets today
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* COMPLETE & LOG WORKOUT CTA */}
      <div className="flex justify-end">
        <button
          onClick={handleCompleteAndLogSession}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3.5 text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition"
        >
          <CheckCircle2 className="h-5 w-5" />
          Complete & Log Session to Local DB
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
