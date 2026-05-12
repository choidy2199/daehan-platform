'use client';

import { useState, useEffect } from 'react';

type TabId = 'pricing' | 'promotion';
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

  const handleTabChange = (id: TabId) => {
    setActiveTab(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  return (
    <div style={{
      padding: '24px',
      fontFamily: "'Pretendard', -apple-system, sans-serif",
      color: '#1A1D23',
      background: '#FFFFFF',
      minHeight: '100vh',
      boxSizing: 'border-box',
    }}>
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '16px',
      }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              data-tab-id={tab.id}
              onClick={() => handleTabChange(tab.id)}
              style={{
                background: isActive ? '#185FA5' : '#FFFFFF',
                color: isActive ? '#FFFFFF' : '#5A6070',
                border: `1px solid ${isActive ? '#185FA5' : '#DDE1EB'}`,
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: "'Pretendard', -apple-system, sans-serif",
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div>
        {activeTab === 'pricing' && (
          <p style={{ fontSize: '13px', color: '#5A6070', margin: 0 }}>
            Stage 3에서 책정안 테이블 UI 추가 예정
          </p>
        )}
        {activeTab === 'promotion' && (
          <p style={{ fontSize: '13px', color: '#5A6070', margin: 0 }}>
            Stage 8에서 프로모션 시뮬레이션 UI 추가 예정
          </p>
        )}
      </div>
    </div>
  );
}
