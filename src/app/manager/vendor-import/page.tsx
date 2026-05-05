'use client';

import { useState, useEffect, useMemo } from 'react';
import { colors, fonts, spacing, radius, borders, shadows, ui } from './lib/design-tokens';
import ClientSelector from './components/ClientSelector';
import BrandSubTabs from './components/BrandSubTabs';
import ProductTable from './components/ProductTable';
import type { Client, GenProduct } from './lib/types';
import { loadGenProducts, getAllBrands, getBrandCounts, filterProducts } from './lib/storage';

export default function VendorImportPage() {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [allProducts, setAllProducts] = useState<GenProduct[]>([]);
  const [activeBrand, setActiveBrand] = useState<string>('ALL');
  const [productQuery, setProductQuery] = useState<string>('');

  // mount 시 제품 로드
  useEffect(() => {
    setAllProducts(loadGenProducts());
  }, []);

  // 브랜드 목록 + 카운트 (입력 순서)
  const brandList = useMemo(() => {
    const brands = getAllBrands(allProducts);
    const counts = getBrandCounts(allProducts);
    return brands.map(name => ({ name, count: counts[name] || 0 }));
  }, [allProducts]);

  // 필터링된 제품
  const filteredProducts = useMemo(() => {
    return filterProducts(allProducts, activeBrand, productQuery);
  }, [allProducts, activeBrand, productQuery]);

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: fonts.family,
        backgroundColor: colors.bgSecondary,
        color: colors.text,
        fontSize: fonts.body.size,
        fontWeight: fonts.body.weight,
        overflow: 'hidden',
      }}
    >
      <style>{`.content { width: 100% !important; padding: 0 !important; max-width: none !important; }`}</style>
      {/* 페이지 헤더 (다크) */}
      <div
        style={{
          height: ui.sectionHeaderHeight,
          backgroundColor: colors.sectionHeaderBg,
          color: colors.sectionHeaderText,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `0 ${spacing.s4}`,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: fonts.panelHeader.size,
            fontWeight: fonts.panelHeader.weight,
          }}
        >
          📦 업체수입제품
        </span>
        <button
          type="button"
          style={{
            height: ui.buttonHeight.sm,
            padding: `0 ${spacing.s3}`,
            backgroundColor: 'transparent',
            color: colors.sectionHeaderText,
            border: `1px solid ${colors.sectionHeaderText}`,
            borderRadius: radius.base,
            fontSize: fonts.bodySm.size,
            cursor: 'pointer',
          }}
        >
          📋 발주서 리스트
        </button>
      </div>

      {/* 본체: 좌 70% / 우 30% */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* 좌측 70% — 거래처 + 브랜드 sub-tab + 제품 테이블 */}
        <div
          style={{
            flex: '0 0 70%',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            borderRight: borders.base,
            backgroundColor: colors.bg,
          }}
        >
          {/* 거래처 선택 (Phase 5-b 구현) */}
          <div
            style={{
              padding: spacing.s3,
              borderBottom: borders.base,
              flexShrink: 0,
            }}
          >
            <ClientSelector value={selectedClient} onChange={setSelectedClient} />
          </div>

          {/* 브랜드 sub-tab + 검색 (Phase 5-c) */}
          <BrandSubTabs
            brands={brandList}
            activeBrand={activeBrand}
            totalCount={allProducts.length}
            query={productQuery}
            onBrandChange={setActiveBrand}
            onQueryChange={setProductQuery}
          />

          {/* 제품 테이블 (Phase 5-c, 사진은 5-d) */}
          <ProductTable
            products={filteredProducts}
            isClientSelected={selectedClient !== null}
          />

        </div>

        {/* 우측 30% — 장바구니 */}
        <div
          style={{
            flex: '0 0 30%',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            backgroundColor: colors.bg,
          }}
        >
          {/* 장바구니 헤더 */}
          <div
            style={{
              padding: spacing.s3,
              borderBottom: borders.base,
              fontSize: fonts.panelHeader.size,
              fontWeight: fonts.panelHeader.weight,
              flexShrink: 0,
            }}
          >
            🛒 장바구니
          </div>

          {/* 장바구니 본체 (Phase 5-f) */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              padding: spacing.s3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.textHint,
              fontSize: fonts.bodySm.size,
            }}
          >
            장바구니 (Phase 5-f)
          </div>
        </div>
      </div>
    </div>
  );
}
