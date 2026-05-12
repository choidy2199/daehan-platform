'use client';

import { useState, useEffect } from 'react';
import DarkBar from './components/DarkBar';
import SaveDraftModal from './components/SaveDraftModal';
import HistoryModal from './components/HistoryModal';
import ProductPickerModal from './components/ProductPickerModal';
import type { DraftMeta, TabId } from './types';

const STORAGE_KEY = 'import-pricing-active-tab';

const TABS: { id: TabId; label: string }[] = [
  { id: 'pricing', label: '📦 제품금액 책정' },
  { id: 'promotion', label: '🎁 제품 프로모션 책정' },
];

export default function ImportPricingPage() {
  const [activeTab, setActiveTab] = useState<TabId>('pricing');
  const [currentDraftByTab, setCurrentDraftByTab] = useState<Record<TabId, DraftMeta | null>>({
    pricing: null,
    promotion: null,
  });
  const [showSave, setShowSave] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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

  const currentDraft = currentDraftByTab[activeTab];

  const handleSaveClick = () => setShowSave(true);
  const handleHistoryClick = () => setShowHistory(true);

  const handleSaved = (draftNo: string, draftName: string | null) => {
    const u = JSON.parse(localStorage.getItem('current_user') || 'null');
    const newDraft: DraftMeta = {
      draft_no: draftNo,
      draft_name: draftName,
      tab_type: activeTab,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: u?.loginId || 'admin',
    };
    setCurrentDraftByTab((prev) => ({ ...prev, [activeTab]: newDraft }));
    setShowSave(false);
  };

  const handlePick = (draft: DraftMeta) => {
    setCurrentDraftByTab((prev) => ({ ...prev, [activeTab]: draft }));
    setShowHistory(false);
  };

  return (
    <div style={{
      padding: 24,
      fontFamily: "'Pretendard', -apple-system, sans-serif",
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
              data-tab-id={tab.id}
              onClick={() => handleTabChange(tab.id)}
              style={{
                background: isActive ? '#185FA5' : '#FFFFFF',
                color: isActive ? '#FFFFFF' : '#5A6070',
                border: `1px solid ${isActive ? '#185FA5' : '#DDE1EB'}`,
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: 13,
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

      <div style={{
        background: '#FFFFFF',
        borderRadius: 8,
        overflow: 'hidden',
        border: '0.5px solid #DDE1EB',
      }}>
        <DarkBar
          tabType={activeTab}
          currentDraft={currentDraft}
          onSaveClick={handleSaveClick}
          onHistoryClick={handleHistoryClick}
        />
        {currentDraft ? (
          <div style={{
            margin: 24,
            padding: '60px 24px',
            border: '1px dashed #DDE1EB',
            borderRadius: 8,
            background: '#FAFBFC',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
              이 책정안에 아직 제품이 없습니다
            </div>
            <button
              onClick={() => setPickerOpen(true)}
              style={{
                padding: '12px 28px',
                background: '#185FA5',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 500,
                fontFamily: "'Pretendard', -apple-system, sans-serif",
                cursor: 'pointer'
              }}
            >
              📦 일반단가표에서 제품 불러오기
            </button>
          </div>
        ) : (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#9BA3B2', fontSize: 12 }}>
            {activeTab === 'pricing'
              ? '14컬럼 본문 테이블 — Stage 3-1c·4 작업 범위'
              : '프로모션 시뮬레이션 본문 — Stage 8 작업 범위'}
          </div>
        )}
      </div>

      {currentDraft && pickerOpen && (
        <ProductPickerModal
          isOpen={pickerOpen}
          draftNo={currentDraft.draft_no}
          draftName={currentDraft.draft_name
            ? `${currentDraft.draft_no} · ${currentDraft.draft_name}`
            : currentDraft.draft_no}
          onClose={() => setPickerOpen(false)}
          onAdded={(count) => {
            setToast(`${count}건이 추가되었습니다`);
            setTimeout(() => setToast(null), 3000);
          }}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          padding: '12px 20px',
          background: '#1F2937',
          color: '#fff',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 500,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 9999
        }}>
          ✓ {toast}
        </div>
      )}

      <SaveDraftModal
        show={showSave}
        tabType={activeTab}
        onClose={() => setShowSave(false)}
        onSaved={handleSaved}
      />
      <HistoryModal
        show={showHistory}
        tabType={activeTab}
        currentDraftNo={currentDraft?.draft_no || null}
        onClose={() => setShowHistory(false)}
        onPick={handlePick}
      />
    </div>
  );
}
