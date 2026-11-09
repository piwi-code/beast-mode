import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAN_CONFIG,
  SEED_EXERCISES,
  SEED_SUPERSETS,
} from '../seed/catalog';
import {
  buildDraftSessionFromSuggestion,
  suggestNextSession,
} from '../engine/sequencer';
import {
  evaluateExerciseSlot,
  evaluateSessionSafeguards,
} from '../engine/rulesEngine';
import {
  isBuddyDay,
  normalizePlanConfig,
  normalizeSession,
  setSessionBuddy,
} from '../engine/splits';
import { PlanConfig, WorkoutSession } from '../models/types';

const exerciseMap = new Map(SEED_EXERCISES.map((e) => [e.id, e]));
// 2026-11-10 is a Tuesday, 2026-11-11 a Wednesday
const TUESDAY = new Date('2026-11-10T09:00:00');
const WEDNESDAY = new Date('2026-11-11T09:00:00');
const tueBuddyPlan: PlanConfig = { ...DEFAULT_PLAN_CONFIG, buddyDays: [2] };

const upperAfterLower: WorkoutSession = {
  id: 'prev',
  date: new Date('2026-11-08T09:00:00').toISOString(),
  splitType: 'LOWER',
  primaryLiftId: 'bb_back_squat',
  primaryLiftSets: [],
  supersets: [],
  finishers: [],
  totalAxialLoad: 0,
  status: 'COMPLETED',
};

describe('buddy (spotter) availability', () => {
  it('defaults withBuddy from the plan buddy days', () => {
    expect(isBuddyDay(tueBuddyPlan, TUESDAY)).toBe(true);
    expect(isBuddyDay(tueBuddyPlan, WEDNESDAY)).toBe(false);
    expect(suggestNextSession(tueBuddyPlan, [upperAfterLower], TUESDAY).withBuddy).toBe(true);
    expect(suggestNextSession(tueBuddyPlan, [upperAfterLower], WEDNESDAY).withBuddy).toBe(false);
  });

  it('picks barbell bench on buddy days and dumbbell bench when solo', () => {
    const buddy = suggestNextSession(tueBuddyPlan, [upperAfterLower], TUESDAY);
    const solo = suggestNextSession(tueBuddyPlan, [upperAfterLower], WEDNESDAY);
    expect(buddy.splitType).toBe('UPPER');
    expect(buddy.recommendedPrimaryLiftId).toBe('bb_flat_bench');
    expect(solo.recommendedPrimaryLiftId).toBe('db_flat_bench');
    expect(solo.alternativePrimaryLiftIds).not.toContain('bb_flat_bench');
  });

  it('uses Bulgarian Split Squat for solo squat days and keeps the Squat/Deadlift flip-flop', () => {
    const upperPrev: WorkoutSession = { ...upperAfterLower, splitType: 'UPPER', primaryLiftId: 'db_flat_bench' };
    const soloLower = suggestNextSession(tueBuddyPlan, [upperPrev], WEDNESDAY);
    expect(soloLower.splitType).toBe('LOWER');
    expect(soloLower.recommendedPrimaryLiftId).toBe('db_bulgarian_split_squat');
    expect(soloLower.alternativePrimaryLiftIds).not.toContain('bb_back_squat');

    const lastSplitSquat: WorkoutSession = {
      ...upperAfterLower,
      date: new Date('2026-11-06T09:00:00').toISOString(),
      primaryLiftId: 'db_bulgarian_split_squat',
    };
    const afterSquat = suggestNextSession(tueBuddyPlan, [lastSplitSquat, upperPrev], WEDNESDAY);
    expect(afterSquat.recommendedPrimaryLiftId).toBe('bb_deadlift');

    const lastDeadlift = { ...lastSplitSquat, primaryLiftId: 'bb_deadlift' };
    expect(
      suggestNextSession(tueBuddyPlan, [lastDeadlift, upperPrev], TUESDAY).recommendedPrimaryLiftId
    ).toBe('bb_back_squat');
    expect(
      suggestNextSession(tueBuddyPlan, [lastDeadlift, upperPrev], WEDNESDAY).recommendedPrimaryLiftId
    ).toBe('db_bulgarian_split_squat');
  });

  it('flags back squat as needing a spotter on solo sessions', () => {
    const session: WorkoutSession = {
      ...upperAfterLower,
      id: 'solo-lower',
      withBuddy: false,
      status: 'PLANNED',
    };
    const ev = evaluateExerciseSlot({
      exerciseId: 'bb_back_squat',
      slotRole: 'PRIMARY',
      session,
      priorSessions: [],
      exercises: SEED_EXERCISES,
      plan: tueBuddyPlan,
    });
    expect(ev.health).toBe('NEEDS_SPOTTER');
    expect(ev.suggestedReplacementId).toBe('db_bulgarian_split_squat');
  });

  it('also applies to PPL push days and can be overridden per session', () => {
    const ppl: PlanConfig = { ...tueBuddyPlan, scheduleFamily: 'PPL' };
    expect(suggestNextSession(ppl, [], WEDNESDAY).recommendedPrimaryLiftId).toBe('db_flat_bench');
    expect(suggestNextSession(ppl, [], WEDNESDAY, true).recommendedPrimaryLiftId).toBe('bb_flat_bench');
  });

  it('never drafts a spotter-dependent lift for a solo session', () => {
    const solo = suggestNextSession(tueBuddyPlan, [upperAfterLower], WEDNESDAY);
    const draft = buildDraftSessionFromSuggestion(
      { ...solo, recommendedPrimaryLiftId: 'bb_flat_bench' },
      SEED_EXERCISES,
      SEED_SUPERSETS
    );
    expect(draft.withBuddy).toBe(false);
    expect(draft.primaryLiftId).toBe('db_flat_bench');
  });

  it('warns (NEEDS_SPOTTER) with a one-tap safe swap when bench is picked solo', () => {
    const session: WorkoutSession = {
      ...upperAfterLower,
      id: 'today',
      splitType: 'UPPER',
      withBuddy: false,
      primaryLiftId: 'bb_flat_bench',
      status: 'PLANNED',
    };
    const evalSolo = evaluateExerciseSlot({
      exerciseId: 'bb_flat_bench',
      slotRole: 'PRIMARY',
      session,
      priorSessions: [],
      exercises: SEED_EXERCISES,
      plan: tueBuddyPlan,
    });
    expect(evalSolo.health).toBe('NEEDS_SPOTTER');
    expect(evalSolo.suggestedReplacementId).toBe('db_flat_bench');
    expect(
      evaluateSessionSafeguards(session, [], SEED_EXERCISES, tueBuddyPlan).some(
        (a) => a.rule === 'SPOTTER_REQUIRED'
      )
    ).toBe(true);

    const evalBuddy = evaluateExerciseSlot({
      exerciseId: 'bb_flat_bench',
      slotRole: 'PRIMARY',
      session: { ...session, withBuddy: true },
      priorSessions: [],
      exercises: SEED_EXERCISES,
      plan: tueBuddyPlan,
    });
    expect(evalBuddy.health).not.toBe('NEEDS_SPOTTER');
  });

  it('switching a session to solo swaps spotter lifts; switching to buddy keeps them', () => {
    const session: WorkoutSession = {
      ...upperAfterLower,
      splitType: 'UPPER',
      withBuddy: true,
      primaryLiftId: 'bb_flat_bench',
    };
    const solo = setSessionBuddy(session, false, exerciseMap);
    expect(solo.withBuddy).toBe(false);
    expect(solo.primaryLiftId).toBe('db_flat_bench');
    const back = setSessionBuddy(solo, true, exerciseMap);
    expect(back.withBuddy).toBe(true);
    expect(back.primaryLiftId).toBe('db_flat_bench');
  });
});

describe('migration of buddy/solo split data', () => {
  it('converts legacy BUDDY_/SOLO_ splits into UPPER/LOWER + withBuddy', () => {
    const legacy = { ...upperAfterLower, splitType: 'BUDDY_UPPER' } as unknown as WorkoutSession;
    expect(normalizeSession(legacy)).toMatchObject({ splitType: 'UPPER', withBuddy: true });
    const legacySolo = { ...upperAfterLower, splitType: 'SOLO_LOWER' } as unknown as WorkoutSession;
    expect(normalizeSession(legacySolo)).toMatchObject({ splitType: 'LOWER', withBuddy: false });
    expect(normalizeSession(upperAfterLower)).toBe(upperAfterLower);
  });

  it('turns the legacy plan variant into buddy days', () => {
    const { buddyDays: _omit, ...rest } = DEFAULT_PLAN_CONFIG;
    void _omit;
    const legacyBuddy = {
      ...rest,
      name: 'Buddy Upper / Lower (4-Session Split)',
      upperLowerVariant: 'BUDDY_ONLY',
    } as unknown as PlanConfig;
    const migrated = normalizePlanConfig(legacyBuddy);
    expect(migrated.buddyDays).toHaveLength(7);
    expect(migrated.name).toBe('Upper / Lower (4-Session Split)');
    const legacySolo = { ...rest, upperLowerVariant: 'SOLO_ONLY' } as unknown as PlanConfig;
    expect(normalizePlanConfig(legacySolo).buddyDays).toEqual([]);
  });
});
