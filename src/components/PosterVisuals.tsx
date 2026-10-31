import React, { useEffect, useRef } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { magneticHover } from '../lib/animations';

export const PosterStarburst: React.FC<{ className?: string }> = ({ className = 'w-12 h-12' }) => (
  <svg
    viewBox="0 0 100 100"
    fill="none"
    aria-hidden="true"
    className={`pointer-events-none select-none continuous-spin-starburst ${className}`}
  >
    <path
      d="M50 0L56.5 36.2L90.3 19.7L64.1 45.8L100 50L64.1 54.2L90.3 80.3L56.5 63.8L50 100L43.5 63.8L9.7 80.3L35.9 54.2L0 50L35.9 45.8L9.7 19.7L43.5 36.2L50 0Z"
      fill="var(--accent-primary)"
    />
  </svg>
);

export const SparkleFourPoint: React.FC<{ className?: string }> = ({ className = 'w-7 h-7' }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    aria-hidden="true"
    className={`pointer-events-none select-none ${className}`}
  >
    <path
      d="M32 0C33.8 18.6 45.4 30.2 64 32C45.4 33.8 33.8 45.4 32 64C30.2 45.4 18.6 33.8 0 32C18.6 30.2 30.2 18.6 32 0Z"
      fill="var(--accent-primary)"
    />
  </svg>
);

export const HeroPosterSculpture: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`relative pointer-events-none select-none ${className}`} aria-hidden="true">
    <svg
      viewBox="0 0 560 560"
      fill="none"
      className="w-full h-full overflow-visible drop-shadow-xl"
    >
      {/* Outer tilted orbit ring */}
      <g className="hero-orbit-ring origin-center">
        <ellipse
          cx="280"
          cy="280"
          rx="250"
          ry="96"
          transform="rotate(-24 280 280)"
          stroke="var(--text-primary)"
          strokeWidth="2"
          strokeDasharray="6 6"
        />
      </g>

      {/* Depth Layer 1: Primary bold organic cutout blob in Accent color */}
      <path
        className="hero-depth-layer-1"
        d="M150 120C240 48 395 68 438 172C481 276 422 428 318 468C214 508 98 442 78 326C58 210 60 192 150 120Z"
        fill="var(--accent-primary)"
      />

      {/* Depth Layer 2: Dimensional 3D layered concentric slices */}
      <g className="hero-depth-layer-2" transform="rotate(-14 280 280)">
        <ellipse
          cx="280"
          cy="265"
          rx="145"
          ry="145"
          fill="var(--secondary-solid)"
        />
        <path
          d="M145 235C195 190 365 190 415 235"
          stroke="var(--bg-page)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M136 268C196 222 364 222 424 268"
          stroke="var(--bg-page)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M148 301C202 258 358 258 412 301"
          stroke="var(--bg-page)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M174 334C220 298 340 298 386 334"
          stroke="var(--bg-page)"
          strokeWidth="10"
          strokeLinecap="round"
        />
      </g>

      {/* Foreground intersecting orbital ring */}
      <ellipse
        cx="280"
        cy="290"
        rx="236"
        ry="82"
        transform="rotate(19 280 290)"
        stroke="var(--bg-page)"
        strokeWidth="4"
      />
      <ellipse
        cx="280"
        cy="290"
        rx="236"
        ry="82"
        transform="rotate(19 280 290)"
        stroke="var(--text-primary)"
        strokeWidth="1.5"
      />

      {/* Floating satellite spheres */}
      <circle
        className="hero-depth-layer-2"
        cx="442"
        cy="136"
        r="26"
        fill="var(--bg-page)"
        stroke="var(--text-primary)"
        strokeWidth="3"
      />
      <circle
        className="hero-depth-layer-1"
        cx="106"
        cy="392"
        r="18"
        fill="var(--secondary-solid)"
      />
    </svg>
  </div>
);

interface CircleExploreCTAProps {
  label?: string;
  onClick: () => void;
}

/**
 * Signature Moment 4: Circle Outline Button with Arrow ("Explore now")
 * - Pulls magnetically within 80px
 * - Fills with accent color from bottom to top on hover
 * - Arrow rotates 45 degrees on hover
 */
export const CircleExploreCTA: React.FC<CircleExploreCTAProps> = ({
  label = 'Explore now',
  onClick,
}) => {
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    return magneticHover(btnRef.current, 12);
  }, []);

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden w-28 h-28 sm:w-32 sm:h-32 rounded-full border border-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-colors duration-300 flex flex-col items-center justify-center gap-1 cursor-pointer shrink-0"
    >
      {/* Bottom-to-top Accent Fill Layer */}
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-[var(--accent-primary)] translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
      />
      <span className="relative z-10 text-[11px] uppercase tracking-[0.16em] font-semibold group-hover:text-[var(--accent-text)] transition-colors duration-300">
        {label}
      </span>
      <ArrowUpRight className="relative z-10 w-5 h-5 group-hover:text-[var(--accent-text)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:rotate-45" />
    </button>
  );
};

export const SideNumberRail: React.FC<{ activeIndex?: number }> = ({ activeIndex = 1 }) => (
  <div
    aria-hidden="true"
    className="hidden xl:flex flex-col items-center justify-between py-6 px-3 border-r kavach-divider select-none shrink-0"
  >
    <div className="flex flex-col items-center gap-3 font-mono text-[11px]">
      {[1, 2, 3, 4].map((num) => (
        <span
          key={num}
          className={`px-1.5 py-0.5 rounded ${
            num === activeIndex
              ? 'kavach-btn-accent font-bold'
              : 'opacity-45'
          }`}
        >
          0{num}
        </span>
      ))}
    </div>

    <div className="h-24 w-[1px] bg-[var(--border-hairline)] my-4" />

    <div className="vertical-magazine-caption opacity-65">
      ISSUE 01 · ON-DEVICE SOVEREIGN AGENT · NO CLOUD
    </div>
  </div>
);
