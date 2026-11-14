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
export interface LoadAdjustment {
  kind: 'BREAK' | 'PROGRESS';
  /** Top-set weight last time and now. */
  fromKg: number;
  toKg: number;
  /** Plain-language reason shown to the user. */
  note: string;
}

export interface SuggestedLoad {
  source: 'history' | 'estimate';
  sets: Array<{ weightKg: number; reps: number }>;
  /** Present when the last recorded weight was changed (break reduction or progression). */
  adjustment?: LoadAdjustment;
}

/**
 * Break reduction: how much to take off the last recorded weight when the
 * exercise has not been done for a while. First matching tier wins.
 */
export const BREAK_TIERS: Array<{ minDays: number; reducePct: number }> = [
  { minDays: 84, reducePct: 0.2 }, // 12+ weeks
  { minDays: 42, reducePct: 0.15 }, // 6-12 weeks
  { minDays: 21, reducePct: 0.1 }, // 3-6 weeks
];

export function getBreakReductionPct(daysSince: number): number {
  return BREAK_TIERS.find((t) => daysSince >= t.minDays)?.reducePct ?? 0;
}

/** Parses "8-12", "10/leg", "6-10/leg" into a rep range; undefined for distances etc. */
export function parseRepRange(
  defaultReps: string | undefined
): { min: number; max: number } | undefined {
  const m = defaultReps?.match(/^(\d+)(?:\s*-\s*(\d+))?(?:\/\w+)?$/);
  if (!m) return undefined;
  const min = Number(m[1]);
  return { min, max: m[2] ? Number(m[2]) : min };
}

/** Weight jump when progressing: 5 kg for big lower-body lifts, otherwise one step. */
export function getProgressionIncrementKg(ex: Exercise | undefined): number {
  const step = ex?.loadStepKg ?? DEFAULT_STEP_KG;
  const bigLowerLift =
    (ex?.pattern === 'KNEE_DOMINANT' || ex?.pattern === 'HIP_HINGE') &&
    (ex.equipment === 'BARBELL' || ex.equipment === 'MACHINE');
  return bigLowerLift ? Math.max(5, step) : step;
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

/** Sets logged for an exercise the last time it was done (completed sets only), with the date. */
export function getLastLogged(
  exerciseId: string,
  history: WorkoutSession[]
): { sets: LoggedSet[]; date: string } | undefined {
  for (const s of completedSessionsNewestFirst(history)) {
    const candidates: LoggedSet[][] = [];
    if (s.primaryLiftId === exerciseId) candidates.push(s.primaryLiftSets);
    for (const ss of s.supersets) {
      if (ss.exerciseAId === exerciseId) candidates.push(ss.setsA);
      if (ss.exerciseBId === exerciseId) candidates.push(ss.setsB);
    }
    for (const sets of candidates) {
      const done = sets.filter((x) => x.completed);
      if (done.length) return { sets: done, date: s.date };
    }
  }
  return undefined;
}

export function getLastLoggedSets(
  exerciseId: string,
  history: WorkoutSession[]
): LoggedSet[] | undefined {
  return getLastLogged(exerciseId, history)?.sets;
}

function daysBetween(fromIso: string, to: Date): number {
  return Math.floor((to.getTime() - new Date(fromIso).getTime()) / 86_400_000);
}

function weeksLabel(days: number): string {
  const weeks = Math.round(days / 7);
  return `${weeks} week${weeks === 1 ? '' : 's'}`;
}

/**
 * Suggested sets for an exercise on `referenceDate`:
 *  - last recorded weights/reps, adjusted by
 *    a) a break reduction if it has not been done for 3+ weeks, else
 *    b) a progression bump if every set last time reached the top of the rep range;
 *  - or an estimate when there is no history.
 */
export function suggestLoad(
  exerciseId: string,
  setCount: number,
  history: WorkoutSession[],
  exerciseMap: Map<string, Exercise>,
  referenceDate: Date = new Date()
): SuggestedLoad {
  const ex = exerciseMap.get(exerciseId);
  const step = ex?.loadStepKg ?? DEFAULT_STEP_KG;
  const last = getLastLogged(exerciseId, history);

  if (!last) {
    const weightKg = roundToStep(estimateStartingLoad(ex), step);
    const reps = defaultReps(ex);
    return {
      source: 'estimate',
      sets: Array.from({ length: setCount }, () => ({ weightKg, reps })),
    };
  }

  const base = Array.from({ length: setCount }, (_, i) => {
    const src = last.sets[Math.min(i, last.sets.length - 1)];
    return { weightKg: src.weightKg, reps: src.reps };
  });
  const topLast = Math.max(...last.sets.map((x) => x.weightKg));
  const name = ex?.shortName ?? ex?.name ?? 'this exercise';

  // a) Break reduction
  const days = daysBetween(last.date, referenceDate);
  const reducePct = getBreakReductionPct(days);
  if (reducePct > 0 && topLast > 0) {
    const reduce = (kg: number) => {
      const cut = roundToStep(kg * (1 - reducePct), step);
      // always come down at least one jump, never below zero
      return Math.max(0, cut < kg ? cut : kg - step);
    };
    const sets = base.map((x) => ({ ...x, weightKg: reduce(x.weightKg) }));
    const toKg = reduce(topLast);
    return {
      source: 'history',
      sets,
      adjustment: {
        kind: 'BREAK',
        fromKg: topLast,
        toKg,
        note: `${weeksLabel(days)} since you last did ${name}: eased back ${Math.round(
          reducePct * 100
        )}% (${topLast} → ${toKg} kg). Build back up over the next few sessions.`,
      },
    };
  }

  // b) Progression: every set last time hit the top of the rep range
  const range = parseRepRange(ex?.defaultReps);
  if (range && topLast > 0 && last.sets.every((x) => x.reps >= range.max)) {
    const inc = getProgressionIncrementKg(ex);
    const sets = base.map((x) => ({ weightKg: x.weightKg + inc, reps: range.min }));
    return {
      source: 'history',
      sets,
      adjustment: {
        kind: 'PROGRESS',
        fromKg: topLast,
        toKg: topLast + inc,
        note: `You hit ${range.max}+ reps on every set last time: up ${inc} kg (${topLast} → ${
          topLast + inc
        } kg), aim for ${range.min}${range.max > range.min ? `–${range.max}` : ''} reps.`,
      },
    };
  }

  return { source: 'history', sets: base };
}

/** Load (and date) the last time this exercise was done as a finisher. */
export function getLastFinisherLoad(
  exerciseId: string,
  history: WorkoutSession[]
): number | undefined {
  return getLastFinisher(exerciseId, history)?.loadKg;
}

function getLastFinisher(
  exerciseId: string,
  history: WorkoutSession[]
): { loadKg: number; date: string } | undefined {
  for (const s of completedSessionsNewestFirst(history)) {
    const f = s.finishers.find(
      (x) => x.exerciseId === exerciseId && x.completedRounds > 0 && x.loadKg !== undefined
    );
    if (f) return { loadKg: f.loadKg as number, date: s.date };
  }
  return undefined;
}

/** Last finisher load with the break reduction applied (finishers do not auto-progress). */
export function suggestFinisherLoad(
  exerciseId: string,
  history: WorkoutSession[],
  exerciseMap: Map<string, Exercise>,
  referenceDate: Date = new Date()
): number | undefined {
  const last = getLastFinisher(exerciseId, history);
  if (!last) return undefined;
  const step = exerciseMap.get(exerciseId)?.loadStepKg ?? DEFAULT_STEP_KG;
  const pct = getBreakReductionPct(daysBetween(last.date, referenceDate));
  if (!pct) return last.loadKg;
  const cut = roundToStep(last.loadKg * (1 - pct), step);
  return Math.max(0, cut < last.loadKg ? cut : last.loadKg - step);
}

function reload(
  sets: LoggedSet[],
  exerciseId: string,
  history: WorkoutSession[],
  exerciseMap: Map<string, Exercise>,
  referenceDate: Date
): LoggedSet[] {
  const suggestion = suggestLoad(
    exerciseId,
    sets.length,
    history,
    exerciseMap,
    referenceDate
  );
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
  const refDate = new Date(next.date);

  return {
    ...next,
    primaryLiftSets: primaryChanged
      ? reload(next.primaryLiftSets, next.primaryLiftId, history, exerciseMap, refDate)
      : next.primaryLiftSets,
    supersets: next.supersets.map((b) => {
      const prev = prevBlocks.get(b.id);
      return {
        ...b,
        setsA:
          prev?.exerciseAId === b.exerciseAId
            ? b.setsA
            : reload(b.setsA, b.exerciseAId, history, exerciseMap, refDate),
        setsB:
          prev?.exerciseBId === b.exerciseBId
            ? b.setsB
            : reload(b.setsB, b.exerciseBId, history, exerciseMap, refDate),
      };
    }),
    finishers: next.finishers.map((f): SessionFinisherBlock => {
      if (prevFins.get(f.id)?.exerciseId === f.exerciseId) return f;
      const last = suggestFinisherLoad(f.exerciseId, history, exerciseMap, refDate);
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

/** True once any set or finisher round has been ticked off. */
export function hasLoggedWork(session: WorkoutSession): boolean {
  return (
    session.primaryLiftSets.some((s) => s.completed) ||
    session.supersets.some(
      (b) => b.setsA.some((s) => s.completed) || b.setsB.some((s) => s.completed)
    ) ||
    session.finishers.some((f) => f.completedRounds > 0)
  );
}
