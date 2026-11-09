import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES, SEED_SUPERSETS } from '../seed/catalog';
import {
  buildExerciseOptions,
  buildSupersetOptions,
  filterOptionsByKey,
  getExerciseRegion,
  getFinisherSuggestionIds,
  getPrimaryLiftSuggestionIds,
  searchOptions,
} from '../catalog/pickerOptions';

const exMap = new Map(SEED_EXERCISES.map((e) => [e.id, e]));
const exerciseOptions = buildExerciseOptions(SEED_EXERCISES);
const supersetOptions = buildSupersetOptions(SEED_SUPERSETS, SEED_EXERCISES);

describe('picker option labelling', () => {
  it('every seed exercise has a short name and plain summary', () => {
    for (const ex of SEED_EXERCISES) {
      expect(ex.shortName, ex.id).toBeTruthy();
      expect(ex.summary, ex.id).toBeTruthy();
    }
    for (const ss of SEED_SUPERSETS) expect(ss.summary, ss.id).toBeTruthy();
  });

  it('uses the plain short name as the title and tags the equipment', () => {
    const squat = exerciseOptions.find((o) => o.id === 'bb_back_squat')!;
    expect(squat.title).toBe('Back Squat');
    expect(squat.tags.map((t) => t.label)).toEqual(
      expect.arrayContaining(['Barbell', 'Main lift', 'Heavy spine load'])
    );
    expect(squat.title).not.toMatch(/Axial/);
  });

  it('groups exercises by body region of the main muscle', () => {
    expect(getExerciseRegion(exMap.get('bb_back_squat')!)).toBe('LEGS');
    expect(getExerciseRegion(exMap.get('bb_ohp')!)).toBe('SHOULDERS');
    expect(getExerciseRegion(exMap.get('farmers_carry_turf')!)).toBe('CONDITIONING');
    for (const o of exerciseOptions) expect(o.groupIds).toHaveLength(1);
  });

  it('lists a superset under both of its exercises regions', () => {
    const rowFly = supersetOptions.find((o) => o.id === 'ss_row_cable_fly')!;
    expect(rowFly.title).toBe('Machine Row + Cable Fly (Low to High)');
    expect(rowFly.groupIds.sort()).toEqual(['BACK', 'CHEST']);
    expect(rowFly.filterKeys.sort()).toEqual(['CABLE', 'MACHINE']);
  });
});

describe('picker search & filter', () => {
  it('matches on muscle and equipment, all tokens required', () => {
    const ids = searchOptions(exerciseOptions, 'dumbbell chest').map((o) => o.id);
    expect(ids).toEqual(expect.arrayContaining(['db_flat_bench', 'db_incline_press']));
    expect(ids).not.toContain('bb_flat_bench');
  });

  it('ranks title-prefix matches first', () => {
    const results = searchOptions(exerciseOptions, 'row');
    expect(results[0].title.toLowerCase()).toMatch(/row/);
  });

  it('returns everything for an empty query', () => {
    expect(searchOptions(exerciseOptions, '   ')).toHaveLength(exerciseOptions.length);
  });

  it('filters by equipment key', () => {
    const cable = filterOptionsByKey(exerciseOptions, 'CABLE');
    expect(cable.length).toBeGreaterThan(0);
    for (const o of cable) expect(exMap.get(o.id)!.equipment).toBe('CABLE');
  });

  it('filters by several equipment keys at once (any match)', () => {
    const both = filterOptionsByKey(exerciseOptions, ['CABLE', 'MACHINE']);
    expect(both.length).toBe(
      filterOptionsByKey(exerciseOptions, 'CABLE').length +
        filterOptionsByKey(exerciseOptions, 'MACHINE').length
    );
    expect(filterOptionsByKey(exerciseOptions, [])).toHaveLength(exerciseOptions.length);
  });

  it('labels spotter-dependent lifts', () => {
    const bench = exerciseOptions.find((o) => o.id === 'bb_flat_bench')!;
    expect(bench.tags.map((t) => t.label)).toContain('Needs spotter');
  });

  it('suggests split-appropriate primary lifts and finishers', () => {
    expect(getPrimaryLiftSuggestionIds('PPL_LEGS')[0]).toBe('bb_back_squat');
    expect(getFinisherSuggestionIds(SEED_EXERCISES)).toContain('farmers_carry_turf');
  });
});
