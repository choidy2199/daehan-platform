'use client';

import { useEffect, useState, useMemo } from 'react';
import { X, Search, Check } from 'lucide-react';
import type { DraftMeta, TabId } from '../types';
import { TAB_LABELS } from '../types';

interface Props {
  show: boolean;
  tabType: TabId;
  currentDraftNo: string | null;
  onClose: () => void;
  onPick: (draft: DraftMeta) => void;
}

export default function HistoryModal({ show, tabType, currentDraftNo, onClose, onPick }: Props) {
  const [drafts, setDrafts] = useState<DraftMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!show) return;
    setQuery('');
    setError(null);
    setLoading(true);
    fetch(`/api/import-pricing/drafts?tab_type=${tabType}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.success) throw new Error(j?.error || 'fetch failed');
        setDrafts(j.data || []);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [show, tabType]);

  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return drafts;
    return drafts.filter((d) =>
      d.draft_no.toLowerCase().includes(q) ||
      (d.draft_name || '').toLowerCase().includes(q)
    );
  }, [drafts, query]);

  if (!show) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10000, fontFamily: "'Pretendard', -apple-system, sans-serif",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF', borderRadius: 12, width: '100%', maxWidth: 540,
          display: 'flex', flexDirection: 'column', maxHeight: '80vh',
        }}
      >
        <div style={modalHeader}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 500, color: '#1A1D23', margin: 0 }}>
              지난 내역
            </p>
            <p style={{ fontSize: 12, color: '#5A6070', margin: '2px 0 0' }}>
              {TAB_LABELS[tabType]} · 총 {drafts.length}건
            </p>
          </div>
          <button type="button" onClick={onClose} style={iconBtn} aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '14px 20px 8px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', top: 11, left: 10, color: '#9BA3B2' }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="번호 또는 이름 검색"
              style={{
                width: '100%', height: 36, padding: '0 12px 0 32px',
                border: '1px solid #DDE1EB', borderRadius: 6, fontSize: 13,
                fontFamily: 'inherit', color: '#1A1D23', background: '#FFFFFF',
                boxSizing: 'border-box', outline: 'none',
              }}
            />
          </div>
        </div>

        <div style={{ padding: '4px 12px 12px', overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ padding: 20, textAlign: 'center', color: '#9BA3B2', fontSize: 12 }}>
              불러오는 중…
            </div>
          )}
          {error && (
            <div style={{
              background: '#FCEBEB', color: '#791F1F', fontSize: 12,
              padding: '8px 12px', borderRadius: 6, margin: '4px 8px',
            }}>{error}</div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: '#9BA3B2', fontSize: 12 }}>
              {drafts.length === 0 ? '아직 저장된 책정안이 없습니다' : '검색 결과 없음'}
            </div>
          )}
          {!loading && !error && filtered.map((d) => {
            const isCurrent = currentDraftNo === d.draft_no;
            return (
              <div
                key={d.draft_no}
                onClick={() => onPick(d)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 6,
                  background: isCurrent ? '#E6F1FB' : 'transparent',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!isCurrent) (e.currentTarget as HTMLDivElement).style.background = '#F4F6FA';
                }}
                onMouseLeave={(e) => {
                  if (!isCurrent) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                }}
              >
                <span style={{
                  background: isCurrent ? '#FFFFFF' : '#F4F6FA',
                  color: isCurrent ? '#0C447C' : '#5A6070',
                  border: `1px solid ${isCurrent ? '#B5D4F4' : '#DDE1EB'}`,
                  borderRadius: 4, padding: '2px 8px',
                  fontSize: 11, fontWeight: 500,
                  fontFamily: '"SF Mono", monospace', flexShrink: 0,
                }}>{d.draft_no}</span>
                <span style={{ fontSize: 13, color: '#1A1D23', flex: 1 }}>
                  {d.draft_name || <span style={{ color: '#9BA3B2' }}>(이름 없음)</span>}
                </span>
                <span style={{ fontSize: 11, color: '#5A6070' }}>
                  {d.created_at.slice(5, 10)}
                </span>
                <span style={{ fontSize: 11, color: '#5A6070', minWidth: 40, textAlign: 'right' }}>
                  {d.created_by || '—'}
                </span>
                {isCurrent ? <Check size={14} style={{ color: '#185FA5' }} /> : <span style={{ width: 14 }} />}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

const modalHeader: React.CSSProperties = {
  padding: '16px 20px', borderBottom: '0.5px solid #DDE1EB',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};
const iconBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', color: '#5A6070',
  cursor: 'pointer', padding: 4, display: 'inline-flex',
};
