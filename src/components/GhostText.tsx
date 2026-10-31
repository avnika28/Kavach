import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap, prefersReducedMotion } from '../lib/animations';

interface GhostTextProps {
  text: string;
  className?: string;
  speed?: number;
}

export const GhostText: React.FC<GhostTextProps> = ({
  text,
  className = '',
  speed = -48,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion() || !wordRef.current || !containerRef.current) return;

      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.to(wordRef.current, {
          y: speed,
          ease: 'none',
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1,
          },
        });
      });

      return () => mm.revert();
    },
    { scope: containerRef }
  );

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`pointer-events-none select-none overflow-hidden ${className}`}
    >
      <span
        ref={wordRef}
        className="block ghost-outline-text text-[5.5rem] sm:text-[9rem] lg:text-[13rem] tracking-tight"
      >
        {text}
      </span>
    </div>
  );
};
