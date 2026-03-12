'use client';

import { useState, useMemo } from 'react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, ResponsiveContainer, Tooltip } from 'recharts';
import { usePricing } from '../../context/PricingContext';
import { getAllModels, getBenchmarkForModelMerged, getCostTierLabel } from '../../src/calculator.js';
import { escapeCsvCell, drawPdfBorderedTable } from '../../src/render.js';

const RADAR_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f97316', '#a855f7', '#06b6d4', '#ec4899', '#eab308', '#f43f5e', '#14b8a6',
];

const HEATMAP_STRONG = 70;
const HEATMAP_AVERAGE = 40;

function getScoreTier(score) {
  const n = typeof score === 'number' && !Number.isNaN(score) ? score : -1;
  if (n < 0) return null;
  if (n >= HEATMAP_STRONG) return 'strong';
  if (n >= HEATMAP_AVERAGE) return 'average';
  return 'weak';
}

function HeatmapCell({ score }) {
  const tier = getScoreTier(score);
  const display = tier != null ? Number(score) : '—';
  return (
    <span className={`benchmark-heatmap-cell${tier ? ` benchmark-heatmap-${tier}` : ''}`} title={tier ? `${display} — ${tier}` : 'No data'}>
      {tier != null && <span className="benchmark-heatmap-dot" aria-hidden="true" />}
      <span className="benchmark-heatmap-value">{display}</span>
    </span>
  );
}

export function Benchmarks() {
  const { getData, getBenchmarksData, showToast } = usePricing();
  const data = getData();
  const fileBenchmarks = getBenchmarksData();
  const all = useMemo(() => getAllModels(data), [data]);

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
        return { name: m.name, mmlu: b.mmlu, code: b.code, reasoning: b.reasoning, arena: b.arena, costTier: tier, costTitle };
      }),
    [allUniqueByName, fileBenchmarks]
  );

  const TOP_N = 5;
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
      let va, vb;
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

  const leaderboards = useMemo(() => {
    const num = (v) => (typeof v === 'number' && !Number.isNaN(v) ? v : -1);
    const byReasoning = [...rows].filter((r) => num(r.reasoning) >= 0).sort((a, b) => num(b.reasoning) - num(a.reasoning)).slice(0, TOP_N);
    const byCode = [...rows].filter((r) => num(r.code) >= 0).sort((a, b) => num(b.code) - num(a.code)).slice(0, TOP_N);
    const byMmlu = [...rows].filter((r) => num(r.mmlu) >= 0).sort((a, b) => num(b.mmlu) - num(a.mmlu)).slice(0, TOP_N);
    const byArena = [...rows].filter((r) => num(r.arena) >= 0).sort((a, b) => num(b.arena) - num(a.arena)).slice(0, TOP_N);
    return { byReasoning, byCode, byMmlu, byArena };
  }, [rows]);

  const radarChartData = useMemo(() => {
    const selected = rows.filter((r) => selectedRadarModels.includes(r.name));
    if (selected.length === 0) return { data: [], selected: [] };
    const num = (v) => (typeof v === 'number' && !Number.isNaN(v) ? v : 0);
    const subjects = [
      { subject: 'Reasoning', key: 'reasoning' },
      { subject: 'Code', key: 'code' },
      { subject: 'Arena', key: 'arena' },
      { subject: 'MMLU', key: 'mmlu' },
    ];
    const data = subjects.map(({ subject, key }) => {
      const point = { subject, fullMark: 100 };
      selected.forEach((row, i) => {
        point['m' + i] = Math.min(100, Math.max(0, num(row[key])));
      });
      return point;
    });
    return { data, selected };
  }, [rows, selectedRadarModels]);

  const exportCSV = () => {
    const csvRows = ['Model,MMLU,Code,Reasoning,Arena,Cost tier'];
    rows.forEach((m) => csvRows.push([m.name, m.mmlu, m.code, m.reasoning, m.arena, m.costTier].map(escapeCsvCell).join(',')));
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
      const headers = ['Model', 'MMLU', 'Code', 'Reasoning', 'Arena', 'Cost'];
      const colWidths = [50, 28, 28, 32, 28, 24];
      const pdfRows = rows.map((m) => [m.name, m.mmlu, m.code, m.reasoning, m.arena, m.costTier]);
      drawPdfBorderedTable(doc, 32, headers, pdfRows, colWidths);
      doc.save('ai-benchmarks-' + new Date().toISOString().slice(0, 10) + '.pdf');
      showToast('Benchmarks exported as PDF.', 'success');
    } catch (_) {
      showToast('PDF export failed.', 'error');
    }
  };

  return (
    <section className="page-section" id="section-benchmark">
      <div className="benchmark-header-row">
        <div>
          <h2 className="section-title">📊 Benchmarks Leaderboard</h2>
          <p className="section-subtitle">Model benchmarks (MMLU, Code, Reasoning, Arena) and cost tier. Use Export to download CSV or PDF.</p>
        </div>
        <div className="benchmark-export-toolbar">
          <span className="export-label">Export:</span>
          <button type="button" className="export-btn csv" onClick={exportCSV} title="Download benchmarks as CSV">📄 CSV</button>
          <button type="button" className="export-btn pdf" onClick={exportPDF} title="Download benchmarks as PDF">📕 PDF</button>
        </div>
      </div>
      <div className="benchmark-content-wrap">
      <div className="benchmark-leaderboard" aria-label="Benchmark leaderboards">
        <div className="benchmark-leaderboard-card">
          <h3 className="benchmark-leaderboard-title">🏆 Best Reasoning Models</h3>
          <ol className="benchmark-leaderboard-list">
            {leaderboards.byReasoning.map((m, i) => (
              <li key={i}>
                <span className="benchmark-leaderboard-rank">#{i + 1}</span>
                <span className="benchmark-leaderboard-name">{m.name}</span>
                <span className="benchmark-leaderboard-score">{m.reasoning}</span>
              </li>
            ))}
            {leaderboards.byReasoning.length === 0 && <li className="benchmark-leaderboard-empty">No data</li>}
          </ol>
        </div>
        <div className="benchmark-leaderboard-card">
          <h3 className="benchmark-leaderboard-title">🏆 Best Coding Models</h3>
          <ol className="benchmark-leaderboard-list">
            {leaderboards.byCode.map((m, i) => (
              <li key={i}>
                <span className="benchmark-leaderboard-rank">#{i + 1}</span>
                <span className="benchmark-leaderboard-name">{m.name}</span>
                <span className="benchmark-leaderboard-score">{m.code}</span>
              </li>
            ))}
            {leaderboards.byCode.length === 0 && <li className="benchmark-leaderboard-empty">No data</li>}
          </ol>
        </div>
        <div className="benchmark-leaderboard-card">
          <h3 className="benchmark-leaderboard-title">🏆 Best General Intelligence</h3>
          <ol className="benchmark-leaderboard-list">
            {leaderboards.byMmlu.map((m, i) => (
              <li key={i}>
                <span className="benchmark-leaderboard-rank">#{i + 1}</span>
                <span className="benchmark-leaderboard-name">{m.name}</span>
                <span className="benchmark-leaderboard-score">{m.mmlu}</span>
              </li>
            ))}
            {leaderboards.byMmlu.length === 0 && <li className="benchmark-leaderboard-empty">No data</li>}
          </ol>
        </div>
        <div className="benchmark-leaderboard-card">
          <h3 className="benchmark-leaderboard-title">🏆 Best Arena Score</h3>
          <ol className="benchmark-leaderboard-list">
            {leaderboards.byArena.map((m, i) => (
              <li key={i}>
                <span className="benchmark-leaderboard-rank">#{i + 1}</span>
                <span className="benchmark-leaderboard-name">{m.name}</span>
                <span className="benchmark-leaderboard-score">{m.arena}</span>
              </li>
            ))}
            {leaderboards.byArena.length === 0 && <li className="benchmark-leaderboard-empty">No data</li>}
          </ol>
        </div>
      </div>
      <div className="benchmark-table-col">
        <div className="benchmark-search-wrap">
          <label htmlFor="benchmark-search" className="benchmark-search-label">Search models</label>
          <input
            type="search"
            id="benchmark-search"
            className="benchmark-search-input"
            placeholder="e.g. gpt-4, gemini, claude…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Filter benchmark table by model name"
          />
          {searchQuery.trim() && (
            <span className="benchmark-search-hint">{filteredRows.length} of {rows.length} models</span>
          )}
        </div>
      <div id="benchmark-dashboard-table" className="benchmark-dashboard-table">
        <p className="benchmark-heatmap-legend" aria-hidden="true">
          <span className="benchmark-heatmap-legend-item"><span className="benchmark-heatmap-dot benchmark-heatmap-strong" /> Strong ({HEATMAP_STRONG}–100)</span>
          <span className="benchmark-heatmap-legend-item"><span className="benchmark-heatmap-dot benchmark-heatmap-average" /> Average ({HEATMAP_AVERAGE}–{HEATMAP_STRONG - 1})</span>
          <span className="benchmark-heatmap-legend-item"><span className="benchmark-heatmap-dot benchmark-heatmap-weak" /> Weak (0–{HEATMAP_AVERAGE - 1})</span>
        </p>
        <div className="benchmark-table-scroll">
          <table className="model-table">
            <thead>
              <tr>
                <th>Model</th>
                <th className="benchmark-sortable" scope="col" title="Massive Multitask Language Understanding — broad knowledge. Higher = better.">
                  <button type="button" className="benchmark-sort-btn" onClick={() => handleSort('mmlu')} aria-label={sortColumn === 'mmlu' ? `Sorted by MMLU ${sortDirection === 'asc' ? 'ascending' : 'descending'}. Click to change.` : 'Sort by MMLU'}>
                    MMLU
                    <span className={`benchmark-sort-icon${sortColumn === 'mmlu' ? ' benchmark-sort-icon-active' : ''}`} aria-hidden="true">{sortColumn === 'mmlu' ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
                  </button>
                </th>
                <th className="benchmark-sortable" scope="col" title="HumanEval — code generation. Higher = better.">
                  <button type="button" className="benchmark-sort-btn" onClick={() => handleSort('code')} aria-label={sortColumn === 'code' ? `Sorted by Code ${sortDirection === 'asc' ? 'ascending' : 'descending'}. Click to change.` : 'Sort by Code'}>
                    Code
                    <span className={`benchmark-sort-icon${sortColumn === 'code' ? ' benchmark-sort-icon-active' : ''}`} aria-hidden="true">{sortColumn === 'code' ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
                  </button>
                </th>
                <th className="benchmark-sortable" scope="col" title="GSM8K — reasoning. Higher = better.">
                  <button type="button" className="benchmark-sort-btn" onClick={() => handleSort('reasoning')} aria-label={sortColumn === 'reasoning' ? `Sorted by Reasoning ${sortDirection === 'asc' ? 'ascending' : 'descending'}. Click to change.` : 'Sort by Reasoning'}>
                    Reasoning
                    <span className={`benchmark-sort-icon${sortColumn === 'reasoning' ? ' benchmark-sort-icon-active' : ''}`} aria-hidden="true">{sortColumn === 'reasoning' ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
                  </button>
                </th>
                <th className="benchmark-sortable" scope="col" title="Arena / leaderboard. Higher = better.">
                  <button type="button" className="benchmark-sort-btn" onClick={() => handleSort('arena')} aria-label={sortColumn === 'arena' ? `Sorted by Arena ${sortDirection === 'asc' ? 'ascending' : 'descending'}. Click to change.` : 'Sort by Arena'}>
                    Arena
                    <span className={`benchmark-sort-icon${sortColumn === 'arena' ? ' benchmark-sort-icon-active' : ''}`} aria-hidden="true">{sortColumn === 'arena' ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
                  </button>
                </th>
                <th className="benchmark-sortable" scope="col" title="Cost tier: $ = free/low, $$ = budget, $$$ = premium.">
                  <button type="button" className="benchmark-sort-btn" onClick={() => handleSort('cost')} aria-label={sortColumn === 'cost' ? `Sorted by Cost ${sortDirection === 'asc' ? 'ascending' : 'descending'}. Click to change.` : 'Sort by Cost'}>
                    Cost
                    <span className={`benchmark-sort-icon${sortColumn === 'cost' ? ' benchmark-sort-icon-active' : ''}`} aria-hidden="true">{sortColumn === 'cost' ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((m, i) => (
                <tr key={i}>
                  <td className="model-name">{m.name}</td>
                  <td className="benchmark-score"><HeatmapCell score={m.mmlu} /></td>
                  <td className="benchmark-score"><HeatmapCell score={m.code} /></td>
                  <td className="benchmark-score"><HeatmapCell score={m.reasoning} /></td>
                  <td className="benchmark-score"><HeatmapCell score={m.arena} /></td>
                  <td className="cost-tier" title={m.costTitle}>{m.costTier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>
      </div>

      <div className="benchmark-radar-section" aria-label="Benchmark radar comparison">
        <h3 className="benchmark-radar-title">📡 Benchmark Radar Comparison</h3>
        <p className="benchmark-radar-subtitle">Select 2 or more models to compare strengths across four benchmarks.</p>
        <div className="benchmark-radar-how-to" role="region" aria-label="How to read the radar chart">
          <strong className="benchmark-radar-how-to-title">How to read this chart</strong>
          <ul className="benchmark-radar-how-to-list">
            <li><strong>Each axis</strong> is one benchmark: <strong>Reasoning</strong> (top), <strong>Code</strong> (left), <strong>Arena</strong> (right), <strong>MMLU</strong> (bottom).</li>
            <li><strong>Scale 0–100:</strong> The center is 0, the outer edge is 100. Higher is better.</li>
            <li><strong>Each colored shape</strong> is one model. The farther a point is from the center on an axis, the better that model scores on that benchmark.</li>
            <li>Compare models by shape size and overlap: a larger area toward the edges means stronger all-round performance.</li>
          </ul>
        </div>
        <div className="benchmark-radar-layout">
          <div className="benchmark-radar-checkboxes-wrap">
            <div className="benchmark-radar-checkboxes-header">
              <label htmlFor="benchmark-radar-search" className="benchmark-radar-checkboxes-label">Search & select models</label>
              <button
                type="button"
                className="benchmark-radar-clear-btn"
                onClick={() => { setSelectedRadarModels([]); setRadarModelSearch(''); }}
                disabled={selectedRadarModels.length === 0 && !radarModelSearch.trim()}
                aria-label="Clear selection and search"
              >
                Clear
              </button>
            </div>
            <input
              type="search"
              id="benchmark-radar-search"
              className="benchmark-radar-search-input"
              placeholder="e.g. gpt-4, gemini, claude…"
              value={radarModelSearch}
              onChange={(e) => setRadarModelSearch(e.target.value)}
              aria-label="Search models to add to radar comparison"
            />
            <div className="benchmark-radar-checkboxes">
              {radarModelList.map((m) => (
                <label key={m.name} className="benchmark-radar-checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedRadarModels.includes(m.name)}
                    onChange={() => toggleRadarModel(m.name)}
                    aria-label={`Compare ${m.name} in radar`}
                  />
                  <span className="benchmark-radar-checkbox-text">{m.name}</span>
                </label>
              ))}
            </div>
            {radarModelList.length === 0 && (
              <p className="benchmark-radar-hint">No models match your search.</p>
            )}
            {radarModelSearch.trim() && (
              <p className="benchmark-radar-hint">{radarModelList.length} model{radarModelList.length !== 1 ? 's' : ''} match.</p>
            )}
          </div>
          <div className="benchmark-radar-chart-wrap">
            {radarChartData.selected.length >= 2 ? (
              <ResponsiveContainer width="100%" height={520}>
                <RadarChart data={radarChartData.data} margin={{ top: 28, right: 28, bottom: 28, left: 28 }}>
                  <PolarGrid stroke="rgba(255,255,255,0.25)" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: 'var(--theme-text-muted)', fontSize: 14 }}
                    tickLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fill: 'var(--theme-text-muted)', fontSize: 12 }}
                    tickCount={5}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length || !radarChartData.selected.length) return null;
                      const point = payload[0].payload;
                      const subject = point?.subject ?? label ?? '—';
                      return (
                        <div className="benchmark-radar-tooltip">
                          <div className="benchmark-radar-tooltip-title">{subject}</div>
                          <ul className="benchmark-radar-tooltip-list">
                            {radarChartData.selected.map((row, i) => (
                              <li key={row.name} style={{ color: RADAR_COLORS[i % RADAR_COLORS.length] }}>
                                <span className="benchmark-radar-tooltip-name">{row.name}</span>
                                <span className="benchmark-radar-tooltip-value">{point['m' + i] ?? '—'}</span>
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
                      strokeWidth={5}
                    />
                  ))}
                  <Legend wrapperStyle={{ fontSize: '14px' }} iconType="circle" iconSize={14} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <p className="benchmark-radar-placeholder">Select 2 or more models above to see the radar comparison.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
