'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

// Optional: customize NProgress bar (e.g. color, height)
if (typeof window !== 'undefined') {
  NProgress.configure({ showSpinner: false });
}

// Defer to next tick so we don't block the event handler (avoids "[Violation] 'message' handler took Xms")
function defer(fn) {
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => { fn(); });
  } else {
    setTimeout(fn, 0);
  }
}

export function NavigationProgress() {
  const pathname = usePathname();

  // When route changes (navigation complete), finish the progress bar
  useEffect(() => {
    defer(() => NProgress.done());
  }, [pathname]);

  // When user clicks an internal link, start the progress bar (App Router has no Router.events)
  useEffect(() => {
    const handleClick = (e) => {
      const link = e.target.closest('a[href^="/"]');
      if (!link || link.target === '_blank' || link.getAttribute('rel') === 'external') return;
      const href = link.getAttribute('href');
      if (href && href.startsWith('/') && !href.startsWith('//')) {
        defer(() => NProgress.start());
      }
    };
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  return null;
}
