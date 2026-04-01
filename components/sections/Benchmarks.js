'use client';

import { useState, useMemo } from 'react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, ResponsiveContainer, Tooltip } from 'recharts';
import { usePricing } from '../../context/PricingContext';
import { getChatModels, getBenchmarkForModelMerged, getCostTierLabel } from '../../src/calculator.js';
import {
  ARENA_ELO_THRESHOLD,
  arenaValueToChartScale,
  formatBenchmarkTooltipValue,
  heatmapTierForMetric,
  isArenaEloMetric,
} from '../../src/benchmarkScales.js';
import { escapeCsvCell, drawPdfBorderedTable } from '../../src/render.js';

const RADAR_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f97316', '#a855f7', '#06b6d4', '#ec4899', '#eab308', '#f43f5e', '#14b8a6',
];

/** Radar axis labels — plain language; map to data keys for tooltips */
const RADAR_SUBJECT_TO_KEY = {
  Reasoning: 'reasoning',
  'Coding (est.)': 'code',
  'Chat rank': 'arena',
  Knowledge: 'mmlu',
};

/** Hugging Face Datasets Server — same query as scripts/update-benchmarks.js */
const HF_ROWS_API =
  'https://datasets-server.huggingface.co/rows?dataset=open-llm-leaderboard%2Fcontents&config=default&split=train&offset=0&length=500';

const HF_DATASET_URL = 'https://huggingface.co/datasets/open-llm-leaderboard/contents';
const ARENA_TEXT_URL = 'https://lmarena.ai/leaderboard/text';
const ARENA_CODE_URL = 'https://lmarena.ai/leaderboard/code';
const ARENA_DOCUMENT_URL = 'https://lmarena.ai/leaderboard/document';

function HeatmapCell({ score, metricKey }) {
  const optionalArena = metricKey === 'arenaCode' || metricKey === 'arenaDocument';
  if (optionalArena && (score == null || typeof score !== 'number' || Number.isNaN(score))) {
    return (
      <span
        className="benchmark-heatmap-cell benchmark-heatmap-cell--empty"
        title="This model was not listed on that public leaderboard — not a score of zero"
      >
        <span className="benchmark-heatmap-value">—</span>
      </span>
    );
  }
  const tier = heatmapTierForMetric(score, metricKey);
  let display = '—';
  if (tier != null && typeof score === 'number' && !Number.isNaN(score)) {
    display =
      isArenaEloMetric(metricKey) && score >= ARENA_ELO_THRESHOLD
        ? String(Math.round(score))
        : Number.isInteger(score)
          ? score
          : Number(score.toFixed(1));
  }
  const board =
    metricKey === 'arenaCode' ? 'code tasks' : metricKey === 'arenaDocument' ? 'documents' : 'chat';
  const tierWord = tier === 'strong' ? 'stronger' : tier === 'average' ? 'middle' : tier === 'weak' ? 'lower' : tier;
  const titleHint =
    isArenaEloMetric(metricKey) && typeof score === 'number' && score >= ARENA_ELO_THRESHOLD
      ? `Leaderboard score for ${board}: ${display} (higher = ranked better in public blind tests). Dot color is a rough band.`
      : isArenaEloMetric(metricKey) && typeof score === 'number' && score < ARENA_ELO_THRESHOLD
        ? `Approximate tier (${display} on 0–100) — refresh benchmark data to try to get a real leaderboard score.`
        : tier
          ? `${display} — ${tierWord} on a 0–100 style scale (higher is better)`
          : 'No data';
  return (
    <span className={`benchmark-heatmap-cell${tier ? ` benchmark-heatmap-${tier}` : ''}`} title={titleHint}>
      {tier != null && <span className="benchmark-heatmap-dot" aria-hidden="true" />}
      <span className="benchmark-heatmap-value">{display}</span>
    </span>
  );
}

function SortTh({ column, label, subtitle, sortColumn, sortDirection, onSort, title }) {
  const active = sortColumn === column;
  const dirWord = sortDirection === 'asc' ? 'ascending' : 'descending';
  const ariaBase = subtitle ? `${label}, ${subtitle}` : label;
  return (
    <th className="benchmark-th-num benchmark-sortable" scope="col" title={title}>
      <button
        type="button"
        className="benchmark-sort-btn"
        onClick={() => onSort(column)}
        aria-label={active ? `${ariaBase} sorted ${dirWord}. Click to reverse.` : `Sort by ${ariaBase}`}
      >
        <span className="benchmark-sort-btn-stack">
          <span className="benchmark-sort-btn-label">{label}</span>
          {subtitle ? <span className="benchmark-sort-btn-sub">{subtitle}</span> : null}
        </span>
        <span className={`benchmark-sort-icon${active ? ' benchmark-sort-icon-active' : ''}`} aria-hidden="true">
          {active ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  );
}

export function Benchmarks() {
  const { getData, getBenchmarksData, showToast, benchmarksLastUpdated } = usePricing();
  const data = getData();
  const fileBenchmarks = getBenchmarksData();
  const all = useMemo(() => getChatModels(data), [data]);

  const allUniqueByName = useMemo(() => {
    const seen = new Set();
    return all.filter((m) => {
      const key = (m.name || '').trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [all]);

  const rows = useMemo(
    () =>
      allUniqueByName.map((m) => {
        const b = getBenchmarkForModelMerged(m.name, m.providerKey, Array.isArray(fileBenchmarks) ? fileBenchmarks : null);
        const { tier, desc } = getCostTierLabel(m.blended);
        const blendedStr = m.blended <= 0 ? '0' : m.blended.toFixed(2);
        const costTitle = `Blended: $${blendedStr}/1M tokens (70% input, 30% output) — ${desc}`;
        return {
          name: m.name,
          mmlu: b.mmlu,
          code: b.code,
          reasoning: b.reasoning,
          arena: b.arena,
          arenaCode: b.arenaCode,
          arenaDocument: b.arenaDocument,
          costTier: tier,
          costTitle,
        };
      }),
    [allUniqueByName, fileBenchmarks]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRadarModels, setSelectedRadarModels] = useState([]);
  const [radarModelSearch, setRadarModelSearch] = useState('');
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection(column === 'cost' ? 'asc' : 'desc');
    }
  };

  const radarModelList = useMemo(() => {
    const q = (radarModelSearch || '').trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.name || '').toLowerCase().includes(q));
  }, [rows, radarModelSearch]);

  const toggleRadarModel = (name) => {
    setSelectedRadarModels((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const filteredRows = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.name || '').toLowerCase().includes(q));
  }, [rows, searchQuery]);

  const sortedRows = useMemo(() => {
    if (!sortColumn) return filteredRows;
    const list = [...filteredRows];
    const num = (v) => (typeof v === 'number' && !Number.isNaN(v) ? v : -1);
    const costOrder = (t) => (t === '$' ? 1 : t === '$$' ? 2 : t === '$$$' ? 3 : 0);
    list.sort((a, b) => {
      let va;
      let vb;
      if (sortColumn === 'cost') {
        va = costOrder(a.costTier);
        vb = costOrder(b.costTier);
      } else {
        va = num(a[sortColumn]);
        vb = num(b[sortColumn]);
      }
      if (va < vb) return sortDirection === 'asc' ? -1 : 1;
      if (va > vb) return sortDirection === 'asc' ? 1 : -1;
      return (a.name || '').localeCompare(b.name || '');
    });
    return list;
  }, [filteredRows, sortColumn, sortDirection]);

  const radarChartData = useMemo(() => {
    const selected = rows.filter((r) => selectedRadarModels.includes(r.name));
    if (selected.length === 0) return { data: [], selected: [] };
    const num = (v) => (typeof v === 'number' && !Number.isNaN(v) ? v : 0);
    const subjects = [
      { subject: 'Reasoning', key: 'reasoning' },
      { subject: 'Coding (est.)', key: 'code' },
      { subject: 'Chat rank', key: 'arena' },
      { subject: 'Knowledge', key: 'mmlu' },
    ];
    const data = subjects.map(({ subject, key }) => {
      const point = { subject, fullMark: 100 };
      selected.forEach((row, i) => {
        const v = num(row[key]);
        point['m' + i] = key === 'arena' ? arenaValueToChartScale(v) : Math.min(100, Math.max(0, v));
      });
      return point;
    });
    return { data, selected };
  }, [rows, selectedRadarModels]);

  const exportCSV = () => {
    const csvRows = ['Model,Knowledge (0-100),Coding (est),Reasoning (0-100),Chat rank ELO,Code rank ELO,Doc rank ELO,Cost tier'];
    rows.forEach((m) =>
      csvRows.push(
        [m.name, m.mmlu, m.code, m.reasoning, m.arena, m.arenaCode ?? '', m.arenaDocument ?? '', m.costTier].map(escapeCsvCell).join(',')
      )
    );
    const csv = '\uFEFF' + csvRows.join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'ai-benchmarks-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Benchmarks exported as CSV.', 'success');
  };

  const exportPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      doc.setFontSize(14);
      doc.text('Model benchmark dashboard', pageW / 2, 18, { align: 'center' });
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text('Exported: ' + new Date().toLocaleDateString(undefined, { dateStyle: 'long' }), pageW / 2, 25, { align: 'center' });
      doc.setTextColor(0, 0, 0);
      const headers = ['Model', 'Know.', 'Code est.', 'Reas.', 'Chat ELO', 'Code ELO', 'Doc ELO', 'Cost'];
      const colWidths = [44, 22, 20, 22, 22, 22, 22, 14];
      const pdfRows = rows.map((m) => [
        m.name,
        m.mmlu,
        m.code,
        m.reasoning,
        m.arena,
        m.arenaCode ?? '—',
        m.arenaDocument ?? '—',
        m.costTier,
      ]);
      drawPdfBorderedTable(doc, 32, headers, pdfRows, colWidths);
      doc.save('ai-benchmarks-' + new Date().toISOString().slice(0, 10) + '.pdf');
      showToast('Benchmarks exported as PDF.', 'success');
    } catch (_) {
      showToast('PDF export failed.', 'error');
    }
  };

  const externalLinkProps = { target: '_blank', rel: 'noopener noreferrer' };

  return (
    <section className="page-section" id="section-benchmark">
      <header className="benchmark-page-head">
        <div className="benchmark-page-head-text">
          <h2 className="section-title benchmark-page-title">Benchmarks</h2>
          <p className="benchmark-page-meta">
            <span className="benchmark-meta-plain">
              Scores in this table were last bundled on <strong>{benchmarksLastUpdated}</strong>. The site footer shows when your browser last loaded data.
            </span>
          </p>
        </div>
        <div className="benchmark-export-toolbar" role="toolbar" aria-label="Export benchmarks">
          <button type="button" className="export-btn csv" onClick={exportCSV}>
            CSV
          </button>
          <button type="button" className="export-btn pdf" onClick={exportPDF}>
            PDF
          </button>
        </div>
      </header>

      <details className="benchmark-sources-card benchmark-sources-disclosure">
        <summary className="benchmark-sources-summary">
          <span className="benchmark-sources-summary-text">Where do these numbers come from?</span>
        </summary>
        <div className="benchmark-sources-disclosure-body">
        <p className="benchmark-sources-intro">
          We combine <strong>public leaderboards</strong> with simple <strong>in-app estimates</strong> when a model is not listed. The table below uses the same links our weekly update script uses. Technical detail: <code className="benchmark-code">scripts/update-benchmarks.js</code>.
        </p>
        <div className="benchmark-sources-table-wrap">
          <table className="benchmark-sources-table">
            <thead>
              <tr>
                <th scope="col">What you see</th>
                <th scope="col">In plain words</th>
                <th scope="col">Where we get it</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Knowledge</td>
                <td className="benchmark-sources-plain">Broad school-style knowledge (many subjects). Higher = better.</td>
                <td>
                  <a href={HF_DATASET_URL} {...externalLinkProps}>
                    Open LLM Leaderboard (Hugging Face)
                  </a>
                  <span className="benchmark-sources-detail">
                    {' '}
                    — test score <code>MMLU-PRO</code>, loaded through the{' '}
                    <a href={HF_ROWS_API} {...externalLinkProps}>
                      public data API
                    </a>
                    . If the model name does not match, we show a rough estimate instead.
                  </span>
                </td>
              </tr>
              <tr>
                <td>Reasoning</td>
                <td className="benchmark-sources-plain">Logic and harder math-style questions. Higher = better.</td>
                <td>
                  Same public list — fields like <code>MATH Lvl 5</code> / <code>BBH</code>. If no match, an estimate.
                </td>
              </tr>
              <tr>
                <td>Coding</td>
                <td className="benchmark-sources-plain">Rough “how strong at code” tier inside this app — not the same as the Code ranking column.</td>
                <td>Set inside the app from model family; not copied from a leaderboard cell.</td>
              </tr>
              <tr>
                <td>Chat ranking</td>
                <td className="benchmark-sources-plain">Big number (~thousands) = stronger result on live <strong>chat</strong> blind tests. Not on the same scale as 0–100 columns.</td>
                <td>
                  Copied from the public table at{' '}
                  <a href={ARENA_TEXT_URL} {...externalLinkProps}>
                    lmarena.ai/leaderboard/text
                  </a>
                  . If no match, you may see a small 0–100-style placeholder instead.
                </td>
              </tr>
              <tr>
                <td>Code ranking</td>
                <td className="benchmark-sources-plain">Same idea as chat ranking, but for <strong>code</strong> tasks on LMArena.</td>
                <td>
                  <a href={ARENA_CODE_URL} {...externalLinkProps}>
                    lmarena.ai/leaderboard/code
                  </a>
                  . If the model is not on that list → blank (—).
                </td>
              </tr>
              <tr>
                <td>Doc ranking</td>
                <td className="benchmark-sources-plain">Ranking for <strong>document</strong> tasks on LMArena.</td>
                <td>
                  <a href={ARENA_DOCUMENT_URL} {...externalLinkProps}>
                    lmarena.ai/leaderboard/document
                  </a>
                  . Not on the list → —.
                </td>
              </tr>
              <tr>
                <td>Cost</td>
                <td className="benchmark-sources-plain">$ = cheaper overall, $$$ = pricier (for typical use).</td>
                <td>From current token prices: 70% weight on input + 30% on output per 1M tokens.</td>
              </tr>
            </tbody>
          </table>
        </div>
        </div>
      </details>

      <div className="benchmark-table-block">
        <div className="benchmark-reading-guide" role="region" aria-label="How to read this table">
          <p className="benchmark-reading-guide-title">Quick guide</p>
          <ul className="benchmark-reading-guide-list">
            <li>
              <strong>Higher is better</strong> everywhere, but <strong>0–100 columns</strong> (knowledge, coding estimate, reasoning) are <em>not</em> the same scale as the <strong>big ranking numbers</strong> (chat / code / doc).
            </li>
            <li>
              <strong>Green / yellow / red dots</strong> are a quick visual band (strong / middle / weak) on a 0–100 style scale; ranking columns use the same colors after scaling.
            </li>
            <li>
              <strong>—</strong> in a ranking column means that model did not appear on that public list — not “zero quality.”
            </li>
          </ul>
        </div>
        <div className="benchmark-toolbar-row">
          <div className="benchmark-search-wrap">
            <label htmlFor="benchmark-search" className="benchmark-search-label">
              Find a model
            </label>
            <input
              type="search"
              id="benchmark-search"
              className="benchmark-search-input"
              placeholder="Search by name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Filter benchmark table by model name"
            />
            {searchQuery.trim() ? (
              <span className="benchmark-search-hint">
                {filteredRows.length} / {rows.length}
              </span>
            ) : null}
          </div>
          <div className="benchmark-legend-compact" aria-hidden="true">
            <span className="benchmark-legend-compact-item">
              <span className="benchmark-heatmap-dot benchmark-heatmap-strong" /> Stronger
            </span>
            <span className="benchmark-legend-compact-item">
              <span className="benchmark-heatmap-dot benchmark-heatmap-average" /> Middle
            </span>
            <span className="benchmark-legend-compact-item">
              <span className="benchmark-heatmap-dot benchmark-heatmap-weak" /> Lower
            </span>
            <span className="benchmark-legend-compact-note">Dot = quick band, not a grade</span>
          </div>
        </div>

        <div id="benchmark-dashboard-table" className="benchmark-dashboard-table">
          <div className="benchmark-table-scroll">
            <table className="model-table benchmark-data-table">
              <thead>
                <tr>
                  <th scope="col" className="benchmark-th-model" title="Model name from pricing">
                    Model
                  </th>
                  <SortTh
                    column="mmlu"
                    label="Knowledge"
                    subtitle="0–100"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    title="Broad knowledge test score (higher = better). From public leaderboard or estimate."
                  />
                  <SortTh
                    column="code"
                    label="Coding"
                    subtitle="estimate"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    title="In-app coding strength tier (0–100 style). Not the same as Code ranking."
                  />
                  <SortTh
                    column="reasoning"
                    label="Reasoning"
                    subtitle="0–100"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    title="Logic / math-style score (higher = better). From public data or estimate."
                  />
                  <SortTh
                    column="arena"
                    label="Chat rank"
                    subtitle="ELO"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    title="Live chat leaderboard score from LMArena — large numbers, higher = better. Not comparable to 0–100 columns."
                  />
                  <SortTh
                    column="arenaCode"
                    label="Code rank"
                    subtitle="ELO"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    title="Code-task leaderboard on LMArena. — if model not listed."
                  />
                  <SortTh
                    column="arenaDocument"
                    label="Doc rank"
                    subtitle="ELO"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    title="Document-task leaderboard on LMArena. — if model not listed."
                  />
                  <th className="benchmark-th-num benchmark-sortable" scope="col" title="Price tier: $ cheaper, $$$ pricier (typical blend)">
                    <button
                      type="button"
                      className="benchmark-sort-btn"
                      onClick={() => handleSort('cost')}
                      aria-label={
                        sortColumn === 'cost'
                          ? `Cost sorted ${sortDirection === 'asc' ? 'ascending' : 'descending'}. Click to reverse.`
                          : 'Sort by cost ($ to $$$)'
                      }
                    >
                      <span className="benchmark-sort-btn-stack">
                        <span className="benchmark-sort-btn-label">Cost</span>
                        <span className="benchmark-sort-btn-sub">$ to $$$</span>
                      </span>
                      <span className={`benchmark-sort-icon${sortColumn === 'cost' ? ' benchmark-sort-icon-active' : ''}`} aria-hidden="true">
                        {sortColumn === 'cost' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((m, i) => (
                  <tr key={i}>
                    <td className="model-name benchmark-td-model">{m.name}</td>
                    <td className="benchmark-td-num benchmark-score">
                      <HeatmapCell score={m.mmlu} metricKey="mmlu" />
                    </td>
                    <td className="benchmark-td-num benchmark-score">
                      <HeatmapCell score={m.code} metricKey="code" />
                    </td>
                    <td className="benchmark-td-num benchmark-score">
                      <HeatmapCell score={m.reasoning} metricKey="reasoning" />
                    </td>
                    <td className="benchmark-td-num benchmark-score">
                      <HeatmapCell score={m.arena} metricKey="arena" />
                    </td>
                    <td className="benchmark-td-num benchmark-score">
                      <HeatmapCell score={m.arenaCode} metricKey="arenaCode" />
                    </td>
                    <td className="benchmark-td-num benchmark-score">
                      <HeatmapCell score={m.arenaDocument} metricKey="arenaDocument" />
                    </td>
                    <td className="benchmark-td-num cost-tier benchmark-td-cost" title={m.costTitle}>
                      {m.costTier}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="benchmark-radar-section" aria-label="Compare models on radar chart">
        <h3 className="benchmark-radar-title">Compare models visually</h3>
        <p className="benchmark-radar-subtitle">
          Choose at least two models. The chart uses one simple 0–100 scale on every spoke so shapes are easy to compare — <strong>chat ranking</strong> is scaled down from its real leaderboard number; hover the chart to see the exact values.
        </p>
        <div className="benchmark-radar-layout">
          <div className="benchmark-radar-checkboxes-wrap">
            <div className="benchmark-radar-checkboxes-header">
              <label htmlFor="benchmark-radar-search" className="benchmark-radar-checkboxes-label">
                Models
              </label>
              <button
                type="button"
                className="benchmark-radar-clear-btn"
                onClick={() => {
                  setSelectedRadarModels([]);
                  setRadarModelSearch('');
                }}
                disabled={selectedRadarModels.length === 0 && !radarModelSearch.trim()}
                aria-label="Clear selection"
              >
                Clear
              </button>
            </div>
            <input
              type="search"
              id="benchmark-radar-search"
              className="benchmark-radar-search-input"
              placeholder="Search…"
              value={radarModelSearch}
              onChange={(e) => setRadarModelSearch(e.target.value)}
              aria-label="Search models for radar"
            />
            <div className="benchmark-radar-checkboxes">
              {radarModelList.map((m) => (
                <label key={m.name} className="benchmark-radar-checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedRadarModels.includes(m.name)}
                    onChange={() => toggleRadarModel(m.name)}
                    aria-label={`Include ${m.name}`}
                  />
                  <span className="benchmark-radar-checkbox-text">{m.name}</span>
                </label>
              ))}
            </div>
            {radarModelList.length === 0 ? <p className="benchmark-radar-hint">No matches.</p> : null}
          </div>
          <div className="benchmark-radar-chart-wrap">
            {radarChartData.selected.length >= 2 ? (
              <ResponsiveContainer width="100%" height={480}>
                <RadarChart data={radarChartData.data} margin={{ top: 28, right: 28, bottom: 28, left: 28 }}>
                  <PolarGrid stroke="rgba(255,255,255,0.25)" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: 'var(--theme-text-muted)', fontSize: 11 }}
                    tickLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                  />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: 'var(--theme-text-muted)', fontSize: 11 }} tickCount={5} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length || !radarChartData.selected.length) return null;
                      const point = payload[0].payload;
                      const subject = point?.subject ?? label ?? '—';
                      const metricKey = RADAR_SUBJECT_TO_KEY[subject] || 'mmlu';
                      return (
                        <div className="benchmark-radar-tooltip">
                          <div className="benchmark-radar-tooltip-title">{subject}</div>
                          <ul className="benchmark-radar-tooltip-list">
                            {radarChartData.selected.map((row, i) => (
                              <li key={row.name} style={{ color: RADAR_COLORS[i % RADAR_COLORS.length] }}>
                                <span className="benchmark-radar-tooltip-name">{row.name}</span>
                                <span className="benchmark-radar-tooltip-value">{formatBenchmarkTooltipValue(row[metricKey], metricKey)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    }}
                    cursor={false}
                  />
                  {radarChartData.selected.map((row, i) => (
                    <Radar
                      key={row.name + '-' + i}
                      name={row.name}
                      dataKey={'m' + i}
                      stroke={RADAR_COLORS[i % RADAR_COLORS.length]}
                      fill={RADAR_COLORS[i % RADAR_COLORS.length]}
                      fillOpacity={0}
                      strokeWidth={4}
                    />
                  ))}
                  <Legend wrapperStyle={{ fontSize: '13px' }} iconType="circle" iconSize={12} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <p className="benchmark-radar-placeholder">Select at least two models.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
