'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  AdProduct,
  AdCampaign,
  CatalogItem,
  ProductRow,
  UseProductsResult,
  ProductFilters,
} from './types';
import { DEFAULT_FILTERS } from './types';
import { calcMargin } from './calcMargin';
import { useFeeRate } from './useFeeRate';

const PAGE_SIZE = 50;

export function useProducts(filters: ProductFilters = DEFAULT_FILTERS): UseProductsResult {
  const { feeRate } = useFeeRate();
  const [adProducts, setAdProducts] = useState<AdProduct[]>([]);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [mwProducts, setMwProducts] = useState<Record<string, CatalogItem>>({});
  const [mwGenProducts, setMwGenProducts] = useState<Record<string, CatalogItem>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // ① ad_products + ad_campaigns API에서 가져오기
  // ② localStorage에서 mw_products / mw_gen_products 읽기 (dictionary로 변환)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // API 병렬 호출
        const [productsRes, campaignsRes] = await Promise.all([
          fetch('/api/ad/products').then(r => r.json()),
          fetch('/api/ad/campaigns').then(r => r.json()),
        ]);

        if (cancelled) return;

        if (!productsRes.success) {
          throw new Error('광고 상품 조회 실패');
        }
        if (!campaignsRes.success) {
          throw new Error('캠페인 조회 실패');
        }

        setAdProducts(productsRes.products || []);
        setCampaigns(campaignsRes.campaigns || []);

        // localStorage 단가표 읽기
        const mwRaw = localStorage.getItem('mw_products');
        const genRaw = localStorage.getItem('mw_gen_products');

        const mwArr: CatalogItem[] = mwRaw ? JSON.parse(mwRaw) : [];
        const genArr: CatalogItem[] = genRaw ? JSON.parse(genRaw) : [];

        // dictionary 변환 (code → CatalogItem)
        const mwDict: Record<string, CatalogItem> = {};
        for (const item of mwArr) {
          if (item.code) mwDict[String(item.code)] = item;
        }
        const genDict: Record<string, CatalogItem> = {};
        for (const item of genArr) {
          if (item.code) genDict[String(item.code)] = item;
        }

        setMwProducts(mwDict);
        setMwGenProducts(genDict);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '알 수 없는 오류');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // 캠페인 id → name 매핑
  const campaignMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of campaigns) m[c.ncc_campaign_id] = c.name;
    return m;
  }, [campaigns]);

  // ad_products + 단가표 매칭하여 ProductRow[] 생성
  const allRows = useMemo<ProductRow[]>(() => {
    return adProducts.map(ap => {
      let catalog: CatalogItem | undefined;
      if (ap.product_code && ap.product_source === 'milwaukee') {
        catalog = mwProducts[ap.product_code];
      } else if (ap.product_code && ap.product_source === 'general') {
        catalog = mwGenProducts[ap.product_code];
      }

      return {
        id: ap.id,
        product_code: ap.product_code,
        product_source: ap.product_source,
        campaign_id: ap.campaign_id,
        campaign_name: ap.campaign_id ? (campaignMap[ap.campaign_id] || null) : null,
        bid_amt: ap.bid_amt,
        daily_budget_limit: ap.daily_budget_limit,
        auto_bid_enabled: ap.auto_bid_enabled,
        status: ap.status,
        model: catalog?.model ?? null,
        category: catalog?.category ?? null,
        cost: catalog?.cost ?? null,
        priceNaver: catalog?.priceNaver ?? null,
        image: catalog?.image ?? null,
        matched: !!catalog,
      };
    });
  }, [adProducts, mwProducts, mwGenProducts, campaignMap]);

  // 필터링 — efficiency OR 조합은 가장 낮은 임계값 흡수 (Math.min)
  const filteredRows = useMemo<ProductRow[]>(() => {
    const q = filters.searchQuery.trim().toLowerCase();
    const effThreshold = filters.efficiency.length === 0
      ? null
      : Math.min(...filters.efficiency.map(e =>
          e === 'margin10' ? 10 : e === 'margin20' ? 20 : 30
        ));

    return allRows.filter(row => {
      // sourceType
      if (filters.sourceType === 'milwaukee') {
        if (!(row.matched && row.product_source === 'milwaukee')) return false;
      } else if (filters.sourceType === 'general') {
        if (!(row.matched && row.product_source === 'general')) return false;
      } else if (filters.sourceType === 'unmatched') {
        if (row.matched) return false;
      }

      // status
      if (filters.status === 'on' && row.status !== 'ELIGIBLE') return false;
      if (filters.status === 'off' && row.status === 'ELIGIBLE') return false;

      // campaignId
      if (filters.campaignId !== 'all' && row.campaign_id !== filters.campaignId) return false;

      // efficiency (마진율 % 단위 비교)
      if (effThreshold !== null) {
        if (row.priceNaver == null || row.cost == null) return false;
        const m = calcMargin(row.priceNaver, row.cost, feeRate);
        if (m === null || m.rate < effThreshold) return false;
      }

      // searchQuery
      if (q !== '') {
        const matchModel = row.model?.toLowerCase().includes(q) ?? false;
        const matchCode = row.product_code?.toLowerCase().includes(q) ?? false;
        if (!matchModel && !matchCode) return false;
      }

      return true;
    });
  }, [
    allRows,
    filters.sourceType,
    filters.status,
    filters.campaignId,
    filters.efficiency.join(','),
    filters.searchQuery,
    feeRate,
  ]);

  // 필터 변경 시 페이지 1로 리셋
  useEffect(() => {
    setPage(1);
  }, [
    filters.sourceType,
    filters.status,
    filters.campaignId,
    filters.efficiency.join(','),
    filters.searchQuery,
  ]);

  // 페이지네이션 (필터링된 결과 기준)
  const totalCount = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, safePage]);

  const matchedCount = filteredRows.filter(r => r.matched).length;
  const unmatchedCount = totalCount - matchedCount;

  return {
    rows,
    totalCount,
    matchedCount,
    unmatchedCount,
    loading,
    error,
    page: safePage,
    setPage,
    pageSize: PAGE_SIZE,
    totalPages,
    totalFiltered: filteredRows.length,
    totalAll: allRows.length,
  };
}
