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
    totalFiltered, allRows,
  } = useProducts(filters);
  const { campaigns } = useCampaigns();

  return (
    <>
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
      />
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
