import { Exercise, LoggedSet, WorkoutSession } from '../models/types';

export interface MainLiftRecord {
  sessionId: string;
  date: string;
  exerciseId: string;
  exerciseName: string;
  /** Top set as logged (per dumbbell for two-dumbbell lifts). */
  topWeightKg: number;
  topReps: number;
  /** 2 for two-dumbbell lifts, so topWeightKg can be shown as "2 × 28 kg". */
  dumbbells: number;
  /** e1RM of this lift itself, from the total load moved. */
  estimated1RM: number;
  /**
   * e1RM converted to the category's barbell lift (estimated1RM divided by
   * the exercise's barbellEquivalence), so variations share one chart.
   */
  barbellEquivalent1RM: number;
  /** True when barbellEquivalent1RM was converted from a variation. */
  isConverted: boolean;
  totalVolumeKg: number;
}

/**
 * Epley 1RM formula: weight * (1 + reps / 30)
 */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export function extractMainLiftHistory(
  sessions: WorkoutSession[],
  exerciseId?: string,
  exercises?: Exercise[]
): MainLiftRecord[] {
  const records: MainLiftRecord[] = [];
  const exMap = new Map(exercises?.map((e) => [e.id, e]) ?? []);

  for (const session of sessions) {
    if (session.status !== 'COMPLETED') continue;
    if (exerciseId && session.primaryLiftId !== exerciseId) continue;

    const validSets = session.primaryLiftSets.filter(
      (s: LoggedSet) => s.weightKg > 0 && s.reps > 0
    );
    if (validSets.length === 0) continue;

    const ex = exMap.get(session.primaryLiftId);
    const dumbbells = ex?.dumbbellsUsed ?? 1;
    const equivalence = ex?.barbellEquivalence ?? 1;

    // Best set by e1RM, always from the total load (both dumbbells)
    let bestSet = validSets[0];
    let best1RM = 0;
    let totalVolumeKg = 0;
    for (const s of validSets) {
      totalVolumeKg += s.weightKg * dumbbells * s.reps;
      const e1rm = estimateOneRepMax(s.weightKg * dumbbells, s.reps);
      if (e1rm > best1RM) {
        best1RM = e1rm;
        bestSet = s;
      }
    }

    records.push({
      sessionId: session.id,
      date: session.date,
      exerciseId: session.primaryLiftId,
      exerciseName: ex?.name ?? session.primaryLiftId,
      topWeightKg: bestSet.weightKg,
      topReps: bestSet.reps,
      dumbbells,
      estimated1RM: best1RM,
      barbellEquivalent1RM: Math.round((best1RM / equivalence) * 10) / 10,
      isConverted: equivalence !== 1,
      totalVolumeKg,
    });
  }

  return records.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

export function extractCategoryLiftHistory(
  sessions: WorkoutSession[],
  category: 'BENCH' | 'SQUAT' | 'DEADLIFT',
  exercises: Exercise[]
): MainLiftRecord[] {
  const matchingIds = new Set(
    exercises.filter((e) => e.mainLiftCategory === category).map((e) => e.id)
  );
  const all = extractMainLiftHistory(sessions, undefined, exercises);
  return all.filter((r) => matchingIds.has(r.exerciseId));
}
