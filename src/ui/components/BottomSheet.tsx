import React, { forwardRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Shared sheet chrome for all pickers/filters: bottom sheet on phones,
 * centered dialog on larger screens. Handles portal, backdrop, body scroll
 * lock, grab handle and header with a 44px close button.
 */
export interface BottomSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional sticky footer (e.g. Clear / Done buttons). */
  footer?: React.ReactNode;
  /** Close on Escape (default true). Disable when the caller handles keys. */
  closeOnEscape?: boolean;
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

export const BottomSheet = forwardRef<HTMLDivElement, BottomSheetProps>(
  ({ open, title, onClose, children, footer, closeOnEscape = true }, ref) => {
    useBodyScrollLock(open);

    useEffect(() => {
      if (!open || !closeOnEscape) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }, [open, closeOnEscape, onClose]);

    if (!open) return null;

    return createPortal(
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
          onClick={onClose}
          aria-hidden="true"
        />

        <div
          ref={ref}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="relative flex w-full outline-none sm:max-w-lg flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl max-h-[88dvh] sm:max-h-[80vh]"
        >
          {/* Grab handle (phones) */}
          <div className="sm:hidden flex shrink-0 justify-center pt-2">
            <div className="h-1 w-10 rounded-full bg-zinc-700" />
          </div>

          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-2 sm:pt-4">
            <h2 className="text-base font-extrabold text-white">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 -mr-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {children}

          {footer && (
            <div className="shrink-0 border-t border-zinc-800 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </div>
      </div>,
      document.body
    );
  }
);
BottomSheet.displayName = 'BottomSheet';
