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
    <footer className="dashboard-footer">
      <span id="lastUpdated" className="footer-updated">—</span>
      <span className="footer-sep"> · </span>
      <span id="benchmarksLastUpdated" className="footer-benchmarks">—</span>
    </footer>
  );
}
