'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function normalizePath(p) {
  if (!p || typeof p !== 'string') return '';
  return p.replace(/\/$/, '') || '/';
}

export function Sidebar({ onOpenHistory }) {
  const pathname = usePathname() || '';
  const pathNorm = normalizePath(pathname);

  const links = [
    { href: '/dashboard/', label: 'Dashboard' },
    { href: '/pricing/', label: 'Pricing' },
    { href: '/calculator/', label: 'Calculator' },
    { href: '/comparison/', label: 'Comparison' },
    { href: '/value-analysis/', label: 'Value Analysis' },
    { href: '/benchmarks/', label: 'Benchmarks' },
    { href: '/recommend/', label: 'Recommend' },
  ];

  return (
    <aside className="dashboard-sidebar" aria-label="Dashboard navigation">
      <div className="dashboard-sidebar-title">
        AI Pricing
      </div>
      <nav className="sidebar-nav">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            prefetch
            className={'sidebar-link' + (pathNorm === normalizePath(href) ? ' active' : '')}
          >
            {label}
          </Link>
        ))}
        <button
          type="button"
          className="sidebar-link sidebar-link-modal text-left w-full cursor-pointer border-0 bg-transparent"
          onClick={() => onOpenHistory()}
          title="Open pricing history modal"
        >
          Pricing History
        </button>
      </nav>
    </aside>
  );
}
