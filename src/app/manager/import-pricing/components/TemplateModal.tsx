'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import type { Template } from '../lib/useTemplates';

interface Props {
  isOpen: boolean;
  templates: Template[];
  onClose: () => void;
  onApply: (template: Template) => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
}

export default function TemplateModal({
  isOpen,
  templates,
  onClose,
  onApply,
  onRename,
  onDelete,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) {
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [editingId]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (editingId) {
          setEditingId(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, editingId, onClose]);

  if (!isOpen) return null;

  const startEdit = (t: Template) => {
    setEditingId(t.id);
    setEditingName(t.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const commitEdit = () => {
    const trimmed = editingName.trim();
    if (!trimmed || !editingId) return;
    onRename(editingId, trimmed);
    setEditingId(null);
    setEditingName('');
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1300,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: 16,
          width: 500,
          maxWidth: 'calc(100vw - 32px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
          fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 80px)',
        }}
      >
        {/* 헤더 */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '20px 20px 0',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#171719', marginBottom: 4 }}>
              템플릿
            </div>
            <div style={{ fontSize: 12, color: 'rgba(55,56,60,0.61)', lineHeight: 1.5 }}>
              행 클릭하면 표에 바로 추가됩니다. 이미 표에 있는 제품은 건너뜁니다.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: 'rgba(55,56,60,0.45)',
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
              marginTop: -2,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 목록 */}
        <div style={{
          padding: '16px 20px',
          overflowY: 'auto',
          flex: 1,
        }}>
          {templates.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '20px 0',
              fontSize: 13,
              color: 'rgba(55,56,60,0.45)',
            }}>
              저장된 템플릿이 없습니다
            </div>
          ) : (
            templates.map(t => {
              const isEditing = editingId === t.id;
              const dateStr = t.created_at.slice(0, 10);
              return (
                <div
                  key={t.id}
                  onClick={() => !isEditing && onApply(t)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    border: `0.5px solid ${isEditing ? '#185FA5' : '#E1E2E4'}`,
                    background: isEditing ? '#E6F1FB' : '#ffffff',
                    borderRadius: 8,
                    padding: '10px 12px',
                    marginBottom: 8,
                    cursor: isEditing ? 'default' : 'pointer',
                    transition: 'border-color 0.15s ease, background 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    if (!isEditing) (e.currentTarget as HTMLDivElement).style.background = '#F7F7F8';
                  }}
                  onMouseLeave={e => {
                    if (!isEditing) (e.currentTarget as HTMLDivElement).style.background = '#ffffff';
                  }}
                >
                  {/* 좌측 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => {
                          e.stopPropagation();
                          if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                          if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                        }}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '3px 8px',
                          fontSize: 14,
                          fontWeight: 500,
                          color: '#171719',
                          border: '1px solid #185FA5',
                          borderRadius: 6,
                          outline: 'none',
                          fontFamily: 'inherit',
                          marginBottom: 2,
                        }}
                      />
                    ) : (
                      <div style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#171719',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginBottom: 2,
                      }}>
                        {t.name}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: 'rgba(55,56,60,0.45)' }}>
                      {t.items.length}개 제품 · {dateStr} 저장
                    </div>
                  </div>

                  {/* 우측 아이콘 버튼 */}
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{ display: 'flex', gap: 4, flexShrink: 0 }}
                  >
                    {isEditing ? (
                      <>
                        <IconBtn
                          onClick={commitEdit}
                          disabled={!editingName.trim()}
                          primary
                          title="저장"
                        >
                          <Check size={14} />
                        </IconBtn>
                        <IconBtn onClick={cancelEdit} title="취소">
                          <X size={14} />
                        </IconBtn>
                      </>
                    ) : (
                      <>
                        <IconBtn onClick={() => startEdit(t)} title="이름 변경">
                          <Pencil size={14} />
                        </IconBtn>
                        <IconBtn onClick={() => onDelete(t.id)} title="삭제" danger>
                          <Trash2 size={14} />
                        </IconBtn>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 풋터 */}
        <div style={{
          padding: '0 20px 16px',
          textAlign: 'center',
          fontSize: 12,
          color: 'rgba(55,56,60,0.45)',
          flexShrink: 0,
        }}>
          저장된 템플릿 {templates.length}개
        </div>
      </div>
    </div>
  );
}

interface IconBtnProps {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}

function IconBtn({ children, onClick, title, primary, danger, disabled }: IconBtnProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 26,
        height: 26,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: primary ? '1px solid #185FA5' : '1px solid #E1E2E4',
        borderRadius: 6,
        background: primary ? '#185FA5' : '#ffffff',
        color: primary ? '#ffffff' : danger ? '#C83B38' : 'rgba(55,56,60,0.61)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}
