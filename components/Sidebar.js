'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

function normalizePath(p) {
  if (!p || typeof p !== 'string') return '';
  return p.replace(/\/$/, '') || '/';
}

const basePath = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BASE_PATH ? process.env.NEXT_PUBLIC_BASE_PATH : '';

export function Sidebar({ onOpenHistory }) {
  const pathname = usePathname() || '';
  const router = useRouter();
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

  const handleNavClick = (e, href) => {
    const isSameTab = !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0;
    if (!isSameTab) return;
    e.preventDefault();
    if (basePath) {
      window.location.href = basePath + href;
    } else {
      router.push(href);
    }
  };

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
            prefetch={false}
            onClick={(e) => handleNavClick(e, href)}
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
