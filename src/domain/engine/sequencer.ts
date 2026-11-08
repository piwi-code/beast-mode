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
  PPL_PUSH: 'PPL — Push Day (Chest / Delts / Triceps)',
  PPL_PULL: 'PPL — Pull Day (Lats / Upper Back / Biceps)',
  PPL_LEGS: 'PPL — Leg Day (Quads / Posterior / Sled)',
  BUDDY_UPPER: 'Buddy Upper (Partner Station Flow)',
  BUDDY_LOWER: 'Buddy Lower (Squat + Spine Decompression)',
  SOLO_UPPER: 'Solo Upper (DB / Cable Hypertrophy Flow)',
  SOLO_LOWER: 'Solo Lower (Squat + Unilateral / Sled)',
};

export function getRotationForPlan(plan: PlanConfig): SessionSplitType[] {
  if (plan.scheduleFamily === 'PPL') {
    return ['PPL_PUSH', 'PPL_PULL', 'PPL_LEGS'];
  }

  // UPPER_LOWER
  if (plan.upperLowerVariant === 'BUDDY_ONLY') {
    return ['BUDDY_UPPER', 'BUDDY_LOWER'];
  }
  if (plan.upperLowerVariant === 'SOLO_ONLY') {
    return ['SOLO_UPPER', 'SOLO_LOWER'];
  }

  // HYBRID_SOLO_BUDDY (e.g., 4-day Solo Upper -> Solo Lower -> Buddy Upper -> Buddy Lower, or 2/3-day rolling)
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
        alternatives: ['bb_rdl'],
      };
    case 'BUDDY_UPPER':
      return {
        recommended: 'bb_flat_bench',
        alternatives: ['bb_ohp', 'db_incline_press'],
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
        alternatives: ['bb_rdl'],
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
  recentSessions: WorkoutSession[],
  now: Date = new Date()
): NextSessionSuggestion {
  const rotation = getRotationForPlan(plan);
  const sorted = [...recentSessions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const lastSession = sorted[0];

  let nextSplit: SessionSplitType = rotation[0];
  let rationale = `Starting your ${plan.sessionsPerWeek}-day/week ${plan.name} rotation.`;
  let turnaroundHoursSinceLast: number | undefined;

  if (lastSession) {
    const diffMs = now.getTime() - new Date(lastSession.date).getTime();
    turnaroundHoursSinceLast = Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));

    const lastIdx = rotation.indexOf(lastSession.splitType);
    if (lastIdx !== -1) {
      nextSplit = rotation[(lastIdx + 1) % rotation.length];
      rationale = `Last session was ${SPLIT_LABELS[lastSession.splitType]} (${turnaroundHoursSinceLast}h ago) → advancing to ${SPLIT_LABELS[nextSplit]}.`;
    } else {
      // Switching between plan families cleanly: if last was Lower/Legs -> suggest Upper/Push
      const lastWasLower =
        lastSession.splitType.includes('LOWER') ||
        lastSession.splitType === 'PPL_LEGS';
      nextSplit = lastWasLower ? rotation[0] : rotation[1] || rotation[0];
      rationale = `Last session was ${SPLIT_LABELS[lastSession.splitType]} → alternating to ${SPLIT_LABELS[nextSplit]}.`;
    }
  }

  const liftCandidates = getPrimaryLiftCandidatesForSplit(nextSplit);
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
    recommendedPrimaryLiftId: liftCandidates.recommended,
    alternativePrimaryLiftIds: liftCandidates.alternatives,
    recommendedSupersetIds,
    recommendedFinisherIds,
    turnaroundHoursSinceLast,
  };
}

export function buildDraftSessionFromSuggestion(
  suggestion: NextSessionSuggestion,
  exercises: Exercise[],
  curatedSupersets: SupersetPair[],
  dateIso: string = new Date().toISOString()
): WorkoutSession {
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
  const supersetMap = new Map(curatedSupersets.map((s) => [s.id, s]));

  const primaryExercise = exerciseMap.get(suggestion.recommendedPrimaryLiftId);
  const primarySetCount = primaryExercise?.defaultSets ?? 4;

  const primaryLiftSets = Array.from({ length: primarySetCount }, (_, idx) => ({
    setNumber: idx + 1,
    weightKg: primaryExercise?.id === 'bb_back_squat' ? 100 : primaryExercise?.id === 'bb_flat_bench' ? 80 : 60,
    reps: 6,
    rpe: 8,
    completed: false,
  }));

  const supersets: SessionSupersetBlock[] = [];
  suggestion.recommendedSupersetIds.forEach((ssId, index) => {
    const pair = supersetMap.get(ssId);
    if (!pair) return;
    const targetSets = 3;
    supersets.push({
      id: `ss_block_${Date.now()}_${index}`,
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
        id: `fin_block_${Date.now()}_${idx}`,
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
    id: `session_${Date.now()}`,
    date: dateIso,
    splitType: suggestion.splitType,
    primaryLiftId: suggestion.recommendedPrimaryLiftId,
    primaryLiftSets,
    supersets,
    finishers,
    totalAxialLoad: 0,
    status: 'PLANNED',
  };
}
