'use client';

import type { CSSProperties } from 'react';
import { WholesaleCell, ChannelCell } from './PriceCell';
import { detectCategory, type ChannelFeeRates } from '../lib/feeCalc';
import type { ColumnDef } from '../lib/columnConfig';

export interface PricingRow {
  id: number;
  imgUrl?: string | null;
  code: string;
  manageCode: string;
  category: string;
  model: string;
  spec: string;
  stock: number;
  cost: number;
  priceA: number;
  priceB: number;
  priceC: number;
  priceNaver: number;
  priceCoupang: number;
  priceGmarket: number;
  priceSsg: number;
  inQty: number;
  outQty: number;
  pallet: number;
  overrideCategory?: 'powertool' | 'handtool' | null;
}

export interface PricingTableProps {
  rows: PricingRow[];
  rates: ChannelFeeRates | null;
  visibleCols: ColumnDef[];
}

// sticky 컬럼 left 오프셋 (photo→code→manageCode 순 고정값)
const STICKY_LEFT: Record<string, number> = { photo: 0, code: 44, manageCode: 104 };

export function PricingTable({ rows, rates, visibleCols }: PricingTableProps) {
  const lastStickyId = [...visibleCols].reverse().find(c => c.sticky)?.id;

  return (
    <div style={{
      overflowX: 'auto',
      border: '1px solid #E1E2E4',
      borderRadius: 12,
      background: '#ffffff',
    }}>
      <table style={{
        borderCollapse: 'separate',
        borderSpacing: 0,
        fontSize: 14,
        fontFamily: "'Pretendard', -apple-system, sans-serif",
        width: '100%',
      }}>
        <thead>
          <tr>
            {visibleCols.map(col => (
              <Th
                key={col.id}
                width={col.width}
                sep={col.sep}
                sticky={!!col.sticky}
                left={col.sticky ? STICKY_LEFT[col.sticky] : undefined}
                lastSticky={col.id === lastStickyId}
              >
                {col.header}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const category = detectCategory(row.category, row.overrideCategory);
            const prices = { cost: row.cost, priceA: row.priceA, priceB: row.priceB, priceC: row.priceC };
            return (
              <tr key={row.id}>
                {visibleCols.map(col =>
                  renderCell(col, row, category, prices, rates, col.id === lastStickyId)
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function renderCell(
  col: ColumnDef,
  row: PricingRow,
  category: 'powertool' | 'handtool',
  prices: { cost: number; priceA: number; priceB: number; priceC: number },
  rates: ChannelFeeRates | null,
  isLastSticky: boolean,
) {
  const stickyLeft = col.sticky ? STICKY_LEFT[col.sticky] : undefined;
  const base = { sep: col.sep, sticky: !!col.sticky, left: stickyLeft, lastSticky: isLastSticky };

  switch (col.id) {
    case 'photo':
      return (
        <Td key={col.id} {...base}>
          <div style={{
            width: 32, height: 32, background: '#EAF2FE', borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#0054D1', fontSize: 9.5,
          }}>IMG</div>
        </Td>
      );
    case 'code':
      return <Td key={col.id} {...base}>{row.code}</Td>;
    case 'manageCode':
      return <Td key={col.id} {...base}>{row.manageCode}</Td>;
    case 'category':
      return (
        <Td key={col.id} {...base}>
          <CategoryBadge category={category} text={row.category} />
        </Td>
      );
    case 'name':
      return <Td key={col.id} {...base}>{row.model}</Td>;
    case 'spec':
      return <Td key={col.id} {...base} style={{ color: 'rgba(55, 56, 60, 0.61)' }}>{row.spec}</Td>;
    case 'stock':
      return <Td key={col.id} {...base} center>{row.stock}</Td>;
    case 'cost':
      return (
        <Td key={col.id} {...base} style={{ textAlign: 'center', background: 'rgba(112, 115, 124, 0.05)' }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{row.cost.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: 'rgba(55, 56, 60, 0.28)', marginTop: 3 }}>기준</div>
        </Td>
      );
    case 'priceA':
      return <Td key={col.id} {...base}><WholesaleCell price={row.priceA} cost={row.cost} /></Td>;
    case 'priceB':
      return <Td key={col.id} {...base}><WholesaleCell price={row.priceB} cost={row.cost} /></Td>;
    case 'priceC':
      return <Td key={col.id} {...base}><WholesaleCell price={row.priceC} cost={row.cost} /></Td>;
    case 'storefarm':
      return (
        <Td key={col.id} {...base} noPadding>
          {rates && <ChannelCell price={row.priceNaver} channel="naver" category={category} rates={rates} prices={prices} />}
        </Td>
      );
    case 'coupang':
      return (
        <Td key={col.id} {...base} noPadding>
          {rates && <ChannelCell price={row.priceCoupang} channel="coupang_mp" category={category} rates={rates} prices={prices} />}
        </Td>
      );
    case 'openmarket':
      return (
        <Td key={col.id} {...base} noPadding>
          {rates && <ChannelCell price={row.priceGmarket} channel="gmarket" category={category} rates={rates} prices={prices} />}
        </Td>
      );
    case 'ssg':
      return (
        <Td key={col.id} {...base} noPadding>
          {rates && <ChannelCell price={row.priceSsg} channel="ssg" category={category} rates={rates} prices={prices} />}
        </Td>
      );
    case 'inStock':
      return <Td key={col.id} {...base} center>{row.inQty}</Td>;
    case 'outStock':
      return <Td key={col.id} {...base} center>{row.outQty}</Td>;
    case 'pallet':
      return <Td key={col.id} {...base} center>{row.pallet}</Td>;
    default:
      return null;
  }
}

// ============================================================
// 헬퍼 컴포넌트
// ============================================================
interface ThProps {
  children: React.ReactNode;
  width?: number;
  sticky?: boolean;
  left?: number;
  sep?: boolean;
  lastSticky?: boolean;
}

function Th({ children, width, sticky, left, sep, lastSticky }: ThProps) {
  return (
    <th style={{
      fontWeight: 600,
      fontSize: 12,
      color: 'rgba(55, 56, 60, 0.95)',
      background: '#DEE1E4',
      padding: '8px 6px',
      textAlign: 'center',
      borderBottom: '1px solid #EAEBEC',
      whiteSpace: 'nowrap',
      width: width ?? undefined,
      minWidth: width ?? undefined,
      position: sticky ? 'sticky' : undefined,
      left: sticky ? left : undefined,
      zIndex: sticky ? 11 : undefined,
      borderLeft: sep ? '1px solid #EAEBEC' : undefined,
      boxShadow: lastSticky ? '2px 0 4px -1px rgba(23, 23, 23, 0.06)' : undefined,
    }}>{children}</th>
  );
}

interface TdProps {
  children?: React.ReactNode;
  sticky?: boolean;
  left?: number;
  sep?: boolean;
  center?: boolean;
  noPadding?: boolean;
  lastSticky?: boolean;
  style?: CSSProperties;
}

function Td({ children, sticky, left, sep, center, noPadding, lastSticky, style }: TdProps) {
  return (
    <td style={{
      padding: noPadding ? 0 : '8px 6px',
      verticalAlign: 'middle',
      borderBottom: '1px solid #EAEBEC',
      fontSize: 14,
      color: '#171719',
      background: sticky ? '#ffffff' : undefined,
      position: sticky ? 'sticky' : undefined,
      left: sticky ? left : undefined,
      zIndex: sticky ? 10 : undefined,
      borderLeft: sep ? '1px solid #EAEBEC' : undefined,
      textAlign: center ? 'center' : undefined,
      boxShadow: lastSticky ? '2px 0 4px -1px rgba(23, 23, 23, 0.06)' : undefined,
      ...style,
    }}>{children}</td>
  );
}

function CategoryBadge({ category, text }: { category: 'powertool' | 'handtool'; text: string }) {
  const styles = category === 'powertool'
    ? { background: '#C1D9FC', color: '#0054D1' }
    : { background: 'rgba(0, 191, 64, 0.25)', color: '#009632' };

  return (
    <span style={{
      display: 'inline-block',
      fontSize: 12,
      fontWeight: 500,
      padding: '2px 6px',
      borderRadius: 8,
      whiteSpace: 'nowrap' as const,
      ...styles,
    }}>{text || (category === 'powertool' ? '전동공구' : '수공구')}</span>
  );
}
