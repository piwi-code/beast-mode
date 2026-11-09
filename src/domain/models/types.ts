export type MovementPattern =
  | 'KNEE_DOMINANT'
  | 'HIP_HINGE'
  | 'HORIZONTAL_PUSH'
  | 'HORIZONTAL_PULL'
  | 'VERTICAL_PUSH'
  | 'VERTICAL_PULL'
  | 'ISOLATION'
  | 'CORE_DECOMPRESSION'
  | 'LOCOMOTION';

export type MuscleGroup =
  | 'QUADS'
  | 'HAMSTRINGS'
  | 'GLUTES'
  | 'CALVES'
  | 'CHEST'
  | 'CHEST_UPPER'
  | 'LATS'
  | 'UPPER_BACK'
  | 'ANTERIOR_DELT'
  | 'LATERAL_DELT'
  | 'REAR_DELT'
  | 'TRICEPS'
  | 'BICEPS'
  | 'CORE';

export type EquipmentCategory =
  | 'BARBELL'
  | 'DUMBBELL'
  | 'MACHINE'
  | 'CABLE'
  | 'TURF'
  | 'BODYWEIGHT';

export interface Exercise {
  id: string;
  name: string;
  /** Plain-language name for compact UI (pickers, superset titles). */
  shortName?: string;
  /** One-sentence, jargon-free description of the movement. */
  summary?: string;
  pattern: MovementPattern;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  equipment: EquipmentCategory;
  axialLoadScore: 0 | 1 | 2 | 3;
  gripTax: 0 | 1 | 2;
  jointStressLevel: 1 | 2 | 3;
  runnerBenefitNote?: string;
  executionDirections?: string;
  formTips?: string[];
  isPrimaryAnchorCandidate?: boolean;
  isFinisherCandidate?: boolean;
  defaultSets?: number;
  defaultReps?: string;
  mainLiftCategory?: 'BENCH' | 'SQUAT' | 'DEADLIFT' | 'OTHER';
  /** Unsafe to take to failure without a spotter (e.g. any barbell bench press). */
  needsSpotter?: boolean;
  /** Safer exercise to use when no buddy/spotter is present. */
  soloAlternativeId?: string;
}

export type PairingType =
  | 'ANTAGONIST'
  | 'UPPER_LOWER'
  | 'COMPOUND_ISOLATION'
  | 'DECOMPRESSION';

export interface SupersetPair {
  id: string;
  name: string;
  /** One-sentence, jargon-free description of why the pairing works. */
  summary?: string;
  exerciseAId: string;
  exerciseBId: string;
  pairingType: PairingType;
  rationale: string;
  executionNotes?: string;
  buddyFriendly: boolean;
  recommendedSplits: SessionSplitType[];
}

export type PlanScheduleFamily = 'UPPER_LOWER' | 'PPL';

/** @deprecated Buddy availability is now per session (`WorkoutSession.withBuddy`) with weekday defaults (`PlanConfig.buddyDays`). Kept only to migrate old data. */
export type UpperLowerVariant = 'BUDDY_ONLY' | 'HYBRID_SOLO_BUDDY' | 'SOLO_ONLY';

/** Day of week, 0 = Sunday … 6 = Saturday (matches Date.getDay()). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type SessionsPerWeek = 2 | 3 | 4;

export type EquipmentPreferenceWeight = 1 | 2 | 3 | 4 | 5;

export interface PlanConfig {
  id: string;
  name: string;
  scheduleFamily: PlanScheduleFamily;
  /** Weekdays a training buddy (spotter) is usually available. New sessions on these days start with `withBuddy: true`. */
  buddyDays: Weekday[];
  /** @deprecated Legacy field, migrated into `buddyDays`. */
  upperLowerVariant?: UpperLowerVariant;
  sessionsPerWeek: SessionsPerWeek;
  targetSupersetsPerSession: 2 | 3 | 4;
  targetFinishersPerSession: 1 | 2;
  weeklySetCeilingOverride?: number;
  equipmentPreferences?: Record<EquipmentCategory, EquipmentPreferenceWeight>;
  updatedAt: string;
}

export type SessionSplitType =
  | 'PPL_PUSH'
  | 'PPL_PULL'
  | 'PPL_LEGS'
  | 'UPPER'
  | 'LOWER';

/** Split ids stored by earlier versions, where buddy/solo was baked into the split. */
export type LegacySessionSplitType =
  | 'BUDDY_UPPER'
  | 'BUDDY_LOWER'
  | 'SOLO_UPPER'
  | 'SOLO_LOWER';

export type SupersetExecutionMode = 'PAIRED' | 'SPLIT_STANDALONE';

export interface LoggedSet {
  setNumber: number;
  weightKg: number;
  reps: number;
  rpe?: number;
  completed: boolean;
}

export interface SessionSupersetBlock {
  id: string;
  supersetPairId?: string;
  customName?: string;
  exerciseAId: string;
  exerciseBId: string;
  executionMode: SupersetExecutionMode;
  targetSets: 2 | 3 | 4;
  setsA: LoggedSet[];
  setsB: LoggedSet[];
}

export interface SessionFinisherBlock {
  id: string;
  exerciseId: string;
  rounds: number;
  protocolNote: string;
  loadKg?: number;
  completedRounds: number;
}

export type SessionLifecycleStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED';

export interface WorkoutSession {
  id: string;
  date: string; // ISO string (YYYY-MM-DD or full ISO)
  splitType: SessionSplitType;
  /** A buddy/spotter is training with you this session (enables spotted lifts, shared stations). */
  withBuddy?: boolean;
  primaryLiftId: string;
  primaryLiftSets: LoggedSet[];
  supersets: SessionSupersetBlock[];
  finishers: SessionFinisherBlock[];
  totalAxialLoad: number;
  notes?: string;
  includeInProjectedLoad?: boolean;
  status: SessionLifecycleStatus;
}

/**
 * 4-Color Exercise Evaluation Status:
 * - OPTIMAL (Green): Meets all session & history rules
 * - WRONG_STYLE (Blue info): Exercise movement pattern doesn't match the session split
 * - PROJECTED_OVERWORK (Orange warning): Exceeds 48h recovery or 7d volume when combined with history + prior planned sessions
 * - INTRA_SESSION_OVERWORK (Red error): Overworked inside the current session (axial > 4, competing superset, or primary overlap)
 * - NEEDS_SPOTTER (Red safety): Exercise needs a spotter but the session has no buddy
 */
export type ExerciseSlotHealth =
  | 'OPTIMAL'
  | 'NEEDS_SPOTTER'
  | 'WRONG_STYLE'
  | 'PROJECTED_OVERWORK'
  | 'INTRA_SESSION_OVERWORK';

export interface ExerciseSlotEvaluation {
  health: ExerciseSlotHealth;
  headline: string;
  reasons: string[];
  suggestedReplacementId?: string;
}

export type ValidationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface SafeguardAlert {
  id: string;
  rule:
    | 'AXIAL_LOAD_CEILING'
    | 'COMPETING_SUPERSET'
    | 'INTRA_SESSION_OVERLAP'
    | 'ROLLING_48H_RECOVERY'
    | 'WEEKLY_VOLUME_IMBALANCE'
    | 'WRONG_SPLIT_STYLE'
    | 'SPOTTER_REQUIRED';
  severity: ValidationSeverity;
  title: string;
  message: string;
  affectedMuscles?: MuscleGroup[];
  recommendation?: string;
}

export interface MuscleVolumeSummary {
  muscle: MuscleGroup;
  sets48h: number;
  sets7dCurrent: number;
  sets7dProjected: number;
  sets14dProjected: number;
  plannedFutureSets: number;
  statusCurrent: 'UNDER' | 'OPTIMAL' | 'HIGH' | 'OVERTRAINING_RISK';
  statusProjected: 'UNDER' | 'OPTIMAL' | 'HIGH' | 'OVERTRAINING_RISK';
  recovery48hFlag: boolean;
}
