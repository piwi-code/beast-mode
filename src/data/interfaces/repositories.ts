import {
  Exercise,
  PlanConfig,
  SupersetPair,
  WorkoutSession,
} from '../../domain/models/types';

export interface AppDataSnapshot {
  version: number;
  exportedAt: string;
  plan: PlanConfig;
  sessions: WorkoutSession[];
  customExercises?: Exercise[];
  customSupersets?: SupersetPair[];
}

export interface IWorkoutRepository {
  getExercises(): Promise<Exercise[]>;
  getCuratedSupersets(): Promise<SupersetPair[]>;
  getPlanConfig(): Promise<PlanConfig>;
  savePlanConfig(plan: PlanConfig): Promise<void>;
  getSessions(): Promise<WorkoutSession[]>;
  saveSession(session: WorkoutSession): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  exportSnapshot(): Promise<AppDataSnapshot>;
  importSnapshot(snapshot: AppDataSnapshot): Promise<void>;
  seedDemoHistoryIfEmpty(): Promise<void>;
}
