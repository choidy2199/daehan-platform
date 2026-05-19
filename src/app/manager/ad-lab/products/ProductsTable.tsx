'use client';

import { useRef } from 'react';
import type { ProductRow } from './types';
import { calcMargin } from './calcMargin';
import { breakEvenRoas } from './breakEvenRoas';
import { useFeeRate } from './useFeeRate';
import { useColumnWidths, type ColumnKey } from './useColumnWidths';
import { ResizableHeader } from './ResizableHeader';

const CHECKBOX_WIDTH = 36;

const COLUMNS: { key: ColumnKey; label: string; align: 'left' | 'right' | 'center' }[] = [
  { key: 'model', label: '모델·코드', align: 'left' },
  { key: 'cost', label: '원가', align: 'right' },
  { key: 'priceNaver', label: '판매가', align: 'right' },
  { key: 'marginRate', label: '마진율', align: 'right' },
  { key: 'breakEvenRoas', label: '손익분기 ROAS', align: 'right' },
  { key: 'actualRoas', label: '실제 ROAS', align: 'right' },
  { key: 'bid', label: '입찰가', align: 'right' },
  { key: 'budget', label: '일 한도', align: 'right' },
  { key: 'automation', label: '자동화', align: 'center' },
  { key: 'status', label: '상태', align: 'center' },
];

function measureColumnAutoWidth(
  colIndex: number,
  tableEl: HTMLTableElement | null
): number {
  if (!tableEl) return 100;
  const rows = tableEl.querySelectorAll('tbody tr');
  let maxWidth = 0;
  rows.forEach(row => {
    const cell = row.children[colIndex] as HTMLElement | undefined;
    if (!cell) return;
    const w = cell.scrollWidth;
    if (w > maxWidth) maxWidth = w;
  });
  return Math.max(40, Math.ceil(maxWidth + 24));
}

function formatWon(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString() + '원';
}

function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return '—';
  return value.toFixed(digits) + '%';
}

function marginClass(rate: number | null | undefined): string {
  if (rate == null) return 'al-c-dash';
  if (rate < 10) return 'al-c-margin-low';
  if (rate < 25) return 'al-c-margin-mid';
  return 'al-c-margin-high';
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === 'ELIGIBLE';
  return (
    <span className={`al-bd ${isActive ? 'al-bd-on' : 'al-bd-off'}`}>
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

const TOTAL_COL_COUNT = COLUMNS.length + 1; // checkbox + 10

export function ProductsTable(props: ProductsTableProps) {
  const { rows, totalCount, matchedCount, unmatchedCount, loading, error, page, setPage, pageSize, totalPages } = props;
  const { feeRate } = useFeeRate();
  const { widths, ratios, setColumnWidth, minWidth } = useColumnWidths();
  const tableRef = useRef<HTMLTableElement>(null);

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
        <table ref={tableRef} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: CHECKBOX_WIDTH }} />
            {COLUMNS.map(c => {
              const px = widths[c.key];
              const style = px != null
                ? { width: `${px}px` }
                : { width: `${ratios[c.key]}%` };
              return <col key={c.key} style={style} />;
            })}
          </colgroup>
          <thead>
            <tr className="al-thead-row">
              <th
                className="al-th"
                style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 500, fontSize: 12 }}
              >
                ☐
              </th>
              {COLUMNS.map((c, i) => (
                <ResizableHeader
                  key={c.key}
                  columnKey={c.key}
                  onResize={(px) => setColumnWidth(c.key, px)}
                  onAutoFit={() => {
                    const measured = measureColumnAutoWidth(i + 1, tableRef.current);
                    setColumnWidth(c.key, measured);
                  }}
                  minWidth={minWidth}
                  thProps={{
                    className: 'al-th',
                    style: {
                      padding: '8px 10px',
                      textAlign: c.align,
                      fontWeight: 500,
                      fontSize: 12,
                    },
                  }}
                >
                  {c.label}
                </ResizableHeader>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={TOTAL_COL_COUNT} className="al-c-dash" style={{ padding: 24 }}>
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
                  className={row.matched ? '' : 'row-unmatched'}
                  onClick={() => console.log('Row clicked:', row.id)}
                  style={{
                    borderBottom: '0.5px solid #F3F4F6',
                    borderLeft: '2px solid transparent',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderLeftColor = '#185FA5'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderLeftColor = 'transparent'; }}
                >
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <input type="checkbox" onClick={e => e.stopPropagation()} />
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <div className="al-c-model">
                      {row.matched ? row.model : '매칭 실패'}
                      {!row.matched && (
                        <span className="al-bd al-bd-unmatched" style={{ marginLeft: 4 }}>미매칭</span>
                      )}
                    </div>
                    <div
                      className={row.matched ? 'al-c-code' : 'al-c-code-unmatched'}
                      style={{ marginTop: 2 }}
                    >
                      {row.matched
                        ? `${row.product_code ?? '—'} · ${row.campaign_name ?? '캠페인 없음'}`
                        : (row.campaign_name ?? '캠페인 없음')}
                    </div>
                  </td>
                  <td className="al-c-price" style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatWon(row.cost)}</td>
                  <td className="al-c-price" style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatWon(row.priceNaver)}</td>
                  <td className={marginClass(margin?.rate ?? null)} style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatPercent(margin?.rate ?? null)}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                    {roas === null ? <span className="al-c-dash">—</span> : (
                      <>
                        <div className="al-c-roas-need" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {roas.toFixed(0)}%
                        </div>
                        <div className="al-c-roas-hint" style={{ marginTop: 2 }}>
                          1원 → {(roas / 100).toFixed(1)}원 필요
                        </div>
                      </>
                    )}
                  </td>
                  <td className="al-c-roas-empty" style={{ padding: '6px 10px', textAlign: 'right' }}>—</td>
                  <td className="al-c-bid" style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatWon(row.bid_amt)}</td>
                  <td className="al-c-budget" style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatWon(row.daily_budget_limit)}</td>
                  <td className="al-c-dash" style={{ padding: '6px 10px' }}>—</td>
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

      <style>{`
        .al-thead-row { background: #2C2C2A; }
        .al-th {
          color: #FFFFFF;
          border-right: 0.5px solid #444441;
          position: relative;
        }
        .al-th:last-child { border-right: none; }

        .al-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          width: 6px;
          height: 100%;
          cursor: col-resize;
          z-index: 2;
          background: transparent;
          transition: background 0.1s ease;
          user-select: none;
        }
        .al-resize-handle:hover { background: #185FA5; }

        .al-c-model { color: #1A1D23; font-weight: 500; }
        .al-c-code { color: #5F5E5A; font-size: 11px; }
        .al-c-code-unmatched { color: #791F1F; font-size: 11px; }

        .al-c-price { color: #1A1D23; font-weight: 500; }

        .al-c-margin-low { color: #791F1F; font-weight: 500; }
        .al-c-margin-mid { color: #854F0B; font-weight: 500; }
        .al-c-margin-high { color: #27500A; font-weight: 500; }

        .al-c-roas-need { color: #185FA5; font-weight: 500; }
        .al-c-roas-hint { color: #5F5E5A; font-size: 10px; }
        .al-c-roas-actual { color: #1A1D23; font-weight: 500; }
        .al-c-roas-empty { color: #5F5E5A; }

        .al-c-bid { color: #3C3489; }
        .al-c-budget { color: #5F5E5A; }

        .al-c-source-mw { color: #185FA5; font-size: 11px; }
        .al-c-source-gn { color: #27500A; font-size: 11px; }

        .al-c-dash { color: #5F5E5A; text-align: center; }

        .al-bd {
          display: inline-block;
          padding: 2px 10px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 500;
        }
        .al-bd-on { background: #185FA5; color: #FFFFFF; }
        .al-bd-off { background: #5F5E5A; color: #FFFFFF; }
        .al-bd-auto-on { background: #3C3489; color: #FFFFFF; }
        .al-bd-unmatched { background: #791F1F; color: #FFFFFF; }

        tr:hover td { background: #FAFAF8; }
        .row-unmatched td { background: #FCEBEB; }
        .row-unmatched:hover td { background: #F9DDDD; }
      `}</style>
    </div>
  );
}
