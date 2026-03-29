import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/sync/save — 단일 키 저장 (자동 동기화용)
 * Body: { key: "mw_products", value: "..." }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json({ error: 'key가 필요합니다' }, { status: 400 });
    }

    const parsed = typeof value === 'string' ? JSON.parse(value) : value;

    const { error } = await supabase
      .from('app_data')
      .upsert({ key, value: parsed, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    if (error) throw error;

    return NextResponse.json({ success: true, key });
  } catch (err: any) {
    console.error('[Sync Save]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
