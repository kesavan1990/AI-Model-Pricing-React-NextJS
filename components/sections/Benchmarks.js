'use client';

import { useMemo } from 'react';
import { usePricing } from '../../context/PricingContext';
import { getAllModels, getBenchmarkForModelMerged, getCostTierLabel } from '../../src/calculator.js';
import { escapeCsvCell, drawPdfBorderedTable } from '../../src/render.js';

export function Benchmarks() {
  const { getData, getBenchmarksData, showToast } = usePricing();
  const data = getData();
  const fileBenchmarks = getBenchmarksData();
  const all = useMemo(() => getAllModels(data), [data]);

  const rows = useMemo(
    () =>
      all.map((m) => {
        const b = getBenchmarkForModelMerged(m.name, m.providerKey, Array.isArray(fileBenchmarks) ? fileBenchmarks : null);
        const { tier, desc } = getCostTierLabel(m.blended);
        const blendedStr = m.blended <= 0 ? '0' : m.blended.toFixed(2);
        const costTitle = `Blended: $${blendedStr}/1M tokens (70% input, 30% output) — ${desc}`;
        return { name: m.name, mmlu: b.mmlu, code: b.code, reasoning: b.reasoning, arena: b.arena, costTier: tier, costTitle };
      }),
    [all, fileBenchmarks]
  );

  const exportCSV = () => {
    const csvRows = ['Model,MMLU,Code,Reasoning,Arena,Cost tier'];
    rows.forEach((m) => csvRows.push([m.name, m.mmlu, m.code, m.reasoning, m.arena, m.costTier].map(escapeCsvCell).join(',')));
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
      const headers = ['Model', 'MMLU', 'Code', 'Reasoning', 'Arena', 'Cost'];
      const colWidths = [50, 28, 28, 32, 28, 24];
      const pdfRows = rows.map((m) => [m.name, m.mmlu, m.code, m.reasoning, m.arena, m.costTier]);
      drawPdfBorderedTable(doc, 32, headers, pdfRows, colWidths);
      doc.save('ai-benchmarks-' + new Date().toISOString().slice(0, 10) + '.pdf');
      showToast('Benchmarks exported as PDF.', 'success');
    } catch (_) {
      showToast('PDF export failed.', 'error');
    }
  };

  return (
    <section className="page-section" id="section-benchmark">
      <h2 className="section-title">📊 Benchmarks</h2>
      <p className="section-subtitle">Model benchmarks (MMLU, Code, Reasoning, Arena) and cost tier. Use Export to download CSV or PDF.</p>
      <div className="benchmark-export-toolbar">
        <span className="export-label">Export:</span>
        <button type="button" className="export-btn csv" onClick={exportCSV} title="Download benchmarks as CSV">📄 CSV</button>
        <button type="button" className="export-btn pdf" onClick={exportPDF} title="Download benchmarks as PDF">📕 PDF</button>
      </div>
      <div id="benchmark-dashboard-table" className="benchmark-dashboard-table">
        <div className="benchmark-table-scroll">
          <table className="model-table">
            <thead>
              <tr>
                <th>Model</th>
                <th title="Massive Multitask Language Understanding — broad knowledge. Higher = better.">MMLU</th>
                <th title="HumanEval — code generation. Higher = better.">Code</th>
                <th title="GSM8K — reasoning. Higher = better.">Reasoning</th>
                <th title="Arena / leaderboard. Higher = better.">Arena</th>
                <th title="Cost tier: $ = free/low, $$ = budget, $$$ = premium.">Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m, i) => (
                <tr key={i}>
                  <td className="model-name">{m.name}</td>
                  <td className="benchmark-score">{m.mmlu}</td>
                  <td className="benchmark-score">{m.code}</td>
                  <td className="benchmark-score">{m.reasoning}</td>
                  <td className="benchmark-score">{m.arena}</td>
                  <td className="cost-tier" title={m.costTitle}>{m.costTier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
