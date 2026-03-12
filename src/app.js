/**
 * Main app: state, load/refresh/history, calculators, UI wiring.
 * Imports: api, api/pricingService, pricingService, calculator, render.
 */

import * as api from './api.js';
import * as pricingApi from './api/pricingService.js';
import * as pricing from './pricingService.js';
import { mergeTiersIntoPayload } from './data/pricingTiersOverlay.js';
import { getCachedPricing, setCachedPricing } from './utils/cacheManager.js';
import { isRetiredGeminiModel, isRetiredOpenAIModel, isRetiredAnthropicModel, isRetiredMistralModel } from './utils/retiredModels.js';
import { isAllowedModel } from './data/allowedModels.js';
import { getProviderByModelName } from './data/providerByModel.js';
import * as calc from './calculator.js';
import * as render from './render.js';
import * as valueChart from './valueChart.js';

// --- State ---
let geminiData = [];
let openaiData = [];
let anthropicData = [];
let mistralData = [];

function getData() {
  return { gemini: geminiData, openai: openaiData, anthropic: anthropicData, mistral: mistralData };
}

/** Reassign every model to its canonical provider by name so all models appear under the correct provider. */
function reassignByCanonicalProvider(data) {
  if (!data || typeof data !== 'object') return data;
  const buckets = { gemini: [], openai: [], anthropic: [], mistral: [] };
  const seen = { gemini: new Set(), openai: new Set(), anthropic: new Set(), mistral: new Set() };
  const push = (provider, model) => {
    if (!model || !model.name || !buckets[provider]) return;
    const key = model.name.toLowerCase().trim();
    if (seen[provider].has(key)) return;
    seen[provider].add(key);
    buckets[provider].push(model);
  };
  for (const provider of ['gemini', 'openai', 'anthropic', 'mistral']) {
    const list = data[provider];
    if (!Array.isArray(list)) continue;
    for (const m of list) {
      if (!m || !m.name) continue;
      const canonical = getProviderByModelName(m.name);
      if (canonical) push(canonical, m);
      else push(provider, m);
    }
  }
  return { ...data, ...buckets };
}

/** Keep only models that are listed as available on each provider's official page. */
function filterToAllowedModels(data) {
  if (!data || typeof data !== 'object') return data;
  return {
    ...data,
    gemini: Array.isArray(data.gemini) ? data.gemini.filter((m) => m && isAllowedModel('gemini', m.name)) : data.gemini,
    openai: Array.isArray(data.openai) ? data.openai.filter((m) => m && isAllowedModel('openai', m.name)) : data.openai,
    anthropic: Array.isArray(data.anthropic) ? data.anthropic.filter((m) => m && isAllowedModel('anthropic', m.name)) : data.anthropic,
    mistral: Array.isArray(data.mistral) ? data.mistral.filter((m) => m && isAllowedModel('mistral', m.name)) : data.mistral,
  };
}

/** Filter out retired/deprecated models (defense in depth after allowlist). */
function filterRetiredModels(data) {
  if (!data || typeof data !== 'object') return data;
  return {
    ...data,
    gemini: Array.isArray(data.gemini) ? data.gemini.filter((m) => m && !isRetiredGeminiModel(m.name)) : data.gemini,
    openai: Array.isArray(data.openai) ? data.openai.filter((m) => m && !isRetiredOpenAIModel(m.name)) : data.openai,
    anthropic: Array.isArray(data.anthropic) ? data.anthropic.filter((m) => m && !isRetiredAnthropicModel(m.name)) : data.anthropic,
    mistral: Array.isArray(data.mistral) ? data.mistral.filter((m) => m && !isRetiredMistralModel(m.name)) : data.mistral,
  };
}

function setData(data) {
  const reassigned = reassignByCanonicalProvider(data);
  const allowed = filterToAllowedModels(reassigned);
  const filtered = filterRetiredModels(allowed);
  if (filtered.gemini) geminiData = filtered.gemini;
  if (filtered.openai) openaiData = filtered.openai;
  if (filtered.anthropic) anthropicData = filtered.anthropic;
  if (filtered.mistral) mistralData = filtered.mistral;
}

// Last result per calculator (for export)
let lastPricingResult = null;
let lastPromptCostResult = null;
let lastContextResult = null;
let lastProductionResult = null;

// Benchmarks from benchmarks.json (merged with pricing in UI by model + provider)
let benchmarksData = null;

function getBenchmarksData() {
  return benchmarksData;
}

// Value chart (Cost vs Performance) options
let valueChartProviderFilter = 'all';
let valueChartMetric = 'arena';

function getValueChartOptions() {
  return { providerFilter: valueChartProviderFilter, performanceMetric: valueChartMetric };
}

function updateValueChartIfVisible() {
  valueChart.updateValueChart(getData(), getBenchmarksData(), getValueChartOptions());
}

// --- Load & refresh ---
async function loadPricing() {
  try {
    const [result, benchPayload] = await Promise.all([pricing.loadPricingFromApi(pricingApi.fetchPricingData), api.getBenchmarks()]);
    mergeTiersIntoPayload(result);
    setData(result);
    benchmarksData = benchPayload?.benchmarks ?? null;
    render.setLastUpdated(result.updated);
    render.setBenchmarksLastUpdated(benchPayload?.updated ?? '—');
    render.renderTables(getData(), getBenchmarksData());
    updateValueChartIfVisible();
    pricing.cleanupHistoryToDailyOnly();
    if (!api.isGitHubPages()) await fillMissingProvidersFromVizra();
    maybeRunDailyCapture();
    if (result.usedFallback === 'cache') render.showToast('Loaded pricing from local cache (file unavailable).', 'success');
    if (result.usedFallback === 'default') render.showToast('Using embedded default pricing (no file or cache).', 'success');
  } catch (err) {
    console.error('loadPricing failed:', err);
    const fallback = {
      gemini: pricing.DEFAULT_PRICING.gemini.slice(),
      openai: pricing.DEFAULT_PRICING.openai.slice(),
      anthropic: (pricing.DEFAULT_PRICING.anthropic || []).slice(),
      mistral: (pricing.DEFAULT_PRICING.mistral || []).slice(),
    };
    mergeTiersIntoPayload(fallback);
    setData(fallback);
    benchmarksData = null;
    render.setLastUpdated('embedded default');
    render.setBenchmarksLastUpdated('—');
    render.renderTables(getData(), getBenchmarksData());
    updateValueChartIfVisible();
    render.showToast('Using embedded default pricing.', 'success');
  }
}

async function fillMissingProvidersFromVizra() {
  if (anthropicData.length > 0 && mistralData.length > 0) return;
  const cache = pricing.getCachedPricingPayload();
  if (cache) {
    if (anthropicData.length === 0 && cache.anthropic?.length) anthropicData = cache.anthropic.slice();
    if (mistralData.length === 0 && cache.mistral?.length) mistralData = cache.mistral.slice();
    if (anthropicData.length > 0 || mistralData.length > 0) {
      render.renderTables(getData(), getBenchmarksData());
      updateValueChartIfVisible();
      return;
    }
  }
  try {
    const data = await pricingApi.fetchPricingData();
    if (!data || typeof data !== 'object') throw new Error('Invalid response');
    const { payload } = pricing.normalizeFetchedPricing(data);
    const parsed = payload || { anthropic: [], mistral: [] };
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
      render.renderTables(getData(), getBenchmarksData());
      updateValueChartIfVisible();
      setCachedPricing({ ...getData(), updated: new Date().toISOString().slice(0, 10) });
    }
  } catch (_) {
    const applied = await pricing.applyFallbackPricingFromFile(api.getPricing, getData());
    if (applied) {
      mergeTiersIntoPayload(applied);
      setData(applied);
      render.renderTables(getData(), getBenchmarksData());
      updateValueChartIfVisible();
      setCachedPricing({ ...getData(), updated: new Date().toISOString().slice(0, 10) });
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
    if (cache) {
      if (cache.gemini?.length) g = cache.gemini.slice();
      if (cache.openai?.length) o = cache.openai.slice();
      if (cache.anthropic?.length) a = cache.anthropic.slice();
      if (cache.mistral?.length) m = cache.mistral.slice();
    } else {
      try {
        const raw = await pricingApi.fetchPricingData();
        if (raw && typeof raw === 'object') {
          const { payload: parsed } = pricing.normalizeFetchedPricing(raw);
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
    const dailyPayload = { gemini: g, openai: o, anthropic: a, mistral: m };
    mergeTiersIntoPayload(dailyPayload);
    setData(dailyPayload);
    const payload = { ...getData(), updated: new Date().toISOString().slice(0, 10) };
    setCachedPricing(payload);
    render.setLastUpdated(payload.updated + ' (from web)');
    render.renderTables(getData(), getBenchmarksData());
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
      const refreshed = {
        gemini: data.gemini?.length ? pricing.dedupeModelsByName(data.gemini) : geminiData,
        openai: data.openai?.length ? pricing.dedupeModelsByName(data.openai) : openaiData,
        anthropic: data.anthropic?.length ? pricing.dedupeModelsByName(data.anthropic) : anthropicData,
        mistral: data.mistral?.length ? pricing.dedupeModelsByName(data.mistral) : mistralData,
      };
      mergeTiersIntoPayload(refreshed);
      setData(refreshed);
      const payload = { ...getData(), updated: data.updated || new Date().toISOString().slice(0, 10) };
      let drops = [],
        increases = [];
      try {
        const lastData = getCachedPricing();
        if (lastData) {
          const diff = pricing.comparePrices(lastData, payload);
          drops = diff.drops;
          increases = diff.increases;
        }
      } catch (_) {}
      setCachedPricing(payload);
      render.setLastUpdated(render.formatTimestampWithTimezone(new Date()) + ' (from site)');
      render.renderTables(getData(), getBenchmarksData());
      if (drops.length || increases.length) {
        renderPriceChanges(drops, increases);
        render.showToast('Pricing reloaded. See which models changed below.', 'success');
      } else {
        renderPriceChanges([], []);
        render.showToast('Pricing reloaded from site.', 'success');
      }
    } else {
      const raw = await pricingApi.fetchPricingData();
      if (!raw || typeof raw !== 'object') throw new Error('Pricing API unavailable');
      const { payload: parsed } = pricing.normalizeFetchedPricing(raw);
      if (!parsed || (!parsed.gemini?.length && !parsed.openai?.length)) throw new Error('No pricing data');
      const refreshedVizra = {
        gemini: parsed.gemini?.length ? parsed.gemini : geminiData,
        openai: parsed.openai?.length ? parsed.openai : openaiData,
        anthropic: parsed.anthropic?.length ? parsed.anthropic : anthropicData,
        mistral: parsed.mistral?.length ? parsed.mistral : mistralData,
      };
      mergeTiersIntoPayload(refreshedVizra);
      setData(refreshedVizra);
      const payload = { ...getData(), updated: new Date().toISOString().slice(0, 10) };
      let drops = [],
        increases = [];
      try {
        const lastData = getCachedPricing();
        if (lastData) {
          const diff = pricing.comparePrices(lastData, payload);
          drops = diff.drops;
          increases = diff.increases;
        }
      } catch (_) {}
      setCachedPricing(payload);
      render.setLastUpdated(render.formatTimestampWithTimezone(new Date()) + ' (Vizra)');
      render.renderTables(getData(), getBenchmarksData());
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
      mergeTiersIntoPayload(fallback);
      setData(fallback);
      render.setLastUpdated(render.formatTimestampWithTimezone(new Date()) + ' (fallback)');
      render.renderTables(getData(), getBenchmarksData());
      render.showToast('API unavailable. Using fallback pricing from pricing.json.', 'success');
    } else {
      render.renderTables(getData(), getBenchmarksData());
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
  const geminiRows = allGemini.map((n) => row(n, gFrom[n], gTo[n]));
  const openaiRows = allOpenai.map((n) => row(n, oFrom[n], oTo[n], true));
  const anthropicRows = allAnthropic.length
    ? allAnthropic.map((n) => row(n, aFrom[n], aTo[n])).join('')
    : '<tr><td class="history-no-data" colspan="6">No Anthropic data in selected snapshots</td></tr>';
  const mistralRows = allMistral.length
    ? allMistral.map((n) => row(n, mFrom[n], mTo[n])).join('')
    : '<tr><td class="history-no-data" colspan="6">No Mistral data in selected snapshots</td></tr>';
  resultEl.innerHTML = `
    <h4>Google Gemini</h4>
    <table class="model-table"><thead><tr><th>Model</th><th>Input (${fromDateStr})</th><th>Output (${fromDateStr})</th><th>Input (${toDateStr})</th><th>Output (${toDateStr})</th><th>Change</th></tr></thead><tbody>${Array.isArray(geminiRows) ? geminiRows.join('') : geminiRows}</tbody></table>
    <h4>OpenAI</h4>
    <table class="model-table"><thead><tr><th>Model</th><th>Input (${fromDateStr})</th><th>Cached</th><th>Output</th><th>Input (${toDateStr})</th><th>Cached</th><th>Output</th><th>Change</th></tr></thead><tbody>${Array.isArray(openaiRows) ? openaiRows.join('') : openaiRows}</tbody></table>
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
  const rows = ['Provider,Model,Context / tier,Input per 1M,Output per 1M,Cached per 1M'];
  const { gemini, openai, anthropic, mistral } = getData();
  const push = (provider, m, ctx, inp, out, cached) => rows.push([provider, m.name, ctx, inp, out, cached != null ? cached : ''].map(render.escapeCsvCell).join(','));
  gemini.forEach((m) => {
    if (m.tiers?.length) m.tiers.forEach((t) => push('Google Gemini', m, t.contextLabel, t.input, t.output, null));
    else push('Google Gemini', m, '—', m.input, m.output, null);
  });
  openai.forEach((m) => {
    if (m.tiers?.length) m.tiers.forEach((t) => push('OpenAI', m, t.contextLabel, t.input, t.output, t.cachedInput));
    else push('OpenAI', m, '—', m.input, m.output, m.cachedInput);
  });
  anthropic.forEach((m) => {
    if (m.tiers?.length) m.tiers.forEach((t) => push('Anthropic', m, t.contextLabel, t.input, t.output, null));
    else push('Anthropic', m, '—', m.input, m.output, null);
  });
  mistral.forEach((m) => {
    if (m.tiers?.length) m.tiers.forEach((t) => push('Mistral', m, t.contextLabel, t.input, t.output, null));
    else push('Mistral', m, '—', m.input, m.output, null);
  });
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
  const headers = ['Provider', 'Model', 'Context/tier', 'Input/1M', 'Output/1M', 'Cached/1M'];
  const colWidths = [28, 48, 28, 22, 22, 22];
  const rows = [];
  const fmt = (v) => (v === 0 ? 'Free' : '$' + Number(v).toFixed(2));
  const add = (provider, m, ctx, inp, out, cached) => rows.push([provider, m.name, ctx, fmt(inp), fmt(out), cached != null ? fmt(cached) : '—']);
  getData().gemini.forEach((m) => {
    if (m.tiers?.length) m.tiers.forEach((t) => add('Google Gemini', m, t.contextLabel, t.input, t.output, null));
    else add('Google Gemini', m, '—', m.input, m.output, null);
  });
  getData().openai.forEach((m) => {
    if (m.tiers?.length) m.tiers.forEach((t) => add('OpenAI', m, t.contextLabel, t.input, t.output, t.cachedInput));
    else add('OpenAI', m, '—', m.input, m.output, m.cachedInput);
  });
  getData().anthropic.forEach((m) => {
    if (m.tiers?.length) m.tiers.forEach((t) => add('Anthropic', m, t.contextLabel, t.input, t.output, null));
    else add('Anthropic', m, '—', m.input, m.output, null);
  });
  getData().mistral.forEach((m) => {
    if (m.tiers?.length) m.tiers.forEach((t) => add('Mistral', m, t.contextLabel, t.input, t.output, null));
    else add('Mistral', m, '—', m.input, m.output, null);
  });
  render.drawPdfBorderedTable(doc, 32, headers, rows, colWidths);
  doc.save('ai-pricing-' + new Date().toISOString().slice(0, 10) + '.pdf');
}

function exportComparisonCSV() {
  const list = render.getComparisonList(getData());
  const rows = ['Model,Provider,Pricing tier,Input per 1M,Output per 1M,Context window'];
  const fmt = (v) => (v === 0 ? 'Free' : '$' + Number(v).toFixed(2));
  list.forEach((m) => {
    rows.push([m.name, m.provider, m.contextTier || '—', fmt(m.input), fmt(m.output), m.contextWindow || '—'].map(render.escapeCsvCell).join(','));
  });
  const csv = '\uFEFF' + rows.join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'ai-model-comparison-' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  render.showToast('Comparison exported as CSV.', 'success');
}

function exportComparisonPDF() {
  const JsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  if (typeof JsPDF === 'undefined') {
    render.showToast('PDF library loading. Please try again in a moment.', 'error');
    return;
  }
  const list = render.getComparisonList(getData());
  const fmt = (v) => (v === 0 ? 'Free' : '$' + Number(v).toFixed(2));
  const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
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
  render.drawPdfBorderedTable(doc, 32, headers, rows, colWidths);
  doc.save('ai-model-comparison-' + new Date().toISOString().slice(0, 10) + '.pdf');
  render.showToast('Comparison exported as PDF.', 'success');
}

function exportBenchmarksCSV() {
  const list = render.getBenchmarkList(getData(), getBenchmarksData());
  const rows = ['Model,MMLU,Code,Reasoning,Arena,Cost tier'];
  list.forEach((m) => rows.push([m.name, m.mmlu, m.code, m.reasoning, m.arena, m.costTier].map(render.escapeCsvCell).join(',')));
  const csv = '\uFEFF' + rows.join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'ai-benchmarks-' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  render.showToast('Benchmarks exported as CSV.', 'success');
}

function exportBenchmarksPDF() {
  const JsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  if (typeof JsPDF === 'undefined') {
    render.showToast('PDF library loading. Please try again in a moment.', 'error');
    return;
  }
  const list = render.getBenchmarkList(getData(), getBenchmarksData());
  const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFontSize(14);
  doc.text('Model benchmark dashboard', pageW / 2, 18, { align: 'center' });
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text('Exported: ' + new Date().toLocaleDateString(undefined, { dateStyle: 'long' }), pageW / 2, 25, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  const headers = ['Model', 'MMLU', 'Code', 'Reasoning', 'Arena', 'Cost'];
  const colWidths = [50, 28, 28, 32, 28, 24];
  const rows = list.map((m) => [m.name, m.mmlu, m.code, m.reasoning, m.arena, m.costTier]);
  render.drawPdfBorderedTable(doc, 32, headers, rows, colWidths);
  doc.save('ai-benchmarks-' + new Date().toISOString().slice(0, 10) + '.pdf');
  render.showToast('Benchmarks exported as PDF.', 'success');
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
  lastPromptCostResult = { rows: list.map((m) => ({ model: m.name, cost: m.cost })) };
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
  lastPromptCostResult = null;
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
  const exportRows = [];
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
      exportRows.push({ model: m.name, contextWindow: ctx.label, result: resultText });
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
    exportRows.push({ model: m.name, contextWindow: ctx.label, result: resultText });
  });
  addContextRows('anthropic', data.anthropic);
  addContextRows('mistral', data.mistral);
  resultEl.innerHTML = '<h4>Results</h4><table class="model-table"><thead><tr><th>Model</th><th>Context window</th><th>Result</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>';
  resultEl.style.display = 'block';
  lastContextResult = { rows: exportRows };
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
  lastContextResult = null;
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
  // Per-request cost: (promptTokens/1e6)*inputPrice + (completionTokens/1e6)*outputPrice
  const costPerRequestFromPrices = (promptToks, completionToks, inputPrice, outputPrice) =>
    (promptToks / 1_000_000) * inputPrice + (completionToks / 1_000_000) * outputPrice;

  const data = getData();
  const list = [];
  data.gemini.forEach((m) => {
    const costPerRequest = costPerRequestFromPrices(promptTokens, outputTokens, m.input, m.output);
    const daily = costPerRequest * totalRequestsPerDay;
    const monthly = daily * 30;
    list.push({ name: m.name, perRequest: costPerRequest, daily, monthly, annum: monthly * 12 });
  });
  data.openai.forEach((m) => {
    if (/^text-embedding/i.test(m.name)) return;
    const costPerRequest = calc.calcCostOpenAI(promptTokens, 0, outputTokens, m.input, m.cachedInput, m.output);
    const daily = costPerRequest * totalRequestsPerDay;
    const monthly = daily * 30;
    list.push({ name: m.name, perRequest: costPerRequest, daily, monthly, annum: monthly * 12 });
  });
  data.anthropic.forEach((m) => {
    const costPerRequest = costPerRequestFromPrices(promptTokens, outputTokens, m.input, m.output);
    const daily = costPerRequest * totalRequestsPerDay;
    const monthly = daily * 30;
    list.push({ name: m.name, perRequest: costPerRequest, daily, monthly, annum: monthly * 12 });
  });
  data.mistral.forEach((m) => {
    const costPerRequest = costPerRequestFromPrices(promptTokens, outputTokens, m.input, m.output);
    const daily = costPerRequest * totalRequestsPerDay;
    const monthly = daily * 30;
    list.push({ name: m.name, perRequest: costPerRequest, daily, monthly, annum: monthly * 12 });
  });
  const fmtReq = (v) => (v < 0.0001 && v > 0 ? '$' + v.toExponential(2) : '$' + v.toFixed(4));
  const rows = list.map((m) => `<tr><td class="model-name">${m.name}</td><td class="cost-per-request">${fmtReq(m.perRequest)}</td><td class="cost-daily">$${m.daily.toFixed(2)}</td><td class="cost-monthly">$${m.monthly.toFixed(2)}</td><td class="cost-annum">$${m.annum.toFixed(2)}</td></tr>`).join('');
  resultEl.innerHTML = '<h4>Estimated costs</h4><table class="model-table"><thead><tr><th>Model</th><th>Per request</th><th>Daily cost</th><th>Monthly cost</th><th>Per annum</th></tr></thead><tbody>' + rows + '</tbody></table>';
  resultEl.style.display = 'block';
  lastProductionResult = { rows: list };
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
  lastProductionResult = null;
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
    lastPricingResult = { type: 'all', rows: withCost.map((r) => ({ label: r.label, cost: r.cost })) };
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
      lastPricingResult = { type: 'single', rows: [{ label: entry.label || entry.model?.name, cost }] };
      return;
    }
    const cost2 = calc.calcCostForEntry(entry2, inputTokens, cachedTokens, outputTokens);
    const name1 = entry.label || entry.provider + ' — ' + entry.name;
    const name2 = entry2.label || entry2.provider + ' — ' + entry2.name;
    resultEl.className = 'calc-result';
    resultEl.innerHTML = renderCompareResult(name1, cost, name2, cost2);
    lastPricingResult = { type: 'compare', rows: [{ label: name1, cost }, { label: name2, cost: cost2 }] };
    return;
  }
  resultEl.className = 'calc-result single';
  resultEl.textContent = 'Estimated cost: $' + cost.toFixed(4);
  lastPricingResult = { type: 'single', rows: [{ label: entry.label || (entry.provider + ' — ' + entry.name), cost }] };
}

function getCurrentCalculatorExport() {
  const hash = (location.hash || '').replace('#', '') || 'calc-pricing';
  if (hash === 'calc-pricing') return { sub: 'pricing', data: lastPricingResult };
  if (hash === 'calc-prompt') return { sub: 'prompt', data: lastPromptCostResult };
  if (hash === 'calc-context') return { sub: 'context', data: lastContextResult };
  if (hash === 'calc-production') return { sub: 'production', data: lastProductionResult };
  return { sub: 'pricing', data: lastPricingResult };
}

function exportCalculatorsCSV() {
  const { sub, data } = getCurrentCalculatorExport();
  if (!data || !data.rows || !data.rows.length) {
    render.showToast('Run the calculator first to export results.', 'error');
    return;
  }
  let header = '';
  let rows = [];
  if (sub === 'pricing') {
    header = 'Model,Est. cost';
    rows = data.rows.map((r) => [r.label, r.cost.toFixed(4)].map(render.escapeCsvCell).join(','));
  } else if (sub === 'prompt') {
    header = 'Model,Cost';
    rows = data.rows.map((r) => [r.model, r.cost.toFixed(5)].map(render.escapeCsvCell).join(','));
  } else if (sub === 'context') {
    header = 'Model,Context window,Result';
    rows = data.rows.map((r) => [r.model, r.contextWindow, r.result].map(render.escapeCsvCell).join(','));
  } else if (sub === 'production') {
    header = 'Model,Per request,Daily cost,Monthly cost,Per annum';
    const fmt = (v) => (typeof v === 'number' && v < 0.0001 && v > 0 ? v.toExponential(2) : (typeof v === 'number' ? v.toFixed(4) : v));
    rows = data.rows.map((r) => [r.name, fmt(r.perRequest), r.daily.toFixed(2), r.monthly.toFixed(2), r.annum.toFixed(2)].map(render.escapeCsvCell).join(','));
  }
  const csv = '\uFEFF' + header + '\r\n' + rows.join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'ai-calculator-' + sub + '-' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  render.showToast('Calculator result exported as CSV.', 'success');
}

function exportCalculatorsPDF() {
  const JsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  if (typeof JsPDF === 'undefined') {
    render.showToast('PDF library loading. Please try again in a moment.', 'error');
    return;
  }
  const { sub, data } = getCurrentCalculatorExport();
  if (!data || !data.rows || !data.rows.length) {
    render.showToast('Run the calculator first to export results.', 'error');
    return;
  }
  const doc = new JsPDF({ orientation: sub === 'production' ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFontSize(14);
  const titles = { pricing: 'Pricing calculator', prompt: 'Prompt cost estimate', context: 'Context window check', production: 'Production cost simulator' };
  doc.text(titles[sub], pageW / 2, 18, { align: 'center' });
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text('Exported: ' + new Date().toLocaleDateString(undefined, { dateStyle: 'long' }), pageW / 2, 25, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  let headers = [];
  let colWidths = [];
  let pdfRows = [];
  if (sub === 'pricing') {
    headers = ['Model', 'Est. cost'];
    colWidths = [120, 40];
    pdfRows = data.rows.map((r) => [r.label, '$' + r.cost.toFixed(4)]);
  } else if (sub === 'prompt') {
    headers = ['Model', 'Cost'];
    colWidths = [120, 40];
    pdfRows = data.rows.map((r) => [r.model, '$' + r.cost.toFixed(5)]);
  } else if (sub === 'context') {
    headers = ['Model', 'Context window', 'Result'];
    colWidths = [80, 50, 40];
    pdfRows = data.rows.map((r) => [r.model, r.contextWindow, r.result]);
  } else if (sub === 'production') {
    headers = ['Model', 'Per request', 'Daily', 'Monthly', 'Per annum'];
    colWidths = [50, 28, 28, 32, 32];
    const fmtReq = (v) => (v < 0.0001 && v > 0 ? '$' + v.toExponential(2) : '$' + v.toFixed(4));
    pdfRows = data.rows.map((r) => [r.name, fmtReq(r.perRequest), '$' + r.daily.toFixed(2), '$' + r.monthly.toFixed(2), '$' + r.annum.toFixed(2)]);
  }
  render.drawPdfBorderedTable(doc, 32, headers, pdfRows, colWidths);
  doc.save('ai-calculator-' + sub + '-' + new Date().toISOString().slice(0, 10) + '.pdf');
  render.showToast('Calculator result exported as PDF.', 'success');
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
  lastPricingResult = null;
}

// --- Doc search & recommendation ---
const GEMINI_PRICING_URL = 'https://ai.google.dev/gemini-api/docs/pricing';
const GEMINI_DOC_URL = 'https://ai.google.dev/gemini-api/docs/models/gemini';
const OPENAI_PRICING_URL = 'https://developers.openai.com/api/docs/pricing';
const OPENAI_DOC_URL = 'https://platform.openai.com/docs/models';
const ANTHROPIC_DOC_URL = 'https://docs.anthropic.com/en/docs/build-with-claude/model-cards';
const MISTRAL_DOC_URL = 'https://docs.mistral.ai/models/';

async function fetchDocsAndSearch(description) {
  const keywords = calc.extractKeywords(description);
  const geminiNames = geminiData.map((m) => m.name);
  const openaiNames = openaiData.map((m) => m.name);
  const anthropicNames = anthropicData.map((m) => m.name);
  const mistralNames = mistralData.map((m) => m.name);
  const [g1, g2, o1, o2, a1, m1] = await Promise.allSettled([
    api.fetchWithCors(GEMINI_PRICING_URL),
    api.fetchWithCors(GEMINI_DOC_URL),
    api.fetchWithCors(OPENAI_PRICING_URL),
    api.fetchWithCors(OPENAI_DOC_URL),
    api.fetchWithCors(ANTHROPIC_DOC_URL),
    api.fetchWithCors(MISTRAL_DOC_URL),
  ]);
  let geminiHtml = (g1.status === 'fulfilled' && g1.value ? g1.value : '') + (g2.status === 'fulfilled' && g2.value ? g2.value : '');
  let openaiHtml = (o1.status === 'fulfilled' && o1.value ? o1.value : '') + (o2.status === 'fulfilled' && o2.value ? o2.value : '');
  const anthropicHtml = a1.status === 'fulfilled' && a1.value ? a1.value : '';
  const mistralHtml = m1.status === 'fulfilled' && m1.value ? m1.value : '';
  const geminiMatches = geminiHtml.trim() ? calc.searchDocContent(geminiHtml, geminiNames, keywords) : [];
  const openaiMatches = openaiHtml.trim() ? calc.searchDocContent(openaiHtml, openaiNames, keywords) : [];
  const anthropicMatches = anthropicHtml.trim() ? calc.searchDocContent(anthropicHtml, anthropicNames, keywords) : [];
  const mistralMatches = mistralHtml.trim() ? calc.searchDocContent(mistralHtml, mistralNames, keywords) : [];
  return {
    gemini: geminiMatches.map((m) => ({ ...m, providerKey: 'gemini', provider: 'Google Gemini' })),
    openai: openaiMatches.map((m) => ({ ...m, providerKey: 'openai', provider: 'OpenAI' })),
    anthropic: anthropicMatches.map((m) => ({ ...m, providerKey: 'anthropic', provider: 'Anthropic' })),
    mistral: mistralMatches.map((m) => ({ ...m, providerKey: 'mistral', provider: 'Mistral' })),
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
    const allDocMatches = [
      ...(docResults.gemini || []),
      ...(docResults.openai || []),
      ...(docResults.anthropic || []),
      ...(docResults.mistral || []),
    ];
    allDocMatches.forEach((m) => {
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
  // Keep diversified order (up to 2 per provider); do not re-sort by docSnippet so we don't end up with only one provider
  const hasAnyDoc = docResults && (docResults.gemini?.length || docResults.openai?.length || docResults.anthropic?.length || docResults.mistral?.length);
  render.renderRecommendations(results, !!hasAnyDoc);
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

const SECTION_IDS = ['overview', 'value-analysis', 'recommend-section', 'models', 'calculators', 'benchmarks'];

function showSection(sectionId) {
  SECTION_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', id === sectionId);
  });
  setActiveSidebarLink(sectionId);
  if (sectionId === 'value-analysis') setTimeout(updateValueChartIfVisible, 0);
}

function setActiveSidebarLink(sectionId) {
  document.querySelectorAll('.sidebar-link:not(.sidebar-link-modal)').forEach((l) => {
    l.classList.toggle('active', l.getAttribute('data-section') === sectionId);
  });
}

// --- Expose for inline onclick (index.html) ---
window.exportPricingCSV = exportPricingCSV;
window.exportPricingPDF = exportPricingPDF;
window.exportComparisonCSV = exportComparisonCSV;
window.exportComparisonPDF = exportComparisonPDF;
window.exportBenchmarksCSV = exportBenchmarksCSV;
window.exportBenchmarksPDF = exportBenchmarksPDF;
window.exportCalculatorsCSV = exportCalculatorsCSV;
window.exportCalculatorsPDF = exportCalculatorsPDF;
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

const THEME_STORAGE_KEY = 'ai-pricing-theme';

function getPreferredTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  if (typeof window.matchMedia !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  return 'dark';
}

function setTheme(theme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme === 'light' ? 'light' : '');
  const icon = document.getElementById('themeIcon');
  if (icon) icon.textContent = theme === 'light' ? '🌙' : '☀️';
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (_) {}
  updateValueChartIfVisible();
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  setTheme(current === 'dark' ? 'light' : 'dark');
}

// --- Init: run after DOM is ready so elements and tab panels exist ---
function init() {
  if (typeof window.__appLoadFailed !== 'undefined') window.__appLoadFailed = false;
  setTheme(getPreferredTheme());
  document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);
  document.querySelectorAll('.calc-sub-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const sub = link.getAttribute('data-calc-sub');
      switchCalcSub(sub);
      showSection('calculators');
    });
  });
  document.querySelectorAll('.sidebar-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      const action = link.getAttribute('data-action');
      if (action === 'history') {
        e.preventDefault();
        openHistoryModal();
        return;
      }
      const sectionId = link.getAttribute('data-section');
      const href = link.getAttribute('href');
      if (sectionId && href?.startsWith('#')) {
        e.preventDefault();
        const hash = href.slice(1);
        showSection(sectionId);
        if (history.replaceState) history.replaceState(null, '', '#' + hash);
      }
    });
  });
  const comparisonSection = document.getElementById('section-comparison');
  comparisonSection?.querySelector('.provider-filter-btns')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.provider-filter-btn');
    if (!btn) return;
    const provider = btn.getAttribute('data-provider') || 'all';
    render.setComparisonProviderFilter(provider);
    comparisonSection.querySelectorAll('.provider-filter-btn').forEach((b) => {
      const isActive = b.getAttribute('data-provider') === provider;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    render.renderModelComparisonTable(getData(), provider);
  });
  document.getElementById('comparison-sort-by')?.addEventListener('change', function () {
    const sortBy = this.value || 'default';
    render.setComparisonSortBy(sortBy);
    render.renderModelComparisonTable(getData(), render.getComparisonProviderFilter());
  });
  document.getElementById('value-chart-metric')?.addEventListener('change', function () {
    valueChartMetric = this.value || 'arena';
    updateValueChartIfVisible();
  });
  document.querySelector('.value-chart-provider-btns')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.value-chart-provider-btn');
    if (!btn) return;
    valueChartProviderFilter = btn.getAttribute('data-value-provider') || 'all';
    document.querySelectorAll('.value-chart-provider-btn').forEach((b) => {
      const isActive = b.getAttribute('data-value-provider') === valueChartProviderFilter;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    updateValueChartIfVisible();
  });
  const hash = (location.hash || '').replace(/^#/, '');
  const sectionFromHash = (h) => {
    if (h === 'overview' || h === 'pricing') return 'overview';
    if (h === 'comparison' || h === 'models') return 'models';
    if (h === 'value-analysis') return 'value-analysis';
    if (h === 'recommend') return 'recommend-section';
    if (h === 'calculators' || h.startsWith('calc-')) return 'calculators';
    if (h === 'benchmarks') return 'benchmarks';
    return 'overview';
  };
  const sectionId = hash ? sectionFromHash(hash) : 'overview';
  showSection(sectionId);
  if (hash?.startsWith('calc-')) {
    const sub = hash.replace('calc-', '');
    if (['pricing', 'prompt', 'context', 'production'].includes(sub)) switchCalcSub(sub);
  }
  if (!hash) {
    if (history.replaceState) history.replaceState(null, '', '#overview');
  }
  window.addEventListener('hashchange', () => {
    const h = (location.hash || '').replace(/^#/, '');
    showSection(sectionFromHash(h));
    if (h.startsWith('calc-')) {
      const sub = h.replace('calc-', '');
      if (['pricing', 'prompt', 'context', 'production'].includes(sub)) switchCalcSub(sub);
    }
  });
  document.querySelector('.header-home-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    showSection('overview');
    if (history.replaceState) history.replaceState(null, '', '#overview');
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

  loadPricing();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
