import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncAllStock, type StockSyncResult } from '@/lib/stockSync';

export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface StockFetchLog {
  entries: Array<{
    timestamp: string;
    failedCount: number;
    errors: string[];
  }>;
}

async function saveKey(key: string, value: unknown) {
  const { error } = await supabase.from('app_data').upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
  if (error) throw error;
}

async function loadKey<T>(key: string, defaultValue: T): Promise<T> {
  const { data, error } = await supabase
    .from('app_data')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  if (!data) return defaultValue;
  const v = data.value;
  if (typeof v === 'string') {
    try { return JSON.parse(v) as T; } catch { return defaultValue; }
  }
  return (v as T) ?? defaultValue;
}

/**
 * POST /api/erp/stock-sync — 자동 재고 동기화 (Cron + 수동버튼 겸용)
 * 인증: 헤더 x-sync-key === SYNC_API_KEY
 */
export async function POST(req: NextRequest) {
  const providedKey = req.headers.get('x-sync-key');
  const expectedKey = process.env.SYNC_API_KEY;
  if (!expectedKey || providedKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result: StockSyncResult = await syncAllStock();

    // 마지막 결과 저장
    await saveKey('mw_stock_last_sync', result);

    // 실패 건이 있을 때만 로그 누적 (최대 50개, 오래된 순 자동 삭제)
    const failedTotal = result.mwFailed + result.genFailed + result.errors.length;
    if (failedTotal > 0) {
      const log = await loadKey<StockFetchLog>('mw_stock_fetch_log', { entries: [] });
      const entries = Array.isArray(log?.entries) ? log.entries : [];
      entries.push({
        timestamp: result.finishedAt,
        failedCount: failedTotal,
        errors: result.errors,
      });
      while (entries.length > 50) entries.shift();
      await saveKey('mw_stock_fetch_log', { entries });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[stock-sync POST]', err);
    return NextResponse.json({ error: err?.message || '서버 오류' }, { status: 500 });
  }
}

/**
 * GET /api/erp/stock-sync — 마지막 조회 결과 반환 (UI 초기 렌더링용)
 */
export async function GET() {
  try {
    const last = await loadKey<StockSyncResult | null>('mw_stock_last_sync', null);
    return NextResponse.json(last);
  } catch (err: any) {
    console.error('[stock-sync GET]', err);
    return NextResponse.json({ error: err?.message || '서버 오류' }, { status: 500 });
  }
}
