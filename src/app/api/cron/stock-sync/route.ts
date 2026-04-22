import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncAllStock } from '@/lib/stockSync';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/cron/stock-sync — Vercel Cron 전용 엔드포인트
 * 인증: Authorization: Bearer ${CRON_SECRET} (Vercel이 자동 주입)
 * 스케줄: vercel.json의 crons 참조 (월~금 08:00~18:45 KST, 15분 간격)
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const result = await syncAllStock();

  try {
    await supabase.from('app_data').upsert(
      {
        key: 'mw_stock_last_sync',
        value: result,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

    const failedCount = result.mwFailed + result.genFailed;
    if (failedCount > 0 || !result.success) {
      const { data } = await supabase
        .from('app_data')
        .select('value')
        .eq('key', 'mw_stock_fetch_log')
        .maybeSingle();
      const raw = data?.value;
      const existing =
        typeof raw === 'string'
          ? (() => {
              try { return JSON.parse(raw); } catch { return null; }
            })()
          : raw;
      const entries: any[] = Array.isArray(existing?.entries) ? existing.entries : [];
      entries.push({
        timestamp: new Date().toISOString(),
        failedCount,
        errors: result.errors.slice(0, 10),
        source: 'cron',
      });
      while (entries.length > 50) entries.shift();
      await supabase.from('app_data').upsert(
        {
          key: 'mw_stock_fetch_log',
          value: { entries },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );
    }
  } catch (e) {
    console.error('[cron/stock-sync] log save failed:', e);
  }

  return NextResponse.json(result);
}
