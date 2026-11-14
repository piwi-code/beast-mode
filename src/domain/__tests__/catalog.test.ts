import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAN_CONFIG,
  SEED_EXERCISES,
  SEED_SUPERSETS,
} from '../seed/catalog';
import {
  buildDraftSessionFromSuggestion,
  buildFinisherBlock,
  changeFinisherExercise,
  getDefaultFinishersForSplit,
  pickExtraFinisherId,
  suggestNextSession,
} from '../engine/sequencer';
import {
  evaluateSessionSafeguards,
  isExerciseStyleAlignedWithSplit,
} from '../engine/rulesEngine';

const exMap = new Map(SEED_EXERCISES.map((e) => [e.id, e]));

describe('seed catalog integrity', () => {
  it('has unique ids and valid references', () => {
    expect(new Set(SEED_EXERCISES.map((e) => e.id)).size).toBe(SEED_EXERCISES.length);
    expect(new Set(SEED_SUPERSETS.map((s) => s.id)).size).toBe(SEED_SUPERSETS.length);
    for (const ss of SEED_SUPERSETS) {
      expect(exMap.has(ss.exerciseAId), ss.id).toBe(true);
      expect(exMap.has(ss.exerciseBId), ss.id).toBe(true);
    }
    for (const ex of SEED_EXERCISES) {
      if (ex.soloAlternativeId) expect(exMap.has(ex.soloAlternativeId), ex.id).toBe(true);
    }
  });

  it('no curated superset trips the competing-pair or grip-clash rules', () => {
    const base = buildDraftSessionFromSuggestion(
      suggestNextSession(DEFAULT_PLAN_CONFIG, [], new Date(), false, { split: 'PPL_PULL' }),
      SEED_EXERCISES,
      SEED_SUPERSETS
    );
    for (const ss of SEED_SUPERSETS) {
      const session = {
        ...base,
        primaryLiftId: 'weighted_pullup',
        finishers: [],
        supersets: [
          { ...base.supersets[0], supersetPairId: ss.id, exerciseAId: ss.exerciseAId, exerciseBId: ss.exerciseBId },
        ],
      };
      const alerts = evaluateSessionSafeguards(session, [], SEED_EXERCISES, DEFAULT_PLAN_CONFIG);
      expect(alerts.filter((a) => a.rule === 'COMPETING_SUPERSET').map((a) => a.title), ss.id).toEqual([]);
    }
  });

  it('every superset exercise suits each split the superset is recommended for', () => {
    for (const ss of SEED_SUPERSETS) {
      for (const split of ss.recommendedSplits) {
        const ok =
          isExerciseStyleAlignedWithSplit(exMap.get(ss.exerciseAId)!, split) ||
          isExerciseStyleAlignedWithSplit(exMap.get(ss.exerciseBId)!, split);
        expect(ok, `${ss.id} on ${split}`).toBe(true);
      }
    }
  });
});

describe('finishers', () => {
  it('includes a barbell drop set finisher with its own protocol and load', () => {
    const curl = exMap.get('bb_curl_drop_set')!;
    expect(curl.isFinisherCandidate).toBe(true);
    expect(curl.equipment).toBe('BARBELL');
    const block = buildFinisherBlock(curl, curl.id);
    expect(block.protocolNote).toMatch(/next bar down/);
    expect(block.loadKg).toBe(30);
    expect(block.rounds).toBe(2);
  });

  it('orders upper finishers face pulls first, pump drop set last', () => {
    expect(getDefaultFinishersForSplit('UPPER', 2)).toEqual(['rope_face_pull', 'bb_curl_drop_set']);
    expect(getDefaultFinishersForSplit('PPL_PUSH', 2)[1]).toBe('cable_pushdown_drop_set');
    expect(getDefaultFinishersForSplit('UPPER', 1)).toEqual(['rope_face_pull']);
  });

  it('changing a finisher exercise updates protocol, load and rounds but keeps the id', () => {
    const sled = buildFinisherBlock(exMap.get('turf_sled_push_pull'), 'turf_sled_push_pull');
    const changed = changeFinisherExercise(sled, exMap.get('bb_curl_drop_set'), 'bb_curl_drop_set');
    expect(changed.id).toBe(sled.id);
    expect(changed.exerciseId).toBe('bb_curl_drop_set');
    expect(changed.protocolNote).not.toBe(sled.protocolNote);
    expect(changed.completedRounds).toBe(0);
  });

  it('"add finisher" picks one not already in the session', () => {
    const upper = buildDraftSessionFromSuggestion(
      suggestNextSession(DEFAULT_PLAN_CONFIG, [], new Date(), true, { split: 'UPPER' }),
      SEED_EXERCISES,
      SEED_SUPERSETS
    );
    expect(upper.finishers.map((f) => f.exerciseId)).toEqual(['rope_face_pull']);
    expect(pickExtraFinisherId(upper, SEED_EXERCISES)).toBe('bb_curl_drop_set');
  });
});
