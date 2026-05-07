import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireStaff } from '@/lib/auth-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function genTempPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz';
  let out = '';
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/**
 * POST /api/admin/portal-accounts/[customerId]/reset-password
 * 매핑된 거래처 계정의 비밀번호를 임시값으로 재설정. 응답 한 번만 표시.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const guard = await requireStaff(request);
  if (guard instanceof NextResponse) return guard;
  if (!supabaseAdmin) return NextResponse.json({ error: 'service_role 키 없음' }, { status: 500 });

  const { customerId } = await params;
  const cid = parseInt(customerId, 10);
  if (!cid) return NextResponse.json({ error: 'customerId 오류' }, { status: 400 });

  const { data: user, error: uErr } = await supabaseAdmin
    .from('users')
    .select('id, login_id, auth_id')
    .eq('customer_id', cid)
    .eq('role', 'customer')
    .maybeSingle();
  if (uErr || !user || !user.auth_id) {
    return NextResponse.json({ error: '거래처 계정 없음' }, { status: 404 });
  }

  const tempPassword = genTempPassword();
  const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(user.auth_id, {
    password: tempPassword,
  });
  if (authErr) {
    return NextResponse.json({ error: '비밀번호 재설정 실패: ' + authErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, login_id: user.login_id, temp_password: tempPassword });
}
