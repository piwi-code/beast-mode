import {
  Exercise,
  PlanConfig,
  SessionFinisherBlock,
  SessionSplitType,
  SessionSupersetBlock,
  SupersetPair,
  WorkoutSession,
} from '../models/types';

export interface NextSessionSuggestion {
  splitType: SessionSplitType;
  splitLabel: string;
  rationale: string;
  recommendedPrimaryLiftId: string;
  alternativePrimaryLiftIds: string[];
  recommendedSupersetIds: string[];
  recommendedFinisherIds: string[];
  turnaroundHoursSinceLast?: number;
}

export const SPLIT_LABELS: Record<SessionSplitType, string> = {
  PPL_PUSH: 'PPL — Push (Chest / Delts / Triceps)',
  PPL_PULL: 'PPL — Pull (Lats / Back / Biceps)',
  PPL_LEGS: 'PPL — Legs (Quads / Posterior / Sled)',
  BUDDY_UPPER: 'Buddy Upper (Partner Bench & Swap Flow)',
  BUDDY_LOWER: 'Buddy Lower (Squat + Spine Decompression)',
  SOLO_UPPER: 'Solo Upper (DB / Cable Hypertrophy)',
  SOLO_LOWER: 'Solo Lower (Squat + Unilateral / Sled)',
};

export const SPLIT_SHORT_LABELS: Record<SessionSplitType, string> = {
  PPL_PUSH: 'Push',
  PPL_PULL: 'Pull',
  PPL_LEGS: 'Legs',
  BUDDY_UPPER: 'Buddy Upper',
  BUDDY_LOWER: 'Buddy Lower',
  SOLO_UPPER: 'Solo Upper',
  SOLO_LOWER: 'Solo Lower',
};

export function getRotationForPlan(plan: PlanConfig): SessionSplitType[] {
  if (plan.scheduleFamily === 'PPL') {
    return ['PPL_PUSH', 'PPL_PULL', 'PPL_LEGS'];
  }

  if (plan.upperLowerVariant === 'BUDDY_ONLY') {
    return ['BUDDY_UPPER', 'BUDDY_LOWER'];
  }
  if (plan.upperLowerVariant === 'SOLO_ONLY') {
    return ['SOLO_UPPER', 'SOLO_LOWER'];
  }

  return ['SOLO_UPPER', 'SOLO_LOWER', 'BUDDY_UPPER', 'BUDDY_LOWER'];
}

export function getPrimaryLiftCandidatesForSplit(
  splitType: SessionSplitType
): { recommended: string; alternatives: string[] } {
  switch (splitType) {
    case 'PPL_PUSH':
      return {
        recommended: 'bb_flat_bench',
        alternatives: ['bb_ohp', 'db_flat_bench', 'db_incline_press'],
      };
    case 'PPL_PULL':
      return {
        recommended: 'weighted_pullup',
        alternatives: ['bb_pendlay_row', 'lat_pulldown_neutral'],
      };
    case 'PPL_LEGS':
      return {
        recommended: 'bb_back_squat',
        alternatives: ['bb_deadlift', 'bb_rdl'],
      };
    case 'BUDDY_UPPER':
      return {
        recommended: 'bb_flat_bench',
        alternatives: ['bb_ohp', 'db_incline_press', 'db_flat_bench'],
      };
    case 'SOLO_UPPER':
      return {
        recommended: 'db_flat_bench',
        alternatives: ['bb_flat_bench', 'bb_ohp', 'db_incline_press'],
      };
    case 'BUDDY_LOWER':
    case 'SOLO_LOWER':
      return {
        recommended: 'bb_back_squat',
        alternatives: ['bb_deadlift', 'bb_rdl'],
      };
  }
}

export function getDefaultSupersetsForSplit(
  splitType: SessionSplitType,
  count: 2 | 3 | 4
): string[] {
  const map: Record<SessionSplitType, string[]> = {
    BUDDY_UPPER: [
      'ss_row_cable_fly',
      'ss_shared_bench_arms',
      'ss_incline_row_lateral_delt',
      'ss_cable_delt_tricep',
    ],
    SOLO_UPPER: [
      'ss_row_cable_fly',
      'ss_cable_delt_tricep',
      'ss_shared_bench_arms',
      'ss_incline_row_lateral_delt',
    ],
    BUDDY_LOWER: [
      'ss_hamstring_calf',
      'ss_lat_core_decompression',
      'ss_quad_core_reset',
      'ss_lunges_hammer_curls',
    ],
    SOLO_LOWER: [
      'ss_lunges_hammer_curls',
      'ss_hamstring_calf',
      'ss_lat_core_decompression',
      'ss_quad_core_reset',
    ],
    PPL_PUSH: [
      'ss_cable_delt_tricep',
      'ss_row_cable_fly',
      'ss_shared_bench_arms',
      'ss_incline_row_lateral_delt',
    ],
    PPL_PULL: [
      'ss_incline_row_lateral_delt',
      'ss_lat_core_decompression',
      'ss_shared_bench_arms',
      'ss_row_cable_fly',
    ],
    PPL_LEGS: [
      'ss_hamstring_calf',
      'ss_lat_core_decompression',
      'ss_lunges_hammer_curls',
      'ss_quad_core_reset',
    ],
  };

  return map[splitType].slice(0, count);
}

export function getDefaultFinishersForSplit(
  splitType: SessionSplitType,
  count: 1 | 2
): string[] {
  const isLower =
    splitType === 'BUDDY_LOWER' ||
    splitType === 'SOLO_LOWER' ||
    splitType === 'PPL_LEGS';

  if (isLower) {
    return count === 1
      ? ['turf_sled_push_pull']
      : ['turf_sled_push_pull', 'farmers_carry_turf'];
  }
  return count === 1
    ? ['rope_face_pull']
    : ['rope_face_pull', 'farmers_carry_turf'];
}

export function suggestNextSession(
  plan: PlanConfig,
  priorSessions: WorkoutSession[],
  referenceDate: Date = new Date()
): NextSessionSuggestion {
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
      const lastWasLower =
        lastSession.splitType.includes('LOWER') ||
        lastSession.splitType === 'PPL_LEGS';
      nextSplit = lastWasLower ? rotation[0] : rotation[1] || rotation[0];
      rationale = `Last session was ${SPLIT_SHORT_LABELS[lastSession.splitType]} → alternating to ${SPLIT_SHORT_LABELS[nextSplit]}.`;
    }
  }

  const liftCandidates = getPrimaryLiftCandidatesForSplit(nextSplit);
  // Automatically flip-flop between Back Squat and Deadlift on consecutive Lower / Legs sessions
  // (Works seamlessly for both 2-session/wk week-to-week alternation and 4-session/wk Lower A / Lower B)
  let recommendedPrimaryLiftId = liftCandidates.recommended;
  let alternativePrimaryLiftIds = [...liftCandidates.alternatives];

  if (
    nextSplit === 'BUDDY_LOWER' ||
    nextSplit === 'SOLO_LOWER' ||
    nextSplit === 'PPL_LEGS'
  ) {
    const lastLower = sorted.find(
      (s) =>
        s.splitType === 'BUDDY_LOWER' ||
        s.splitType === 'SOLO_LOWER' ||
        s.splitType === 'PPL_LEGS'
    );
    if (lastLower?.primaryLiftId === 'bb_back_squat') {
      recommendedPrimaryLiftId = 'bb_deadlift';
      alternativePrimaryLiftIds = ['bb_back_squat', 'bb_rdl'];
      rationale += ' Flip-flopping Lower anchor from Squat → Deadlift.';
    } else if (
      lastLower?.primaryLiftId === 'bb_deadlift' ||
      lastLower?.primaryLiftId === 'bb_rdl'
    ) {
      recommendedPrimaryLiftId = 'bb_back_squat';
      alternativePrimaryLiftIds = ['bb_deadlift', 'bb_rdl'];
      rationale += ' Flip-flopping Lower anchor from Deadlift → Squat.';
    }
  }

  const recommendedSupersetIds = getDefaultSupersetsForSplit(
    nextSplit,
    plan.targetSupersetsPerSession
  );
  const recommendedFinisherIds = getDefaultFinishersForSplit(
    nextSplit,
    plan.targetFinishersPerSession
  );

  return {
    splitType: nextSplit,
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

  const primaryExercise = exerciseMap.get(suggestion.recommendedPrimaryLiftId);
  const primarySetCount = primaryExercise?.defaultSets ?? 4;

  const defaultPrimaryWeight =
    primaryExercise?.id === 'bb_back_squat'
      ? 110
      : primaryExercise?.id === 'bb_deadlift'
      ? 130
      : primaryExercise?.id === 'bb_rdl'
      ? 95
      : primaryExercise?.id === 'bb_flat_bench'
      ? 85
      : 60;

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
      exerciseAId: pair.exerciseAId,
      exerciseBId: pair.exerciseBId,
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
    (finId, idx) => {
      const isSled = finId === 'turf_sled_push_pull';
      return {
        id: `fin_block_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${idx}`,
        exerciseId: finId,
        rounds: 3,
        protocolNote: isSled
          ? '15–20m Forward Push + 15–20m Backward Drag (60–90s rest or You-Go-I-Go)'
          : '3x15–20 controlled external rotation / posture focus (60s rest)',
        loadKg: isSled ? 25 : 20,
        completedRounds: 0,
      };
    }
  );

  return {
    id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    date: dateIso,
    splitType: suggestion.splitType,
    primaryLiftId: suggestion.recommendedPrimaryLiftId,
    primaryLiftSets,
    supersets,
    finishers,
    totalAxialLoad: 0,
    includeInProjectedLoad: true,
    status,
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
