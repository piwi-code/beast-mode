import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAN_CONFIG,
  SEED_EXERCISES,
  SEED_SUPERSETS,
} from '../seed/catalog';
import {
  buildDraftSessionFromSuggestion,
  resizeSupersetTargetSets,
  suggestNextSession,
} from '../engine/sequencer';
import {
  calculateSessionAxialLoad,
  evaluateExerciseSlot,
  evaluateSessionSafeguards,
} from '../engine/rulesEngine';
import { estimateOneRepMax } from '../engine/oneRepMax';
import { WorkoutSession } from '../models/types';

describe('Beast Mode Domain Engine', () => {
  it('defaults to Buddy 4-Session Upper/Lower and suggests Buddy Lower after Buddy Upper', () => {
    expect(DEFAULT_PLAN_CONFIG.upperLowerVariant).toBe('BUDDY_ONLY');
    expect(DEFAULT_PLAN_CONFIG.sessionsPerWeek).toBe(4);

    const prevSession: WorkoutSession = {
      id: 's1',
      date: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
      splitType: 'BUDDY_UPPER',
      primaryLiftId: 'bb_flat_bench',
      primaryLiftSets: [],
      supersets: [],
      finishers: [],
      totalAxialLoad: 0,
      status: 'COMPLETED',
    };

    const suggestion = suggestNextSession(DEFAULT_PLAN_CONFIG, [prevSession]);
    expect(suggestion.splitType).toBe('BUDDY_LOWER');
    expect(suggestion.recommendedPrimaryLiftId).toBe('bb_back_squat');
  });

  it('flip-flops Lower primary anchor between Back Squat and Deadlift across consecutive Lower sessions (including 2-day Buddy split)', () => {
    const buddy2DayPlan = {
      ...DEFAULT_PLAN_CONFIG,
      sessionsPerWeek: 2 as const,
    };

    const lower1Squat: WorkoutSession = {
      id: 'l1',
      date: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
      splitType: 'BUDDY_LOWER',
      primaryLiftId: 'bb_back_squat',
      primaryLiftSets: [],
      supersets: [],
      finishers: [],
      totalAxialLoad: 4,
      status: 'COMPLETED',
    };
    const upper1Bench: WorkoutSession = {
      id: 'u1',
      date: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
      splitType: 'BUDDY_UPPER',
      primaryLiftId: 'bb_flat_bench',
      primaryLiftSets: [],
      supersets: [],
      finishers: [],
      totalAxialLoad: 0,
      status: 'COMPLETED',
    };

    // Next session is BUDDY_LOWER -> should flip-flop from Squat to Deadlift
    const nextLowerDeadlift = suggestNextSession(buddy2DayPlan, [
      lower1Squat,
      upper1Bench,
    ]);
    expect(nextLowerDeadlift.splitType).toBe('BUDDY_LOWER');
    expect(nextLowerDeadlift.recommendedPrimaryLiftId).toBe('bb_deadlift');

    // And the Lower session after that should flip back to Squat
    const lower2Deadlift: WorkoutSession = {
      ...lower1Squat,
      id: 'l2',
      date: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      primaryLiftId: 'bb_deadlift',
    };
    const upper2Bench: WorkoutSession = {
      ...upper1Bench,
      id: 'u2',
      date: new Date().toISOString(),
    };
    const nextLowerSquat = suggestNextSession(buddy2DayPlan, [
      lower1Squat,
      upper1Bench,
      lower2Deadlift,
      upper2Bench,
    ]);
    expect(nextLowerSquat.splitType).toBe('BUDDY_LOWER');
    expect(nextLowerSquat.recommendedPrimaryLiftId).toBe('bb_back_squat');
  });

  it('cycles Push -> Pull -> Legs in PPL plan', () => {
    const pplPlan = {
      ...DEFAULT_PLAN_CONFIG,
      scheduleFamily: 'PPL' as const,
      sessionsPerWeek: 3 as const,
    };

    const prevPush: WorkoutSession = {
      id: 's_push',
      date: new Date().toISOString(),
      splitType: 'PPL_PUSH',
      primaryLiftId: 'bb_flat_bench',
      primaryLiftSets: [],
      supersets: [],
      finishers: [],
      totalAxialLoad: 0,
      status: 'COMPLETED',
    };

    const nextPull = suggestNextSession(pplPlan, [prevPush]);
    expect(nextPull.splitType).toBe('PPL_PULL');
    expect(nextPull.recommendedPrimaryLiftId).toBe('weighted_pullup');
  });

  it('triggers Red Intra-Session Overwork and Quick Switch suggestion when Squat + RDL are combined', () => {
    const exerciseMap = new Map(SEED_EXERCISES.map((e) => [e.id, e]));
    const suggestion = suggestNextSession(DEFAULT_PLAN_CONFIG, []);
    const draft = buildDraftSessionFromSuggestion(
      {
        ...suggestion,
        splitType: 'BUDDY_LOWER',
        recommendedPrimaryLiftId: 'bb_back_squat',
      },
      SEED_EXERCISES,
      SEED_SUPERSETS
    );

    draft.supersets[0].exerciseAId = 'bb_rdl';

    const axial = calculateSessionAxialLoad(draft, exerciseMap);
    expect(axial).toBeGreaterThan(4);

    const slotEval = evaluateExerciseSlot({
      exerciseId: 'bb_rdl',
      slotRole: 'SUPERSET_A',
      partnerExerciseId: draft.supersets[0].exerciseBId,
      session: draft,
      priorSessions: [],
      exercises: SEED_EXERCISES,
      plan: DEFAULT_PLAN_CONFIG,
    });
    expect(slotEval.health).toBe('INTRA_SESSION_OVERWORK');
    expect(slotEval.suggestedReplacementId).toBeDefined();
  });

  it('flags Blue Wrong Style when a pure Upper exercise is added to a Lower session', () => {
    const suggestion = suggestNextSession(DEFAULT_PLAN_CONFIG, []);
    const draft = buildDraftSessionFromSuggestion(
      {
        ...suggestion,
        splitType: 'BUDDY_LOWER',
        recommendedPrimaryLiftId: 'bb_back_squat',
      },
      SEED_EXERCISES,
      SEED_SUPERSETS
    );

    const slotEval = evaluateExerciseSlot({
      exerciseId: 'cable_fly_low_high',
      slotRole: 'SUPERSET_A',
      partnerExerciseId: 'machine_calf_raise_standing',
      session: draft,
      priorSessions: [],
      exercises: SEED_EXERCISES,
      plan: DEFAULT_PLAN_CONFIG,
    });
    expect(slotEval.health).toBe('WRONG_STYLE');
    expect(slotEval.suggestedReplacementId).toBeDefined();
  });

  it('flags Intra-Session Overlap when Flat Barbell Bench is combined with Incline DB Press', () => {
    const suggestion = suggestNextSession(DEFAULT_PLAN_CONFIG, []);
    const draft = buildDraftSessionFromSuggestion(
      {
        ...suggestion,
        splitType: 'BUDDY_UPPER',
        recommendedPrimaryLiftId: 'bb_flat_bench',
      },
      SEED_EXERCISES,
      SEED_SUPERSETS
    );

    draft.supersets[0].exerciseBId = 'db_incline_press';

    const alerts = evaluateSessionSafeguards(
      draft,
      [],
      SEED_EXERCISES,
      DEFAULT_PLAN_CONFIG
    );
    expect(alerts.some((a) => a.rule === 'INTRA_SESSION_OVERLAP')).toBe(true);
  });

  it('resizes superset sets cleanly between 2 and 3 sets', () => {
    const suggestion = suggestNextSession(DEFAULT_PLAN_CONFIG, []);
    const draft = buildDraftSessionFromSuggestion(
      suggestion,
      SEED_EXERCISES,
      SEED_SUPERSETS
    );
    const resizedTo2 = resizeSupersetTargetSets(draft.supersets[0], 2);
    expect(resizedTo2.targetSets).toBe(2);
    expect(resizedTo2.setsA.length).toBe(2);
    expect(resizedTo2.setsB.length).toBe(2);

    const resizedBackTo3 = resizeSupersetTargetSets(resizedTo2, 3);
    expect(resizedBackTo3.targetSets).toBe(3);
    expect(resizedBackTo3.setsA.length).toBe(3);
  });

  it('calculates Epley 1RM accurately', () => {
    expect(estimateOneRepMax(100, 5)).toBe(116.7);
    expect(estimateOneRepMax(85, 1)).toBe(85);
  });
});
