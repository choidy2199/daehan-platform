import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/sync/upload — 전체 업로드
 * Body: { data: [{ key: "mw_products", value: "..." }, ...] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const items = body.data || [];

    if (!items.length) {
      return NextResponse.json({ error: '업로드할 데이터가 없습니다' }, { status: 400 });
    }

    let saved = 0;
    for (const item of items) {
      if (!item.key) continue;

      const value = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;

      const { error } = await supabase
        .from('app_data')
        .upsert({ key: item.key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

      if (error) {
        console.error(`[Sync Upload] ${item.key} 실패:`, error.message);
      } else {
        saved++;
      }
    }

    console.log(`[Sync Upload] 완료: ${saved}/${items.length}건`);
    return NextResponse.json({ success: true, saved, total: items.length });
  } catch (err: any) {
    console.error('[Sync Upload]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
