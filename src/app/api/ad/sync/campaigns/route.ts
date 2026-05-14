import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { adGet } from '@/lib/naver-ad';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface NaverCampaign {
  nccCampaignId: string;
  name: string;
  campaignTp?: string;
  status?: string;
  statusReason?: string;
  dailyBudget?: number;
  useDailyBudget?: boolean;
  expectCost?: number;
  totalChargeCost?: number;
  deliveryMethod?: string;
  trackingMode?: string;
  regTm?: string;
  editTm?: string;
}

export async function POST() {
  try {
    const customerId = process.env.NAVER_AD_CUSTOMER_ID;
    const apiKey = process.env.NAVER_AD_API_KEY;
    const secretKey = process.env.NAVER_AD_SECRET_KEY;

    if (!customerId || !apiKey || !secretKey) {
      return NextResponse.json(
        { error: 'AD-LAB 환경변수 누락 (NAVER_AD_CUSTOMER_ID, NAVER_AD_API_KEY, NAVER_AD_SECRET_KEY 확인)' },
        { status: 500 }
      );
    }

    const campaigns = await adGet<NaverCampaign[]>('/ncc/campaigns', {
      customerId,
      apiKey,
      secretKey,
    });

    const rows = campaigns.map((c) => ({
      ncc_campaign_id: c.nccCampaignId,
      name: c.name,
      campaign_tp: c.campaignTp ?? null,
      status: c.status ?? null,
      status_reason: c.statusReason ?? null,
      daily_budget: c.dailyBudget ?? null,
      use_daily_budget: c.useDailyBudget ?? null,
      expect_cost: c.expectCost ?? null,
      total_charge_cost: c.totalChargeCost ?? null,
      delivery_method: c.deliveryMethod ?? null,
      tracking_mode: c.trackingMode ?? null,
      reg_tm: c.regTm ?? null,
      edit_tm: c.editTm ?? null,
      synced_at: new Date().toISOString(),
      raw_json: c,
    }));

    const { error } = await supabase
      .from('ad_campaigns')
      .upsert(rows, { onConflict: 'ncc_campaign_id' });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      count: rows.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ad/sync/campaigns]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
