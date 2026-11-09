import React from 'react';
import { User, Users } from 'lucide-react';

/**
 * Per-session "training with a buddy" switch. A buddy means a spotter is
 * available (barbell bench etc. are safe) and partner station swaps work.
 */
export interface BuddyToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  className?: string;
}

export const BuddyToggle: React.FC<BuddyToggleProps> = ({
  checked,
  onChange,
  className = '',
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`inline-flex min-h-[44px] items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${
      checked
        ? 'border-emerald-500/60 bg-emerald-500/15'
        : 'border-zinc-700 bg-zinc-950'
    } ${className}`}
  >
    <span
      className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition ${
        checked ? 'bg-emerald-500' : 'bg-zinc-700'
      }`}
    >
      <span
        className={`absolute h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </span>
    <span className="min-w-0">
      <span
        className={`flex items-center gap-1.5 text-xs font-extrabold ${
          checked ? 'text-emerald-200' : 'text-zinc-200'
        }`}
      >
        {checked ? <Users className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
        {checked ? 'Buddy session' : 'Solo session'}
      </span>
      <span className="block text-[11px] text-zinc-400">
        {checked
          ? 'Spotter available — barbell bench OK'
          : 'No spotter — safer lifts suggested'}
      </span>
    </span>
  </button>
);

/**
 * Small inline marker: two-person icon for buddy sessions. With `showSolo`,
 * solo sessions get a single-person icon instead of nothing.
 */
export const BuddyBadge: React.FC<{
  withBuddy?: boolean;
  showSolo?: boolean;
  className?: string;
}> = ({ withBuddy, showSolo = false, className = '' }) =>
  withBuddy ? (
    <Users className={`h-3 w-3 shrink-0 ${className}`} aria-label="Buddy session" />
  ) : showSolo ? (
    <User className={`h-3 w-3 shrink-0 ${className}`} aria-label="Solo session" />
  ) : null;
