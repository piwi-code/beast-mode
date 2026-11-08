import { Exercise, LoggedSet, WorkoutSession } from '../models/types';

export interface MainLiftRecord {
  sessionId: string;
  date: string;
  exerciseId: string;
  exerciseName: string;
  topWeightKg: number;
  topReps: number;
  estimated1RM: number;
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

    let bestSet = validSets[0];
    let best1RM = estimateOneRepMax(bestSet.weightKg, bestSet.reps);
    let totalVolumeKg = 0;

    for (const s of validSets) {
      totalVolumeKg += s.weightKg * s.reps;
      const e1rm = estimateOneRepMax(s.weightKg, s.reps);
      if (e1rm > best1RM) {
        best1RM = e1rm;
        bestSet = s;
      }
    }

    records.push({
      sessionId: session.id,
      date: session.date,
      exerciseId: session.primaryLiftId,
      exerciseName: exMap.get(session.primaryLiftId)?.name ?? session.primaryLiftId,
      topWeightKg: bestSet.weightKg,
      topReps: bestSet.reps,
      estimated1RM: best1RM,
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
