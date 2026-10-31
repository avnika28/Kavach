import React, { useEffect, useRef, useState } from 'react';
import { gsap, isMotionDisabled } from '../lib/animations';

export const CustomCursor: React.FC = () => {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [cursorLabel, setCursorLabel] = useState<string>('');
  const [isDesktopPointer, setIsDesktopPointer] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    setIsDesktopPointer(finePointer);
    if (!finePointer) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    const dotX = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3.out' });
    const dotY = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3.out' });
    const ringX = gsap.quickTo(ring, 'x', { duration: 0.36, ease: 'power3.out' });
    const ringY = gsap.quickTo(ring, 'y', { duration: 0.36, ease: 'power3.out' });

    const onMouseMove = (e: MouseEvent) => {
      if (isMotionDisabled()) return;
      dotX(e.clientX);
      dotY(e.clientY);
      ringX(e.clientX);
      ringY(e.clientY);

      const target = e.target as HTMLElement | null;
      if (!target) return;

      const cardEl = target.closest('[data-cursor], .kavach-card') as HTMLElement | null;
      const interactiveEl = target.closest('button, a, input, select, textarea, [role="button"]');

      if (cardEl && !interactiveEl) {
        const customText = cardEl.getAttribute('data-cursor') || 'VIEW';
        setCursorLabel(customText);
        gsap.to(ring, {
          width: 64,
          height: 64,
          duration: 0.3,
          ease: 'power3.out',
        });
      } else if (interactiveEl) {
        setCursorLabel('');
        gsap.to(ring, {
          width: 48,
          height: 48,
          duration: 0.3,
          ease: 'power3.out',
        });
      } else {
        setCursorLabel('');
        gsap.to(ring, {
          width: 30,
          height: 30,
          duration: 0.3,
          ease: 'power3.out',
        });
      }
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [isDesktopPointer]);

  if (!isDesktopPointer || isMotionDisabled()) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden hidden lg:block">
      {/* Small Dot */}
      <div
        ref={dotRef}
        className="fixed top-0 left-0 w-2 h-2 -ml-1 -mt-1 rounded-full bg-[var(--accent-primary)]"
      />
      {/* Lagging Ring */}
      <div
        ref={ringRef}
        className="fixed top-0 left-0 w-[30px] h-[30px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--text-primary)]/50 flex items-center justify-center transition-colors"
        style={{
          backgroundColor: cursorLabel ? 'var(--accent-primary)' : 'transparent',
          color: cursorLabel ? 'var(--accent-text)' : 'inherit',
        }}
      >
        {cursorLabel && (
          <span className="text-[9px] font-mono uppercase tracking-widest font-bold">
            {cursorLabel}
          </span>
        )}
      </div>
    </div>
  );
};
