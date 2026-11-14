import {
  Exercise,
  LoggedSet,
  SessionFinisherBlock,
  WorkoutSession,
} from '../models/types';

/**
 * Weight suggestions.
 *  1. Last recorded: the most recent completed session containing the
 *     exercise (as primary lift or in a superset) supplies weight and reps.
 *  2. Otherwise an estimate: the exercise's `startingLoadKg`, or a rough
 *     default for its equipment type. This is a starting guess, not a
 *     calculation from other lifts.
 */
export interface SuggestedLoad {
  source: 'history' | 'estimate';
  sets: Array<{ weightKg: number; reps: number }>;
}

const DEFAULT_STEP_KG = 2.5;

export function roundToStep(kg: number, step: number = DEFAULT_STEP_KG): number {
  return Math.round(kg / step) * step;
}

export function estimateStartingLoad(ex: Exercise | undefined): number {
  if (!ex) return 20;
  if (ex.startingLoadKg !== undefined) return ex.startingLoadKg;
  const isolation = ex.pattern === 'ISOLATION' || ex.pattern === 'CORE_DECOMPRESSION';
  switch (ex.equipment) {
    case 'BARBELL':
      return isolation ? 20 : 40;
    case 'DUMBBELL':
      return isolation ? 7.5 : 17.5;
    case 'CABLE':
      return isolation ? 15 : 35;
    case 'MACHINE':
      return isolation ? 30 : 40;
    case 'TURF':
      return 25;
    case 'BODYWEIGHT':
      return 0;
  }
}

function defaultReps(ex: Exercise | undefined): number {
  const m = ex?.defaultReps?.match(/\d+/);
  return m ? Number(m[0]) : 10;
}

function completedSessionsNewestFirst(history: WorkoutSession[]): WorkoutSession[] {
  return history
    .filter((s) => s.status === 'COMPLETED')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/** Sets logged for an exercise the last time it was done (completed sets preferred). */
export function getLastLoggedSets(
  exerciseId: string,
  history: WorkoutSession[]
): LoggedSet[] | undefined {
  for (const s of completedSessionsNewestFirst(history)) {
    const candidates: LoggedSet[][] = [];
    if (s.primaryLiftId === exerciseId) candidates.push(s.primaryLiftSets);
    for (const ss of s.supersets) {
      if (ss.exerciseAId === exerciseId) candidates.push(ss.setsA);
      if (ss.exerciseBId === exerciseId) candidates.push(ss.setsB);
    }
    for (const sets of candidates) {
      const done = sets.filter((x) => x.completed);
      if (done.length) return done;
    }
  }
  return undefined;
}

export function suggestLoad(
  exerciseId: string,
  setCount: number,
  history: WorkoutSession[],
  exerciseMap: Map<string, Exercise>
): SuggestedLoad {
  const last = getLastLoggedSets(exerciseId, history);
  if (last) {
    return {
      source: 'history',
      sets: Array.from({ length: setCount }, (_, i) => {
        const src = last[Math.min(i, last.length - 1)];
        return { weightKg: src.weightKg, reps: src.reps };
      }),
    };
  }
  const ex = exerciseMap.get(exerciseId);
  const weightKg = roundToStep(estimateStartingLoad(ex), ex?.loadStepKg);
  const reps = defaultReps(ex);
  return {
    source: 'estimate',
    sets: Array.from({ length: setCount }, () => ({ weightKg, reps })),
  };
}

/** Load used the last time this exercise was done as a finisher. */
export function getLastFinisherLoad(
  exerciseId: string,
  history: WorkoutSession[]
): number | undefined {
  for (const s of completedSessionsNewestFirst(history)) {
    const f = s.finishers.find(
      (x) => x.exerciseId === exerciseId && x.completedRounds > 0 && x.loadKg !== undefined
    );
    if (f) return f.loadKg;
  }
  return undefined;
}

function reload(
  sets: LoggedSet[],
  exerciseId: string,
  history: WorkoutSession[],
  exerciseMap: Map<string, Exercise>
): LoggedSet[] {
  const suggestion = suggestLoad(exerciseId, sets.length, history, exerciseMap);
  return sets.map((set, i) =>
    set.completed ? set : { ...set, ...suggestion.sets[i] }
  );
}

/**
 * Fills in weights for every slot whose exercise is new or changed compared
 * with `previous` (pass undefined for a brand-new session). Sets already
 * ticked off and slots whose exercise did not change are left alone, so
 * manual weight edits are never overwritten.
 */
export function applySuggestedLoads(
  previous: WorkoutSession | undefined,
  next: WorkoutSession,
  history: WorkoutSession[],
  exerciseMap: Map<string, Exercise>
): WorkoutSession {
  const prevBlocks = new Map((previous?.supersets ?? []).map((b) => [b.id, b]));
  const prevFins = new Map((previous?.finishers ?? []).map((f) => [f.id, f]));

  const primaryChanged = previous?.primaryLiftId !== next.primaryLiftId;

  return {
    ...next,
    primaryLiftSets: primaryChanged
      ? reload(next.primaryLiftSets, next.primaryLiftId, history, exerciseMap)
      : next.primaryLiftSets,
    supersets: next.supersets.map((b) => {
      const prev = prevBlocks.get(b.id);
      return {
        ...b,
        setsA:
          prev?.exerciseAId === b.exerciseAId
            ? b.setsA
            : reload(b.setsA, b.exerciseAId, history, exerciseMap),
        setsB:
          prev?.exerciseBId === b.exerciseBId
            ? b.setsB
            : reload(b.setsB, b.exerciseBId, history, exerciseMap),
      };
    }),
    finishers: next.finishers.map((f): SessionFinisherBlock => {
      if (prevFins.get(f.id)?.exerciseId === f.exerciseId) return f;
      const last = getLastFinisherLoad(f.exerciseId, history);
      return last !== undefined ? { ...f, loadKg: last } : f;
    }),
  };
}

/**
 * Weights for a drop set, heaviest first: each drop is about `dropPct` of the
 * starting weight, rounded to the available jump (e.g. 5 kg fixed barbells)
 * and always at least one jump. 30 kg with 5 kg bars -> [30, 25, 20].
 */
export function getDropSetWeights(
  startKg: number,
  stepKg: number = DEFAULT_STEP_KG,
  drops: number = 2,
  dropPct: number = 0.2
): number[] {
  const drop = Math.max(stepKg, roundToStep(startKg * dropPct, stepKg));
  const weights = [startKg];
  for (let i = 0; i < drops; i++) {
    const nextKg = weights[weights.length - 1] - drop;
    if (nextKg < stepKg) break;
    weights.push(nextKg);
  }
  return weights;
}
