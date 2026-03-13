'use client';

import { useState, useMemo, Fragment } from 'react';
import { useTheme } from '../context/ThemeContext';

const PROVIDER_LABELS = { gemini: 'Google Gemini', openai: 'OpenAI', anthropic: 'Anthropic', mistral: 'Mistral' };
const PROVIDER_INITIALS = { gemini: 'G', openai: 'O', anthropic: 'A', mistral: 'M' };

const PROVIDER_LOGO_CLASS = {
  gemini: 'provider-logo-gemini',
  openai: 'provider-logo-openai-custom',
  anthropic: 'provider-logo-anthropic',
  mistral: 'provider-logo-mistral',
};

function ProviderLogo({ providerKey, size = 36 }) {
  const logoClass = PROVIDER_LOGO_CLASS[providerKey] || PROVIDER_LOGO_CLASS.gemini;
  return (
    <div
      className={'provider-logo-badge ' + logoClass}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: size - 12, height: size - 12 }}>
        <path d="M12 2L13.5 9.5L21 11L13.5 12.5L12 20L10.5 12.5L3 11L10.5 9.5L12 2Z" />
      </svg>
    </div>
  );
}
const RANK_MEDALS = ['🥇', '🥈', '🥉'];
const COST_GRADIENT = { low: '#22c55e', mid: '#eab308', high: '#ef4444' };

function formatModelLabel(name, maxLen = 28) {
  if (!name || name.length <= maxLen) return name;
  return name.slice(0, maxLen - 1) + '…';
}

function costToGradientColor(cost, minCost, maxCost, isCheapest) {
  if (isCheapest) return COST_GRADIENT.low;
  const range = maxCost - minCost || 1;
  const ratio = (cost - minCost) / range;
  if (ratio < 0.33) return COST_GRADIENT.low;
  if (ratio < 0.66) return COST_GRADIENT.mid;
  return COST_GRADIENT.high;
}

function getCost(model, costType) {
  if (costType === 'input') return Number(model.input) ?? 0;
  if (costType === 'output') return Number(model.output) ?? 0;
  return Number(model.blended) ?? 0;
}

function costTypeLabel(costType) {
  if (costType === 'input') return 'Input price per 1M';
  if (costType === 'output') return 'Output price per 1M';
  return 'Blended per 1M';
}

const COST_TYPE_TOOLTIPS = {
  blended: 'Weighted average (70% input + 30% output) per 1M tokens. Use for quick comparison across models.',
  input: 'Price per 1M input/prompt tokens — what you send to the model.',
  output: 'Price per 1M output/completion tokens — what the model returns.',
};

const SEGMENT_COUNT = 12;

function segmentColorAtIndex(i, total) {
  if (total <= 1) return COST_GRADIENT.low;
  const t = i / (total - 1);
  if (t < 0.5) return COST_GRADIENT.low;
  if (t < 1) return COST_GRADIENT.mid;
  return COST_GRADIENT.high;
}

function SegmentedBar({ fillRatio, height = 8, isDark }) {
  const filled = Math.round(fillRatio * SEGMENT_COUNT);
  const trackBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  return (
    <div style={{ display: 'flex', gap: 2, height }} className="segmented-bar">
      {Array.from({ length: SEGMENT_COUNT }, (_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            minWidth: 4,
            borderRadius: 2,
            background: i < filled ? segmentColorAtIndex(i, SEGMENT_COUNT) : trackBg,
          }}
        />
      ))}
    </div>
  );
}

const COST_DECIMALS = 5;
const PROVIDER_ORDER = ['gemini', 'openai', 'anthropic', 'mistral'];

export function CostBarChart({ models, modelsForProviderSummary, selectedProvider = '', onSelectProvider }) {
  const { theme } = useTheme();
  const isDark = theme !== 'light';
  const [costType, setCostType] = useState('blended');
  const [hoveredRow, setHoveredRow] = useState(null);

  const textColor = isDark ? '#e2e8f0' : '#334155';
  const gridColor = isDark ? '#334155' : '#cbd5e1';

  const { data, providerSummary, costLabel, chartMinCost, chartMaxCost } = useMemo(() => {
    const list = [...(models || [])];
    const withCost = list.map((m) => ({ ...m, _cost: getCost(m, costType) }));
    const valid = withCost.filter((m) => m._cost >= 0);
    const sorted = valid.sort((a, b) => a._cost - b._cost).slice(0, 10);
    const minCost = sorted.length ? Math.min(...sorted.map((m) => m._cost)) : 0;
    const maxCost = sorted.length ? Math.max(...sorted.map((m) => m._cost)) : 0;

    const providerKey = (m) => m.providerKey || 'gemini';
    const data = sorted.map((m, i) => {
      const rank = i + 1;
      const medal = RANK_MEDALS[rank - 1];
      const initial = PROVIDER_INITIALS[providerKey(m)] || '?';
      const rankLabel = medal ? `${medal} #${rank} [${initial}] ${formatModelLabel(m.name)}` : `#${rank} [${initial}] ${formatModelLabel(m.name)}`;
      return {
        rank,
        rankLabel,
        model: formatModelLabel(m.name),
        fullName: m.name,
        cost: m._cost,
        provider: providerKey(m),
        providerLabel: PROVIDER_LABELS[providerKey(m)] || m.provider || '—',
        contextWindow: m.contextWindow || '—',
        isCheapest: rank === 1,
        barColor: costToGradientColor(m._cost, minCost, maxCost, rank === 1),
      };
    });

    const summarySource = modelsForProviderSummary ?? models ?? [];
    const summaryByProvider = {};
    (summarySource || []).forEach((m) => {
      const key = m.providerKey || 'gemini';
      if (!summaryByProvider[key]) summaryByProvider[key] = { sum: 0, count: 0 };
      const cost = getCost(m, costType);
      if (cost >= 0) {
        summaryByProvider[key].sum += cost;
        summaryByProvider[key].count += 1;
      }
    });
    const providerSummary = PROVIDER_ORDER.map((key) => ({
      providerKey: key,
      provider: PROVIDER_LABELS[key] || key,
      avg: summaryByProvider[key]?.count ? summaryByProvider[key].sum / summaryByProvider[key].count : 0,
    }));

    const chartMinCost = sorted.length ? minCost : 0;
    const chartMaxCost = sorted.length ? maxCost : 0;
    return {
      data,
      providerSummary,
      costLabel: costTypeLabel(costType),
      chartMinCost,
      chartMaxCost,
    };
  }, [models, modelsForProviderSummary, costType]);

  const range = chartMaxCost - chartMinCost || 1;
  const getFillRatio = (cost) => Math.min(1, Math.max(0, (cost - chartMinCost) / range));

  const hasData = models?.length > 0;

  return (
    <div className="cost-leaderboard-wrap">
      <div className="cost-type-toggle" style={{ marginBottom: 8 }}>
        <span style={{ marginRight: 8, color: textColor, fontWeight: 500, fontSize: '0.8125rem' }}>Cost type:</span>
        {['blended', 'input', 'output'].map((type) => (
          <button
            key={type}
            type="button"
            title={COST_TYPE_TOOLTIPS[type]}
            onClick={() => setCostType(type)}
            className={'cost-type-btn' + (costType === type ? ' active' : '')}
            style={{
              marginRight: 6,
              padding: '6px 12px',
              borderRadius: 8,
              border: `1px solid ${gridColor}`,
              background: costType === type ? (isDark ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.15)') : 'transparent',
              color: textColor,
              cursor: 'pointer',
              fontSize: '0.8125rem',
              textTransform: 'capitalize',
            }}
          >
            {type === 'blended' ? 'Blended' : type === 'input' ? 'Input' : 'Output'}
          </button>
        ))}
      </div>

      {providerSummary.length > 0 && (
        <div className="provider-summary-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
          {providerSummary.map((s) => {
            const maxAvg = Math.max(...providerSummary.map((x) => x.avg), 0.01);
            const barPct = maxAvg > 0 ? Math.min(100, (s.avg / maxAvg) * 100) : 0;
            const isSelected = selectedProvider && s.providerKey === selectedProvider;
            return (
              <button
                key={s.provider}
                type="button"
                className="provider-summary-card"
                onClick={() => onSelectProvider?.(s.providerKey)}
                style={{
                  width: '100%',
                  minWidth: 0,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: isSelected ? (isDark ? 'rgba(99, 102, 241, 0.35)' : 'rgba(99, 102, 241, 0.2)') : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                  border: `1px solid ${isSelected ? 'rgba(99, 102, 241, 0.6)' : gridColor}`,
                  color: textColor,
                  fontSize: '0.875rem',
                  cursor: onSelectProvider ? 'pointer' : 'default',
                  textAlign: 'left',
                }}
                title={onSelectProvider ? (isSelected ? 'Click to show all providers' : 'Click to show only ' + s.provider) : undefined}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ flexShrink: 0, lineHeight: 0 }} aria-hidden>
                    <ProviderLogo providerKey={s.providerKey} size={28} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{s.provider}</div>
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>${Number(s.avg).toFixed(COST_DECIMALS)}</div>
                <SegmentedBar fillRatio={barPct / 100} height={6} isDark={isDark} />
              </button>
            );
          })}
        </div>
      )}

      {!hasData ? (
        <div className="chart-empty-state" style={{ padding: '24px 16px', textAlign: 'center', color: textColor, fontSize: '0.9375rem' }}>
          <p className="chart-empty-message" style={{ margin: '0 0 8px 0', fontWeight: 500 }}>No model data yet.</p>
          <p style={{ margin: 0, opacity: 0.85, fontSize: '0.8125rem' }}>
            Try a different <strong>Model type</strong> above, or click a provider card to change filter. Click the selected card again to show all providers.
          </p>
        </div>
      ) : (
        <>
      {data.length > 0 && (
        <div className="cost-scale-legend" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: textColor, fontWeight: 500 }}>Cost scale</span>
          <span style={{ fontSize: '0.9rem', color: textColor, fontWeight: 600, minWidth: 44 }}>${Number(chartMinCost).toFixed(COST_DECIMALS)}</span>
          <div style={{ flex: '1 1 200px', minWidth: 120, maxWidth: 280 }}>
            <SegmentedBar fillRatio={1} height={10} isDark={isDark} />
          </div>
          <span style={{ fontSize: '0.9rem', color: textColor, fontWeight: 600, minWidth: 44 }}>${Number(chartMaxCost).toFixed(COST_DECIMALS)}</span>
        </div>
      )}

      <div className="cost-leaderboard-table-wrap" style={{ position: 'relative', width: '100%' }}>
        <table className="cost-leaderboard-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${gridColor}` }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: textColor }}>Rank</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: textColor }}>Model</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: textColor, width: '40%' }}>Cost ↓</th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry, index) => {
              const isHovered = hoveredRow === index;
              const isHighlighted = entry.rank >= 1 && entry.rank <= 3;
              const medal = RANK_MEDALS[entry.rank - 1];
              const highlightLabel = entry.rank === 1 ? 'Cheapest' : entry.rank === 2 ? '2nd lowest' : entry.rank === 3 ? '3rd lowest' : null;
              return (
                <Fragment key={index}>
                  <tr
                    onMouseEnter={() => setHoveredRow(index)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      borderBottom: isHovered ? 'none' : `1px solid ${gridColor}`,
                      background: isHovered ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)') : 'transparent',
                    }}
                  >
                    <td style={{ padding: '6px 8px', color: textColor, whiteSpace: 'nowrap' }}>
                      {entry.rank <= 3 ? RANK_MEDALS[entry.rank - 1] : ''} #{entry.rank}
                    </td>
                    <td style={{ padding: '6px 8px', color: textColor }}>
                      <span style={{ fontWeight: 600, marginRight: 4 }}>[{PROVIDER_INITIALS[entry.provider] || '?'}]</span>
                      {entry.fullName}
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: '1 1 100px', minWidth: 80, maxWidth: 180 }}>
                          <SegmentedBar fillRatio={getFillRatio(entry.cost)} height={8} isDark={isDark} />
                        </div>
                        <span style={{ color: textColor, fontWeight: 600, minWidth: 48, fontSize: '0.875rem' }}>${Number(entry.cost).toFixed(COST_DECIMALS)}</span>
                        {entry.isCheapest && <span style={{ color: COST_GRADIENT.low, fontSize: '0.8125rem' }}>🟢 Cheapest</span>}
                      </div>
                    </td>
                  </tr>
                  {isHovered && (
                    <tr
                      onMouseEnter={() => setHoveredRow(index)}
                      onMouseLeave={() => setHoveredRow(null)}
                      style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)' }}
                    >
                      <td colSpan={3} style={{ padding: '6px 8px 8px', borderBottom: `1px solid ${gridColor}`, verticalAlign: 'top' }}>
                        <div
                          style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                            borderLeft: `3px solid ${isHighlighted ? COST_GRADIENT.low : gridColor}`,
                            fontSize: '0.875rem',
                            color: textColor,
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: '10px 16px',
                          }}
                        >
                          {isHighlighted && (
                            <span style={{ fontWeight: 700, color: COST_GRADIENT.low }}>
                              {medal} Rank #{entry.rank} — {highlightLabel}
                            </span>
                          )}
                          <span style={{ fontWeight: 600 }}>{entry.fullName}</span>
                          <span>Provider: {entry.providerLabel}</span>
                          <span>Cost: ${Number(entry.cost).toFixed(COST_DECIMALS)} / 1M {costType === 'blended' ? '(blended)' : costType}</span>
                          <span>Context: {entry.contextWindow}</span>
                          {entry.isCheapest && !isHighlighted && <span style={{ color: COST_GRADIENT.low }}>🟢 Cheapest</span>}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="chart-legend-hint" style={{ color: textColor, fontSize: '0.875rem', marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '8px 14px', alignItems: 'center' }}>
        <span>🟢 Cheapest</span>
        <span style={{ color: COST_GRADIENT.low }}>● Low cost</span>
        <span style={{ color: COST_GRADIENT.mid }}>● Mid</span>
        <span style={{ color: COST_GRADIENT.high }}>● High cost</span>
      </div>
        </>
      )}
    </div>
  );
}
