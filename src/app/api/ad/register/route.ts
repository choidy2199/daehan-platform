import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getApiKeys } from '@/lib/api-keys';
import { adPost } from '@/lib/naver-ad';
import type { NccRegisterKeyword } from '@/app/manager/ad-lab/products/useNccRegister';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ReqProduct {
  id: string;
  product_code: string;
  product_name: string;
  recommended_bid: number;
  daily_budget: number;
}

interface ReqBody {
  products: ReqProduct[];
  keywords: NccRegisterKeyword[];
  group_id?: string;
  dry_run: boolean;
}

interface RegisteredItem {
  product_id: string;
  ncc_campaign_id: string | null;
  ncc_keyword_ids: string[];
  status: 'success' | 'failed' | 'dry_run';
  error_message?: string;
}

interface AdgroupResponse {
  nccAdgroupId: string;
  nccCampaignId: string;
}

interface KeywordResponse {
  nccKeywordId: string;
}

export async function POST(req: Request) {
  const body = (await req.json()) as ReqBody;
  const groupId = body.group_id || process.env.NAVER_AD_GROUP_ID || '';

  if (body.dry_run) {
    return NextResponse.json({
      success: true,
      dry_run: true,
      registered: body.products.map(p => ({
        product_id: p.id,
        ncc_campaign_id: null,
        ncc_keyword_ids: [],
        status: 'dry_run' as const,
      })),
    });
  }

  const keys = await getApiKeys();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const registered: RegisteredItem[] = [];
  let allSuccess = true;

  for (const product of body.products) {
    try {
      const adgroup = await adPost<AdgroupResponse>(
        '/ncc/adgroups',
        {
          nccCampaignId: groupId,
          name: `${product.product_code} - ${product.product_name}`,
          dailyBudget: product.daily_budget,
          bidAmt: product.recommended_bid,
        },
        keys.naverAd,
      );

      const keywordIds: string[] = [];
      for (const kw of body.keywords) {
        const kwRes = await adPost<KeywordResponse>(
          '/ncc/keywords',
          {
            nccAdgroupId: adgroup.nccAdgroupId,
            keyword: kw.keyword,
            bidAmt: product.recommended_bid,
          },
          keys.naverAd,
        );
        keywordIds.push(kwRes.nccKeywordId);
      }

      await supabase
        .from('ad_products')
        .update({
          campaign_id: adgroup.nccCampaignId,
          status: 'ELIGIBLE',
          daily_budget_limit: product.daily_budget,
          bid_amt: product.recommended_bid,
        })
        .eq('id', product.id);

      if (keywordIds.length > 0) {
        const inserts = body.keywords.map((kw, i) => ({
          product_id: Number(product.id),
          ncc_keyword_id: keywordIds[i],
          ncc_campaign_id: adgroup.nccCampaignId,
          ncc_adgroup_id: adgroup.nccAdgroupId,
          keyword: kw.keyword,
          monthly_search_volume: kw.monthlySearchVolume,
          comp_idx: kw.compIdx,
          click_rate: kw.clickRate,
          recommend_score: kw.recommendScore,
          bid_amt: product.recommended_bid,
          status: 'ELIGIBLE',
        }));
        await supabase.from('ad_keywords').insert(inserts);
      }

      registered.push({
        product_id: product.id,
        ncc_campaign_id: adgroup.nccCampaignId,
        ncc_keyword_ids: keywordIds,
        status: 'success',
      });
    } catch (e) {
      allSuccess = false;
      registered.push({
        product_id: product.id,
        ncc_campaign_id: null,
        ncc_keyword_ids: [],
        status: 'failed',
        error_message: e instanceof Error ? e.message : 'Unknown error',
      });
    }
  }

  return NextResponse.json({
    success: allSuccess,
    dry_run: false,
    registered,
  });
}
