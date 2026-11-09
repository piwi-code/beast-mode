import React, { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { BottomSheet } from './BottomSheet';

export interface MultiSelectFilterOption {
  id: string;
  label: string;
  /** Optional secondary text, e.g. "Squat, Bench, Rows". */
  description?: string;
  /** Optional count shown on the right. */
  count?: number;
}

export interface MultiSelectFilterProps {
  /** Short label on the trigger, e.g. "Equipment". */
  label: string;
  sheetTitle?: string;
  options: MultiSelectFilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Notified when the filter sheet opens/closes (e.g. so a parent sheet can pause its own key handling). */
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

/**
 * Compact multi-select filter: a pill trigger ("Equipment · 2") that opens
 * the shared BottomSheet with large checkbox rows. Changes apply instantly;
 * nothing selected means "All".
 */
export const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  label,
  sheetTitle,
  options,
  selected,
  onChange,
  onOpenChange,
  className = '',
}) => {
  const [open, setOpenState] = useState(false);
  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };
  const active = selected.length > 0;

  const toggle = (id: string) =>
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id]
    );

  const summary = !active
    ? 'All'
    : selected.length === 1
      ? options.find((o) => o.id === selected[0])?.label ?? '1'
      : String(selected.length);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`inline-flex h-11 min-w-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${
          active
            ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200'
            : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:text-white'
        } ${className}`}
      >
        <span className="text-zinc-400 font-semibold">{label}:</span>
        <span className="min-w-0 flex-1 truncate text-left">{summary}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
      </button>

      <BottomSheet
        open={open}
        title={sheetTitle ?? `Filter by ${label.toLowerCase()}`}
        onClose={() => setOpen(false)}
        footer={
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={!active}
              className="h-11 rounded-xl px-4 text-sm font-bold text-zinc-300 hover:text-white disabled:opacity-40"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-11 flex-1 max-w-[200px] rounded-xl bg-emerald-500 px-4 text-sm font-extrabold text-zinc-950 hover:bg-emerald-400"
            >
              Done
            </button>
          </div>
        }
      >
        <div
          role="group"
          aria-label={label}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-zinc-800 py-1 mt-2"
        >
          {options.map((o) => {
            const checked = selected.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggle(o.id)}
                className={`mx-2 my-0.5 flex min-h-[56px] w-[calc(100%-1rem)] items-center gap-3 rounded-xl px-3 py-2 text-left transition active:bg-zinc-800 ${
                  checked ? 'bg-emerald-500/10' : 'hover:bg-zinc-800/60'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition ${
                    checked
                      ? 'border-emerald-500 bg-emerald-500 text-zinc-950'
                      : 'border-zinc-600'
                  }`}
                >
                  {checked && <Check className="h-4 w-4" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-white">
                    {o.label}
                  </span>
                  {o.description && (
                    <span className="block text-xs text-zinc-400 truncate">
                      {o.description}
                    </span>
                  )}
                </span>
                {o.count !== undefined && (
                  <span className="text-xs font-semibold text-zinc-500">
                    {o.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
};
