'use client';

import { useState } from 'react';
import { useProducts } from './products/useProducts';
import { useFeeRate } from './products/useFeeRate';
import { calcMargin } from './products/calcMargin';
import { breakEvenRoas } from './products/breakEvenRoas';

type Tab = 'dashboard' | 'products' | 'settings';

// useProducts 검증용 임시 컴포넌트
function ProductsPlaceholder() {
  const { rows, totalCount, matchedCount, unmatchedCount, loading, error, page, totalPages } = useProducts();
  const feeRateResult = useFeeRate();

  if (loading) return <div>로딩중...</div>;
  if (error) return <div>오류: {error}</div>;

  const firstMatched = rows.find(r => r.matched && r.priceNaver && r.cost);
  const margin = firstMatched && firstMatched.priceNaver != null && firstMatched.cost != null
    ? calcMargin(firstMatched.priceNaver, firstMatched.cost, feeRateResult.feeRate)
    : null;
  const roas = firstMatched && firstMatched.priceNaver != null && firstMatched.cost != null
    ? breakEvenRoas(firstMatched.priceNaver, firstMatched.cost, feeRateResult.feeRate)
    : null;

  return (
    <div style={{ padding: 16, fontFamily: 'monospace' }}>
      <div>전체: {totalCount}건</div>
      <div>매칭: {matchedCount}건</div>
      <div>미매칭: {unmatchedCount}건</div>
      <div>현재 페이지: {page} / {totalPages}</div>
      <div>이번 페이지 행 수: {rows.length}건</div>
      <hr style={{ margin: '16px 0' }} />
      <div>샘플 5건:</div>
      <pre style={{ fontSize: 11, background: '#f5f5f5', padding: 8 }}>
        {JSON.stringify(rows.slice(0, 5).map(r => ({
          id: r.id,
          code: r.product_code,
          model: r.model,
          campaign: r.campaign_name,
          matched: r.matched,
        })), null, 2)}
      </pre>
      <hr style={{ margin: '16px 0' }} />
      <div><strong>첫 매칭 행 계산 검증 (Step 4-2)</strong></div>
      <pre style={{ fontSize: 11, background: '#f5f5f5', padding: 8 }}>
        {JSON.stringify({
          model: firstMatched?.model,
          priceNaver: firstMatched?.priceNaver,
          cost: firstMatched?.cost,
          feeRate: feeRateResult.feeRate,
          feeRateLoading: feeRateResult.loading,
          feeRateError: feeRateResult.error,
          margin,
          breakEvenRoas: roas,
        }, null, 2)}
      </pre>
    </div>
  );
}

export default function AdLabPage() {
  const [tab, setTab] = useState<Tab>('dashboard');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        AD-LAB v3 (네이버 쇼핑검색광고)
      </h1>

      <nav className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setTab('dashboard')}
          className={`px-4 py-2 ${
            tab === 'dashboard'
              ? 'border-b-2 border-blue-500 font-semibold'
              : 'text-gray-600'
          }`}
        >
          대시보드
        </button>
        <button
          onClick={() => setTab('products')}
          className={`px-4 py-2 ${
            tab === 'products'
              ? 'border-b-2 border-blue-500 font-semibold'
              : 'text-gray-600'
          }`}
        >
          상품목록
        </button>
        <button
          onClick={() => setTab('settings')}
          className={`px-4 py-2 ${
            tab === 'settings'
              ? 'border-b-2 border-blue-500 font-semibold'
              : 'text-gray-600'
          }`}
        >
          설정
        </button>
      </nav>

      <div className="text-gray-700">
        {tab === 'dashboard' && <div>대시보드 (Step 7에서 구현)</div>}
        {tab === 'products' && <ProductsPlaceholder />}
        {tab === 'settings' && <div>설정 (Step 5에서 구현)</div>}
      </div>
    </div>
  );
}
