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
  calculateSessionAxialLoad,
  evaluateSessionSafeguards,
} from '../engine/rulesEngine';
import { estimateOneRepMax } from '../engine/oneRepMax';
import { WorkoutSession } from '../models/types';

describe('Beast Mode Domain Engine', () => {
  it('suggests Lower after an Upper session in Hybrid Upper/Lower', () => {
    const prevSession: WorkoutSession = {
      id: 's1',
      date: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
      splitType: 'SOLO_UPPER',
      primaryLiftId: 'db_flat_bench',
      primaryLiftSets: [],
      supersets: [],
      finishers: [],
      totalAxialLoad: 0,
      status: 'COMPLETED',
    };

    const suggestion = suggestNextSession(DEFAULT_PLAN_CONFIG, [prevSession]);
    expect(suggestion.splitType).toBe('SOLO_LOWER');
    expect(suggestion.recommendedPrimaryLiftId).toBe('bb_back_squat');
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

  it('triggers Axial Load Ceiling (> 4) when Squat + RDL are combined', () => {
    const exerciseMap = new Map(SEED_EXERCISES.map((e) => [e.id, e]));
    const suggestion = suggestNextSession(DEFAULT_PLAN_CONFIG, []);
    const draft = buildDraftSessionFromSuggestion(
      { ...suggestion, splitType: 'BUDDY_LOWER', recommendedPrimaryLiftId: 'bb_back_squat' },
      SEED_EXERCISES,
      SEED_SUPERSETS
    );

    // Replace first superset exerciseA with Barbell RDL (axialLoadScore = 3)
    draft.supersets[0].exerciseAId = 'bb_rdl';

    const axial = calculateSessionAxialLoad(draft, exerciseMap);
    expect(axial).toBeGreaterThan(4);

    const alerts = evaluateSessionSafeguards(
      draft,
      [],
      SEED_EXERCISES,
      DEFAULT_PLAN_CONFIG
    );
    expect(alerts.some((a) => a.rule === 'AXIAL_LOAD_CEILING')).toBe(true);
  });

  it('flags Intra-Session Overlap when Flat Barbell Bench is combined with Incline DB Press', () => {
    const suggestion = suggestNextSession(DEFAULT_PLAN_CONFIG, []);
    const draft = buildDraftSessionFromSuggestion(
      { ...suggestion, splitType: 'BUDDY_UPPER', recommendedPrimaryLiftId: 'bb_flat_bench' },
      SEED_EXERCISES,
      SEED_SUPERSETS
    );

    // Put Incline DB Press into Superset 1
    draft.supersets[0].exerciseBId = 'db_incline_press';

    const alerts = evaluateSessionSafeguards(
      draft,
      [],
      SEED_EXERCISES,
      DEFAULT_PLAN_CONFIG
    );
    expect(alerts.some((a) => a.rule === 'INTRA_SESSION_OVERLAP')).toBe(true);
  });

  it('calculates Epley 1RM accurately', () => {
    expect(estimateOneRepMax(100, 5)).toBe(116.7);
    expect(estimateOneRepMax(85, 1)).toBe(85);
  });
});
