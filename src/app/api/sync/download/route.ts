import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/sync/download — 전체 다운로드
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('app_data')
      .select('key, value');

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    console.error('[Sync Download]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
