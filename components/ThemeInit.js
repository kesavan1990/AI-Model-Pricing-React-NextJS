'use client';

import { useEffect } from 'react';

export function ThemeInit() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = localStorage.getItem('ai-pricing-theme');
    if (t === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else if (
      t !== 'dark' &&
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-color-scheme: light)').matches
    ) {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);
  return null;
}
