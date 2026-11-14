import { Exercise, LoggedSet, WorkoutSession } from '../models/types';
import { SPLIT_SHORT_LABELS } from './splits';

/** Compact, shareable summary of a workout: one line per exercise actually done. */
export interface SessionSummaryRow {
  /** "Main lift", "Superset 1", "Finisher" */
  label: string;
  name: string;
  /** Heaviest completed set; 0 means bodyweight. */
  topKg: number;
  /** Reps on that heaviest set (undefined for finishers). */
  topReps?: number;
  /** Completed sets, or completed rounds for finishers. */
  sets: number;
  unit: 'sets' | 'rounds';
}

export interface SessionSummary {
  /** ISO date-time the session was started (falls back to its recorded date). */
  startedAt: string;
  title: string;
  withBuddy: boolean;
  rows: SessionSummaryRow[];
  totalSets: number;
  /** Sum of weight x reps over completed sets, in kg. */
  totalVolumeKg: number;
}

function rowFromSets(
  label: string,
  ex: Exercise | undefined,
  sets: LoggedSet[]
): SessionSummaryRow | undefined {
  const done = sets.filter((s) => s.completed);
  if (!done.length) return undefined;
  const top = done.reduce((a, b) => (b.weightKg > a.weightKg ? b : a));
  return {
    label,
    name: ex?.shortName ?? ex?.name ?? 'Exercise',
    topKg: top.weightKg,
    topReps: top.reps,
    sets: done.length,
    unit: 'sets',
  };
}

export function buildSessionSummary(
  session: WorkoutSession,
  exerciseMap: Map<string, Exercise>
): SessionSummary {
  const rows: SessionSummaryRow[] = [];
  const push = (r: SessionSummaryRow | undefined) => r && rows.push(r);

  push(rowFromSets('Main lift', exerciseMap.get(session.primaryLiftId), session.primaryLiftSets));
  session.supersets.forEach((b, i) => {
    const label = `Superset ${i + 1}`;
    push(rowFromSets(label, exerciseMap.get(b.exerciseAId), b.setsA));
    push(rowFromSets(label, exerciseMap.get(b.exerciseBId), b.setsB));
  });
  for (const f of session.finishers) {
    if (f.completedRounds <= 0) continue;
    const ex = exerciseMap.get(f.exerciseId);
    rows.push({
      label: 'Finisher',
      name: ex?.shortName ?? ex?.name ?? 'Finisher',
      topKg: f.loadKg ?? 0,
      sets: f.completedRounds,
      unit: 'rounds',
    });
  }

  const allDone = [
    ...session.primaryLiftSets,
    ...session.supersets.flatMap((b) => [...b.setsA, ...b.setsB]),
  ].filter((s) => s.completed);

  return {
    startedAt: session.startedAt ?? session.date,
    title: SPLIT_SHORT_LABELS[session.splitType] ?? 'Workout',
    withBuddy: Boolean(session.withBuddy),
    rows,
    totalSets: allDone.length,
    totalVolumeKg: Math.round(allDone.reduce((sum, s) => sum + s.weightKg * s.reps, 0)),
  };
}
