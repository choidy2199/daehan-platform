'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useDebounce } from '../lib/useDebounce';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
  existingGenProductIds: Set<string>;
}

interface GenProduct {
  code: string;
  model: string;
  description: string;
  manageCode: string;
  category: string;
  cost: number;
}

export function ImportModal({ isOpen, onClose, onImported, existingGenProductIds }: ImportModalProps) {
  const [products, setProducts] = useState<GenProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchTerm, 300);

  // mount 시 1회 fetch
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase
          .from('app_data')
          .select('value')
          .eq('key', 'mw_gen_products')
          .single();
        if (cancelled) return;
        if (err) throw new Error('제품 마스터 로드 실패');
        const arr = (data?.value ?? []) as GenProduct[];
        setProducts(arr);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? '알 수 없는 에러');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  // 모달 열릴 때 상태 초기화
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedCodes(new Set());
      setError(null);
    }
  }, [isOpen]);

  // ESC 키
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, isSaving, onClose]);

  // 검색 필터
  const filteredProducts = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      (p.model ?? '').toLowerCase().includes(q) ||
      (p.description ?? '').toLowerCase().includes(q) ||
      (p.manageCode ?? '').toLowerCase().includes(q) ||
      (p.code ?? '').toLowerCase().includes(q)
    );
  }, [products, debouncedSearch]);

  // 책정 안 된 것만 선택 가능
  const selectableInFiltered = useMemo(
    () => filteredProducts.filter(p => !existingGenProductIds.has(String(p.code))),
    [filteredProducts, existingGenProductIds]
  );

  const allSelected = selectableInFiltered.length > 0 &&
    selectableInFiltered.every(p => selectedCodes.has(p.code));

  const toggleOne = (code: string) => {
    setSelectedCodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedCodes(prev => {
      const next = new Set(prev);
      if (allSelected) {
        for (const p of selectableInFiltered) next.delete(p.code);
      } else {
        for (const p of selectableInFiltered) next.add(p.code);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedCodes.size === 0) return;
    setIsSaving(true);
    setError(null);
    try {
      const payload = Array.from(selectedCodes).map(code => ({
        gen_product_id: parseInt(code, 10),
      }));
      const { error: err } = await supabase
        .from('import_pricing_items')
        .insert(payload);
      if (err) throw new Error(err.message ?? '추가 실패');
      onImported();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? '알 수 없는 에러');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackdropClick = () => {
    if (!isSaving) onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: 12,
          width: 900,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: '80vh',
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
          background: '#DEE1E4',
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#171719' }}>제품 가져오기</span>
          <button
            type="button"
            onClick={() => { if (!isSaving) onClose(); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 18, color: 'rgba(55,56,60,0.61)', lineHeight: 1, padding: 4,
            }}
          >✕</button>
        </div>

        {/* 검색 */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid #E1E2E4',
          flexShrink: 0,
        }}>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="품명, 규격, 관리코드, 코드로 검색"
            autoComplete="off"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #E1E2E4',
              borderRadius: 6,
              fontSize: 13,
              fontFamily: 'inherit',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>

        {/* 테이블 */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 20px',
        }}>
          {isLoading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'rgba(55,56,60,0.61)' }}>
              제품 목록 불러오는 중...
            </div>
          ) : (
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 13,
            }}>
              <thead style={{ position: 'sticky', top: 0, background: '#F4F5F6', zIndex: 1 }}>
                <tr>
                  <th style={thStyle('center', 40)}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      disabled={selectableInFiltered.length === 0}
                    />
                  </th>
                  <th style={thStyle('left')}>관리코드</th>
                  <th style={thStyle('left')}>카테고리</th>
                  <th style={thStyle('left')}>품명</th>
                  <th style={thStyle('left')}>규격</th>
                  <th style={thStyle('right')}>원가</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(p => {
                  const isExisting = existingGenProductIds.has(String(p.code));
                  const isChecked = selectedCodes.has(p.code);
                  return (
                    <tr
                      key={p.code}
                      style={{
                        borderBottom: '1px solid #F0F1F3',
                        opacity: isExisting ? 0.5 : 1,
                      }}
                    >
                      <td style={tdStyle('center')}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isExisting}
                          onChange={() => toggleOne(p.code)}
                        />
                      </td>
                      <td style={tdStyle('left')}>{p.manageCode ?? ''}</td>
                      <td style={tdStyle('left')}>
                        {p.category ?? ''}
                        {isExisting && (
                          <span style={{
                            marginLeft: 6,
                            fontSize: 10,
                            background: '#EAEBEC',
                            color: 'rgba(55,56,60,0.61)',
                            borderRadius: 4,
                            padding: '1px 6px',
                          }}>추가됨</span>
                        )}
                      </td>
                      <td style={tdStyle('left')}>{p.model ?? ''}</td>
                      <td style={tdStyle('left')}>{p.description ?? ''}</td>
                      <td style={tdStyle('right')}>{(p.cost ?? 0).toLocaleString()}</td>
                    </tr>
                  );
                })}
                {filteredProducts.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px 0', textAlign: 'center', color: 'rgba(55,56,60,0.61)' }}>
                      검색 결과가 없습니다
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* 에러 */}
        {error && (
          <div style={{
            padding: '8px 20px',
            background: '#FDECEA',
            color: '#C83B38',
            fontSize: 12,
            borderTop: '1px solid #E1E2E4',
            flexShrink: 0,
          }}>{error}</div>
        )}

        {/* 푸터 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px',
          borderTop: '1px solid #E1E2E4',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, color: 'rgba(55,56,60,0.61)' }}>
            선택된 {selectedCodes.size}개
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => { if (!isSaving) onClose(); }}
              disabled={isSaving}
              style={{
                background: '#ffffff', color: '#37383C',
                border: '1px solid #E1E2E4', borderRadius: 6,
                padding: '7px 16px', fontSize: 13, fontWeight: 500,
                fontFamily: 'inherit',
                cursor: isSaving ? 'not-allowed' : 'pointer',
              }}
            >취소</button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={selectedCodes.size === 0 || isSaving}
              style={{
                background: selectedCodes.size === 0 || isSaving ? '#9CB4CC' : '#185FA5',
                color: '#ffffff',
                border: 'none', borderRadius: 6,
                padding: '7px 16px', fontSize: 13, fontWeight: 500,
                fontFamily: 'inherit',
                cursor: selectedCodes.size === 0 || isSaving ? 'not-allowed' : 'pointer',
              }}
            >
              {isSaving ? '추가 중...' : `선택 ${selectedCodes.size}개 추가`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function thStyle(align: 'left' | 'right' | 'center', width?: number): React.CSSProperties {
  return {
    padding: '8px 10px',
    textAlign: align,
    fontSize: 12,
    fontWeight: 600,
    color: 'rgba(55,56,60,0.61)',
    borderBottom: '1px solid #E1E2E4',
    background: '#F4F5F6',
    whiteSpace: 'nowrap',
    width,
  };
}

function tdStyle(align: 'left' | 'right' | 'center'): React.CSSProperties {
  return {
    padding: '8px 10px',
    textAlign: align,
    fontSize: 13,
    color: '#1A1D23',
    whiteSpace: 'nowrap',
  };
}
