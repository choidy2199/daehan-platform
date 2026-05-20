import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStats } from '@/lib/naver-ad';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// NCC /stats 일별 적재 (5-D-2)
// body: { since?: 'YYYY-MM-DD', until?: 'YYYY-MM-DD' } — 기본값 어제 1일치.
// /stats는 timeIncrement=1 미지원(allDays만)이라 날짜별 반복 호출 (5-D-1 실측).
// 인증/RLS 없음 — 5-D-3 UI 버튼 + 5-D-4 Cron에서만 호출.

const FIELDS = ['impCnt', 'clkCnt', 'salesAmt', 'ccnt', 'convAmt', 'ror'];
const CHUNK = 100; // maxIds 비공개 → 보수적 100개씩 분할 (5-D-1 사양 조사)

function yesterdayKST(): string {
  const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  kst.setDate(kst.getDate() - 1);
  return kst.toISOString().slice(0, 10);
}

// since..until 날짜 배열 (inclusive)
function dateList(since: string, until: string): string[] {
  const out: string[] = [];
  const d = new Date(since + 'T00:00:00Z');
  const end = new Date(until + 'T00:00:00Z');
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  let body: { since?: string; until?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* 빈 body 허용 */
  }
  const y = yesterdayKST();
  const since = body.since || y;
  const until = body.until || y;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // ncc_product_id NOT NULL인 광고 소재 → id 룩업 맵
  const { data: products, error: prodErr } = await supabase
    .from('ad_products')
    .select('id, ncc_product_id')
    .not('ncc_product_id', 'is', null);
  if (prodErr) {
    return NextResponse.json({ ok: false, error: prodErr.message }, { status: 500 });
  }

  const idMap = new Map<string, number>();
  for (const p of products ?? []) {
    if (p.ncc_product_id) idMap.set(p.ncc_product_id, p.id);
  }
  const idChunks = chunk(Array.from(idMap.keys()), CHUNK);

  const dates = dateList(since, until);
  const emptyDays: string[] = [];
  const errors: { date: string; error: string }[] = [];
  let rowsUpserted = 0;

  for (const date of dates) {
    try {
      const upsertRows: Record<string, unknown>[] = [];
      for (let ci = 0; ci < idChunks.length; ci++) {
        if (ci > 0) await sleep(100); // rate limit 방어
        const res = (await getStats({
          ids: idChunks[ci],
          fields: FIELDS,
          timeRange: { since: date, until: date },
        })) as { data?: Array<Record<string, unknown>> };
        for (const row of res?.data ?? []) {
          // per-row id 필드명은 5-D-1 트래픽 0건이라 미확정 → 'id' 가정 (트래픽 발생 시 검증)
          const adProductId = idMap.get(String(row.id));
          if (adProductId == null) continue;
          const cost = num(row.salesAmt);
          const revenue = num(row.convAmt);
          const roas = row.ror != null ? num(row.ror) : cost > 0 ? (revenue / cost) * 100 : 0;
          upsertRows.push({
            ad_product_id: adProductId,
            stat_date: date,
            impressions: num(row.impCnt),
            clicks: num(row.clkCnt),
            cost,
            conversions: num(row.ccnt),
            revenue,
            actual_roas: roas,
            breakeven_roas: null,
          });
        }
      }
      if (upsertRows.length === 0) {
        emptyDays.push(date);
        continue;
      }
      const { error: upErr } = await supabase
        .from('ad_stats_daily')
        .upsert(upsertRows, { onConflict: 'ad_product_id,stat_date' });
      if (upErr) throw new Error(upErr.message);
      rowsUpserted += upsertRows.length;
    } catch (e) {
      errors.push({ date, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    dateRange: { since, until },
    daysProcessed: dates.length,
    rowsUpserted,
    emptyDays,
    errors,
  });
}
