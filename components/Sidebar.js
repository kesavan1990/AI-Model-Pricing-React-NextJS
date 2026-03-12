'use client';

export function Sidebar({ activeSection, onNavigate, onOpenHistory }) {
  const links = [
    { section: 'overview', label: 'Overview' },
    { section: 'models', label: 'Models' },
    { section: 'value-analysis', label: 'Value Analysis' },
    { section: 'calculators', label: 'Calculators' },
    { section: 'benchmarks', label: 'Benchmarks' },
    { section: 'recommend-section', label: 'Recommend' },
  ];

  return (
    <aside className="dashboard-sidebar" aria-label="Dashboard navigation">
      <nav className="sidebar-nav">
        {links.map(({ section, label }) => (
          <a
            key={section}
            href={section === 'recommend-section' ? '#recommend' : '#' + section}
            className={'sidebar-link' + (activeSection === section ? ' active' : '')}
            data-section={section}
            onClick={(e) => {
              e.preventDefault();
              onNavigate(section);
            }}
          >
            {label}
          </a>
        ))}
        <a
          href="#"
          className="sidebar-link sidebar-link-modal"
          data-action="history"
          onClick={(e) => {
            e.preventDefault();
            onOpenHistory();
          }}
          title="Open pricing history modal"
        >
          Pricing History
        </a>
      </nav>
    </aside>
  );
}
