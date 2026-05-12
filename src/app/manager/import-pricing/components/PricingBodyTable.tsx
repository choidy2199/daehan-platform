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

export default function PricingBodyTable({ draftNo, items, onPatched, onDeleted }: Props) {
  const [editingCell, setEditingCell] = useState<{ id: number; field: EditableField } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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

  function renderEditableCell(item: PricingItem, field: EditableField, align: 'left' | 'right' = 'right') {
    const isEditing = editingCell?.id === item.id && editingCell.field === field;
    const isPrice = PRICE_FIELDS.includes(field);
    const val = item[field];
    const isEmpty = val == null || val === '';

    if (isEditing) {
      return (
        <td
          style={{
            ...tdStyle,
            textAlign: align,
            background: '#FFFFFF',
            padding: 0,
          }}
        >
          <input
            ref={inputRef}
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
            onBlur={commitEdit}
            style={{
              width: '100%',
              height: 26,
              padding: '0 8px',
              border: '1px solid #185FA5',
              borderRadius: 2,
              fontSize: 11,
              fontFamily: 'inherit',
              textAlign: align,
              outline: 'none',
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
          textAlign: align,
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
      <div style={{
        border: '0.5px solid #DDE1EB',
        borderTop: 'none',
        borderRadius: '0 0 8px 8px',
        overflow: 'hidden',
        background: '#FFFFFF',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 11,
            fontVariantNumeric: 'tabular-nums',
          }}>
            <colgroup>
              <col style={{ width: 36 }} />
              <col style={{ width: 42 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 96 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 78 }} />
              <col style={{ width: 78 }} />
              <col style={{ width: 78 }} />
              <col style={{ width: 78 }} />
              <col style={{ width: 78 }} />
              <col style={{ width: 60 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 36 }} />
            </colgroup>
            <thead>
              <tr style={{ background: '#F1EFE8', color: '#444441' }}>
                <th style={{ ...thStyle, textAlign: 'center' }}>#</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>사진</th>
                <th style={{ ...thStyle, color: '#185FA5' }}>관리코드</th>
                <th style={thStyle}>분류</th>
                <th style={thStyle}>품명</th>
                <th style={thStyle}>규격</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>원가</th>
                <th style={{ ...thStyle, textAlign: 'right', color: '#185FA5' }}>가격A</th>
                <th style={{ ...thStyle, textAlign: 'right', color: '#185FA5' }}>가격B</th>
                <th style={{ ...thStyle, textAlign: 'right', color: '#185FA5' }}>가격C</th>
                <th style={{ ...thStyle, textAlign: 'right', color: '#185FA5' }}>시장가</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>선물</th>
                <th style={{ ...thStyle, color: '#185FA5' }}>비고</th>
                <th style={{ ...thStyle, textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const isEditingRow = editingCell?.id === it.id;
                return (
                  <tr
                    key={it.id}
                    style={{
                      borderBottom: '0.5px solid #EEF0F3',
                      background: '#FFFFFF',
                    }}
                    onMouseEnter={(e) => {
                      if (!isEditingRow) (e.currentTarget as HTMLTableRowElement).style.background = '#F4F6FA';
                    }}
                    onMouseLeave={(e) => {
                      if (!isEditingRow) (e.currentTarget as HTMLTableRowElement).style.background = '#FFFFFF';
                    }}
                  >
                    <td style={{ ...tdStyle, textAlign: 'center', color: '#9BA3B2' }}>
                      {it.sort_order + 1}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
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
                    {renderEditableCell(it, 'management_code', 'left')}
                    <td style={{ ...tdStyle, color: '#5F5E5A' }}>{it.category || ''}</td>
                    <td style={tdStyle}>{it.name || ''}</td>
                    <td style={{ ...tdStyle, color: '#5F5E5A' }}>{it.spec || ''}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {it.cost == null ? (
                        <span style={{ color: '#9BA3B2' }}>—</span>
                      ) : fmtNum(it.cost)}
                    </td>
                    {renderEditableCell(it, 'price_a', 'right')}
                    {renderEditableCell(it, 'price_b', 'right')}
                    {renderEditableCell(it, 'price_c', 'right')}
                    {renderEditableCell(it, 'price_market', 'right')}
                    <td style={{ ...tdStyle, textAlign: 'center', color: '#9BA3B2' }}>—</td>
                    {renderEditableCell(it, 'remark', 'left')}
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
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
  padding: '7px 8px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 500,
  borderBottom: '0.5px solid #DDE1EB',
};

const tdStyle: React.CSSProperties = {
  padding: '5px 8px',
  fontSize: 11,
  color: '#1A1D23',
  verticalAlign: 'middle',
};
