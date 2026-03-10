/**
 * Cost vs Performance quadrant chart: merged pricing + benchmarks, frontier, scatter plot.
 * Uses Chart.js for visualization. Depends on calculator for getAllModels and getBenchmarkForModelMerged.
 */

import { getAllModels, getBenchmarkForModelMerged } from './calculator.js';

/** Default tokens for cost-per-request (typical request). */
const DEFAULT_PROMPT_TOKENS = 1000;
const DEFAULT_OUTPUT_TOKENS = 500;

/**
 * Cost per request in dollars: (prompt/1e6)*input_price + (output/1e6)*output_price.
 * @param {{ input: number, output: number }} model - Per-1M input/output prices
 * @param {number} promptTokens
 * @param {number} outputTokens
 */
export function computeCostPerRequest(model, promptTokens = DEFAULT_PROMPT_TOKENS, outputTokens = DEFAULT_OUTPUT_TOKENS) {
  const input = Number(model.input) || 0;
  const output = Number(model.output) || 0;
  return (promptTokens / 1e6) * input + (outputTokens / 1e6) * output;
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
  const all = getAllModels(data);
  return all
    .map((m) => {
      const bench = getBenchmarkForModelMerged(m.name, m.providerKey, fileBenchmarks);
      const performance = performanceMetric === 'arena' ? (bench.arena ?? 0) : performanceMetric === 'mmlu' ? (bench.mmlu ?? 0) : (bench.code ?? 0);
      const cost = computeCostPerRequest(m, promptTokens, outputTokens);
      return {
        name: m.name,
        provider: m.provider,
        providerKey: m.providerKey,
        cost,
        performance: Number(performance) || 0,
        blended: m.blended,
        input: m.input,
        output: m.output,
      };
    })
    .filter((m) => m.performance > 0);
}

/**
 * Price–performance frontier: for each cost level, keep only models that have strictly better performance than all cheaper models.
 * @param {Array<{ cost: number, performance: number, [key: string]: * }>} models - Sorted by cost asc (caller may sort)
 */
export function computeFrontier(models) {
  const sorted = [...models].sort((a, b) => a.cost - b.cost);
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

const PROVIDER_COLORS = {
  gemini: 'rgba(66, 133, 244, 0.9)',
  openai: 'rgba(16, 185, 129, 0.9)',
  anthropic: 'rgba(249, 115, 22, 0.9)',
  mistral: 'rgba(139, 92, 246, 0.9)',
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
  const frontierSet = new Set(frontier.map((m) => m.providerKey + ':' + m.name));

  const allPoints = list.map((m) => ({ x: m.cost, y: m.performance, ...m }));
  const frontierPoints = frontier.map((m) => ({ x: m.cost, y: m.performance, ...m }));

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textColor = isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)';

  const frontierColors = frontierPoints.map((m) => PROVIDER_COLORS[m.providerKey] || 'rgba(239, 68, 68, 0.9)');

  const frontierSortedByCost = [...frontierPoints].sort((a, b) => a.cost - b.cost);
  const lineData = frontierSortedByCost.map((p) => ({ x: p.cost, y: p.performance }));

  const datasetAll = {
    label: 'All models',
    data: allPoints.map((p) => ({ x: p.x, y: p.y })),
    backgroundColor: isDark ? 'rgba(150, 150, 150, 0.35)' : 'rgba(100, 100, 100, 0.25)',
    borderColor: isDark ? 'rgba(150, 150, 150, 0.5)' : 'rgba(100, 100, 100, 0.4)',
    borderWidth: 1,
    pointRadius: 4,
    pointHoverRadius: 6,
    order: 2,
  };

  const datasetFrontier = {
    type: 'scatter',
    label: 'Frontier (best value)',
    data: frontierPoints.map((p) => ({ x: p.x, y: p.y })),
    backgroundColor: frontierColors,
    borderColor: frontierColors.map((c) => c.replace('0.9', '1')),
    borderWidth: 2,
    pointRadius: 7,
    pointHoverRadius: 9,
    order: 1,
  };

  const datasetFrontierLine = {
    type: 'line',
    label: 'Frontier line',
    data: lineData,
    borderColor: isDark ? 'rgba(239, 68, 68, 0.8)' : 'rgba(185, 28, 28, 0.9)',
    borderWidth: 2,
    fill: false,
    pointRadius: 0,
    pointHoverRadius: 0,
    order: 0,
  };

  const metricLabel = performanceMetric === 'arena' ? 'Arena' : performanceMetric === 'mmlu' ? 'MMLU' : 'Code';

  const config = {
    type: 'scatter',
    data: {
      datasets: [datasetAll, datasetFrontier, datasetFrontierLine],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top', labels: { color: textColor } },
        tooltip: {
          callbacks: {
            label(context) {
              const p = context.raw;
              const m = allPoints.find((a) => a.x === p.x && a.y === p.y) || frontierPoints.find((a) => a.x === p.x && a.y === p.y);
              if (!m) return `${p.x?.toFixed(4)} $, ${p.y}`;
              const onFrontier = frontierSet.has(m.providerKey + ':' + m.name);
              return [
                m.name + ' · ' + m.provider,
                `Cost/request: $${(m.cost || 0).toFixed(4)}`,
                `${metricLabel}: ${m.performance}`,
                onFrontier ? '✓ Frontier' : '',
              ].filter(Boolean);
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: 'Cost per request ($)', color: textColor },
          grid: { color: gridColor },
          ticks: { color: textColor, callback(value) { return '$' + Number(value).toFixed(3); } },
        },
        y: {
          title: { display: true, text: `Performance (${metricLabel})`, color: textColor },
          grid: { color: gridColor },
          ticks: { color: textColor },
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
 * @param {Object} data - Pricing data
 * @param {Array|null} fileBenchmarks - Benchmarks
 * @param {Object} options - { providerFilter, performanceMetric }
 */
export function updateValueChart(data, fileBenchmarks, options = {}) {
  const merged = mergeModels(data, fileBenchmarks, options.performanceMetric || 'arena');
  renderQuadrantChart('value-chart-canvas', merged, options);
}
