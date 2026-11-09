import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAN_CONFIG,
  SEED_EXERCISES,
  SEED_SUPERSETS,
} from '../seed/catalog';
import {
  buildDraftSessionFromSuggestion,
  rebuildSessionForSplit,
  suggestNextSession,
} from '../engine/sequencer';
import { isExerciseStyleAlignedWithSplit } from '../engine/rulesEngine';
import { PlanConfig, WorkoutSession } from '../models/types';

const exMap = new Map(SEED_EXERCISES.map((e) => [e.id, e]));
const buddyPlan: PlanConfig = {
  ...DEFAULT_PLAN_CONFIG,
  buddyDays: [0, 1, 2, 3, 4, 5, 6],
};
const DATE = new Date('2026-11-10T09:00:00');

function lowerSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  const s = suggestNextSession(buddyPlan, [], DATE, true, { split: 'LOWER' });
  return {
    ...buildDraftSessionFromSuggestion(s, SEED_EXERCISES, SEED_SUPERSETS, DATE.toISOString()),
    id: 'sess-1',
    notes: 'keep me',
    ...overrides,
  };
}

const allIds = (s: WorkoutSession) => [
  s.primaryLiftId,
  ...s.supersets.flatMap((b) => [b.exerciseAId, b.exerciseBId]),
  ...s.finishers.map((f) => f.exerciseId),
];

describe('switching a session to a different split', () => {
  it('re-picks primary, supersets and finishers for the new focus', () => {
    const lower = lowerSession();
    const upper = rebuildSessionForSplit(lower, 'UPPER', buddyPlan, [], SEED_EXERCISES, SEED_SUPERSETS);

    expect(upper.splitType).toBe('UPPER');
    expect(upper.primaryLiftId).toBe('bb_flat_bench');
    // Supersets/finishers actually changed (previously they were left as the Lower ones)
    expect(upper.supersets.map((b) => b.supersetPairId)).not.toEqual(
      lower.supersets.map((b) => b.supersetPairId)
    );
    expect(upper.finishers.map((f) => f.exerciseId)).not.toEqual(
      lower.finishers.map((f) => f.exerciseId)
    );
    // Every superset exercise suits an Upper day
    for (const b of upper.supersets) {
      expect(isExerciseStyleAlignedWithSplit(exMap.get(b.exerciseAId)!, 'UPPER')).toBe(true);
      expect(isExerciseStyleAlignedWithSplit(exMap.get(b.exerciseBId)!, 'UPPER')).toBe(true);
    }
  });

  it('keeps id, date, notes, buddy flag, status and superset/finisher counts', () => {
    const lower = lowerSession();
    lower.supersets = lower.supersets.concat(lower.supersets[0]); // 3 supersets
    const upper = rebuildSessionForSplit(lower, 'UPPER', buddyPlan, [], SEED_EXERCISES, SEED_SUPERSETS);
    expect(upper).toMatchObject({
      id: 'sess-1',
      date: lower.date,
      notes: 'keep me',
      withBuddy: true,
      status: 'PLANNED',
    });
    expect(upper.supersets).toHaveLength(3);
    expect(upper.finishers).toHaveLength(lower.finishers.length);

    const active = rebuildSessionForSplit(
      { ...lower, status: 'ACTIVE' }, 'UPPER', buddyPlan, [], SEED_EXERCISES, SEED_SUPERSETS
    );
    expect(active.status).toBe('ACTIVE');
  });

  it('respects solo sessions (no spotter lifts) and the Squat/Deadlift flip-flop', () => {
    const soloUpper: WorkoutSession = { ...lowerSession(), splitType: 'UPPER', withBuddy: false };
    const soloLower = rebuildSessionForSplit(soloUpper, 'LOWER', buddyPlan, [], SEED_EXERCISES, SEED_SUPERSETS);
    expect(allIds(soloLower).some((id) => exMap.get(id)?.needsSpotter)).toBe(false);
    expect(soloLower.primaryLiftId).toBe('db_bulgarian_split_squat');

    const lastSquat: WorkoutSession = {
      ...lowerSession(),
      id: 'earlier',
      date: new Date('2026-11-06T09:00:00').toISOString(),
      status: 'COMPLETED',
    };
    const upper: WorkoutSession = { ...lowerSession(), splitType: 'UPPER' };
    const toLower = rebuildSessionForSplit(upper, 'LOWER', buddyPlan, [lastSquat], SEED_EXERCISES, SEED_SUPERSETS);
    expect(toLower.primaryLiftId).toBe('bb_deadlift');
  });

  it('works for PPL splits too', () => {
    const push = rebuildSessionForSplit(lowerSession(), 'PPL_PULL', buddyPlan, [], SEED_EXERCISES, SEED_SUPERSETS);
    expect(push.splitType).toBe('PPL_PULL');
    expect(push.primaryLiftId).toBe('weighted_pullup');
  });
});
