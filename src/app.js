/**
 * Main app: state, load/refresh/history, calculators, UI wiring.
 * Imports: api, pricingService, calculator, render.
 */

import * as api from './api.js';
import * as pricing from './pricingService.js';
import * as calc from './calculator.js';
import * as render from './render.js';

// --- State ---
let geminiData = [];
let openaiData = [];
let anthropicData = [];
let mistralData = [];

function getData() {
  return { gemini: geminiData, openai: openaiData, anthropic: anthropicData, mistral: mistralData };
}

function setData(data) {
  if (data.gemini) geminiData = data.gemini;
  if (data.openai) openaiData = data.openai;
  if (data.anthropic) anthropicData = data.anthropic;
  if (data.mistral) mistralData = data.mistral;
}

// --- Load & refresh ---
async function loadPricing() {
  const result = await pricing.loadPricing(api.getPricing);
  setData(result);
  render.setLastUpdated(result.updated);
  render.renderTables(getData());
  pricing.cleanupHistoryToDailyOnly();
  if (!api.isGitHubPages()) await fillMissingProvidersFromVizra();
  maybeRunDailyCapture();
  if (result.usedFallback === 'cache') render.showToast('Loaded pricing from local cache (file unavailable).', 'success');
  if (result.usedFallback === 'default') render.showToast('Using embedded default pricing (no file or cache).', 'success');
}

async function fillMissingProvidersFromVizra() {
  if (anthropicData.length > 0 && mistralData.length > 0) return;
  const cache = pricing.getCachedPricingPayload();
  if (cache && pricing.isCacheFresh(cache.cachedAt)) {
    if (anthropicData.length === 0 && cache.anthropic?.length) anthropicData = cache.anthropic.slice();
    if (mistralData.length === 0 && cache.mistral?.length) mistralData = cache.mistral.slice();
    if (anthropicData.length > 0 || mistralData.length > 0) {
      render.renderTables(getData());
      return;
    }
  }
  try {
    const data = await api.fetchVizraPricing();
    if (!data || typeof data !== 'object') throw new Error('Invalid response');
    const parsed = pricing.parseVizraResponse(data);
    if (!parsed?.anthropic?.length && !parsed?.mistral?.length) throw new Error('Could not parse');
    let updated = false;
    if (anthropicData.length === 0 && parsed.anthropic?.length) {
      anthropicData = parsed.anthropic;
      updated = true;
    }
    if (mistralData.length === 0 && parsed.mistral?.length) {
      mistralData = parsed.mistral;
      updated = true;
    }
    if (updated) {
      render.renderTables(getData());
      const payload = { ...getData(), updated: new Date().toISOString().slice(0, 10), cachedAt: Date.now() };
      try {
        localStorage.setItem(pricing.STORAGE_KEY, JSON.stringify(payload));
      } catch (_) {}
    }
  } catch (_) {
    const applied = await pricing.applyFallbackPricingFromFile(api.getPricing, getData());
    if (applied) {
      setData(applied);
      render.renderTables(getData());
      try {
        localStorage.setItem(pricing.STORAGE_KEY, JSON.stringify({ ...getData(), updated: new Date().toISOString().slice(0, 10), cachedAt: Date.now() }));
      } catch (_) {}
    }
  }
}

async function runDailyCapture() {
  const today = pricing.getTodayIST();
  try {
    let g = geminiData.slice(),
      o = openaiData.slice(),
      a = anthropicData.slice(),
      m = mistralData.slice();
    const cache = pricing.getCachedPricingPayload();
    if (cache && pricing.isCacheFresh(cache.cachedAt)) {
      if (cache.gemini?.length) g = cache.gemini.slice();
      if (cache.openai?.length) o = cache.openai.slice();
      if (cache.anthropic?.length) a = cache.anthropic.slice();
      if (cache.mistral?.length) m = cache.mistral.slice();
    } else {
      try {
        const vizraData = await api.fetchVizraPricing();
        if (vizraData && typeof vizraData === 'object') {
          const parsed = pricing.parseVizraResponse(vizraData);
          if (parsed && (parsed.gemini?.length || parsed.openai?.length)) {
            if (parsed.gemini?.length) g = parsed.gemini;
            if (parsed.openai?.length) o = parsed.openai;
            if (parsed.anthropic?.length) a = parsed.anthropic;
            if (parsed.mistral?.length) m = parsed.mistral;
          }
        }
      } catch (_) {}
    }
    pricing.saveToHistory(g, o, { daily: true, date: pricing.getToday12AMIST(), anthropic: a, mistral: m });
    try {
      localStorage.setItem(pricing.LAST_DAILY_KEY, today);
    } catch (_) {}
    setData({ gemini: g, openai: o, anthropic: a, mistral: m });
    const payload = { ...getData(), updated: new Date().toISOString().slice(0, 10), cachedAt: Date.now() };
    try {
      localStorage.setItem(pricing.STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {}
    render.setLastUpdated(payload.updated + ' (from web)');
    render.renderTables(getData());
    render.showToast('Daily snapshot saved to History.', 'success');
  } catch (_) {}
}

function maybeRunDailyCapture() {
  const last = localStorage.getItem(pricing.LAST_DAILY_KEY);
  const today = pricing.getTodayIST();
  if (last === today) return;
  setTimeout(() => runDailyCapture(), 800);
}

async function refreshFromWeb() {
  const btn = document.getElementById('refreshWebBtn');
  const icon = document.getElementById('refreshIcon');
  const previous = getData();
  const prev = { gemini: previous.gemini.slice(), openai: previous.openai.slice(), anthropic: previous.anthropic.slice(), mistral: previous.mistral.slice() };
  btn.disabled = true;
  icon.classList.add('spinning');
  const fmt = (v) => (v === 0 ? 'Free' : '$' + Number(v).toFixed(2));
  const renderPriceChanges = (drops, increases) => {
    const summaryEl = document.getElementById('priceChangesSummary');
    if (!summaryEl) return;
    if (drops.length || increases.length) {
      const dropRows = drops.slice(0, 10).map((d) => `<tr class="change-drop"><td class="col-direction">↓</td><td class="col-provider">${d.provider}</td><td class="col-model">${d.name}</td><td class="col-field">${d.field}</td><td class="col-prices">${fmt(d.oldVal)} → ${fmt(d.newVal)}</td></tr>`).join('');
      const riseRows = increases.slice(0, 10).map((d) => `<tr class="change-rise"><td class="col-direction">↑</td><td class="col-provider">${d.provider}</td><td class="col-model">${d.name}</td><td class="col-field">${d.field}</td><td class="col-prices">${fmt(d.oldVal)} → ${fmt(d.newVal)}</td></tr>`).join('');
      const moreD = drops.length > 10 ? `<tr><td colspan="5" class="change-more">↓ … and ${drops.length - 10} more drop(s)</td></tr>` : '';
      const moreI = increases.length > 10 ? `<tr><td colspan="5" class="change-more">↑ … and ${increases.length - 10} more increase(s)</td></tr>` : '';
      summaryEl.innerHTML = '<h4>Recent price changes</h4><p class="price-changes-hint">Which models dropped (↓) or increased (↑):</p><table class="change-table"><thead><tr><th class="col-direction"></th><th class="col-provider">Provider</th><th class="col-model">Model</th><th class="col-field">Field</th><th class="col-prices">Old → New</th></tr></thead><tbody>' + dropRows + riseRows + moreD + moreI + '</tbody></table>';
      summaryEl.classList.remove('hidden');
      summaryEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      summaryEl.innerHTML = '';
      summaryEl.classList.add('hidden');
    }
  };
  try {
    if (api.isGitHubPages()) {
      const data = await api.getPricing();
      if (!data || typeof data !== 'object') throw new Error('Could not load pricing');
      setData({
        gemini: data.gemini?.length ? pricing.dedupeModelsByName(data.gemini) : geminiData,
        openai: data.openai?.length ? pricing.dedupeModelsByName(data.openai) : openaiData,
        anthropic: data.anthropic?.length ? pricing.dedupeModelsByName(data.anthropic) : anthropicData,
        mistral: data.mistral?.length ? pricing.dedupeModelsByName(data.mistral) : mistralData,
      });
      const payload = { ...getData(), updated: data.updated || new Date().toISOString().slice(0, 10), cachedAt: Date.now() };
      let drops = [],
        increases = [];
      try {
        const last = localStorage.getItem(pricing.STORAGE_KEY);
        if (last) {
          const lastData = JSON.parse(last);
          const diff = pricing.comparePrices(lastData, payload);
          drops = diff.drops;
          increases = diff.increases;
        }
      } catch (_) {}
      try {
        localStorage.setItem(pricing.STORAGE_KEY, JSON.stringify(payload));
      } catch (_) {}
      render.setLastUpdated(render.formatTimestampWithTimezone(new Date()) + ' (from site)');
      render.renderTables(getData());
      if (drops.length || increases.length) {
        renderPriceChanges(drops, increases);
        render.showToast('Pricing reloaded. See which models changed below.', 'success');
      } else {
        renderPriceChanges([], []);
        render.showToast('Pricing reloaded from site.', 'success');
      }
    } else {
      const vizraData = await api.fetchVizraPricing();
      if (!vizraData || typeof vizraData !== 'object') throw new Error('Vizra API unavailable');
      const parsed = pricing.parseVizraResponse(vizraData);
      if (!parsed || (!parsed.gemini?.length && !parsed.openai?.length)) throw new Error('No pricing data');
      setData({
        gemini: parsed.gemini?.length ? parsed.gemini : geminiData,
        openai: parsed.openai?.length ? parsed.openai : openaiData,
        anthropic: parsed.anthropic?.length ? parsed.anthropic : anthropicData,
        mistral: parsed.mistral?.length ? parsed.mistral : mistralData,
      });
      const payload = { ...getData(), updated: new Date().toISOString().slice(0, 10), cachedAt: Date.now() };
      let drops = [],
        increases = [];
      try {
        const last = localStorage.getItem(pricing.STORAGE_KEY);
        if (last) {
          const lastData = JSON.parse(last);
          const diff = pricing.comparePrices(lastData, payload);
          drops = diff.drops;
          increases = diff.increases;
        }
      } catch (_) {}
      try {
        localStorage.setItem(pricing.STORAGE_KEY, JSON.stringify(payload));
      } catch (_) {}
      render.setLastUpdated(render.formatTimestampWithTimezone(new Date()) + ' (Vizra)');
      render.renderTables(getData());
      if (drops.length || increases.length) {
        renderPriceChanges(drops, increases);
        render.showToast('Pricing updated. See which models changed below.', 'success');
      } else {
        renderPriceChanges([], []);
        render.showToast('Pricing updated from Vizra API.', 'success');
      }
    }
  } catch (e) {
    setData(prev);
    const fallback = await pricing.applyFallbackPricingFromFile(api.getPricing, getData());
    if (fallback) {
      setData(fallback);
      render.setLastUpdated(render.formatTimestampWithTimezone(new Date()) + ' (fallback)');
      render.renderTables(getData());
      render.showToast('API unavailable. Using fallback pricing from pricing.json.', 'success');
    } else {
      render.renderTables(getData());
      render.showToast('Refresh failed: ' + (e?.message || 'network error') + '. Kept current pricing.', 'error');
    }
  } finally {
    btn.disabled = false;
    icon.classList.remove('spinning');
  }
}

// --- History ---
function runHistoryCompare() {
  const fromIdx = parseInt(document.getElementById('historyCompareFrom')?.value, 10) || 0;
  const toIdx = parseInt(document.getElementById('historyCompareTo')?.value, 10) || 0;
  const resultEl = document.getElementById('historyCompareResult');
  const list = pricing.getHistory();
  if (fromIdx < 0 || toIdx < 0 || fromIdx >= list.length || toIdx >= list.length) {
    resultEl.style.display = 'block';
    resultEl.innerHTML = '<p class="history-empty">Select two snapshots to compare.</p>';
    return;
  }
  const fromEntry = list[fromIdx];
  const toEntry = list[toIdx];
  const fromDateStr = new Date(fromEntry.date).toLocaleString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' });
  const toDateStr = new Date(toEntry.date).toLocaleString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' });
  const toMap = (arr) => (arr || []).reduce((acc, m) => {
    acc[m.name] = m;
    return acc;
  }, {});
  const gFrom = toMap(fromEntry.gemini);
  const gTo = toMap(toEntry.gemini);
  const oFrom = toMap(fromEntry.openai);
  const oTo = toMap(toEntry.openai);
  const aFrom = toMap(fromEntry.anthropic);
  const aTo = toMap(toEntry.anthropic);
  const mFrom = toMap(fromEntry.mistral);
  const mTo = toMap(toEntry.mistral);
  const allGemini = [...new Set([...Object.keys(gFrom), ...Object.keys(gTo)])].sort();
  const allOpenai = [...new Set([...Object.keys(oFrom), ...Object.keys(oTo)])].sort();
  const allAnthropic = [...new Set([...Object.keys(aFrom), ...Object.keys(aTo)])].sort();
  const allMistral = [...new Set([...Object.keys(mFrom), ...Object.keys(mTo)])].sort();
  const fmt = (v) => (v === 0 ? 'Free' : '$' + Number(v).toFixed(2));
  const row = (modelName, a, b, hasCached = false) => {
    const in1 = a ? fmt(a.input) : '—';
    const out1 = a ? fmt(a.output) : '—';
    const in2 = b ? fmt(b.input) : '—';
    const out2 = b ? fmt(b.output) : '—';
    let change = '';
    if (!a) change = '<span class="model-added">Added</span>';
    else if (!b) change = '<span class="model-removed">Removed</span>';
    else if (a.input !== b.input || a.output !== b.output || (hasCached && (a.cachedInput || 0) !== (b.cachedInput || 0))) change = '<span class="price-changed">Changed</span>';
    else change = '<span class="price-same">Same</span>';
    const c1 = hasCached && a?.cachedInput != null ? fmt(a.cachedInput) : '—';
    const c2 = hasCached && b?.cachedInput != null ? fmt(b.cachedInput) : '—';
    return hasCached
      ? `<tr><td class="model-name">${modelName}</td><td>${in1}</td><td>${c1}</td><td>${out1}</td><td>${in2}</td><td>${c2}</td><td>${out2}</td><td>${change}</td></tr>`
      : `<tr><td class="model-name">${modelName}</td><td>${in1}</td><td>${out1}</td><td>${in2}</td><td>${out2}</td><td>${change}</td></tr>`;
  };
  const geminiRows = allGemini.map((n) => row(n, gFrom[n], gTo[n])).join('');
  const openaiRows = allOpenai.map((n) => row(n, oFrom[n], oTo[n], true)).join('');
  const anthropicRows = allAnthropic.length
    ? allAnthropic.map((n) => row(n, aFrom[n], aTo[n])).join('')
    : '<tr><td class="history-no-data" colspan="6">No Anthropic data in selected snapshots</td></tr>';
  const mistralRows = allMistral.length
    ? allMistral.map((n) => row(n, mFrom[n], mTo[n])).join('')
    : '<tr><td class="history-no-data" colspan="6">No Mistral data in selected snapshots</td></tr>';
  resultEl.innerHTML = `
    <h4>Google Gemini</h4>
    <table class="model-table"><thead><tr><th>Model</th><th>Input (${fromDateStr})</th><th>Output (${fromDateStr})</th><th>Input (${toDateStr})</th><th>Output (${toDateStr})</th><th>Change</th></tr></thead><tbody>${geminiRows.join('')}</tbody></table>
    <h4>OpenAI</h4>
    <table class="model-table"><thead><tr><th>Model</th><th>Input (${fromDateStr})</th><th>Cached</th><th>Output</th><th>Input (${toDateStr})</th><th>Cached</th><th>Output</th><th>Change</th></tr></thead><tbody>${openaiRows.join('')}</tbody></table>
    <h4>Anthropic</h4>
    <table class="model-table"><thead><tr><th>Model</th><th>Input (${fromDateStr})</th><th>Output (${fromDateStr})</th><th>Input (${toDateStr})</th><th>Output (${toDateStr})</th><th>Change</th></tr></thead><tbody>${anthropicRows}</tbody></table>
    <h4>Mistral</h4>
    <table class="model-table"><thead><tr><th>Model</th><th>Input (${fromDateStr})</th><th>Output (${fromDateStr})</th><th>Input (${toDateStr})</th><th>Output (${toDateStr})</th><th>Change</th></tr></thead><tbody>${mistralRows}</tbody></table>`;
  resultEl.style.display = 'block';
}

function openHistoryModal() {
  render.renderHistoryList(pricing.getHistory());
  document.getElementById('historyCompareBtn')?.addEventListener('click', runHistoryCompare);
  render.openHistoryModal();
}

// --- Exports (CSV/PDF) ---
function exportPricingCSV() {
  const rows = ['Provider,Model,Input per 1M tokens,Output per 1M tokens,Cached input per 1M tokens'];
  const { gemini, openai, anthropic, mistral } = getData();
  gemini.forEach((m) => rows.push(['Google Gemini', m.name, m.input, m.output, ''].map(render.escapeCsvCell).join(',')));
  openai.forEach((m) => rows.push(['OpenAI', m.name, m.input, m.output, m.cachedInput != null ? m.cachedInput : ''].map(render.escapeCsvCell).join(',')));
  anthropic.forEach((m) => rows.push(['Anthropic', m.name, m.input, m.output, ''].map(render.escapeCsvCell).join(',')));
  mistral.forEach((m) => rows.push(['Mistral', m.name, m.input, m.output, ''].map(render.escapeCsvCell).join(',')));
  const csv = '\uFEFF' + rows.join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'ai-pricing-' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportPricingPDF() {
  const JsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  if (typeof JsPDF === 'undefined') {
    render.showToast('PDF library loading. Please try again in a moment.', 'error');
    return;
  }
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFontSize(14);
  doc.text('AI Model Pricing', pageW / 2, 18, { align: 'center' });
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text('Pricing as of: ' + new Date().toLocaleDateString(undefined, { dateStyle: 'long' }), pageW / 2, 25, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  const headers = ['Provider', 'Model', 'Input/1M', 'Output/1M', 'Cached/1M'];
  const colWidths = [32, 56, 24, 24, 24];
  const rows = [];
  getData().gemini.forEach((m) => rows.push(['Google Gemini', m.name, m.input === 0 ? 'Free' : '$' + Number(m.input).toFixed(2), m.output === 0 ? 'Free' : '$' + Number(m.output).toFixed(2), '—']));
  getData().openai.forEach((m) => rows.push(['OpenAI', m.name, m.input === 0 ? 'Free' : '$' + Number(m.input).toFixed(2), m.output === 0 ? 'Free' : '$' + Number(m.output).toFixed(2), m.cachedInput != null ? '$' + Number(m.cachedInput).toFixed(2) : '—']));
  getData().anthropic.forEach((m) => rows.push(['Anthropic', m.name, m.input === 0 ? 'Free' : '$' + Number(m.input).toFixed(2), m.output === 0 ? 'Free' : '$' + Number(m.output).toFixed(2), '—']));
  getData().mistral.forEach((m) => rows.push(['Mistral', m.name, m.input === 0 ? 'Free' : '$' + Number(m.input).toFixed(2), m.output === 0 ? 'Free' : '$' + Number(m.output).toFixed(2), '—']));
  render.drawPdfBorderedTable(doc, 32, headers, rows, colWidths);
  doc.save('ai-pricing-' + new Date().toISOString().slice(0, 10) + '.pdf');
}

function exportHistoryCSV() {
  const list = pricing.getHistory();
  if (!list.length) {
    render.showToast('No history to export.', 'error');
    return;
  }
  const rows = ['Date,Provider,Model,Input per 1M tokens,Output per 1M tokens,Cached input per 1M tokens'];
  list.forEach((entry) => {
    const dateStr = render.formatHistoryDate(entry.date, entry.daily || entry.weekly);
    (entry.gemini || []).forEach((m) => rows.push([dateStr, 'Google Gemini', m.name, m.input, m.output, ''].map(render.escapeCsvCell).join(',')));
    (entry.openai || []).forEach((m) => rows.push([dateStr, 'OpenAI', m.name, m.input, m.output, m.cachedInput != null ? m.cachedInput : ''].map(render.escapeCsvCell).join(',')));
    (entry.anthropic || []).forEach((m) => rows.push([dateStr, 'Anthropic', m.name, m.input, m.output, ''].map(render.escapeCsvCell).join(',')));
    (entry.mistral || []).forEach((m) => rows.push([dateStr, 'Mistral', m.name, m.input, m.output, ''].map(render.escapeCsvCell).join(',')));
  });
  const csv = '\uFEFF' + rows.join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'ai-pricing-history-' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  render.showToast('History exported as CSV.', 'success');
}

function exportHistoryPDF() {
  const JsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  if (typeof JsPDF === 'undefined') {
    render.showToast('PDF library loading. Please try again in a moment.', 'error');
    return;
  }
  const list = pricing.getHistory();
  if (!list.length) {
    render.showToast('No history to export.', 'error');
    return;
  }
  const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFontSize(14);
  doc.text('AI Pricing History', pageW / 2, 14, { align: 'center' });
  const headers = ['Date', 'Provider', 'Model', 'Input/1M', 'Output/1M', 'Cached/1M'];
  const colWidths = [42, 28, 48, 22, 22, 22];
  const rows = [];
  list.forEach((entry) => {
    const dateStr = render.formatHistoryDate(entry.date, entry.daily || entry.weekly);
    (entry.gemini || []).forEach((m) => rows.push([dateStr, 'Google Gemini', m.name, m.input === 0 ? 'Free' : '$' + Number(m.input).toFixed(2), m.output === 0 ? 'Free' : '$' + Number(m.output).toFixed(2), '—']));
    (entry.openai || []).forEach((m) => rows.push([dateStr, 'OpenAI', m.name, m.input === 0 ? 'Free' : '$' + Number(m.input).toFixed(2), m.output === 0 ? 'Free' : '$' + Number(m.output).toFixed(2), m.cachedInput != null ? '$' + Number(m.cachedInput).toFixed(2) : '—']));
    (entry.anthropic || []).forEach((m) => rows.push([dateStr, 'Anthropic', m.name, m.input === 0 ? 'Free' : '$' + Number(m.input).toFixed(2), m.output === 0 ? 'Free' : '$' + Number(m.output).toFixed(2), '—']));
    (entry.mistral || []).forEach((m) => rows.push([dateStr, 'Mistral', m.name, m.input === 0 ? 'Free' : '$' + Number(m.input).toFixed(2), m.output === 0 ? 'Free' : '$' + Number(m.output).toFixed(2), '—']));
  });
  render.drawPdfBorderedTable(doc, 22, headers, rows, colWidths);
  doc.save('ai-pricing-history-' + new Date().toISOString().slice(0, 10) + '.pdf');
  render.showToast('History exported as PDF.', 'success');
}

// --- Calculators ---
function runPromptCostEstimate() {
  const textarea = document.getElementById('prompt-input');
  const outputTokensEl = document.getElementById('prompt-output-tokens');
  const resultEl = document.getElementById('prompt-cost-result');
  const promptText = textarea?.value ?? '';
  const promptTokens = calc.estimatePromptTokens(promptText);
  const outputTokens = Math.max(0, parseInt(outputTokensEl?.value || '500', 10) || 500);
  const tokenCountEl = document.getElementById('prompt-token-count');
  if (tokenCountEl) tokenCountEl.textContent = 'Prompt tokens: ' + promptTokens;
  if (promptTokens === 0 && !promptText.trim()) {
    resultEl.style.display = 'none';
    return;
  }
  const data = getData();
  const list = [];
  data.gemini.forEach((m) => list.push({ provider: 'Google Gemini', name: m.name, cost: calc.calcCost(promptTokens, outputTokens, m.input, m.output) }));
  data.openai.forEach((m) => {
    if (/^text-embedding/i.test(m.name)) return;
    list.push({ provider: 'OpenAI', name: m.name, cost: calc.calcCostOpenAI(promptTokens, 0, outputTokens, m.input, m.cachedInput, m.output) });
  });
  data.anthropic.forEach((m) => list.push({ provider: 'Anthropic', name: m.name, cost: calc.calcCost(promptTokens, outputTokens, m.input, m.output) }));
  data.mistral.forEach((m) => list.push({ provider: 'Mistral', name: m.name, cost: calc.calcCost(promptTokens, outputTokens, m.input, m.output) }));
  const rows = list.map((m) => `<li><span class="model-label">${m.name}</span> <span class="model-cost">$${m.cost.toFixed(5)}</span></li>`).join('');
  resultEl.innerHTML = '<h4>Cost by model</h4><ul class="prompt-cost-list">' + rows + '</ul>';
  resultEl.style.display = 'block';
}

function resetPromptEstimator() {
  const textarea = document.getElementById('prompt-input');
  const outputTokensEl = document.getElementById('prompt-output-tokens');
  const resultEl = document.getElementById('prompt-cost-result');
  const tokenCountEl = document.getElementById('prompt-token-count');
  if (textarea) textarea.value = '';
  if (outputTokensEl) outputTokensEl.value = '500';
  if (tokenCountEl) tokenCountEl.textContent = 'Prompt tokens: —';
  if (resultEl) {
    resultEl.style.display = 'none';
    resultEl.innerHTML = '';
  }
}

function setPromptFromText(text) {
  const textarea = document.getElementById('prompt-input');
  const tokenCountEl = document.getElementById('prompt-token-count');
  if (textarea) {
    textarea.value = text || '';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (tokenCountEl) tokenCountEl.textContent = 'Prompt tokens: ' + calc.estimatePromptTokens(text || '');
}

async function handlePromptFileSelect(file) {
  if (!file) return;
  const loadingEl = document.getElementById('promptImportLoading');
  const hintEl = document.getElementById('promptImportHint');
  const name = file.name || '';
  const ext = name.split('.').pop().toLowerCase();
  const isPdf = ext === 'pdf' || file.type === 'application/pdf';
  if (loadingEl) loadingEl.style.display = 'inline';
  if (hintEl) hintEl.textContent = 'Importing ' + name + '…';
  try {
    if (isPdf) {
      if (typeof pdfjsLib === 'undefined') {
        if (hintEl) hintEl.textContent = 'PDF library not loaded. Use TXT/CSV or refresh.';
        return;
      }
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map((item) => item.str).join(' ') + '\n';
      }
      setPromptFromText(fullText.trim());
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        setPromptFromText(reader.result || '');
        if (hintEl) hintEl.textContent = 'TXT, CSV, PDF, MD, JSON';
        if (loadingEl) loadingEl.style.display = 'none';
        document.getElementById('prompt-file-input').value = '';
      };
      reader.onerror = () => {
        if (hintEl) hintEl.textContent = 'Could not read file.';
        if (loadingEl) loadingEl.style.display = 'none';
      };
      reader.readAsText(file, 'UTF-8');
      return;
    }
  } catch (e) {
    if (hintEl) hintEl.textContent = 'Import failed: ' + (e?.message || 'unknown');
  }
  if (hintEl) hintEl.textContent = 'TXT, CSV, PDF, MD, JSON';
  if (loadingEl) loadingEl.style.display = 'none';
  document.getElementById('prompt-file-input').value = '';
}

function runContextWindowCheck() {
  const promptEl = document.getElementById('context-prompt-tokens');
  const outputEl = document.getElementById('context-output-tokens');
  const resultEl = document.getElementById('context-window-result');
  const promptTokens = Math.max(0, parseInt(promptEl?.value || '0', 10) || 0);
  const outputTokens = Math.max(0, parseInt(outputEl?.value || '0', 10) || 0);
  const total = promptTokens + outputTokens;
  const rows = [];
  const NEAR_THRESHOLD = 0.9;
  const data = getData();
  function addContextRows(providerKey, arr) {
    (arr || []).forEach((m) => {
      const ctx = calc.getContextWindow(providerKey, m.name);
      if (!ctx) return;
      let resultClass = 'result-fits';
      let resultText = 'Fits';
      if (total > ctx.tokens) {
        resultClass = 'result-exceeds';
        resultText = 'Exceeds';
      } else if (total >= ctx.tokens * NEAR_THRESHOLD) {
        resultClass = 'result-near';
        resultText = 'Near limit';
      }
      rows.push(`<tr><td class="model-name">${m.name}</td><td>${ctx.label}</td><td class="${resultClass}">${resultText}</td></tr>`);
    });
  }
  addContextRows('gemini', data.gemini);
  data.openai.forEach((m) => {
    if (/^text-embedding/i.test(m.name)) return;
    const ctx = calc.getContextWindow('openai', m.name);
    if (!ctx) return;
    let resultClass = 'result-fits',
      resultText = 'Fits';
    if (total > ctx.tokens) {
      resultClass = 'result-exceeds';
      resultText = 'Exceeds';
    } else if (total >= ctx.tokens * NEAR_THRESHOLD) {
      resultClass = 'result-near';
      resultText = 'Near limit';
    }
    rows.push(`<tr><td class="model-name">${m.name}</td><td>${ctx.label}</td><td class="${resultClass}">${resultText}</td></tr>`);
  });
  addContextRows('anthropic', data.anthropic);
  addContextRows('mistral', data.mistral);
  resultEl.innerHTML = '<h4>Results</h4><table class="model-table"><thead><tr><th>Model</th><th>Context window</th><th>Result</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>';
  resultEl.style.display = 'block';
}

function resetContextWindowCheck() {
  const promptEl = document.getElementById('context-prompt-tokens');
  const outputEl = document.getElementById('context-output-tokens');
  const resultEl = document.getElementById('context-window-result');
  if (promptEl) promptEl.value = '10000';
  if (outputEl) outputEl.value = '4000';
  if (resultEl) {
    resultEl.style.display = 'none';
    resultEl.innerHTML = '';
  }
}

function runProductionCostSim() {
  const usersPerDay = Math.max(0, parseInt(document.getElementById('prod-users-per-day')?.value || '0', 10) || 0);
  const requestsPerUser = Math.max(0, parseInt(document.getElementById('prod-requests-per-user')?.value || '0', 10) || 0);
  const promptTokens = Math.max(0, parseInt(document.getElementById('prod-prompt-tokens')?.value || '0', 10) || 0);
  const outputTokens = Math.max(0, parseInt(document.getElementById('prod-output-tokens')?.value || '0', 10) || 0);
  const resultEl = document.getElementById('production-cost-result');
  const totalRequestsPerDay = usersPerDay * requestsPerUser;
  if (totalRequestsPerDay === 0) {
    resultEl.style.display = 'none';
    return;
  }
  const data = getData();
  const list = [];
  data.gemini.forEach((m) => {
    const costPerRequest = calc.calcCost(promptTokens, outputTokens, m.input, m.output);
    list.push({ name: m.name, daily: costPerRequest * totalRequestsPerDay, monthly: costPerRequest * totalRequestsPerDay * 30 });
  });
  data.openai.forEach((m) => {
    if (/^text-embedding/i.test(m.name)) return;
    const costPerRequest = calc.calcCostOpenAI(promptTokens, 0, outputTokens, m.input, m.cachedInput, m.output);
    list.push({ name: m.name, daily: costPerRequest * totalRequestsPerDay, monthly: costPerRequest * totalRequestsPerDay * 30 });
  });
  data.anthropic.forEach((m) => {
    const costPerRequest = calc.calcCost(promptTokens, outputTokens, m.input, m.output);
    list.push({ name: m.name, daily: costPerRequest * totalRequestsPerDay, monthly: costPerRequest * totalRequestsPerDay * 30 });
  });
  data.mistral.forEach((m) => {
    const costPerRequest = calc.calcCost(promptTokens, outputTokens, m.input, m.output);
    list.push({ name: m.name, daily: costPerRequest * totalRequestsPerDay, monthly: costPerRequest * totalRequestsPerDay * 30 });
  });
  const rows = list.map((m) => `<tr><td class="model-name">${m.name}</td><td class="cost-daily">$${m.daily.toFixed(2)}</td><td class="cost-monthly">$${m.monthly.toFixed(2)}</td></tr>`).join('');
  resultEl.innerHTML = '<h4>Estimated costs (30-day month)</h4><table class="model-table"><thead><tr><th>Model</th><th>Daily cost</th><th>Monthly cost</th></tr></thead><tbody>' + rows + '</tbody></table>';
  resultEl.style.display = 'block';
}

function resetProductionCostSim() {
  document.getElementById('prod-users-per-day').value = '1000';
  document.getElementById('prod-requests-per-user').value = '10';
  document.getElementById('prod-prompt-tokens').value = '500';
  document.getElementById('prod-output-tokens').value = '200';
  const resultEl = document.getElementById('production-cost-result');
  if (resultEl) {
    resultEl.style.display = 'none';
    resultEl.innerHTML = '';
  }
}

function renderCompareResult(name1, cost1, name2, cost2) {
  const diff = Math.abs(cost1 - cost2);
  const summary = diff === 0 ? 'Same cost' : (cost1 < cost2 ? name1 : name2) + ' is cheaper by $' + diff.toFixed(4);
  return `<table class="calc-result-table"><tr><td>${name1}</td><td class="cost">$${cost1.toFixed(4)}</td></tr><tr><td>${name2}</td><td class="cost">$${cost2.toFixed(4)}</td></tr></table><p class="compare-summary">${summary}</p>`;
}

function calculateUnified() {
  const inputTokens = parseInt(document.getElementById('calc-input-tokens')?.value, 10) || 0;
  const cachedTokens = parseInt(document.getElementById('calc-cached-tokens')?.value, 10) || 0;
  const outputTokens = parseInt(document.getElementById('calc-output-tokens')?.value, 10) || 0;
  const sel = document.getElementById('calc-model')?.value;
  const compareSel = document.getElementById('calc-compare')?.value;
  const resultEl = document.getElementById('calc-result');
  const data = getData();
  resultEl.style.display = 'block';
  if (sel === '') {
    resultEl.innerHTML = '<span style="color:#a0a0a0">Select a model.</span>';
    return;
  }
  if (sel === '__all__') {
    const unified = calc.getUnifiedCalcModels(data);
    const withCost = unified.map((u) => ({
      label: u.label,
      cost: calc.calcCostForEntry({ provider: u.provider, model: u.model }, inputTokens, cachedTokens, outputTokens),
      provider: u.provider,
    }));
    withCost.sort((a, b) => {
      const pa = calc.PROVIDER_DISPLAY_ORDER[a.provider] ?? 99;
      const pb = calc.PROVIDER_DISPLAY_ORDER[b.provider] ?? 99;
      if (pa !== pb) return pa - pb;
      return a.cost - b.cost;
    });
    const rows = withCost.map((r) => `<tr><td>${r.label}</td><td class="cost">$${r.cost.toFixed(4)}</td></tr>`).join('');
    resultEl.className = 'calc-result wrap-scroll';
    resultEl.innerHTML = '<table class="calc-result-table"><thead><tr><th>Model</th><th>Est. cost</th></tr></thead><tbody>' + rows + '</tbody></table>';
    return;
  }
  const entry = calc.getCalcModelByKey(sel, data);
  if (!entry) {
    resultEl.innerHTML = '<span style="color:#a0a0a0">Invalid model selection.</span>';
    return;
  }
  const cost = calc.calcCostForEntry(entry, inputTokens, cachedTokens, outputTokens);
  if (compareSel && compareSel !== sel) {
    const entry2 = calc.getCalcModelByKey(compareSel, data);
    if (!entry2) {
      resultEl.className = 'calc-result single';
      resultEl.textContent = 'Estimated cost: $' + cost.toFixed(4);
      return;
    }
    const cost2 = calc.calcCostForEntry(entry2, inputTokens, cachedTokens, outputTokens);
    const name1 = entry.provider === 'gemini' ? 'Google Gemini — ' + entry.name : 'OpenAI — ' + entry.name;
    const name2 = entry2.provider === 'gemini' ? 'Google Gemini — ' + entry2.name : 'OpenAI — ' + entry2.name;
    resultEl.className = 'calc-result';
    resultEl.innerHTML = renderCompareResult(name1, cost, name2, cost2);
    return;
  }
  resultEl.className = 'calc-result single';
  resultEl.textContent = 'Estimated cost: $' + cost.toFixed(4);
}

function resetUnified() {
  document.getElementById('calc-model').value = '';
  document.getElementById('calc-compare').value = '';
  document.getElementById('calc-input-tokens').value = '100000';
  document.getElementById('calc-cached-tokens').value = '0';
  document.getElementById('calc-output-tokens').value = '10000';
  const resultEl = document.getElementById('calc-result');
  resultEl.style.display = 'none';
  resultEl.innerHTML = '';
}

// --- Doc search & recommendation ---
const GEMINI_PRICING_URL = 'https://ai.google.dev/gemini-api/docs/pricing';
const GEMINI_DOC_URL = 'https://ai.google.dev/gemini-api/docs/models/gemini';
const OPENAI_PRICING_URL = 'https://developers.openai.com/api/docs/pricing';
const OPENAI_DOC_URL = 'https://platform.openai.com/docs/models';

async function fetchDocsAndSearch(description) {
  const keywords = calc.extractKeywords(description);
  const geminiNames = geminiData.map((m) => m.name);
  const openaiNames = openaiData.map((m) => m.name);
  const [g1, g2] = await Promise.allSettled([api.fetchWithCors(GEMINI_PRICING_URL), api.fetchWithCors(GEMINI_DOC_URL)]);
  const [o1, o2] = await Promise.allSettled([api.fetchWithCors(OPENAI_PRICING_URL), api.fetchWithCors(OPENAI_DOC_URL)]);
  let geminiHtml = (g1.status === 'fulfilled' && g1.value ? g1.value : '') + (g2.status === 'fulfilled' && g2.value ? g2.value : '');
  let openaiHtml = (o1.status === 'fulfilled' && o1.value ? o1.value : '') + (o2.status === 'fulfilled' && o2.value ? o2.value : '');
  const geminiMatches = geminiHtml.trim() ? calc.searchDocContent(geminiHtml, geminiNames, keywords) : [];
  const openaiMatches = openaiHtml.trim() ? calc.searchDocContent(openaiHtml, openaiNames, keywords) : [];
  return {
    gemini: geminiMatches.map((m) => ({ ...m, providerKey: 'gemini', provider: 'Google Gemini' })),
    openai: openaiMatches.map((m) => ({ ...m, providerKey: 'openai', provider: 'OpenAI' })),
  };
}

async function runRecommendation() {
  const descEl = document.getElementById('useCaseDesc');
  const btn = document.getElementById('getRecommendBtn');
  const description = (descEl?.value || '').trim();
  const useCaseType = calc.inferUseCaseType(description);
  let results = calc.getRecommendations(getData(), useCaseType, description);
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Searching documentation…';
  }
  let docResults = null;
  try {
    docResults = await fetchDocsAndSearch(description);
  } catch (_) {}
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Get recommendation';
  }
  const docMap = new Map();
  if (docResults) {
    [...docResults.gemini, ...docResults.openai].forEach((m) => {
      const key = m.providerKey + ':' + m.modelName;
      if (!docMap.has(key) || (m.snippet && m.snippet.length > (docMap.get(key).snippet || '').length)) docMap.set(key, m);
    });
  }
  results = results.map((r) => {
    const key = r.providerKey + ':' + r.name;
    const match = docMap.get(key);
    if (match?.snippet) {
      const cleaned = calc.cleanDocSnippetForDisplay(match.snippet);
      const docSnippet = cleaned || calc.getGeneratedDocNote(r, useCaseType);
      return { ...r, docSnippet, docSnippetIsGenerated: !cleaned };
    }
    return r;
  });
  const hasDocSnippet = results.some((r) => r.docSnippet);
  if (hasDocSnippet && docResults) results.sort((a, b) => (b.docSnippet ? 1 : 0) - (a.docSnippet ? 1 : 0));
  render.renderRecommendations(results, !!(docResults && (docResults.gemini?.length || docResults.openai?.length)));
}

// --- Tabs & nav ---
function switchCalcSub(subId) {
  const ids = ['pricing', 'prompt', 'context', 'production'];
  if (!ids.includes(subId)) return;
  document.querySelectorAll('.calc-sub-panel').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.calc-sub-link').forEach((l) => l.classList.remove('active'));
  const panel = document.getElementById('calc-sub-' + subId);
  const link = document.querySelector('.calc-sub-link[data-calc-sub="' + subId + '"]');
  if (panel) panel.classList.add('active');
  if (link) link.classList.add('active');
  if (history.replaceState) history.replaceState(null, '', '#calc-' + subId);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function switchTab(tabId) {
  const ids = ['pricing', 'calculators', 'benchmarks', 'recommend'];
  if (!ids.includes(tabId)) return;
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.tab-link').forEach((l) => l.classList.remove('active'));
  const panel = document.getElementById('tab-' + tabId);
  const link = document.querySelector('.tab-link[data-tab="' + tabId + '"]');
  if (panel) panel.classList.add('active');
  if (link) link.classList.add('active');
  if (tabId === 'calculators') {
    const h = (location.hash || '').replace(/^#/, '');
    const calcSub = h.startsWith('calc-') ? h.replace('calc-', '') : 'pricing';
    switchCalcSub(['pricing', 'prompt', 'context', 'production'].includes(calcSub) ? calcSub : 'pricing');
  }
  if (history.replaceState && tabId !== 'calculators') history.replaceState(null, '', '#' + tabId);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- Expose for inline onclick (index.html) ---
window.exportPricingCSV = exportPricingCSV;
window.exportPricingPDF = exportPricingPDF;
window.exportHistoryCSV = exportHistoryCSV;
window.exportHistoryPDF = exportHistoryPDF;
window.calculateUnified = calculateUnified;
window.resetUnified = resetUnified;
window.runPromptCostEstimate = runPromptCostEstimate;
window.resetPromptEstimator = resetPromptEstimator;
window.runContextWindowCheck = runContextWindowCheck;
window.resetContextWindowCheck = resetContextWindowCheck;
window.runProductionCostSim = runProductionCostSim;
window.resetProductionCostSim = resetProductionCostSim;

// --- Init ---
document.querySelectorAll('.calc-sub-link').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    switchCalcSub(link.getAttribute('data-calc-sub'));
  });
});
document.querySelectorAll('.tab-link').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    switchTab(link.getAttribute('data-tab'));
  });
});
const hash = (location.hash || '').replace(/^#/, '');
if (hash.startsWith('calc-')) {
  switchTab('calculators');
  const sub = hash.replace('calc-', '');
  if (['pricing', 'prompt', 'context', 'production'].includes(sub)) switchCalcSub(sub);
} else if (['pricing', 'calculators', 'benchmarks', 'recommend'].includes(hash)) {
  switchTab(hash);
}
window.addEventListener('hashchange', () => {
  const h = (location.hash || '').replace(/^#/, '');
  if (h.startsWith('calc-')) {
    switchTab('calculators');
    const sub = h.replace('calc-', '');
    if (['pricing', 'prompt', 'context', 'production'].includes(sub)) switchCalcSub(sub);
  } else if (['pricing', 'calculators', 'benchmarks', 'recommend'].includes(h)) switchTab(h);
});
document.querySelector('.header-home-link')?.addEventListener('click', (e) => {
  e.preventDefault();
  switchTab('pricing');
  window.scrollTo(0, 0);
});
document.getElementById('refreshWebBtn')?.addEventListener('click', refreshFromWeb);
document.getElementById('getRecommendBtn')?.addEventListener('click', runRecommendation);
['gemini', 'openai', 'anthropic', 'mistral'].forEach((p) => {
  const el = document.getElementById(p + '-search');
  if (el) el.addEventListener('input', () => render.filterPricingTable(p + '-tbody', el.value));
});
const promptInputEl = document.getElementById('prompt-input');
if (promptInputEl) {
  promptInputEl.addEventListener('input', function () {
    const el = document.getElementById('prompt-token-count');
    if (el) el.textContent = 'Prompt tokens: ' + calc.estimatePromptTokens(this.value);
  });
}
document.getElementById('promptImportBtn')?.addEventListener('click', () => document.getElementById('prompt-file-input')?.click());
document.getElementById('prompt-file-input')?.addEventListener('change', function () {
  const file = this.files?.[0];
  if (file) handlePromptFileSelect(file);
});
document.getElementById('recommendResetBtn')?.addEventListener('click', () => {
  const descEl = document.getElementById('useCaseDesc');
  const btn = document.getElementById('getRecommendBtn');
  const resultEl = document.getElementById('recommendResult');
  if (descEl) descEl.value = '';
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Get recommendation';
  }
  if (resultEl) {
    resultEl.classList.add('hidden');
    document.getElementById('recommendList').innerHTML = '';
  }
});
document.getElementById('historyBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  openHistoryModal();
});
document.getElementById('historyModalClose')?.addEventListener('click', render.closeHistoryModal);
document.getElementById('historyModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'historyModal') render.closeHistoryModal();
});

document.addEventListener('DOMContentLoaded', loadPricing);
