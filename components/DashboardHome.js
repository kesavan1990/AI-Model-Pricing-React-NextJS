'use client';

import { useMemo } from 'react';
import { usePricing } from '../context/PricingContext';
import { getAllModels } from '../src/calculator.js';
import { CostBarChart } from './CostBarChart';
import ModelIntelligencePanel from './ModelIntelligencePanel';

export default function DashboardHome() {
  const { getData } = usePricing();
  const data = getData();
  const all = useMemo(() => getAllModels(data), [data]);
  const insights = useMemo(() => {
    const byBlended = [...all].filter((m) => m.blended >= 0).sort((a, b) => a.blended - b.blended);
    const cheapest = byBlended[0];
    const costliest = byBlended.length ? byBlended[byBlended.length - 1] : null;
    const byContext = [...all].filter((m) => m.contextTokens > 0).sort((a, b) => b.contextTokens - a.contextTokens);
    const largestCtx = byContext[0];
    const flashModels = byBlended.filter((m) => /flash/i.test(m.name || ''));
    const fastest = flashModels.length ? flashModels[0] : cheapest;
    return {
      cheapestName: cheapest?.name ?? '—',
      cheapestPrice: cheapest ? (cheapest.blended === 0 ? 'Free' : `$${Number(cheapest.blended).toFixed(2)}`) : '—',
      bestQualityName: costliest?.name ?? '—',
      bestQualityPrice: costliest ? `$${Number(costliest.blended).toFixed(2)}` : '—',
      fastestName: fastest?.name ?? '—',
      fastestPrice: fastest ? (fastest.blended === 0 ? 'Free' : `$${Number(fastest.blended).toFixed(2)}`) : '—',
      largestContextName: largestCtx?.name ?? '—',
      largestContextSize: largestCtx ? (largestCtx.contextWindow || String(largestCtx.contextTokens)) : '—',
    };
  }, [all]);

  return (
    <div className="dashboard-home-wrap">
      <h1 className="dashboard-home-title">Dashboard</h1>
      <div className="dashboard-home-grid">
        <div className="dashboard-home-chart dashboard-chart-card">
          <h2 className="chart-card-title">Cost per 1M tokens (blended) — top models</h2>
          <CostBarChart models={all} />
        </div>
        <ModelIntelligencePanel
          cheapestName={insights.cheapestName}
          cheapestPrice={insights.cheapestPrice}
          bestQualityName={insights.bestQualityName}
          bestQualityPrice={insights.bestQualityPrice}
          fastestName={insights.fastestName}
          fastestPrice={insights.fastestPrice}
          largestContextName={insights.largestContextName}
          largestContextSize={insights.largestContextSize}
        />
      </div>
    </div>
  );
}
