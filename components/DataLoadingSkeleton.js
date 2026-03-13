'use client';

import { Skeleton } from './Skeleton';

/**
 * Full-page skeleton that mirrors Dashboard layout (title, filters, chart card, model intelligence panel).
 * Shown in the main content area while pricing data is loading.
 */
export function DataLoadingSkeleton() {
  return (
    <div className="dashboard-home-wrap" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-8 w-48 rounded mb-6" />
      <div className="dashboard-home-filters mb-6">
        <Skeleton className="h-6 w-40 rounded" />
      </div>
      <div className="dashboard-home-grid">
        <div className="dashboard-home-chart dashboard-chart-card">
          <Skeleton className="h-6 w-72 rounded mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-5 rounded" style={{ width: `${Math.max(40, 90 - i * 8)}%` }} />
            ))}
          </div>
        </div>
        <div className="model-intelligence-panel">
          <Skeleton className="h-6 w-44 rounded mb-4" />
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-5 w-5 rounded flex-shrink-0" />
                <Skeleton className="h-4 w-24 rounded flex-shrink-0" />
                <Skeleton className="h-4 flex-1 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
