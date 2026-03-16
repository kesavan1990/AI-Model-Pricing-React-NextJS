'use client';

import { usePricing } from '../context/PricingContext';
import { formatLastUpdatedLabel } from '../src/render.js';

export function Footer() {
  const { lastUpdated, benchmarksLastUpdated } = usePricing();
  const pricingLabel = formatLastUpdatedLabel(lastUpdated) || '—';
  const benchmarksLabel = benchmarksLastUpdated != null ? formatLastUpdatedLabel(String(benchmarksLastUpdated)) : '—';

  return (
    <footer className="page-footer">
      <p className="last-updated">
        Pricing: <span id="lastUpdated">{pricingLabel}</span>; Benchmarks: <span id="benchmarksLastUpdated">{benchmarksLabel}</span>. Prices may vary. Check official docs for latest.
      </p>
    </footer>
  );
}
