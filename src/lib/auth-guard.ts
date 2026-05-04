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
