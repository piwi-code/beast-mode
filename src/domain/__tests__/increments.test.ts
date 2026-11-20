import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES } from '../seed/catalog';
import {
  getLoadProfile,
  lbToKg,
  snapLoad,
  stackLbLabel,
  stepLoad,
} from '../engine/increments';
import { getDropSetWeightsFor, progressLoad } from '../engine/loads';

const exMap = new Map(SEED_EXERCISES.map((e) => [e.id, e]));
const profile = (id: string) => getLoadProfile(exMap.get(id));
const walk = (id: string, from: number, dir: 1 | -1, n: number) => {
  const out = [];
  let kg = from;
  for (let i = 0; i < n; i++) out.push((kg = stepLoad(kg, profile(id), dir)));
  return out;
};

describe('kit profiles', () => {
  it('picks the right kit for each exercise', () => {
    expect(profile('db_flat_bench')).toEqual({ kind: 'dumbbell' });
    expect(profile('farmers_carry_turf')).toEqual({ kind: 'dumbbell' });
    expect(profile('tricep_rope_pushdown')).toEqual({ kind: 'stack', minorLb: 5, majorLb: 10 });
    expect(profile('machine_chest_press')).toEqual({ kind: 'stack', minorLb: 5, majorLb: 15 });
    expect(profile('leg_press_machine')).toEqual({ kind: 'linear', stepKg: 2.5 });
    expect(profile('bb_flat_bench')).toEqual({ kind: 'linear', stepKg: 2.5 });
    expect(profile('bb_curl_drop_set')).toEqual({ kind: 'linear', stepKg: 5 });
  });
});

describe('dumbbells: 1 kg steps to 10 kg, then 2 kg', () => {
  it('steps along the real ladder', () => {
    expect(walk('db_lateral_raise', 7, 1, 6)).toEqual([8, 9, 10, 12, 14, 16]);
    expect(walk('db_flat_bench', 14, -1, 6)).toEqual([12, 10, 9, 8, 7, 6]);
    expect(stepLoad(1, profile('db_lateral_raise'), -1)).toBe(0);
  });

  it('snaps odd values to an existing dumbbell', () => {
    expect(snapLoad(17.5, profile('db_flat_bench'))).toBe(18);
    expect(snapLoad(11, profile('db_flat_bench'))).toBe(10);
    expect(snapLoad(7.4, profile('db_flat_bench'))).toBe(7);
  });
});

describe('stacks: 5 lb steps, stored in kg', () => {
  it('converts lb settings to kg', () => {
    expect(lbToKg(50)).toBe(22.7);
    expect(lbToKg(5)).toBe(2.3);
  });

  it('steps 5 lb at a time and shows the pin in lb', () => {
    const p = profile('tricep_rope_pushdown');
    expect(walk('tricep_rope_pushdown', lbToKg(50), 1, 3)).toEqual([lbToKg(55), lbToKg(60), lbToKg(65)]);
    expect(walk('tricep_rope_pushdown', lbToKg(50), -1, 2)).toEqual([lbToKg(45), lbToKg(40)]);
    expect(stackLbLabel(lbToKg(55), p)).toBe('55 lb');
    // an old kg value is moved onto a real setting
    expect(snapLoad(25, p)).toBe(lbToKg(55));
    expect(stepLoad(25, p, 1)).toBe(lbToKg(60));
  });

  it('round-trips through stored kg without drifting', () => {
    const p = profile('machine_chest_press');
    let kg = lbToKg(5);
    for (let i = 0; i < 60; i++) kg = stepLoad(kg, p, 1);
    expect(stackLbLabel(kg, p)).toBe('305 lb');
  });
});

describe('progression and drop sets follow the kit', () => {
  it('progresses by one real step', () => {
    expect(progressLoad(exMap.get('db_flat_bench'), 20)).toBe(22);
    expect(progressLoad(exMap.get('db_lateral_raise'), 6)).toBe(7);
    expect(progressLoad(exMap.get('tricep_rope_pushdown'), lbToKg(50))).toBe(lbToKg(55));
    expect(progressLoad(exMap.get('bb_flat_bench'), 85)).toBe(87.5);
    expect(progressLoad(exMap.get('bb_back_squat'), 110)).toBe(115);
    expect(progressLoad(exMap.get('leg_press_machine'), 140)).toBe(145);
  });

  it('drops a fixed bar / a major plate at a time', () => {
    expect(getDropSetWeightsFor(exMap.get('bb_curl_drop_set'), 30)).toEqual([30, 25, 20]);
    expect(getDropSetWeightsFor(exMap.get('bb_curl_drop_set'), 40)).toEqual([40, 30, 20]);
    // cable pushdown at 55 lb: 20% ~ 11 lb -> 10 lb drops
    expect(getDropSetWeightsFor(exMap.get('cable_pushdown_drop_set'), lbToKg(55))).toEqual([
      lbToKg(55),
      lbToKg(45),
      lbToKg(35),
    ]);
  });
});
