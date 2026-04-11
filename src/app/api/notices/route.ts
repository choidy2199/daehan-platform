import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[Notices GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category, title, content, pinned, author } = body;

    if (!title || !content) {
      return NextResponse.json({ error: '제목과 내용은 필수입니다' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('notices')
      .insert({ category: category || 'update', title, content, pinned: pinned || false, author: author || 'admin' })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[Notices POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, category, title, content, pinned } = body;

    if (!id) {
      return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('notices')
      .update({ category, title, content, pinned, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[Notices PUT]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 });
    }

    const { error } = await supabase
      .from('notices')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Notices DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
