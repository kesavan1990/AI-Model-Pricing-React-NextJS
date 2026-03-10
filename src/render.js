/**
 * Render layer: tables, history modal, toasts, exports. Depends on calculator and pricingService for data shape.
 */

import { getUnifiedCalcModels, getAllModels, getBenchmarkForModel, getCostTierLabel, getFallbackReason } from './calculator.js';
import { dedupeModelsByName } from './pricingService.js';

export function showToast(msg, type) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast ' + (type || 'success');
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

export function setLastUpdated(label) {
  const el = document.getElementById('lastUpdated');
  if (el) el.textContent = label;
}

export function formatTimestampWithTimezone(date) {
  try {
    return (date || new Date()).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium', timeZoneName: 'short' });
  } catch (_) {
    return (date || new Date()).toISOString();
  }
}

export function formatHistoryDate(isoStr, isScheduled) {
  try {
    const d = new Date(isoStr);
    if (isScheduled) return d.toLocaleString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }) + ', 12:00 am IST';
    return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) + ' IST';
  } catch (_) {
    return isoStr || '';
  }
}

export function filterPricingTable(tbodyId, query) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  const q = (query || '').trim().toLowerCase();
  tbody.querySelectorAll('tr').forEach((tr) => {
    const first = tr.querySelector('td');
    const name = first ? first.textContent.trim().toLowerCase() : '';
    tr.classList.toggle('hidden', q.length > 0 && name.indexOf(q) === -1);
  });
}

export function renderTables(data) {
  const { gemini = [], openai = [], anthropic = [], mistral = [] } = data;
  const geminiRow = (m) => {
    const badge = m.badge ? `<span>${m.badge}</span>` : '';
    const inp = m.input === 0 ? 'Free' : '$' + Number(m.input).toFixed(2);
    const out = m.output === 0 ? 'Free' : '$' + Number(m.output).toFixed(2);
    return `<tr><td class="model-name">${m.name}${badge}</td><td class="price price-input">${inp}</td><td class="price price-output">${out}</td></tr>`;
  };
  const openaiRow = (m) => {
    const badge = m.badge ? `<span>${m.badge}</span>` : '';
    const isEmbed = /^text-embedding/i.test(m.name);
    const inp = m.input === 0 ? 'Free' : '$' + Number(m.input).toFixed(2);
    const cached = m.cachedInput != null ? '$' + Number(m.cachedInput).toFixed(2) : '—';
    const out = isEmbed ? '—' : (m.output === 0 ? 'Free' : '$' + Number(m.output).toFixed(2));
    return `<tr><td class="model-name">${m.name}${badge}</td><td class="price price-input">${inp}</td><td class="price price-cached">${cached}</td><td class="price price-output">${out}</td></tr>`;
  };
  const simpleRow = (m) => {
    const inp = m.input === 0 ? 'Free' : '$' + Number(m.input).toFixed(2);
    const out = m.output === 0 ? 'Free' : '$' + Number(m.output).toFixed(2);
    return `<tr><td class="model-name">${m.name}</td><td class="price price-input">${inp}</td><td class="price price-output">${out}</td></tr>`;
  };
  const geminiTbody = document.getElementById('gemini-tbody');
  const openaiTbody = document.getElementById('openai-tbody');
  const anthropicTbody = document.getElementById('anthropic-tbody');
  const mistralTbody = document.getElementById('mistral-tbody');
  if (geminiTbody) geminiTbody.innerHTML = gemini.map(geminiRow).join('');
  if (openaiTbody) openaiTbody.innerHTML = openai.map(openaiRow).join('');
  if (anthropicTbody) anthropicTbody.innerHTML = anthropic.map(simpleRow).join('');
  if (mistralTbody) mistralTbody.innerHTML = mistral.map(simpleRow).join('');
  filterPricingTable('gemini-tbody', document.getElementById('gemini-search')?.value);
  filterPricingTable('openai-tbody', document.getElementById('openai-search')?.value);
  filterPricingTable('anthropic-tbody', document.getElementById('anthropic-search')?.value);
  filterPricingTable('mistral-tbody', document.getElementById('mistral-search')?.value);
  const unified = getUnifiedCalcModels(data);
  const calcModelSel = document.getElementById('calc-model');
  const calcCompareSel = document.getElementById('calc-compare');
  if (calcModelSel) {
    const opts = unified.map((u) => `<option value="${u.key}">${u.label}</option>`).join('');
    calcModelSel.innerHTML = '<option value="">-- Select model --</option><option value="__all__">Compare all models</option>' + opts;
  }
  if (calcCompareSel) {
    const opts = unified.map((u) => `<option value="${u.key}">${u.label}</option>`).join('');
    calcCompareSel.innerHTML = '<option value="">— None —</option>' + opts;
  }
  renderModelComparisonTable(data, comparisonProviderFilter, comparisonSortBy);
  renderBenchmarkDashboard(data);
  updateKPIs(data);
}

let comparisonProviderFilter = 'all';
let comparisonSortBy = 'default';
export function setComparisonProviderFilter(provider) {
  comparisonProviderFilter = provider || 'all';
}
export function setComparisonSortBy(sortBy) {
  comparisonSortBy = sortBy || 'default';
}

/**
 * Update KPI cards: total models, cheapest (by blended), costliest (by blended), largest context.
 */
export function updateKPIs(data) {
  const all = getAllModels(data);
  const modelCountEl = document.getElementById('kpiModelCount');
  const cheapestEl = document.getElementById('kpiCheapest');
  const cheapestPriceEl = document.getElementById('kpiCheapestPrice');
  const costliestEl = document.getElementById('kpiCostliest');
  const costliestPriceEl = document.getElementById('kpiCostliestPrice');
  const largestContextEl = document.getElementById('kpiLargestContext');
  const largestContextSizeEl = document.getElementById('kpiLargestContextSize');

  if (modelCountEl) modelCountEl.textContent = String(all.length);

  const byBlended = [...all].filter((m) => m.blended >= 0).sort((a, b) => a.blended - b.blended);
  const cheapest = byBlended[0];
  const costliest = byBlended.length ? byBlended[byBlended.length - 1] : null;
  if (cheapestEl) cheapestEl.textContent = cheapest ? cheapest.name : '—';
  if (cheapestPriceEl) cheapestPriceEl.textContent = cheapest ? (cheapest.blended === 0 ? 'Free' : `$${Number(cheapest.blended).toFixed(2)} / 1M blended`) : '—';
  if (costliestEl) costliestEl.textContent = costliest ? costliest.name : '—';
  if (costliestPriceEl) costliestPriceEl.textContent = costliest ? `$${Number(costliest.blended).toFixed(2)} / 1M blended` : '—';

  const byContext = [...all].filter((m) => m.contextTokens > 0).sort((a, b) => b.contextTokens - a.contextTokens);
  const largestCtx = byContext[0];
  if (largestContextEl) largestContextEl.textContent = largestCtx ? largestCtx.name : '—';
  if (largestContextSizeEl) largestContextSizeEl.textContent = largestCtx ? (largestCtx.contextWindow || String(largestCtx.contextTokens)) : '—';
}

const PROVIDER_ORDER = ['gemini', 'openai', 'anthropic', 'mistral'];

/**
 * Render the unified model comparison table: Model | Provider | Input | Output | Context.
 * providerFilter: 'all' | 'gemini' | 'openai' | 'anthropic' | 'mistral'.
 * sortBy: 'default' (group by provider, cheapest first) | 'input' | 'output' | 'context'. Highlights cheapest row when relevant.
 */
export function renderModelComparisonTable(data, providerFilter, sortByArg) {
  const tbody = document.getElementById('model-comparison-tbody');
  if (!tbody) return;
  const sortBy = sortByArg ?? comparisonSortBy;
  const filter = providerFilter ?? comparisonProviderFilter;
  let list = getAllModels(data);
  if (filter && filter !== 'all') {
    list = list.filter((m) => m.providerKey === filter);
  }
  const providerIndex = (m) => PROVIDER_ORDER.indexOf(m.providerKey);
  if (sortBy === 'input') {
    list = [...list].sort((a, b) => (a.input ?? 0) - (b.input ?? 0));
  } else if (sortBy === 'output') {
    list = [...list].sort((a, b) => (a.output ?? 0) - (b.output ?? 0));
  } else if (sortBy === 'context') {
    list = [...list].sort((a, b) => (b.contextTokens ?? 0) - (a.contextTokens ?? 0));
  } else {
    list = [...list].sort((a, b) => {
      const groupA = providerIndex(a);
      const groupB = providerIndex(b);
      if (groupA !== groupB) return groupA - groupB;
      return (a.blended ?? 0) - (b.blended ?? 0);
    });
  }
  const fmt = (v) => (v === 0 ? 'Free' : '$' + Number(v).toFixed(2));
  const withBlended = list.filter((m) => m.blended >= 0);
  const cheapestModel = withBlended.length ? withBlended.reduce((min, m) => (m.blended < min.blended ? m : min), withBlended[0]) : null;
  const rows = list
    .map((m) => {
      const inp = fmt(m.input);
      const out = fmt(m.output);
      const ctx = m.contextWindow || '—';
      const isCheapest = cheapestModel && m.name === cheapestModel.name && m.providerKey === cheapestModel.providerKey;
      const nameCell = isCheapest ? `${m.name} <span class="cheapest-badge" aria-label="Cheapest">🟢 Cheapest</span>` : m.name;
      const rowClass = isCheapest ? 'cheapest' : '';
      return `<tr class="${rowClass}"><td class="model-name">${nameCell}</td><td class="provider-name">${m.provider}</td><td class="price price-input">${inp}</td><td class="price price-output">${out}</td><td class="context-window">${ctx}</td></tr>`;
    })
    .join('');
  tbody.innerHTML = rows;
}

/**
 * Return the current comparison table list (filtered and sorted) for export.
 */
export function getComparisonList(data) {
  const filter = comparisonProviderFilter ?? 'all';
  const sortBy = comparisonSortBy ?? 'default';
  let list = getAllModels(data);
  if (filter && filter !== 'all') list = list.filter((m) => m.providerKey === filter);
  const providerIndex = (m) => PROVIDER_ORDER.indexOf(m.providerKey);
  if (sortBy === 'input') list = [...list].sort((a, b) => (a.input ?? 0) - (b.input ?? 0));
  else if (sortBy === 'output') list = [...list].sort((a, b) => (a.output ?? 0) - (b.output ?? 0));
  else if (sortBy === 'context') list = [...list].sort((a, b) => (b.contextTokens ?? 0) - (a.contextTokens ?? 0));
  else list = [...list].sort((a, b) => { const ga = providerIndex(a); const gb = providerIndex(b); if (ga !== gb) return ga - gb; return (a.blended ?? 0) - (b.blended ?? 0); });
  return list;
}

export function renderBenchmarkDashboard(data) {
  const container = document.getElementById('benchmark-dashboard-table');
  if (!container) return;
  const all = getAllModels(data);
  const rows = all
    .map((m) => {
      const b = getBenchmarkForModel(m.name, m.providerKey);
      const { tier, desc } = getCostTierLabel(m.blended);
      const blendedStr = m.blended <= 0 ? '0' : m.blended.toFixed(2);
      const costTitle = `Blended: $${blendedStr}/1M tokens (70% input, 30% output) — ${desc}`;
      return `<tr><td class="model-name">${m.name}</td><td class="benchmark-score">${b.mmlu}</td><td class="benchmark-score">${b.code}</td><td class="benchmark-score">${b.reasoning}</td><td class="benchmark-score">${b.arena}</td><td class="cost-tier" title="${costTitle}">${tier}</td></tr>`;
    })
    .join('');
  container.innerHTML =
    '<table class="model-table"><thead><tr><th>Model</th><th title="Massive Multitask Language Understanding — broad knowledge across 57 subjects (STEM, humanities, etc.). Higher = better.">MMLU</th><th title="HumanEval — code generation benchmark (Python). Higher = better.">Code</th><th title="GSM8K — grade-school math word problems; measures reasoning. Higher = better.">Reasoning</th><th title="Arena / leaderboard-style ranking (e.g. LMSys Chatbot Arena). Higher = better overall preference.">Arena</th><th title="Based on blended price per 1M tokens (70% input + 30% output). $ = free/low, $$ = budget, $$$ = premium.">Cost</th></tr></thead><tbody>' +
    rows +
    '</tbody></table>';
}

/** Return benchmark table rows for export (same data as dashboard). */
export function getBenchmarkList(data) {
  const all = getAllModels(data);
  return all.map((m) => {
    const b = getBenchmarkForModel(m.name, m.providerKey);
    const { tier } = getCostTierLabel(m.blended);
    return { name: m.name, mmlu: b.mmlu, code: b.code, reasoning: b.reasoning, arena: b.arena, costTier: tier };
  });
}

export function escapeCsvCell(s) {
  const str = String(s == null ? '' : s);
  if (/[",\n\r]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

export function drawPdfBorderedTable(doc, startY, headers, rows, colWidths) {
  const left = 14;
  const rowHeight = 7;
  const colXs = [left];
  for (let i = 0; i < colWidths.length - 1; i++) colXs.push(colXs[i] + colWidths[i]);
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  let y = startY;
  function drawRowBorder(ry) {
    doc.rect(left, ry - 5, totalW, rowHeight);
    for (let i = 1; i < colXs.length; i++) doc.line(colXs[i], ry - 5, colXs[i], ry - 5 + rowHeight);
  }
  function drawRowText(ry, cells) {
    cells.forEach((cell, i) => doc.text(String(cell).slice(0, 30), colXs[i] + 2, ry));
  }
  doc.setFont(undefined, 'bold');
  doc.setFontSize(9);
  drawRowBorder(y);
  drawRowText(y, headers);
  y += rowHeight;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  const pageH = doc.internal.pageSize.getHeight();
  rows.forEach((row) => {
    if (y > pageH - 25) {
      doc.addPage();
      y = 20;
      doc.setFont(undefined, 'bold');
      doc.setFontSize(9);
      drawRowBorder(y);
      drawRowText(y, headers);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(8);
      y += rowHeight;
    }
    drawRowBorder(y);
    drawRowText(y, row);
    y += rowHeight;
  });
  return y;
}

export function renderRecommendations(results, fromDocs) {
  const container = document.getElementById('recommendList');
  const resultEl = document.getElementById('recommendResult');
  if (!container || !resultEl) return;
  if (!results.length) {
    container.innerHTML = '<p class="recommend-item model-reason">No models match this use case with current data.</p>';
    resultEl.classList.remove('hidden');
    return;
  }
  const priceStr = (m) => {
    if (m.input === 0 && m.output === 0) return 'Free';
    const parts = [];
    if (m.input > 0) parts.push(`In: $${m.input}/1M`);
    if (m.cachedInput != null) parts.push(`Cached: $${m.cachedInput}/1M`);
    if (m.output > 0) parts.push(`Out: $${m.output}/1M`);
    return parts.join(' · ');
  };
  const docNote = fromDocs ? '<p class="recommend-doc-note">Results informed by official Gemini &amp; OpenAI documentation.</p>' : '';
  container.innerHTML =
    docNote +
    results
      .map((m) => {
        const showAsQuote = m.docSnippet && !m.docSnippetIsGenerated;
        const docSnippet = m.docSnippet ? `<div class="recommend-doc-snippet">${showAsQuote ? 'From documentation: "' + m.docSnippet + '"' : m.docSnippet}</div>` : '';
        const reasonText = (m.reason && String(m.reason).trim()) ? m.reason : getFallbackReason(m);
        return `
        <div class="recommend-item">
          <span class="provider-tag ${m.providerKey}">${m.provider}</span>
          <div>
            <div class="model-name-rec">${m.name}</div>
            <div class="model-reason">${reasonText}</div>
            ${docSnippet}
            <div class="model-price">${priceStr(m)}</div>
          </div>
        </div>`;
      })
      .join('');
  resultEl.classList.remove('hidden');
}

function historyGeminiRow(m) {
  const inp = m.input === 0 ? 'Free' : '$' + Number(m.input).toFixed(2);
  const out = m.output === 0 ? 'Free' : '$' + Number(m.output).toFixed(2);
  return `<tr><td class="model-name">${m.name}</td><td class="price price-input">${inp}</td><td class="price price-output">${out}</td></tr>`;
}

function historyOpenaiRow(m) {
  const inp = m.input === 0 ? 'Free' : '$' + Number(m.input).toFixed(2);
  const cached = m.cachedInput != null ? '$' + Number(m.cachedInput).toFixed(2) : '—';
  const out = m.output === 0 ? 'Free' : '$' + Number(m.output).toFixed(2);
  return `<tr><td class="model-name">${m.name}</td><td class="price price-input">${inp}</td><td class="price price-cached">${cached}</td><td class="price price-output">${out}</td></tr>`;
}

export function renderHistoryList(historyList) {
  const body = document.getElementById('historyModalBody');
  if (!body) return;
  const list = historyList || [];
  const compareSectionHtml = `
    <div class="history-compare-section">
      <h3>Compare pricing between two snapshots</h3>
      <div class="history-compare-controls">
        <label>From <select id="historyCompareFrom"></select></label>
        <label>To <select id="historyCompareTo"></select></label>
        <button type="button" class="calc-btn" id="historyCompareBtn">Compare</button>
      </div>
      <div id="historyCompareResult" class="history-compare-result" style="display: none;"></div>
    </div>`;
  if (list.length === 0) {
    body.innerHTML =
      compareSectionHtml +
      '<p class="history-empty">No daily history yet. A snapshot is saved automatically when you first open the app each day (12:00 AM IST). All history is kept with no date limit.</p>';
    document.getElementById('historyCompareFrom').disabled = true;
    document.getElementById('historyCompareTo').disabled = true;
    document.getElementById('historyCompareBtn').disabled = true;
    return;
  }
  const listHtml = list
    .map((entry, idx) => {
      const d = new Date(entry.date);
      const isScheduled = entry.daily || entry.weekly;
      const dateStr = isScheduled ? d.toLocaleString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }) + ', 12:00 am IST' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
      const scheduleBadge = entry.daily ? ' <span class="history-daily-badge">Daily</span>' : entry.weekly ? ' <span class="history-daily-badge">Weekly</span>' : '';
      const gList = dedupeModelsByName(entry.gemini || []);
      const oList = dedupeModelsByName(entry.openai || []);
      const aList = dedupeModelsByName(entry.anthropic || []);
      const mList = dedupeModelsByName(entry.mistral || []);
      const gCount = gList.length;
      const oCount = oList.length;
      const aCount = aList.length;
      const mCount = mList.length;
      const geminiRows = gList.map(historyGeminiRow).join('');
      const openaiRows = oList.map(historyOpenaiRow).join('');
      const anthropicRows = aList.map(historyGeminiRow).join('');
      const mistralRows = mList.map(historyGeminiRow).join('');
      const anthropicBody = aCount ? anthropicRows : '<tr><td class="history-no-data" colspan="3">No Anthropic data in this snapshot</td></tr>';
      const mistralBody = mCount ? mistralRows : '<tr><td class="history-no-data" colspan="3">No Mistral data in this snapshot</td></tr>';
      const summaryParts = [];
      if (gCount) summaryParts.push(gCount + ' Gemini');
      if (oCount) summaryParts.push(oCount + ' OpenAI');
      if (aCount) summaryParts.push(aCount + ' Anthropic');
      if (mCount) summaryParts.push(mCount + ' Mistral');
      return `
        <div class="history-entry" data-idx="${idx}">
          <div class="history-entry-header">
            <span class="history-entry-date">${dateStr}${scheduleBadge}</span>
            <span class="history-entry-summary">${summaryParts.length ? summaryParts.join(' · ') : 'No models'}</span>
          </div>
          <div class="history-entry-body">
            <h4>Google Gemini</h4>
            <table class="model-table"><thead><tr><th>Model</th><th>Input / 1M</th><th>Output / 1M</th></tr></thead><tbody>${geminiRows}</tbody></table>
            <h4>OpenAI</h4>
            <table class="model-table"><thead><tr><th>Model</th><th>Input / 1M</th><th>Cached / 1M</th><th>Output / 1M</th></tr></thead><tbody>${openaiRows}</tbody></table>
            <h4>Anthropic</h4>
            <table class="model-table"><thead><tr><th>Model</th><th>Input / 1M</th><th>Output / 1M</th></tr></thead><tbody>${anthropicBody}</tbody></table>
            <h4>Mistral</h4>
            <table class="model-table"><thead><tr><th>Model</th><th>Input / 1M</th><th>Output / 1M</th></tr></thead><tbody>${mistralBody}</tbody></table>
          </div>
        </div>`;
    })
    .join('');
  body.innerHTML = compareSectionHtml + listHtml;
  const fromSel = document.getElementById('historyCompareFrom');
  const toSel = document.getElementById('historyCompareTo');
  list.forEach((entry, idx) => {
    const d = new Date(entry.date);
    const isScheduled = entry.daily || entry.weekly;
    const dateStr = isScheduled ? d.toLocaleString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }) + ', 12:00 am IST' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    fromSel.appendChild(new Option(dateStr, String(idx)));
    toSel.appendChild(new Option(dateStr, String(idx)));
  });
  if (list.length > 0) toSel.value = '0';
  if (list.length > 1) fromSel.value = '1';
  body.querySelectorAll('.history-entry-header').forEach((el) => {
    el.addEventListener('click', () => el.closest('.history-entry').classList.toggle('expanded'));
  });
  return list;
}

export function openHistoryModal() {
  document.getElementById('historyModal').classList.add('open');
}

export function closeHistoryModal() {
  document.getElementById('historyModal').classList.remove('open');
}
