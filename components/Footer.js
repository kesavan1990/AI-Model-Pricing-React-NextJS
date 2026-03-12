'use client';

import { useEffect } from 'react';
import { usePricing } from '../context/PricingContext';
import { formatLastUpdatedLabel } from '../src/render.js';

export function Footer() {
  const { lastUpdated, benchmarksLastUpdated } = usePricing();

  useEffect(() => {
    const el = document.getElementById('lastUpdated');
    if (el) el.textContent = formatLastUpdatedLabel(lastUpdated) || '—';
  }, [lastUpdated]);

  useEffect(() => {
    const el = document.getElementById('benchmarksLastUpdated');
    if (el) el.textContent = benchmarksLastUpdated != null ? formatLastUpdatedLabel(String(benchmarksLastUpdated)) : '—';
  }, [benchmarksLastUpdated]);

  return (
    <footer className="page-footer">
      <p className="last-updated">
        Pricing: <span id="lastUpdated">—</span>; Benchmarks: <span id="benchmarksLastUpdated">—</span>. Prices may vary. Check official docs for latest.
      </p>
    </footer>
  );
}
