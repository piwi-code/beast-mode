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
import {
  normalizePlanConfig,
  normalizeSession,
} from '../../domain/engine/splits';
import { hasLoggedWork } from '../../domain/engine/loads';
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
    if (existing) {
      const normalized = normalizePlanConfig(existing);
      if (normalized !== existing) await this.db.plans.put(normalized);
      return normalized;
    }
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
    const list = (await this.db.sessions.toArray()).map(normalizeSession);
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
          await this.db.plans.put(
            normalizePlanConfig({ ...snapshot.plan, id: 'default_plan' })
          );
        }
        if (Array.isArray(snapshot.sessions)) {
          await this.db.sessions.clear();
          await this.db.sessions.bulkPut(snapshot.sessions.map(normalizeSession));
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

  /**
   * Earlier versions seeded sample sessions (ids starting "demo_") so the app
   * was not empty on first run. They are no longer created; this removes any
   * that are left. Sample planned sessions the user actually started or
   * logged are kept, since they are real workouts now.
   */
  async removeDemoData(): Promise<number> {
    const all = await this.db.sessions.toArray();
    const stale = all.filter(
      (s) =>
        s.id.startsWith('demo_session_') ||
        (s.id.startsWith('demo_planned_') &&
          s.status === 'PLANNED' &&
          !hasLoggedWork(s))
    );
    await this.db.sessions.bulkDelete(stale.map((s) => s.id));
    return stale.length;
  }
}
