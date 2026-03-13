/**
 * Cost vs Performance quadrant chart: merged pricing + benchmarks, frontier, scatter plot.
 * Uses Chart.js for visualization. Depends on calculator for getAllModels and getBenchmarkForModelMerged.
 */

import { getChatModels, getBenchmarkForModelMerged } from './calculator.js';

/** Default tokens for cost-per-request (typical request). */
const DEFAULT_PROMPT_TOKENS = 1000;
const DEFAULT_OUTPUT_TOKENS = 500;

/**
 * Cost per request in dollars: (prompt/1e6)*input_price + (output/1e6)*output_price.
 * Returns null if pricing is invalid (zero, negative, or missing).
 * @param {{ input: number, output: number }} model - Per-1M input/output prices
 * @param {number} promptTokens
 * @param {number} outputTokens
 * @returns {number|null}
 */
export function computeCostPerRequest(model, promptTokens = DEFAULT_PROMPT_TOKENS, outputTokens = DEFAULT_OUTPUT_TOKENS) {
  const input = Number(model.input);
  const output = Number(model.output);
  if (input <= 0 || output <= 0 || !Number.isFinite(input) || !Number.isFinite(output)) return null;
  const cost = (promptTokens / 1e6) * input + (outputTokens / 1e6) * output;
  return Number.isFinite(cost) ? cost : null;
}

/**
 * Build list of models with cost and performance for the quadrant chart.
 * @param {Object} data - { gemini, openai, anthropic, mistral }
 * @param {Array|null} fileBenchmarks - From benchmarks.json
 * @param {string} performanceMetric - 'arena' | 'mmlu' | 'code'
 * @param {number} promptTokens
 * @param {number} outputTokens
 */
export function mergeModels(data, fileBenchmarks, performanceMetric = 'arena', promptTokens = DEFAULT_PROMPT_TOKENS, outputTokens = DEFAULT_OUTPUT_TOKENS) {
  const all = getChatModels(data);
  return all
    .map((m) => {
      const bench = getBenchmarkForModelMerged(m.name, m.providerKey, fileBenchmarks);
      const rawPerf = performanceMetric === 'arena' ? bench.arena : performanceMetric === 'mmlu' ? bench.mmlu : bench.code;
      const performance = rawPerf != null && rawPerf !== '' ? Number(rawPerf) : null;
      const cost = computeCostPerRequest(m, promptTokens, outputTokens);
      return {
        name: m.name,
        contextTier: m.contextTier || null,
        provider: m.provider,
        providerKey: m.providerKey,
        cost,
        performance: Number.isFinite(performance) ? performance : null,
        blended: m.blended,
        input: m.input,
        output: m.output,
      };
    })
    .filter((m) => m.cost != null && Number.isFinite(m.cost) && m.performance != null && Number.isFinite(m.performance));
}

/**
 * Price–performance frontier: for each cost level, keep only models that have strictly better performance than all cheaper models.
 * Sort by cost ascending, then by performance descending when cost is equal (same-cost edge case).
 * @param {Array<{ cost: number, performance: number, [key: string]: * }>} models
 */
export function computeFrontier(models) {
  const sorted = [...models].sort((a, b) => {
    if (a.cost !== b.cost) return a.cost - b.cost;
    return (b.performance ?? 0) - (a.performance ?? 0);
  });
  const frontier = [];
  let bestPerf = 0;
  for (const m of sorted) {
    if (m.performance > bestPerf) {
      frontier.push(m);
      bestPerf = m.performance;
    }
  }
  return frontier;
}

let chartInstance = null;

// Frontier point colors: work on both light and dark chart backgrounds
const PROVIDER_COLORS = {
  gemini: 'rgba(59, 130, 246, 0.95)',   // blue
  openai: 'rgba(16, 185, 129, 0.95)',   // emerald
  anthropic: 'rgba(249, 115, 22, 0.95)', // orange
  mistral: 'rgba(139, 92, 246, 0.95)',  // violet
};

/**
 * Render or update the Cost vs Performance scatter chart.
 * @param {HTMLCanvasElement|string} canvasOrId - Canvas element or id
 * @param {Array<{ name: string, providerKey: string, cost: number, performance: number }>} mergedModels - From mergeModels()
 * @param {Object} options - { providerFilter: 'all'|'gemini'|..., performanceMetric: 'arena'|'mmlu'|'code' }
 */
export function renderQuadrantChart(canvasOrId, mergedModels, options = {}) {
  const canvas = typeof canvasOrId === 'string' ? document.getElementById(canvasOrId) : canvasOrId;
  if (!canvas || typeof Chart === 'undefined') return;

  const providerFilter = options.providerFilter || 'all';
  const performanceMetric = options.performanceMetric || 'arena';

  let list = mergedModels;
  if (providerFilter && providerFilter !== 'all') {
    list = list.filter((m) => m.providerKey === providerFilter);
  }

  const frontier = computeFrontier(list);
  const frontierSet = new Set(frontier.map((m) => m.providerKey + ':' + m.name + ':' + (m.contextTier || '')));

  const allPoints = list.map((m) => ({ x: m.cost, y: m.performance, ...m }));
  const frontierPoints = frontier.map((m) => ({ x: m.cost, y: m.performance, ...m }));

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  // Grid and text: visible in both themes
  const gridColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';
  const textColor = isDark ? '#e2e8f0' : '#334155';

  const frontierColors = frontierPoints.map((m) => PROVIDER_COLORS[m.providerKey] || 'rgba(239, 68, 68, 0.9)');

  // All models: medium grey visible on both light and dark backgrounds
  const allModelsFill = isDark ? 'rgba(180, 180, 180, 0.5)' : 'rgba(100, 100, 100, 0.35)';
  const allModelsBorder = isDark ? 'rgba(200, 200, 200, 0.65)' : 'rgba(80, 80, 80, 0.5)';

  const isLargeDataset = allPoints.length > 50;
  const datasetAll = {
    label: 'All models',
    data: allPoints.map((p) => ({ x: p.x, y: p.y })),
    backgroundColor: allModelsFill,
    borderColor: allModelsBorder,
    borderWidth: isLargeDataset ? 0 : 1,
    pointRadius: isLargeDataset ? 3 : 4,
    pointHoverRadius: isLargeDataset ? 5 : 6,
    order: 2,
  };

  const datasetFrontier = {
    type: 'scatter',
    label: 'Frontier (best value)',
    data: frontierPoints.map((p) => ({ x: p.x, y: p.y })),
    backgroundColor: frontierColors,
    borderColor: frontierColors.map((c) => c.replace(/0\.\d+\)$/, '1)')),
    borderWidth: 2,
    pointRadius: 7,
    pointHoverRadius: 9,
    order: 1,
  };

  const metricLabel = performanceMetric === 'arena' ? 'Arena' : performanceMetric === 'mmlu' ? 'MMLU' : 'Code';

  const costs = list.map((m) => m.cost).filter((c) => Number.isFinite(c));
  const perfs = list.map((m) => m.performance).filter((p) => Number.isFinite(p));
  const p5 = (arr) => (arr.length ? arr.slice().sort((a, b) => a - b)[Math.max(0, Math.floor(arr.length * 0.05))] : undefined);
  const p95 = (arr) => (arr.length ? arr.slice().sort((a, b) => a - b)[Math.min(arr.length - 1, Math.ceil(arr.length * 0.95))] : undefined);
  const xMin = p5(costs);
  const xMax = p95(costs);
  const yMin = p5(perfs);
  const yMax = p95(perfs);
  const pad = (lo, hi, pct = 0.05) => {
    const d = (hi ?? lo ?? 0) - (lo ?? 0) || 1;
    return [lo != null ? Math.max(0, lo - d * pct) : undefined, hi != null ? hi + d * pct : undefined];
  };
  const [suggestedXMin, suggestedXMax] = pad(xMin, xMax);
  const [suggestedYMin, suggestedYMax] = pad(yMin, yMax);
  const useClampX = suggestedXMin != null && suggestedXMax != null && suggestedXMax > suggestedXMin;
  const useClampY = suggestedYMin != null && suggestedYMax != null && suggestedYMax > suggestedYMin;

  const config = {
    type: 'scatter',
    data: {
      datasets: [datasetAll, datasetFrontier],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: true },
      plugins: {
        legend: { display: true, position: 'top', labels: { color: textColor } },
        tooltip: {
          filter: (tooltipItem) => {
            const raw = tooltipItem?.raw;
            if (raw == null || typeof raw.x !== 'number' || typeof raw.y !== 'number') return false;
            return allPoints.some((a) => a.x === raw.x && a.y === raw.y) || frontierPoints.some((a) => a.x === raw.x && a.y === raw.y);
          },
          callbacks: {
            label(context) {
              const p = context.raw;
              const m = allPoints.find((a) => a.x === p.x && a.y === p.y) || frontierPoints.find((a) => a.x === p.x && a.y === p.y);
              if (!m) return `${p.x?.toFixed(4)} $, ${p.y}`;
              const onFrontier = frontierSet.has(m.providerKey + ':' + m.name + ':' + (m.contextTier || ''));
              const nameLabel = m.contextTier ? `${m.name} (${m.contextTier})` : m.name;
              const lines = [
                nameLabel + ' · ' + m.provider,
                `Cost/request: $${(m.cost || 0).toFixed(4)}`,
                `${metricLabel}: ${m.performance}`,
              ];
              if (onFrontier) {
                lines.push('✓ Frontier — best value at this cost (no cheaper model has higher performance).');
              }
              return lines;
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: 'Cost per request ($)', color: textColor },
          grid: { color: gridColor },
          ticks: { color: textColor, callback(value) { return '$' + Number(value).toFixed(3); } },
          ...(useClampX && { min: suggestedXMin, max: suggestedXMax }),
        },
        y: {
          title: { display: true, text: `Performance (${metricLabel})`, color: textColor },
          grid: { color: gridColor },
          ticks: { color: textColor },
          ...(useClampY && { min: suggestedYMin, max: suggestedYMax }),
        },
      },
    },
  };

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  chartInstance = new Chart(canvas, config);
}

/**
 * Destroy chart instance (e.g. when switching tabs or cleaning up).
 */
export function destroyQuadrantChart() {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}

/**
 * Update chart with current data. Call from app when data or filter changes.
 * Cost is always computed using the fixed workload baseline (1k prompt + 500 output tokens),
 * so the chart stays consistent regardless of simulator or calculator token settings.
 * Uses requestAnimationFrame to defer heavy work (lazy rendering) and avoid blocking the main thread when dataset is large.
 * Provider and performance-metric filtering reduce the number of points rendered.
 * @param {Object} data - Pricing data
 * @param {Array|null} fileBenchmarks - Benchmarks
 * @param {Object} options - { providerFilter, performanceMetric }
 */
export function updateValueChart(data, fileBenchmarks, options = {}) {
  const runUpdate = () => {
    const merged = mergeModels(
      data,
      fileBenchmarks,
      options.performanceMetric || 'arena',
      DEFAULT_PROMPT_TOKENS,
      DEFAULT_OUTPUT_TOKENS
    );
    renderQuadrantChart('value-chart-canvas', merged, options);
  };
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(runUpdate);
  } else {
    runUpdate();
  }
}
