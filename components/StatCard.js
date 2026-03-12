'use client';

export default function StatCard({ title, value, meta }) {
  return (
    <div className="kpi-card">
      <h3 className="kpi-title">{title}</h3>
      <p className="kpi-value">{value}</p>
      {meta != null && meta !== '' && (
        <p className="kpi-meta">{meta}</p>
      )}
    </div>
  );
}
