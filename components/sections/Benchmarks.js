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

const HEATMAP_STRONG = 70;
const HEATMAP_AVERAGE = 40;

const RADAR_SUBJECT_TO_KEY = {
  Reasoning: 'reasoning',
  Code: 'code',
  'Text ELO': 'arena',
  MMLU: 'mmlu',
};

function HeatmapCell({ score, metricKey }) {
  const optionalArena = metricKey === 'arenaCode' || metricKey === 'arenaDocument';
  if (optionalArena && (score == null || typeof score !== 'number' || Number.isNaN(score))) {
    return (
      <span className="benchmark-heatmap-cell" title="No matching row on this LMArena leaderboard">
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
      ? `${display} ELO (${board}); heatmap maps ELO → 0–100 for color bands`
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

const HF_LEADERBOARD_URL = 'https://huggingface.co/datasets/open-llm-leaderboard/contents';
const ARENA_TEXT_URL = 'https://lmarena.ai/leaderboard/text';
const ARENA_CODE_URL = 'https://lmarena.ai/leaderboard/code';
const ARENA_DOCUMENT_URL = 'https://lmarena.ai/leaderboard/document';

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
    const byArena = [...rows]
      .filter((r) => num(r.arena) >= ARENA_ELO_THRESHOLD)
      .sort((a, b) => num(b.arena) - num(a.arena))
      .slice(0, TOP_N);
    return { byReasoning, byCode, byMmlu, byArena };
  }, [rows]);

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

  return (
    <section className="page-section" id="section-benchmark">
      <div className="benchmark-header-row">
        <div>
          <h2 className="section-title">📊 Benchmarks Leaderboard</h2>
          <p className="section-subtitle">
            <strong>MMLU, Code (capability), and Reasoning</strong> use a <strong>0–100-style</strong> scale (Hugging Face % or in-app tier estimates) — not LMArena ELO.
            <strong> Arena text / code / document</strong> columns show <strong>four-digit ELO</strong> from LMArena when <code>benchmarks.json</code> is up to date; if you only see ~80–97 in Arena text, refresh benchmarks (workflow or <code>node scripts/update-benchmarks.js</code>).
          </p>
          <details className="benchmark-sources-panel">
            <summary className="benchmark-sources-summary">Where these scores come from</summary>
            <div className="benchmark-sources-body">
              <p className="benchmark-sources-lead">
                Numbers are merged from public leaderboards where possible, then filled with tier-based estimates when there is no match.
                The bundled file&apos;s <strong>updated</strong> date is <strong>{benchmarksLastUpdated}</strong>.
                Your footer shows when this browser last loaded pricing and benchmarks.
              </p>
              <ul className="benchmark-sources-list">
                <li>
                  <strong>MMLU</strong> — From the{' '}
                  <a href={HF_LEADERBOARD_URL} target="_blank" rel="noopener noreferrer">Hugging Face Open LLM Leaderboard</a>{' '}
                  (<em>MMLU-PRO</em>) when the weekly build matches the model name; otherwise an in-app tier estimate.
                </li>
                <li>
                  <strong>Reasoning</strong> — From the same HF leaderboard (<em>MATH Lvl 5</em> / <em>BBH</em>) when matched; otherwise tier estimates.
                </li>
                <li>
                  <strong>Code</strong> — In-app tier estimates only (the pipeline does not pull a separate code benchmark column from that HF slice today).
                </li>
                <li>
                  <strong>Arena</strong> — From the{' '}
                  <a href={ARENA_TEXT_URL} target="_blank" rel="noopener noreferrer">LMArena text</a>,{' '}
                  <a href={ARENA_CODE_URL} target="_blank" rel="noopener noreferrer">code</a>, and{' '}
                  <a href={ARENA_DOCUMENT_URL} target="_blank" rel="noopener noreferrer">document</a> leaderboards (each is its own <strong>ELO</strong> scale, typically four digits). Image / video arenas on the site are separate URLs and are not imported here yet. If there is no row match, <strong>Text</strong> falls back to a 0–100 tier estimate; <strong>Code</strong> / <strong>Doc</strong> show —.
                </li>
              </ul>
              <p className="benchmark-sources-note">
                The radar chart uses 0–100 on every axis: MMLU, Code, and Reasoning are clamped to 100; Arena <strong>ELO is linearly mapped</strong> into 0–100 (~1150–1650 → 0–100) so shapes are comparable. Heatmap colors use the same mapping for Arena; the table still shows raw ELO when available.
              </p>
            </div>
          </details>
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
          <h3 className="benchmark-leaderboard-title">🏆 Best text Arena (ELO)</h3>
          <ol className="benchmark-leaderboard-list">
            {leaderboards.byArena.map((m, i) => (
              <li key={i}>
                <span className="benchmark-leaderboard-rank">#{i + 1}</span>
                <span className="benchmark-leaderboard-name">{m.name}</span>
                <span className="benchmark-leaderboard-score">{m.arena}</span>
              </li>
            ))}
            {leaderboards.byArena.length === 0 && (
              <li className="benchmark-leaderboard-empty">No text ELO in data (run benchmark update or check matches).</li>
            )}
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
          <span className="benchmark-heatmap-legend-item"><span className="benchmark-heatmap-dot benchmark-heatmap-strong" /> Strong ({HEATMAP_STRONG}–100 scale)</span>
          <span className="benchmark-heatmap-legend-item"><span className="benchmark-heatmap-dot benchmark-heatmap-average" /> Average ({HEATMAP_AVERAGE}–{HEATMAP_STRONG - 1})</span>
          <span className="benchmark-heatmap-legend-item"><span className="benchmark-heatmap-dot benchmark-heatmap-weak" /> Weak (0–{HEATMAP_AVERAGE - 1})</span>
          <span className="benchmark-heatmap-legend-item benchmark-heatmap-legend-note">Arena columns: raw ELO in cells; colors map ELO → 0–100. MMLU / Code / Reasoning stay on 0–100.</span>
        </p>
        <div className="benchmark-table-scroll">
          <table className="model-table">
            <thead>
              <tr>
                <th>Model</th>
                <th className="benchmark-sortable" scope="col" title="MMLU-PRO (or similar) from Hugging Face Open LLM Leaderboard when matched; else tier estimate. Higher = better.">
                  <button type="button" className="benchmark-sort-btn" onClick={() => handleSort('mmlu')} aria-label={sortColumn === 'mmlu' ? `Sorted by MMLU ${sortDirection === 'asc' ? 'ascending' : 'descending'}. Click to change.` : 'Sort by MMLU'}>
                    MMLU
                    <span className={`benchmark-sort-icon${sortColumn === 'mmlu' ? ' benchmark-sort-icon-active' : ''}`} aria-hidden="true">{sortColumn === 'mmlu' ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
                  </button>
                </th>
                <th className="benchmark-sortable" scope="col" title="Approximate code capability tier (in-app estimates). Not from HumanEval in the current pipeline. Higher = better.">
                  <button type="button" className="benchmark-sort-btn" onClick={() => handleSort('code')} aria-label={sortColumn === 'code' ? `Sorted by Code ${sortDirection === 'asc' ? 'ascending' : 'descending'}. Click to change.` : 'Sort by Code'}>
                    Code
                    <span className={`benchmark-sort-icon${sortColumn === 'code' ? ' benchmark-sort-icon-active' : ''}`} aria-hidden="true">{sortColumn === 'code' ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
                  </button>
                </th>
                <th className="benchmark-sortable" scope="col" title="MATH Lvl 5 / BBH from Hugging Face Open LLM Leaderboard when matched; else tier estimate. Higher = better.">
                  <button type="button" className="benchmark-sort-btn" onClick={() => handleSort('reasoning')} aria-label={sortColumn === 'reasoning' ? `Sorted by Reasoning ${sortDirection === 'asc' ? 'ascending' : 'descending'}. Click to change.` : 'Sort by Reasoning'}>
                    Reasoning
                    <span className={`benchmark-sort-icon${sortColumn === 'reasoning' ? ' benchmark-sort-icon-active' : ''}`} aria-hidden="true">{sortColumn === 'reasoning' ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
                  </button>
                </th>
                <th className="benchmark-sortable" scope="col" title="LMArena text chat ELO (four digits) when matched; else 0–100 tier estimate. Higher = better.">
                  <button type="button" className="benchmark-sort-btn" onClick={() => handleSort('arena')} aria-label={sortColumn === 'arena' ? `Sorted by text ELO ${sortDirection === 'asc' ? 'ascending' : 'descending'}. Click to change.` : 'Sort by text ELO'}>
                    Text ELO
                    <span className={`benchmark-sort-icon${sortColumn === 'arena' ? ' benchmark-sort-icon-active' : ''}`} aria-hidden="true">{sortColumn === 'arena' ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
                  </button>
                </th>
                <th className="benchmark-sortable" scope="col" title="LMArena code arena ELO when this model appears on that leaderboard; — if no match.">
                  <button type="button" className="benchmark-sort-btn" onClick={() => handleSort('arenaCode')} aria-label={sortColumn === 'arenaCode' ? `Sorted by code ELO ${sortDirection === 'asc' ? 'ascending' : 'descending'}. Click to change.` : 'Sort by code ELO'}>
                    Code ELO
                    <span className={`benchmark-sort-icon${sortColumn === 'arenaCode' ? ' benchmark-sort-icon-active' : ''}`} aria-hidden="true">{sortColumn === 'arenaCode' ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
                  </button>
                </th>
                <th className="benchmark-sortable" scope="col" title="LMArena document arena ELO when matched; — if no match.">
                  <button type="button" className="benchmark-sort-btn" onClick={() => handleSort('arenaDocument')} aria-label={sortColumn === 'arenaDocument' ? `Sorted by document ELO ${sortDirection === 'asc' ? 'ascending' : 'descending'}. Click to change.` : 'Sort by document ELO'}>
                    Doc ELO
                    <span className={`benchmark-sort-icon${sortColumn === 'arenaDocument' ? ' benchmark-sort-icon-active' : ''}`} aria-hidden="true">{sortColumn === 'arenaDocument' ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
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
                  <td className="benchmark-score"><HeatmapCell score={m.mmlu} metricKey="mmlu" /></td>
                  <td className="benchmark-score"><HeatmapCell score={m.code} metricKey="code" /></td>
                  <td className="benchmark-score"><HeatmapCell score={m.reasoning} metricKey="reasoning" /></td>
                  <td className="benchmark-score"><HeatmapCell score={m.arena} metricKey="arena" /></td>
                  <td className="benchmark-score"><HeatmapCell score={m.arenaCode} metricKey="arenaCode" /></td>
                  <td className="benchmark-score"><HeatmapCell score={m.arenaDocument} metricKey="arenaDocument" /></td>
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
            <li><strong>Each axis</strong> is one benchmark: <strong>Reasoning</strong> (top), <strong>Code</strong> (capability, left), <strong>Text ELO</strong> (LMArena chat, right), <strong>MMLU</strong> (bottom).</li>
            <li>
              <strong>Scale 0–100 on the chart:</strong> MMLU, Code, and Reasoning are shown up to 100. Arena uses <strong>ELO mapped</strong> into 0–100 (see note above); tooltips list the raw value (ELO or score).
            </li>
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
                      const metricKey = RADAR_SUBJECT_TO_KEY[subject] || 'mmlu';
                      return (
                        <div className="benchmark-radar-tooltip">
                          <div className="benchmark-radar-tooltip-title">{subject}</div>
                          <ul className="benchmark-radar-tooltip-list">
                            {radarChartData.selected.map((row, i) => (
                              <li key={row.name} style={{ color: RADAR_COLORS[i % RADAR_COLORS.length] }}>
                                <span className="benchmark-radar-tooltip-name">{row.name}</span>
                                <span className="benchmark-radar-tooltip-value">
                                  {formatBenchmarkTooltipValue(row[metricKey], metricKey)}
                                </span>
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
