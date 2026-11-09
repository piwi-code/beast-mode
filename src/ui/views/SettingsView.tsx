import React, { useState } from 'react';
import {
  CheckCircle2,
  Database,
  Download,
  Settings,
  Sliders,
  Upload,
  Users,
} from 'lucide-react';
import {
  EquipmentCategory,
  EquipmentPreferenceWeight,
  PlanConfig,
  PlanScheduleFamily,
  SessionsPerWeek,
  Weekday,
} from '../../domain/models/types';
import {
  WEEKDAYS_MON_FIRST,
  WEEKDAY_SHORT_LABELS,
} from '../../domain/engine/splits';
import { AppDataSnapshot } from '../../data/interfaces/repositories';

interface SettingsViewProps {
  plan: PlanConfig;
  onSavePlan: (updated: PlanConfig) => Promise<void>;
  onExportData: () => Promise<AppDataSnapshot>;
  onImportData: (snapshot: AppDataSnapshot) => Promise<void>;
}

const EQUIPMENT_LABELS: Record<EquipmentCategory, string> = {
  BARBELL: 'Fixed / Olympic Barbells',
  DUMBBELL: 'Free Weights / Dumbbells',
  CABLE: 'Cable Towers & Pulleys',
  MACHINE: 'Pin / Plate-Loaded Machines',
  TURF: 'Turf / Sled / Kettlebell Carries',
  BODYWEIGHT: 'Bodyweight / Decompression Stations',
};

export const SettingsView: React.FC<SettingsViewProps> = ({
  plan,
  onSavePlan,
  onExportData,
  onImportData,
}) => {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const buildPlanName = (
    family: PlanScheduleFamily,
    sessionsPerWeek: SessionsPerWeek
  ) =>
    family === 'PPL'
      ? `Push / Pull / Legs (${sessionsPerWeek}-Session Rolling Split)`
      : `Upper / Lower (${sessionsPerWeek}-Session Split)`;

  const handleFamilyChange = async (family: PlanScheduleFamily) => {
    await onSavePlan({
      ...plan,
      scheduleFamily: family,
      name: buildPlanName(family, plan.sessionsPerWeek),
    });
    setStatusMessage(`Updated primary plan to ${family}`);
  };

  const buddyDays = plan.buddyDays ?? [];
  const handleToggleBuddyDay = async (day: Weekday) => {
    const next = buddyDays.includes(day)
      ? buddyDays.filter((d) => d !== day)
      : [...buddyDays, day].sort();
    await onSavePlan({ ...plan, buddyDays: next });
    setStatusMessage(
      next.length
        ? `Buddy days: ${WEEKDAYS_MON_FIRST.filter((d) => next.includes(d))
            .map((d) => WEEKDAY_SHORT_LABELS[d])
            .join(', ')}`
        : 'No buddy days — sessions default to solo (spotter-free lifts)'
    );
  };

  const handleSessionsPerWeekChange = async (count: SessionsPerWeek) => {
    await onSavePlan({
      ...plan,
      sessionsPerWeek: count,
      name: buildPlanName(plan.scheduleFamily, count),
    });
    setStatusMessage(`Updated weekly session target to ${count} sessions/week`);
  };

  const handleEquipmentWeightChange = async (
    eq: EquipmentCategory,
    weight: EquipmentPreferenceWeight
  ) => {
    const nextPrefs: Record<EquipmentCategory, EquipmentPreferenceWeight> = {
      BARBELL: 5,
      DUMBBELL: 4,
      CABLE: 4,
      MACHINE: 4,
      TURF: 4,
      BODYWEIGHT: 3,
      ...(plan.equipmentPreferences ?? {}),
      [eq]: weight,
    };
    await onSavePlan({
      ...plan,
      equipmentPreferences: nextPrefs,
    });
    setStatusMessage(
      `Updated ${EQUIPMENT_LABELS[eq]} preference weighting to ${weight}/5`
    );
  };

  const handleExportJson = async () => {
    const snap = await onExportData();
    const blob = new Blob([JSON.stringify(snap, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beast-mode-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage('Exported local IndexedDB data to JSON file.');
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as AppDataSnapshot;
      await onImportData(parsed);
      setStatusMessage('Imported workout snapshot into local IndexedDB!');
    } catch {
      setStatusMessage('Invalid JSON backup file.');
    }
  };

  const currentCeiling =
    plan.weeklySetCeilingOverride ??
    (plan.sessionsPerWeek === 2 ? 10 : plan.sessionsPerWeek === 3 ? 13 : 15);

  return (
    <div className="space-y-6 pb-20">
      {statusMessage && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/50 p-3.5 text-xs sm:text-sm text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* 1. PRIMARY TRAINING PLAN & WEEKLY SESSION TARGET */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5 space-y-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <Settings className="h-4 w-4" />
            Primary Training Plan &amp; Schedule
          </div>
          <h2 className="text-lg font-bold text-white mt-0.5">{plan.name}</h2>
          <p className="text-xs text-zinc-400">
            Once configured here, the Plan and Current Session pages automatically sequence your workouts around this program.
          </p>
        </div>

        {/* Split Family */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            1. Program Split Architecture
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => handleFamilyChange('UPPER_LOWER')}
              className={`rounded-xl border p-3.5 text-left transition ${
                plan.scheduleFamily === 'UPPER_LOWER'
                  ? 'border-emerald-500 bg-emerald-500/15 text-white'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className="text-sm font-bold text-white">
                Upper / Lower Split
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Alternates Upper and Lower days. 4 sessions/week = Upper/Lower twice weekly.
              </p>
            </button>

            <button
              onClick={() => handleFamilyChange('PPL')}
              className={`rounded-xl border p-3.5 text-left transition ${
                plan.scheduleFamily === 'PPL'
                  ? 'border-emerald-500 bg-emerald-500/15 text-white'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className="text-sm font-bold text-white">
                Push / Pull / Legs (PPL Rolling Split)
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Cycles Push → Pull → Legs continuously across 2, 3, or 4 sessions per week.
              </p>
            </button>
          </div>
        </div>

        {/* Buddy availability (applies to every split) */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <Users className="h-3.5 w-3.5" /> Buddy Days (Spotter Available)
          </label>
          <p className="text-xs text-zinc-400">
            New sessions on these days start as <strong className="text-zinc-200">Buddy</strong>{' '}
            sessions (spotted barbell bench, partner station swaps). Other days start as{' '}
            <strong className="text-zinc-200">Solo</strong> with safer, spotter-free lifts. You can
            still tick Buddy on or off for any individual session.
          </p>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS_MON_FIRST.map((d) => {
              const on = buddyDays.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => handleToggleBuddyDay(d)}
                  className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border text-xs font-bold transition ${
                    on
                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-200'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  {WEEKDAY_SHORT_LABELS[d]}
                  {on ? (
                    <Users className="h-3.5 w-3.5" />
                  ) : (
                    <span className="text-[10px] font-semibold text-zinc-600">Solo</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Weekly Session Count */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            2. Sessions Per Week Target
          </label>
          <div className="grid grid-cols-3 gap-3">
            {([2, 3, 4] as SessionsPerWeek[]).map((count) => (
              <button
                key={count}
                onClick={() => handleSessionsPerWeekChange(count)}
                className={`rounded-xl border p-3 text-center transition ${
                  plan.sessionsPerWeek === count
                    ? 'border-emerald-500 bg-emerald-500 text-zinc-950 font-bold'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <div className="text-base font-extrabold">
                  {count} Sessions / Wk
                </div>
                <div
                  className={`text-[11px] mt-0.5 ${
                    plan.sessionsPerWeek === count
                      ? 'text-zinc-900'
                      : 'text-zinc-400'
                  }`}
                >
                  {count === 4
                    ? 'Upper/Lower 2x per week'
                    : count === 3
                    ? 'Classic 3-day cadence'
                    : 'Minimalist 2-day cadence'}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. USAGE THRESHOLDS & EQUIPMENT PREFERENCE WEIGHTINGS */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5 space-y-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <Sliders className="h-4 w-4" />
            Usage Thresholds &amp; Equipment Preference Weightings
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Fine-tune your weekly muscle volume ceiling and equipment priorities used by the Quick Switch &amp; auto-recommendation engine.
          </p>
        </div>

        {/* Weekly Volume Ceiling Slider */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white">
              Weekly Muscle Region Set Ceiling (Overwork Warning Threshold)
            </span>
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-300">
              {currentCeiling} sets / 7 days
            </span>
          </div>
          <input
            type="range"
            min={8}
            max={22}
            value={currentCeiling}
            onChange={(e) =>
              onSavePlan({
                ...plan,
                weeklySetCeilingOverride: Number(e.target.value),
              })
            }
            className="w-full accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>Conservative (8 sets/wk)</span>
            <span>Standard (14–15 sets/wk)</span>
            <span>High Volume (22 sets/wk)</span>
          </div>
        </div>

        {/* Equipment Priority Weights */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-zinc-300">
            Equipment Preference Weightings (1 = Avoid, 5 = High Priority in Quick-Switch Suggestions)
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {(Object.keys(EQUIPMENT_LABELS) as EquipmentCategory[]).map((eq) => {
              const weight = plan.equipmentPreferences?.[eq] ?? 4;
              return (
                <div
                  key={eq}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 flex items-center justify-between gap-2"
                >
                  <span className="text-xs font-semibold text-zinc-200">
                    {EQUIPMENT_LABELS[eq]}
                  </span>
                  <div className="flex items-center gap-1">
                    {([1, 2, 3, 4, 5] as EquipmentPreferenceWeight[]).map(
                      (w) => (
                        <button
                          key={w}
                          onClick={() => handleEquipmentWeightChange(eq, w)}
                          className={`h-6 w-6 rounded text-xs font-bold transition ${
                            weight === w
                              ? 'bg-emerald-500 text-zinc-950'
                              : 'bg-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {w}
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. LOCAL DATABASE BACKUP & EXPORT */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
          <Database className="h-4 w-4" />
          Local IndexedDB Storage &amp; Cross-Device Backup
        </div>
        <p className="text-xs text-zinc-400">
          Export your planned sessions, completed workout logs, and settings to JSON or restore from a backup file.
        </p>

        <div className="flex flex-wrap gap-3 pt-1">
          <button
            onClick={handleExportJson}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 px-4 py-2.5 text-xs font-semibold text-white transition"
          >
            <Download className="h-4 w-4 text-emerald-400" />
            Export Workout Data (JSON)
          </button>

          <label className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 hover:border-emerald-500 px-4 py-2.5 text-xs font-semibold text-zinc-200 cursor-pointer transition">
            <Upload className="h-4 w-4 text-emerald-400" />
            Import Workout Data (JSON)
            <input
              type="file"
              accept="application/json"
              onChange={handleImportJson}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
