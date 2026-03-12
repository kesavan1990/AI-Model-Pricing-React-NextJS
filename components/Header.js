'use client';

import { useState, useEffect } from 'react';
import { usePricing } from '../context/PricingContext';

export function Header({ onOpenHistory }) {
  const { refresh, loading } = usePricing();
  const [theme, setTheme] = useState('dark');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = document.documentElement.getAttribute('data-theme') || 'dark';
    setTheme(t);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    setTheme(next);
    if (typeof window !== 'undefined') localStorage.setItem('ai-pricing-theme', next);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <header className="dashboard-header">
      <h1 className="dashboard-title">
        <a href="#overview" className="header-home-link" title="Go to overview">
          🤖
        </a>{' '}
        AI Model Pricing Intelligence Dashboard
      </h1>
      <div className="header-actions">
        <button
          type="button"
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title="Toggle dark/light mode"
          aria-label="Toggle dark/light mode"
        >
          <span>{theme === 'light' ? '🌙' : '☀️'}</span>
        </button>
        <button
          type="button"
          className="refresh-btn"
          onClick={handleRefresh}
          disabled={loading || refreshing}
          title="Fetch latest pricing"
        >
          <span className={'refresh-icon' + (refreshing ? ' spinning' : '')}>🔄</span>
          <span>Refresh</span>
        </button>
        <a href="#" className="history-btn" onClick={(e) => { e.preventDefault(); onOpenHistory(); }} title="View pricing history">
          📜 History
        </a>
      </div>
    </header>
  );
}
