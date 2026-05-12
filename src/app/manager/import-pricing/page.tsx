'use client';

import { useEffect, useState } from 'react';
import type { TabId } from './types';

const STORAGE_KEY = 'import-pricing-active-tab';

const TABS: { id: TabId; label: string }[] = [
  { id: 'pricing', label: '📦 제품금액 책정' },
  { id: 'promotion', label: '🎁 제품 프로모션 책정' },
];

export default function ImportPricingPage() {
  const [activeTab, setActiveTab] = useState<TabId>('pricing');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'pricing' || saved === 'promotion') {
      setActiveTab(saved);
    }
  }, []);

  const switchTab = (id: TabId) => {
    setActiveTab(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  return (
    <div style={{
      padding: 24,
      fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
      color: '#1A1D23',
      background: '#FFFFFF',
      minHeight: '100vh',
      boxSizing: 'border-box',
    }}>
      <style>{`.content { width: 100% !important; }`}</style>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchTab(tab.id)}
              style={{
                background: isActive ? '#185FA5' : '#FFFFFF',
                color: isActive ? '#FFFFFF' : '#5A6070',
                border: `1px solid ${isActive ? '#185FA5' : '#DDE1EB'}`,
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div style={{
        background: '#F4F6FA',
        borderRadius: 8,
        padding: '60px 24px',
        textAlign: 'center',
        fontSize: 14,
        color: '#5A6070',
      }}>
        구현 예정입니다.
      </div>
    </div>
  );
}
