import React, { useState, useEffect, useRef } from 'react';
import { MoreVertical, X, TrendingUp, PieChart, CalendarCheck, Check } from 'lucide-react';

export type TabId = 'page-performance' | 'page-share' | 'page-vendas-du';

interface NavigationProps {
  activeTab: TabId;
  onTabChange: (tabId: TabId) => void;
}

interface TabOption {
  id: TabId;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  description: string;
}

const TABS: TabOption[] = [
  {
    id: 'page-performance',
    label: 'Performance Marketing & Vendas',
    shortLabel: 'Performance & Vendas',
    icon: <TrendingUp size={18} />,
    description: 'Extrato intradiário, CPA e investimento',
  },
  {
    id: 'page-share',
    label: 'Share de Impressão',
    shortLabel: 'Share de Impressão',
    icon: <PieChart size={18} />,
    description: 'Métricas analíticas de Google Ads',
  },
  {
    id: 'page-vendas-du',
    label: 'Vendas por DU',
    shortLabel: 'Vendas por DU',
    icon: <CalendarCheck size={18} />,
    description: 'Média por Dia Útil Brasil e Estados',
  },
];

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleSelectTab = (tabId: TabId) => {
    onTabChange(tabId);
    setMobileMenuOpen(false);
  };

  const currentTab = TABS.find((t) => t.id === activeTab) || TABS[0];

  return (
    <>
      <nav className="top-nav" id="top-nav-bar">
        {/* Desktop View: Horizontal Tabs */}
        <div className="desktop-tabs-container">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`tab-btn-${tab.id.replace('page-', '')}`}
              className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.shortLabel}
            </button>
          ))}
        </div>

        {/* Mobile View: Top Brand Header + 3-dots Button */}
        <div className="mobile-nav-bar">
          <div className="mobile-nav-left">
            <span className="mobile-nav-logo">LABEST</span>
            <span className="mobile-nav-divider">/</span>
            <span className="mobile-nav-current-tab">{currentTab.shortLabel}</span>
          </div>

          <button
            type="button"
            id="btn-mobile-nav-toggle"
            className="mobile-dots-btn"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menu de navegação"
            aria-expanded={mobileMenuOpen}
          >
            <span className="mobile-dots-label">Abas</span>
            <MoreVertical size={18} className="mobile-dots-icon" />
          </button>
        </div>
      </nav>

      {/* Mobile Drawer / Popup Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay" aria-modal="true" role="dialog">
          <div className="mobile-menu-backdrop" onClick={() => setMobileMenuOpen(false)} />
          <div className="mobile-menu-drawer" ref={menuRef}>
            <div className="mobile-menu-header">
              <div>
                <div className="mobile-menu-tag">NAVEGAÇÃO</div>
                <div className="mobile-menu-title">Módulos do Dashboard</div>
              </div>
              <button
                type="button"
                className="mobile-menu-close-btn"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Fechar menu"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mobile-menu-list">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`mobile-menu-item ${isActive ? 'active' : ''}`}
                    onClick={() => handleSelectTab(tab.id)}
                  >
                    <div className="mobile-item-icon-wrap">{tab.icon}</div>
                    <div className="mobile-item-info">
                      <div className="mobile-item-label">{tab.label}</div>
                      <div className="mobile-item-desc">{tab.description}</div>
                    </div>
                    {isActive && (
                      <div className="mobile-item-active-check">
                        <Check size={18} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mobile-menu-footer">
              <span>LABEST Analytics &middot; 2026</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

