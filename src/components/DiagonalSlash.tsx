import React, { forwardRef } from 'react';

interface DiagonalSlashProps {
  className?: string;
}

export const DiagonalSlash = forwardRef<HTMLDivElement, DiagonalSlashProps>(
  ({ className = '' }, ref) => {
    return (
      <div
        ref={ref}
        aria-hidden="true"
        className={`pointer-events-none select-none overflow-hidden ${className}`}
      >
        <div
          className="w-[140%] -ml-[20%] h-20 md:h-28 kavach-btn-accent -rotate-3 transform-gpu border-y border-[var(--border-hairline)] flex items-center justify-around px-12"
        >
          <span className="font-mono text-xs tracking-[0.24em] uppercase whitespace-nowrap">
            ★ ZERO CLOUD TELEMETRY · WEBGPU LOCAL SHADERS · INDEXEDDB VAULT ★
          </span>
          <span className="hidden lg:inline font-mono text-xs tracking-[0.24em] uppercase whitespace-nowrap">
            SOVEREIGN PERSONAL INTELLIGENCE · AIR-GAPPED BY DESIGN
          </span>
        </div>
      </div>
    );
  }
);

DiagonalSlash.displayName = 'DiagonalSlash';
