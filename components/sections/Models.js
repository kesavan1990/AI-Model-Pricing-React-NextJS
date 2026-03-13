'use client';

import { useMemo, useState, useCallback, Fragment } from 'react';
import { usePricing } from '../../context/PricingContext';
import { getAllModels, getChatModels, getBenchmarkForModelMerged } from '../../src/calculator.js';
import { MODEL_TYPES, MODEL_TYPE_LABELS } from '../../lib/modelTypes.js';
import { escapeCsvCell, drawPdfBorderedTable } from '../../src/render.js';

const PROVIDER_ORDER = ['gemini', 'openai', 'anthropic', 'mistral'];
const fmt = (v) => (v === 0 ? 'Free' : '$' + Number(v).toFixed(2));

function formatPriceDisplay(m) {
  if (m.modelType === 'image' && m.pricingPerImage != null) return { input: `$${Number(m.pricingPerImage).toFixed(2)}/img`, output: '—' };
  if (m.modelType === 'audio' && m.pricingPerMinute != null) return { input: `$${Number(m.pricingPerMinute).toFixed(3)}/min`, output: '—' };
  if (m.modelType === 'video' && m.pricingPerSecond != null) return { input: `$${Number(m.pricingPerSecond).toFixed(2)}/sec`, output: '—' };
  return { input: fmt(m.input), output: fmt(m.output) };
}

function getComparisonList(data, providerFilter, sortBy, modelTypeFilter) {
  const all = modelTypeFilter === MODEL_TYPES.CHAT ? getChatModels(data) : modelTypeFilter === 'all' ? getAllModels(data) : getAllModels(data).filter((m) => m.modelType === modelTypeFilter);
  let list = all;
  if (providerFilter && providerFilter !== 'all') list = list.filter((m) => m.providerKey === providerFilter);
  const providerIndex = (m) => PROVIDER_ORDER.indexOf(m.providerKey);
  if (sortBy === 'input') list = [...list].sort((a, b) => (a.input ?? 0) - (b.input ?? 0));
  else if (sortBy === 'output') list = [...list].sort((a, b) => (a.output ?? 0) - (b.output ?? 0));
  else if (sortBy === 'context') list = [...list].sort((a, b) => (b.contextTokens ?? 0) - (a.contextTokens ?? 0));
  else list = [...list].sort((a, b) => { const ga = providerIndex(a); const gb = providerIndex(b); if (ga !== gb) return ga - gb; return (a.blended ?? 0) - (b.blended ?? 0); });
  return list;
}

export function Models() {
  const { getData, getBenchmarksData, comparisonProviderFilter, setComparisonProviderFilter, comparisonSortBy, setComparisonSortBy, modelTypeFilter, setModelTypeFilter, showToast } = usePricing();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);
  const data = getData();
  const list = useMemo(
    () => getComparisonList(data, comparisonProviderFilter, comparisonSortBy, modelTypeFilter),
    [data, comparisonProviderFilter, comparisonSortBy, modelTypeFilter]
  );
  const filteredList = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) => (m.name || '').toLowerCase().includes(q) || (m.provider || '').toLowerCase().includes(q));
  }, [list, searchQuery]);
  const withBlended = list.filter((m) => m.blended >= 0);
  const cheapestModel = withBlended.length ? withBlended.reduce((min, m) => (m.blended < min.blended ? m : min), withBlended[0]) : null;
  const minInput = useMemo(() => (filteredList.length ? Math.min(...filteredList.map((m) => Number(m.input) ?? Infinity)) : null), [filteredList]);
  const minOutput = useMemo(() => (filteredList.length ? Math.min(...filteredList.map((m) => (m.output === 0 ? 0 : Number(m.output) ?? Infinity))) : null), [filteredList]);
  const toggleExpand = useCallback((index) => setExpandedRow((prev) => (prev === index ? null : index)), []);

  const exportCSV = () => {
    const rows = ['Model,Provider,Pricing tier,Input per 1M,Output per 1M,Context window'];
    list.forEach((m) => {
      rows.push([m.name, m.provider, m.contextTier || '—', fmt(m.input), fmt(m.output), m.contextWindow || '—'].map(escapeCsvCell).join(','));
    });
    const csv = '\uFEFF' + rows.join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'ai-model-comparison-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Comparison exported as CSV.', 'success');
  };

  const exportPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      doc.setFontSize(14);
      doc.text('Model comparison', pageW / 2, 18, { align: 'center' });
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text('Exported: ' + new Date().toLocaleDateString(undefined, { dateStyle: 'long' }), pageW / 2, 25, { align: 'center' });
      doc.setTextColor(0, 0, 0);
      const headers = ['Model', 'Provider', 'Pricing tier', 'Input/1M', 'Output/1M', 'Context'];
      const colWidths = [42, 32, 32, 24, 24, 24];
      const rows = list.map((m) => [m.name, m.provider, m.contextTier || '—', fmt(m.input), fmt(m.output), m.contextWindow || '—']);
      drawPdfBorderedTable(doc, 32, headers, rows, colWidths);
      doc.save('ai-model-comparison-' + new Date().toISOString().slice(0, 10) + '.pdf');
      showToast('Comparison exported as PDF.', 'success');
    } catch (_) {
      showToast('PDF export failed.', 'error');
    }
  };

  const providers = [
    { key: 'all', label: 'All' },
    { key: 'gemini', label: 'Google' },
    { key: 'openai', label: 'OpenAI' },
    { key: 'anthropic', label: 'Anthropic' },
    { key: 'mistral', label: 'Mistral' },
  ];

  return (
    <section className="page-section" id="section-comparison">
      <h2 className="section-title">📋 Model comparison</h2>
      <p className="section-subtitle">All models in one table: Model, Provider, Input and Output per 1M tokens, Context window.</p>
      <div className="provider-filter-wrap">
        <span className="provider-filter-label">Filter by provider:</span>
        <div className="provider-filter-btns" role="group" aria-label="Filter by provider">
          {providers.map((p) => (
            <button
              key={p.key}
              type="button"
              className={'provider-filter-btn' + (comparisonProviderFilter === p.key ? ' active' : '')}
              data-provider={p.key}
              onClick={() => setComparisonProviderFilter(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="provider-filter-wrap model-type-filter-wrap">
        <span className="provider-filter-label">Model type:</span>
        <div className="provider-filter-btns" role="group" aria-label="Filter by model type">
          {[
            { key: MODEL_TYPES.CHAT, label: MODEL_TYPE_LABELS[MODEL_TYPES.CHAT] },
            { key: MODEL_TYPES.IMAGE, label: MODEL_TYPE_LABELS[MODEL_TYPES.IMAGE] },
            { key: MODEL_TYPES.AUDIO, label: MODEL_TYPE_LABELS[MODEL_TYPES.AUDIO] },
            { key: MODEL_TYPES.VIDEO, label: MODEL_TYPE_LABELS[MODEL_TYPES.VIDEO] },
            { key: 'all', label: 'All' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              className={'provider-filter-btn' + (modelTypeFilter === t.key ? ' active' : '')}
              onClick={() => setModelTypeFilter(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="comparison-search-wrap">
        <label htmlFor="comparison-search" className="comparison-search-label">Search:</label>
        <input
          id="comparison-search"
          type="search"
          className="comparison-search-input"
          placeholder="Model or provider name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search models by name or provider"
        />
        {searchQuery && (
          <span className="comparison-search-hint">{filteredList.length} of {list.length} models</span>
        )}
      </div>
      <div className="comparison-sort-wrap">
        <label htmlFor="comparison-sort-by" className="comparison-sort-label">Sort by:</label>
        <select
          id="comparison-sort-by"
          className="comparison-sort-select"
          value={comparisonSortBy}
          onChange={(e) => setComparisonSortBy(e.target.value)}
        >
          <option value="default">Default (group by provider, cheapest first)</option>
          <option value="input">Input price (low → high)</option>
          <option value="output">Output price (low → high)</option>
          <option value="context">Context (largest first)</option>
        </select>
        <div className="comparison-export-toolbar">
          <span className="export-label">Export:</span>
          <button type="button" className="export-btn csv" onClick={exportCSV} title="Download comparison as CSV">📄 CSV</button>
          <button type="button" className="export-btn pdf" onClick={exportPDF} title="Download comparison as PDF">📕 PDF</button>
        </div>
      </div>
      <div className="pricing-table-scroll">
        <table className="model-table model-comparison-table model-comparison-table-interactive" aria-label="Model comparison">
          <thead>
            <tr>
              <th>Model</th>
              <th>Provider</th>
              <th>Pricing tier</th>
              <th>Input</th>
              <th>Output</th>
              <th>Context</th>
            </tr>
          </thead>
          <tbody>
            {filteredList.map((m, i) => {
              const isCheapest = cheapestModel && m.name === cheapestModel.name && m.providerKey === cheapestModel.providerKey && (m.contextTier || '') === (cheapestModel.contextTier || '');
              const isExpanded = expandedRow === i;
              const numInput = Number(m.input);
              const numOutput = m.output === 0 ? 0 : Number(m.output);
              const isLowInput = minInput != null && numInput === minInput;
              const isLowOutput = minOutput != null && numOutput === minOutput;
              return (
                <Fragment key={i}>
                  <tr
                    className={(isCheapest ? 'cheapest ' : '') + (isExpanded ? 'expanded' : '')}
                    onClick={() => toggleExpand(i)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(i); } }}
                    aria-expanded={isExpanded}
                    aria-label={`${m.name}, ${m.provider}. Click to ${isExpanded ? 'collapse' : 'expand'} details`}
                  >
                    <td className="model-name" title={m.name}>
                      {m.name}
                      {isCheapest && <span className="cheapest-badge" aria-label="Cheapest"> 🟢 Cheapest</span>}
                    </td>
                    <td className="provider-name" title={`Provider: ${m.provider}`}>{m.provider}</td>
                    <td className="context-tier" title="Pricing tier or context tier">{m.contextTier || (m.modelType !== 'chat' ? m.modelType : '') || '—'}</td>
                    <td className={'price price-input' + (isLowInput ? ' price-low' : '')} title={m.modelType === 'chat' ? `Input: ${fmt(m.input)} per 1M tokens` : undefined}>{formatPriceDisplay(m).input}</td>
                    <td className={'price price-output' + (isLowOutput ? ' price-low' : '')} title={m.modelType === 'chat' ? `Output: ${fmt(m.output)} per 1M tokens` : undefined}>{formatPriceDisplay(m).output}</td>
                    <td className="context-window" title={`Context window: ${m.contextWindow || '—'}`}>{m.contextWindow || (m.modelType !== 'chat' ? '—' : '—')}</td>
                  </tr>
                  {isExpanded && (() => {
                    const fileBenchmarks = getBenchmarksData();
                    const bench = getBenchmarkForModelMerged(m.name, m.providerKey, Array.isArray(fileBenchmarks) ? fileBenchmarks : null);
                    return (
                      <tr className="comparison-detail-row" aria-hidden="true">
                        <td colSpan={6} className="comparison-detail-cell">
                          <div className="comparison-detail-card comparison-detail-card-benchmarks">
                            <div className="comparison-detail-header">
                              <strong>{m.name}</strong>
                              <span className="comparison-detail-provider">{m.provider}</span>
                            </div>
                            <div className="comparison-detail-benchmarks-title">Benchmark results</div>
                            <div className="comparison-detail-grid comparison-detail-benchmarks-grid">
                              <span className="comparison-detail-label">MMLU</span>
                              <span className="comparison-detail-value comparison-detail-bench-score">{bench.mmlu}</span>
                              <span className="comparison-detail-label">Code</span>
                              <span className="comparison-detail-value comparison-detail-bench-score">{bench.code}</span>
                              <span className="comparison-detail-label">Reasoning</span>
                              <span className="comparison-detail-value comparison-detail-bench-score">{bench.reasoning}</span>
                              <span className="comparison-detail-label">Arena</span>
                              <span className="comparison-detail-value comparison-detail-bench-score">{bench.arena}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })()}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
