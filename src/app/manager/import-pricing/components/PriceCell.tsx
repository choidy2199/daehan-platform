'use client';

import { calcWholesaleMargin, calcChannelMargin, type Channel, type FeeCategory, type ChannelFeeRates } from '../lib/feeCalc';

// ============================================================
// 1. 도매 셀 (A/B/C)
// ============================================================
export interface WholesaleCellProps {
  price: number;
  cost: number;
}

export function WholesaleCell({ price, cost }: WholesaleCellProps) {
  const margin = calcWholesaleMargin(price, cost);

  if (price === 0 || price == null) {
    return (
      <div style={{ textAlign: 'center', padding: '8px 6px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#171719' }}>—</div>
        <div style={{ marginTop: 4 }}>
          <Badge type="neutral" text="미책정" />
        </div>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', padding: '8px 6px' }}>
      <div style={{ fontSize: '14px', fontWeight: 600, color: '#171719' }}>
        {price.toLocaleString()}
      </div>
      {margin && (
        <div style={{ marginTop: 4 }}>
          <Badge
            type={margin.profit >= 0 ? 'pos' : 'neg'}
            text={`${margin.rate >= 0 ? '+' : ''}${margin.rate}% · ${margin.profit >= 0 ? '+' : ''}${margin.profit.toLocaleString()}`}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================
// 2. 채널 셀 (스토어팜/쿠팡/오픈마켓/SSG)
// ============================================================
export interface ChannelCellProps {
  price: number;
  channel: Channel;
  category: FeeCategory;
  rates: ChannelFeeRates;
  prices: {
    cost: number;
    priceA: number;
    priceB: number;
    priceC: number;
  };
}

const CHANNEL_THEMES: Record<Channel, { bg: string; name: string }> = {
  naver:      { bg: 'rgba(0, 191, 64, 0.15)',  name: '스토어팜' },
  coupang_mp: { bg: 'rgba(255, 66, 66, 0.14)', name: '쿠팡' },
  gmarket:    { bg: '#C1D9FC',                  name: '오픈마켓' },
  ssg:        { bg: 'rgba(255, 146, 0, 0.15)', name: 'SSG' },
};

export function ChannelCell({ price, channel, category, rates, prices }: ChannelCellProps) {
  const theme = CHANNEL_THEMES[channel];

  if (price === 0 || price == null) {
    return (
      <div style={{ padding: '7px 5px', background: theme.bg }}>
        <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 600, color: '#171719' }}>—</div>
        <div style={{ textAlign: 'center', marginTop: 4 }}>
          <Badge type="neutral" text="미책정" />
        </div>
      </div>
    );
  }

  const bases: Array<{ label: string; cost: number }> = [
    { label: '원', cost: prices.cost },
    { label: 'A',  cost: prices.priceA },
    { label: 'B',  cost: prices.priceB },
    { label: 'C',  cost: prices.priceC },
  ];

  return (
    <div style={{ padding: '7px 5px', background: theme.bg }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#171719', flex: '0 0 auto', lineHeight: 1.1 }}>
          {price.toLocaleString()}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {bases.map((b) => {
            if (!b.cost) return null;
            const m = calcChannelMargin(price, b.cost, channel, category, rates);
            if (!m) return null;
            return (
              <Badge
                key={b.label}
                type={m.profit >= 0 ? 'pos' : 'neg'}
                text={`${b.label} ${m.rate >= 0 ? '+' : ''}${m.rate}% · ${m.profit >= 0 ? '+' : ''}${m.profit.toLocaleString()}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 3. 내부 헬퍼
// ============================================================
function Badge({ type, text }: { type: 'pos' | 'neg' | 'neutral'; text: string }) {
  const styles =
    type === 'pos'
      ? { background: 'rgba(0, 150, 50, 0.25)', color: '#009632' }
      : type === 'neg'
      ? { background: 'rgba(255, 66, 66, 0.25)', color: '#E52222' }
      : { background: 'rgba(112, 115, 124, 0.15)', color: 'rgba(55, 56, 60, 0.28)' };

  return (
    <span style={{
      display: 'inline-block',
      fontSize: '12px',
      fontWeight: 500,
      padding: '2px 6px',
      borderRadius: 8,
      whiteSpace: 'nowrap',
      ...styles,
    }}>
      {text}
    </span>
  );
}
