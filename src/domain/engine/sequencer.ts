import {
  Exercise,
  PlanConfig,
  SessionFinisherBlock,
  SessionSplitType,
  SessionSupersetBlock,
  SupersetPair,
  WorkoutSession,
} from '../models/types';
import {
  SPLIT_LABELS,
  SPLIT_SHORT_LABELS,
  getSafeExerciseId,
  isBuddyDay,
  isLowerSplit,
} from './splits';
import { estimateStartingLoad } from './loads';

export { SPLIT_LABELS, SPLIT_SHORT_LABELS } from './splits';

export interface NextSessionSuggestion {
  splitType: SessionSplitType;
  /** Buddy/spotter expected (from the plan's buddy days unless overridden). */
  withBuddy: boolean;
  splitLabel: string;
  rationale: string;
  recommendedPrimaryLiftId: string;
  alternativePrimaryLiftIds: string[];
  recommendedSupersetIds: string[];
  recommendedFinisherIds: string[];
  turnaroundHoursSinceLast?: number;
}

export function getRotationForPlan(plan: PlanConfig): SessionSplitType[] {
  if (plan.scheduleFamily === 'PPL') {
    return ['PPL_PUSH', 'PPL_PULL', 'PPL_LEGS'];
  }

  return ['UPPER', 'LOWER'];
}

/**
 * Primary lift candidates for a split. Without a buddy, lifts that need a
 * spotter (barbell bench) are dropped in favour of dumbbell/self-spotting
 * alternatives.
 */
export function getPrimaryLiftCandidatesForSplit(
  splitType: SessionSplitType,
  withBuddy: boolean = true
): { recommended: string; alternatives: string[] } {
  switch (splitType) {
    case 'PPL_PUSH':
    case 'UPPER':
      return withBuddy
        ? {
            recommended: 'bb_flat_bench',
            alternatives: ['bb_ohp', 'db_incline_press', 'db_flat_bench'],
          }
        : {
            recommended: 'db_flat_bench',
            alternatives: ['db_incline_press', 'bb_ohp'],
          };
    case 'PPL_PULL':
      return {
        recommended: 'weighted_pullup',
        alternatives: ['bb_pendlay_row', 'lat_pulldown_neutral'],
      };
    case 'PPL_LEGS':
    case 'LOWER':
      return withBuddy
        ? {
            recommended: 'bb_back_squat',
            alternatives: ['bb_deadlift', 'bb_rdl', 'leg_press_machine'],
          }
        : {
            recommended: 'leg_press_machine',
            alternatives: ['bb_deadlift', 'bb_rdl', 'db_bulgarian_split_squat'],
          };
  }
}

/**
 * Default superset order per split. Buddy sessions favour partner-friendly
 * station swaps; solo sessions favour self-contained single-station pairs.
 */
export function getDefaultSupersetsForSplit(
  splitType: SessionSplitType,
  count: 2 | 3 | 4,
  withBuddy: boolean = true
): string[] {
  const map: Record<SessionSplitType, { buddy: string[]; solo: string[] }> = {
    UPPER: {
      buddy: [
        'ss_row_cable_fly',
        'ss_shared_bench_arms',
        'ss_incline_row_lateral_delt',
        'ss_cable_delt_tricep',
      ],
      solo: [
        'ss_row_cable_fly',
        'ss_cable_delt_tricep',
        'ss_shared_bench_arms',
        'ss_incline_row_lateral_delt',
      ],
    },
    LOWER: {
      buddy: [
        'ss_hamstring_calf',
        'ss_lat_core_decompression',
        'ss_quad_core_reset',
        'ss_lunges_hammer_curls',
      ],
      solo: [
        'ss_hamstring_calf',
        'ss_lat_core_decompression',
        'ss_lunges_hammer_curls',
        'ss_quad_core_reset',
      ],
    },
    PPL_PUSH: {
      buddy: [
        'ss_row_cable_fly',
        'ss_cable_delt_tricep',
        'ss_shared_bench_arms',
        'ss_incline_row_lateral_delt',
      ],
      solo: [
        'ss_cable_delt_tricep',
        'ss_row_cable_fly',
        'ss_shared_bench_arms',
        'ss_incline_row_lateral_delt',
      ],
    },
    PPL_PULL: {
      buddy: [
        'ss_incline_row_lateral_delt',
        'ss_lat_core_decompression',
        'ss_shared_bench_arms',
        'ss_row_cable_fly',
      ],
      solo: [
        'ss_incline_row_lateral_delt',
        'ss_lat_core_decompression',
        'ss_shared_bench_arms',
        'ss_row_cable_fly',
      ],
    },
    PPL_LEGS: {
      buddy: [
        'ss_hamstring_calf',
        'ss_lat_core_decompression',
        'ss_quad_core_reset',
        'ss_lunges_hammer_curls',
      ],
      solo: [
        'ss_hamstring_calf',
        'ss_lunges_hammer_curls',
        'ss_lat_core_decompression',
        'ss_quad_core_reset',
      ],
    },
  };

  return map[splitType][withBuddy ? 'buddy' : 'solo'].slice(0, count);
}

export function getDefaultFinishersForSplit(
  splitType: SessionSplitType,
  count: 1 | 2
): string[] {
  if (isLowerSplit(splitType)) {
    return count === 1
      ? ['turf_sled_push_pull']
      : ['turf_sled_push_pull', 'farmers_carry_turf'];
  }
  // Upper/Push/Pull: posture work first, then the to-failure pump finisher last
  // (a curl drop set before face pulls would fry the grip and biceps they rely on).
  const pump =
    splitType === 'PPL_PUSH' ? 'cable_pushdown_drop_set' : 'bb_curl_drop_set';
  return count === 1 ? ['rope_face_pull'] : ['rope_face_pull', pump];
}

/** Builds a finisher block with the exercise's own protocol and starting load. */
export function buildFinisherBlock(
  exercise: Exercise | undefined,
  exerciseId: string
): SessionFinisherBlock {
  return {
    id: `fin_block_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    exerciseId,
    rounds: Math.min(3, exercise?.defaultSets ?? 3),
    protocolNote: exercise?.finisherProtocol ?? '3 rounds, controlled tempo',
    loadKg: exercise?.finisherLoadKg ?? 20,
    completedRounds: 0,
  };
}

/** Swaps a finisher's exercise and resets its protocol, rounds and load to match. */
export function changeFinisherExercise(
  block: SessionFinisherBlock,
  exercise: Exercise | undefined,
  exerciseId: string
): SessionFinisherBlock {
  return { ...buildFinisherBlock(exercise, exerciseId), id: block.id };
}

/** Picks a sensible extra finisher for "+ Add Finisher" that is not already in the session. */
export function pickExtraFinisherId(
  session: WorkoutSession,
  exercises: Exercise[]
): string {
  const used = new Set(session.finishers.map((f) => f.exerciseId));
  const preferred = [
    ...getDefaultFinishersForSplit(session.splitType, 2),
    ...exercises.filter((e) => e.isFinisherCandidate).map((e) => e.id),
  ];
  return preferred.find((id) => !used.has(id)) ?? preferred[0];
}

export interface SuggestionOverrides {
  /** Build the suggestion for this split instead of the next one in the rotation. */
  split?: SessionSplitType;
  supersetCount?: 2 | 3 | 4;
  finisherCount?: 1 | 2;
}

export function suggestNextSession(
  plan: PlanConfig,
  priorSessions: WorkoutSession[],
  referenceDate: Date = new Date(),
  withBuddyOverride?: boolean,
  overrides: SuggestionOverrides = {}
): NextSessionSuggestion {
  const withBuddy = withBuddyOverride ?? isBuddyDay(plan, referenceDate);
  const rotation = getRotationForPlan(plan);
  const sorted = [...priorSessions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const lastSession = sorted[0];

  let nextSplit: SessionSplitType = rotation[0];
  let rationale = `Starting your ${plan.sessionsPerWeek}-day/week ${plan.name} rotation.`;
  let turnaroundHoursSinceLast: number | undefined;

  if (lastSession) {
    const diffMs = referenceDate.getTime() - new Date(lastSession.date).getTime();
    turnaroundHoursSinceLast = Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));

    const lastIdx = rotation.indexOf(lastSession.splitType);
    if (lastIdx !== -1) {
      nextSplit = rotation[(lastIdx + 1) % rotation.length];
      rationale = `Following ${SPLIT_SHORT_LABELS[lastSession.splitType]} → next in sequence is ${SPLIT_SHORT_LABELS[nextSplit]}.`;
    } else {
      const lastWasLower = isLowerSplit(lastSession.splitType);
      nextSplit = lastWasLower ? rotation[0] : rotation[1] || rotation[0];
      rationale = `Last session was ${SPLIT_SHORT_LABELS[lastSession.splitType]} → alternating to ${SPLIT_SHORT_LABELS[nextSplit]}.`;
    }
  }

  if (overrides.split) {
    nextSplit = overrides.split;
    rationale = `Switched to ${SPLIT_SHORT_LABELS[nextSplit]}: exercises re-picked for the new focus.`;
  }

  const liftCandidates = getPrimaryLiftCandidatesForSplit(nextSplit, withBuddy);
  // Automatically flip-flop between Back Squat and Deadlift on consecutive Lower / Legs sessions
  // (Works seamlessly for both 2-session/wk week-to-week alternation and 4-session/wk Lower A / Lower B)
  let recommendedPrimaryLiftId = liftCandidates.recommended;
  let alternativePrimaryLiftIds = [...liftCandidates.alternatives];

  if (isLowerSplit(nextSplit)) {
    const lastLower = sorted.find((s) => isLowerSplit(s.splitType));
    // Squat pattern on a solo day = Leg Press (no spotter needed)
    const squatId = withBuddy ? 'bb_back_squat' : 'leg_press_machine';
    const lastWasSquat =
      lastLower?.primaryLiftId === 'bb_back_squat' ||
      lastLower?.primaryLiftId === 'leg_press_machine' ||
      lastLower?.primaryLiftId === 'db_bulgarian_split_squat';
    if (lastWasSquat) {
      recommendedPrimaryLiftId = 'bb_deadlift';
      alternativePrimaryLiftIds = [squatId, 'bb_rdl'];
      rationale += ' Flip-flopping Lower anchor from Squat → Deadlift.';
    } else if (
      lastLower?.primaryLiftId === 'bb_deadlift' ||
      lastLower?.primaryLiftId === 'bb_rdl'
    ) {
      recommendedPrimaryLiftId = squatId;
      alternativePrimaryLiftIds = ['bb_deadlift', 'bb_rdl'];
      rationale += ' Flip-flopping Lower anchor from Deadlift → Squat.';
    }
  }

  rationale += withBuddy
    ? ' Buddy session: spotted barbell lifts enabled.'
    : ' Solo session: spotter-free lifts selected.';

  const recommendedSupersetIds = getDefaultSupersetsForSplit(
    nextSplit,
    overrides.supersetCount ?? plan.targetSupersetsPerSession,
    withBuddy
  );
  const recommendedFinisherIds = getDefaultFinishersForSplit(
    nextSplit,
    overrides.finisherCount ?? plan.targetFinishersPerSession
  );

  return {
    splitType: nextSplit,
    withBuddy,
    splitLabel: SPLIT_LABELS[nextSplit],
    rationale,
    recommendedPrimaryLiftId,
    alternativePrimaryLiftIds,
    recommendedSupersetIds,
    recommendedFinisherIds,
    turnaroundHoursSinceLast,
  };
}

export function buildDraftSessionFromSuggestion(
  suggestion: NextSessionSuggestion,
  exercises: Exercise[],
  curatedSupersets: SupersetPair[],
  dateIso: string = new Date().toISOString(),
  status: 'PLANNED' | 'ACTIVE' = 'PLANNED'
): WorkoutSession {
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
  const supersetMap = new Map(curatedSupersets.map((s) => [s.id, s]));

  // Never auto-select a lift that needs a spotter for a solo session.
  const primaryLiftId = getSafeExerciseId(
    suggestion.recommendedPrimaryLiftId,
    exerciseMap,
    suggestion.withBuddy
  );
  const safeId = (id: string) =>
    getSafeExerciseId(id, exerciseMap, suggestion.withBuddy);
  const primaryExercise = exerciseMap.get(primaryLiftId);
  const primarySetCount = primaryExercise?.defaultSets ?? 4;

  const defaultPrimaryWeight = estimateStartingLoad(primaryExercise);

  const primaryLiftSets = Array.from({ length: primarySetCount }, (_, idx) => ({
    setNumber: idx + 1,
    weightKg: defaultPrimaryWeight,
    reps: 6,
    rpe: 8,
    completed: false,
  }));

  const supersets: SessionSupersetBlock[] = [];
  suggestion.recommendedSupersetIds.forEach((ssId, index) => {
    const pair = supersetMap.get(ssId);
    if (!pair) return;
    const targetSets: 2 | 3 | 4 = 3;
    supersets.push({
      id: `ss_block_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${index}`,
      supersetPairId: pair.id,
      customName: pair.name,
      exerciseAId: safeId(pair.exerciseAId),
      exerciseBId: safeId(pair.exerciseBId),
      executionMode: 'PAIRED',
      targetSets,
      setsA: Array.from({ length: targetSets }, (_, idx) => ({
        setNumber: idx + 1,
        weightKg: 35,
        reps: 10,
        completed: false,
      })),
      setsB: Array.from({ length: targetSets }, (_, idx) => ({
        setNumber: idx + 1,
        weightKg: 25,
        reps: 12,
        completed: false,
      })),
    });
  });

  const finishers: SessionFinisherBlock[] = suggestion.recommendedFinisherIds.map(
    (finId) => buildFinisherBlock(exerciseMap.get(finId), finId)
  );

  return {
    id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    date: dateIso,
    splitType: suggestion.splitType,
    withBuddy: suggestion.withBuddy,
    primaryLiftId,
    primaryLiftSets,
    supersets,
    finishers,
    totalAxialLoad: 0,
    includeInProjectedLoad: true,
    status,
  };
}

/**
 * Re-picks a session's exercises for a new split (e.g. Lower -> Upper):
 * primary lift (incl. Squat/Deadlift flip-flop and buddy/spotter rules),
 * supersets and finishers all change to suit the new focus. Keeps the
 * session's id, date, status, notes, buddy flag and how many supersets /
 * finishers it had.
 */
export function rebuildSessionForSplit(
  session: WorkoutSession,
  newSplit: SessionSplitType,
  plan: PlanConfig,
  priorSessions: WorkoutSession[],
  exercises: Exercise[],
  curatedSupersets: SupersetPair[]
): WorkoutSession {
  const sessionTime = new Date(session.date).getTime();
  const prior = priorSessions.filter(
    (s) => s.id !== session.id && new Date(s.date).getTime() < sessionTime
  );
  const ssCount = session.supersets.length;
  const finCount = session.finishers.length;

  const suggestion = suggestNextSession(
    plan,
    prior,
    new Date(session.date),
    Boolean(session.withBuddy),
    {
      split: newSplit,
      supersetCount:
        ssCount >= 2 && ssCount <= 4
          ? (ssCount as 2 | 3 | 4)
          : plan.targetSupersetsPerSession,
      finisherCount:
        finCount >= 1 && finCount <= 2
          ? (finCount as 1 | 2)
          : plan.targetFinishersPerSession,
    }
  );
  const rebuilt = buildDraftSessionFromSuggestion(
    suggestion,
    exercises,
    curatedSupersets,
    session.date,
    session.status === 'ACTIVE' ? 'ACTIVE' : 'PLANNED'
  );
  return {
    ...rebuilt,
    id: session.id,
    status: session.status,
    notes: session.notes,
    includeInProjectedLoad: session.includeInProjectedLoad,
  };
}

/**
 * Resize setsA and setsB on a superset block when the user toggles between 2 and 3 sets.
 */
export function resizeSupersetTargetSets(
  block: SessionSupersetBlock,
  newTargetSets: 2 | 3 | 4
): SessionSupersetBlock {
  const resizeList = (list: typeof block.setsA, fallbackWeight: number) => {
    if (list.length === newTargetSets) return list;
    if (list.length > newTargetSets) return list.slice(0, newTargetSets);
    const last = list[list.length - 1];
    const extra = Array.from(
      { length: newTargetSets - list.length },
      (_, idx) => ({
        setNumber: list.length + idx + 1,
        weightKg: last?.weightKg ?? fallbackWeight,
        reps: last?.reps ?? 10,
        completed: false,
      })
    );
    return [...list, ...extra];
  };

  return {
    ...block,
    targetSets: newTargetSets,
    setsA: resizeList(block.setsA, 35),
    setsB: resizeList(block.setsB, 20),
  };
}
