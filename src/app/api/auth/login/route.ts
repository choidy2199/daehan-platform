import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/auth/login
 * Body: { loginId, password, keepLogin }
 *
 * users 테이블 매핑:
 * - email = "loginId|passwordHash" (파이프로 분리)
 * - name = 이름
 * - role = admin/staff/customer
 * - is_active = 승인 여부
 */
export async function POST(request: NextRequest) {
  try {
    const { loginId, password, keepLogin } = await request.json();
    if (!loginId || !password) {
      return NextResponse.json({ error: '아이디와 비밀번호를 입력하세요' }, { status: 400 });
    }

    // 전체 users 조회 후 email 필드에서 loginId 매칭
    const { data: users, error } = await supabase.from('users').select('*');
    if (error) throw error;

    const user = (users || []).find(u => {
      const parts = (u.email || '').split('|');
      return parts[0] === loginId;
    });

    if (!user) {
      return NextResponse.json({ error: '아이디 또는 비밀번호가 일치하지 않습니다' }, { status: 401 });
    }

    const parts = (user.email || '').split('|');
    const hash = parts.slice(1).join('|'); // bcrypt 해시에 | 포함 가능성 대비
    if (!bcrypt.compareSync(password, hash)) {
      return NextResponse.json({ error: '아이디 또는 비밀번호가 일치하지 않습니다' }, { status: 401 });
    }

    if (!user.is_active) {
      return NextResponse.json({ error: '승인 대기 중인 계정입니다. 관리자에게 문의하세요.' }, { status: 403 });
    }

    // 세션 토큰
    const token = crypto.randomUUID();
    const expires = keepLogin
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

    // role 필드에 "역할|token|expires" 저장 → 너무 복잡. 대신 updated_at을 사용
    // updated_at은 timestamp이므로 사용 불가. auth_id는 UUID.
    // → role 필드에 "admin" 유지하고, session은 클라이언트에서만 관리
    // 서버 세션 검증 대신 간단한 토큰 방식 사용
    await supabase.from('users').update({ updated_at: new Date().toISOString() }).eq('id', user.id);

    return NextResponse.json({
      success: true,
      token: token + '|' + expires,
      user: { id: user.id, name: user.name, loginId, role: user.role },
    });
  } catch (err: any) {
    console.error('[Auth Login]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
