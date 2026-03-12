'use client';

/**
 * Small meaningful visual per insight type (no time-series data).
 * - cheapest: downward slope (low cost)
 * - bestQuality: upward slope / high bar (premium)
 * - fastest: zigzag / speed burst
 * - largest: rising steps (growing context)
 */
function InsightVisual({ width = 44, height = 20, variant }) {
  const w = width;
  const h = height;
  const pad = 2;
  const stroke = 'var(--theme-text-muted, #94a3b8)';
  const fill = 'var(--theme-text-muted, #94a3b8)';

  if (variant === 'cheapest') {
    const pts = `${pad},${pad + 2} ${w * 0.5},${h - pad - 2} ${w - pad},${pad + 4}`;
    return (
      <svg width={w} height={h} aria-hidden style={{ flexShrink: 0 }} viewBox={`0 0 ${w} ${h}`}>
        <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (variant === 'bestQuality') {
    const pts = `${pad},${h - pad - 4} ${w * 0.5},${pad + 4} ${w - pad},${h - pad - 2}`;
    return (
      <svg width={w} height={h} aria-hidden style={{ flexShrink: 0 }} viewBox={`0 0 ${w} ${h}`}>
        <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (variant === 'fastest') {
    const pts = `${pad},${h * 0.6} ${w * 0.25},${pad + 2} ${w * 0.5},${h * 0.65} ${w * 0.75},${pad + 3} ${w - pad},${h * 0.55}`;
    return (
      <svg width={w} height={h} aria-hidden style={{ flexShrink: 0 }} viewBox={`0 0 ${w} ${h}`}>
        <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (variant === 'largest') {
    const barW = (w - 2 * pad) / 5;
    const bars = [0.35, 0.55, 0.7, 0.85, 1];
    return (
      <svg width={w} height={h} aria-hidden style={{ flexShrink: 0 }} viewBox={`0 0 ${w} ${h}`}>
        {bars.map((pct, i) => (
          <rect
            key={i}
            x={pad + i * barW + 1}
            y={h - pad - (h - 2 * pad) * pct}
            width={barW - 2}
            height={(h - 2 * pad) * pct}
            rx={1}
            fill={fill}
            opacity={0.7}
          />
        ))}
      </svg>
    );
  }
  return null;
}

function InsightRow({ icon, label, name, value, visualVariant }) {
  return (
    <div className="model-intelligence-row">
      <InsightVisual variant={visualVariant} />
      <div className="model-intelligence-content">
        <span className="model-intelligence-label">{icon} {label}</span>
        <span className="model-intelligence-name">{name}</span>
        {value != null && value !== '' && <span className="model-intelligence-value">{value}</span>}
      </div>
    </div>
  );
}

export default function ModelIntelligencePanel({
  cheapestName,
  cheapestPrice,
  bestQualityName,
  bestQualityPrice,
  fastestName,
  fastestPrice,
  largestContextName,
  largestContextSize,
}) {
  return (
    <aside className="model-intelligence-panel">
      <h3 className="model-intelligence-title">Model Intelligence</h3>
      <InsightRow
        icon="💰"
        label="Cheapest Model"
        name={cheapestName ?? '—'}
        value={cheapestPrice ?? ''}
        visualVariant="cheapest"
      />
      <InsightRow
        icon="⭐"
        label="Best Quality"
        name={bestQualityName ?? '—'}
        value={bestQualityPrice ?? ''}
        visualVariant="bestQuality"
      />
      <InsightRow
        icon="⚡"
        label="Fastest Model"
        name={fastestName ?? '—'}
        value={fastestPrice ?? ''}
        visualVariant="fastest"
      />
      <InsightRow
        icon="📚"
        label="Largest Context"
        name={largestContextName ?? '—'}
        value={largestContextSize ?? ''}
        visualVariant="largest"
      />
    </aside>
  );
}
