import {
  Exercise,
  LegacySessionSplitType,
  PlanConfig,
  SessionSplitType,
  Weekday,
  WorkoutSession,
} from '../models/types';

// ---------------------------------------------------------------------------
// Split labels & classification
// ---------------------------------------------------------------------------

export const SPLIT_LABELS: Record<SessionSplitType, string> = {
  PPL_PUSH: 'PPL — Push (Chest / Delts / Triceps)',
  PPL_PULL: 'PPL — Pull (Lats / Back / Biceps)',
  PPL_LEGS: 'PPL — Legs (Quads / Posterior / Sled)',
  UPPER: 'Upper Body (Push + Pull)',
  LOWER: 'Lower Body (Squat / Hinge + Decompression)',
};

export const SPLIT_SHORT_LABELS: Record<SessionSplitType, string> = {
  PPL_PUSH: 'Push',
  PPL_PULL: 'Pull',
  PPL_LEGS: 'Legs',
  UPPER: 'Upper',
  LOWER: 'Lower',
};

export const ALL_SPLITS: SessionSplitType[] = [
  'UPPER',
  'LOWER',
  'PPL_PUSH',
  'PPL_PULL',
  'PPL_LEGS',
];

export function isLowerSplit(split: SessionSplitType): boolean {
  return split === 'LOWER' || split === 'PPL_LEGS';
}

export function isUpperSplit(split: SessionSplitType): boolean {
  return split === 'UPPER';
}

// ---------------------------------------------------------------------------
// Buddy / spotter availability
// ---------------------------------------------------------------------------

export const WEEKDAY_SHORT_LABELS: Record<Weekday, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

/** Monday-first ordering for weekday pickers. */
export const WEEKDAYS_MON_FIRST: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export function isBuddyDay(plan: PlanConfig, date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  return (plan.buddyDays ?? []).includes(d.getDay() as Weekday);
}

/**
 * Returns the exercise id that is safe for the session: when there is no
 * buddy, exercises that need a spotter are swapped for their solo alternative.
 */
export function getSafeExerciseId(
  exerciseId: string,
  exerciseMap: Map<string, Exercise>,
  withBuddy: boolean
): string {
  if (withBuddy) return exerciseId;
  const ex = exerciseMap.get(exerciseId);
  if (ex?.needsSpotter && ex.soloAlternativeId && exerciseMap.has(ex.soloAlternativeId)) {
    return ex.soloAlternativeId;
  }
  return exerciseId;
}

export function needsSpotterWithoutBuddy(
  ex: Exercise | undefined,
  session: Pick<WorkoutSession, 'withBuddy'>
): boolean {
  return Boolean(ex?.needsSpotter && !session.withBuddy);
}

// ---------------------------------------------------------------------------
// Migration of data stored by earlier versions
// ---------------------------------------------------------------------------

const LEGACY_SPLITS: Record<
  LegacySessionSplitType,
  { splitType: SessionSplitType; withBuddy: boolean }
> = {
  BUDDY_UPPER: { splitType: 'UPPER', withBuddy: true },
  BUDDY_LOWER: { splitType: 'LOWER', withBuddy: true },
  SOLO_UPPER: { splitType: 'UPPER', withBuddy: false },
  SOLO_LOWER: { splitType: 'LOWER', withBuddy: false },
};

/** Converts a session saved with a legacy BUDDY_/SOLO_ split into UPPER/LOWER + withBuddy. */
export function normalizeSession(session: WorkoutSession): WorkoutSession {
  const legacy = LEGACY_SPLITS[session.splitType as unknown as LegacySessionSplitType];
  if (!legacy) return session;
  return {
    ...session,
    splitType: legacy.splitType,
    withBuddy: session.withBuddy ?? legacy.withBuddy,
  };
}

const ALL_WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/** Fills `buddyDays` for plans saved before buddy availability became per-day. */
export function normalizePlanConfig(plan: PlanConfig): PlanConfig {
  if (Array.isArray(plan.buddyDays)) return plan;
  const buddyDays: Weekday[] =
    plan.upperLowerVariant === 'BUDDY_ONLY' ? [...ALL_WEEKDAYS] : [];
  const name = plan.name
    ?.replace(/^Hybrid Solo \+ Buddy /, '')
    .replace(/^(Buddy|Solo) /, '');
  return { ...plan, buddyDays, name };
}

/**
 * Sets a session's buddy flag. Switching to solo also swaps any lift that
 * needs a spotter for its safe solo alternative (e.g. Barbell Bench →
 * Dumbbell Bench). Switching to buddy leaves exercises as they are.
 */
export function setSessionBuddy(
  session: WorkoutSession,
  withBuddy: boolean,
  exerciseMap: Map<string, Exercise>
): WorkoutSession {
  if (withBuddy) return { ...session, withBuddy: true };
  const safe = (id: string) => getSafeExerciseId(id, exerciseMap, false);
  return {
    ...session,
    withBuddy: false,
    primaryLiftId: safe(session.primaryLiftId),
    supersets: session.supersets.map((ss) => ({
      ...ss,
      exerciseAId: safe(ss.exerciseAId),
      exerciseBId: safe(ss.exerciseBId),
    })),
    finishers: session.finishers.map((f) => ({ ...f, exerciseId: safe(f.exerciseId) })),
  };
}
