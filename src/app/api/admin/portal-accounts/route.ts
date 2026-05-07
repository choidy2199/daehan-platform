import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireStaff } from '@/lib/auth-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAEHAN_SITE_ID = 1;

type Grade = 'in' | 'out' | 'pallet';
const VALID_GRADES: Grade[] = ['in', 'out', 'pallet'];

function genTempPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz';
  let out = '';
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** GET /api/admin/portal-accounts?q=&onlyActive=1 — 거래처 + 포털 계정 매핑 목록 */
export async function GET(request: NextRequest) {
  const guard = await requireStaff(request);
  if (guard instanceof NextResponse) return guard;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'service_role 키 없음' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const onlyActive = searchParams.get('onlyActive') === '1';

  let query = supabaseAdmin
    .from('customers')
    .select('id, erp_code, name, is_active, dropship_enabled, dropship_price_grade')
    .eq('is_active', true)
    .order('name')
    .limit(50);

  if (q) {
    query = query.or(`name.ilike.%${q}%,erp_code.ilike.%${q}%`);
  }
  if (onlyActive) query = query.eq('dropship_enabled', true);

  const { data: customers, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (customers || []).map((c) => c.id);
  let accountsByCustomer: Record<number, { login_id: string; is_active: boolean; auth_id: string | null }> = {};
  if (ids.length > 0) {
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, login_id, is_active, customer_id, auth_id')
      .eq('role', 'customer')
      .in('customer_id', ids);
    (users || []).forEach((u) => {
      if (u.customer_id != null) {
        accountsByCustomer[u.customer_id] = {
          login_id: u.login_id,
          is_active: !!u.is_active,
          auth_id: u.auth_id ?? null,
        };
      }
    });
  }

  const items = (customers || []).map((c) => ({
    id: c.id,
    erp_code: c.erp_code,
    name: c.name,
    dropship_enabled: !!c.dropship_enabled,
    dropship_price_grade: c.dropship_price_grade,
    account: accountsByCustomer[c.id] || null,
  }));
  return NextResponse.json({ items });
}

/**
 * POST /api/admin/portal-accounts
 * body: { customer_id, login_id?, dropship_price_grade }
 * 1) Supabase Auth 사용자 생성(이미 있으면 재사용)
 * 2) public.users insert (role='customer', customer_id 매핑)
 * 3) user_site_access insert (daehan)
 * 4) customers.dropship_enabled=true + dropship_price_grade 저장
 * 응답: { temp_password } (한 번만 표시)
 */
export async function POST(request: NextRequest) {
  const guard = await requireStaff(request);
  if (guard instanceof NextResponse) return guard;
  if (!supabaseAdmin) return NextResponse.json({ error: 'service_role 키 없음' }, { status: 500 });

  const body = await request.json().catch(() => null) as
    | { customer_id?: number; login_id?: string; dropship_price_grade?: Grade }
    | null;
  if (!body || !body.customer_id || !body.dropship_price_grade) {
    return NextResponse.json({ error: 'customer_id 와 dropship_price_grade 필수' }, { status: 400 });
  }
  if (!VALID_GRADES.includes(body.dropship_price_grade)) {
    return NextResponse.json({ error: 'dropship_price_grade 값 오류' }, { status: 400 });
  }

  // 1) 거래처 조회
  const { data: customer, error: cErr } = await supabaseAdmin
    .from('customers')
    .select('id, erp_code, name, is_active')
    .eq('id', body.customer_id)
    .maybeSingle();
  if (cErr || !customer) return NextResponse.json({ error: '거래처 없음' }, { status: 404 });
  if (!customer.is_active) return NextResponse.json({ error: '비활성 거래처' }, { status: 400 });

  // 2) 이미 계정 있는지
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id, login_id, auth_id, is_active')
    .eq('customer_id', customer.id)
    .eq('role', 'customer')
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: '이미 계정이 발급된 거래처입니다. 비밀번호 재설정을 사용하세요.' },
      { status: 409 }
    );
  }

  // 3) login_id 결정 (제공값 또는 erp_code 기본)
  const loginId = (body.login_id || customer.erp_code || '').trim();
  if (!loginId) {
    return NextResponse.json({ error: 'login_id가 비어있습니다 (ERP 코드 미설정)' }, { status: 400 });
  }
  const fakeEmail = `${loginId}@daehantool.dev`;

  // 4) login_id 중복 체크
  const { data: dupLogin } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('login_id', loginId)
    .maybeSingle();
  if (dupLogin) {
    return NextResponse.json({ error: `login_id '${loginId}' 가 이미 사용 중입니다.` }, { status: 409 });
  }

  // 5) Supabase Auth 사용자 생성
  const tempPassword = genTempPassword();
  const { data: created, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email: fakeEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { customer_id: customer.id, role: 'customer' },
  });
  if (authErr || !created?.user) {
    return NextResponse.json({ error: 'Auth 계정 생성 실패: ' + (authErr?.message || '') }, { status: 500 });
  }

  // 6) public.users insert
  const { data: pubUser, error: insErr } = await supabaseAdmin
    .from('users')
    .insert({
      auth_id: created.user.id,
      email: fakeEmail,
      login_id: loginId,
      name: customer.name,
      role: 'customer',
      customer_id: customer.id,
      is_active: true,
    })
    .select('id')
    .single();
  if (insErr || !pubUser) {
    // 롤백: Auth 사용자 삭제
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: 'users insert 실패: ' + (insErr?.message || '') }, { status: 500 });
  }

  // 7) user_site_access insert (daehan)
  const { error: accessErr } = await supabaseAdmin
    .from('user_site_access')
    .insert({
      user_id: pubUser.id,
      site_id: DAEHAN_SITE_ID,
      access_level: 'user',
      granted_by: guard.user.id,
    });
  if (accessErr) {
    // 정리: users + auth 모두 삭제
    await supabaseAdmin.from('users').delete().eq('id', pubUser.id);
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: '사이트 접근권한 부여 실패: ' + accessErr.message }, { status: 500 });
  }

  // 8) customers.dropship_enabled=true + 등급 저장
  const { error: updErr } = await supabaseAdmin
    .from('customers')
    .update({
      dropship_enabled: true,
      dropship_price_grade: body.dropship_price_grade,
    })
    .eq('id', customer.id);
  if (updErr) {
    return NextResponse.json({ error: '거래처 활성화 실패: ' + updErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    customer_id: customer.id,
    login_id: loginId,
    temp_password: tempPassword,
  });
}
