'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  AdProduct,
  AdCampaign,
  CatalogItem,
  ProductRow,
  UseProductsResult,
} from './types';

const PAGE_SIZE = 50;

export function useProducts(): UseProductsResult {
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
    for (const c of campaigns) m[c.id] = c.name;
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

  // 페이지네이션
  const totalCount = allRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return allRows.slice(start, start + PAGE_SIZE);
  }, [allRows, safePage]);

  const matchedCount = allRows.filter(r => r.matched).length;
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
  };
}
