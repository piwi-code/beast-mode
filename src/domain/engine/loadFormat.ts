import { Exercise } from '../models/types';

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
