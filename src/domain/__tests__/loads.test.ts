import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAN_CONFIG, SEED_EXERCISES, SEED_SUPERSETS } from '../seed/catalog';
import {
  buildDraftSessionFromSuggestion,
  changeFinisherExercise,
  suggestNextSession,
} from '../engine/sequencer';
import {
  applySuggestedLoads,
  getDropSetWeights,
  suggestLoad,
} from '../engine/loads';
import { WorkoutSession } from '../models/types';

const exMap = new Map(SEED_EXERCISES.map((e) => [e.id, e]));
const draft = (split: 'UPPER' | 'LOWER', id: string, date: string): WorkoutSession => ({
  ...buildDraftSessionFromSuggestion(
    suggestNextSession(DEFAULT_PLAN_CONFIG, [], new Date(date), true, { split }),
    SEED_EXERCISES,
    SEED_SUPERSETS,
    new Date(date).toISOString()
  ),
  id,
});

// A completed Upper session where Machine Row was done at 62.5 kg x 9
const past: WorkoutSession = (() => {
  const s = draft('UPPER', 'past', '2026-11-01T09:00:00');
  const b = s.supersets.find((x) => x.exerciseAId === 'machine_row_narrow')!;
  b.setsA = b.setsA.map((x) => ({ ...x, weightKg: 62.5, reps: 9, completed: true }));
  s.primaryLiftSets = s.primaryLiftSets.map((x) => ({ ...x, weightKg: 90, reps: 5, completed: true }));
  s.finishers = [{ ...s.finishers[0], loadKg: 27.5, completedRounds: 3 }];
  return { ...s, status: 'COMPLETED' };
})();

describe('weight suggestions', () => {
  it('uses the last recorded weight for an exercise, else an estimate', () => {
    const fromHistory = suggestLoad('machine_row_narrow', 3, [past], exMap);
    expect(fromHistory.source).toBe('history');
    expect(fromHistory.sets[0]).toEqual({ weightKg: 62.5, reps: 9 });

    const estimate = suggestLoad('leg_press_machine', 4, [past], exMap);
    expect(estimate.source).toBe('estimate');
    expect(estimate.sets[0].weightKg).toBe(100);
  });

  it('a new session picks up last recorded weights (primary, supersets, finisher)', () => {
    const fresh = applySuggestedLoads(undefined, draft('UPPER', 'new', '2026-11-14T09:00:00'), [past], exMap);
    expect(fresh.primaryLiftSets[0]).toMatchObject({ weightKg: 90, reps: 5, completed: false });
    const row = fresh.supersets.find((x) => x.exerciseAId === 'machine_row_narrow')!;
    expect(row.setsA.every((x) => x.weightKg === 62.5 && !x.completed)).toBe(true);
    expect(fresh.finishers[0].loadKg).toBe(27.5);
  });

  it('only touches slots whose exercise changed, and never completed sets', () => {
    const before = applySuggestedLoads(undefined, draft('UPPER', 'new', '2026-11-14T09:00:00'), [past], exMap);
    // user edits a weight by hand, then swaps a different slot's exercise
    const edited: WorkoutSession = {
      ...before,
      primaryLiftSets: before.primaryLiftSets.map((s, i) => (i === 0 ? { ...s, weightKg: 77.5 } : s)),
      supersets: before.supersets.map((b, i) =>
        i === 1
          ? {
              ...b,
              exerciseAId: 'machine_row_narrow',
              setsA: b.setsA.map((s, j) => (j === 0 ? { ...s, weightKg: 1, completed: true } : s)),
            }
          : b
      ),
    };
    const after = applySuggestedLoads(before, edited, [past], exMap);
    expect(after.primaryLiftSets[0].weightKg).toBe(77.5); // manual edit kept
    expect(after.supersets[0]).toEqual(edited.supersets[0]); // untouched slot
    expect(after.supersets[1].setsA[0].weightKg).toBe(1); // completed set kept
    expect(after.supersets[1].setsA[1].weightKg).toBe(62.5); // swapped slot re-loaded
  });

  it('swapping a finisher uses its last finisher load when there is one', () => {
    const s = draft('LOWER', 'new', '2026-11-14T09:00:00');
    const swapped: WorkoutSession = {
      ...s,
      finishers: [changeFinisherExercise(s.finishers[0], exMap.get('rope_face_pull'), 'rope_face_pull')],
    };
    expect(applySuggestedLoads(s, swapped, [past], exMap).finishers[0].loadKg).toBe(27.5);
  });
});

describe('drop set suggestions', () => {
  it('steps down in the available jumps (5 kg fixed barbells)', () => {
    expect(getDropSetWeights(30, 5)).toEqual([30, 25, 20]);
    expect(getDropSetWeights(40, 5)).toEqual([40, 30, 20]);
    expect(getDropSetWeights(25, 5)).toEqual([25, 20, 15]);
    expect(getDropSetWeights(10, 5)).toEqual([10, 5]);
    expect(getDropSetWeights(25, 2.5)).toEqual([25, 20, 15]);
  });
});
