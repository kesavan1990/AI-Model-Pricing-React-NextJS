'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePricing } from '../context/PricingContext';
import { useTheme } from '../context/ThemeContext';

export function Header({ onOpenHistory }) {
  const { refresh, loading } = usePricing();
  const { theme, setTheme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <header className="dashboard-header">
      <h1 className="dashboard-title">
        <Link href="/dashboard" className="header-home-link" title="Go to dashboard">
          🤖
        </Link>{' '}
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
