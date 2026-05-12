'use client';

import { useEffect, useState } from 'react';
import { X, Save } from 'lucide-react';
import type { TabId } from '../types';

interface Props {
  show: boolean;
  tabType: TabId;
  onClose: () => void;
  onSaved: (newDraftNo: string, draftName: string | null) => void;
}

export default function SaveDraftModal({ show, tabType, onClose, onSaved }: Props) {
  const [draftName, setDraftName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ESC 키 닫기 + show=false 시 입력 초기화
  useEffect(() => {
    if (!show) {
      setDraftName('');
      setError(null);
      setSaving(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show, onClose]);

  if (!show) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const u = JSON.parse(localStorage.getItem('current_user') || 'null');
      const created_by = u?.loginId || 'admin';
      const res = await fetch('/api/import-pricing/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tab_type: tabType,
          created_by,
          draft_name: draftName.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      onSaved(json.data.draft_no, json.data.draft_name);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

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
          background: '#FFFFFF', borderRadius: 12, width: '100%', maxWidth: 440,
        }}
      >
        <div style={modalHeader}>
          <p style={{ fontSize: 15, fontWeight: 500, color: '#1A1D23', margin: 0 }}>
            새 책정안 저장
          </p>
          <button type="button" onClick={onClose} style={iconBtn} aria-label="닫기">
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={modalLabel}>
              이름 <span style={{ color: '#9BA3B2', fontWeight: 400 }}>(선택)</span>
            </label>
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="예: 12월 수입분"
              autoFocus
              style={modalInput}
            />
            <p style={{ fontSize: 11, color: '#9BA3B2', margin: '6px 0 0' }}>
              비워두면 번호만 남음 (나중에 수정 가능)
            </p>
          </div>
          {error && (
            <div style={{
              background: '#FCEBEB', color: '#791F1F', fontSize: 12,
              padding: '8px 12px', borderRadius: 6, marginTop: 4,
            }}>{error}</div>
          )}
        </div>
        <div style={modalFooter}>
          <button type="button" onClick={onClose} disabled={saving} style={modalSecondaryBtn}>
            취소
          </button>
          <button type="button" onClick={handleSave} disabled={saving} style={modalPrimaryBtn}>
            <Save size={14} />
            <span>{saving ? '저장 중…' : '저장'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const modalHeader: React.CSSProperties = {
  padding: '16px 20px', borderBottom: '0.5px solid #DDE1EB',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};
const modalFooter: React.CSSProperties = {
  padding: '12px 20px', borderTop: '0.5px solid #DDE1EB',
  display: 'flex', justifyContent: 'flex-end', gap: 8,
};
const modalLabel: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500, color: '#5A6070', marginBottom: 6,
};
const modalInput: React.CSSProperties = {
  width: '100%', height: 36, padding: '0 12px', border: '1px solid #DDE1EB',
  borderRadius: 6, fontSize: 13, fontFamily: 'inherit', color: '#1A1D23',
  background: '#FFFFFF', boxSizing: 'border-box', outline: 'none',
};
const modalPrimaryBtn: React.CSSProperties = {
  background: '#185FA5', color: '#FFFFFF', border: 'none', borderRadius: 6,
  padding: '8px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
  fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6,
};
const modalSecondaryBtn: React.CSSProperties = {
  background: 'transparent', color: '#5A6070', border: '1px solid #DDE1EB',
  borderRadius: 6, padding: '7px 16px', fontSize: 13, fontWeight: 500,
  cursor: 'pointer', fontFamily: 'inherit',
};
const iconBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', color: '#5A6070',
  cursor: 'pointer', padding: 4, display: 'inline-flex',
};
