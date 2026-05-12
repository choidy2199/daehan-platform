'use client';

import { useEffect, useRef, useState } from 'react';
import { Trash2, Image as ImageIcon } from 'lucide-react';

export type PricingItem = {
  id: number;
  draft_no: string;
  sort_order: number;
  source_code: string | null;
  management_code: string | null;
  category: string | null;
  name: string | null;
  spec: string | null;
  photo_url: string | null;
  cost: number | null;
  price_a: number | null;
  price_b: number | null;
  price_c: number | null;
  price_market: number | null;
  gift_id: number | null;
  gift_type: string | null;
  gift_percent: number | null;
  remark: string | null;
};

interface Props {
  draftNo: string;
  items: PricingItem[];
  onPatched: (updated: PricingItem) => void;
  onDeleted: (deletedId: number) => void;
}

type EditableField = 'management_code' | 'price_a' | 'price_b' | 'price_c' | 'price_market' | 'remark';
const PRICE_FIELDS: EditableField[] = ['price_a', 'price_b', 'price_c', 'price_market'];

const STORAGE_KEY = 'pricing-body-column-widths';
const DEFAULT_WIDTHS = [36, 42, 90, 96, 140, 140, 78, 78, 78, 78, 78, 60, 120, 36];

export default function PricingBodyTable({ draftNo, items, onPatched, onDeleted }: Props) {
  const [editingCell, setEditingCell] = useState<{ id: number; field: EditableField } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [colWidths, setColWidths] = useState<number[]>(DEFAULT_WIDTHS);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resizingRef = useRef<{ colIdx: number; startX: number; startW: number } | null>(null);
  const isFirstWidthsRender = useRef(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === DEFAULT_WIDTHS.length) {
          setColWidths(parsed);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (isFirstWidthsRender.current) {
      isFirstWidthsRender.current = false;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(colWidths));
    } catch {}
  }, [colWidths]);

  function handleResizeMove(e: MouseEvent) {
    if (!resizingRef.current) return;
    const { colIdx, startX, startW } = resizingRef.current;
    const delta = e.clientX - startX;
    const next = Math.max(40, Math.min(600, startW + delta));
    setColWidths((prev) => {
      if (prev[colIdx] === next) return prev;
      const arr = [...prev];
      arr[colIdx] = next;
      return arr;
    });
  }

  function handleResizeEnd() {
    resizingRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', handleResizeMove);
    window.removeEventListener('mouseup', handleResizeEnd);
  }

  function handleResizeStart(e: React.MouseEvent, colIdx: number) {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = {
      colIdx,
      startX: e.clientX,
      startW: colWidths[colIdx],
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeEnd);
  }

  function renderTh(idx: number, label: string, extra: React.CSSProperties = {}) {
    const isLast = idx === colWidths.length - 1;
    return (
      <th style={{
        ...thStyle,
        ...extra,
        position: 'relative',
        borderRight: isLast ? undefined : '0.5px solid #EEF0F3',
        whiteSpace: 'nowrap',
      }}>
        {label}
        {!isLast && (
          <div
            onMouseDown={(e) => handleResizeStart(e, idx)}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: 4,
              cursor: 'col-resize',
              userSelect: 'none',
              zIndex: 1,
            }}
          />
        )}
      </th>
    );
  }

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  function startEdit(item: PricingItem, field: EditableField) {
    if (editingCell) {
      // 다른 셀 편집 중이면 먼저 저장 시도
      commitEdit();
    }
    const v = item[field];
    setEditValue(v == null ? '' : String(v));
    setEditingCell({ id: item.id, field });
  }

  async function commitEdit() {
    if (!editingCell) return;
    const { id, field } = editingCell;
    const raw = editValue.trim();

    let value: string | number | null;
    if (field === 'management_code' || field === 'remark') {
      value = raw === '' ? null : raw;
    } else {
      if (raw === '') {
        value = null;
      } else {
        const num = Number(raw.replace(/,/g, ''));
        if (!Number.isFinite(num)) {
          alert('숫자를 입력해 주세요');
          return;
        }
        value = num;
      }
    }

    const current = items.find((it) => it.id === id);
    if (current && current[field] === value) {
      setEditingCell(null);
      return;
    }

    try {
      const res = await fetch(`/api/import-pricing/drafts/${encodeURIComponent(draftNo)}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, field, value }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(`저장 실패: ${json.error}`);
        return;
      }
      onPatched(json.data);
      setEditingCell(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '네트워크 오류';
      alert(`저장 실패: ${msg}`);
    }
  }

  function cancelEdit() {
    setEditingCell(null);
    setEditValue('');
  }

  async function confirmDelete() {
    if (deleteTargetId == null) return;
    const id = deleteTargetId;
    try {
      const res = await fetch(`/api/import-pricing/drafts/${encodeURIComponent(draftNo)}/items`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(`삭제 실패: ${json.error}`);
        return;
      }
      onDeleted(id);
      setDeleteTargetId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '네트워크 오류';
      alert(`삭제 실패: ${msg}`);
    }
  }

  const fmtNum = (n: number | null) =>
    n == null ? '' : n.toLocaleString();

  function renderEditableCell(item: PricingItem, field: EditableField) {
    const isEditing = editingCell?.id === item.id && editingCell.field === field;
    const isPrice = PRICE_FIELDS.includes(field);
    const val = item[field];
    const isEmpty = val == null || val === '';

    if (isEditing) {
      return (
        <td
          style={{
            ...tdStyle,
            background: '#FFFFFF',
            padding: 0,
          }}
        >
          <input
            ref={inputRef}
            className="pricing-body-input"
            type={isPrice ? 'number' : 'text'}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitEdit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
              }
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#185FA5';
              e.currentTarget.style.boxShadow = '0 0 0 3px #E6F1FB';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#DDE1EB';
              e.currentTarget.style.boxShadow = 'none';
              commitEdit();
            }}
            style={{
              width: '100%',
              minWidth: 0,
              height: 36,
              padding: '0 10px',
              border: '1px solid #DDE1EB',
              borderRadius: 6,
              fontSize: 13,
              fontFamily: 'inherit',
              textAlign: 'center',
              color: '#1A1D23',
              outline: 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              boxSizing: 'border-box',
              background: '#FFFFFF',
            }}
          />
        </td>
      );
    }

    const monoStyle: React.CSSProperties = field === 'management_code'
      ? { fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 10 }
      : {};

    return (
      <td
        onClick={() => startEdit(item, field)}
        style={{
          ...tdStyle,
          ...monoStyle,
          background: '#FFFEF7',
          cursor: 'pointer',
        }}
      >
        {isEmpty ? (
          field === 'remark' ? (
            <span style={{ color: '#9BA3B2', fontStyle: 'italic' }}>클릭하여 입력</span>
          ) : (
            <span style={{ color: '#9BA3B2' }}>—</span>
          )
        ) : isPrice ? (
          fmtNum(val as number)
        ) : (
          String(val)
        )}
      </td>
    );
  }

  return (
    <>
      <style>{`
        .pricing-body-input[type=number]::-webkit-inner-spin-button,
        .pricing-body-input[type=number]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .pricing-body-input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>
      <div style={{
        border: '0.5px solid #DDE1EB',
        borderTop: 'none',
        borderRadius: '0 0 8px 8px',
        overflow: 'hidden',
        background: '#FFFFFF',
        fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
            fontSize: 13,
            fontVariantNumeric: 'tabular-nums',
          }}>
            <colgroup>
              {colWidths.map((w, i) => (
                <col key={i} style={{ width: `${w}px` }} />
              ))}
            </colgroup>
            <thead>
              <tr style={{ background: '#EAECF2', color: '#5A6070' }}>
                {renderTh(0, '#')}
                {renderTh(1, '사진')}
                {renderTh(2, '관리코드')}
                {renderTh(3, '분류')}
                {renderTh(4, '품명')}
                {renderTh(5, '규격')}
                {renderTh(6, '원가')}
                {renderTh(7, '가격A')}
                {renderTh(8, '가격B')}
                {renderTh(9, '가격C')}
                {renderTh(10, '시장가')}
                {renderTh(11, '선물')}
                {renderTh(12, '비고')}
                {renderTh(13, '')}
              </tr>
            </thead>
            <tbody>
              {items.map((it, rowIdx) => {
                const isEditingRow = editingCell?.id === it.id;
                const baseBg = rowIdx % 2 === 1 ? '#FAFBFC' : '#FFFFFF';
                return (
                  <tr
                    key={it.id}
                    style={{
                      borderBottom: '1px solid #F0F2F7',
                      background: baseBg,
                    }}
                    onMouseEnter={(e) => {
                      if (!isEditingRow) (e.currentTarget as HTMLTableRowElement).style.background = '#F4F6FA';
                    }}
                    onMouseLeave={(e) => {
                      if (!isEditingRow) (e.currentTarget as HTMLTableRowElement).style.background = baseBg;
                    }}
                  >
                    <td style={{ ...tdStyle, color: '#9BA3B2' }}>
                      {it.sort_order + 1}
                    </td>
                    <td style={tdStyle}>
                      {it.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.photo_url}
                          alt=""
                          style={{ width: 26, height: 26, objectFit: 'cover', borderRadius: 3 }}
                        />
                      ) : (
                        <div style={{
                          width: 26, height: 26, background: '#D3D1C7', borderRadius: 3,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          color: '#FFFFFF',
                        }}>
                          <ImageIcon size={13} />
                        </div>
                      )}
                    </td>
                    {renderEditableCell(it, 'management_code')}
                    <td style={{ ...tdStyle, color: '#5F5E5A' }}>{it.category || ''}</td>
                    <td style={tdStyle}>{it.name || ''}</td>
                    <td style={{ ...tdStyle, color: '#5F5E5A' }}>{it.spec || ''}</td>
                    <td style={tdStyle}>
                      {it.cost == null ? (
                        <span style={{ color: '#9BA3B2' }}>—</span>
                      ) : fmtNum(it.cost)}
                    </td>
                    {renderEditableCell(it, 'price_a')}
                    {renderEditableCell(it, 'price_b')}
                    {renderEditableCell(it, 'price_c')}
                    {renderEditableCell(it, 'price_market')}
                    <td style={{ ...tdStyle, color: '#9BA3B2' }}>—</td>
                    {renderEditableCell(it, 'remark')}
                    <td style={tdStyle}>
                      <button
                        type="button"
                        onClick={() => setDeleteTargetId(it.id)}
                        title="삭제"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#C44545',
                          cursor: 'pointer',
                          padding: 2,
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#7A1F1F'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#C44545'; }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 관리코드 셀 모노스페이스 폰트 별도 적용은 인라인 스타일 한계로 별도 클래스 대신
          렌더 시 className 사용. lucide-react만 있고 별도 CSS 추가는 작업 범위 밖이므로
          관리코드 셀은 위 renderEditableCell에서 inline 스타일로 처리 */}

      {deleteTargetId != null && (
        <div
          onClick={() => setDeleteTargetId(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10001, fontFamily: "'Pretendard', -apple-system, sans-serif",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#FFFFFF', borderRadius: 8, padding: '20px 24px',
              minWidth: 320, boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            }}
          >
            <div style={{ fontSize: 14, color: '#1A1D23', marginBottom: 18 }}>
              이 제품을 책정안에서 삭제할까요?
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                style={{
                  padding: '7px 16px', background: '#FFFFFF', color: '#5A6070',
                  border: '1px solid #DDE1EB', borderRadius: 6, fontSize: 13,
                  fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
                }}
              >취소</button>
              <button
                type="button"
                onClick={confirmDelete}
                style={{
                  padding: '7px 18px', background: '#C44545', color: '#FFFFFF',
                  border: 'none', borderRadius: 6, fontSize: 13,
                  fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
                }}
              >삭제</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'center',
  fontSize: 12,
  fontWeight: 600,
  borderBottom: '1px solid #DDE1EB',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'center',
  fontSize: 13,
  color: '#1A1D23',
  verticalAlign: 'middle',
  borderRight: '0.5px solid #EEF0F3',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
