import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireStaff } from '@/lib/auth-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES = ['waiting', 'confirmed', 'shipped', 'done', 'canceled'] as const;
type Status = (typeof STATUSES)[number];

/** GET /api/admin/orders-receipt?status=&shipType=&q=&from=&to= */
export async function GET(request: NextRequest) {
  const guard = await requireStaff(request);
  if (guard instanceof NextResponse) return guard;
  if (!supabaseAdmin) return NextResponse.json({ error: 'service_role 키 없음' }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') as Status | null;
  const shipType = searchParams.get('shipType');
  const q = (searchParams.get('q') || '').trim();
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  let query = supabaseAdmin
    .from('customer_orders')
    .select('id, order_no, customer_id, customer_code, customer_name, status, ship_type, price_grade, total_amount, total_qty, ship_tracking_no, created_at, shipped_at, completed_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (status && STATUSES.includes(status)) query = query.eq('status', status);
  if (shipType === 'normal' || shipType === 'direct') query = query.eq('ship_type', shipType);
  if (q) query = query.or(`order_no.ilike.%${q}%,customer_name.ilike.%${q}%`);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to + 'T23:59:59');

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // KPI 카운트 (전체 — 필터 무관)
  const { data: counts } = await supabaseAdmin
    .from('customer_orders')
    .select('status');
  const kpi = { waiting: 0, confirmed: 0, shipped: 0, done: 0, canceled: 0 } as Record<Status, number>;
  (counts || []).forEach((r: any) => { if (kpi[r.status as Status] != null) kpi[r.status as Status]++; });

  return NextResponse.json({ items: data || [], kpi });
}
