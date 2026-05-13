'use client';

import type { CSSProperties } from 'react';
import { WholesaleCell, ChannelCell } from './PriceCell';
import { detectCategory, type ChannelFeeRates } from '../lib/feeCalc';

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
  rates: ChannelFeeRates;
}

export function PricingTable({ rows, rates }: PricingTableProps) {
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
            <Th sticky left={0}   width={44}>사진</Th>
            <Th sticky left={44}  width={60}>코드</Th>
            <Th sticky left={104} width={70} lastSticky>관리코드</Th>
            <Th width={64}>대분류</Th>
            <Th width={80}>품명</Th>
            <Th width={120}>규격</Th>
            <Th width={44}>재고</Th>
            <Th width={80} sep>원가</Th>
            <Th width={90}>A</Th>
            <Th width={90}>B</Th>
            <Th width={90}>C</Th>
            <Th width={200} sep>스토어팜</Th>
            <Th width={200}>쿠팡</Th>
            <Th width={200}>오픈마켓</Th>
            <Th width={200}>SSG</Th>
            <Th width={42} sep>IN</Th>
            <Th width={42}>OUT</Th>
            <Th width={50}>파레트</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const category = detectCategory(row.category, row.overrideCategory);
            const prices = { cost: row.cost, priceA: row.priceA, priceB: row.priceB, priceC: row.priceC };

            return (
              <tr key={row.id}>
                <Td sticky left={0}>
                  <div style={{
                    width: 32, height: 32, background: '#EAF2FE', borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#0054D1', fontSize: 9.5,
                  }}>IMG</div>
                </Td>
                <Td sticky left={44}>{row.code}</Td>
                <Td sticky left={104} lastSticky>{row.manageCode}</Td>

                <Td>
                  <CategoryBadge category={category} text={row.category} />
                </Td>
                <Td>{row.model}</Td>
                <Td style={{ color: 'rgba(55, 56, 60, 0.61)' }}>{row.spec}</Td>
                <Td center>{row.stock}</Td>

                <Td sep style={{ textAlign: 'center', background: 'rgba(112, 115, 124, 0.05)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{row.cost.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: 'rgba(55, 56, 60, 0.28)', marginTop: 3 }}>기준</div>
                </Td>

                <Td><WholesaleCell price={row.priceA} cost={row.cost} /></Td>
                <Td><WholesaleCell price={row.priceB} cost={row.cost} /></Td>
                <Td><WholesaleCell price={row.priceC} cost={row.cost} /></Td>

                <Td sep noPadding>
                  <ChannelCell price={row.priceNaver}   channel="naver"      category={category} rates={rates} prices={prices} />
                </Td>
                <Td noPadding>
                  <ChannelCell price={row.priceCoupang} channel="coupang_mp" category={category} rates={rates} prices={prices} />
                </Td>
                <Td noPadding>
                  <ChannelCell price={row.priceGmarket} channel="gmarket"    category={category} rates={rates} prices={prices} />
                </Td>
                <Td noPadding>
                  <ChannelCell price={row.priceSsg}     channel="ssg"        category={category} rates={rates} prices={prices} />
                </Td>

                <Td sep center>{row.inQty}</Td>
                <Td center>{row.outQty}</Td>
                <Td center>{row.pallet}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// 헬퍼 컴포넌트 (any 금지 — 명시적 인터페이스)
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
      color: 'rgba(55, 56, 60, 0.80)',
      background: '#EAEBEC',
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
    ? { background: '#D5E6FD', color: '#0054D1' }
    : { background: 'rgba(0, 191, 64, 0.20)', color: '#009632' };

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
