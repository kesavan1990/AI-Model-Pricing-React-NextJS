'use client';

import { useState } from 'react';
import { Sidebar } from '../Sidebar';
import { Header } from '../Header';
import { Toast } from '../Toast';
import { Footer } from '../Footer';
import { HistoryModal } from '../HistoryModal';
import { usePricing } from '../../context/PricingContext';

export default function DashboardLayout({ children }) {
  const { toast } = usePricing();
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <div className="dashboard-layout">
      <Header onOpenHistory={() => setHistoryOpen(true)} />
      <div className="dashboard-body">
        <Sidebar onOpenHistory={() => setHistoryOpen(true)} />
        <main className="dashboard-main">
          <Toast message={toast.msg} type={toast.type} show={toast.show} />
          {children}
          <Footer />
        </main>
      </div>
      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}
