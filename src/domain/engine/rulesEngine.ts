import {
  Exercise,
  ExerciseSlotEvaluation,
  MuscleGroup,
  MuscleVolumeSummary,
  PlanConfig,
  SafeguardAlert,
  SessionSplitType,
  SupersetPair,
  WorkoutSession,
} from '../models/types';
import {
  SPLIT_SHORT_LABELS,
  isLowerSplit,
  isUpperSplit,
  needsSpotterWithoutBuddy,
} from './splits';

export const ALL_MUSCLE_GROUPS: MuscleGroup[] = [
  'CHEST',
  'CHEST_UPPER',
  'LATS',
  'UPPER_BACK',
  'ANTERIOR_DELT',
  'LATERAL_DELT',
  'REAR_DELT',
  'TRICEPS',
  'BICEPS',
  'QUADS',
  'HAMSTRINGS',
  'GLUTES',
  'CALVES',
  'CORE',
];

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  QUADS: 'Quads',
  HAMSTRINGS: 'Hamstrings',
  GLUTES: 'Glutes',
  CALVES: 'Calves',
  CHEST: 'Chest (Mid/Flat)',
  CHEST_UPPER: 'Upper Chest',
  LATS: 'Lats',
  UPPER_BACK: 'Upper Back & Traps',
  ANTERIOR_DELT: 'Front Delts',
  LATERAL_DELT: 'Side Delts',
  REAR_DELT: 'Rear Delts / Rotators',
  TRICEPS: 'Triceps',
  BICEPS: 'Biceps / Brachialis',
  CORE: 'Core / Pelvic Stabilizers',
};

const LOWER_MUSCLES: MuscleGroup[] = ['QUADS', 'HAMSTRINGS', 'GLUTES', 'CALVES'];
const PUSH_MUSCLES: MuscleGroup[] = [
  'CHEST',
  'CHEST_UPPER',
  'ANTERIOR_DELT',
  'LATERAL_DELT',
  'TRICEPS',
];
const PULL_MUSCLES: MuscleGroup[] = [
  'LATS',
  'UPPER_BACK',
  'REAR_DELT',
  'BICEPS',
];

/**
 * Checks whether an exercise's style fits the session's split plane.
 * Note: Lower days explicitly allow Lat Pulldown, Core Decompression, and Bicep Hammer Curls (for Lunge station).
 */
export function isExerciseStyleAlignedWithSplit(
  exercise: Exercise,
  splitType: SessionSplitType
): boolean {
  if (
    exercise.pattern === 'CORE_DECOMPRESSION' ||
    exercise.pattern === 'LOCOMOTION' ||
    // Pure core work fits any day
    exercise.primaryMuscles.every((m) => m === 'CORE')
  ) {
    return true;
  }

  if (isLowerSplit(splitType)) {
    if (exercise.primaryMuscles.some((m) => LOWER_MUSCLES.includes(m))) {
      return true;
    }
    // Lower days intentionally allow vertical pull (spinal decompression) and hammer curls (lunge pairing)
    if (
      exercise.id === 'lat_pulldown_neutral' ||
      exercise.id === 'db_hammer_curls'
    ) {
      return true;
    }
    return false;
  }

  if (isUpperSplit(splitType)) {
    return exercise.primaryMuscles.some(
      (m) => PUSH_MUSCLES.includes(m) || PULL_MUSCLES.includes(m)
    );
  }

  if (splitType === 'PPL_PUSH') {
    // Allow antagonist row in Push if paired, or push muscles
    return (
      exercise.primaryMuscles.some((m) => PUSH_MUSCLES.includes(m)) ||
      exercise.id === 'machine_row_narrow' ||
      exercise.id === 'rope_face_pull'
    );
  }

  if (splitType === 'PPL_PULL') {
    return (
      exercise.primaryMuscles.some((m) => PULL_MUSCLES.includes(m)) ||
      exercise.id === 'cable_lateral_raise'
    );
  }

  return true;
}

export function calculateSessionAxialLoad(
  session: WorkoutSession,
  exerciseMap: Map<string, Exercise>
): number {
  let total = 0;
  const primary = exerciseMap.get(session.primaryLiftId);
  if (primary) {
    total += primary.axialLoadScore;
  }

  for (const ss of session.supersets) {
    const exA = exerciseMap.get(ss.exerciseAId);
    const exB = exerciseMap.get(ss.exerciseBId);
    if (exA) total += exA.axialLoadScore;
    if (exB) total += exB.axialLoadScore;
  }

  for (const fin of session.finishers) {
    const ex = exerciseMap.get(fin.exerciseId);
    if (ex) total += ex.axialLoadScore;
  }

  return total;
}

export function calculateSessionMuscleSets(
  session: WorkoutSession,
  exerciseMap: Map<string, Exercise>
): Record<MuscleGroup, number> {
  const tally = Object.fromEntries(
    ALL_MUSCLE_GROUPS.map((m) => [m, 0])
  ) as Record<MuscleGroup, number>;

  const addExerciseSets = (exerciseId: string, setCount: number) => {
    const ex = exerciseMap.get(exerciseId);
    if (!ex || setCount <= 0) return;
    for (const m of ex.primaryMuscles) {
      tally[m] = (tally[m] || 0) + setCount;
    }
    for (const m of ex.secondaryMuscles) {
      tally[m] = (tally[m] || 0) + setCount * 0.5;
    }
  };

  addExerciseSets(session.primaryLiftId, session.primaryLiftSets.length || 4);

  for (const ss of session.supersets) {
    const countA = ss.targetSets || ss.setsA.length || 3;
    const countB = ss.targetSets || ss.setsB.length || 3;
    addExerciseSets(ss.exerciseAId, countA);
    addExerciseSets(ss.exerciseBId, countB);
  }

  for (const fin of session.finishers) {
    addExerciseSets(fin.exerciseId, fin.rounds || 3);
  }

  return tally;
}

export function getWeeklySetCeiling(plan: PlanConfig): number {
  if (plan.weeklySetCeilingOverride && plan.weeklySetCeilingOverride > 0) {
    return plan.weeklySetCeilingOverride;
  }
  return plan.sessionsPerWeek === 2 ? 10 : plan.sessionsPerWeek === 3 ? 13 : 15;
}

/**
 * Computes Current Loading (from COMPLETED history in last 7 days) AND
 * Projected Loading (after INCLUDED planned/active sessions are executed).
 */
export function computeMuscleVolumeSummaries(
  futureSessions: WorkoutSession[],
  completedSessions: WorkoutSession[],
  exercises: Exercise[],
  plan: PlanConfig,
  now: Date = new Date()
): MuscleVolumeSummary[] {
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
  const ms48h = 48 * 60 * 60 * 1000;
  const ms7d = 7 * 24 * 60 * 60 * 1000;
  const ms14d = 14 * 24 * 60 * 60 * 1000;

  const totals48h = Object.fromEntries(ALL_MUSCLE_GROUPS.map((m) => [m, 0])) as Record<
    MuscleGroup,
    number
  >;
  const totals7dCurrent = Object.fromEntries(
    ALL_MUSCLE_GROUPS.map((m) => [m, 0])
  ) as Record<MuscleGroup, number>;
  const totals14dCurrent = Object.fromEntries(
    ALL_MUSCLE_GROUPS.map((m) => [m, 0])
  ) as Record<MuscleGroup, number>;

  for (const session of completedSessions) {
    if (session.status !== 'COMPLETED') continue;
    const ageMs = now.getTime() - new Date(session.date).getTime();
    if (ageMs < 0 || ageMs > ms14d) continue;

    const sessionSets = calculateSessionMuscleSets(session, exerciseMap);
    for (const m of ALL_MUSCLE_GROUPS) {
      const val = sessionSets[m] || 0;
      totals14dCurrent[m] += val;
      if (ageMs <= ms7d) totals7dCurrent[m] += val;
      if (ageMs <= ms48h) totals48h[m] += val;
    }
  }

  const plannedTotals = Object.fromEntries(
    ALL_MUSCLE_GROUPS.map((m) => [m, 0])
  ) as Record<MuscleGroup, number>;

  for (const future of futureSessions) {
    if (future.includeInProjectedLoad === false) continue;
    const fSets = calculateSessionMuscleSets(future, exerciseMap);
    for (const m of ALL_MUSCLE_GROUPS) {
      plannedTotals[m] += fSets[m] || 0;
    }
  }

  const weeklyCeiling = getWeeklySetCeiling(plan);
  const weeklyFloor = plan.sessionsPerWeek === 2 ? 3 : 4;

  const classify = (sets: number): MuscleVolumeSummary['statusCurrent'] => {
    if (sets > weeklyCeiling) return 'OVERTRAINING_RISK';
    if (sets > weeklyCeiling - 3) return 'HIGH';
    if (sets < weeklyFloor) return 'UNDER';
    return 'OPTIMAL';
  };

  return ALL_MUSCLE_GROUPS.map((muscle) => {
    const sets48h = Math.round(totals48h[muscle] * 10) / 10;
    const sets7dCurrent = Math.round(totals7dCurrent[muscle] * 10) / 10;
    const plannedFutureSets = Math.round(plannedTotals[muscle] * 10) / 10;
    const sets7dProjected =
      Math.round((totals7dCurrent[muscle] + plannedTotals[muscle]) * 10) / 10;
    const sets14dProjected =
      Math.round((totals14dCurrent[muscle] + plannedTotals[muscle]) * 10) / 10;

    return {
      muscle,
      sets48h,
      sets7dCurrent,
      sets7dProjected,
      sets14dProjected,
      plannedFutureSets,
      statusCurrent: classify(sets7dCurrent),
      statusProjected: classify(sets7dProjected),
      recovery48hFlag: sets48h > 6,
    };
  });
}

/**
 * Evaluates a specific exercise slot within a session against:
 * 1. RED (INTRA_SESSION_OVERWORK): Overworked in this session (Axial > 4, competing superset partner, grip >= 3, or primary overlap)
 * 2. ORANGE (PROJECTED_OVERWORK): Overworked when history + earlier planned sessions are executed (48h recovery > 6 sets or projected weekly sets > ceiling)
 * 3. BLUE (WRONG_STYLE): Movement plane doesn't match the session split style
 * 4. GREEN (OPTIMAL): Meets all rules
 * Also computes a `suggestedReplacementId` so the 1-tap Quick Switch button can swap it immediately.
 */
export function evaluateExerciseSlot(params: {
  exerciseId: string;
  slotRole: 'PRIMARY' | 'SUPERSET_A' | 'SUPERSET_B' | 'FINISHER';
  partnerExerciseId?: string;
  session: WorkoutSession;
  priorSessions: WorkoutSession[]; // Completed + earlier planned sessions
  exercises: Exercise[];
  plan: PlanConfig;
}): ExerciseSlotEvaluation {
  const {
    exerciseId,
    slotRole,
    partnerExerciseId,
    session,
    priorSessions,
    exercises,
    plan,
  } = params;

  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
  const ex = exerciseMap.get(exerciseId);
  if (!ex) {
    return {
      health: 'OPTIMAL',
      headline: 'Valid Selection',
      reasons: [],
    };
  }

  const spotterReasons: string[] = [];
  const redReasons: string[] = [];
  const orangeReasons: string[] = [];
  const blueReasons: string[] = [];

  // 0. Safety: spotter-dependent lift on a session without a buddy
  if (needsSpotterWithoutBuddy(ex, session)) {
    const alt = ex.soloAlternativeId
      ? exerciseMap.get(ex.soloAlternativeId)
      : undefined;
    spotterReasons.push(
      `${ex.name} should be done with a spotter, but this session has no buddy.${
        alt ? ` Swap to ${alt.shortName ?? alt.name}, or tick "Buddy" if someone is spotting you.` : ' Tick "Buddy" if someone is spotting you.'
      }`
    );
  }

  // 1. Check Intra-Session Red Errors
  const totalAxial = calculateSessionAxialLoad(session, exerciseMap);
  if (totalAxial > 4 && ex.axialLoadScore >= 2 && slotRole !== 'PRIMARY') {
    redReasons.push(
      `Session Axial Load is ${totalAxial}/4 — ${ex.name} (Axial ${ex.axialLoadScore}) overloads spinal compression after the primary lift.`
    );
  }

  const primaryEx = exerciseMap.get(session.primaryLiftId);
  if (slotRole !== 'PRIMARY' && primaryEx) {
    const duplicatePress =
      primaryEx.pattern === 'HORIZONTAL_PUSH' &&
      (ex.pattern === 'HORIZONTAL_PUSH' || ex.pattern === 'VERTICAL_PUSH') &&
      ex.jointStressLevel >= 2;
    const duplicateLowerCompound =
      (primaryEx.pattern === 'KNEE_DOMINANT' || primaryEx.pattern === 'HIP_HINGE') &&
      (ex.pattern === 'KNEE_DOMINANT' || ex.pattern === 'HIP_HINGE') &&
      ex.axialLoadScore >= 2;

    if (duplicatePress) {
      redReasons.push(
        `Stacks heavy compound pressing with primary lift (${primaryEx.name}). High shoulder/tricep shear.`
      );
    }
    if (duplicateLowerCompound) {
      redReasons.push(
        `Stacks heavy compound lower hinge/squat with primary lift (${primaryEx.name}).`
      );
    }
  }

  if (
    (slotRole === 'SUPERSET_A' || slotRole === 'SUPERSET_B') &&
    partnerExerciseId
  ) {
    const partnerEx = exerciseMap.get(partnerExerciseId);
    if (partnerEx) {
      const sharedPrimary = ex.primaryMuscles.filter((m) =>
        partnerEx.primaryMuscles.includes(m)
      );
      const doublePress =
        (ex.pattern === 'HORIZONTAL_PUSH' || ex.pattern === 'VERTICAL_PUSH') &&
        (partnerEx.pattern === 'HORIZONTAL_PUSH' ||
          partnerEx.pattern === 'VERTICAL_PUSH');
      const doublePull =
        (ex.pattern === 'HORIZONTAL_PULL' || ex.pattern === 'VERTICAL_PULL') &&
        (partnerEx.pattern === 'HORIZONTAL_PULL' ||
          partnerEx.pattern === 'VERTICAL_PULL');

      if (sharedPrimary.length > 0 || doublePress) {
        redReasons.push(
          `Competes directly with superset partner (${partnerEx.name}) for ${
            sharedPrimary.map((m) => MUSCLE_LABELS[m]).join(', ') ||
            'pressing movers'
          }.`
        );
      }
      if (doublePull || ex.gripTax + partnerEx.gripTax >= 3) {
        redReasons.push(
          `High grip/forearm clash (${ex.gripTax + partnerEx.gripTax} grip tax) with ${partnerEx.name}.`
        );
      }
    }
  }

  // 2. Check Projected / 48h History Orange Warnings
  const refDate = new Date(session.date);
  const ms48h = 48 * 60 * 60 * 1000;
  const ms7d = 7 * 24 * 60 * 60 * 1000;
  const weeklyCeiling = getWeeklySetCeiling(plan);

  const sets48hByMuscle = Object.fromEntries(
    ALL_MUSCLE_GROUPS.map((m) => [m, 0])
  ) as Record<MuscleGroup, number>;
  const sets7dByMuscle = Object.fromEntries(
    ALL_MUSCLE_GROUPS.map((m) => [m, 0])
  ) as Record<MuscleGroup, number>;

  for (const p of priorSessions) {
    if (p.id === session.id) continue;
    if (p.status !== 'COMPLETED' && p.includeInProjectedLoad === false) continue;
    const diffMs = refDate.getTime() - new Date(p.date).getTime();
    if (diffMs < 0 || diffMs > ms7d) continue;

    const pSets = calculateSessionMuscleSets(p, exerciseMap);
    for (const m of ALL_MUSCLE_GROUPS) {
      sets7dByMuscle[m] += pSets[m] || 0;
      if (diffMs <= ms48h) {
        sets48hByMuscle[m] += pSets[m] || 0;
      }
    }
  }

  const currentSessionSets = calculateSessionMuscleSets(session, exerciseMap);
  for (const m of ex.primaryMuscles) {
    if (sets48hByMuscle[m] > 6) {
      orangeReasons.push(
        `${MUSCLE_LABELS[m]} already has ${Math.round(sets48hByMuscle[m])} sets within 48h prior to this session.`
      );
    }
    const projected7d = sets7dByMuscle[m] + (currentSessionSets[m] || 0);
    if (projected7d > weeklyCeiling) {
      orangeReasons.push(
        `Projected 7-day volume for ${MUSCLE_LABELS[m]} reaches ${Math.round(projected7d)} sets (ceiling: ${weeklyCeiling}).`
      );
    }
  }

  // 3. Check Split Style Alignment (Blue Info)
  if (!isExerciseStyleAlignedWithSplit(ex, session.splitType)) {
    blueReasons.push(
      `${ex.name} targets ${ex.primaryMuscles
        .map((m) => MUSCLE_LABELS[m])
        .join(', ')}, which is outside the typical ${
        SPLIT_SHORT_LABELS[session.splitType]
      } focus.`
    );
  }

  let health: ExerciseSlotEvaluation['health'] = 'OPTIMAL';
  let headline = 'Optimal Fit';
  let reasons: string[] = [];

  if (spotterReasons.length > 0) {
    health = 'NEEDS_SPOTTER';
    headline = 'Needs a Spotter';
    reasons = [...spotterReasons, ...redReasons];
  } else if (redReasons.length > 0) {
    health = 'INTRA_SESSION_OVERWORK';
    headline = 'Intra-Session Conflict';
    reasons = redReasons;
  } else if (orangeReasons.length > 0) {
    health = 'PROJECTED_OVERWORK';
    headline = 'Projected Volume / 48h Fatigue';
    reasons = orangeReasons;
  } else if (blueReasons.length > 0) {
    health = 'WRONG_STYLE';
    headline = 'Off-Split Style (Allowed)';
    reasons = blueReasons;
  }

  let suggestedReplacementId: string | undefined;
  if (health === 'NEEDS_SPOTTER' && ex.soloAlternativeId) {
    suggestedReplacementId = ex.soloAlternativeId;
  } else if (health !== 'OPTIMAL') {
    suggestedReplacementId = findBestReplacementExercise({
      currentExerciseId: exerciseId,
      slotRole,
      partnerExerciseId,
      session,
      priorSessions,
      exercises,
      plan,
    });
  }

  return {
    health,
    headline,
    reasons,
    suggestedReplacementId,
  };
}

/**
 * Finds the best replacement exercise for Quick Switch that resolves Red/Orange/Blue flags.
 */
export function findBestReplacementExercise(params: {
  currentExerciseId: string;
  slotRole: 'PRIMARY' | 'SUPERSET_A' | 'SUPERSET_B' | 'FINISHER';
  partnerExerciseId?: string;
  session: WorkoutSession;
  priorSessions: WorkoutSession[];
  exercises: Exercise[];
  plan: PlanConfig;
}): string | undefined {
  const {
    currentExerciseId,
    slotRole,
    partnerExerciseId,
    session,
    exercises,
    plan,
  } = params;

  const usedIds = new Set<string>([session.primaryLiftId]);
  session.supersets.forEach((ss) => {
    usedIds.add(ss.exerciseAId);
    usedIds.add(ss.exerciseBId);
  });
  session.finishers.forEach((f) => usedIds.add(f.exerciseId));

  const candidates = exercises.filter((cand) => {
    if (cand.id === currentExerciseId) return false;
    if (needsSpotterWithoutBuddy(cand, session)) return false;
    if (slotRole === 'PRIMARY') return Boolean(cand.isPrimaryAnchorCandidate);
    if (slotRole === 'FINISHER') return Boolean(cand.isFinisherCandidate);
    return !cand.isFinisherCandidate;
  });

  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
  const partnerEx = partnerExerciseId
    ? exerciseMap.get(partnerExerciseId)
    : undefined;

  let bestId: string | undefined;
  let bestScore = -999;

  for (const cand of candidates) {
    let score = 0;
    if (!usedIds.has(cand.id)) score += 20;
    if (isExerciseStyleAlignedWithSplit(cand, session.splitType)) score += 35;
    if (cand.axialLoadScore === 0) score += 15;
    if (cand.jointStressLevel === 1) score += 10;

    // Equipment preference boost from Settings
    const eqWeight = plan.equipmentPreferences?.[cand.equipment] ?? 3;
    score += eqWeight * 2;

    if (partnerEx) {
      const sharedPrimary = cand.primaryMuscles.some((m) =>
        partnerEx.primaryMuscles.includes(m)
      );
      if (!sharedPrimary) score += 25;
      else score -= 40;

      if (cand.gripTax + partnerEx.gripTax <= 2) score += 15;
      else score -= 30;
    }

    if (score > bestScore) {
      bestScore = score;
      bestId = cand.id;
    }
  }

  return bestId;
}

export function evaluateSessionSafeguards(
  session: WorkoutSession,
  historicalSessions: WorkoutSession[],
  exercises: Exercise[],
  plan: PlanConfig,
  now: Date = new Date()
): SafeguardAlert[] {
  const alerts: SafeguardAlert[] = [];
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));

  const axialLoad = calculateSessionAxialLoad(session, exerciseMap);
  if (axialLoad > 4) {
    alerts.push({
      id: 'rule_axial_load_ceiling',
      rule: 'AXIAL_LOAD_CEILING',
      severity: 'CRITICAL',
      title: `Axial Load Ceiling Exceeded (${axialLoad} / 4 max)`,
      message:
        'High axial loading detected following primary lift. Recommend substituting secondary hinges (e.g., Barbell RDL) with supported knee flexion (e.g., Seated Machine Hamstring Curl) or supported pulls.',
      recommendation:
        'Use Quick Switch on heavy axial accessories to swap in Seated Hamstring Curl or Neutral-Grip Lat Pulldown.',
    });
  }

  const primaryEx = exerciseMap.get(session.primaryLiftId);

  const spotterIds = new Set<string>();
  [
    session.primaryLiftId,
    ...session.supersets.flatMap((ss) => [ss.exerciseAId, ss.exerciseBId]),
    ...session.finishers.map((f) => f.exerciseId),
  ].forEach((id) => {
    if (needsSpotterWithoutBuddy(exerciseMap.get(id), session)) spotterIds.add(id);
  });
  for (const id of spotterIds) {
    const ex = exerciseMap.get(id)!;
    const alt = ex.soloAlternativeId ? exerciseMap.get(ex.soloAlternativeId) : undefined;
    alerts.push({
      id: `rule_spotter_${id}`,
      rule: 'SPOTTER_REQUIRED',
      severity: 'CRITICAL',
      title: `No spotter for ${ex.name}`,
      message: `${ex.name} should only be pushed hard with a spotter, and this session is marked as solo.`,
      recommendation: alt
        ? `Swap to ${alt.name}, or tick "Buddy" on the session if someone is spotting you.`
        : 'Tick "Buddy" on the session if someone is spotting you, or choose a self-spotting alternative.',
    });
  }

  for (let i = 0; i < session.supersets.length; i++) {
    const ss = session.supersets[i];
    const exA = exerciseMap.get(ss.exerciseAId);
    const exB = exerciseMap.get(ss.exerciseBId);
    if (!exA || !exB) continue;

    const label = ss.customName || `Superset #${i + 1}`;
    const sharedPrimary = exA.primaryMuscles.filter((m) =>
      exB.primaryMuscles.includes(m)
    );
    const isDoublePress =
      (exA.pattern === 'HORIZONTAL_PUSH' || exA.pattern === 'VERTICAL_PUSH') &&
      (exB.pattern === 'HORIZONTAL_PUSH' || exB.pattern === 'VERTICAL_PUSH');
    const isDoublePull =
      (exA.pattern === 'HORIZONTAL_PULL' || exA.pattern === 'VERTICAL_PULL') &&
      (exB.pattern === 'HORIZONTAL_PULL' || exB.pattern === 'VERTICAL_PULL');
    const isHeavyLowerClash =
      (exA.pattern === 'KNEE_DOMINANT' && exB.pattern === 'HIP_HINGE') ||
      (exA.pattern === 'HIP_HINGE' && exB.pattern === 'KNEE_DOMINANT');

    if (isDoublePress || isHeavyLowerClash || sharedPrimary.length > 0) {
      alerts.push({
        id: `rule_competing_ss_${ss.id}`,
        rule: 'COMPETING_SUPERSET',
        severity: ss.executionMode === 'PAIRED' ? 'CRITICAL' : 'WARNING',
        title: `Competing Pairing in ${label}: ${exA.name} + ${exB.name}`,
        message: `${exA.name} and ${exB.name} compete for the same primary movers or compound recovery capacity.`,
        affectedMuscles: sharedPrimary,
        recommendation:
          'Click Quick Switch on either exercise to pair an antagonist movement instead.',
      });
    }

    if (isDoublePull || exA.gripTax + exB.gripTax >= 3) {
      alerts.push({
        id: `rule_grip_clash_${ss.id}`,
        rule: 'COMPETING_SUPERSET',
        severity: 'WARNING',
        title: `Excessive Grip / Forearm Tax in ${label}`,
        message: `${exA.name} (grip ${exA.gripTax}) + ${exB.name} (grip ${exB.gripTax}) will cause forearm/bicep failure before target back muscles reach failure.`,
        recommendation:
          'Pair vertical/horizontal pulls with a zero-grip movement like Low-to-High Cable Flyes or Captain’s Chair Knee Raises.',
      });
    }

    if (primaryEx) {
      for (const subEx of [exA, exB]) {
        const sameCompoundPressPattern =
          primaryEx.pattern === 'HORIZONTAL_PUSH' &&
          (subEx.pattern === 'HORIZONTAL_PUSH' ||
            subEx.pattern === 'VERTICAL_PUSH') &&
          subEx.jointStressLevel >= 2;
        const sameCompoundLowerPattern =
          (primaryEx.pattern === 'KNEE_DOMINANT' ||
            primaryEx.pattern === 'HIP_HINGE') &&
          (subEx.pattern === 'KNEE_DOMINANT' ||
            subEx.pattern === 'HIP_HINGE') &&
          subEx.axialLoadScore >= 2;

        if (sameCompoundPressPattern || sameCompoundLowerPattern) {
          alerts.push({
            id: `rule_intra_overlap_${ss.id}_${subEx.id}`,
            rule: 'INTRA_SESSION_OVERLAP',
            severity: 'CRITICAL',
            title: `Redundant Compound Stress: ${primaryEx.name} + ${subEx.name}`,
            message: `Combining primary anchor ${primaryEx.name} with compound ${subEx.name} in ${label} stacks heavy joint/tricep/spinal fatigue in a single session.`,
            affectedMuscles: subEx.primaryMuscles,
            recommendation:
              'Use Quick Switch to replace with an isolation movement (e.g., Low-to-High Cable Fly or Seated Hamstring Curl).',
          });
        }
      }
    }
  }

  const summaries = computeMuscleVolumeSummaries(
    [session],
    historicalSessions,
    exercises,
    plan,
    now
  );

  for (const s of summaries) {
    if (s.recovery48hFlag && s.plannedFutureSets >= 2) {
      alerts.push({
        id: `rule_48h_${s.muscle}`,
        rule: 'ROLLING_48H_RECOVERY',
        severity: 'WARNING',
        title: `48h Recovery Flag: ${MUSCLE_LABELS[s.muscle]} (${s.sets48h} sets in last 48h)`,
        message: `${MUSCLE_LABELS[s.muscle]} accumulated >6 working sets within the past 48 hours and this session adds ${s.plannedFutureSets} more sets.`,
        affectedMuscles: [s.muscle],
      });
    }
  }

  return alerts;
}

export function rankSupersetsForSession(
  session: WorkoutSession,
  curatedSupersets: SupersetPair[],
  historicalSessions: WorkoutSession[],
  exercises: Exercise[],
  plan: PlanConfig
): Array<{
  superset: SupersetPair;
  score: number;
  tags: string[];
}> {
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
  const summaries = computeMuscleVolumeSummaries(
    [session],
    historicalSessions,
    exercises,
    plan
  );
  const summaryMap = new Map(summaries.map((s) => [s.muscle, s]));
  const alreadySelectedIds = new Set(
    session.supersets.map((s) => s.supersetPairId).filter(Boolean)
  );

  return curatedSupersets
    .map((ss) => {
      let score = 50;
      const tags: string[] = [];

      if (alreadySelectedIds.has(ss.id)) {
        score -= 40;
        tags.push('Already in session');
      }

      if (ss.recommendedSplits.includes(session.splitType)) {
        score += 25;
        tags.push('Ideal for Split');
      }

      if (session.withBuddy && ss.buddyFriendly) {
        score += 15;
        tags.push('Buddy Station Swap');
      }

      const exA = exerciseMap.get(ss.exerciseAId);
      const exB = exerciseMap.get(ss.exerciseBId);
      const targetMuscles = [
        ...(exA?.primaryMuscles || []),
        ...(exB?.primaryMuscles || []),
      ];

      for (const m of targetMuscles) {
        const vol = summaryMap.get(m);
        if (!vol) continue;
        if (vol.statusProjected === 'UNDER') {
          score += 12;
          if (!tags.includes(`Boosts ${MUSCLE_LABELS[m]}`)) {
            tags.push(`Boosts ${MUSCLE_LABELS[m]}`);
          }
        } else if (
          vol.statusProjected === 'OVERTRAINING_RISK' ||
          vol.recovery48hFlag
        ) {
          score -= 20;
          tags.push(`High ${MUSCLE_LABELS[m]} Fatigue`);
        }
      }

      return { superset: ss, score, tags };
    })
    .sort((a, b) => b.score - a.score);
}
