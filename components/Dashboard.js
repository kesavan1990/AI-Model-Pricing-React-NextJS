'use client';

import { useState, useEffect } from 'react';
import { usePricing } from '../context/PricingContext';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Overview } from './sections/Overview';
import { Models } from './sections/Models';
import { ValueAnalysis } from './sections/ValueAnalysis';
import { Calculators } from './sections/Calculators';
import { Recommend } from './sections/Recommend';
import { HistoryModal } from './HistoryModal';
import { Toast } from './Toast';
import { Footer } from './Footer';

const SECTION_IDS = ['overview', 'models', 'value-analysis', 'calculators', 'recommend-section'];
const HASH_TO_SECTION = {
  '#overview': 'overview',
  '#models': 'models',
  '#value-analysis': 'value-analysis',
  '#calculators': 'calculators',
  '#recommend': 'recommend-section',
};

function getSectionFromHash() {
  if (typeof window === 'undefined') return 'overview';
  const hash = window.location.hash || '#overview';
  return HASH_TO_SECTION[hash] || 'overview';
}

export function Dashboard() {
  const { toast } = usePricing();
  const [activeSection, setActiveSection] = useState('overview');
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    setActiveSection(getSectionFromHash());
    const onHashChange = () => setActiveSection(getSectionFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const showSection = (sectionId) => {
    const hash = SECTION_IDS.includes(sectionId) ? (sectionId === 'recommend-section' ? '#recommend' : '#' + sectionId) : '';
    if (hash) {
      window.location.hash = hash;
      setActiveSection(sectionId);
    }
  };

  return (
    <div className="dashboard-layout">
      <Header onOpenHistory={() => setHistoryOpen(true)} />
      <div className="dashboard-body">
        <Sidebar activeSection={activeSection} onNavigate={showSection} onOpenHistory={() => setHistoryOpen(true)} />
        <main className="dashboard-main">
          <Toast message={toast.msg} type={toast.type} show={toast.show} />
          <section id="overview" className={'dashboard-section' + (activeSection === 'overview' ? ' active' : '')}>
            <Overview />
          </section>
          <section id="models" className={'dashboard-section' + (activeSection === 'models' ? ' active' : '')}>
            <Models />
          </section>
          <section id="value-analysis" className={'dashboard-section' + (activeSection === 'value-analysis' ? ' active' : '')}>
            <ValueAnalysis />
          </section>
          <section id="calculators" className={'dashboard-section' + (activeSection === 'calculators' ? ' active' : '')}>
            <Calculators />
          </section>
          <section id="recommend-section" className={'dashboard-section' + (activeSection === 'recommend-section' ? ' active' : '')}>
            <Recommend />
          </section>
          <Footer />
        </main>
      </div>
      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}
