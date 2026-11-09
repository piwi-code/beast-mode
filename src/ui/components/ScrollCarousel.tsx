import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Horizontal swipe carousel: native touch/trackpad scrolling with snap,
 * no visible scrollbar, edge fades and left/right arrow buttons that only
 * appear when there is more content in that direction.
 *
 * Children should be the slides; give them `snap-start shrink-0`.
 * Pass `className` to switch layout at larger breakpoints (e.g. to a grid);
 * the arrows hide automatically when nothing overflows.
 */
export interface ScrollCarouselProps {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}

export const ScrollCarousel: React.FC<ScrollCarouselProps> = ({
  children,
  className = '',
  ariaLabel,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanLeft(el.scrollLeft > 2);
    setCanRight(el.scrollLeft < max - 2);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [update, children]);

  const scrollByPage = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  const arrowClass =
    'absolute top-1/2 z-10 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/95 text-zinc-200 shadow-lg shadow-black/40 transition hover:text-white active:scale-95';

  return (
    <div className="relative" role="region" aria-label={ariaLabel}>
      <div
        ref={trackRef}
        className={`scrollbar-none overflow-x-auto overscroll-x-contain snap-x snap-mandatory scroll-smooth ${className}`}
      >
        {children}
      </div>

      {/* Edge fades */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-zinc-900 to-transparent transition-opacity ${
          canLeft ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-zinc-900 to-transparent transition-opacity ${
          canRight ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {canLeft && (
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => scrollByPage(-1)}
          className={`${arrowClass} -left-3.5`}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {canRight && (
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => scrollByPage(1)}
          className={`${arrowClass} -right-3.5`}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
