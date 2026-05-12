'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Search, Package, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type GenProduct = {
  code: string;
  manageCode?: string | null;
  category?: string;
  model?: string;
  description?: string;
  cost?: number;
  image_url?: string | null;
};

interface Props {
  isOpen: boolean;
  draftNo: string;
  draftName: string;
  onClose: () => void;
  onAdded: (count: number) => void;
}

export default function ProductPickerModal({ isOpen, draftNo, draftName, onClose, onAdded }: Props) {
  const [products, setProducts] = useState<GenProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery('');
    setSelectedCodes(new Set());
    setError(null);
    setLoading(true);
    supabase
      .from('app_data')
      .select('value')
      .eq('key', 'mw_gen_products')
      .single()
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message);
          setProducts([]);
        } else {
          const raw = data?.value;
          const arr: GenProduct[] = Array.isArray(raw) ? raw : [];
          setProducts(arr);
        }
        setLoading(false);
      });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, submitting, onClose]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      (p.code || '').toLowerCase().includes(q) ||
      (p.model || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  const allSelected = filtered.length > 0 && filtered.every((p) => selectedCodes.has(p.code));
  const someSelected = filtered.some((p) => selectedCodes.has(p.code));
  const indeterminate = someSelected && !allSelected;

  const toggleOne = (code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        filtered.forEach((p) => next.delete(p.code));
      } else {
        filtered.forEach((p) => next.add(p.code));
      }
      return next;
    });
  };

  const handleAdd = async () => {
    if (selectedCodes.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const selectedProducts = products.filter((p) => selectedCodes.has(p.code));
      const items = selectedProducts.map((p) => ({
        source_code: p.code,
        management_code: p.manageCode || null,
        category: p.category || null,
        name: p.model || null,
        spec: p.description || null,
        photo_url: p.image_url || null,
        cost: typeof p.cost === 'number' ? p.cost : null,
      }));

      const res = await fetch(`/api/import-pricing/drafts/${encodeURIComponent(draftNo)}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      onAdded(json.inserted_count ?? items.length);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={() => { if (!submitting) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10000, fontFamily: "'Pretendard', -apple-system, sans-serif",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF', borderRadius: 8, width: '100%', maxWidth: 620,
          display: 'flex', flexDirection: 'column', maxHeight: '80vh',
        }}
      >
        <div style={{
          background: '#1A1D23', color: '#FFFFFF',
          padding: '12px 18px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', borderRadius: '8px 8px 0 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Package size={16} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>일반단가표에서 제품 불러오기</span>
            {draftName && (
              <span style={{ fontSize: 11, color: '#9BA3B2', marginLeft: 8 }}>{draftName}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => { if (!submitting) onClose(); }}
            disabled={submitting}
            style={{
              background: 'transparent', border: 'none', color: '#FFFFFF',
              cursor: submitting ? 'not-allowed' : 'pointer', padding: 4,
              display: 'inline-flex', opacity: submitting ? 0.5 : 1,
            }}
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        <div style={{
          padding: '14px 18px', display: 'flex', alignItems: 'center',
          gap: 12, borderBottom: '0.5px solid #DDE1EB',
        }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', top: 11, left: 10, color: '#9BA3B2' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="코드 / 모델 / 설명 / 분류 검색"
              style={{
                width: '100%', height: 36, padding: '0 12px 0 32px',
                border: '1px solid #DDE1EB', borderRadius: 6, fontSize: 13,
                fontFamily: 'inherit', color: '#1A1D23', background: '#FFFFFF',
                boxSizing: 'border-box', outline: 'none',
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: '#5A6070', flexShrink: 0 }}>
            전체 {filtered.length}건 · 선택 {selectedCodes.size}건
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 200 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F1EFE8', color: '#444441' }}>
                <th style={{ ...thStyle, width: 36, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = indeterminate; }}
                    onChange={toggleAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ ...thStyle, width: 42, textAlign: 'center' }}>사진</th>
                <th style={{ ...thStyle, width: 90 }}>코드</th>
                <th style={{ ...thStyle, width: 96 }}>분류</th>
                <th style={{ ...thStyle }}>품명</th>
                <th style={{ ...thStyle, width: 84, textAlign: 'right' }}>원가</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#9BA3B2' }}>
                    불러오는 중…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#9BA3B2' }}>
                    {products.length === 0 ? '일반제품 데이터가 없습니다' : '검색 결과 없음'}
                  </td>
                </tr>
              )}
              {!loading && filtered.map((p) => {
                const isSel = selectedCodes.has(p.code);
                return (
                  <tr
                    key={p.code}
                    onClick={() => toggleOne(p.code)}
                    style={{
                      background: isSel ? '#E6F1FB' : '#FFFFFF',
                      cursor: 'pointer',
                      borderBottom: '0.5px solid #EEF0F4',
                    }}
                  >
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggleOne(p.code)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {p.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image_url}
                          alt=""
                          style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 4 }}
                        />
                      ) : (
                        <div style={{
                          width: 28, height: 28, background: '#D3D1C7', borderRadius: 4,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          color: '#FFFFFF',
                        }}>
                          <ImageIcon size={14} />
                        </div>
                      )}
                    </td>
                    <td style={{
                      ...tdStyle,
                      fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                      color: '#185FA5',
                    }}>{p.code}</td>
                    <td style={tdStyle}>{p.category || ''}</td>
                    <td style={tdStyle}>
                      <div style={{ fontSize: 12, color: '#1A1D23', lineHeight: 1.3 }}>
                        {p.model || ''}
                      </div>
                      {p.description && (
                        <div style={{ fontSize: 11, color: '#9BA3B2', lineHeight: 1.3 }}>
                          {p.description}
                        </div>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {typeof p.cost === 'number' ? p.cost.toLocaleString() : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {error && (
          <div style={{
            background: '#FCEBEB', color: '#791F1F', fontSize: 12,
            padding: '8px 18px', borderTop: '0.5px solid #F2D6D6',
          }}>{error}</div>
        )}

        <div style={{
          padding: '12px 18px', borderTop: '0.5px solid #DDE1EB',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 12, color: '#5A6070' }}>
            선택 {selectedCodes.size}건을 책정안에 추가합니다
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => { if (!submitting) onClose(); }}
              disabled={submitting}
              style={{
                padding: '8px 16px', background: '#FFFFFF', color: '#5A6070',
                border: '1px solid #DDE1EB', borderRadius: 6, fontSize: 13,
                fontWeight: 500, fontFamily: 'inherit',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.5 : 1,
              }}
            >취소</button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={selectedCodes.size === 0 || submitting}
              style={{
                padding: '8px 18px',
                background: selectedCodes.size === 0 || submitting ? '#9BA3B2' : '#185FA5',
                color: '#FFFFFF', border: 'none', borderRadius: 6, fontSize: 13,
                fontWeight: 500, fontFamily: 'inherit',
                cursor: selectedCodes.size === 0 || submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? '추가 중…' : `${selectedCodes.size}건 추가`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'left', fontSize: 12, fontWeight: 500,
  borderBottom: '0.5px solid #DDE1EB',
};

const tdStyle: React.CSSProperties = {
  padding: '6px 10px', fontSize: 12, color: '#1A1D23', verticalAlign: 'middle',
};
