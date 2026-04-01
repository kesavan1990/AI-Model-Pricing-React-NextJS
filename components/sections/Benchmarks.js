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

const RADAR_SUBJECT_TO_KEY = {
  Reasoning: 'reasoning',
  Code: 'code',
  'Text ELO': 'arena',
  MMLU: 'mmlu',
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
      <span className="benchmark-heatmap-cell benchmark-heatmap-cell--empty" title="No row matched on this leaderboard">
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
    metricKey === 'arenaCode' ? 'code' : metricKey === 'arenaDocument' ? 'document' : 'text';
  const titleHint =
    isArenaEloMetric(metricKey) && typeof score === 'number' && score >= ARENA_ELO_THRESHOLD
      ? `${display} ELO (${board}); colors map ELO → band`
      : tier
        ? `${display} — ${tier}`
        : 'No data';
  return (
    <span className={`benchmark-heatmap-cell${tier ? ` benchmark-heatmap-${tier}` : ''}`} title={titleHint}>
      {tier != null && <span className="benchmark-heatmap-dot" aria-hidden="true" />}
      <span className="benchmark-heatmap-value">{display}</span>
    </span>
  );
}

function SortTh({ column, label, sortColumn, sortDirection, onSort, title }) {
  const active = sortColumn === column;
  const dirWord = sortDirection === 'asc' ? 'ascending' : 'descending';
  return (
    <th className="benchmark-th-num benchmark-sortable" scope="col" title={title}>
      <button
        type="button"
        className="benchmark-sort-btn"
        onClick={() => onSort(column)}
        aria-label={active ? `${label} sorted ${dirWord}. Click to reverse.` : `Sort by ${label}`}
      >
        <span className="benchmark-sort-btn-label">{label}</span>
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
      { subject: 'Code', key: 'code' },
      { subject: 'Text ELO', key: 'arena' },
      { subject: 'MMLU', key: 'mmlu' },
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
    const csvRows = ['Model,MMLU,Code cap.,Reasoning,Text ELO,Code ELO,Doc ELO,Cost tier'];
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
      const headers = ['Model', 'MMLU', 'Code', 'Reas.', 'Txt ELO', 'Code ELO', 'Doc ELO', 'Cost'];
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
            Data file <code className="benchmark-code">public/benchmarks.json</code>
            <span className="benchmark-meta-sep" aria-hidden="true">
              ·
            </span>
            <span className="benchmark-meta-label">Updated</span> {benchmarksLastUpdated}
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

      <div className="benchmark-sources-card">
        <h3 className="benchmark-sources-heading">How scores are fetched</h3>
        <p className="benchmark-sources-intro">
          Built by <code className="benchmark-code">scripts/update-benchmarks.js</code> (weekly GitHub Action). The footer shows when your browser last loaded data.
        </p>
        <div className="benchmark-sources-table-wrap">
          <table className="benchmark-sources-table">
            <thead>
              <tr>
                <th scope="col">Column</th>
                <th scope="col">Scale</th>
                <th scope="col">Source &amp; method</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>MMLU</td>
                <td className="benchmark-sources-scale">0–100</td>
                <td>
                  <a href={HF_DATASET_URL} {...externalLinkProps}>
                    huggingface.co/datasets/open-llm-leaderboard/contents
                  </a>
                  <span className="benchmark-sources-detail">
                    {' '}
                    — field <code>MMLU-PRO</code> via{' '}
                    <a href={HF_ROWS_API} {...externalLinkProps}>
                      Datasets Server API
                    </a>
                    . No match → tier estimate.
                  </span>
                </td>
              </tr>
              <tr>
                <td>Reasoning</td>
                <td className="benchmark-sources-scale">0–100</td>
                <td>
                  Same dataset/API — <code>MATH Lvl 5</code> / <code>BBH</code>. No match → estimate.
                </td>
              </tr>
              <tr>
                <td>Code</td>
                <td className="benchmark-sources-scale">0–100</td>
                <td>In-app capability tier only (not LMArena Code ELO).</td>
              </tr>
              <tr>
                <td>Text ELO</td>
                <td className="benchmark-sources-scale">ELO</td>
                <td>
                  HTML table scrape of{' '}
                  <a href={ARENA_TEXT_URL} {...externalLinkProps}>
                    lmarena.ai/leaderboard/text
                  </a>
                  . No match → 0–100 fallback.
                </td>
              </tr>
              <tr>
                <td>Code ELO</td>
                <td className="benchmark-sources-scale">ELO</td>
                <td>
                  Scrape{' '}
                  <a href={ARENA_CODE_URL} {...externalLinkProps}>
                    lmarena.ai/leaderboard/code
                  </a>
                  . No match → —.
                </td>
              </tr>
              <tr>
                <td>Doc ELO</td>
                <td className="benchmark-sources-scale">ELO</td>
                <td>
                  Scrape{' '}
                  <a href={ARENA_DOCUMENT_URL} {...externalLinkProps}>
                    lmarena.ai/leaderboard/document
                  </a>
                  . No match → —.
                </td>
              </tr>
              <tr>
                <td>Cost</td>
                <td className="benchmark-sources-scale">Tier</td>
                <td>From live pricing (70% input + 30% output blend per 1M tokens).</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="benchmark-table-block">
        <div className="benchmark-toolbar-row">
          <div className="benchmark-search-wrap">
            <label htmlFor="benchmark-search" className="benchmark-search-label">
              Filter models
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
              <span className="benchmark-heatmap-dot benchmark-heatmap-strong" /> Strong
            </span>
            <span className="benchmark-legend-compact-item">
              <span className="benchmark-heatmap-dot benchmark-heatmap-average" /> Mid
            </span>
            <span className="benchmark-legend-compact-item">
              <span className="benchmark-heatmap-dot benchmark-heatmap-weak" /> Weak
            </span>
            <span className="benchmark-legend-compact-note">ELO columns use color bands mapped from score</span>
          </div>
        </div>

        <div id="benchmark-dashboard-table" className="benchmark-dashboard-table">
          <div className="benchmark-table-scroll">
            <table className="model-table benchmark-data-table">
              <thead>
                <tr>
                  <th scope="col" className="benchmark-th-model">
                    Model
                  </th>
                  <SortTh
                    column="mmlu"
                    label="MMLU"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    title="0–100 from HF or estimate"
                  />
                  <SortTh
                    column="code"
                    label="Code"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    title="0–100 capability tier"
                  />
                  <SortTh
                    column="reasoning"
                    label="Reasoning"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    title="0–100 from HF or estimate"
                  />
                  <SortTh
                    column="arena"
                    label="Text ELO"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    title="LMArena text chat ELO"
                  />
                  <SortTh
                    column="arenaCode"
                    label="Code ELO"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    title="LMArena code arena ELO"
                  />
                  <SortTh
                    column="arenaDocument"
                    label="Doc ELO"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    title="LMArena document arena ELO"
                  />
                  <th className="benchmark-th-num benchmark-sortable" scope="col" title="Cost tier">
                    <button
                      type="button"
                      className="benchmark-sort-btn"
                      onClick={() => handleSort('cost')}
                      aria-label={
                        sortColumn === 'cost'
                          ? `Cost sorted ${sortDirection === 'asc' ? 'ascending' : 'descending'}. Click to reverse.`
                          : 'Sort by cost tier'
                      }
                    >
                      <span className="benchmark-sort-btn-label">Cost</span>
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
        <h3 className="benchmark-radar-title">Compare models</h3>
        <p className="benchmark-radar-subtitle">
          Pick two or more models. Axes are 0–100 on the chart; <strong>Text ELO</strong> is scaled from raw ELO for shape comparison — see tooltips for raw values.
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
                    tick={{ fill: 'var(--theme-text-muted)', fontSize: 13 }}
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
