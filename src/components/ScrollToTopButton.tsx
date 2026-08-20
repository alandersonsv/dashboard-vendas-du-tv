import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export const ScrollToTopButton: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 200) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!isVisible) return null;

  return (
    <button
      type="button"
      id="btn-scroll-to-top"
      onClick={scrollToTop}
      title="Voltar para o topo"
      aria-label="Voltar para o topo da página"
      style={{
        position: 'fixed',
        bottom: '28px',
        right: '28px',
        zIndex: 999,
        background: '#EA580C',
        color: '#FFFFFF',
        border: 'none',
        borderRadius: '30px',
        padding: '10px 18px',
        fontSize: '13px',
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '0 4px 14px rgba(234, 88, 12, 0.4), 0 2px 6px rgba(0,0,0,0.1)',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        transform: 'translateY(0)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.background = '#C2410C';
        e.currentTarget.style.boxShadow = '0 6px 18px rgba(234, 88, 12, 0.5)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.background = '#EA580C';
        e.currentTarget.style.boxShadow = '0 4px 14px rgba(234, 88, 12, 0.4)';
      }}
    >
      <ArrowUp size={16} strokeWidth={2.5} />
      <span>Topo</span>
    </button>
  );
};
