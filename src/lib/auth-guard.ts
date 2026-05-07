import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/** admin 가드: Authorization: Bearer <token> 검증 → public.users.role==='admin' 확인 */
export async function requireAdmin(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'service_role 키가 설정되지 않았습니다.' },
      { status: 500 }
    );
  }
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return NextResponse.json({ error: '인증 토큰이 없습니다.' }, { status: 401 });
  }

  const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !authData?.user) {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
  }

  const { data: userRow, error: dbErr } = await supabaseAdmin
    .from('users')
    .select('id, login_id, role, is_active')
    .eq('auth_id', authData.user.id)
    .maybeSingle();
  if (dbErr || !userRow) {
    return NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 403 });
  }
  if (!userRow.is_active) {
    return NextResponse.json({ error: '비활성화된 계정입니다.' }, { status: 403 });
  }

  const isAdmin = userRow.login_id === 'admin' || userRow.role === 'admin';
  if (!isAdmin) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  return { ok: true as const, user: userRow };
}

/**
 * 로그인 사용자(직원/거래처 무관) 검증.
 * 성공 시 customer_id, dropship 활성/등급도 함께 반환 — 거래처 포털 API에서 활용.
 */
export async function requireUser(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'service_role 키가 설정되지 않았습니다.' }, { status: 500 });
  }
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return NextResponse.json({ error: '인증 토큰이 없습니다.' }, { status: 401 });

  const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !authData?.user) {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
  }
  const { data: userRow, error: dbErr } = await supabaseAdmin
    .from('users')
    .select('id, login_id, name, role, is_active, customer_id')
    .eq('auth_id', authData.user.id)
    .maybeSingle();
  if (dbErr || !userRow) {
    return NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 403 });
  }
  if (!userRow.is_active) {
    return NextResponse.json({ error: '비활성화된 계정입니다.' }, { status: 403 });
  }
  return { ok: true as const, user: userRow };
}

/**
 * 거래처 포털용 가드. role='customer' + customer_id 매핑 + dropship_enabled + dropship_price_grade 필수.
 * 미충족 시 4xx 에러 응답을 그대로 반환.
 */
export async function requireCustomer(request: NextRequest) {
  const result = await requireUser(request);
  if (result instanceof NextResponse) return result;

  const u = result.user;
  if (u.role !== 'customer' || !u.customer_id) {
    return NextResponse.json({ error: '거래처 계정이 아닙니다.' }, { status: 403 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'service_role 키가 설정되지 않았습니다.' }, { status: 500 });
  }

  const { data: customer, error } = await supabaseAdmin
    .from('customers')
    .select('id, erp_code, name, dropship_enabled, dropship_price_grade, is_active')
    .eq('id', u.customer_id)
    .maybeSingle();
  if (error || !customer) {
    return NextResponse.json({ error: '거래처 정보를 찾을 수 없습니다.' }, { status: 403 });
  }
  if (!customer.is_active) {
    return NextResponse.json({ error: '비활성화된 거래처입니다.' }, { status: 403 });
  }
  if (!customer.dropship_enabled || !customer.dropship_price_grade) {
    return NextResponse.json(
      { error: '주문접수 포털이 아직 활성화되지 않았습니다. 담당자에게 문의해주세요.' },
      { status: 403 }
    );
  }

  return { ok: true as const, user: u, customer };
}

/**
 * 직원(admin/staff) 가드. role IN ('admin','staff') 또는 login_id='admin' 통과.
 */
export async function requireStaff(request: NextRequest) {
  const result = await requireUser(request);
  if (result instanceof NextResponse) return result;
  const u = result.user;
  const isStaff =
    u.login_id === 'admin' || u.role === 'admin' || u.role === 'staff';
  if (!isStaff) {
    return NextResponse.json({ error: '직원 권한이 필요합니다.' }, { status: 403 });
  }
  return { ok: true as const, user: u };
}
