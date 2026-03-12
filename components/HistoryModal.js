'use client';

import { useState, useEffect } from 'react';
import { usePricing } from '../context/PricingContext';
import { formatHistoryDate } from '../src/render.js';
import { dedupeModelsByName } from '../src/pricingService.js';
import { escapeCsvCell, drawPdfBorderedTable } from '../src/render.js';

const fmt = (v) => (v === 0 ? 'Free' : '$' + Number(v).toFixed(2));

export function HistoryModal({ open, onClose }) {
  const { pricing, showToast } = usePricing();
  const [historyList, setHistoryList] = useState([]);
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(0);
  const [compareResult, setCompareResult] = useState(null);

  useEffect(() => {
    if (open && pricing) {
      setHistoryList(pricing.getHistory() || []);
    }
  }, [open, pricing]);

  useEffect(() => {
    if (historyList.length > 0) {
      setToIdx(0);
      setFromIdx(historyList.length > 1 ? 1 : 0);
    }
  }, [historyList.length]);

  const runCompare = () => {
    const fromEntry = historyList[fromIdx];
    const toEntry = historyList[toIdx];
    if (!fromEntry || !toEntry) {
      setCompareResult(null);
      return;
    }
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
    const fromDateStr = new Date(fromEntry.date).toLocaleString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' });
    const toDateStr = new Date(toEntry.date).toLocaleString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' });
    setCompareResult({
      fromDateStr,
      toDateStr,
      allGemini,
      allOpenai,
      allAnthropic,
      allMistral,
      gFrom,
      gTo,
      oFrom,
      oTo,
      aFrom,
      aTo,
      mFrom,
      mTo,
    });
  };

  const exportHistoryCSV = () => {
    const list = pricing.getHistory();
    if (!list.length) {
      showToast('No history to export.', 'error');
      return;
    }
    const rows = ['Date,Provider,Model,Input per 1M tokens,Output per 1M tokens,Cached input per 1M tokens'];
    list.forEach((entry) => {
      const dateStr = formatHistoryDate(entry.date, entry.daily || entry.weekly);
      (entry.gemini || []).forEach((m) => rows.push([dateStr, 'Google Gemini', m.name, m.input, m.output, ''].map(escapeCsvCell).join(',')));
      (entry.openai || []).forEach((m) => rows.push([dateStr, 'OpenAI', m.name, m.input, m.output, m.cachedInput != null ? m.cachedInput : ''].map(escapeCsvCell).join(',')));
      (entry.anthropic || []).forEach((m) => rows.push([dateStr, 'Anthropic', m.name, m.input, m.output, ''].map(escapeCsvCell).join(',')));
      (entry.mistral || []).forEach((m) => rows.push([dateStr, 'Mistral', m.name, m.input, m.output, ''].map(escapeCsvCell).join(',')));
    });
    const csv = '\uFEFF' + rows.join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'ai-pricing-history-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('History exported as CSV.', 'success');
  };

  const exportHistoryPDF = async () => {
    const list = pricing.getHistory();
    if (!list.length) {
      showToast('No history to export.', 'error');
      return;
    }
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFontSize(14);
      doc.text('AI Pricing History', doc.internal.pageSize.getWidth() / 2, 14, { align: 'center' });
      const headers = ['Date', 'Provider', 'Model', 'Input/1M', 'Output/1M', 'Cached/1M'];
      const colWidths = [42, 28, 48, 22, 22, 22];
      const rows = [];
      list.forEach((entry) => {
        const dateStr = formatHistoryDate(entry.date, entry.daily || entry.weekly);
        (entry.gemini || []).forEach((m) => rows.push([dateStr, 'Google Gemini', m.name, m.input === 0 ? 'Free' : '$' + Number(m.input).toFixed(2), m.output === 0 ? 'Free' : '$' + Number(m.output).toFixed(2), '—']));
        (entry.openai || []).forEach((m) => rows.push([dateStr, 'OpenAI', m.name, m.input === 0 ? 'Free' : '$' + Number(m.input).toFixed(2), m.output === 0 ? 'Free' : '$' + Number(m.output).toFixed(2), m.cachedInput != null ? '$' + Number(m.cachedInput).toFixed(2) : '—']));
        (entry.anthropic || []).forEach((m) => rows.push([dateStr, 'Anthropic', m.name, m.input === 0 ? 'Free' : '$' + Number(m.input).toFixed(2), m.output === 0 ? 'Free' : '$' + Number(m.output).toFixed(2), '—']));
        (entry.mistral || []).forEach((m) => rows.push([dateStr, 'Mistral', m.name, m.input === 0 ? 'Free' : '$' + Number(m.input).toFixed(2), m.output === 0 ? 'Free' : '$' + Number(m.output).toFixed(2), '—']));
      });
      drawPdfBorderedTable(doc, 22, headers, rows.slice(0, 50), colWidths);
      doc.save('ai-pricing-history-' + new Date().toISOString().slice(0, 10) + '.pdf');
      showToast('History exported as PDF.', 'success');
    } catch (_) {
      showToast('PDF export failed.', 'error');
    }
  };

  if (!open) return null;

  return (
    <div id="historyModal" className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label="Pricing history">
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Pricing history</h2>
          <p className="modal-subtitle">Daily snapshots (12:00 AM IST) are kept. History is stored in this browser only.</p>
          <div className="modal-header-actions">
            <button type="button" className="export-btn csv modal-export" onClick={exportHistoryCSV} title="Export all history as CSV">📄 Export CSV</button>
            <button type="button" className="export-btn pdf modal-export" onClick={exportHistoryPDF} title="Export all history as PDF">📕 Export PDF</button>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
          </div>
        </div>
        <div className="modal-body" id="historyModalBody">
          <div className="history-compare-section">
            <h3>Compare pricing between two snapshots</h3>
            <div className="history-compare-controls">
              <label>From <select id="historyCompareFrom" value={String(fromIdx)} onChange={(e) => setFromIdx(parseInt(e.target.value, 10))}>
                {historyList.map((entry, idx) => {
                  const d = new Date(entry.date);
                  const isScheduled = entry.daily || entry.weekly;
                  const dateStr = isScheduled ? d.toLocaleString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }) + ', 12:00 am IST' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
                  return <option key={idx} value={idx}>{dateStr}</option>;
                })}
              </select></label>
              <label>To <select id="historyCompareTo" value={String(toIdx)} onChange={(e) => setToIdx(parseInt(e.target.value, 10))}>
                {historyList.map((entry, idx) => {
                  const d = new Date(entry.date);
                  const isScheduled = entry.daily || entry.weekly;
                  const dateStr = isScheduled ? d.toLocaleString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }) + ', 12:00 am IST' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
                  return <option key={idx} value={idx}>{dateStr}</option>;
                })}
              </select></label>
              <button type="button" className="calc-btn" id="historyCompareBtn" onClick={runCompare}>Compare</button>
            </div>
            {compareResult && (
              <div id="historyCompareResult" className="history-compare-result">
                <h4>Google Gemini</h4>
                <table className="model-table">
                  <thead><tr><th>Model</th><th>Input ({compareResult.fromDateStr})</th><th>Output ({compareResult.fromDateStr})</th><th>Input ({compareResult.toDateStr})</th><th>Output ({compareResult.toDateStr})</th><th>Change</th></tr></thead>
                  <tbody>
                    {compareResult.allGemini.map((n) => {
                      const a = compareResult.gFrom[n];
                      const b = compareResult.gTo[n];
                      let change = '';
                      if (!a) change = 'Added';
                      else if (!b) change = 'Removed';
                      else if (a.input !== b.input || a.output !== b.output) change = 'Changed';
                      else change = 'Same';
                      return (
                        <tr key={n}>
                          <td className="model-name">{n}</td>
                          <td>{a ? fmt(a.input) : '—'}</td>
                          <td>{a ? fmt(a.output) : '—'}</td>
                          <td>{b ? fmt(b.input) : '—'}</td>
                          <td>{b ? fmt(b.output) : '—'}</td>
                          <td>{change}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <h4>OpenAI</h4>
                <table className="model-table">
                  <thead><tr><th>Model</th><th>Input (From)</th><th>Cached</th><th>Output</th><th>Input (To)</th><th>Cached</th><th>Output</th><th>Change</th></tr></thead>
                  <tbody>
                    {compareResult.allOpenai.map((n) => {
                      const a = compareResult.oFrom[n];
                      const b = compareResult.oTo[n];
                      let change = '';
                      if (!a) change = 'Added';
                      else if (!b) change = 'Removed';
                      else if (a.input !== b.input || a.output !== b.output || (a.cachedInput || 0) !== (b.cachedInput || 0)) change = 'Changed';
                      else change = 'Same';
                      return (
                        <tr key={n}>
                          <td className="model-name">{n}</td>
                          <td>{a ? fmt(a.input) : '—'}</td>
                          <td>{a?.cachedInput != null ? fmt(a.cachedInput) : '—'}</td>
                          <td>{a ? fmt(a.output) : '—'}</td>
                          <td>{b ? fmt(b.input) : '—'}</td>
                          <td>{b?.cachedInput != null ? fmt(b.cachedInput) : '—'}</td>
                          <td>{b ? fmt(b.output) : '—'}</td>
                          <td>{change}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <h4>Anthropic</h4>
                <table className="model-table">
                  <thead><tr><th>Model</th><th>Input (From)</th><th>Output (From)</th><th>Input (To)</th><th>Output (To)</th><th>Change</th></tr></thead>
                  <tbody>
                    {compareResult.allAnthropic.map((n) => {
                      const a = compareResult.aFrom[n];
                      const b = compareResult.aTo[n];
                      let change = '';
                      if (!a) change = 'Added';
                      else if (!b) change = 'Removed';
                      else if (a.input !== b.input || a.output !== b.output) change = 'Changed';
                      else change = 'Same';
                      return (
                        <tr key={n}>
                          <td className="model-name">{n}</td>
                          <td>{a ? fmt(a.input) : '—'}</td>
                          <td>{a ? fmt(a.output) : '—'}</td>
                          <td>{b ? fmt(b.input) : '—'}</td>
                          <td>{b ? fmt(b.output) : '—'}</td>
                          <td>{change}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <h4>Mistral</h4>
                <table className="model-table">
                  <thead><tr><th>Model</th><th>Input (From)</th><th>Output (From)</th><th>Input (To)</th><th>Output (To)</th><th>Change</th></tr></thead>
                  <tbody>
                    {compareResult.allMistral.map((n) => {
                      const a = compareResult.mFrom[n];
                      const b = compareResult.mTo[n];
                      let change = '';
                      if (!a) change = 'Added';
                      else if (!b) change = 'Removed';
                      else if (a.input !== b.input || a.output !== b.output) change = 'Changed';
                      else change = 'Same';
                      return (
                        <tr key={n}>
                          <td className="model-name">{n}</td>
                          <td>{a ? fmt(a.input) : '—'}</td>
                          <td>{a ? fmt(a.output) : '—'}</td>
                          <td>{b ? fmt(b.input) : '—'}</td>
                          <td>{b ? fmt(b.output) : '—'}</td>
                          <td>{change}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {historyList.length === 0 && (
            <p className="history-empty">No daily history yet. A snapshot is saved automatically when you first open the app each day (12:00 AM IST).</p>
          )}
          {historyList.length > 0 && (
            <div className="history-entries">
              {historyList.map((entry, idx) => {
                const d = new Date(entry.date);
                const isScheduled = entry.daily || entry.weekly;
                const dateStr = isScheduled ? d.toLocaleString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }) + ', 12:00 am IST' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
                const scheduleBadge = entry.daily ? ' Daily' : entry.weekly ? ' Weekly' : '';
                const gList = dedupeModelsByName(entry.gemini || []);
                const oList = dedupeModelsByName(entry.openai || []);
                const summaryParts = [];
                if (gList.length) summaryParts.push(gList.length + ' Gemini');
                if (oList.length) summaryParts.push(oList.length + ' OpenAI');
                if ((entry.anthropic || []).length) summaryParts.push(entry.anthropic.length + ' Anthropic');
                if ((entry.mistral || []).length) summaryParts.push(entry.mistral.length + ' Mistral');
                return (
                  <div key={idx} className="history-entry">
                    <div className="history-entry-header">
                      <span className="history-entry-date">{dateStr}{scheduleBadge}</span>
                      <span className="history-entry-summary">{summaryParts.join(' · ') || 'No models'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
