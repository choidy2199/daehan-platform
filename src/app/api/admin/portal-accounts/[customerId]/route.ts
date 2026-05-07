import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireStaff } from '@/lib/auth-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Grade = 'in' | 'out' | 'pallet';
const VALID_GRADES: Grade[] = ['in', 'out', 'pallet'];

/**
 * PUT /api/admin/portal-accounts/[customerId]
 * body: { dropship_enabled?, dropship_price_grade?, account_active? }
 * 거래처 단가등급/활성 수정 + 매핑된 users.is_active 토글
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const guard = await requireStaff(request);
  if (guard instanceof NextResponse) return guard;
  if (!supabaseAdmin) return NextResponse.json({ error: 'service_role 키 없음' }, { status: 500 });

  const { customerId } = await params;
  const cid = parseInt(customerId, 10);
  if (!cid) return NextResponse.json({ error: 'customerId 오류' }, { status: 400 });

  const body = await request.json().catch(() => ({})) as {
    dropship_enabled?: boolean;
    dropship_price_grade?: Grade;
    account_active?: boolean;
  };

  const update: Record<string, unknown> = {};
  if (typeof body.dropship_enabled === 'boolean') update.dropship_enabled = body.dropship_enabled;
  if (body.dropship_price_grade) {
    if (!VALID_GRADES.includes(body.dropship_price_grade)) {
      return NextResponse.json({ error: 'dropship_price_grade 값 오류' }, { status: 400 });
    }
    update.dropship_price_grade = body.dropship_price_grade;
  }

  if (Object.keys(update).length > 0) {
    const { error } = await supabaseAdmin.from('customers').update(update).eq('id', cid);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (typeof body.account_active === 'boolean') {
    const { error } = await supabaseAdmin
      .from('users')
      .update({ is_active: body.account_active })
      .eq('customer_id', cid)
      .eq('role', 'customer');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
