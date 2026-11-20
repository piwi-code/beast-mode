import { Exercise } from '../models/types';

/**
 * Which weights are actually available on a piece of kit. All weights are
 * stored and shown in kg; stacks are worked out in lb behind the scenes and
 * converted, because that is how the gym's stacks are numbered.
 *
 *  - plates:   plate-loaded barbells / leg press / sled, linear kg jumps (2.5 kg)
 *  - fixed:    fixed (pre-loaded) barbells, linear kg jumps (5 kg)
 *  - dumbbell: kg dumbbells, 1 kg jumps up to 10 kg, then 2 kg jumps
 *  - stack:    pin-selected weight stacks; 5 lb add-on (minor) and a major plate
 *              of 10 lb (cables) or 15 lb (other machines)
 */
export type LoadProfile =
  | { kind: 'linear'; stepKg: number }
  | { kind: 'dumbbell' }
  | { kind: 'stack'; minorLb: number; majorLb: number };

export const LB_TO_KG = 0.45359237;
export const STACK_MINOR_LB = 5;
export const CABLE_MAJOR_LB = 10;
export const MACHINE_MAJOR_LB = 15;
export const DUMBBELL_SMALL_MAX_KG = 10;
export const DUMBBELL_SMALL_STEP_KG = 1;
export const DUMBBELL_LARGE_STEP_KG = 2;
const DEFAULT_PLATE_STEP_KG = 2.5;
const EPS = 1e-6;

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** kg value for a stack setting in lb (kept to 0.1 kg). */
export function lbToKg(lb: number): number {
  return round1(lb * LB_TO_KG);
}

export function kgToLb(kg: number): number {
  return kg / LB_TO_KG;
}

export function getLoadProfile(ex: Exercise | undefined): LoadProfile {
  const kind =
    ex?.loadProfile ??
    (ex?.dumbbellsUsed || ex?.equipment === 'DUMBBELL'
      ? 'dumbbell'
      : ex?.equipment === 'CABLE'
        ? 'cable-stack'
        : ex?.equipment === 'MACHINE'
          ? 'machine-stack'
          : 'plates');
  switch (kind) {
    case 'dumbbell':
      return { kind: 'dumbbell' };
    case 'cable-stack':
      return { kind: 'stack', minorLb: STACK_MINOR_LB, majorLb: CABLE_MAJOR_LB };
    case 'machine-stack':
      return { kind: 'stack', minorLb: STACK_MINOR_LB, majorLb: MACHINE_MAJOR_LB };
    case 'fixed-bar':
      return { kind: 'linear', stepKg: ex?.loadStepKg ?? 5 };
    case 'plates':
      return { kind: 'linear', stepKg: ex?.loadStepKg ?? DEFAULT_PLATE_STEP_KG };
  }
}

/** Dumbbell weight ladder: 1, 2, ... 10, then 12, 14, ... */
function dumbbellNeighbours(kg: number): { below: number; above: number } {
  if (kg < DUMBBELL_SMALL_MAX_KG + EPS) {
    const below = Math.floor(kg / DUMBBELL_SMALL_STEP_KG + EPS) * DUMBBELL_SMALL_STEP_KG;
    const above = Math.ceil(kg / DUMBBELL_SMALL_STEP_KG - EPS) * DUMBBELL_SMALL_STEP_KG;
    return { below, above };
  }
  const offset = kg - DUMBBELL_SMALL_MAX_KG;
  const below =
    DUMBBELL_SMALL_MAX_KG +
    Math.floor(offset / DUMBBELL_LARGE_STEP_KG + EPS) * DUMBBELL_LARGE_STEP_KG;
  const above =
    DUMBBELL_SMALL_MAX_KG +
    Math.ceil(offset / DUMBBELL_LARGE_STEP_KG - EPS) * DUMBBELL_LARGE_STEP_KG;
  return { below, above };
}

/** Nearest weight that actually exists on this kit. 0 (bodyweight / empty) stays 0. */
export function snapLoad(kg: number, profile: LoadProfile): number {
  if (kg <= 0) return 0;
  switch (profile.kind) {
    case 'linear':
      return round2(Math.round(kg / profile.stepKg) * profile.stepKg);
    case 'dumbbell': {
      const { below, above } = dumbbellNeighbours(kg);
      const pick = above - kg < kg - below ? above : below;
      return Math.max(DUMBBELL_SMALL_STEP_KG, pick);
    }
    case 'stack': {
      const lb = Math.round(kgToLb(kg) / profile.minorLb) * profile.minorLb;
      return lbToKg(Math.max(profile.minorLb, lb));
    }
  }
}

/** Next available weight above (dir 1) or below (dir -1) `kg`. Never below 0. */
export function stepLoad(kg: number, profile: LoadProfile, dir: 1 | -1): number {
  switch (profile.kind) {
    case 'linear': {
      const s = profile.stepKg;
      const k = kg / s;
      const n = dir > 0 ? Math.floor(k + EPS) + 1 : Math.ceil(k - EPS) - 1;
      return Math.max(0, round2(n * s));
    }
    case 'dumbbell': {
      if (dir < 0 && kg <= DUMBBELL_SMALL_STEP_KG + EPS) return 0;
      const probe = kg + dir * EPS * 10;
      const { below, above } = dumbbellNeighbours(probe);
      return dir > 0 ? (above > kg + EPS ? above : dumbbellNeighbours(above + EPS * 10).above) : below;
    }
    case 'stack': {
      const lb = kgToLb(kg);
      const m = profile.minorLb;
      // tolerate kg rounding (stored to 0.1 kg) when deciding we are "on" a setting
      const k = lb / m;
      const onGrid = Math.abs(k - Math.round(k)) < 0.03;
      const base = onGrid ? Math.round(k) : dir > 0 ? Math.floor(k) : Math.ceil(k);
      const n = base + dir;
      return n <= 0 ? 0 : lbToKg(n * m);
    }
  }
}

/** "50 lb" for stack weights (to find the pin), undefined for anything in kg. */
export function stackLbLabel(kg: number, profile: LoadProfile): string | undefined {
  if (profile.kind !== 'stack' || kg <= 0) return undefined;
  return `${Math.round(kgToLb(kg) / profile.minorLb) * profile.minorLb} lb`;
}
