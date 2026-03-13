'use client';

import { useState, useMemo } from 'react';
import { usePricing } from '../context/PricingContext';
import { getAllModels } from '../src/calculator.js';
import { CostBarChart } from './CostBarChart';
import ModelIntelligencePanel from './ModelIntelligencePanel';

const MODEL_TYPE_OPTIONS = [
  { value: 'chat', label: 'Chat / Text' },
  { value: '', label: 'All' },
  { value: 'image', label: 'Image' },
  { value: 'audio', label: 'Audio' },
  { value: 'video', label: 'Video' },
];

export default function DashboardHome() {
  const { getData } = usePricing();
  const data = getData();
  const [modelTypeFilter, setModelTypeFilter] = useState('chat');
  const [providerFilter, setProviderFilter] = useState('');
  const all = useMemo(() => getAllModels(data), [data]);
  const filteredByModelTypeOnly = useMemo(() => {
    if (!modelTypeFilter) return all;
    return all.filter((m) => m.modelType === modelTypeFilter);
  }, [all, modelTypeFilter]);
  const filtered = useMemo(() => {
    if (!providerFilter) return filteredByModelTypeOnly;
    return filteredByModelTypeOnly.filter((m) => m.providerKey === providerFilter);
  }, [filteredByModelTypeOnly, providerFilter]);
  const insights = useMemo(() => {
    const byBlended = [...filtered].filter((m) => m.blended >= 0).sort((a, b) => a.blended - b.blended);
    const cheapest = byBlended[0];
    const costliest = byBlended.length ? byBlended[byBlended.length - 1] : null;
    const byContext = [...filtered].filter((m) => m.contextTokens > 0).sort((a, b) => b.contextTokens - a.contextTokens);
    const largestCtx = byContext[0];
    const flashModels = byBlended.filter((m) => /flash/i.test(m.name || ''));
    const fastest = flashModels.length ? flashModels[0] : cheapest;
    return {
      cheapestName: cheapest?.name ?? '—',
      cheapestPrice: cheapest ? (cheapest.blended === 0 ? 'Free' : `$${Number(cheapest.blended).toFixed(5)}`) : '—',
      bestQualityName: costliest?.name ?? '—',
      bestQualityPrice: costliest ? `$${Number(costliest.blended).toFixed(5)}` : '—',
      fastestName: fastest?.name ?? '—',
      fastestPrice: fastest ? (fastest.blended === 0 ? 'Free' : `$${Number(fastest.blended).toFixed(5)}`) : '—',
      largestContextName: largestCtx?.name ?? '—',
      largestContextSize: largestCtx ? (largestCtx.contextWindow || String(largestCtx.contextTokens)) : '—',
    };
  }, [filtered]);

  return (
    <div className="dashboard-home-wrap">
      <h1 className="dashboard-home-title">Dashboard</h1>
      <div className="dashboard-home-filters">
        <div className="model-type-filter-inline">
          <label htmlFor="dashboard-model-type" className="model-type-label">Model type:</label>
          <select
            id="dashboard-model-type"
            className="model-type-select"
            value={modelTypeFilter}
            onChange={(e) => setModelTypeFilter(e.target.value)}
            aria-label="Filter Cost per 1M tokens and Model Intelligence by model type"
          >
            {MODEL_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="dashboard-home-grid">
        <div className="dashboard-home-chart dashboard-chart-card">
          <h2 className="chart-card-title">Cost per 1M tokens (blended) — top models</h2>
          <CostBarChart
            models={filtered}
            modelsForProviderSummary={filteredByModelTypeOnly}
            selectedProvider={providerFilter}
            onSelectProvider={(key) => setProviderFilter((prev) => (prev === key ? '' : key))}
          />
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
