import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAN_CONFIG, SEED_EXERCISES, SEED_SUPERSETS } from '../seed/catalog';
import { buildDraftSessionFromSuggestion, suggestNextSession } from '../engine/sequencer';
import { buildSessionSummary } from '../engine/sessionSummary';
import { WorkoutSession } from '../models/types';

const exMap = new Map(SEED_EXERCISES.map((e) => [e.id, e]));

describe('session share summary', () => {
  const base = buildDraftSessionFromSuggestion(
    suggestNextSession(DEFAULT_PLAN_CONFIG, [], new Date('2026-11-14T09:00:00'), true, { split: 'UPPER' }),
    SEED_EXERCISES,
    SEED_SUPERSETS,
    '2026-11-14T10:30:00.000Z'
  );
  const session: WorkoutSession = {
    ...base,
    status: 'COMPLETED',
    startedAt: '2026-11-14T09:15:00.000Z',
    primaryLiftSets: [
      { setNumber: 1, weightKg: 80, reps: 8, completed: true },
      { setNumber: 2, weightKg: 85, reps: 6, completed: true },
      { setNumber: 3, weightKg: 90, reps: 4, completed: false },
    ],
    supersets: [
      {
        ...base.supersets[0],
        setsA: base.supersets[0].setsA.map((s) => ({ ...s, weightKg: 60, reps: 10, completed: true })),
        setsB: base.supersets[0].setsB.map((s) => ({ ...s, completed: false })),
      },
    ],
    finishers: [{ ...base.finishers[0], loadKg: 20, completedRounds: 2 }],
  };
  const summary = buildSessionSummary(session, exMap);

  it('uses the start time and the split as title', () => {
    expect(summary.startedAt).toBe('2026-11-14T09:15:00.000Z');
    expect(summary.title).toBe('Upper');
    expect(summary.withBuddy).toBe(true);
  });

  it('lists only exercises with completed sets, showing top weight and set count', () => {
    expect(summary.rows.map((r) => r.name)).toEqual(['Bench Press', 'Machine Row', 'Face Pull']);
    expect(summary.rows[0]).toMatchObject({ label: 'Main lift', topKg: 85, topReps: 6, sets: 2, unit: 'sets' });
    expect(summary.rows[1]).toMatchObject({ label: 'Superset 1', topKg: 60, sets: 3 });
    expect(summary.rows[2]).toMatchObject({ label: 'Finisher', topKg: 20, sets: 2, unit: 'rounds' });
  });

  it('totals completed sets and volume', () => {
    expect(summary.totalSets).toBe(5);
    expect(summary.totalVolumeKg).toBe(80 * 8 + 85 * 6 + 3 * 60 * 10);
  });

  it('falls back to the session date when there is no start time', () => {
    expect(buildSessionSummary({ ...session, startedAt: undefined }, exMap).startedAt).toBe(session.date);
  });
});
