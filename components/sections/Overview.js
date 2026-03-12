'use client';

import { useState, useMemo } from 'react';
import { usePricing } from '../../context/PricingContext';
import { getAllModels } from '../../src/calculator.js';
import { escapeCsvCell, drawPdfBorderedTable } from '../../src/render.js';

const fmt = (v) => (v === 0 ? 'Free' : '$' + Number(v).toFixed(2));

function useExportPricing() {
  const { getData } = usePricing();
  const exportCSV = () => {
    const data = getData();
    const rows = ['Provider,Model,Context / tier,Input per 1M,Output per 1M,Cached per 1M'];
    const push = (provider, m, ctx, inp, out, cached) =>
      rows.push([provider, m.name, ctx, inp, out, cached != null ? cached : ''].map(escapeCsvCell).join(','));
    (data.gemini || []).forEach((m) => {
      if (m.tiers?.length) m.tiers.forEach((t) => push('Google Gemini', m, t.contextLabel, t.input, t.output, null));
      else push('Google Gemini', m, '—', m.input, m.output, null);
    });
    (data.openai || []).forEach((m) => {
      if (m.tiers?.length) m.tiers.forEach((t) => push('OpenAI', m, t.contextLabel, t.input, t.output, t.cachedInput));
      else push('OpenAI', m, '—', m.input, m.output, m.cachedInput);
    });
    (data.anthropic || []).forEach((m) => {
      if (m.tiers?.length) m.tiers.forEach((t) => push('Anthropic', m, t.contextLabel, t.input, t.output, null));
      else push('Anthropic', m, '—', m.input, m.output, null);
    });
    (data.mistral || []).forEach((m) => {
      if (m.tiers?.length) m.tiers.forEach((t) => push('Mistral', m, t.contextLabel, t.input, t.output, null));
      else push('Mistral', m, '—', m.input, m.output, null);
    });
    const csv = '\uFEFF' + rows.join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'ai-pricing-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const exportPDF = async () => {
    let JsPDF;
    try {
      const mod = await import('jspdf');
      JsPDF = mod.jsPDF || mod.default;
    } catch (_) {
      return;
    }
    if (!JsPDF) return;
    const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const data = getData();
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFontSize(14);
    doc.text('AI Model Pricing', pageW / 2, 18, { align: 'center' });
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text('Pricing as of: ' + new Date().toLocaleDateString(undefined, { dateStyle: 'long' }), pageW / 2, 25, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    const headers = ['Provider', 'Model', 'Context/tier', 'Input/1M', 'Output/1M', 'Cached/1M'];
    const colWidths = [28, 48, 28, 22, 22, 22];
    const rows = [];
    const add = (provider, m, ctx, inp, out, cached) => rows.push([provider, m.name, ctx, fmt(inp), fmt(out), cached != null ? fmt(cached) : '—']);
    (data.gemini || []).forEach((m) => {
      if (m.tiers?.length) m.tiers.forEach((t) => add('Google Gemini', m, t.contextLabel, t.input, t.output, null));
      else add('Google Gemini', m, '—', m.input, m.output, null);
    });
    (data.openai || []).forEach((m) => {
      if (m.tiers?.length) m.tiers.forEach((t) => add('OpenAI', m, t.contextLabel, t.input, t.output, t.cachedInput));
      else add('OpenAI', m, '—', m.input, m.output, m.cachedInput);
    });
    (data.anthropic || []).forEach((m) => {
      if (m.tiers?.length) m.tiers.forEach((t) => add('Anthropic', m, t.contextLabel, t.input, t.output, null));
      else add('Anthropic', m, '—', m.input, m.output, null);
    });
    (data.mistral || []).forEach((m) => {
      if (m.tiers?.length) m.tiers.forEach((t) => add('Mistral', m, t.contextLabel, t.input, t.output, null));
      else add('Mistral', m, '—', m.input, m.output, null);
    });
    drawPdfBorderedTable(doc, 32, headers, rows, colWidths);
    doc.save('ai-pricing-' + new Date().toISOString().slice(0, 10) + '.pdf');
  };
  return { exportCSV, exportPDF };
}

function ProviderTable({ providerKey, title, logoClass, note, models, searchPlaceholder, hasCached, searchQuery, onSearch }) {
  const filtered = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return models;
    return models.filter((m) => (m.name || '').toLowerCase().indexOf(q) !== -1);
  }, [models, searchQuery]);

  const rows = [];
  (filtered || []).forEach((m) => {
    const nameCell = m.name + (m.badge ? ` ${m.badge}` : '');
    if (m.tiers && m.tiers.length > 0) {
      m.tiers.forEach((t) => {
        rows.push({
          name: nameCell,
          contextLabel: t.contextLabel,
          inp: t.input,
          out: t.output,
          cached: hasCached ? (t.cachedInput != null ? t.cachedInput : null) : undefined,
        });
      });
    } else {
      rows.push({
        name: nameCell,
        contextLabel: '—',
        inp: m.input,
        out: m.output,
        cached: hasCached ? m.cachedInput : undefined,
      });
    }
  });

  const isEmbed = providerKey === 'openai' && rows.some((r) => r.name && /^text-embedding/i.test(String(r.name)));

  return (
    <div className={'provider-card'} id={providerKey + '-card'}>
      <div className="provider-header">
        <div className={'provider-logo-badge ' + logoClass} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L13.5 9.5L21 11L13.5 12.5L12 20L10.5 12.5L3 11L10.5 9.5L12 2Z" />
          </svg>
        </div>
        <h2 className="provider-name">{title}</h2>
      </div>
      <p className="provider-pricing-note" dangerouslySetInnerHTML={{ __html: note }} />
      <div className="pricing-table-wrap">
        <input
          type="text"
          className="pricing-search"
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
        />
        <div className="pricing-table-scroll">
          <table className="model-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Context / tier</th>
                <th>Input / 1M</th>
                {hasCached && <th>Cached / 1M</th>}
                <th>Output / 1M</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="model-name">{r.name}</td>
                  <td className="context-tier">{r.contextLabel}</td>
                  <td className="price price-input">{fmt(r.inp)}</td>
                  {hasCached && <td className="price price-cached">{r.cached != null ? fmt(r.cached) : '—'}</td>}
                  <td className="price price-output">{isEmbed && /^text-embedding/i.test(String(r.name)) ? '—' : fmt(r.out)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function Overview() {
  const { getData } = usePricing();
  const { exportCSV, exportPDF } = useExportPricing();
  const [geminiSearch, setGeminiSearch] = useState('');
  const [openaiSearch, setOpenaiSearch] = useState('');
  const [anthropicSearch, setAnthropicSearch] = useState('');
  const [mistralSearch, setMistralSearch] = useState('');

  const data = getData();
  const all = useMemo(() => getAllModels(data), [data]);
  const kpis = useMemo(() => {
    const byBlended = [...all].filter((m) => m.blended >= 0).sort((a, b) => a.blended - b.blended);
    const cheapest = byBlended[0];
    const costliest = byBlended.length ? byBlended[byBlended.length - 1] : null;
    const byContext = [...all].filter((m) => m.contextTokens > 0).sort((a, b) => b.contextTokens - a.contextTokens);
    const largestCtx = byContext[0];
    return {
      count: all.length,
      cheapest: cheapest?.name ?? '—',
      cheapestPrice: cheapest ? (cheapest.blended === 0 ? 'Free' : `$${Number(cheapest.blended).toFixed(2)} / 1M blended`) : '—',
      costliest: costliest?.name ?? '—',
      costliestPrice: costliest ? `$${Number(costliest.blended).toFixed(2)} / 1M blended` : '—',
      largestContext: largestCtx?.name ?? '—',
      largestContextSize: largestCtx ? (largestCtx.contextWindow || String(largestCtx.contextTokens)) : '—',
    };
  }, [all]);

  return (
    <>
      <div className="kpi-container" aria-label="Pricing summary">
        <div className="kpi-card">
          <h3 className="kpi-title">Total Models</h3>
          <p className="kpi-value">{kpis.count}</p>
        </div>
        <div className="kpi-card">
          <h3 className="kpi-title">Cheapest</h3>
          <p className="kpi-value">{kpis.cheapest}</p>
          <p className="kpi-meta">{kpis.cheapestPrice}</p>
        </div>
        <div className="kpi-card">
          <h3 className="kpi-title">Costliest</h3>
          <p className="kpi-value">{kpis.costliest}</p>
          <p className="kpi-meta">{kpis.costliestPrice}</p>
        </div>
        <div className="kpi-card">
          <h3 className="kpi-title">Largest context</h3>
          <p className="kpi-value">{kpis.largestContext}</p>
          <p className="kpi-meta">{kpis.largestContextSize}</p>
        </div>
      </div>
      <section className="page-section" id="section-pricing">
        <h2 className="section-title">📊 Current pricing</h2>
        <p className="section-subtitle">
          API pricing per 1M tokens from <a href="https://vizra.ai/api/v1/pricing/ai-models" target="_blank" rel="noopener" className="source-link">Vizra</a> (Gemini, OpenAI, Anthropic, Mistral). Use Export to download CSV or PDF.
        </p>
        <div className="pricing-section-header">
          <span className="section-label">Gemini · OpenAI · Anthropic · Mistral</span>
          <div className="export-toolbar">
            <span className="export-label">Export:</span>
            <button type="button" className="export-btn csv" onClick={exportCSV} title="Download pricing as CSV">📄 CSV</button>
            <button type="button" className="export-btn pdf" onClick={exportPDF} title="Download pricing as PDF">📕 PDF</button>
          </div>
        </div>
        <div className="pricing-grid">
          <ProviderTable
            providerKey="gemini"
            title="Google Gemini"
            logoClass="provider-logo-gemini"
            note='Where available, <strong>all context tiers</strong> are shown (e.g. ≤200K vs &gt;200K). <a href="https://ai.google.dev/gemini-api/docs/pricing" target="_blank" rel="noopener">Official pricing</a>. Retired/deprecated models are excluded.'
            models={data.gemini || []}
            searchPlaceholder="Search Gemini models…"
            hasCached={false}
            searchQuery={geminiSearch}
            onSearch={setGeminiSearch}
          />
          <ProviderTable
            providerKey="openai"
            title="OpenAI"
            logoClass="provider-logo-openai-custom"
            note='Where available, <strong>all tiers</strong> are shown (e.g. standard vs extended context). <a href="https://platform.openai.com/docs/pricing" target="_blank" rel="noopener">Official pricing</a>. Retired/deprecated models are excluded.'
            models={data.openai || []}
            searchPlaceholder="Search OpenAI models…"
            hasCached
            searchQuery={openaiSearch}
            onSearch={setOpenaiSearch}
          />
          <ProviderTable
            providerKey="anthropic"
            title="Anthropic"
            logoClass="provider-logo-anthropic"
            note='Where available, <strong>all tiers</strong> are shown (e.g. ≤200K vs extended context). <a href="https://docs.anthropic.com/en/docs/about-claude/pricing" target="_blank" rel="noopener">Official pricing</a>. Retired/deprecated models are excluded.'
            models={data.anthropic || []}
            searchPlaceholder="Search Anthropic models…"
            hasCached={false}
            searchQuery={anthropicSearch}
            onSearch={setAnthropicSearch}
          />
          <ProviderTable
            providerKey="mistral"
            title="Mistral"
            logoClass="provider-logo-mistral"
            note='Some legacy models are deprecated in favor of newer versions (e.g. Mistral Large → Large 24.11). <a href="https://mistral.ai/pricing" target="_blank" rel="noopener">Official pricing</a>. Retired/deprecated models are excluded.'
            models={data.mistral || []}
            searchPlaceholder="Search Mistral models…"
            hasCached={false}
            searchQuery={mistralSearch}
            onSearch={setMistralSearch}
          />
        </div>
      </section>
    </>
  );
}
