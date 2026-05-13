'use client';

import type { CSSProperties } from 'react';
import { Package } from 'lucide-react';
import { PricingTable, type PricingRow } from './components/PricingTable';
import type { ChannelFeeRates } from './lib/feeCalc';

// ============================================================
// 더미 데이터 (Step 5에서 Supabase + mw_channel_fees로 교체)
// ============================================================

const DUMMY_RATES: ChannelFeeRates = {
  naver:       0.0663,
  coupang_mp:  { powertool: 0.078, handtool: 0.108 },
  gmarket:     { powertool: 0.09,  handtool: 0.13  },
  ssg:         0.13,
};

const DUMMY_ROWS: PricingRow[] = [
  {
    id: 1,
    code: '14215',
    manageCode: 'DC886-17L',
    category: '전동공구',
    model: 'DEWALT',
    spec: 'DC886 4HP-17L 알루미늄',
    stock: 42,
    cost: 12000,
    priceA: 14000,
    priceB: 15000,
    priceC: 16500,
    priceNaver: 19900,
    priceCoupang: 21500,
    priceGmarket: 20500,
    priceSsg: 22000,
    inQty: 120,
    outQty: 85,
    pallet: 240,
  },
  {
    id: 2,
    code: '23902',
    manageCode: '6977734830781',
    category: '비트맨-비트날(다이아몬드)',
    model: '비트맨',
    spec: 'BPH2065-DMS-UT D.비트날 65mm PH2 1팩(2PC)',
    stock: 0,
    cost: 2320,
    priceA: 4000,
    priceB: 0,
    priceC: 0,
    priceNaver: 5300,
    priceCoupang: 0,
    priceGmarket: 0,
    priceSsg: 0,
    inQty: 0,
    outQty: 0,
    pallet: 0,
  },
];

// ============================================================
// 메인 페이지
// ============================================================

export default function ImportPricingPage() {
  return (
    <div style={{
      padding: 24,
      fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
      color: '#171719',
      background: '#F7F7F8',
      minHeight: '100vh',
      boxSizing: 'border-box',
    }}>
      <style>{`.content { width: 100% !important; }`}</style>

      {/* 헤더 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#171719' }}>
            수입제품 금액 책정
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(55,56,60,0.61)' }}>
            수입 제품의 도매가 및 채널별 판매가를 책정합니다
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <SecondaryButton>가져오기</SecondaryButton>
          <SecondaryButton>행 추가</SecondaryButton>
          <SecondaryButton>템플릿</SecondaryButton>
          <PrimaryButton>설정</PrimaryButton>
        </div>
      </div>

      {/* 테이블 or 빈 상태 */}
      {DUMMY_ROWS.length === 0 ? (
        <EmptyState />
      ) : (
        <PricingTable rows={DUMMY_ROWS} rates={DUMMY_RATES} />
      )}
    </div>
  );
}

// ============================================================
// 헬퍼 컴포넌트
// ============================================================

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
}

function PrimaryButton({ children, onClick, style }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: '#185FA5',
        color: '#ffffff',
        border: 'none',
        borderRadius: 6,
        padding: '8px 16px',
        fontSize: 13,
        fontWeight: 500,
        fontFamily: 'inherit',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, style }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: '#ffffff',
        color: '#37383C',
        border: '1px solid #E1E2E4',
        borderRadius: 6,
        padding: '8px 16px',
        fontSize: 13,
        fontWeight: 500,
        fontFamily: 'inherit',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '80px 24px',
      background: '#ffffff',
      border: '1px solid #E1E2E4',
      borderRadius: 12,
      gap: 12,
    }}>
      <Package size={40} color="rgba(55,56,60,0.28)" />
      <p style={{ margin: 0, fontSize: 14, color: 'rgba(55,56,60,0.61)', fontWeight: 500 }}>
        책정된 제품이 없습니다
      </p>
      <p style={{ margin: 0, fontSize: 13, color: 'rgba(55,56,60,0.28)' }}>
        가져오기 또는 행 추가로 제품을 등록하세요
      </p>
    </div>
  );
}
