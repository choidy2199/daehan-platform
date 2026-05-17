import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { adGet } from '@/lib/naver-ad';
import { getApiKeys } from '@/lib/api-keys';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface NaverCampaign {
  nccCampaignId: string;
  name: string;
  campaignTp?: string;
  status?: string;
  dailyBudget?: number;
  userLock?: boolean;
  [key: string]: unknown;
}

export async function POST() {
  try {
    const keys = await getApiKeys();
    const naverAd = keys.naverAd;

    if (!naverAd?.customerId || !naverAd?.apiKey || !naverAd?.secretKey) {
      return NextResponse.json(
        { error: '네이버 광고 API 키가 설정되지 않았습니다 (설정 메뉴 확인)' },
        { status: 400 },
      );
    }

    const campaigns = await adGet<NaverCampaign[]>('/ncc/campaigns', naverAd);

    if (!Array.isArray(campaigns)) {
      return NextResponse.json(
        { error: '네이버 API 응답이 배열이 아닙니다', raw: campaigns },
        { status: 500 },
      );
    }

    const rows = campaigns.map((c) => ({
      ncc_campaign_id: c.nccCampaignId,
      name: c.name,
      campaign_type: c.campaignTp ?? null,
      daily_budget: typeof c.dailyBudget === 'number' ? c.dailyBudget : null,
      status: c.status ?? null,
      user_lock: c.userLock ?? false,
      raw_data: c,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('ad_campaigns')
      .upsert(rows, { onConflict: 'ncc_campaign_id' })
      .select();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      synced_count: data?.length ?? 0,
      campaigns: data,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ad/campaigns/sync]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
