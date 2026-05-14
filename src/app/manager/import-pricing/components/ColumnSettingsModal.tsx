'use client';

import { useState, useEffect, useRef } from 'react';
import { COLUMNS, DEFAULT_VISIBLE, type ColumnId } from '../lib/columnConfig';
import type { StoredConfig } from '../lib/useColumnConfig';

interface ColumnSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: StoredConfig;
  onApply: (next: StoredConfig) => void;
  onReset: () => void;
}

export function ColumnSettingsModal({ isOpen, onClose, config, onApply, onReset }: ColumnSettingsModalProps) {
  const [draftOrder, setDraftOrder] = useState<ColumnId[]>(config.order);
  const [draftHidden, setDraftHidden] = useState<ColumnId[]>(config.hidden);
  const [draggingId, setDraggingId] = useState<ColumnId | null>(null);
  const draggingSource = useRef<'order' | 'hidden' | null>(null);

  // 모달 열릴 때 draft를 현재 config로 초기화
  useEffect(() => {
    if (isOpen) {
      setDraftOrder([...config.order]);
      setDraftHidden([...config.hidden]);
      setDraggingId(null);
    }
  }, [isOpen, config]);

  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isRequired = (id: ColumnId) => COLUMNS.find(c => c.id === id)?.required ?? false;

  const getLabel = (id: ColumnId) => COLUMNS.find(c => c.id === id)?.header ?? id;

  // 클릭으로 표시↔숨김 토글
  const toggleColumn = (id: ColumnId) => {
    if (isRequired(id)) return;
    if (draftOrder.includes(id)) {
      setDraftOrder(prev => prev.filter(x => x !== id));
      setDraftHidden(prev => [...prev, id]);
    } else {
      setDraftHidden(prev => prev.filter(x => x !== id));
      setDraftOrder(prev => [...prev, id]);
    }
  };

  // 드래그 이벤트
  const onDragStart = (id: ColumnId, source: 'order' | 'hidden') => (e: React.DragEvent) => {
    if (isRequired(id) && source === 'order') {
      // 필수 컬럼은 드래그로 숨김 영역으로 이동 불가 (표시 영역 내 순서 변경은 허용)
    }
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(id);
    draggingSource.current = source;
  };

  const onDragEnd = () => {
    setDraggingId(null);
    draggingSource.current = null;
  };

  // 표시 영역 내 순서 변경
  const onDropOnItem = (targetId: ColumnId, after: boolean) => {
    if (!draggingId) return;
    const src = draggingSource.current;

    if (src === 'hidden') {
      // 숨김 → 표시 영역으로 이동
      setDraftHidden(prev => prev.filter(x => x !== draggingId));
      setDraftOrder(prev => {
        const next = prev.filter(x => x !== draggingId);
        const idx = next.indexOf(targetId);
        next.splice(after ? idx + 1 : idx, 0, draggingId!);
        return next;
      });
    } else {
      // 표시 내 재정렬
      setDraftOrder(prev => {
        const next = prev.filter(x => x !== draggingId);
        const idx = next.indexOf(targetId);
        next.splice(after ? idx + 1 : idx, 0, draggingId!);
        return next;
      });
    }
  };

  // 숨김 영역에 드롭
  const onDropOnHidden = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggingId || isRequired(draggingId)) return;
    setDraftOrder(prev => prev.filter(x => x !== draggingId));
    setDraftHidden(prev => prev.includes(draggingId) ? prev : [...prev, draggingId]);
  };

  const handleApply = () => {
    onApply({ order: draftOrder, hidden: draftHidden });
    onClose();
  };

  const handleReset = () => {
    setDraftOrder([...DEFAULT_VISIBLE]);
    setDraftHidden([]);
  };

  const handleCancel = () => {
    setDraftOrder([...config.order]);
    setDraftHidden([...config.hidden]);
    onClose();
  };

  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(23, 23, 23, 0.45)',
          zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {/* 모달 본체 */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: '#ffffff',
            borderRadius: 12,
            width: 560,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100vh - 80px)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 32px rgba(23, 23, 23, 0.18)',
            fontFamily: "'Pretendard', -apple-system, sans-serif",
          }}
        >
          {/* 헤더 */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #E1E2E4',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#171719' }}>⚙ 컬럼 설정</span>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 18, color: 'rgba(55,56,60,0.61)', lineHeight: 1, padding: 4,
              }}
            >✕</button>
          </div>

          {/* 본문 */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
            padding: '16px 20px',
            overflowY: 'auto',
            flexGrow: 1,
          }}>
            {/* 표시 중 */}
            <div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 8,
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(55,56,60,0.61)' }}>표시 중</span>
                <span style={{
                  fontSize: 11, background: '#E8F0FE', color: '#185FA5',
                  borderRadius: 10, padding: '1px 7px', fontWeight: 500,
                }}>{draftOrder.length}</span>
              </div>
              <div
                onDragOver={e => e.preventDefault()}
                style={{
                  background: '#F7F7F8',
                  border: '1px solid #E1E2E4',
                  borderRadius: 8,
                  minHeight: 200,
                  padding: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {draftOrder.map(id => (
                  <DragItem
                    key={id}
                    id={id}
                    label={getLabel(id)}
                    required={isRequired(id)}
                    isDragging={draggingId === id}
                    onDragStart={onDragStart(id, 'order')}
                    onDragEnd={onDragEnd}
                    onDropOnItem={onDropOnItem}
                    onToggle={() => toggleColumn(id)}
                    side="order"
                  />
                ))}
                {draftOrder.length === 0 && (
                  <div style={{
                    textAlign: 'center', color: 'rgba(55,56,60,0.28)',
                    fontSize: 12, padding: '24px 0',
                  }}>필수 컬럼이 항상 표시됩니다</div>
                )}
              </div>
            </div>

            {/* 숨김 */}
            <div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 8,
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(55,56,60,0.61)' }}>숨김</span>
                <span style={{
                  fontSize: 11, background: '#F4F5F6', color: 'rgba(55,56,60,0.61)',
                  borderRadius: 10, padding: '1px 7px', fontWeight: 500,
                }}>{draftHidden.length}</span>
              </div>
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={onDropOnHidden}
                style={{
                  background: '#EAEBEC',
                  border: '1px solid #D5D6D9',
                  borderRadius: 8,
                  minHeight: 200,
                  padding: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {draftHidden.map(id => (
                  <DragItem
                    key={id}
                    id={id}
                    label={getLabel(id)}
                    required={false}
                    isDragging={draggingId === id}
                    onDragStart={onDragStart(id, 'hidden')}
                    onDragEnd={onDragEnd}
                    onDropOnItem={onDropOnItem}
                    onToggle={() => toggleColumn(id)}
                    side="hidden"
                  />
                ))}
                {draftHidden.length === 0 && (
                  <div style={{
                    textAlign: 'center', color: 'rgba(55,56,60,0.28)',
                    fontSize: 12, padding: '24px 0',
                  }}>숨길 컬럼을 여기에 드롭</div>
                )}
              </div>
            </div>
          </div>

          {/* 푸터 */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 20px',
            borderTop: '1px solid #E1E2E4',
            flexShrink: 0,
          }}>
            <button
              type="button"
              onClick={handleReset}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: 'rgba(55,56,60,0.61)', padding: '4px 0',
                textDecoration: 'underline',
              }}
            >기본값으로 초기화</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleCancel}
                style={{
                  background: '#ffffff', color: '#37383C',
                  border: '1px solid #E1E2E4', borderRadius: 6,
                  padding: '7px 16px', fontSize: 13, fontWeight: 500,
                  fontFamily: 'inherit', cursor: 'pointer',
                }}
              >취소</button>
              <button
                type="button"
                onClick={handleApply}
                style={{
                  background: '#185FA5', color: '#ffffff',
                  border: 'none', borderRadius: 6,
                  padding: '7px 16px', fontSize: 13, fontWeight: 500,
                  fontFamily: 'inherit', cursor: 'pointer',
                }}
              >적용</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================
// DragItem 컴포넌트
// ============================================================
interface DragItemProps {
  id: ColumnId;
  label: string;
  required: boolean;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDropOnItem: (targetId: ColumnId, after: boolean) => void;
  onToggle: () => void;
  side: 'order' | 'hidden';
}

function DragItem({ id, label, required, isDragging, onDragStart, onDragEnd, onDropOnItem, onToggle, side }: DragItemProps) {
  const [dropPos, setDropPos] = useState<'top' | 'bottom' | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setDropPos(e.clientY > rect.top + rect.height / 2 ? 'bottom' : 'top');
  };

  const handleDragLeave = () => setDropPos(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropPos(null);
    onDropOnItem(id, dropPos === 'bottom');
  };

  return (
    <div
      draggable={!(required && side === 'order') || true}
      onDragStart={onDragStart}
      onDragEnd={() => { onDragEnd(); setDropPos(null); }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 8px',
        borderRadius: 6,
        background: isDragging ? 'rgba(24, 95, 165, 0.08)' : '#ffffff',
        border: `1px solid ${dropPos === 'top' ? '#185FA5' : dropPos === 'bottom' ? '#185FA5' : '#E1E2E4'}`,
        borderTopColor: dropPos === 'top' ? '#185FA5' : '#E1E2E4',
        borderBottomColor: dropPos === 'bottom' ? '#185FA5' : '#E1E2E4',
        cursor: required ? 'default' : 'grab',
        opacity: isDragging ? 0.5 : 1,
        userSelect: 'none',
        transition: 'background 0.1s',
      }}
    >
      {/* 그립 아이콘 */}
      <span style={{
        color: required ? 'rgba(55,56,60,0.2)' : 'rgba(55,56,60,0.4)',
        fontSize: 14, lineHeight: 1, flexShrink: 0,
      }}>⠿</span>

      {/* 컬럼명 */}
      <span style={{
        fontSize: 13, color: required ? 'rgba(55,56,60,0.5)' : '#37383C',
        flex: 1, fontWeight: 500,
      }}>{label}</span>

      {/* 필수 뱃지 or 토글 버튼 */}
      {required ? (
        <span style={{
          fontSize: 10, color: 'rgba(55,56,60,0.4)',
          background: '#EAEBEC', borderRadius: 4, padding: '1px 6px', flexShrink: 0,
        }}>필수</span>
      ) : (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onToggle(); }}
          title={side === 'order' ? '숨기기' : '표시하기'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(55,56,60,0.4)', padding: 2, flexShrink: 0, lineHeight: 1,
          }}
        >
          {side === 'order' ? (
            // 눈 아이콘 (표시 중 → 숨기기)
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          ) : (
            // 눈 감은 아이콘 (숨김 → 표시하기)
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
