'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  isOpen: boolean;
  selectedItemsPreview: string[];
  count: number;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export function SaveTemplateDialog({
  isOpen,
  selectedItemsPreview,
  count,
  onConfirm,
  onCancel,
}: Props) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const trimmed = name.trim();
  const overflowCount = selectedItemsPreview.length > 3 ? selectedItemsPreview.length - 3 : 0;
  const preview = selectedItemsPreview.slice(0, 3);

  return (
    <div
      onClick={onCancel}
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
          width: 380,
          boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
          fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
          overflow: 'hidden',
        }}
      >
        {/* 헤더 */}
        <div style={{ padding: '20px 24px 0' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#171719', marginBottom: 4 }}>
            템플릿 저장
          </div>
          <div style={{ fontSize: 13, color: 'rgba(55,56,60,0.61)', marginBottom: 20 }}>
            선택한 {count}개 제품을 묶음으로 저장합니다.
          </div>

          {/* 이름 입력 */}
          <div style={{ marginBottom: 14 }}>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 500,
              color: 'rgba(55,56,60,0.61)',
              marginBottom: 6,
            }}>
              템플릿 이름
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && trimmed) {
                  e.preventDefault();
                  onConfirm(trimmed);
                }
              }}
              placeholder="예: 2026 여름 시즌"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 12px',
                fontSize: 13,
                color: '#171719',
                border: '1px solid #E1E2E4',
                borderRadius: 8,
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* 미리보기 박스 */}
          {preview.length > 0 && (
            <div style={{
              background: '#F7F7F8',
              border: '1px solid #E1E2E4',
              borderRadius: 8,
              padding: '10px 12px',
              marginBottom: 20,
            }}>
              {preview.map((label, i) => (
                <div key={i} style={{
                  fontSize: 12,
                  color: 'rgba(55,56,60,0.88)',
                  lineHeight: 1.6,
                }}>
                  · {label}
                </div>
              ))}
              {overflowCount > 0 && (
                <div style={{ fontSize: 12, color: 'rgba(55,56,60,0.45)', marginTop: 2 }}>
                  외 {overflowCount}개
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
          padding: '0 24px 20px',
        }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              background: '#ffffff',
              color: '#37383C',
              border: '1px solid #E1E2E4',
              borderRadius: 8,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => trimmed && onConfirm(trimmed)}
            disabled={!trimmed}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              background: trimmed ? '#185FA5' : '#E1E2E4',
              color: trimmed ? '#ffffff' : 'rgba(55,56,60,0.28)',
              border: 'none',
              borderRadius: 8,
              cursor: trimmed ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              transition: 'background 0.15s ease',
            }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
