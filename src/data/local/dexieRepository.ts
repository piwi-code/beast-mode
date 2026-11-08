import Dexie, { Table } from 'dexie';
import {
  Exercise,
  PlanConfig,
  SupersetPair,
  WorkoutSession,
} from '../../domain/models/types';
import {
  DEFAULT_PLAN_CONFIG,
  SEED_EXERCISES,
  SEED_SUPERSETS,
} from '../../domain/seed/catalog';
import { AppDataSnapshot, IWorkoutRepository } from '../interfaces/repositories';

class BeastModeDexieDB extends Dexie {
  plans!: Table<PlanConfig, string>;
  sessions!: Table<WorkoutSession, string>;
  customExercises!: Table<Exercise, string>;
  customSupersets!: Table<SupersetPair, string>;

  constructor() {
    super('BeastModeWorkoutDB');
    this.version(1).stores({
      plans: 'id',
      sessions: 'id, date, splitType, primaryLiftId, status',
      customExercises: 'id, pattern, equipment',
      customSupersets: 'id, pairingType',
    });
  }
}

export class DexieWorkoutRepository implements IWorkoutRepository {
  private db: BeastModeDexieDB;

  constructor() {
    this.db = new BeastModeDexieDB();
  }

  async getExercises(): Promise<Exercise[]> {
    const custom = await this.db.customExercises.toArray();
    const map = new Map<string, Exercise>();
    for (const ex of SEED_EXERCISES) map.set(ex.id, ex);
    for (const ex of custom) map.set(ex.id, ex);
    return Array.from(map.values());
  }

  async getCuratedSupersets(): Promise<SupersetPair[]> {
    const custom = await this.db.customSupersets.toArray();
    const map = new Map<string, SupersetPair>();
    for (const ss of SEED_SUPERSETS) map.set(ss.id, ss);
    for (const ss of custom) map.set(ss.id, ss);
    return Array.from(map.values());
  }

  async getPlanConfig(): Promise<PlanConfig> {
    const existing = await this.db.plans.get('default_plan');
    if (existing) return existing;
    await this.db.plans.put(DEFAULT_PLAN_CONFIG);
    return DEFAULT_PLAN_CONFIG;
  }

  async savePlanConfig(plan: PlanConfig): Promise<void> {
    await this.db.plans.put({
      ...plan,
      id: 'default_plan',
      updatedAt: new Date().toISOString(),
    });
  }

  async getSessions(): Promise<WorkoutSession[]> {
    const list = await this.db.sessions.toArray();
    return list.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  async saveSession(session: WorkoutSession): Promise<void> {
    await this.db.sessions.put(session);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.db.sessions.delete(sessionId);
  }

  async exportSnapshot(): Promise<AppDataSnapshot> {
    const [plan, sessions, customExercises, customSupersets] = await Promise.all([
      this.getPlanConfig(),
      this.getSessions(),
      this.db.customExercises.toArray(),
      this.db.customSupersets.toArray(),
    ]);

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      plan,
      sessions,
      customExercises,
      customSupersets,
    };
  }

  async importSnapshot(snapshot: AppDataSnapshot): Promise<void> {
    await this.db.transaction(
      'rw',
      this.db.plans,
      this.db.sessions,
      this.db.customExercises,
      this.db.customSupersets,
      async () => {
        if (snapshot.plan) {
          await this.db.plans.put({ ...snapshot.plan, id: 'default_plan' });
        }
        if (Array.isArray(snapshot.sessions)) {
          await this.db.sessions.clear();
          await this.db.sessions.bulkPut(snapshot.sessions);
        }
        if (Array.isArray(snapshot.customExercises)) {
          await this.db.customExercises.clear();
          await this.db.customExercises.bulkPut(snapshot.customExercises);
        }
        if (Array.isArray(snapshot.customSupersets)) {
          await this.db.customSupersets.clear();
          await this.db.customSupersets.bulkPut(snapshot.customSupersets);
        }
      }
    );
  }

  async seedDemoHistoryIfEmpty(): Promise<void> {
    const count = await this.db.sessions.count();
    if (count > 0) return;

    const now = Date.now();
    const hourMs = 3600 * 1000;

    const demoSessions: WorkoutSession[] = [
      {
        id: 'demo_session_1',
        date: new Date(now - 9 * 24 * hourMs).toISOString(),
        splitType: 'BUDDY_UPPER',
        primaryLiftId: 'bb_flat_bench',
        primaryLiftSets: [
          { setNumber: 1, weightKg: 80, reps: 8, rpe: 7.5, completed: true },
          { setNumber: 2, weightKg: 82.5, reps: 7, rpe: 8, completed: true },
          { setNumber: 3, weightKg: 85, reps: 6, rpe: 8.5, completed: true },
          { setNumber: 4, weightKg: 85, reps: 6, rpe: 9, completed: true },
        ],
        supersets: [
          {
            id: 'demo_ss_1a',
            supersetPairId: 'ss_row_cable_fly',
            customName: 'Antagonist Upper Back & Upper Chest',
            exerciseAId: 'machine_row_narrow',
            exerciseBId: 'cable_fly_low_high',
            executionMode: 'PAIRED',
            targetSets: 3,
            setsA: [
              { setNumber: 1, weightKg: 65, reps: 10, completed: true },
              { setNumber: 2, weightKg: 65, reps: 10, completed: true },
              { setNumber: 3, weightKg: 65, reps: 10, completed: true },
            ],
            setsB: [
              { setNumber: 1, weightKg: 15, reps: 12, completed: true },
              { setNumber: 2, weightKg: 15, reps: 12, completed: true },
              { setNumber: 3, weightKg: 15, reps: 12, completed: true },
            ],
          },
          {
            id: 'demo_ss_1b',
            supersetPairId: 'ss_shared_bench_arms',
            customName: 'Shared Bench Antagonist Arm Pump',
            exerciseAId: 'ez_skull_crusher',
            exerciseBId: 'seated_isolated_curl',
            executionMode: 'PAIRED',
            targetSets: 3,
            setsA: [
              { setNumber: 1, weightKg: 30, reps: 10, completed: true },
              { setNumber: 2, weightKg: 30, reps: 10, completed: true },
              { setNumber: 3, weightKg: 30, reps: 10, completed: true },
            ],
            setsB: [
              { setNumber: 1, weightKg: 14, reps: 10, completed: true },
              { setNumber: 2, weightKg: 14, reps: 10, completed: true },
              { setNumber: 3, weightKg: 14, reps: 10, completed: true },
            ],
          },
        ],
        finishers: [
          {
            id: 'demo_fin_1',
            exerciseId: 'rope_face_pull',
            rounds: 3,
            protocolNote: '3x15 external rotation focus',
            loadKg: 20,
            completedRounds: 3,
          },
        ],
        totalAxialLoad: 0,
        status: 'COMPLETED',
        notes: 'Partner upper session — smooth station swaps.',
      },
      {
        id: 'demo_session_2',
        date: new Date(now - 6 * 24 * hourMs).toISOString(),
        splitType: 'BUDDY_LOWER',
        primaryLiftId: 'bb_back_squat',
        primaryLiftSets: [
          { setNumber: 1, weightKg: 105, reps: 6, rpe: 7.5, completed: true },
          { setNumber: 2, weightKg: 110, reps: 6, rpe: 8, completed: true },
          { setNumber: 3, weightKg: 112.5, reps: 5, rpe: 8.5, completed: true },
          { setNumber: 4, weightKg: 112.5, reps: 5, rpe: 9, completed: true },
        ],
        supersets: [
          {
            id: 'demo_ss_2a',
            supersetPairId: 'ss_hamstring_calf',
            customName: 'Knee-Safe Posterior Armor',
            exerciseAId: 'seated_hamstring_curl',
            exerciseBId: 'machine_calf_raise_standing',
            executionMode: 'PAIRED',
            targetSets: 3,
            setsA: [
              { setNumber: 1, weightKg: 55, reps: 12, completed: true },
              { setNumber: 2, weightKg: 55, reps: 12, completed: true },
              { setNumber: 3, weightKg: 55, reps: 12, completed: true },
            ],
            setsB: [
              { setNumber: 1, weightKg: 70, reps: 15, completed: true },
              { setNumber: 2, weightKg: 70, reps: 15, completed: true },
              { setNumber: 3, weightKg: 70, reps: 15, completed: true },
            ],
          },
          {
            id: 'demo_ss_2b',
            supersetPairId: 'ss_lat_core_decompression',
            customName: 'Lat Width & Pelvic Traction',
            exerciseAId: 'lat_pulldown_neutral',
            exerciseBId: 'captains_chair_knee_raise',
            executionMode: 'PAIRED',
            targetSets: 3,
            setsA: [
              { setNumber: 1, weightKg: 60, reps: 10, completed: true },
              { setNumber: 2, weightKg: 60, reps: 10, completed: true },
              { setNumber: 3, weightKg: 60, reps: 10, completed: true },
            ],
            setsB: [
              { setNumber: 1, weightKg: 0, reps: 15, completed: true },
              { setNumber: 2, weightKg: 0, reps: 15, completed: true },
              { setNumber: 3, weightKg: 0, reps: 15, completed: true },
            ],
          },
        ],
        finishers: [
          {
            id: 'demo_fin_2',
            exerciseId: 'turf_sled_push_pull',
            rounds: 3,
            protocolNote: '15–20m Forward Push + 15–20m Backward Drag (You-Go-I-Go)',
            loadKg: 30,
            completedRounds: 3,
          },
        ],
        totalAxialLoad: 4,
        status: 'COMPLETED',
        notes: 'Lumbar felt great with Lat Pulldown + Captain Chair decompression.',
      },
      {
        id: 'demo_session_3',
        date: new Date(now - 38 * hourMs).toISOString(),
        splitType: 'SOLO_UPPER',
        primaryLiftId: 'bb_flat_bench',
        primaryLiftSets: [
          { setNumber: 1, weightKg: 82.5, reps: 7, rpe: 8, completed: true },
          { setNumber: 2, weightKg: 85, reps: 6, rpe: 8.5, completed: true },
          { setNumber: 3, weightKg: 87.5, reps: 5, rpe: 9, completed: true },
          { setNumber: 4, weightKg: 85, reps: 6, rpe: 9, completed: true },
        ],
        supersets: [
          {
            id: 'demo_ss_3a',
            supersetPairId: 'ss_row_cable_fly',
            customName: 'Antagonist Upper Back & Upper Chest',
            exerciseAId: 'machine_row_narrow',
            exerciseBId: 'cable_fly_low_high',
            executionMode: 'SPLIT_STANDALONE',
            targetSets: 3,
            setsA: [
              { setNumber: 1, weightKg: 67.5, reps: 10, completed: true },
              { setNumber: 2, weightKg: 67.5, reps: 10, completed: true },
              { setNumber: 3, weightKg: 67.5, reps: 10, completed: true },
            ],
            setsB: [
              { setNumber: 1, weightKg: 17.5, reps: 12, completed: true },
              { setNumber: 2, weightKg: 17.5, reps: 12, completed: true },
              { setNumber: 3, weightKg: 17.5, reps: 12, completed: true },
            ],
          },
          {
            id: 'demo_ss_3b',
            supersetPairId: 'ss_cable_delt_tricep',
            customName: 'Single-Tower Cable Delt & Tricep Lockout',
            exerciseAId: 'cable_lateral_raise',
            exerciseBId: 'tricep_rope_pushdown',
            executionMode: 'PAIRED',
            targetSets: 3,
            setsA: [
              { setNumber: 1, weightKg: 10, reps: 14, completed: true },
              { setNumber: 2, weightKg: 10, reps: 14, completed: true },
              { setNumber: 3, weightKg: 10, reps: 14, completed: true },
            ],
            setsB: [
              { setNumber: 1, weightKg: 25, reps: 12, completed: true },
              { setNumber: 2, weightKg: 25, reps: 12, completed: true },
              { setNumber: 3, weightKg: 25, reps: 12, completed: true },
            ],
          },
        ],
        finishers: [
          {
            id: 'demo_fin_3',
            exerciseId: 'rope_face_pull',
            rounds: 3,
            protocolNote: '3x15 external rotation focus',
            loadKg: 22.5,
            completedRounds: 3,
          },
        ],
        totalAxialLoad: 0,
        status: 'COMPLETED',
        notes: 'Split Row/Fly into standalone sets because cable tower was busy.',
      },
    ];

    await this.db.sessions.bulkPut(demoSessions);
  }
}
