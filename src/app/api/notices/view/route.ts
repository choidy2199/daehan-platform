import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 });
    }

    // 현재 조회수 가져오기
    const { data: current, error: fetchErr } = await supabase
      .from('notices')
      .select('views')
      .eq('id', id)
      .single();

    if (fetchErr) throw fetchErr;

    // +1 업데이트
    const { error: updateErr } = await supabase
      .from('notices')
      .update({ views: (current.views || 0) + 1 })
      .eq('id', id);

    if (updateErr) throw updateErr;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Notices View]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
