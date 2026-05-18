'use client';

import type { ProductRow } from './types';
import { calcMargin } from './calcMargin';
import { breakEvenRoas } from './breakEvenRoas';
import { useFeeRate } from './useFeeRate';

function formatWon(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString() + '원';
}

function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return '—';
  return value.toFixed(digits) + '%';
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === 'ELIGIBLE';
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 12,
      background: isActive ? '#EAF3DE' : '#F1EFE8',
      color: isActive ? '#3B6D11' : '#5F5E5A',
      fontSize: 11,
      fontWeight: 500,
    }}>
      {isActive ? 'ON' : 'OFF'}
    </span>
  );
}

interface ProductsTableProps {
  rows: ProductRow[];
  totalCount: number;
  matchedCount: number;
  unmatchedCount: number;
  loading: boolean;
  error: string | null;
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  totalPages: number;
}

const COLS: { label: string; width: number; align: 'left' | 'right' | 'center' }[] = [
  { label: '☐', width: 36, align: 'center' },
  { label: '모델·코드', width: 180, align: 'left' },
  { label: '원가', width: 90, align: 'right' },
  { label: '판매가', width: 90, align: 'right' },
  { label: '마진율', width: 80, align: 'right' },
  { label: '손익분기 ROAS', width: 110, align: 'right' },
  { label: '실제 ROAS', width: 100, align: 'right' },
  { label: '입찰가', width: 90, align: 'right' },
  { label: '일 한도', width: 100, align: 'right' },
  { label: '자동화', width: 80, align: 'center' },
  { label: '상태', width: 80, align: 'center' },
];

export function ProductsTable(props: ProductsTableProps) {
  const { rows, totalCount, matchedCount, unmatchedCount, loading, error, page, setPage, pageSize, totalPages } = props;
  const { feeRate } = useFeeRate();

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);

  return (
    <div className="al-products-table" style={{ fontSize: 13 }}>
      <div className="al-summary" style={{ display: 'flex', gap: 16, padding: '8px 12px', color: '#374151' }}>
        <span>전체 {totalCount}</span>
        <span>매칭 {matchedCount}</span>
        <span>미매칭 {unmatchedCount}</span>
        <span style={{ marginLeft: 'auto' }}>페이지 {page} / {totalPages} · {pageSize}건</span>
      </div>

      {loading && <div style={{ padding: 12, color: '#6B7280' }}>로딩 중...</div>}
      {error && <div style={{ padding: 12, color: '#DC2626' }}>에러: {error}</div>}

      <div style={{ overflowX: 'auto', border: '0.5px solid #E5E7EB', borderRadius: 4 }}>
        <table style={{ width: 1036, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            {COLS.map((c, i) => <col key={i} style={{ width: c.width }} />)}
          </colgroup>
          <thead>
            <tr style={{ background: '#F5F5F5', borderBottom: '0.5px solid #E5E7EB' }}>
              {COLS.map((c, i) => (
                <th
                  key={i}
                  style={{
                    padding: '8px 10px',
                    textAlign: c.align,
                    fontWeight: 600,
                    fontSize: 12,
                    color: '#374151',
                    borderRight: i < COLS.length - 1 ? '0.5px solid #E5E7EB' : 'none',
                  }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={COLS.length} style={{ padding: 24, textAlign: 'center', color: '#9CA3AF' }}>
                  데이터 없음
                </td>
              </tr>
            )}
            {rows.map(row => {
              const margin = (row.priceNaver != null && row.cost != null)
                ? calcMargin(row.priceNaver, row.cost, feeRate)
                : null;
              const roas = (row.priceNaver != null && row.cost != null)
                ? breakEvenRoas(row.priceNaver, row.cost, feeRate)
                : null;
              return (
                <tr
                  key={row.id}
                  onClick={() => console.log('Row clicked:', row.id)}
                  style={{
                    borderBottom: '0.5px solid #F3F4F6',
                    borderLeft: '2px solid transparent',
                    background: row.matched ? 'transparent' : '#FCEBEB',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderLeftColor = '#185FA5'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderLeftColor = 'transparent'; }}
                >
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <input type="checkbox" onClick={e => e.stopPropagation()} />
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <div style={{ fontWeight: 500, color: row.matched ? undefined : '#791F1F' }}>
                      {row.matched ? row.model : '매칭 실패'}
                      {!row.matched && (
                        <span style={{
                          display: 'inline-block',
                          marginLeft: 4,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: '#F09595',
                          color: '#501313',
                          fontSize: 10,
                          fontWeight: 500,
                        }}>미매칭</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: row.matched ? '#888780' : '#A32D2D', marginTop: 2 }}>
                      {row.matched
                        ? `${row.product_code ?? '—'} · ${row.campaign_name ?? '캠페인 없음'}`
                        : (row.campaign_name ?? '캠페인 없음')}
                    </div>
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatWon(row.cost)}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatWon(row.priceNaver)}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatPercent(margin?.rate ?? null)}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                    {roas === null ? '—' : (
                      <>
                        <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: '#444441' }}>
                          {roas.toFixed(0)}%
                        </div>
                        <div style={{ fontSize: 11, color: '#888780', marginTop: 2 }}>
                          1원 → {(roas / 100).toFixed(1)}원 필요
                        </div>
                      </>
                    )}
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', color: '#888780' }}>—</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatWon(row.bid_amt)}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatWon(row.daily_budget_limit)}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'center', color: '#888780' }}>—</td>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="al-pagination" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', fontSize: 12, color: '#374151' }}>
        <span style={{ marginRight: 'auto' }}>{rangeStart} ~ {rangeEnd} / {totalCount}</span>
        <button
          onClick={() => setPage(page - 1)}
          disabled={page <= 1}
          style={{ padding: '4px 10px', border: '0.5px solid #D1D5DB', background: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1 }}
        >
          ‹
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            onClick={() => setPage(n)}
            style={{
              padding: '4px 10px',
              border: '0.5px solid #D1D5DB',
              background: n === page ? '#185FA5' : '#fff',
              color: n === page ? '#fff' : '#374151',
              fontWeight: n === page ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {n}
          </button>
        ))}
        <button
          onClick={() => setPage(page + 1)}
          disabled={page >= totalPages}
          style={{ padding: '4px 10px', border: '0.5px solid #D1D5DB', background: '#fff', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1 }}
        >
          ›
        </button>
      </div>
    </div>
  );
}
