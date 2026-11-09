import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import {
  PickerFilter,
  PickerGroup,
  PickerOption,
  PickerTag,
  filterOptionsByKey,
  searchOptions,
} from '../../domain/catalog/pickerOptions';

/**
 * SelectSheet — the app's standard "pick one item from data" control.
 *
 * Replaces native <select>s. The trigger shows the current choice (clear name,
 * one-line description, labels). Tapping it opens a bottom sheet on phones
 * (centered dialog on larger screens) with:
 *   - a search box (multi-word, matches names, descriptions, muscles, equipment)
 *   - optional filter chips (e.g. equipment)
 *   - an optional "Recommended" section on top
 *   - sticky sub-headings (e.g. muscle groups); an option may sit in several
 *   - 56px+ touch rows, keyboard navigation (↑ ↓ Enter Esc)
 */

export interface SelectSheetProps {
  value: string | null | undefined;
  options: PickerOption[];
  onChange: (id: string) => void;
  /** Heading shown at the top of the sheet, e.g. "Choose primary lift". */
  sheetTitle: string;
  /** Ordered sub-headings. Options without a matching group go under "Other". */
  groups?: PickerGroup[];
  filters?: PickerFilter[];
  /** Ids pinned in a section at the top of the list. */
  suggestedIds?: string[];
  suggestedLabel?: string;
  /** Shown in the trigger when value doesn't match any option. */
  placeholder?: string;
  placeholderSubtitle?: string;
  searchPlaceholder?: string;
  /** Small label above the trigger's title, e.g. "Exercise 1A". */
  eyebrow?: React.ReactNode;
  size?: 'md' | 'sm';
  disabled?: boolean;
  className?: string;
}

const TAG_TONE_CLASSES: Record<PickerTag['tone'], string> = {
  neutral: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  accent: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  info: 'bg-sky-500/10 text-sky-300 border-sky-500/25',
  warn: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
};

export const PickerTagChip: React.FC<{ tag: PickerTag }> = ({ tag }) => (
  <span
    className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-none whitespace-nowrap ${TAG_TONE_CLASSES[tag.tone]}`}
  >
    {tag.label}
  </span>
);

interface Section {
  key: string;
  label: string;
  options: PickerOption[];
}

function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}

function isCoarsePointer(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  );
}

export const SelectSheet: React.FC<SelectSheetProps> = ({
  value,
  options,
  onChange,
  sheetTitle,
  groups,
  filters,
  suggestedIds,
  suggestedLabel = 'Recommended',
  placeholder = 'Select…',
  placeholderSubtitle,
  searchPlaceholder = 'Search by name, muscle or equipment',
  eyebrow,
  size = 'md',
  disabled,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filterId, setFilterId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const selected = options.find((o) => o.id === value);

  useBodyScrollLock(open);

  // ----- Build visible sections -------------------------------------------
  const sections: Section[] = useMemo(() => {
    const visible = searchOptions(filterOptionsByKey(options, filterId), query);
    const result: Section[] = [];

    const isBrowsing = !query.trim() && !filterId;
    if (isBrowsing && suggestedIds?.length) {
      const byId = new Map(visible.map((o) => [o.id, o]));
      const suggested = suggestedIds
        .map((id) => byId.get(id))
        .filter((o): o is PickerOption => Boolean(o));
      if (suggested.length) {
        result.push({ key: '__suggested', label: suggestedLabel, options: suggested });
      }
    }

    if (!groups?.length) {
      if (visible.length) {
        result.push({
          key: '__all',
          label: query.trim() ? 'Results' : 'All',
          options: visible,
        });
      }
      return result;
    }

    const known = new Set(groups.map((g) => g.id));
    for (const g of groups) {
      const inGroup = visible.filter((o) => o.groupIds.includes(g.id));
      if (inGroup.length) result.push({ key: g.id, label: g.label, options: inGroup });
    }
    const other = visible.filter((o) => !o.groupIds.some((id) => known.has(id)));
    if (other.length) result.push({ key: '__other', label: 'Other', options: other });
    return result;
  }, [options, filterId, query, suggestedIds, suggestedLabel, groups]);

  const flat = useMemo(
    () =>
      sections.flatMap((s) =>
        s.options.map((o) => ({ option: o, key: `${s.key}:${o.id}` }))
      ),
    [sections]
  );

  // ----- Open / close -----------------------------------------------------
  const openSheet = () => {
    if (disabled) return;
    setOpen(true);
  };

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setFilterId(null);
    // Return focus to the trigger for keyboard users.
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const choose = (id: string) => {
    if (id !== value) onChange(id);
    close();
  };

  // On open: focus search on desktop (avoid popping the keyboard on phones)
  // and scroll the current selection into view.
  useEffect(() => {
    if (!open) return;
    const idx = flat.findIndex((f) => f.option.id === value);
    setActiveIndex(idx >= 0 ? idx : 0);
    requestAnimationFrame(() => {
      if (isCoarsePointer()) dialogRef.current?.focus({ preventScroll: true });
      else searchRef.current?.focus();
      const el = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
      el?.scrollIntoView({ block: 'center' });
    });
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Reset highlight when the result set changes.
  useEffect(() => {
    if (open) setActiveIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filterId]);

  // Keep keyboard highlight visible.
  useEffect(() => {
    if (!open) return;
    const key = flat[activeIndex]?.key;
    if (!key) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-key="${CSS.escape(key)}"]`
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, flat, open]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const item = flat[activeIndex];
      if (item) {
        e.preventDefault();
        choose(item.option.id);
      }
    }
  };

  // Listen on the document so keys work wherever focus sits (on touch devices
  // the search box is intentionally not auto-focused).
  const keyHandlerRef = useRef(onKeyDown);
  keyHandlerRef.current = onKeyDown;
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => keyHandlerRef.current(e);
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // ----- Trigger ----------------------------------------------------------
  const isSm = size === 'sm';
  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      onClick={openSheet}
      disabled={disabled}
      aria-haspopup="dialog"
      aria-expanded={open}
      className={`group w-full min-h-[48px] rounded-xl border border-zinc-700 bg-zinc-950 text-left transition hover:border-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 disabled:opacity-50 ${
        isSm ? 'px-2.5 py-2' : 'px-3 py-2.5'
      } ${className}`}
    >
      <div className="flex items-center gap-2">
        {/* contain:inline-size stops long truncated text from widening grid/flex parents */}
        <div className="min-w-0 flex-1 [contain:inline-size]">
          {eyebrow && (
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5">
              {eyebrow}
            </div>
          )}
          <div
            className={`font-bold text-white truncate ${isSm ? 'text-xs' : 'text-sm'}`}
          >
            {selected?.title ?? placeholder}
          </div>
          {(selected?.subtitle ?? placeholderSubtitle) && !isSm && (
            <div className="text-[11px] text-zinc-400 truncate mt-0.5">
              {selected?.subtitle ?? placeholderSubtitle}
            </div>
          )}
          {selected && selected.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {selected.tags.slice(0, isSm ? 1 : 3).map((t) => (
                <PickerTagChip key={t.label} tag={t} />
              ))}
            </div>
          )}
        </div>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-zinc-500 group-hover:text-zinc-300" />
      </div>
    </button>
  );

  // ----- Sheet ------------------------------------------------------------
  let runningIndex = -1;
  const activeKey = flat[activeIndex]?.key;

  const sheet = open
    ? createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
            onClick={close}
            aria-hidden="true"
          />

          <div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={sheetTitle}
            className="relative flex w-full outline-none sm:max-w-lg flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl max-h-[88dvh] sm:max-h-[80vh]"
          >
            {/* Grab handle (phones) */}
            <div className="sm:hidden flex shrink-0 justify-center pt-2">
              <div className="h-1 w-10 rounded-full bg-zinc-700" />
            </div>

            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-2 sm:pt-4">
              <h2 className="text-base font-extrabold text-white">{sheetTitle}</h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 -mr-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search */}
            <div className="shrink-0 px-4 pb-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  ref={searchRef}
                  type="text"
                  inputMode="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  role="combobox"
                  aria-expanded="true"
                  aria-controls={listboxId}
                  aria-activedescendant={
                    activeKey ? `${listboxId}-${activeKey}` : undefined
                  }
                  className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 pl-10 pr-10 text-base sm:text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      searchRef.current?.focus();
                    }}
                    aria-label="Clear search"
                    className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center text-zinc-500 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter chips */}
            {filters && filters.length > 0 && (
              <div className="flex shrink-0 gap-1.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
                {[{ id: null as string | null, label: 'All' }, ...filters].map((f) => {
                  const active = filterId === f.id;
                  return (
                    <button
                      key={f.id ?? '__all'}
                      type="button"
                      onClick={() => setFilterId(f.id)}
                      aria-pressed={active}
                      className={`h-9 shrink-0 rounded-full border px-3.5 text-xs font-bold transition ${
                        active
                          ? 'border-emerald-500 bg-emerald-500 text-zinc-950'
                          : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* List */}
            <div
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-label={sheetTitle}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-zinc-800 pb-[max(1rem,env(safe-area-inset-bottom))]"
            >
              {sections.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-zinc-400">
                  No matches.{' '}
                  <button
                    type="button"
                    className="font-bold text-emerald-400"
                    onClick={() => {
                      setQuery('');
                      setFilterId(null);
                    }}
                  >
                    Clear search
                  </button>
                </div>
              )}

              {sections.map((section) => (
                <div key={section.key} role="group" aria-label={section.label}>
                  <div className="sticky top-0 z-10 flex items-center justify-between bg-zinc-900/95 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-emerald-400 backdrop-blur">
                    <span>{section.label}</span>
                    <span className="text-zinc-500">{section.options.length}</span>
                  </div>

                  {section.options.map((o) => {
                    runningIndex += 1;
                    const idx = runningIndex;
                    const key = `${section.key}:${o.id}`;
                    const isSelected = o.id === value;
                    const isActive = idx === activeIndex;
                    return (
                      <div
                        key={key}
                        id={`${listboxId}-${key}`}
                        data-key={key}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => choose(o.id)}
                        onMouseMove={() => {
                          if (activeIndex !== idx) setActiveIndex(idx);
                        }}
                        className={`mx-2 my-0.5 flex min-h-[56px] cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition active:bg-zinc-800 ${
                          isSelected
                            ? 'bg-emerald-500/10 ring-1 ring-emerald-500/40'
                            : isActive
                              ? 'bg-zinc-800/70'
                              : ''
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-white">{o.title}</div>
                          {o.subtitle && (
                            <div className="mt-0.5 text-xs leading-snug text-zinc-400">
                              {o.subtitle}
                            </div>
                          )}
                          {(o.tags.length > 0 || o.meta) && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1">
                              {o.tags.map((t) => (
                                <PickerTagChip key={t.label} tag={t} />
                              ))}
                              {o.meta && (
                                <span className="text-[10px] text-zinc-500">{o.meta}</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center pt-0.5">
                          {isSelected && <Check className="h-5 w-5 text-emerald-400" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      {trigger}
      {sheet}
    </>
  );
};
