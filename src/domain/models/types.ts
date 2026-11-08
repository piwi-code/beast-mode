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
  pattern: MovementPattern;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  equipment: EquipmentCategory;
  axialLoadScore: 0 | 1 | 2 | 3;
  gripTax: 0 | 1 | 2;
  jointStressLevel: 1 | 2 | 3;
  runnerBenefitNote?: string;
  isPrimaryAnchorCandidate?: boolean;
  isFinisherCandidate?: boolean;
  defaultSets?: number;
  defaultReps?: string;
}

export type PairingType =
  | 'ANTAGONIST'
  | 'UPPER_LOWER'
  | 'COMPOUND_ISOLATION'
  | 'DECOMPRESSION';

export interface SupersetPair {
  id: string;
  name: string;
  exerciseAId: string;
  exerciseBId: string;
  pairingType: PairingType;
  rationale: string;
  buddyFriendly: boolean;
  recommendedSplits: SessionSplitType[];
}

export type PlanScheduleFamily = 'UPPER_LOWER' | 'PPL';

export type UpperLowerVariant = 'HYBRID_SOLO_BUDDY' | 'BUDDY_ONLY' | 'SOLO_ONLY';

export type SessionsPerWeek = 2 | 3 | 4;

export interface PlanConfig {
  id: string;
  name: string;
  scheduleFamily: PlanScheduleFamily;
  upperLowerVariant: UpperLowerVariant;
  sessionsPerWeek: SessionsPerWeek;
  targetSupersetsPerSession: 2 | 3 | 4;
  targetFinishersPerSession: 1 | 2;
  updatedAt: string;
}

export type SessionSplitType =
  | 'PPL_PUSH'
  | 'PPL_PULL'
  | 'PPL_LEGS'
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
  supersetPairId?: string; // Optional if custom-built on the day
  customName?: string;
  exerciseAId: string;
  exerciseBId: string;
  executionMode: SupersetExecutionMode; // PAIRED (A1/A2) or SPLIT_STANDALONE (A then B)
  targetSets: number;
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

export interface WorkoutSession {
  id: string;
  date: string; // ISO string
  splitType: SessionSplitType;
  primaryLiftId: string;
  primaryLiftSets: LoggedSet[];
  supersets: SessionSupersetBlock[];
  finishers: SessionFinisherBlock[];
  totalAxialLoad: number;
  notes?: string;
  status: 'PLANNED' | 'COMPLETED';
}

export type ValidationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface SafeguardAlert {
  id: string;
  rule:
    | 'AXIAL_LOAD_CEILING'
    | 'COMPETING_SUPERSET'
    | 'INTRA_SESSION_OVERLAP'
    | 'ROLLING_48H_RECOVERY'
    | 'WEEKLY_VOLUME_IMBALANCE';
  severity: ValidationSeverity;
  title: string;
  message: string;
  affectedMuscles?: MuscleGroup[];
  recommendation?: string;
}

export interface MuscleVolumeSummary {
  muscle: MuscleGroup;
  sets48h: number;
  sets7d: number;
  sets14d: number;
  plannedSessionSets: number;
  status7d: 'UNDER' | 'OPTIMAL' | 'HIGH' | 'OVERTRAINING_RISK';
  recovery48hFlag: boolean;
}
