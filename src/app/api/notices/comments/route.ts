import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const noticeId = request.nextUrl.searchParams.get('notice_id');
    if (!noticeId) {
      return NextResponse.json({ error: 'notice_id가 필요합니다' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('notice_comments')
      .select('*')
      .eq('notice_id', parseInt(noticeId))
      .order('created_at', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[Comments GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { notice_id, author, content } = body;

    if (!notice_id || !content) {
      return NextResponse.json({ error: 'notice_id와 content는 필수입니다' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('notice_comments')
      .insert({ notice_id, author: author || 'admin', content })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[Comments POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, author } = body;

    if (!id || !author) {
      return NextResponse.json({ error: 'id와 author가 필요합니다' }, { status: 400 });
    }

    // 본인 댓글만 삭제 가능
    const { data: comment, error: fetchErr } = await supabase
      .from('notice_comments')
      .select('author')
      .eq('id', id)
      .single();

    if (fetchErr) throw fetchErr;
    if (comment.author !== author) {
      return NextResponse.json({ error: '본인 댓글만 삭제할 수 있습니다' }, { status: 403 });
    }

    const { error } = await supabase
      .from('notice_comments')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Comments DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
