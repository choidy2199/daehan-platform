'use client';

import { List, History, Save } from 'lucide-react';
import type { DraftMeta, TabId } from '../types';
import { TAB_LABELS } from '../types';

interface Props {
  tabType: TabId;
  currentDraft: DraftMeta | null;
  onSaveClick: () => void;
  onHistoryClick: () => void;
}

export default function DarkBar({ tabType, currentDraft, onSaveClick, onHistoryClick }: Props) {
  const menuName = TAB_LABELS[tabType];
  return (
    <div style={{
      background: '#1A1D23',
      color: '#FFFFFF',
      padding: '0 16px',
      height: 40,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: '8px 8px 0 0',
      fontFamily: "'Pretendard', -apple-system, sans-serif",
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 500 }}>{menuName}</span>
        {currentDraft && (
          <>
            <span style={{
              background: 'rgba(255,255,255,0.15)',
              color: '#FFFFFF',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 500,
              fontFamily: '"SF Mono", monospace',
            }}>{currentDraft.draft_no}</span>
            {currentDraft.draft_name && (
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
                {currentDraft.draft_name}
              </span>
            )}
          </>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          type="button"
          onClick={onSaveClick}
          style={darkBarPrimaryBtn}
        >
          <Save size={13} />
          <span>저장</span>
        </button>
        <button
          type="button"
          onClick={onHistoryClick}
          style={darkBarGhostBtn}
        >
          <History size={13} />
          <span>지난 내역</span>
        </button>
      </div>
    </div>
  );
}

const darkBarPrimaryBtn: React.CSSProperties = {
  background: '#185FA5',
  color: '#FFFFFF',
  border: '1px solid #185FA5',
  borderRadius: 6,
  padding: '5px 14px',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
};

const darkBarGhostBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.15)',
  color: '#FFFFFF',
  border: '1px solid rgba(255,255,255,0.35)',
  borderRadius: 6,
  padding: '5px 12px',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
};
