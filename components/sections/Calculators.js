'use client';

import { useState, useMemo } from 'react';
import { usePricing } from '../../context/PricingContext';
import {
  getUnifiedCalcModels,
  getCalcModelByKey,
  calcCostForEntry,
  getContextWindow,
  getAllModels,
  calcCost,
  calcCostOpenAI,
} from '../../src/calculator.js';
import { escapeCsvCell, drawPdfBorderedTable } from '../../src/render.js';

const fmt = (v) => (v === 0 ? 'Free' : '$' + Number(v).toFixed(2));

export function Calculators() {
  const { getData, calcSub, setCalcSub, calcLastResult, setCalcLastResult, showToast } = usePricing();
  const data = getData();
  const unified = useMemo(() => getUnifiedCalcModels(data), [data]);

  const [calcModel, setCalcModel] = useState('');
  const [calcCompare, setCalcCompare] = useState('');
  const [calcInputTokens, setCalcInputTokens] = useState(100000);
  const [calcCachedTokens, setCalcCachedTokens] = useState(0);
  const [calcOutputTokens, setCalcOutputTokens] = useState(10000);
  const [pricingResult, setPricingResult] = useState(null);

  const [promptText, setPromptText] = useState('');
  const [promptOutputTokens, setPromptOutputTokens] = useState(500);
  const [promptTokenCount, setPromptTokenCount] = useState(null);
  const [promptCostResult, setPromptCostResult] = useState(null);

  const [contextPromptTokens, setContextPromptTokens] = useState(10000);
  const [contextOutputTokens, setContextOutputTokens] = useState(4000);
  const [contextResult, setContextResult] = useState(null);

  const [prodUsersPerDay, setProdUsersPerDay] = useState(1000);
  const [prodRequestsPerUser, setProdRequestsPerUser] = useState(10);
  const [prodPromptTokens, setProdPromptTokens] = useState(500);
  const [prodOutputTokens, setProdOutputTokens] = useState(200);
  const [productionResult, setProductionResult] = useState(null);

  const handlePricingCalculate = () => {
    const inputT = Number(calcInputTokens) || 0;
    const cachedT = Number(calcCachedTokens) || 0;
    const outputT = Number(calcOutputTokens) || 0;
    const primary = getCalcModelByKey(calcModel, data);
    const compare = calcCompare ? getCalcModelByKey(calcCompare, data) : null;
    let primaryCost = 0,
      compareCost = 0;
    if (primary) {
      const entry = { provider: primary.provider, model: primary.model };
      primaryCost = calcCostForEntry(entry, inputT, cachedT, outputT);
    }
    if (compare) {
      const entry = { provider: compare.provider, model: compare.model };
      compareCost = calcCostForEntry(entry, inputT, cachedT, outputT);
    }
    const result = { primary: primary ? { name: primary.name, cost: primaryCost } : null, compare: compare ? { name: compare.name, cost: compareCost } : null, inputT, cachedT, outputT };
    setPricingResult(result);
    setCalcLastResult({ type: 'pricing', data: result });
  };

  const handleContextCheck = () => {
    const promptT = Number(contextPromptTokens) || 0;
    const outputT = Number(contextOutputTokens) || 0;
    const all = getAllModels(data);
    const rows = all.map((m) => {
      const ctx = getContextWindow(m.providerKey, m.name);
      const limit = ctx ? ctx.tokens : 0;
      const total = promptT + outputT;
      const fits = limit > 0 && total <= limit;
      return { name: m.name, provider: m.provider, limit: ctx ? ctx.label : '—', total, fits };
    });
    setContextResult({ promptT, outputT, rows });
    setCalcLastResult({ type: 'context', data: { promptT, outputT, rows } });
  };

  const handleProductionSim = () => {
    const users = Number(prodUsersPerDay) || 0;
    const reqPerUser = Number(prodRequestsPerUser) || 0;
    const promptT = Number(prodPromptTokens) || 0;
    const outputT = Number(prodOutputTokens) || 0;
    const totalRequests = users * reqPerUser;
    const all = getAllModels(data);
    const rows = all.map((m) => {
      const inp = Number(m.input) || 0;
      const out = Number(m.output) || 0;
      const cached = m.cachedInput != null ? Number(m.cachedInput) : null;
      let costPerReq = 0;
      if (m.providerKey === 'openai' && cached != null) {
        costPerReq = calcCostOpenAI(promptT, 0, outputT, inp, cached, out);
      } else {
        costPerReq = calcCost(promptT, outputT, inp, out);
      }
      const dailyCost = costPerReq * totalRequests;
      const monthlyCost = dailyCost * 30;
      return { name: m.name, provider: m.provider, costPerReq, dailyCost, monthlyCost };
    });
    setProductionResult({ users, reqPerUser, totalRequests, promptT, outputT, rows });
    setCalcLastResult({ type: 'production', data: { users, reqPerUser, totalRequests, rows } });
  };

  const exportCalcCSV = () => {
    const last = calcLastResult;
    if (!last) {
      showToast('Run a calculator first, then export.', 'error');
      return;
    }
    const rows = [];
    if (last.type === 'pricing' && last.data?.primary) {
      rows.push(['Model', 'Cost']);
      rows.push([last.data.primary.name, fmt(last.data.primary.cost)]);
      if (last.data.compare) rows.push([last.data.compare.name, fmt(last.data.compare.cost)]);
    } else if (last.type === 'context' && last.data?.rows) {
      rows.push(['Model', 'Provider', 'Context limit', 'Prompt+Output', 'Fits']);
      last.data.rows.forEach((r) => rows.push([r.name, r.provider, r.limit, r.total, r.fits ? 'Yes' : 'No']));
    } else if (last.type === 'production' && last.data?.rows) {
      rows.push(['Model', 'Provider', 'Cost/request', 'Daily cost', 'Monthly cost']);
      last.data.rows.forEach((r) => rows.push([r.name, r.provider, r.costPerReq?.toFixed(4), r.dailyCost?.toFixed(2), r.monthlyCost?.toFixed(2)]));
    }
    if (rows.length === 0) {
      showToast('No result to export.', 'error');
      return;
    }
    const csv = '\uFEFF' + rows.map((r) => r.map(escapeCsvCell).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'ai-calculator-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Calculator result exported as CSV.', 'success');
  };

  const exportCalcPDF = async () => {
    const last = calcLastResult;
    if (!last) {
      showToast('Run a calculator first, then export.', 'error');
      return;
    }
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      doc.setFontSize(14);
      doc.text('Calculator result', 105, 20, { align: 'center' });
      doc.setFontSize(9);
      if (last.type === 'pricing' && last.data?.primary) {
        const rows = [[last.data.primary.name, fmt(last.data.primary.cost)]];
        if (last.data.compare) rows.push([last.data.compare.name, fmt(last.data.compare.cost)]);
        drawPdfBorderedTable(doc, 30, ['Model', 'Cost'], rows, [80, 50]);
      } else if (last.type === 'context' && last.data?.rows) {
        const rows = last.data.rows.slice(0, 20).map((r) => [r.name, r.provider, r.limit, String(r.total), r.fits ? 'Yes' : 'No']);
        drawPdfBorderedTable(doc, 30, ['Model', 'Provider', 'Limit', 'Total', 'Fits'], rows, [40, 35, 25, 25, 20]);
      } else if (last.type === 'production' && last.data?.rows) {
        const rows = last.data.rows.slice(0, 20).map((r) => [r.name, r.provider, r.costPerReq?.toFixed(4), r.dailyCost?.toFixed(2), r.monthlyCost?.toFixed(2)]);
        drawPdfBorderedTable(doc, 30, ['Model', 'Provider', 'Cost/req', 'Daily', 'Monthly'], rows, [40, 35, 30, 30, 30]);
      }
      doc.save('ai-calculator-' + new Date().toISOString().slice(0, 10) + '.pdf');
      showToast('Calculator result exported as PDF.', 'success');
    } catch (_) {
      showToast('PDF export failed.', 'error');
    }
  };

  const tabs = [
    { id: 'pricing', label: '💰 Pricing', hash: '#calc-pricing' },
    { id: 'prompt', label: '📝 Prompt cost', hash: '#calc-prompt' },
    { id: 'context', label: '📐 Context window', hash: '#calc-context' },
    { id: 'production', label: '🏭 Production cost', hash: '#calc-production' },
  ];

  return (
    <>
      <nav className="calc-sub-nav" aria-label="Calculator tools">
        {tabs.map((t) => (
          <a
            key={t.id}
            href={t.hash}
            className={'calc-sub-link' + (calcSub === t.id ? ' active' : '')}
            onClick={(e) => {
              e.preventDefault();
              setCalcSub(t.id);
              if (typeof window !== 'undefined') window.location.hash = t.hash;
            }}
          >
            {t.label}
          </a>
        ))}
      </nav>
      <div className="calculators-export-toolbar">
        <span className="export-label">Export current result:</span>
        <button type="button" className="export-btn csv" onClick={exportCalcCSV} title="Download current calculator result as CSV">📄 CSV</button>
        <button type="button" className="export-btn pdf" onClick={exportCalcPDF} title="Download current calculator result as PDF">📕 PDF</button>
      </div>

      {calcSub === 'pricing' && (
        <div id="calc-sub-pricing" className="calc-sub-panel active">
          <section className="page-section">
            <h2 className="section-title">💰 Pricing Calculator</h2>
            <p className="section-subtitle">Enter token usage to estimate API cost. Compare any two models.</p>
            <div className="calculator-single">
              <div className="calculator-card calculator-card-wide">
                <h3>All providers</h3>
                <div className="calc-row">
                  <label htmlFor="calc-model">Model</label>
                  <select id="calc-model" value={calcModel} onChange={(e) => setCalcModel(e.target.value)}>
                    <option value="">-- Select model --</option>
                    <option value="__all__">Compare all models</option>
                    {unified.map((u) => (
                      <option key={u.key} value={u.key}>{u.label}</option>
                    ))}
                  </select>
                </div>
                <div className="calc-row">
                  <label htmlFor="calc-compare">Compare with (optional)</label>
                  <select id="calc-compare" value={calcCompare} onChange={(e) => setCalcCompare(e.target.value)}>
                    <option value="">— None —</option>
                    {unified.map((u) => (
                      <option key={u.key} value={u.key}>{u.label}</option>
                    ))}
                  </select>
                </div>
                <div className="calc-row">
                  <label htmlFor="calc-input-tokens">Prompt tokens</label>
                  <input type="number" id="calc-input-tokens" min={0} value={calcInputTokens} onChange={(e) => setCalcInputTokens(Number(e.target.value) || 0)} />
                </div>
                <div className="calc-row">
                  <label htmlFor="calc-cached-tokens">Cached input tokens (OpenAI only)</label>
                  <input type="number" id="calc-cached-tokens" min={0} value={calcCachedTokens} onChange={(e) => setCalcCachedTokens(Number(e.target.value) || 0)} />
                </div>
                <div className="calc-row">
                  <label htmlFor="calc-output-tokens">Output tokens</label>
                  <input type="number" id="calc-output-tokens" min={0} value={calcOutputTokens} onChange={(e) => setCalcOutputTokens(Number(e.target.value) || 0)} />
                </div>
                <div className="calc-actions">
                  <button type="button" className="calc-btn" onClick={handlePricingCalculate}>Calculate cost</button>
                  <button type="button" className="calc-btn reset" onClick={() => { setPricingResult(null); setCalcLastResult(null); }}>Reset</button>
                </div>
                {pricingResult && (
                  <div className="calc-result">
                    <p><strong>{pricingResult.primary?.name}</strong>: {fmt(pricingResult.primary?.cost)}</p>
                    {pricingResult.compare && <p><strong>{pricingResult.compare?.name}</strong>: {fmt(pricingResult.compare?.cost)}</p>}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {calcSub === 'prompt' && (
        <div id="calc-sub-prompt" className="calc-sub-panel">
          <section className="page-section">
            <h2 className="section-title">📝 Estimate cost from prompt</h2>
            <p className="section-subtitle">Paste your prompt to get a token count and cost estimate.</p>
            <div className="prompt-estimator-card">
              <div className="calc-row">
                <label htmlFor="prompt-input">Paste your prompt</label>
                <textarea id="prompt-input" rows={5} placeholder="Paste your prompt here…" value={promptText} onChange={(e) => setPromptText(e.target.value)} />
              </div>
              <div className="calc-row">
                <label htmlFor="prompt-output-tokens">Estimated output tokens</label>
                <input type="number" id="prompt-output-tokens" min={0} value={promptOutputTokens} onChange={(e) => setPromptOutputTokens(Number(e.target.value) || 0)} />
              </div>
              <p className="prompt-token-count">Prompt tokens: {promptTokenCount != null ? promptTokenCount : '—'} (≈4 chars/token if no tokenizer)</p>
              <div className="calc-actions">
                <button type="button" className="calc-btn" onClick={() => { const n = Math.ceil((promptText || '').length / 4); setPromptTokenCount(n); setPromptCostResult('Use Pricing calculator with these token counts.'); }}>Estimate cost</button>
                <button type="button" className="calc-btn reset" onClick={() => { setPromptTokenCount(null); setPromptCostResult(null); }}>Reset</button>
              </div>
              {promptCostResult && <div className="prompt-cost-result">{promptCostResult}</div>}
            </div>
          </section>
        </div>
      )}

      {calcSub === 'context' && (
        <div id="calc-sub-context" className="calc-sub-panel">
          <section className="page-section">
            <h2 className="section-title">📐 Context window calculator</h2>
            <p className="section-subtitle">Check if your prompt + output fits within each model&apos;s context limit.</p>
            <div className="context-window-card">
              <div className="calc-row">
                <label htmlFor="context-prompt-tokens">Prompt tokens</label>
                <input type="number" id="context-prompt-tokens" min={0} value={contextPromptTokens} onChange={(e) => setContextPromptTokens(Number(e.target.value) || 0)} />
              </div>
              <div className="calc-row">
                <label htmlFor="context-output-tokens">Output tokens</label>
                <input type="number" id="context-output-tokens" min={0} value={contextOutputTokens} onChange={(e) => setContextOutputTokens(Number(e.target.value) || 0)} />
              </div>
              <div className="calc-actions">
                <button type="button" className="calc-btn" onClick={handleContextCheck}>Check context</button>
                <button type="button" className="calc-btn reset" onClick={() => { setContextResult(null); setCalcLastResult(null); }}>Reset</button>
              </div>
              {contextResult && (
                <div className="context-window-result">
                  <table className="model-table">
                    <thead>
                      <tr><th>Model</th><th>Provider</th><th>Context limit</th><th>Prompt+Output</th><th>Fits</th></tr>
                    </thead>
                    <tbody>
                      {contextResult.rows.map((r, i) => (
                        <tr key={i}>
                          <td className="model-name">{r.name}</td>
                          <td>{r.provider}</td>
                          <td>{r.limit}</td>
                          <td>{r.total}</td>
                          <td>{r.fits ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {calcSub === 'production' && (
        <div id="calc-sub-production" className="calc-sub-panel">
          <section className="page-section">
            <h2 className="section-title">🏭 Production cost simulator</h2>
            <p className="section-subtitle">Estimate real-world application costs.</p>
            <p className="simulator-note">Cost estimates assume flat token pricing. Tiered discounts and prompt caching are not included.</p>
            <div className="production-cost-card">
              <div className="calc-row">
                <label htmlFor="prod-users-per-day">Users per day</label>
                <input type="number" id="prod-users-per-day" min={0} value={prodUsersPerDay} onChange={(e) => setProdUsersPerDay(Number(e.target.value) || 0)} />
              </div>
              <div className="calc-row">
                <label htmlFor="prod-requests-per-user">Requests per user</label>
                <input type="number" id="prod-requests-per-user" min={0} value={prodRequestsPerUser} onChange={(e) => setProdRequestsPerUser(Number(e.target.value) || 0)} />
              </div>
              <div className="calc-row">
                <label htmlFor="prod-prompt-tokens">Prompt tokens (per request)</label>
                <input type="number" id="prod-prompt-tokens" min={0} value={prodPromptTokens} onChange={(e) => setProdPromptTokens(Number(e.target.value) || 0)} />
              </div>
              <div className="calc-row">
                <label htmlFor="prod-output-tokens">Output tokens (per request)</label>
                <input type="number" id="prod-output-tokens" min={0} value={prodOutputTokens} onChange={(e) => setProdOutputTokens(Number(e.target.value) || 0)} />
              </div>
              <div className="calc-actions">
                <button type="button" className="calc-btn" onClick={handleProductionSim}>Simulate</button>
                <button type="button" className="calc-btn reset" onClick={() => { setProductionResult(null); setCalcLastResult(null); }}>Reset</button>
              </div>
              {productionResult && (
                <div className="production-cost-result">
                  <p>Total requests/day: {productionResult.totalRequests}</p>
                  <table className="model-table">
                    <thead>
                      <tr><th>Model</th><th>Provider</th><th>Cost/request</th><th>Daily cost</th><th>Monthly cost</th></tr>
                    </thead>
                    <tbody>
                      {productionResult.rows.map((r, i) => (
                        <tr key={i}>
                          <td className="model-name">{r.name}</td>
                          <td>{r.provider}</td>
                          <td>${r.costPerReq?.toFixed(4)}</td>
                          <td>${r.dailyCost?.toFixed(2)}</td>
                          <td>${r.monthlyCost?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
