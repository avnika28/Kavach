import React, { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap, splitLettersReveal, isMotionDisabled } from '../lib/animations';

interface CinematicPreloaderProps {
  onComplete: () => void;
}

const PRELOADER_SESSION_KEY = 'kavach_preloader_completed_v1';

export const CinematicPreloader: React.FC<CinematicPreloaderProps> = ({ onComplete }) => {
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (isMotionDisabled()) return false;
    return !sessionStorage.getItem(PRELOADER_SESSION_KEY);
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const topHalfRef = useRef<HTMLDivElement>(null);
  const bottomHalfRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const brandWordRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!visible) {
      onComplete();
    }
  }, [visible, onComplete]);

  const finishPreloader = () => {
    try {
      sessionStorage.setItem(PRELOADER_SESSION_KEY, '1');
    } catch {
      // Ignore storage quota errors
    }
    setVisible(false);
    onComplete();
  };

  useGSAP(
    () => {
      if (!visible || !containerRef.current) return;

      const counterObj = { val: 0 };
      const tl = gsap.timeline({
        onComplete: finishPreloader,
      });

      // Reveal KAVACH letter by letter using SplitText
      splitLettersReveal(brandWordRef.current, {
        duration: 0.65,
        stagger: 0.045,
        delay: 0.05,
      });

      // Giant counter 00 to 100 in max 1.35s
      tl.to(
        counterObj,
        {
          val: 100,
          duration: 1.35,
          ease: 'power3.inOut',
          onUpdate: () => {
            if (counterRef.current) {
              counterRef.current.textContent = String(Math.round(counterObj.val)).padStart(
                2,
                '0'
              );
            }
          },
        },
        0
      );

      // Split screen halves slide away with clip-path / yPercent (total max <= 2.1s)
      tl.to(
        topHalfRef.current,
        {
          yPercent: -100,
          clipPath: 'polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)',
          duration: 0.68,
          ease: 'expo.inOut',
        },
        1.38
      ).to(
        bottomHalfRef.current,
        {
          yPercent: 100,
          clipPath: 'polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)',
          duration: 0.68,
          ease: 'expo.inOut',
        },
        1.38
      );
    },
    { scope: containerRef, dependencies: [visible] }
  );

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 pointer-events-auto select-none overflow-hidden"
      aria-label="Kavach Intro Preloader"
    >
      {/* Top Half Curtain */}
      <div
        ref={topHalfRef}
        style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)' }}
        className="absolute inset-x-0 top-0 h-1/2 bg-[var(--secondary-solid)] text-[var(--secondary-text)] flex flex-col justify-between p-6 sm:p-10 border-b border-[var(--border-hairline)]"
      >
        <div className="flex items-center justify-between text-xs font-mono uppercase tracking-[0.2em]">
          <span>● SOVEREIGN LOCAL RUNTIME</span>
          <button
            type="button"
            onClick={finishPreloader}
            className="px-3 py-1 rounded-full border border-current text-[11px] uppercase tracking-wider hover:opacity-80 cursor-pointer"
          >
            Skip Intro
          </button>
        </div>

        <div className="overflow-hidden">
          <h1
            ref={brandWordRef}
            className="font-poster text-6xl sm:text-8xl lg:text-9xl tracking-tight leading-none"
          >
            KAVACH
          </h1>
        </div>
      </div>

      {/* Bottom Half Curtain */}
      <div
        ref={bottomHalfRef}
        style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)' }}
        className="absolute inset-x-0 bottom-0 h-1/2 bg-[var(--secondary-solid)] text-[var(--secondary-text)] flex items-end justify-between p-6 sm:p-10"
      >
        <div className="space-y-1 text-xs font-mono uppercase tracking-[0.18em] opacity-80">
          <div>YOUR AI. YOUR DEVICE.</div>
          <div>100% OFFLINE · WEBGPU SHADERS</div>
        </div>

        <span
          ref={counterRef}
          className="font-poster text-[22vw] sm:text-[16vw] leading-[0.8] kavach-accent-text tabular-nums"
        >
          00
        </span>
      </div>
    </div>
  );
};
