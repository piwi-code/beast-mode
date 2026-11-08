import React, { useState } from 'react';
import {
  CheckCircle2,
  Database,
  Download,
  Settings,
  Upload,
} from 'lucide-react';
import {
  PlanConfig,
  PlanScheduleFamily,
  SessionsPerWeek,
  UpperLowerVariant,
} from '../../domain/models/types';
import { AppDataSnapshot } from '../../data/interfaces/repositories';

interface PlanSettingsViewProps {
  plan: PlanConfig;
  onSavePlan: (updated: PlanConfig) => Promise<void>;
  onExportData: () => Promise<AppDataSnapshot>;
  onImportData: (snapshot: AppDataSnapshot) => Promise<void>;
}

export const PlanSettingsView: React.FC<PlanSettingsViewProps> = ({
  plan,
  onSavePlan,
  onExportData,
  onImportData,
}) => {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleFamilyChange = async (family: PlanScheduleFamily) => {
    const name =
      family === 'PPL'
        ? `Rolling Push / Pull / Legs (${plan.sessionsPerWeek}-Day)`
        : `Upper / Lower Split (${plan.sessionsPerWeek}-Day)`;
    await onSavePlan({
      ...plan,
      scheduleFamily: family,
      name,
    });
    setStatusMessage(`Updated schedule family to ${family}`);
  };

  const handleVariantChange = async (variant: UpperLowerVariant) => {
    await onSavePlan({
      ...plan,
      upperLowerVariant: variant,
    });
    setStatusMessage(`Updated Upper/Lower mode to ${variant}`);
  };

  const handleSessionsPerWeekChange = async (count: SessionsPerWeek) => {
    await onSavePlan({
      ...plan,
      sessionsPerWeek: count,
    });
    setStatusMessage(`Updated weekly session target to ${count} sessions/week`);
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
    } catch (err) {
      setStatusMessage('Invalid JSON backup file.');
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {statusMessage && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/50 p-3.5 text-xs sm:text-sm text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Program Split & Frequency Selector */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5 space-y-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <Settings className="h-4 w-4" />
            Program Schedule & Split Configuration
          </div>
          <h2 className="text-lg font-bold text-white mt-0.5">{plan.name}</h2>
          <p className="text-xs text-zinc-400">
            Select your primary split (Push/Pull/Legs or Upper/Lower) and weekly session target (2, 3, or 4 days/week).
          </p>
        </div>

        {/* 1. Split Family */}
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
                Upper / Lower Split (Solo, Buddy, or 4-Day Hybrid)
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Alternates Upper and Lower sessions. Supports 2, 3, or 4 days/week (4 days = Upper/Lower twice a week).
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
                Separates movement planes (Push → Pull → Legs). Cycles continuously across 2, 3, or 4 weekly sessions.
              </p>
            </button>
          </div>
        </div>

        {/* Upper/Lower Sub-Variant */}
        {plan.scheduleFamily === 'UPPER_LOWER' && (
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Upper / Lower Station Mode
            </label>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {[
                {
                  id: 'HYBRID_SOLO_BUDDY' as const,
                  title: 'Hybrid Solo + Buddy',
                  desc: 'Solo Upper/Lower early week → Buddy Upper/Lower (36–48h turnaround)',
                },
                {
                  id: 'BUDDY_ONLY' as const,
                  title: 'Buddy Partner Flow',
                  desc: 'Partner-optimized station swaps & You-Go-I-Go sleds',
                },
                {
                  id: 'SOLO_ONLY' as const,
                  title: 'Solo Gym Flow',
                  desc: 'DB/Cable self-contained footprints',
                },
              ].map((v) => (
                <button
                  key={v.id}
                  onClick={() => handleVariantChange(v.id)}
                  className={`rounded-xl border p-3 text-left transition ${
                    plan.upperLowerVariant === v.id
                      ? 'border-emerald-500 bg-emerald-500/15 text-white'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400'
                  }`}
                >
                  <div className="text-xs font-bold text-white">{v.title}</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">{v.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 2. Weekly Session Count (2, 3, or 4) */}
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
                <div className="text-base font-extrabold">{count} Sessions / Wk</div>
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
                    : 'Minimalist 2-day maintenance'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Default Superset & Finisher Counts */}
        <div className="grid sm:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400">
              Default Supersets Per Session (2, 3, or 4)
            </label>
            <div className="flex gap-2">
              {([2, 3, 4] as const).map((n) => (
                <button
                  key={n}
                  onClick={() =>
                    onSavePlan({ ...plan, targetSupersetsPerSession: n })
                  }
                  className={`flex-1 rounded-xl border py-2 text-xs font-bold ${
                    plan.targetSupersetsPerSession === n
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400'
                  }`}
                >
                  {n} Supersets
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400">
              Default Finishers Per Session (1 or 2)
            </label>
            <div className="flex gap-2">
              {([1, 2] as const).map((n) => (
                <button
                  key={n}
                  onClick={() =>
                    onSavePlan({ ...plan, targetFinishersPerSession: n })
                  }
                  className={`flex-1 rounded-xl border py-2 text-xs font-bold ${
                    plan.targetFinishersPerSession === n
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400'
                  }`}
                >
                  {n} {n === 1 ? 'Finisher' : 'Finishers'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Local Storage Backup & Cross-Device JSON Share */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
          <Database className="h-4 w-4" />
          Local IndexedDB Storage & Cross-Device Backup
        </div>
        <p className="text-xs text-zinc-400">
          All data is stored locally in your browser&apos;s IndexedDB via <code>DexieWorkoutRepository</code>. Export a JSON snapshot to share with your training partner or transfer to another phone, or swap the repository adapter later for PocketBase/Supabase.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
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
