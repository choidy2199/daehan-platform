import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { adGet } from '@/lib/naver-ad';
import { getApiKeys } from '@/lib/api-keys';
import { getAllNaverProductsMap } from '@/lib/naver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface NaverAdgroup {
  nccAdgroupId: string;
  nccCampaignId: string;
  name?: string;
  status?: string;
  [key: string]: unknown;
}

interface NaverAd {
  nccAdId: string;
  nccAdgroupId: string;
  type?: string;
  adAttr?: { bidAmt?: number; useGroupBidAmt?: boolean };
  referenceKey?: string;
  referenceData?: {
    id?: string;
    mallProductId?: string;
    productTitle?: string;
    [key: string]: unknown;
  };
  status?: string;
  [key: string]: unknown;
}

interface CatalogItem {
  code: string;
  model?: string;
  source?: string;
  [key: string]: unknown;
}

export async function POST() {
  try {
    // 1. API 키 확인
    const keys = await getApiKeys();
    const naverAd = keys.naverAd;
    if (!naverAd?.customerId || !naverAd?.apiKey || !naverAd?.secretKey) {
      return NextResponse.json(
        { error: '네이버 광고 API 키가 설정되지 않았습니다 (설정 메뉴 확인)' },
        { status: 400 },
      );
    }

    // 2. ad_campaigns에서 캠페인 목록
    const { data: campaigns, error: campErr } = await supabase
      .from('ad_campaigns')
      .select('ncc_campaign_id, name');
    if (campErr) throw campErr;
    if (!campaigns?.length) {
      return NextResponse.json(
        { error: 'ad_campaigns가 비어있습니다. 먼저 캠페인 동기화를 실행하세요.' },
        { status: 400 },
      );
    }

    // 3. 커머스 상품 전체 캐시 (sellerManagementCode → product) + 보조 channelMap (방법 B)
    const sellerMap = await getAllNaverProductsMap();
    const channelMap = new Map<string, any>();
    for (const product of sellerMap.values()) {
      const cp = (product as any)?.channelProducts?.[0];
      const chno = cp?.channelProductNo;
      if (chno != null) channelMap.set(String(chno), product);
    }

    // 4. 단가표 dict 빌드 (app_data.mw_products / mw_gen_products)
    const { data: catalogRows, error: catErr } = await supabase
      .from('app_data')
      .select('key, value')
      .in('key', ['mw_products', 'mw_gen_products']);
    if (catErr) throw catErr;

    const mwProducts: Record<string, CatalogItem> = {};
    const mwGenProducts: Record<string, CatalogItem> = {};
    for (const row of catalogRows ?? []) {
      const arr = Array.isArray(row.value) ? row.value : [];
      const dict = row.key === 'mw_products' ? mwProducts : mwGenProducts;
      for (const item of arr) {
        if (item?.code) dict[String(item.code)] = item as CatalogItem;
      }
    }

    // 5. 캠페인 병렬 → adgroup/ad 순차
    const built: Array<Record<string, unknown>> = [];
    const warnings: Array<{ nccAdId: string; reason: string; mallProductId?: string; sellerManagementCode?: string }> = [];

    await Promise.all(
      campaigns.map(async (camp) => {
        const cid = camp.ncc_campaign_id;
        let adgroups: NaverAdgroup[] = [];
        try {
          adgroups = await adGet<NaverAdgroup[]>(
            `/ncc/adgroups?nccCampaignId=${encodeURIComponent(cid)}`,
            naverAd,
          );
        } catch {
          return;
        }
        if (!Array.isArray(adgroups)) return;

        for (const ag of adgroups) {
          let ads: NaverAd[] = [];
          try {
            ads = await adGet<NaverAd[]>(
              `/ncc/ads?nccAdgroupId=${encodeURIComponent(ag.nccAdgroupId)}`,
              naverAd,
            );
          } catch {
            continue;
          }
          if (!Array.isArray(ads)) continue;

          for (const ad of ads) {
            // 5-1. 커머스 매칭: mallProductId 우선 (channelMap), 폴백 referenceKey
            const mallId = ad.referenceData?.mallProductId ?? ad.referenceData?.id;
            const refKey = ad.referenceKey;
            let commerce: any = mallId ? channelMap.get(String(mallId)) : undefined;
            if (!commerce && refKey) commerce = channelMap.get(String(refKey));

            // 5-2. 단가표 매칭: mw_products 우선 → mw_gen_products
            const sellerCode = commerce?.channelProducts?.[0]?.sellerManagementCode;
            let productCode: string | null = null;
            let productSource: string | null = null;

            if (sellerCode) {
              const key = String(sellerCode);
              if (mwProducts[key]) {
                productCode = key;
                productSource = 'milwaukee';
              } else if (mwGenProducts[key]) {
                productCode = key;
                productSource = String(mwGenProducts[key].source ?? 'general');
              }
            }

            if (!productCode) {
              warnings.push({
                nccAdId: ad.nccAdId,
                reason: !commerce ? 'commerce_match_failed' : (!sellerCode ? 'no_seller_code' : 'catalog_match_failed'),
                mallProductId: mallId,
                sellerManagementCode: sellerCode,
              });
            }

            built.push({
              ncc_product_id: ad.nccAdId,
              product_code: productCode,
              product_source: productSource,
              origin_product_no: commerce?.originProductNo != null ? String(commerce.originProductNo) : null,
              channel_product_no: commerce?.channelProducts?.[0]?.channelProductNo != null
                ? String(commerce.channelProducts[0].channelProductNo) : null,
              campaign_id: cid,
              bid_amt: ad.adAttr?.bidAmt ?? null,
              auto_bid_enabled: false,
              target_roas_multiplier: 1.5,
              daily_budget_limit: null,
              status: ad.status ?? 'active',
              updated_at: new Date().toISOString(),
            });
          }
        }
      }),
    );

    // 6. Supabase upsert (UNIQUE: ncc_product_id) — 매칭 실패 행도 NULL로 포함
    let upsertedCount = 0;
    if (built.length > 0) {
      const { data, error } = await supabase
        .from('ad_products')
        .upsert(built, { onConflict: 'ncc_product_id' })
        .select();
      if (error) throw error;
      upsertedCount = data?.length ?? 0;
    }

    return NextResponse.json({
      success: true,
      synced_count: upsertedCount,
      total_ads_found: built.length,
      warnings_count: warnings.length,
      warnings: warnings.slice(0, 20),
    });
  } catch (err) {
    const msg = err instanceof Error
      ? err.message
      : (typeof err === 'object' ? JSON.stringify(err) : String(err));
    console.error('[ad/products/sync]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
