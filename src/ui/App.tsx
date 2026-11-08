import React, { useEffect, useState } from 'react';
import {
  Activity,
  Dumbbell,
  Flame,
  Settings,
  TrendingUp,
} from 'lucide-react';
import {
  Exercise,
  PlanConfig,
  SupersetPair,
  WorkoutSession,
} from '../domain/models/types';
import {
  DEFAULT_PLAN_CONFIG,
  SEED_EXERCISES,
  SEED_SUPERSETS,
} from '../domain/seed/catalog';
import {
  buildDraftSessionFromSuggestion,
  suggestNextSession,
} from '../domain/engine/sequencer';
import { useWorkoutRepository } from '../data/context/RepositoryContext';
import { SessionBuilderView } from './views/SessionBuilderView';
import { LiftTrackerView } from './views/LiftTrackerView';
import { VolumeAnalyticsView } from './views/VolumeAnalyticsView';
import { PlanSettingsView } from './views/PlanSettingsView';
import { AppDataSnapshot } from '../data/interfaces/repositories';

type ActiveTab = 'BUILDER' | 'LIFTS' | 'VOLUME' | 'PLAN';

export const App: React.FC = () => {
  const repo = useWorkoutRepository();
  const [activeTab, setActiveTab] = useState<ActiveTab>('BUILDER');
  const [plan, setPlan] = useState<PlanConfig>(DEFAULT_PLAN_CONFIG);
  const [exercises, setExercises] = useState<Exercise[]>(SEED_EXERCISES);
  const [curatedSupersets, setCuratedSupersets] =
    useState<SupersetPair[]>(SEED_SUPERSETS);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [activeDraft, setActiveDraft] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);

  const reloadAll = async () => {
    await repo.seedDemoHistoryIfEmpty();
    const [loadedPlan, loadedEx, loadedSS, loadedSessions] = await Promise.all([
      repo.getPlanConfig(),
      repo.getExercises(),
      repo.getCuratedSupersets(),
      repo.getSessions(),
    ]);
    setPlan(loadedPlan);
    setExercises(loadedEx);
    setCuratedSupersets(loadedSS);
    setSessions(loadedSessions);

    const nextSuggestion = suggestNextSession(loadedPlan, loadedSessions);
    const draft = buildDraftSessionFromSuggestion(
      nextSuggestion,
      loadedEx,
      loadedSS
    );
    setActiveDraft(draft);
    setLoading(false);
  };

  useEffect(() => {
    reloadAll();
  }, []);

  const handleSaveSession = async (completedSession: WorkoutSession) => {
    await repo.saveSession(completedSession);
    const updatedSessions = await repo.getSessions();
    setSessions(updatedSessions);

    // Queue next suggested session automatically
    const nextSuggestion = suggestNextSession(plan, updatedSessions);
    const nextDraft = buildDraftSessionFromSuggestion(
      nextSuggestion,
      exercises,
      curatedSupersets
    );
    setActiveDraft(nextDraft);
  };

  const handleDeleteSession = async (sessionId: string) => {
    await repo.deleteSession(sessionId);
    const updatedSessions = await repo.getSessions();
    setSessions(updatedSessions);
  };

  const handleSavePlan = async (updatedPlan: PlanConfig) => {
    await repo.savePlanConfig(updatedPlan);
    setPlan(updatedPlan);
    const nextSuggestion = suggestNextSession(updatedPlan, sessions);
    const nextDraft = buildDraftSessionFromSuggestion(
      nextSuggestion,
      exercises,
      curatedSupersets
    );
    setActiveDraft(nextDraft);
  };

  const handleImportData = async (snapshot: AppDataSnapshot) => {
    await repo.importSnapshot(snapshot);
    await reloadAll();
  };

  if (loading || !activeDraft) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200 flex items-center justify-center">
        <div className="text-sm font-medium text-zinc-400">
          Loading Beast Mode Workout Engine...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-zinc-950 font-black">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-white leading-none">
                BEAST MODE
              </h1>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {plan.scheduleFamily === 'PPL' ? 'PPL' : 'Upper/Lower'} •{' '}
                {plan.sessionsPerWeek}x/wk • Local PWA
              </p>
            </div>
          </div>

          {/* Desktop Navigation Pills */}
          <nav className="hidden sm:flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 p-1">
            {[
              { id: 'BUILDER' as const, label: 'Session Planner', icon: Dumbbell },
              { id: 'LIFTS' as const, label: 'Main Lifts & Log', icon: TrendingUp },
              { id: 'VOLUME' as const, label: 'Volume & Recovery', icon: Activity },
              { id: 'PLAN' as const, label: 'Plan & Backup', icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'bg-emerald-500 text-zinc-950'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">
        {activeTab === 'BUILDER' && (
          <SessionBuilderView
            plan={plan}
            exercises={exercises}
            curatedSupersets={curatedSupersets}
            sessions={sessions}
            activeDraft={activeDraft}
            onUpdateDraft={setActiveDraft}
            onSaveSession={handleSaveSession}
          />
        )}

        {activeTab === 'LIFTS' && (
          <LiftTrackerView
            exercises={exercises}
            sessions={sessions}
            onDeleteSession={handleDeleteSession}
          />
        )}

        {activeTab === 'VOLUME' && (
          <VolumeAnalyticsView
            plan={plan}
            exercises={exercises}
            sessions={sessions}
            activeDraft={activeDraft}
          />
        )}

        {activeTab === 'PLAN' && (
          <PlanSettingsView
            plan={plan}
            onSavePlan={handleSavePlan}
            onExportData={() => repo.exportSnapshot()}
            onImportData={handleImportData}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur px-2 py-1.5 grid grid-cols-4 gap-1">
        {[
          { id: 'BUILDER' as const, label: 'Session', icon: Dumbbell },
          { id: 'LIFTS' as const, label: 'Main Lifts', icon: TrendingUp },
          { id: 'VOLUME' as const, label: 'Volume', icon: Activity },
          { id: 'PLAN' as const, label: 'Plan', icon: Settings },
        ].map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center rounded-xl py-1.5 text-[11px] font-semibold transition ${
                active ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-400'
              }`}
            >
              <Icon className="h-4 w-4 mb-0.5" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
