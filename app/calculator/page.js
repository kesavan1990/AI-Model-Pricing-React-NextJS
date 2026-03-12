'use client';

import DashboardLayout from '../../components/layout/DashboardLayout';
import { Calculators } from '../../components/sections/Calculators';

export default function CalculatorPage() {
  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-6">Calculator</h1>
      <Calculators />
    </DashboardLayout>
  );
}
