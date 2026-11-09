import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Dumbbell,
  Flame,
  History,
  Settings,
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
import { calculateSessionAxialLoad } from '../domain/engine/rulesEngine';
import { useWorkoutRepository } from '../data/context/RepositoryContext';
import { PlanView } from './views/PlanView';
import { CurrentSessionView } from './views/CurrentSessionView';
import { HistoryView } from './views/HistoryView';
import { CatalogView } from './views/CatalogView';
import { SettingsView } from './views/SettingsView';
import { AppDataSnapshot } from '../data/interfaces/repositories';

type ActivePage = 'PLAN' | 'CURRENT' | 'HISTORY' | 'CATALOG' | 'SETTINGS';

export const App: React.FC = () => {
  const repo = useWorkoutRepository();
  const [activePage, setActivePage] = useState<ActivePage>('PLAN');
  const [plan, setPlan] = useState<PlanConfig>(DEFAULT_PLAN_CONFIG);
  const [exercises, setExercises] = useState<Exercise[]>(SEED_EXERCISES);
  const [curatedSupersets, setCuratedSupersets] =
    useState<SupersetPair[]>(SEED_SUPERSETS);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
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
    setLoading(false);
  };

  useEffect(() => {
    reloadAll();
  }, []);

  const plannedSessions = sessions.filter((s) => s.status === 'PLANNED');
  const activeSession = sessions.find((s) => s.status === 'ACTIVE') ?? null;
  const completedSessions = sessions.filter((s) => s.status === 'COMPLETED');

  const handleSaveSession = async (session: WorkoutSession) => {
    const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
    const withAxial: WorkoutSession = {
      ...session,
      totalAxialLoad: calculateSessionAxialLoad(session, exerciseMap),
    };
    await repo.saveSession(withAxial);
    setSessions(await repo.getSessions());
  };

  const handleDeleteSession = async (sessionId: string) => {
    await repo.deleteSession(sessionId);
    setSessions(await repo.getSessions());
  };

  const handleActivatePlannedSession = async (session: WorkoutSession) => {
    // Demote any existing active session back to PLANNED so there is only 1 active session
    if (activeSession && activeSession.id !== session.id) {
      await repo.saveSession({ ...activeSession, status: 'PLANNED' });
    }
    await repo.saveSession({
      ...session,
      status: 'ACTIVE',
      date: new Date().toISOString(),
    });
    setSessions(await repo.getSessions());
    setActivePage('CURRENT');
  };

  const handleStartRecommendedSession = async (withBuddy?: boolean) => {
    if (activeSession) {
      await repo.saveSession({ ...activeSession, status: 'PLANNED' });
    }
    const suggestion = suggestNextSession(
      plan,
      completedSessions,
      new Date(),
      withBuddy
    );
    const activeDraft = buildDraftSessionFromSuggestion(
      suggestion,
      exercises,
      curatedSupersets,
      new Date().toISOString(),
      'ACTIVE'
    );
    await repo.saveSession(activeDraft);
    setSessions(await repo.getSessions());
    setActivePage('CURRENT');
  };

  const handleCompleteActiveSession = async (session: WorkoutSession) => {
    const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
    const completed: WorkoutSession = {
      ...session,
      status: 'COMPLETED',
      date: new Date().toISOString(),
      totalAxialLoad: calculateSessionAxialLoad(session, exerciseMap),
      primaryLiftSets: session.primaryLiftSets.map((s) => ({
        ...s,
        completed: true,
      })),
    };
    await repo.saveSession(completed);
    setSessions(await repo.getSessions());
    setActivePage('HISTORY');
  };

  const handleAbandonActiveSession = async (sessionId: string) => {
    await repo.deleteSession(sessionId);
    setSessions(await repo.getSessions());
    setActivePage('PLAN');
  };

  const handleUpdateSessionNotes = async (sessionId: string, notes: string) => {
    const target = sessions.find((s) => s.id === sessionId);
    if (!target) return;
    await repo.saveSession({ ...target, notes });
    setSessions(await repo.getSessions());
  };

  const handleSavePlan = async (updatedPlan: PlanConfig) => {
    await repo.savePlanConfig(updatedPlan);
    setPlan(updatedPlan);
  };

  const handleImportData = async (snapshot: AppDataSnapshot) => {
    await repo.importSnapshot(snapshot);
    await reloadAll();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200 flex items-center justify-center">
        <div className="text-sm font-medium text-zinc-400">
          Loading Beast Mode Workout Engine...
        </div>
      </div>
    );
  }

  const navItems = [
    {
      id: 'PLAN' as const,
      label: 'Plan',
      badge: plannedSessions.length > 0 ? String(plannedSessions.length) : undefined,
      icon: Calendar,
    },
    {
      id: 'CURRENT' as const,
      label: 'Current Session',
      badge: activeSession ? 'LIVE' : undefined,
      icon: Dumbbell,
    },
    {
      id: 'HISTORY' as const,
      label: 'History',
      icon: History,
    },
    {
      id: 'CATALOG' as const,
      label: 'Catalog',
      icon: BookOpen,
    },
    {
      id: 'SETTINGS' as const,
      label: 'Settings',
      icon: Settings,
    },
  ];

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
                {plan.name}
              </p>
            </div>
          </div>

          {/* Desktop 5-Page Navigation */}
          <nav className="hidden md:flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'bg-emerald-500 text-zinc-950'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                        active
                          ? 'bg-zinc-950 text-emerald-400'
                          : item.badge === 'LIVE'
                          ? 'bg-emerald-500 text-zinc-950'
                          : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">
        {activePage === 'PLAN' && (
          <PlanView
            plan={plan}
            exercises={exercises}
            curatedSupersets={curatedSupersets}
            plannedSessions={plannedSessions}
            completedSessions={completedSessions}
            onSaveSession={handleSaveSession}
            onDeleteSession={handleDeleteSession}
            onActivateSession={handleActivatePlannedSession}
          />
        )}

        {activePage === 'CURRENT' && (
          <CurrentSessionView
            plan={plan}
            exercises={exercises}
            curatedSupersets={curatedSupersets}
            activeSession={activeSession}
            plannedSessions={plannedSessions}
            completedSessions={completedSessions}
            onStartRecommendedSession={handleStartRecommendedSession}
            onActivatePlannedSession={handleActivatePlannedSession}
            onUpdateActiveSession={handleSaveSession}
            onCompleteActiveSession={handleCompleteActiveSession}
            onAbandonActiveSession={handleAbandonActiveSession}
          />
        )}

        {activePage === 'HISTORY' && (
          <HistoryView
            exercises={exercises}
            completedSessions={completedSessions}
            onUpdateSessionNotes={handleUpdateSessionNotes}
          />
        )}

        {activePage === 'CATALOG' && (
          <CatalogView
            exercises={exercises}
            curatedSupersets={curatedSupersets}
          />
        )}

        {activePage === 'SETTINGS' && (
          <SettingsView
            plan={plan}
            onSavePlan={handleSavePlan}
            onExportData={() => repo.exportSnapshot()}
            onImportData={handleImportData}
          />
        )}
      </main>

      {/* Mobile Bottom 5-Tab Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur px-1.5 py-1.5 grid grid-cols-5 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`relative flex flex-col items-center justify-center rounded-xl py-1.5 text-[10px] font-semibold transition ${
                active ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-400'
              }`}
            >
              <Icon className="h-4 w-4 mb-0.5" />
              <span className="truncate">{item.label}</span>
              {item.badge && (
                <span className="absolute top-1 right-2 rounded-full bg-emerald-500 px-1 text-[8px] font-black text-zinc-950">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
