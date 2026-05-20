'use client';

import { useState } from 'react';
import { useProducts } from './products/useProducts';
import { useCampaigns } from './products/useCampaigns';
import { ProductsFilter } from './products/ProductsFilter';
import { ProductsTable } from './products/ProductsTable';
import { DEFAULT_FILTERS, type ProductFilters } from './products/types';

type Tab = 'dashboard' | 'products' | 'settings';

function ProductsTabContent() {
  const [filters, setFilters] = useState<ProductFilters>(DEFAULT_FILTERS);
  const {
    rows, totalCount, matchedCount, unmatchedCount,
    loading, error, page, setPage, pageSize, totalPages,
    totalFiltered, allRows, refetchProducts,
  } = useProducts(filters);
  const { campaigns } = useCampaigns();

  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'info' | 'error' } | null>(null);

  function showToast(msg: string, type: 'success' | 'info' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSyncStats() {
    setSyncing(true);
    try {
      const res = await fetch('/api/ad/stats/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.ok) {
        if (data.rowsUpserted > 0) {
          showToast(`✅ 어제 데이터 sync 완료: ${Number(data.rowsUpserted).toLocaleString()}건 적재`, 'success');
        } else {
          showToast('ℹ️ 어제 sync 완료: 적재 0건 (광고 트래픽 없음)', 'info');
        }
      } else {
        showToast(`❌ sync 실패: ${data.error ?? '알 수 없는 오류'}`, 'error');
      }
    } catch (e) {
      showToast(`❌ sync 실패: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setSyncing(false);
    }
  }

  const toastColor =
    toast?.type === 'success' ? 'bg-green-600' : toast?.type === 'error' ? 'bg-red-600' : 'bg-blue-600';

  return (
    <>
      <div className="flex justify-end mb-3">
        <button
          onClick={handleSyncStats}
          disabled={syncing}
          className="px-4 py-2 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {syncing ? '가져오는 중...' : '📊 성과 가져오기'}
        </button>
      </div>
      <ProductsFilter
        filters={filters}
        onChange={setFilters}
        rows={allRows}
        campaigns={campaigns}
        filteredCount={totalFiltered}
      />
      <ProductsTable
        rows={rows}
        totalCount={totalCount}
        matchedCount={matchedCount}
        unmatchedCount={unmatchedCount}
        loading={loading}
        error={error}
        page={page}
        setPage={setPage}
        pageSize={pageSize}
        totalPages={totalPages}
        refetchProducts={refetchProducts}
      />
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded shadow-lg text-white text-sm ${toastColor}`}
        >
          {toast.msg}
        </div>
      )}
    </>
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
        {tab === 'products' && <ProductsTabContent />}
        {tab === 'settings' && <div>설정 (Step 5에서 구현)</div>}
      </div>
    </div>
  );
}
