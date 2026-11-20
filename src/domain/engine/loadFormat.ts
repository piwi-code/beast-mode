import { Exercise } from '../models/types';
import { getLoadProfile, stackLbLabel } from './increments';

/** How many implements the logged weight applies to (2 for paired dumbbells). */
export function getLoadMultiplier(ex: Exercise | undefined): number {
  return ex?.dumbbellsUsed ?? 1;
}

/** Total weight moved for a logged per-dumbbell weight. */
export function getTotalLoadKg(ex: Exercise | undefined, weightKg: number): number {
  return weightKg * getLoadMultiplier(ex);
}

/** "2 × 20 kg" for paired dumbbells, "85 kg" otherwise, "Bodyweight" for 0. */
export function formatLoad(ex: Exercise | undefined, weightKg: number): string {
  if (weightKg <= 0) return 'Bodyweight';
  const n = getLoadMultiplier(ex);
  return n > 1 ? `${n} × ${weightKg} kg` : `${weightKg} kg`;
}

/** formatLoad plus the stack pin in lb where it helps: "27.2 kg (60 lb)". */
export function formatLoadWithPin(ex: Exercise | undefined, weightKg: number): string {
  const pin = stackLbLabel(weightKg, getLoadProfile(ex));
  return pin ? `${formatLoad(ex, weightKg)} (${pin})` : formatLoad(ex, weightKg);
}

/** "30 → 25 → 20 kg", plus the pins for stacks: "24.9 → 20.4 → 15.9 kg (55 → 45 → 35 lb)". */
export function formatDropSet(ex: Exercise | undefined, weightsKg: number[]): string {
  const kg = `${weightsKg.join(' → ')} kg`;
  const profile = getLoadProfile(ex);
  if (profile.kind !== 'stack') return kg;
  const lbs = weightsKg.map((w) => (stackLbLabel(w, profile) ?? '').replace(' lb', ''));
  return `${kg} (${lbs.join(' → ')} lb)`;
}
