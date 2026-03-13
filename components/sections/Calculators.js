'use client';

import { useState, useMemo, useRef } from 'react';
import { usePricing } from '../../context/PricingContext';
import {
  getUnifiedCalcModels,
  getUnifiedCalcModelsChat,
  getCalcModelByKey,
  calcCostForEntry,
  getContextWindow,
  getChatModels,
  calcCost,
  calcCostOpenAI,
  estimatePromptTokens,
  estimatePromptTokensWithOpenAIChatFormat,
  PROVIDER_DISPLAY_ORDER,
} from '../../src/calculator.js';
import { escapeCsvCell, drawPdfBorderedTable } from '../../src/render.js';

const fmt = (v) => (v === 0 ? '$0.00000' : '$' + Number(v).toFixed(5));

export function Calculators() {
  const { getData, calcSub, setCalcSub, calcLastResult, setCalcLastResult, showToast } = usePricing();
  const data = getData();
  const unified = useMemo(() => getUnifiedCalcModels(data), [data]);
  const chatUnified = useMemo(() => getUnifiedCalcModelsChat(data), [data]);

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
  const [promptImportStatus, setPromptImportStatus] = useState('');
  const promptFileInputRef = useRef(null);

  const displayPromptTokens = promptText ? estimatePromptTokens(promptText) : promptTokenCount;

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

    if (calcModel === '__all__') {
      const list = getUnifiedCalcModelsChat(data).map((u) => {
        const cost = calcCostForEntry({ provider: u.provider, model: u.model }, inputT, cachedT, outputT);
        return { name: u.label, provider: u.provider, cost };
      });
      list.sort((a, b) => {
        const pa = PROVIDER_DISPLAY_ORDER[a.provider] ?? 99;
        const pb = PROVIDER_DISPLAY_ORDER[b.provider] ?? 99;
        if (pa !== pb) return pa - pb;
        return a.cost - b.cost;
      });
      const result = { all: true, rows: list, inputT, cachedT, outputT };
      setPricingResult(result);
      setCalcLastResult({ type: 'pricing', data: result });
      return;
    }

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

  const handlePromptCostEstimate = () => {
    const contentPromptT = estimatePromptTokens(promptText || '') || 0;
    const openAIChatPromptT = estimatePromptTokensWithOpenAIChatFormat(promptText || '') || 0;
    const outputT = Number(promptOutputTokens) || 0;
    setPromptTokenCount(contentPromptT);
    const list = getUnifiedCalcModelsChat(data).map((u) => {
      const promptT = u.provider === 'openai' ? openAIChatPromptT : contentPromptT;
      const cost = calcCostForEntry({ provider: u.provider, model: u.model }, promptT, 0, outputT);
      return { name: u.label, provider: u.provider, cost };
    });
    list.sort((a, b) => {
      const pa = PROVIDER_DISPLAY_ORDER[a.provider] ?? 99;
      const pb = PROVIDER_DISPLAY_ORDER[b.provider] ?? 99;
      if (pa !== pb) return pa - pb;
      return a.cost - b.cost;
    });
    const result = { promptT: contentPromptT, outputT, rows: list };
    setPromptCostResult(result);
    setCalcLastResult({ type: 'prompt', data: result });
  };

  const extractTextFromFile = async (file) => {
    const name = file.name || '';
    const ext = name.split('.').pop().toLowerCase();
    const isPdf = ext === 'pdf' || file.type === 'application/pdf';
    if (isPdf) {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.5.207/build/pdf.worker.min.mjs';
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map((item) => item.str).join(' ') + '\n';
      }
      return fullText.trim();
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result || '');
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsText(file, 'UTF-8');
    });
  };

  const handlePromptFileSelect = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    const name = file.name || '';
    setPromptImportStatus('Importing ' + name + '…');
    try {
      const text = await extractTextFromFile(file);
      setPromptText(text);
      setPromptTokenCount(text ? estimatePromptTokens(text) : 0);
      setPromptImportStatus('');
      showToast('File imported. Token count updated.', 'success');
    } catch (err) {
      setPromptImportStatus('');
      showToast('Import failed: ' + (err?.message || 'Could not read file'), 'error');
    }
    e.target.value = '';
  };

  const handleContextCheck = () => {
    const promptT = Number(contextPromptTokens) || 0;
    const outputT = Number(contextOutputTokens) || 0;
    const all = getChatModels(data);
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
    const all = getChatModels(data);
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
      const perAnnum = monthlyCost * 12;
      return { name: m.name, provider: m.provider, costPerReq, dailyCost, monthlyCost, perAnnum };
    });
    setProductionResult({ users, reqPerUser, totalRequests, promptT, outputT, rows });
    setCalcLastResult({ type: 'production', data: { users, reqPerUser, totalRequests, rows } });
  };

  const exportCalcCSV = () => {
    const last = calcLastResult;
    const expectedType = calcSub === 'pricing' ? 'pricing' : calcSub === 'prompt' ? 'prompt' : calcSub === 'context' ? 'context' : calcSub === 'production' ? 'production' : null;
    if (!last || (expectedType && last.type !== expectedType)) {
      const tabName = calcSub === 'pricing' ? 'Pricing' : calcSub === 'prompt' ? 'Prompt cost' : calcSub === 'context' ? 'Context window' : calcSub === 'production' ? 'Production cost' : 'calculator';
      showToast(`Run the ${tabName} calculator first, then export.`, 'error');
      return;
    }
    const rows = [];
    if (last.type === 'pricing' && last.data?.all && last.data?.rows) {
      rows.push(['Model', 'Cost']);
      last.data.rows.forEach((r) => rows.push([r.name, fmt(r.cost)]));
    } else if (last.type === 'pricing' && last.data?.primary) {
      rows.push(['Model', 'Cost']);
      rows.push([last.data.primary.name, fmt(last.data.primary.cost)]);
      if (last.data.compare) rows.push([last.data.compare.name, fmt(last.data.compare.cost)]);
    } else if (last.type === 'prompt' && last.data?.rows) {
      rows.push(['Model', 'Cost']);
      last.data.rows.forEach((r) => rows.push([r.name, fmt(r.cost)]));
    } else if (last.type === 'context' && last.data?.rows) {
      rows.push(['Model', 'Provider', 'Context limit', 'Prompt+Output', 'Fits']);
      last.data.rows.forEach((r) => rows.push([r.name, r.provider, r.limit, r.total, r.fits ? 'Yes' : 'No']));
    } else if (last.type === 'production' && last.data?.rows) {
      rows.push(['Model', 'Provider', 'Cost/request', 'Daily cost', 'Monthly cost', 'Per annum']);
      last.data.rows.forEach((r) => rows.push([r.name, r.provider, r.costPerReq?.toFixed(4), r.dailyCost?.toFixed(2), r.monthlyCost?.toFixed(2), r.perAnnum?.toFixed(2)]));
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
    const expectedType = calcSub === 'pricing' ? 'pricing' : calcSub === 'prompt' ? 'prompt' : calcSub === 'context' ? 'context' : calcSub === 'production' ? 'production' : null;
    if (!last || (expectedType && last.type !== expectedType)) {
      const tabName = calcSub === 'pricing' ? 'Pricing' : calcSub === 'prompt' ? 'Prompt cost' : calcSub === 'context' ? 'Context window' : calcSub === 'production' ? 'Production cost' : 'calculator';
      showToast(`Run the ${tabName} calculator first, then export.`, 'error');
      return;
    }
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      doc.setFontSize(14);
      doc.text('Calculator result', 105, 20, { align: 'center' });
      doc.setFontSize(9);
      if (last.type === 'pricing' && last.data?.all && last.data?.rows) {
        const rows = last.data.rows.slice(0, 30).map((r) => [r.name, fmt(r.cost)]);
        drawPdfBorderedTable(doc, 30, ['Model', 'Cost'], rows, [80, 50]);
      } else if (last.type === 'pricing' && last.data?.primary) {
        const rows = [[last.data.primary.name, fmt(last.data.primary.cost)]];
        if (last.data.compare) rows.push([last.data.compare.name, fmt(last.data.compare.cost)]);
        drawPdfBorderedTable(doc, 30, ['Model', 'Cost'], rows, [80, 50]);
      } else if (last.type === 'prompt' && last.data?.rows) {
        const rows = last.data.rows.slice(0, 30).map((r) => [r.name, fmt(r.cost)]);
        drawPdfBorderedTable(doc, 30, ['Model', 'Cost'], rows, [80, 50]);
      } else if (last.type === 'context' && last.data?.rows) {
        const rows = last.data.rows.slice(0, 20).map((r) => [r.name, r.provider, r.limit, String(r.total), r.fits ? 'Yes' : 'No']);
        drawPdfBorderedTable(doc, 30, ['Model', 'Provider', 'Limit', 'Total', 'Fits'], rows, [40, 35, 25, 25, 20]);
      } else if (last.type === 'production' && last.data?.rows) {
        const rows = last.data.rows.slice(0, 20).map((r) => [r.name, r.provider, r.costPerReq?.toFixed(4), r.dailyCost?.toFixed(2), r.monthlyCost?.toFixed(2), r.perAnnum?.toFixed(2)]);
        drawPdfBorderedTable(doc, 30, ['Model', 'Provider', 'Cost/req', 'Daily', 'Monthly', 'Per annum'], rows, [35, 30, 28, 28, 28, 28]);
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
    <div id="section-calculator">
      <div className="calculators-top-row">
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
                  <label htmlFor="calc-model">
                    Model
                    <span className="calc-tooltip-icon" title="Select a single model to estimate cost, or choose 'Compare all models' to see costs for every model." aria-label="Help">ⓘ</span>
                  </label>
                  <select id="calc-model" value={calcModel} onChange={(e) => setCalcModel(e.target.value)}>
                    <option value="">-- Select model --</option>
                    <option value="__all__">Compare all models</option>
                    {chatUnified.map((u) => (
                      <option key={u.key} value={u.key}>{u.label}</option>
                    ))}
                  </select>
                </div>
                <div className="calc-row">
                  <label htmlFor="calc-compare">
                    Compare with (optional)
                    <span className="calc-tooltip-icon" title="Optionally select a second model to compare estimated cost side by side." aria-label="Help">ⓘ</span>
                  </label>
                  <select id="calc-compare" value={calcCompare} onChange={(e) => setCalcCompare(e.target.value)}>
                    <option value="">— None —</option>
                    {chatUnified.map((u) => (
                      <option key={u.key} value={u.key}>{u.label}</option>
                    ))}
                  </select>
                </div>
                <div className="calc-row">
                  <label htmlFor="calc-input-tokens">
                    Prompt tokens
                    <span className="calc-tooltip-icon" title="Number of input tokens (e.g. your prompt or context). Pricing is per token for the model's input tier." aria-label="Help">ⓘ</span>
                  </label>
                  <input type="number" id="calc-input-tokens" min={0} value={calcInputTokens} onChange={(e) => setCalcInputTokens(Number(e.target.value) || 0)} />
                </div>
                <div className="calc-row">
                  <label htmlFor="calc-cached-tokens">
                    Cached input tokens (OpenAI only)
                    <span className="calc-tooltip-icon" title="For OpenAI models: tokens that are cached (prompt caching). Cached tokens are billed at a lower rate than regular input tokens." aria-label="Help">ⓘ</span>
                  </label>
                  <input type="number" id="calc-cached-tokens" min={0} value={calcCachedTokens} onChange={(e) => setCalcCachedTokens(Number(e.target.value) || 0)} />
                </div>
                <div className="calc-row">
                  <label htmlFor="calc-output-tokens">
                    Output tokens
                    <span className="calc-tooltip-icon" title="Number of tokens the model generates (completion). Pricing uses the model's output tier." aria-label="Help">ⓘ</span>
                  </label>
                  <input type="number" id="calc-output-tokens" min={0} value={calcOutputTokens} onChange={(e) => setCalcOutputTokens(Number(e.target.value) || 0)} />
                </div>
                <div className="calc-actions">
                  <button type="button" className="calc-btn" onClick={handlePricingCalculate}>Calculate cost</button>
                  <button type="button" className="calc-btn reset" onClick={() => { setPricingResult(null); setCalcLastResult(null); }}>Reset</button>
                </div>
                {pricingResult && (
                  <div className={'calc-result' + (pricingResult.all ? ' wrap-scroll' : '')}>
                    {pricingResult.all && pricingResult.rows ? (
                      <table className="calc-result-table" aria-label="Cost per model">
                        <thead>
                          <tr>
                            <th>Model</th>
                            <th>Est. cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pricingResult.rows.map((r, i) => (
                            <tr key={i}>
                              <td>{r.name}</td>
                              <td className="cost">{fmt(r.cost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <>
                        <p><strong>{pricingResult.primary?.name}</strong>: {fmt(pricingResult.primary?.cost)}</p>
                        {pricingResult.compare && <p><strong>{pricingResult.compare?.name}</strong>: {fmt(pricingResult.compare?.cost)}</p>}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {calcSub === 'prompt' && (
        <div id="calc-sub-prompt" className="calc-sub-panel active">
          <section className="page-section">
            <h2 className="section-title">📝 Estimate cost from prompt</h2>
            <p className="section-subtitle">Paste your prompt to get a token count and cost across Gemini, OpenAI, Anthropic, and Mistral. Shown count is content-only (cl100k_base). OpenAI costs use chat-format count automatically; others use content count.</p>
            <div className="prompt-estimator-card">
              <div className="calc-row">
                <label htmlFor="prompt-input">
                  Paste your prompt or import a file
                  <span className="calc-tooltip-icon" title="Paste text here or use Import file to load from TXT, CSV, PDF, MD, or JSON. Token count is content-only (cl100k_base). OpenAI row uses chat-format count for cost; others use content count." aria-label="Help">ⓘ</span>
                </label>
                <textarea id="prompt-input" rows={5} placeholder="Paste your prompt here…" value={promptText} onChange={(e) => setPromptText(e.target.value)} />
              </div>
              <div className="prompt-import-row">
                <input
                  ref={promptFileInputRef}
                  type="file"
                  accept=".txt,.csv,.pdf,.md,.json,.log,.xml,text/plain,text/csv,application/pdf,text/markdown,application/json"
                  aria-label="Import file"
                  className="sr-only"
                  onChange={handlePromptFileSelect}
                />
                <button type="button" className="prompt-import-btn" onClick={() => promptFileInputRef.current?.click()}>
                  📁 Import file
                </button>
                <span className="prompt-import-hint">{promptImportStatus || 'TXT, CSV, PDF, MD, JSON'}</span>
                {promptImportStatus ? <span className="prompt-import-loading">Loading…</span> : null}
              </div>
              <div className="prompt-meta-row">
                <div className="calc-row">
                  <label htmlFor="prompt-output-tokens">
                    Estimated output tokens
                    <span className="calc-tooltip-icon" title="Expected number of tokens the model will generate (completion). Used with prompt tokens to estimate total cost per model." aria-label="Help">ⓘ</span>
                  </label>
                  <input type="number" id="prompt-output-tokens" min={0} value={promptOutputTokens} onChange={(e) => setPromptOutputTokens(Number(e.target.value) || 0)} />
                </div>
                <p className="prompt-token-count">
                  Prompt tokens: {displayPromptTokens != null ? displayPromptTokens : '—'}
                  <span className="calc-tooltip-icon" title="Content-only token count (cl100k_base). Used for Gemini, Anthropic, Mistral. OpenAI costs use chat-format count automatically for accuracy." aria-label="Help">ⓘ</span>
                </p>
              </div>
              <div className="calc-actions">
                <button type="button" className="calc-btn" onClick={handlePromptCostEstimate}>Estimate cost</button>
                <button type="button" className="calc-btn reset" onClick={() => { setPromptText(''); setPromptTokenCount(null); setPromptCostResult(null); setCalcLastResult(null); }}>Reset</button>
              </div>
              {promptCostResult && (
                <div className="prompt-cost-result wrap-scroll">
                  {promptCostResult.rows ? (
                    <>
                      <p className="prompt-cost-summary">Prompt tokens: {promptCostResult.promptT} · Output tokens: {promptCostResult.outputT}</p>
                      <table className="calc-result-table" aria-label="Cost per model">
                        <thead>
                          <tr>
                            <th>Model</th>
                            <th>Est. cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {promptCostResult.rows.map((r, i) => (
                            <tr key={i}>
                              <td>{r.name}</td>
                              <td className="cost">{fmt(r.cost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {calcSub === 'context' && (
        <div id="calc-sub-context" className="calc-sub-panel active">
          <section className="page-section">
            <h2 className="section-title">📐 Context window calculator</h2>
            <p className="section-subtitle">Check if your prompt + output fits within each model&apos;s context limit.</p>
            <div className="context-window-card">
              <div className="calc-row">
                <label htmlFor="context-prompt-tokens">
                  Prompt tokens
                  <span className="calc-tooltip-icon" title="Total input tokens (e.g. your prompt and context). Combined with output tokens to check if they fit the model's context limit." aria-label="Help">ⓘ</span>
                </label>
                <input type="number" id="context-prompt-tokens" min={0} value={contextPromptTokens} onChange={(e) => setContextPromptTokens(Number(e.target.value) || 0)} />
              </div>
              <div className="calc-row">
                <label htmlFor="context-output-tokens">
                  Output tokens
                  <span className="calc-tooltip-icon" title="Expected completion length in tokens. Prompt + output must not exceed each model's context window size." aria-label="Help">ⓘ</span>
                </label>
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
        <div id="calc-sub-production" className="calc-sub-panel active">
          <section className="page-section">
            <h2 className="section-title">🏭 Production cost simulator</h2>
            <p className="section-subtitle">Estimate real-world application costs.</p>
            <p className="simulator-note">Cost estimates assume flat token pricing. Tiered discounts and prompt caching are not included.</p>
            <div className="production-cost-card">
              <div className="calc-row">
                <label htmlFor="prod-users-per-day">
                  Users per day
                  <span className="calc-tooltip-icon" title="Estimated number of unique users (or sessions) that will use your app per day. Used to compute total daily requests." aria-label="Help">ⓘ</span>
                </label>
                <input type="number" id="prod-users-per-day" min={0} value={prodUsersPerDay} onChange={(e) => setProdUsersPerDay(Number(e.target.value) || 0)} />
              </div>
              <div className="calc-row">
                <label htmlFor="prod-requests-per-user">
                  Requests per user
                  <span className="calc-tooltip-icon" title="Average number of API calls (requests) each user makes per day. Total requests/day = users × requests per user." aria-label="Help">ⓘ</span>
                </label>
                <input type="number" id="prod-requests-per-user" min={0} value={prodRequestsPerUser} onChange={(e) => setProdRequestsPerUser(Number(e.target.value) || 0)} />
              </div>
              <div className="calc-row">
                <label htmlFor="prod-prompt-tokens">
                  Prompt tokens (per request)
                  <span className="calc-tooltip-icon" title="Average input tokens per API call (prompt + context). Used with output tokens to get cost per request." aria-label="Help">ⓘ</span>
                </label>
                <input type="number" id="prod-prompt-tokens" min={0} value={prodPromptTokens} onChange={(e) => setProdPromptTokens(Number(e.target.value) || 0)} />
              </div>
              <div className="calc-row">
                <label htmlFor="prod-output-tokens">
                  Output tokens (per request)
                  <span className="calc-tooltip-icon" title="Average completion tokens generated per request. Cost per request = (prompt × input price) + (output × output price)." aria-label="Help">ⓘ</span>
                </label>
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
                      <tr><th>Model</th><th>Provider</th><th>Cost/request</th><th>Daily cost</th><th>Monthly cost</th><th>Per annum</th></tr>
                    </thead>
                    <tbody>
                      {productionResult.rows.map((r, i) => (
                        <tr key={i}>
                          <td className="model-name">{r.name}</td>
                          <td>{r.provider}</td>
                          <td>${r.costPerReq?.toFixed(4)}</td>
                          <td>${r.dailyCost?.toFixed(2)}</td>
                          <td>${r.monthlyCost?.toFixed(2)}</td>
                          <td>${r.perAnnum?.toFixed(2)}</td>
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

    </div>
  );
}
