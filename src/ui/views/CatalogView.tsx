import React, { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Layers,
  Search,
} from 'lucide-react';
import {
  Exercise,
  SupersetPair,
} from '../../domain/models/types';
import { MUSCLE_LABELS } from '../../domain/engine/rulesEngine';
import { SPLIT_SHORT_LABELS } from '../../domain/engine/sequencer';
import {
  BODY_REGION_GROUPS,
  EQUIPMENT_FILTERS,
  PAIRING_LABELS,
  getExerciseRegion,
} from '../../domain/catalog/pickerOptions';
import { MultiSelectFilter } from '../components/MultiSelectFilter';

interface CatalogViewProps {
  exercises: Exercise[];
  curatedSupersets: SupersetPair[];
}


export const CatalogView: React.FC<CatalogViewProps> = ({
  exercises,
  curatedSupersets,
}) => {
  const [search, setSearch] = useState('');
  const [eqFilters, setEqFilters] = useState<string[]>([]);
  const [regionFilters, setRegionFilters] = useState<string[]>([]);
  const [section, setSection] = useState<'ALL' | 'SUPERSETS' | 'EXERCISES'>(
    'ALL'
  );
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
  const query = search.trim().toLowerCase();

  const filteredSupersets = curatedSupersets.filter((ss) => {
    const exA = exerciseMap.get(ss.exerciseAId);
    const exB = exerciseMap.get(ss.exerciseBId);
    const pair = [exA, exB].filter((e): e is Exercise => Boolean(e));
    if (
      eqFilters.length &&
      !pair.some((e) => eqFilters.includes(e.equipment))
    ) {
      return false;
    }
    if (
      regionFilters.length &&
      !pair.some((e) => regionFilters.includes(getExerciseRegion(e)))
    ) {
      return false;
    }
    if (!query) return true;
    return (
      ss.name.toLowerCase().includes(query) ||
      ss.rationale.toLowerCase().includes(query) ||
      exA?.name.toLowerCase().includes(query) ||
      exB?.name.toLowerCase().includes(query)
    );
  });

  const filteredExercises = exercises.filter((ex) => {
    if (eqFilters.length && !eqFilters.includes(ex.equipment)) return false;
    if (regionFilters.length && !regionFilters.includes(getExerciseRegion(ex)))
      return false;
    if (!query) return true;
    return (
      ex.name.toLowerCase().includes(query) ||
      ex.primaryMuscles.some((m) =>
        MUSCLE_LABELS[m].toLowerCase().includes(query)
      ) ||
      ex.executionDirections?.toLowerCase().includes(query)
    );
  });

  const equipmentOptions = EQUIPMENT_FILTERS.map((f) => ({
    ...f,
    count: exercises.filter((e) => e.equipment === f.id).length,
  }));
  const regionOptions = BODY_REGION_GROUPS.map((g) => ({
    ...g,
    count: exercises.filter((e) => getExerciseRegion(e) === g.id).length,
  }));
  const hasFilters = eqFilters.length > 0 || regionFilters.length > 0;

  const toggleExpand = (id: string) => {
    setExpandedItemId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header & Search / Filter Controls */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              <BookOpen className="h-3.5 w-3.5" />
              Superset &amp; Exercise Catalog
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Tap any superset or exercise card to expand execution directions and form tips.
            </p>
          </div>

          <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-950 p-1">
            {(
              [
                { id: 'ALL', label: 'All' },
                { id: 'SUPERSETS', label: `Supersets (${filteredSupersets.length})` },
                { id: 'EXERCISES', label: `Exercises (${filteredExercises.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSection(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  section === tab.id
                    ? 'bg-emerald-500 text-zinc-950'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Search className="h-4 w-4 text-zinc-500 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search supersets, exercises, or muscles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-10 pr-3 py-2.5 text-xs sm:text-sm text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <MultiSelectFilter
              label="Muscle"
              sheetTitle="Filter by muscle group"
              options={regionOptions}
              selected={regionFilters}
              onChange={setRegionFilters}
            />
            <MultiSelectFilter
              label="Equipment"
              options={equipmentOptions}
              selected={eqFilters}
              onChange={setEqFilters}
            />
          </div>
          {hasFilters && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setEqFilters([]);
                  setRegionFilters([]);
                }}
                className="h-8 px-1 text-xs font-bold text-emerald-400 hover:text-emerald-300"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 1. CURATED SUPERSETS LISTING (Collapsible Cards) */}
      {(section === 'ALL' || section === 'SUPERSETS') && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wider text-zinc-400">
            <Layers className="h-4 w-4 text-emerald-400" />
            Curated Superset Pairings ({filteredSupersets.length})
          </div>

          <div className="grid gap-2.5 md:grid-cols-2 [&>*]:min-w-0">
            {filteredSupersets.map((ss) => {
              const exA = exerciseMap.get(ss.exerciseAId);
              const exB = exerciseMap.get(ss.exerciseBId);
              const isExpanded = expandedItemId === ss.id;

              return (
                <div
                  key={ss.id}
                  className={`rounded-2xl border transition ${
                    isExpanded
                      ? 'border-emerald-500/40 bg-zinc-900/90'
                      : 'border-zinc-800 bg-zinc-900/60'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleExpand(ss.id)}
                    className="w-full p-4 flex items-center justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                          {PAIRING_LABELS[ss.pairingType]}
                        </span>
                        {ss.buddyFriendly && (
                          <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-emerald-400 font-semibold">
                            Buddy friendly
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm sm:text-base font-extrabold text-white truncate">
                        {ss.name}
                      </h3>
                      <div className="text-xs text-zinc-400 truncate mt-0.5">
                        A1: {exA?.name} + A2: {exB?.name}
                      </div>
                    </div>

                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-zinc-400 shrink-0" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-zinc-400 shrink-0" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-zinc-800/80 space-y-3">
                      <p className="text-xs text-zinc-300">{ss.rationale}</p>

                      <div className="flex flex-wrap gap-1.5">
                        {ss.recommendedSplits.map((sp) => (
                          <span
                            key={sp}
                            className="rounded-md bg-zinc-950 border border-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-400"
                          >
                            {SPLIT_SHORT_LABELS[sp]}
                          </span>
                        ))}
                      </div>

                      {ss.executionNotes && (
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-xs text-zinc-300">
                          <strong className="text-emerald-400">
                            Superset Flow:{' '}
                          </strong>
                          {ss.executionNotes}
                        </div>
                      )}

                      <div className="grid gap-2.5 sm:grid-cols-2">
                        {[
                          { label: 'A1', ex: exA },
                          { label: 'A2', ex: exB },
                        ].map(({ label, ex }) =>
                          ex ? (
                            <div
                              key={ex.id}
                              className="rounded-xl border border-zinc-800/80 bg-zinc-950/90 p-3 space-y-1.5"
                            >
                              <div className="text-xs font-bold text-emerald-400">
                                {label}: {ex.name}
                              </div>
                              <div className="text-[11px] text-zinc-400">
                                {ex.equipment} • {ex.defaultReps ?? '10-12'} reps
                              </div>
                              {ex.executionDirections && (
                                <p className="text-xs text-zinc-300 leading-relaxed">
                                  {ex.executionDirections}
                                </p>
                              )}
                            </div>
                          ) : null
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. ALL EXERCISES & ACTIVITY DIRECTIONS (Collapsible Cards) */}
      {(section === 'ALL' || section === 'EXERCISES') && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wider text-zinc-400">
            <Dumbbell className="h-4 w-4 text-emerald-400" />
            Individual Exercises ({filteredExercises.length})
          </div>

          <div className="grid gap-2.5 md:grid-cols-2 [&>*]:min-w-0">
            {filteredExercises.map((ex) => {
              const isExpanded = expandedItemId === ex.id;
              return (
                <div
                  key={ex.id}
                  className={`rounded-2xl border transition ${
                    isExpanded
                      ? 'border-emerald-500/40 bg-zinc-900/90'
                      : 'border-zinc-800 bg-zinc-900/60'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleExpand(ex.id)}
                    className="w-full p-4 flex items-center justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm sm:text-base font-extrabold text-white truncate">
                          {ex.name}
                        </h4>
                        {ex.isPrimaryAnchorCandidate && (
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 shrink-0">
                            Anchor
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">
                          {ex.equipment}
                        </span>
                        {ex.primaryMuscles.map((m) => (
                          <span
                            key={m}
                            className="rounded bg-zinc-950 border border-zinc-800 px-2 py-0.5 text-[10px] text-emerald-300"
                          >
                            {MUSCLE_LABELS[m]}
                          </span>
                        ))}
                      </div>
                    </div>

                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-zinc-400 shrink-0" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-zinc-400 shrink-0" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-zinc-800/80 space-y-2.5">
                      <div className="flex items-center gap-4 text-xs text-zinc-400">
                        <span>
                          Axial Load: <strong className="text-white">{ex.axialLoadScore}/3</strong>
                        </span>
                        <span>
                          Grip Tax: <strong className="text-white">{ex.gripTax}/2</strong>
                        </span>
                        <span>
                          Target: <strong className="text-white">{ex.defaultReps ?? '8-12'} reps</strong>
                        </span>
                      </div>

                      {ex.executionDirections && (
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-xs text-zinc-200 leading-relaxed">
                          <strong className="text-emerald-400">
                            How to Execute:{' '}
                          </strong>
                          {ex.executionDirections}
                        </div>
                      )}

                      {ex.formTips && ex.formTips.length > 0 && (
                        <ul className="text-xs text-zinc-400 space-y-1 pl-1">
                          {ex.formTips.map((tip, i) => (
                            <li key={i}>• {tip}</li>
                          ))}
                        </ul>
                      )}

                      {ex.runnerBenefitNote && (
                        <div className="text-xs text-sky-300/90 pt-0.5">
                          🏃 <strong>Runner / Postural Benefit:</strong>{' '}
                          {ex.runnerBenefitNote}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
