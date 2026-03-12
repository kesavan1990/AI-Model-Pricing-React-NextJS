'use client';

import { useMemo } from 'react';
import { usePricing } from '../../context/PricingContext';
import { getAllModels } from '../../src/calculator.js';
import { escapeCsvCell, drawPdfBorderedTable } from '../../src/render.js';

const PROVIDER_ORDER = ['gemini', 'openai', 'anthropic', 'mistral'];
const fmt = (v) => (v === 0 ? 'Free' : '$' + Number(v).toFixed(2));

function getComparisonList(data, providerFilter, sortBy) {
  let list = getAllModels(data);
  if (providerFilter && providerFilter !== 'all') list = list.filter((m) => m.providerKey === providerFilter);
  const providerIndex = (m) => PROVIDER_ORDER.indexOf(m.providerKey);
  if (sortBy === 'input') list = [...list].sort((a, b) => (a.input ?? 0) - (b.input ?? 0));
  else if (sortBy === 'output') list = [...list].sort((a, b) => (a.output ?? 0) - (b.output ?? 0));
  else if (sortBy === 'context') list = [...list].sort((a, b) => (b.contextTokens ?? 0) - (a.contextTokens ?? 0));
  else list = [...list].sort((a, b) => { const ga = providerIndex(a); const gb = providerIndex(b); if (ga !== gb) return ga - gb; return (a.blended ?? 0) - (b.blended ?? 0); });
  return list;
}

export function Models() {
  const { getData, comparisonProviderFilter, setComparisonProviderFilter, comparisonSortBy, setComparisonSortBy, showToast } = usePricing();
  const data = getData();
  const list = useMemo(
    () => getComparisonList(data, comparisonProviderFilter, comparisonSortBy),
    [data, comparisonProviderFilter, comparisonSortBy]
  );
  const withBlended = list.filter((m) => m.blended >= 0);
  const cheapestModel = withBlended.length ? withBlended.reduce((min, m) => (m.blended < min.blended ? m : min), withBlended[0]) : null;

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
        <table className="model-table model-comparison-table" aria-label="Model comparison">
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
            {list.map((m, i) => {
              const isCheapest = cheapestModel && m.name === cheapestModel.name && m.providerKey === cheapestModel.providerKey && (m.contextTier || '') === (cheapestModel.contextTier || '');
              return (
                <tr key={i} className={isCheapest ? 'cheapest' : ''}>
                  <td className="model-name">
                    {m.name}
                    {isCheapest && <span className="cheapest-badge" aria-label="Cheapest"> 🟢 Cheapest</span>}
                  </td>
                  <td className="provider-name">{m.provider}</td>
                  <td className="context-tier">{m.contextTier || '—'}</td>
                  <td className="price price-input">{fmt(m.input)}</td>
                  <td className="price price-output">{fmt(m.output)}</td>
                  <td className="context-window">{m.contextWindow || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
