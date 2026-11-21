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

describe('paired dumbbell weights', () => {
  it('logs per dumbbell and doubles the total for two-dumbbell exercises', async () => {
    const { formatLoad, getTotalLoadKg } = await import('../engine/loadFormat');
    const dbBench = exMap.get('db_flat_bench')!;
    const goblet = exMap.get('db_goblet_squat')!;
    expect(dbBench.dumbbellsUsed).toBe(2);
    expect(goblet.dumbbellsUsed).toBeUndefined();
    expect(formatLoad(dbBench, 30)).toBe('2 × 30 kg');
    expect(formatLoad(goblet, 30)).toBe('30 kg');
    expect(formatLoad(exMap.get('parallel_bar_dip'), 0)).toBe('Bodyweight');
    expect(getTotalLoadKg(dbBench, 30)).toBe(60);

    const base = buildDraftSessionFromSuggestion(
      suggestNextSession(DEFAULT_PLAN_CONFIG, [], new Date('2026-11-14T09:00:00'), false, { split: 'UPPER' }),
      SEED_EXERCISES,
      SEED_SUPERSETS
    );
    const s: WorkoutSession = {
      ...base,
      primaryLiftId: 'db_flat_bench',
      primaryLiftSets: [{ setNumber: 1, weightKg: 30, reps: 10, completed: true }],
      supersets: [],
      finishers: [],
    };
    const summary = buildSessionSummary(s, exMap);
    expect(summary.rows[0]).toMatchObject({ topKg: 30, multiplier: 2 });
    expect(summary.totalVolumeKg).toBe(30 * 2 * 10);
  });
});

describe('main lift 1RM history', () => {
  it('uses both dumbbells and converts variations to barbell terms', async () => {
    const { extractCategoryLiftHistory } = await import('../engine/oneRepMax');
    const done = (id: string, primaryLiftId: string, weightKg: number, reps: number, date: string): WorkoutSession => ({
      id,
      date,
      status: 'COMPLETED',
      splitType: 'UPPER',
      primaryLiftId,
      primaryLiftSets: [{ setNumber: 1, weightKg, reps, completed: true }],
      supersets: [],
      finishers: [],
      totalAxialLoad: 0,
    });
    const recs = extractCategoryLiftHistory(
      [
        done('a', 'bb_flat_bench', 80, 6, '2026-11-01T09:00:00Z'),
        done('b', 'db_flat_bench', 28, 8, '2026-11-05T09:00:00Z'),
      ],
      'BENCH',
      SEED_EXERCISES
    );
    const [bb, db] = recs;
    expect(bb).toMatchObject({ estimated1RM: 96, barbellEquivalent1RM: 96, isConverted: false, dumbbells: 1 });
    // 2 x 28 = 56 kg x 8 -> e1RM 70.9; / 0.8 -> 88.6 barbell-equivalent
    expect(db).toMatchObject({ topWeightKg: 28, dumbbells: 2, estimated1RM: 70.9, isConverted: true });
    expect(db.barbellEquivalent1RM).toBe(88.6);
  });
});
