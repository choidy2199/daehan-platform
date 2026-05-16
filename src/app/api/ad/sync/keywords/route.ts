import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchAdgroupsByCampaign, fetchKeywordsByAdgroup } from '@/lib/naver-ad';

export async function POST() {
  try {
    const customerId = process.env.NAVER_AD_CUSTOMER_ID;
    const apiKey = process.env.NAVER_AD_API_KEY;
    const secretKey = process.env.NAVER_AD_SECRET_KEY;

    if (!customerId || !apiKey || !secretKey) {
      return NextResponse.json(
        { success: false, error: 'NAVER_AD 환경변수 누락 (NAVER_AD_CUSTOMER_ID, NAVER_AD_API_KEY, NAVER_AD_SECRET_KEY 확인)' },
        { status: 500 },
      );
    }

    const keys = { customerId, apiKey, secretKey };

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: campaigns, error: campErr } = await supabase
      .from('ad_campaigns')
      .select('ncc_campaign_id');

    if (campErr) throw campErr;
    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({
        success: false,
        error: '캠페인이 없습니다. 먼저 캠페인 동기화를 실행하세요.',
      });
    }

    const allKeywords: Array<Record<string, unknown>> = [];
    let adgroupCount = 0;
    const syncedAt = new Date().toISOString();

    for (const camp of campaigns) {
      const adgroups = await fetchAdgroupsByCampaign(camp.ncc_campaign_id, keys);
      adgroupCount += adgroups.length;

      for (const ag of adgroups) {
        const keywords = await fetchKeywordsByAdgroup(ag.nccAdgroupId, keys);
        for (const kw of keywords) {
          allKeywords.push({
            ncc_keyword_id: kw.nccKeywordId,
            ncc_campaign_id: camp.ncc_campaign_id,
            ncc_adgroup_id: kw.nccAdgroupId,
            keyword: kw.keyword,
            bid_amt: kw.bidAmt ?? null,
            use_group_bid_amt: kw.useGroupBidAmt ?? null,
            status: kw.status ?? null,
            quality_index: kw.qualityIndex ?? null,
            reg_tm: kw.regTm ?? null,
            edit_tm: kw.editTm ?? null,
            synced_at: syncedAt,
            raw_json: kw,
          });
        }
      }
    }

    if (allKeywords.length > 0) {
      const { error: upsertErr } = await supabase
        .from('ad_keywords')
        .upsert(allKeywords, { onConflict: 'ncc_keyword_id' });

      if (upsertErr) throw upsertErr;
    }

    return NextResponse.json({
      success: true,
      campaignCount: campaigns.length,
      adgroupCount,
      keywordCount: allKeywords.length,
      syncedAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ad/sync/keywords]', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
