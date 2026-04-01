/**
 * Normalize benchmark values for charts/heatmaps. Arena text-leaderboard ELO (~1150–1650)
 * is not on the same 0–100 scale as MMLU / in-app tier estimates.
 */

/** Typical range for LMArena text chat ELO (adjust if leaderboard shifts). */
export const ARENA_ELO_AXIS_MIN = 1150;
export const ARENA_ELO_AXIS_MAX = 1650;

/** Values below this are treated as legacy 0–100 tier estimates, not ELO. */
export const ARENA_ELO_THRESHOLD = 250;

/**
 * Map Arena column value to 0–100 for radar / heatmap tiers.
 * @param {number} arena
 * @returns {number}
 */
export function arenaValueToChartScale(arena) {
  if (typeof arena !== 'number' || Number.isNaN(arena)) return 0;
  if (arena < ARENA_ELO_THRESHOLD) return Math.min(100, Math.max(0, arena));
  const t = (arena - ARENA_ELO_AXIS_MIN) / (ARENA_ELO_AXIS_MAX - ARENA_ELO_AXIS_MIN);
  return Math.min(100, Math.max(0, Math.round(t * 100)));
}

/**
 * Heatmap tier for 0–100-style scores (MMLU, Code, Reasoning, or scaled Arena).
 * @param {number} score0to100
 * @returns {'strong'|'average'|'weak'|null}
 */
export function heatmapTierFrom0to100(score0to100) {
  if (typeof score0to100 !== 'number' || Number.isNaN(score0to100) || score0to100 < 0) return null;
  if (score0to100 >= 70) return 'strong';
  if (score0to100 >= 40) return 'average';
  return 'weak';
}

/**
 * @param {number} raw
 * @param {'mmlu'|'code'|'reasoning'|'arena'} metricKey
 */
export function heatmapTierForMetric(raw, metricKey) {
  if (typeof raw !== 'number' || Number.isNaN(raw) || raw < 0) return null;
  const scaled = metricKey === 'arena' ? arenaValueToChartScale(raw) : Math.min(100, Math.max(0, raw));
  return heatmapTierFrom0to100(scaled);
}

/** Radar / tooltips: show raw Arena ELO vs other metrics. */
export function formatBenchmarkTooltipValue(raw, metricKey) {
  if (raw == null || (typeof raw === 'number' && Number.isNaN(raw))) return '—';
  if (metricKey === 'arena' && typeof raw === 'number' && raw >= ARENA_ELO_THRESHOLD) return `${Math.round(raw)} ELO`;
  if (typeof raw === 'number' && Number.isInteger(raw)) return String(raw);
  if (typeof raw === 'number') return String(Number(raw.toFixed(1)));
  return String(raw);
}
