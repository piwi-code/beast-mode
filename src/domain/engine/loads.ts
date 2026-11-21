import {
  Exercise,
  LoggedSet,
  SessionFinisherBlock,
  WorkoutSession,
} from '../models/types';
import {
  LoadProfile,
  getLoadProfile,
  snapLoad,
  stackLbLabel,
  stepLoad,
} from './increments';

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
  /** For estimates: where the number came from, in plain language. */
  basis?: string;
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

/**
 * Next weight when progressing: one available step up (one 5 lb add-on on a
 * stack, the next dumbbell, one plate pair), except big plate-loaded lower
 * lifts (squat, deadlift, leg press...) which go up at least 5 kg.
 */
export function progressLoad(ex: Exercise | undefined, kg: number): number {
  const profile = getLoadProfile(ex);
  const bigLowerLift =
    profile.kind === 'linear' &&
    (ex?.pattern === 'KNEE_DOMINANT' || ex?.pattern === 'HIP_HINGE') &&
    (ex.equipment === 'BARBELL' || ex.equipment === 'MACHINE');
  let next = stepLoad(kg, profile, 1);
  while (bigLowerLift && next - kg < 5 - 1e-6) next = stepLoad(next, profile, 1);
  return next;
}

/**
 * `kg` reduced by `pct`, snapped to an available weight and always at least
 * one step lower (never below 0).
 */
export function reduceLoad(kg: number, pct: number, profile: LoadProfile): number {
  if (kg <= 0) return 0;
  const cut = snapLoad(kg * (1 - pct), profile);
  return cut < kg - 1e-6 ? cut : stepLoad(kg, profile, -1);
}

/** Snaps a weight to what the exercise's kit actually offers. */
export function snapForExercise(ex: Exercise | undefined, kg: number): number {
  return snapLoad(kg, getLoadProfile(ex));
}

/** "50 lb" hint for pin-stack exercises so the pin can be found; undefined otherwise. */
export function stackHintForExercise(ex: Exercise | undefined, kg: number): string | undefined {
  return stackLbLabel(kg, getLoadProfile(ex));
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

/** Main lifts whose starting weight can be set in Settings. */
export const MAIN_LIFT_IDS = [
  'bb_flat_bench',
  'bb_back_squat',
  'bb_deadlift',
  'bb_ohp',
  'leg_press_machine',
];

/** User-entered starting weights by exercise id (PlanConfig.startingWeights). */
export type StartingWeights = Record<string, number>;

/**
 * Rule-of-thumb strength ratios between related exercises: `b ≈ a × ratio`
 * for a similar rep range (per dumbbell where two are used). Deliberately a
 * little conservative; they only seed the first session of a new exercise.
 * Each pair works in both directions.
 */
export const LIFT_RATIOS: Array<{ a: string; b: string; ratio: number }> = [
  // From Bench Press
  { a: 'bb_flat_bench', b: 'db_flat_bench', ratio: 0.35 },
  { a: 'bb_flat_bench', b: 'db_incline_press', ratio: 0.3 },
  { a: 'bb_flat_bench', b: 'bb_ohp', ratio: 0.6 },
  { a: 'bb_flat_bench', b: 'db_shoulder_press_seated', ratio: 0.22 },
  { a: 'bb_flat_bench', b: 'machine_chest_press', ratio: 0.8 },
  { a: 'bb_flat_bench', b: 'ez_skull_crusher', ratio: 0.3 },
  { a: 'bb_flat_bench', b: 'bb_pendlay_row', ratio: 0.8 },
  // From Back Squat
  { a: 'bb_back_squat', b: 'leg_press_machine', ratio: 1.5 },
  { a: 'bb_back_squat', b: 'db_bulgarian_split_squat', ratio: 0.15 },
  { a: 'bb_back_squat', b: 'db_walking_lunges', ratio: 0.15 },
  { a: 'bb_back_squat', b: 'db_goblet_squat', ratio: 0.3 },
  { a: 'bb_back_squat', b: 'leg_extension_machine', ratio: 0.4 },
  { a: 'bb_back_squat', b: 'bb_deadlift', ratio: 1.15 },
  // From Deadlift
  { a: 'bb_deadlift', b: 'bb_rdl', ratio: 0.7 },
  { a: 'bb_deadlift', b: 'bb_hip_thrust', ratio: 0.7 },
  // Arms, back, calves
  { a: 'ez_bar_curl', b: 'ez_preacher_curl', ratio: 0.8 },
  { a: 'ez_bar_curl', b: 'db_hammer_curls', ratio: 0.4 },
  { a: 'ez_bar_curl', b: 'seated_isolated_curl', ratio: 0.35 },
  { a: 'lat_pulldown_neutral', b: 'cable_seated_row', ratio: 1 },
  { a: 'machine_calf_raise_standing', b: 'seated_calf_raise_machine', ratio: 0.5 },
  // Prone starts the hamstrings less stretched, so slightly less weight
  { a: 'seated_hamstring_curl', b: 'prone_leg_curl', ratio: 0.85 },
];

/** A weight we trust for an exercise: last logged top set, else the user's starting weight. */
function knownWorkingWeight(
  exerciseId: string,
  history: WorkoutSession[],
  startingWeights: StartingWeights
): { kg: number; from: 'history' | 'settings' } | undefined {
  const last = getLastLogged(exerciseId, history);
  if (last) {
    const kg = Math.max(...last.sets.map((x) => x.weightKg));
    if (kg > 0) return { kg, from: 'history' };
  }
  const set = startingWeights[exerciseId];
  return set && set > 0 ? { kg: set, from: 'settings' } : undefined;
}

/**
 * Starting weight for an exercise with no history, in order of trust:
 *  1. the user's own starting weight (Settings),
 *  2. a prediction from a related lift they have logged (or set),
 *  3. the catalog's rough default for the exercise or its equipment type.
 */
export function predictStartingLoad(
  ex: Exercise | undefined,
  history: WorkoutSession[],
  exerciseMap: Map<string, Exercise>,
  startingWeights: StartingWeights = {}
): { kg: number; basis: string } {
  const profile = getLoadProfile(ex);
  if (ex) {
    const own = startingWeights[ex.id];
    if (own && own > 0) {
      return { kg: snapLoad(own, profile), basis: 'Your starting weight from Settings.' };
    }

    const candidates: Array<{ kg: number; from: 'history' | 'settings'; name: string; anchorKg: number }> = [];
    for (const r of LIFT_RATIOS) {
      const otherId = r.a === ex.id ? r.b : r.b === ex.id ? r.a : undefined;
      if (!otherId) continue;
      const known = knownWorkingWeight(otherId, history, startingWeights);
      if (!known) continue;
      const other = exerciseMap.get(otherId);
      candidates.push({
        kg: r.b === ex.id ? known.kg * r.ratio : known.kg / r.ratio,
        from: known.from,
        name: other?.shortName ?? other?.name ?? otherId,
        anchorKg: known.kg,
      });
    }
    // Prefer lifts actually logged over numbers typed into Settings
    const best = candidates.find((c) => c.from === 'history') ?? candidates[0];
    if (best) {
      return {
        kg: Math.max(stepLoad(0, profile, 1), snapLoad(best.kg, profile)),
        basis: `Predicted from your ${best.name} (${best.anchorKg} kg). Adjust on the day.`,
      };
    }
  }
  return {
    kg: snapLoad(estimateStartingLoad(ex), profile),
    basis: 'Starting estimate: no history for this exercise yet.',
  };
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
  referenceDate: Date = new Date(),
  startingWeights: StartingWeights = {}
): SuggestedLoad {
  const ex = exerciseMap.get(exerciseId);
  const profile = getLoadProfile(ex);
  const last = getLastLogged(exerciseId, history);

  if (!last) {
    const predicted = predictStartingLoad(ex, history, exerciseMap, startingWeights);
    const weightKg = predicted.kg;
    const reps = defaultReps(ex);
    return {
      source: 'estimate',
      basis: predicted.basis,
      sets: Array.from({ length: setCount }, () => ({ weightKg, reps })),
    };
  }

  // Snapped so weights logged before the kit rules existed land on real settings
  const base = Array.from({ length: setCount }, (_, i) => {
    const src = last.sets[Math.min(i, last.sets.length - 1)];
    return { weightKg: snapLoad(src.weightKg, profile), reps: src.reps };
  });
  const topLast = Math.max(...base.map((x) => x.weightKg));
  const name = ex?.shortName ?? ex?.name ?? 'this exercise';

  // a) Break reduction
  const days = daysBetween(last.date, referenceDate);
  const reducePct = getBreakReductionPct(days);
  if (reducePct > 0 && topLast > 0) {
    const reduce = (kg: number) => reduceLoad(kg, reducePct, profile);
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
    const toKg = progressLoad(ex, topLast);
    const inc = Math.round((toKg - topLast) * 10) / 10;
    const sets = base.map((x) => ({ weightKg: progressLoad(ex, x.weightKg), reps: range.min }));
    return {
      source: 'history',
      sets,
      adjustment: {
        kind: 'PROGRESS',
        fromKg: topLast,
        toKg,
        note: `You hit ${range.max}+ reps on every set last time: up ${inc} kg (${topLast} → ${toKg} kg), aim for ${range.min}${range.max > range.min ? `–${range.max}` : ''} reps.`,
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
  const profile = getLoadProfile(exerciseMap.get(exerciseId));
  const lastKg = snapLoad(last.loadKg, profile);
  const pct = getBreakReductionPct(daysBetween(last.date, referenceDate));
  return pct ? reduceLoad(lastKg, pct, profile) : lastKg;
}

function reload(
  sets: LoggedSet[],
  exerciseId: string,
  history: WorkoutSession[],
  exerciseMap: Map<string, Exercise>,
  referenceDate: Date,
  startingWeights: StartingWeights
): LoggedSet[] {
  const suggestion = suggestLoad(
    exerciseId,
    sets.length,
    history,
    exerciseMap,
    referenceDate,
    startingWeights
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
  exerciseMap: Map<string, Exercise>,
  startingWeights: StartingWeights = {}
): WorkoutSession {
  const prevBlocks = new Map((previous?.supersets ?? []).map((b) => [b.id, b]));
  const prevFins = new Map((previous?.finishers ?? []).map((f) => [f.id, f]));

  const primaryChanged = previous?.primaryLiftId !== next.primaryLiftId;
  const refDate = new Date(next.date);

  return {
    ...next,
    primaryLiftSets: primaryChanged
      ? reload(next.primaryLiftSets, next.primaryLiftId, history, exerciseMap, refDate, startingWeights)
      : next.primaryLiftSets,
    supersets: next.supersets.map((b) => {
      const prev = prevBlocks.get(b.id);
      return {
        ...b,
        setsA:
          prev?.exerciseAId === b.exerciseAId
            ? b.setsA
            : reload(b.setsA, b.exerciseAId, history, exerciseMap, refDate, startingWeights),
        setsB:
          prev?.exerciseBId === b.exerciseBId
            ? b.setsB
            : reload(b.setsB, b.exerciseBId, history, exerciseMap, refDate, startingWeights),
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
 * Weights for a drop set, heaviest first. Each drop is about `dropPct` of the
 * starting weight, snapped to what the kit offers, and at least one real
 * jump: one fixed bar (5 kg), one dumbbell, or one major plate on a stack
 * (10 lb cables / 15 lb machines).
 *   30 kg fixed bars -> 30, 25, 20     55 lb cable -> 55, 45, 35 lb (in kg)
 * Pass a number instead of a profile for plain linear kg jumps.
 */
export function getDropSetWeights(
  startKg: number,
  profileOrStepKg: LoadProfile | number = 2.5,
  drops: number = 2,
  dropPct: number = 0.2
): number[] {
  const profile: LoadProfile =
    typeof profileOrStepKg === 'number'
      ? { kind: 'linear', stepKg: profileOrStepKg }
      : profileOrStepKg;
  const start = snapLoad(startKg, profile);
  const minDrop =
    profile.kind === 'stack'
      ? profile.majorLb * 0.45359237
      : profile.kind === 'linear'
        ? profile.stepKg
        : 0;
  const weights = [start];
  for (let i = 0; i < drops; i++) {
    const prev = weights[weights.length - 1];
    let next = snapLoad(prev - Math.max(start * dropPct, minDrop), profile);
    if (next >= prev - 1e-6) next = stepLoad(prev, profile, -1);
    if (next <= 0) break;
    weights.push(next);
  }
  return weights;
}

/** Drop-set weights for an exercise, using its kit rules. */
export function getDropSetWeightsFor(ex: Exercise | undefined, startKg: number): number[] {
  return getDropSetWeights(startKg, getLoadProfile(ex), ex?.dropSetDrops ?? 2);
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

/**
 * Sets a finisher's completed-round count and keeps one timestamp per
 * completed round (new rounds are stamped now; removed rounds are dropped).
 */
export function stampFinisherRounds(
  fin: SessionFinisherBlock,
  completedRounds: number,
  now: Date = new Date()
): Pick<SessionFinisherBlock, 'completedRounds' | 'roundCompletedAt'> {
  const stamps = (fin.roundCompletedAt ?? []).slice(0, completedRounds);
  while (stamps.length < completedRounds) stamps.push(now.toISOString());
  return { completedRounds, roundCompletedAt: stamps };
}
