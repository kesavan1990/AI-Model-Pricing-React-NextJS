'use client';

import Link from 'next/link';

/**
 * Catches client-side errors (e.g. on /calculator/) and shows a fallback so the app doesn't show the generic "Application error" page.
 */
export default function Error({ error, reset }) {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
        background: 'var(--theme-bg, #1a1a2e)',
        color: 'var(--theme-text, #fff)',
      }}
    >
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Something went wrong</h1>
      <p style={{ color: 'var(--theme-text-muted, #94a3b8)', marginBottom: '1.5rem', textAlign: 'center' }}>
        {error?.message || 'A client-side error occurred.'}
      </p>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={() => reset?.()}
          style={{
            padding: '0.5rem 1rem',
            background: 'var(--theme-card-border, rgba(255,255,255,0.2))',
            border: '1px solid var(--theme-card-border)',
            borderRadius: '6px',
            color: 'inherit',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          style={{
            padding: '0.5rem 1rem',
            background: 'var(--theme-card-border, rgba(255,255,255,0.2))',
            border: '1px solid var(--theme-card-border)',
            borderRadius: '6px',
            color: 'inherit',
            textDecoration: 'none',
          }}
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
