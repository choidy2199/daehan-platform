import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { noticeId, userId } = body;

    if (!noticeId || !userId) {
      return NextResponse.json({ error: 'noticeId와 userId가 필요합니다' }, { status: 400 });
    }

    // 현재 confirmed_by 가져오기
    const { data: notice, error: fetchErr } = await supabase
      .from('notices')
      .select('confirmed_by')
      .eq('id', noticeId)
      .single();

    if (fetchErr) throw fetchErr;

    const confirmedBy: string[] = Array.isArray(notice?.confirmed_by) ? notice.confirmed_by : [];

    // 중복 방지
    if (confirmedBy.includes(userId)) {
      return NextResponse.json({ success: true, already: true });
    }

    confirmedBy.push(userId);

    const { error: updateErr } = await supabase
      .from('notices')
      .update({ confirmed_by: confirmedBy })
      .eq('id', noticeId);

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, confirmed_by: confirmedBy });
  } catch (err: any) {
    console.error('[Notices Confirm]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
