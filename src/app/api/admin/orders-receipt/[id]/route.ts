import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireStaff } from '@/lib/auth-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/orders-receipt/[id] */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireStaff(request);
  if (guard instanceof NextResponse) return guard;
  if (!supabaseAdmin) return NextResponse.json({ error: 'service_role 키 없음' }, { status: 500 });

  const { id } = await params;
  const { data: order, error: oErr } = await supabaseAdmin
    .from('customer_orders').select('*').eq('id', id).maybeSingle();
  if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: '주문 없음' }, { status: 404 });

  const { data: items, error: iErr } = await supabaseAdmin
    .from('customer_order_items').select('*').eq('order_id', id).order('line_no');
  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

  return NextResponse.json({ order, items: items || [] });
}

/** PUT /api/admin/orders-receipt/[id] — 내부 메모/운송장 수정 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireStaff(request);
  if (guard instanceof NextResponse) return guard;
  if (!supabaseAdmin) return NextResponse.json({ error: 'service_role 키 없음' }, { status: 500 });

  const { id } = await params;
  const body = await request.json().catch(() => ({})) as {
    internal_note?: string;
    ship_carrier?: string;
    ship_tracking_no?: string;
  };
  const update: Record<string, unknown> = {};
  if (typeof body.internal_note === 'string') update.internal_note = body.internal_note;
  if (typeof body.ship_carrier === 'string') update.ship_carrier = body.ship_carrier;
  if (typeof body.ship_tracking_no === 'string') update.ship_tracking_no = body.ship_tracking_no;
  if (Object.keys(update).length === 0) return NextResponse.json({ success: true });

  const { error } = await supabaseAdmin.from('customer_orders').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
