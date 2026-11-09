import {
  EquipmentCategory,
  Exercise,
  MuscleGroup,
  PairingType,
  SessionSplitType,
  SupersetPair,
} from '../models/types';
import { MUSCLE_LABELS } from '../engine/rulesEngine';
import { getPrimaryLiftCandidatesForSplit } from '../engine/sequencer';

/**
 * Framework-agnostic option model consumed by the shared picker UI.
 * Kept in the domain layer so the grouping/labelling/search rules are
 * unit-testable without React.
 */
export type PickerTagTone = 'neutral' | 'accent' | 'info' | 'warn';

export interface PickerTag {
  label: string;
  tone: PickerTagTone;
}

export interface PickerOption {
  id: string;
  /** Clear, plain-language name shown in bold. */
  title: string;
  /** One-line description shown under the title. */
  subtitle?: string;
  /** Small secondary line (muscles worked, preset name, etc.). */
  meta?: string;
  tags: PickerTag[];
  /** Group ids this option is listed under (an option may appear in several). */
  groupIds: string[];
  /** Keys matched by the filter chips (e.g. equipment). */
  filterKeys: string[];
  /** Lower-cased haystack used by the search box. */
  keywords: string;
}

export interface PickerGroup {
  id: string;
  label: string;
}

export interface PickerFilter {
  id: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Body regions (sub-headings in the picker)
// ---------------------------------------------------------------------------

export type BodyRegion =
  | 'LEGS'
  | 'CHEST'
  | 'BACK'
  | 'SHOULDERS'
  | 'ARMS'
  | 'CORE'
  | 'CONDITIONING';

export const BODY_REGION_GROUPS: PickerGroup[] = [
  { id: 'LEGS', label: 'Legs & Glutes' },
  { id: 'CHEST', label: 'Chest' },
  { id: 'BACK', label: 'Back' },
  { id: 'SHOULDERS', label: 'Shoulders' },
  { id: 'ARMS', label: 'Arms' },
  { id: 'CORE', label: 'Core' },
  { id: 'CONDITIONING', label: 'Carries & Conditioning' },
];

const MUSCLE_REGION: Record<MuscleGroup, BodyRegion> = {
  QUADS: 'LEGS',
  HAMSTRINGS: 'LEGS',
  GLUTES: 'LEGS',
  CALVES: 'LEGS',
  CHEST: 'CHEST',
  CHEST_UPPER: 'CHEST',
  LATS: 'BACK',
  UPPER_BACK: 'BACK',
  ANTERIOR_DELT: 'SHOULDERS',
  LATERAL_DELT: 'SHOULDERS',
  REAR_DELT: 'SHOULDERS',
  TRICEPS: 'ARMS',
  BICEPS: 'ARMS',
  CORE: 'CORE',
};

/** Friendlier muscle names than the engine's technical labels. */
const SIMPLE_MUSCLE_LABELS: Record<MuscleGroup, string> = {
  QUADS: 'Quads',
  HAMSTRINGS: 'Hamstrings',
  GLUTES: 'Glutes',
  CALVES: 'Calves',
  CHEST: 'Chest',
  CHEST_UPPER: 'Upper chest',
  LATS: 'Lats',
  UPPER_BACK: 'Upper back',
  ANTERIOR_DELT: 'Front delts',
  LATERAL_DELT: 'Side delts',
  REAR_DELT: 'Rear delts',
  TRICEPS: 'Triceps',
  BICEPS: 'Biceps',
  CORE: 'Core',
};

/**
 * An exercise is listed under the region of its *main* primary muscle so the
 * list stays short; carries/sleds get their own conditioning section.
 */
export function getExerciseRegion(ex: Exercise): BodyRegion {
  if (ex.pattern === 'LOCOMOTION') return 'CONDITIONING';
  const first = ex.primaryMuscles[0];
  return first ? MUSCLE_REGION[first] : 'CORE';
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const EQUIPMENT_LABELS: Record<EquipmentCategory, string> = {
  BARBELL: 'Barbell',
  DUMBBELL: 'Dumbbells',
  MACHINE: 'Machine',
  CABLE: 'Cable',
  TURF: 'Turf',
  BODYWEIGHT: 'Bodyweight',
};

export const EQUIPMENT_FILTERS: PickerFilter[] = (
  ['BARBELL', 'DUMBBELL', 'CABLE', 'MACHINE', 'BODYWEIGHT', 'TURF'] as const
).map((id) => ({ id, label: EQUIPMENT_LABELS[id] }));

export const PAIRING_LABELS: Record<PairingType, string> = {
  ANTAGONIST: 'Opposing muscles',
  UPPER_LOWER: 'Upper + lower',
  COMPOUND_ISOLATION: 'Big + small move',
  DECOMPRESSION: 'Spine reset',
};

export function getExerciseShortName(ex: Exercise | undefined): string {
  if (!ex) return 'Unknown exercise';
  return ex.shortName ?? ex.name;
}

function spineLoadTag(score: Exercise['axialLoadScore']): PickerTag | null {
  if (score >= 3) return { label: 'Heavy spine load', tone: 'warn' };
  if (score === 2) return { label: 'Moderate spine load', tone: 'info' };
  return null;
}

function musclesLine(ex: Exercise): string {
  return ex.primaryMuscles.map((m) => SIMPLE_MUSCLE_LABELS[m]).join(', ');
}

function setsRepsLine(ex: Exercise): string | null {
  if (!ex.defaultSets && !ex.defaultReps) return null;
  if (ex.defaultSets && ex.defaultReps) {
    return `${ex.defaultSets} × ${ex.defaultReps}`;
  }
  return ex.defaultReps ? `${ex.defaultReps} reps` : `${ex.defaultSets} sets`;
}

// ---------------------------------------------------------------------------
// Option builders
// ---------------------------------------------------------------------------

export function buildExerciseOption(ex: Exercise): PickerOption {
  const tags: PickerTag[] = [
    { label: EQUIPMENT_LABELS[ex.equipment], tone: 'neutral' },
  ];
  if (ex.isPrimaryAnchorCandidate) tags.push({ label: 'Main lift', tone: 'accent' });
  if (ex.isFinisherCandidate) tags.push({ label: 'Finisher', tone: 'accent' });
  const spine = spineLoadTag(ex.axialLoadScore);
  if (spine) tags.push(spine);
  if (ex.gripTax >= 2) tags.push({ label: 'Grip heavy', tone: 'info' });

  const region = getExerciseRegion(ex);
  const sr = setsRepsLine(ex);
  const meta = [`Works ${musclesLine(ex)}`, sr].filter(Boolean).join(' · ');

  const keywords = [
    ex.name,
    ex.shortName,
    ex.summary,
    EQUIPMENT_LABELS[ex.equipment],
    BODY_REGION_GROUPS.find((g) => g.id === region)?.label,
    ...ex.primaryMuscles.map((m) => `${SIMPLE_MUSCLE_LABELS[m]} ${MUSCLE_LABELS[m]}`),
    ...ex.secondaryMuscles.map((m) => SIMPLE_MUSCLE_LABELS[m]),
    ex.isPrimaryAnchorCandidate ? 'main lift anchor' : '',
    ex.isFinisherCandidate ? 'finisher' : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return {
    id: ex.id,
    title: ex.shortName ?? ex.name,
    subtitle: ex.summary ?? `Targets ${musclesLine(ex).toLowerCase()}.`,
    meta,
    tags,
    groupIds: [region],
    filterKeys: [ex.equipment],
    keywords,
  };
}

export function buildExerciseOptions(exercises: Exercise[]): PickerOption[] {
  return exercises.map(buildExerciseOption);
}

/**
 * Supersets are listed under every body region either exercise belongs to,
 * so "Row + Cable Fly" shows under both Back and Chest.
 */
export function buildSupersetOption(
  ss: SupersetPair,
  exerciseMap: Map<string, Exercise>
): PickerOption {
  const exA = exerciseMap.get(ss.exerciseAId);
  const exB = exerciseMap.get(ss.exerciseBId);
  const both = [exA, exB].filter((e): e is Exercise => Boolean(e));

  const groupIds = Array.from(new Set(both.map(getExerciseRegion)));
  const equipment = Array.from(new Set(both.map((e) => e.equipment)));

  const tags: PickerTag[] = equipment.map((eq) => ({
    label: EQUIPMENT_LABELS[eq],
    tone: 'neutral' as const,
  }));
  tags.push({ label: PAIRING_LABELS[ss.pairingType], tone: 'info' });
  tags.push(
    ss.buddyFriendly
      ? { label: 'Buddy friendly', tone: 'accent' }
      : { label: 'Best solo', tone: 'neutral' }
  );

  const keywords = [
    ss.name,
    ss.summary,
    ss.rationale,
    PAIRING_LABELS[ss.pairingType],
    ...both.flatMap((e) => [e.name, e.shortName, EQUIPMENT_LABELS[e.equipment]]),
    ...both.flatMap((e) => e.primaryMuscles.map((m) => SIMPLE_MUSCLE_LABELS[m])),
    ...groupIds.map((g) => BODY_REGION_GROUPS.find((x) => x.id === g)?.label),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return {
    id: ss.id,
    title: `${getExerciseShortName(exA)} + ${getExerciseShortName(exB)}`,
    subtitle: ss.summary ?? ss.rationale,
    meta: `Preset: ${ss.name}`,
    tags,
    groupIds: groupIds.length ? groupIds : ['CORE'],
    filterKeys: equipment,
    keywords,
  };
}

export function buildSupersetOptions(
  supersets: SupersetPair[],
  exercises: Exercise[]
): PickerOption[] {
  const map = new Map(exercises.map((e) => [e.id, e]));
  return supersets.map((ss) => buildSupersetOption(ss, map));
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Every whitespace-separated token must appear somewhere in the option.
 * Results keep their original order but title matches float to the top.
 */
export function searchOptions(
  options: PickerOption[],
  query: string
): PickerOption[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return options;

  const scored: Array<{ option: PickerOption; score: number; index: number }> = [];
  options.forEach((option, index) => {
    const title = option.title.toLowerCase();
    const haystack = `${title} ${option.keywords}`;
    if (!tokens.every((t) => haystack.includes(t))) return;
    let score = 0;
    for (const t of tokens) {
      if (title.startsWith(t)) score += 3;
      else if (title.split(/[\s+/()-]+/).some((w) => w.startsWith(t))) score += 2;
      else if (title.includes(t)) score += 1;
    }
    scored.push({ option, score, index });
  });

  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((s) => s.option);
}

export function filterOptionsByKey(
  options: PickerOption[],
  filterId: string | null
): PickerOption[] {
  if (!filterId) return options;
  return options.filter((o) => o.filterKeys.includes(filterId));
}

// ---------------------------------------------------------------------------
// Suggestions (pinned "Recommended" section)
// ---------------------------------------------------------------------------

export function getPrimaryLiftSuggestionIds(split: SessionSplitType): string[] {
  const { recommended, alternatives } = getPrimaryLiftCandidatesForSplit(split);
  return [recommended, ...alternatives.filter((id) => id !== recommended)];
}

export function getFinisherSuggestionIds(exercises: Exercise[]): string[] {
  return exercises.filter((e) => e.isFinisherCandidate).map((e) => e.id);
}
