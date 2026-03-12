'use client';

import DashboardLayout from '../../components/layout/DashboardLayout';
import { Overview } from '../../components/sections/Overview';

export default function PricingPage() {
  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-6">Pricing</h1>
      <Overview showOnlyPricing />
    </DashboardLayout>
  );
}
