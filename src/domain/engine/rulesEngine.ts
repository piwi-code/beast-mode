import {
  Exercise,
  MuscleGroup,
  MuscleVolumeSummary,
  PlanConfig,
  SafeguardAlert,
  SupersetPair,
  WorkoutSession,
} from '../models/types';

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

/**
 * Calculates total axial load score for a session.
 * Each unique exercise in the session contributes its axialLoadScore.
 */
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

/**
 * Computes how many working sets each muscle group receives from a single session.
 * Primary muscles count as 1.0 set per set; secondary muscles count as 0.5 set per set.
 */
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
    addExerciseSets(ss.exerciseAId, ss.setsA.length || ss.targetSets || 3);
    addExerciseSets(ss.exerciseBId, ss.setsB.length || ss.targetSets || 3);
  }

  for (const fin of session.finishers) {
    addExerciseSets(fin.exerciseId, fin.rounds || 3);
  }

  return tally;
}

/**
 * Computes rolling 48h, 7-day, and 14-day muscle volume plus current draft session sets.
 */
export function computeMuscleVolumeSummaries(
  draftSession: WorkoutSession | null,
  historicalSessions: WorkoutSession[],
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
  const totals7d = Object.fromEntries(ALL_MUSCLE_GROUPS.map((m) => [m, 0])) as Record<
    MuscleGroup,
    number
  >;
  const totals14d = Object.fromEntries(ALL_MUSCLE_GROUPS.map((m) => [m, 0])) as Record<
    MuscleGroup,
    number
  >;

  for (const session of historicalSessions) {
    if (draftSession && session.id === draftSession.id) continue;
    const ageMs = now.getTime() - new Date(session.date).getTime();
    if (ageMs < 0 || ageMs > ms14d) continue;

    const sessionSets = calculateSessionMuscleSets(session, exerciseMap);
    for (const m of ALL_MUSCLE_GROUPS) {
      const val = sessionSets[m] || 0;
      totals14d[m] += val;
      if (ageMs <= ms7d) totals7d[m] += val;
      if (ageMs <= ms48h) totals48h[m] += val;
    }
  }

  const plannedSets = draftSession
    ? calculateSessionMuscleSets(draftSession, exerciseMap)
    : (Object.fromEntries(ALL_MUSCLE_GROUPS.map((m) => [m, 0])) as Record<
        MuscleGroup,
        number
      >);

  // Scale weekly optimal ceiling slightly by sessionsPerWeek (2, 3, or 4)
  const weeklyCeiling = plan.sessionsPerWeek === 2 ? 10 : plan.sessionsPerWeek === 3 ? 13 : 15;
  const weeklyFloor = plan.sessionsPerWeek === 2 ? 3 : 4;

  return ALL_MUSCLE_GROUPS.map((muscle) => {
    const sets48h = Math.round(totals48h[muscle] * 10) / 10;
    const sets7d = Math.round((totals7d[muscle] + plannedSets[muscle]) * 10) / 10;
    const sets14d = Math.round((totals14d[muscle] + plannedSets[muscle]) * 10) / 10;
    const plannedSessionSets = Math.round(plannedSets[muscle] * 10) / 10;

    let status7d: MuscleVolumeSummary['status7d'] = 'OPTIMAL';
    if (sets7d > weeklyCeiling) {
      status7d = 'OVERTRAINING_RISK';
    } else if (sets7d > weeklyCeiling - 3) {
      status7d = 'HIGH';
    } else if (sets7d < weeklyFloor) {
      status7d = 'UNDER';
    }

    return {
      muscle,
      sets48h,
      sets7d,
      sets14d,
      plannedSessionSets,
      status7d,
      recovery48hFlag: sets48h > 6,
    };
  });
}

/**
 * Evaluates all 4 rules engine safeguards on a draft session:
 * - Rule 1: Axial Load Ceiling (> 4)
 * - Rule 2A: Non-Competing / Antagonist Superset Mandate (within a superset pair)
 * - Rule 2B: Intra-Session Primary + Superset Overlap (e.g. Bench Press + Incline DB Press)
 * - Rule 3: Rolling 48-Hour Recovery Lookback (> 6 sets in past 48h)
 * - Rule 4: Rolling Weekly / Fortnightly Muscle Volume Over-Concentration
 */
export function evaluateSessionSafeguards(
  session: WorkoutSession,
  historicalSessions: WorkoutSession[],
  exercises: Exercise[],
  plan: PlanConfig,
  now: Date = new Date()
): SafeguardAlert[] {
  const alerts: SafeguardAlert[] = [];
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));

  // === RULE 1: AXIAL LOAD CEILING (> 4) ===
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
        'Swap Barbell RDL or heavy axial accessories for Seated Machine Hamstring Curl, Chest-Supported Row, or Neutral-Grip Lat Pulldown.',
    });
  }

  const primaryEx = exerciseMap.get(session.primaryLiftId);

  // === RULE 2A & 2B: SUPERSET PAIRING & INTRA-SESSION PRIMARY OVERLAP ===
  for (let i = 0; i < session.supersets.length; i++) {
    const ss = session.supersets[i];
    const exA = exerciseMap.get(ss.exerciseAId);
    const exB = exerciseMap.get(ss.exerciseBId);
    if (!exA || !exB) continue;

    const label = ss.customName || `Superset #${i + 1}`;

    // Check competing primary muscles inside the superset when in PAIRED mode
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
          'Pair an antagonist or peripheral movement instead (e.g., Horizontal Pull + Cable Flye, or Leg Curl + Calf Raise).',
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

    // Intra-session overlap with Primary Anchor Lift (e.g., Bench Press + Incline DB Press)
    if (primaryEx) {
      for (const subEx of [exA, exB]) {
        const sameCompoundPressPattern =
          primaryEx.pattern === 'HORIZONTAL_PUSH' &&
          (subEx.pattern === 'HORIZONTAL_PUSH' || subEx.pattern === 'VERTICAL_PUSH') &&
          subEx.jointStressLevel >= 2;
        const sameCompoundLowerPattern =
          (primaryEx.pattern === 'KNEE_DOMINANT' || primaryEx.pattern === 'HIP_HINGE') &&
          (subEx.pattern === 'KNEE_DOMINANT' || subEx.pattern === 'HIP_HINGE') &&
          subEx.axialLoadScore >= 2;

        if (sameCompoundPressPattern || sameCompoundLowerPattern) {
          alerts.push({
            id: `rule_intra_overlap_${ss.id}_${subEx.id}`,
            rule: 'INTRA_SESSION_OVERLAP',
            severity: 'WARNING',
            title: `Redundant Compound Stress: ${primaryEx.name} + ${subEx.name}`,
            message: `Combining primary anchor ${primaryEx.name} with compound ${subEx.name} in ${label} stacks heavy joint/tricep/spinal fatigue in a single session.`,
            affectedMuscles: subEx.primaryMuscles,
            recommendation: sameCompoundPressPattern
              ? 'Use Low-to-High Cable Flyes or Single-Arm Cable Lateral Raises to stimulate upper chest/delts without compounding pressing joint shear.'
              : 'Use Seated Machine Hamstring Curls or Dumbbell Walking Lunges to reduce spinal overlap.',
          });
        }
      }
    }
  }

  // === RULE 3 & 4: ROLLING 48H RECOVERY & 7D/14D VOLUME CHECK ===
  const summaries = computeMuscleVolumeSummaries(
    session,
    historicalSessions,
    exercises,
    plan,
    now
  );

  for (const s of summaries) {
    if (s.recovery48hFlag && s.plannedSessionSets >= 2) {
      alerts.push({
        id: `rule_48h_${s.muscle}`,
        rule: 'ROLLING_48H_RECOVERY',
        severity: 'WARNING',
        title: `48h Recovery Flag: ${MUSCLE_LABELS[s.muscle]} (${s.sets48h} sets in last 48h)`,
        message: `${MUSCLE_LABELS[s.muscle]} accumulated >6 working sets within the past 48 hours and this session adds ${s.plannedSessionSets} more sets.`,
        affectedMuscles: [s.muscle],
        recommendation:
          'Restrict heavy compound pressing/pulling on this muscle group; shift to lengthened-state isolation (Low-to-High Cable Flyes, Long-Rope Face Pulls, or Cable Lateral Raises).',
      });
    }

    if (s.status7d === 'OVERTRAINING_RISK' && s.plannedSessionSets > 0) {
      alerts.push({
        id: `rule_7d_over_${s.muscle}`,
        rule: 'WEEKLY_VOLUME_IMBALANCE',
        severity: 'WARNING',
        title: `High Weekly Concentration: ${MUSCLE_LABELS[s.muscle]} (${s.sets7d} sets / 7d)`,
        message: `Projected 7-day volume for ${MUSCLE_LABELS[s.muscle]} is ${s.sets7d} sets (14-day: ${s.sets14d} sets), exceeding your optimal weekly ceiling.`,
        affectedMuscles: [s.muscle],
        recommendation:
          'Swap one superset targeting this region for an under-stimulated muscle group to keep weekly and fortnightly volume balanced.',
      });
    }
  }

  return alerts;
}

/**
 * Ranks curated supersets for a session by compatibility, split fit, and 7-day volume balance.
 */
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
    session,
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

      if (
        (session.splitType === 'BUDDY_UPPER' || session.splitType === 'BUDDY_LOWER') &&
        ss.buddyFriendly
      ) {
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
        if (vol.status7d === 'UNDER') {
          score += 12;
          if (!tags.includes(`Boosts ${MUSCLE_LABELS[m]}`)) {
            tags.push(`Boosts ${MUSCLE_LABELS[m]}`);
          }
        } else if (vol.status7d === 'OVERTRAINING_RISK' || vol.recovery48hFlag) {
          score -= 20;
          tags.push(`High ${MUSCLE_LABELS[m]} Fatigue`);
        }
      }

      return { superset: ss, score, tags };
    })
    .sort((a, b) => b.score - a.score);
}
