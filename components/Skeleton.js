'use client';

/**
 * Theme-aware skeleton placeholder for loading states.
 * Use with Tailwind size/radius classes, e.g. className="h-6 w-40 rounded".
 */
export function Skeleton({ className = '', style = {} }) {
  return (
    <div
      className={`skeleton ${className}`.trim()}
      style={style}
      aria-hidden
    />
  );
}
