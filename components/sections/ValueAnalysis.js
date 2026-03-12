'use client';

import { useMemo } from 'react';
import { Chart as ChartJS, ScatterController, LinearScale, PointElement, Tooltip, Legend } from 'chart.js';
import { Scatter } from 'react-chartjs-2';

ChartJS.register(ScatterController, LinearScale, PointElement, Tooltip, Legend);
import { usePricing } from '../../context/PricingContext';
import { mergeModels, computeFrontier } from '../../src/valueChart.js';

const PROVIDER_COLORS = {
  gemini: 'rgba(59, 130, 246, 0.95)',
  openai: 'rgba(16, 185, 129, 0.95)',
  anthropic: 'rgba(249, 115, 22, 0.95)',
  mistral: 'rgba(139, 92, 246, 0.95)',
};

export function ValueAnalysis() {
  const { getData, getBenchmarksData, valueChartProviderFilter, setValueChartProviderFilter, valueChartMetric, setValueChartMetric } = usePricing();
  const data = getData();
  const benchmarks = getBenchmarksData();
  const isDark = typeof document !== 'undefined' && document.documentElement?.getAttribute('data-theme') !== 'light';

  const chartData = useMemo(() => {
    const merged = mergeModels(data, Array.isArray(benchmarks) ? benchmarks : null, valueChartMetric, 1000, 500);
    let list = merged;
    if (valueChartProviderFilter && valueChartProviderFilter !== 'all') {
      list = list.filter((m) => m.providerKey === valueChartProviderFilter);
    }
    const frontier = computeFrontier(list);
    const frontierSet = new Set(frontier.map((m) => m.providerKey + ':' + m.name + ':' + (m.contextTier || '')));
    const allPoints = list.map((m) => ({ x: m.cost, y: m.performance, ...m }));
    const frontierPoints = frontier.map((m) => ({ x: m.cost, y: m.performance, ...m, _frontierSet: frontierSet }));
    const gridColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';
    const textColor = isDark ? '#e2e8f0' : '#334155';
    const allFill = isDark ? 'rgba(180, 180, 180, 0.5)' : 'rgba(100, 100, 100, 0.35)';
    const allBorder = isDark ? 'rgba(200, 200, 200, 0.65)' : 'rgba(80, 80, 80, 0.5)';
    const isLarge = allPoints.length > 50;
    const metricLabel = valueChartMetric === 'arena' ? 'Arena' : valueChartMetric === 'mmlu' ? 'MMLU' : 'Code';
    return {
      datasets: [
        {
          label: 'All models',
          data: allPoints.map((p) => ({ x: p.x, y: p.y })),
          backgroundColor: allFill,
          borderColor: allBorder,
          borderWidth: isLarge ? 0 : 1,
          pointRadius: isLarge ? 3 : 4,
          pointHoverRadius: isLarge ? 5 : 6,
          order: 2,
        },
        {
          label: 'Frontier (best value)',
          data: frontierPoints.map((p) => ({ x: p.x, y: p.y })),
          backgroundColor: frontierPoints.map((m) => PROVIDER_COLORS[m.providerKey] || 'rgba(239, 68, 68, 0.9)'),
          borderColor: frontierPoints.map((m) => (PROVIDER_COLORS[m.providerKey] || 'rgba(239, 68, 68, 0.9)').replace(/[\d.]+\)$/, '1)')),
          borderWidth: 2,
          pointRadius: 7,
          pointHoverRadius: 9,
          order: 1,
        },
      ],
      metricLabel,
      textColor,
      gridColor,
    };
  }, [data, benchmarks, valueChartProviderFilter, valueChartMetric, isDark]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: true },
      plugins: {
        legend: { display: true, position: 'top', labels: { color: chartData.textColor } },
        tooltip: {
          filter: (tooltipItem) => tooltipItem?.raw != null,
          callbacks: {
            label(ctx) {
              const p = ctx.raw;
              const m = chartData.datasets[0].data?.find((_, i) => i === ctx.dataIndex) || chartData.datasets[1]?.data?.find((_, i) => i === ctx.dataIndex);
              if (!m) return `${p.x?.toFixed(4)} $, ${p.y}`;
              const nameLabel = m.contextTier ? `${m.name} (${m.contextTier})` : m.name;
              return [
                nameLabel + ' · ' + (m.provider || ''),
                `Cost/request: $${(m.cost || 0).toFixed(4)}`,
                `${chartData.metricLabel}: ${m.performance}`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: 'Cost per request ($)', color: chartData.textColor },
          grid: { color: chartData.gridColor },
          ticks: { color: chartData.textColor, callback: (v) => '$' + Number(v).toFixed(3) },
        },
        y: {
          title: { display: true, text: `Performance (${chartData.metricLabel})`, color: chartData.textColor },
          grid: { color: chartData.gridColor },
          ticks: { color: chartData.textColor },
        },
      },
    }),
    [chartData]
  );

  return (
    <section className="page-section value-chart-section" id="section-value-chart">
      <h2 className="section-title">📈 Cost vs Performance</h2>
      <p className="section-subtitle">
        Value analysis: cost per request using a <strong>fixed baseline</strong> (1,000 prompt + 500 output tokens). Grey = all models; colored points = frontier (best value at each cost level). Hover for details.
      </p>
      <div className="value-chart-controls">
        <div className="value-chart-control-group">
          <label htmlFor="value-chart-metric" className="value-chart-label">Performance metric:</label>
          <select
            id="value-chart-metric"
            className="value-chart-select"
            value={valueChartMetric}
            onChange={(e) => setValueChartMetric(e.target.value)}
          >
            <option value="arena">Arena</option>
            <option value="mmlu">MMLU</option>
            <option value="code">Code</option>
          </select>
        </div>
        <div className="value-chart-control-group">
          <span className="value-chart-label">Filter by provider:</span>
          <div className="value-chart-provider-btns" role="group">
            {['all', 'gemini', 'openai', 'anthropic', 'mistral'].map((p) => (
              <button
                key={p}
                type="button"
                className={'value-chart-provider-btn' + (valueChartProviderFilter === p ? ' active' : '')}
                data-value-provider={p}
                onClick={() => setValueChartProviderFilter(p)}
              >
                {p === 'all' ? 'All' : p === 'gemini' ? 'Google' : p === 'openai' ? 'OpenAI' : p === 'anthropic' ? 'Anthropic' : 'Mistral'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="value-chart-legend-hint">
        Colored points = <strong>Frontier (best value)</strong>{' '}
        <span className="value-chart-frontier-tooltip" title="Models with best performance at their cost—no cheaper model scores higher. Sort by cost (low to high), then keep only models with strictly better performance than every cheaper model.">(?)</span>
      </p>
      <div className="value-chart-wrap" style={{ minHeight: 400 }}>
        <Scatter data={{ datasets: chartData.datasets }} options={options} />
      </div>
    </section>
  );
}
