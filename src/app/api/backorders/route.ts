import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('backorders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 상태순 정렬: waiting→partial→done→cancelled
    const statusOrder: Record<string, number> = { waiting: 0, partial: 1, done: 2, cancelled: 3 };
    const sorted = (data || []).sort((a, b) => {
      const sa = statusOrder[a.status] ?? 0;
      const sb = statusOrder[b.status] ?? 0;
      if (sa !== sb) return sa - sb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return NextResponse.json({ success: true, data: sorted });
  } catch (err: any) {
    console.error('[Backorders GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { product_code, product_name, product_type, model, customer_name, customer_code, quantity, note, author } = body;

    if (!product_code || !product_name || !customer_name) {
      return NextResponse.json({ error: '제품코드, 제품명, 거래처명은 필수입니다' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('backorders')
      .insert({
        product_code, product_name, product_type: product_type || 'milwaukee',
        model: model || '', customer_name, customer_code: customer_code || '',
        quantity: quantity || 1, note: note || '', author: author || 'admin',
        status: 'waiting', shipped_qty: 0
      })
      .select().single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[Backorders POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 });

    const updateData: Record<string, any> = {};

    // 출고 처리
    if (body.shipped_qty !== undefined) {
      updateData.shipped_qty = body.shipped_qty;
      const qty = body.quantity || 0;
      if (body.shipped_qty >= qty) {
        updateData.status = 'done';
        updateData.completed_at = new Date().toISOString();
      } else if (body.shipped_qty > 0) {
        updateData.status = 'partial';
      }
    }

    // 취소
    if (body.status === 'cancelled') {
      updateData.status = 'cancelled';
    }

    // 기타 필드
    if (body.note !== undefined) updateData.note = body.note;
    if (body.customer_name !== undefined) updateData.customer_name = body.customer_name;

    const { data, error } = await supabase
      .from('backorders')
      .update(updateData)
      .eq('id', id)
      .select().single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[Backorders PUT]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 });

    const { error } = await supabase.from('backorders').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Backorders DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
