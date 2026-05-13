'use client';

import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Package } from 'lucide-react';
import { PricingTable, type PricingRow } from './components/PricingTable';
import type { ChannelFeeRates } from './lib/feeCalc';
import { supabase } from '@/lib/supabase';

// ============================================================
// 내부 타입
// ============================================================

interface ImportPricingItem {
  id: number;
  gen_product_id: number | null;
  custom_code: string | null;
  custom_manage_code: string | null;
  custom_category: string | null;
  custom_model: string | null;
  custom_spec: string | null;
  cost: number | null;
  price_a: number | null;
  price_b: number | null;
  price_c: number | null;
  price_naver: number | null;
  price_coupang: number | null;
  price_gmarket: number | null;
  price_ssg: number | null;
  override_category: string | null;
}

// ============================================================
// 매핑 함수
// ============================================================

function mapChannelFees(raw: any): ChannelFeeRates | null {
  if (!raw?.channels) return null;
  const ch = raw.channels;
  try {
    return {
      naver:       (ch.naver.fees[0].rate + ch.naver.fees[1].rate) / 100,
      coupang_mp:  { powertool: ch.coupang_mp.categories[0].rate / 100, handtool: ch.coupang_mp.categories[1].rate / 100 },
      gmarket:     { powertool: ch.gmarket.categories[0].rate / 100,    handtool: ch.gmarket.categories[1].rate / 100    },
      ssg:         ch.ssg.categories[0].rate / 100,
    };
  } catch {
    return null;
  }
}

function buildRows(items: ImportPricingItem[], genMap: Map<number, any>): PricingRow[] {
  return items.map(item => {
    const gen = item.gen_product_id != null ? genMap.get(item.gen_product_id) : null;
    return {
      id:               item.id,
      imgUrl:           null,
      code:             gen?.code              ?? item.custom_code          ?? '',
      manageCode:       gen?.manageCode        ?? item.custom_manage_code   ?? '',
      category:         gen?.category          ?? item.custom_category      ?? '',
      model:            gen?.model             ?? item.custom_model         ?? '',
      spec:             gen?.description       ?? item.custom_spec          ?? '',
      stock:            gen?.stock             ?? 0,
      cost:             item.cost              ?? gen?.cost                 ?? 0,
      priceA:           item.price_a           ?? 0,
      priceB:           item.price_b           ?? 0,
      priceC:           item.price_c           ?? 0,
      priceNaver:       item.price_naver       ?? 0,
      priceCoupang:     item.price_coupang     ?? 0,
      priceGmarket:     item.price_gmarket     ?? 0,
      priceSsg:         item.price_ssg         ?? 0,
      inQty:            gen?.inQty             ?? 0,
      outQty:           gen?.outQty            ?? 0,
      pallet:           gen?.palletQty         ?? 0,
      overrideCategory: (item.override_category as 'powertool' | 'handtool' | null) ?? null,
    };
  });
}

// ============================================================
// 메인 페이지
// ============================================================

type LoadState = 'loading' | 'ready' | 'error';

export default function ImportPricingPage() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMsg, setErrorMsg]   = useState<string>('');
  const [rows, setRows]           = useState<PricingRow[]>([]);
  const [rates, setRates]         = useState<ChannelFeeRates | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [feesRes, productsRes, itemsRes] = await Promise.all([
          supabase.from('app_data').select('value').eq('key', 'mw_channel_fees').single(),
          supabase.from('app_data').select('value').eq('key', 'mw_gen_products').single(),
          supabase.from('import_pricing_items').select('*').order('id', { ascending: false }),
        ]);

        if (cancelled) return;

        if (feesRes.error)    throw new Error('수수료 정보 로드 실패');
        if (productsRes.error) throw new Error('제품 마스터 로드 실패');
        if (itemsRes.error)   throw new Error('책정 데이터 로드 실패');

        const mappedRates = mapChannelFees(feesRes.data?.value);
        if (!mappedRates) throw new Error('수수료 구조 파싱 실패');

        const genProductsArray = (productsRes.data?.value ?? []) as any[];
        const genMap = new Map<number, any>();
        for (const p of genProductsArray) {
          if (p.code != null) genMap.set(parseInt(p.code, 10), p);
        }

        const builtRows = buildRows((itemsRes.data ?? []) as ImportPricingItem[], genMap);

        setRates(mappedRates);
        setRows(builtRows);
        setLoadState('ready');
      } catch (e: any) {
        if (cancelled) return;
        setErrorMsg(e?.message ?? '알 수 없는 에러');
        setLoadState('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

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

      {/* 로딩 / 에러 / 테이블 */}
      {loadState === 'loading' && <LoadingView />}
      {loadState === 'error'   && <ErrorView message={errorMsg} />}
      {loadState === 'ready'   && rates && (
        rows.length === 0 ? (
          <EmptyState />
        ) : (
          <PricingTable rows={rows} rates={rates} />
        )
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

function LoadingView() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '80px 24px',
      background: '#ffffff',
      border: '1px solid #E1E2E4',
      borderRadius: 12,
    }}>
      <p style={{ margin: 0, fontSize: 14, color: 'rgba(55,56,60,0.61)' }}>
        데이터 불러오는 중...
      </p>
    </div>
  );
}

function ErrorView({ message }: { message: string }) {
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
      <p style={{ margin: 0, fontSize: 14, color: '#C83B38', fontWeight: 500 }}>
        {message}
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          background: '#ffffff',
          color: '#37383C',
          border: '1px solid #E1E2E4',
          borderRadius: 6,
          padding: '8px 16px',
          fontSize: 13,
          fontWeight: 500,
          fontFamily: "'Pretendard', -apple-system, sans-serif",
          cursor: 'pointer',
        }}
      >
        다시 시도
      </button>
    </div>
  );
}
