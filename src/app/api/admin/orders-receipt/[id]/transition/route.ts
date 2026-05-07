import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireStaff } from '@/lib/auth-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Action = 'confirm' | 'ship' | 'complete' | 'cancel';

const TRANSITIONS: Record<Action, { from: string[]; to: string; tsField?: string }> = {
  confirm:  { from: ['waiting'],   to: 'confirmed', tsField: 'erp_confirmed_at' },
  ship:     { from: ['confirmed'], to: 'shipped',   tsField: 'shipped_at' },
  complete: { from: ['shipped'],   to: 'done',      tsField: 'completed_at' },
  cancel:   { from: ['waiting', 'confirmed'], to: 'canceled', tsField: 'canceled_at' },
};

/**
 * POST /api/admin/orders-receipt/[id]/transition
 * body: { action: 'confirm'|'ship'|'complete'|'cancel', ship_carrier?, ship_tracking_no? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireStaff(request);
  if (guard instanceof NextResponse) return guard;
  if (!supabaseAdmin) return NextResponse.json({ error: 'service_role 키 없음' }, { status: 500 });

  const { id } = await params;
  const body = await request.json().catch(() => ({})) as {
    action?: Action;
    ship_carrier?: string;
    ship_tracking_no?: string;
  };
  if (!body.action || !(body.action in TRANSITIONS)) {
    return NextResponse.json({ error: 'action 오류' }, { status: 400 });
  }
  const t = TRANSITIONS[body.action];

  const { data: order, error: oErr } = await supabaseAdmin
    .from('customer_orders').select('id, status, ship_type').eq('id', id).maybeSingle();
  if (oErr || !order) return NextResponse.json({ error: '주문 없음' }, { status: 404 });
  if (!t.from.includes(order.status)) {
    return NextResponse.json({ error: `현재 상태(${order.status})에서 ${body.action} 불가` }, { status: 409 });
  }

  // 직송 출고 시 운송장 필수
  if (body.action === 'ship' && order.ship_type === 'direct') {
    if (!body.ship_tracking_no) {
      return NextResponse.json({ error: '직송 출고는 운송장 번호 필수' }, { status: 400 });
    }
  }

  const update: Record<string, unknown> = { status: t.to };
  if (t.tsField) update[t.tsField] = new Date().toISOString();
  if (body.ship_carrier) update.ship_carrier = body.ship_carrier;
  if (body.ship_tracking_no) update.ship_tracking_no = body.ship_tracking_no;

  const { error } = await supabaseAdmin.from('customer_orders').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, status: t.to });
}
