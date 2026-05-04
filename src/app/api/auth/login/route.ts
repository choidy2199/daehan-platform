import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/login
 * Body: { loginId, password, keepLogin }
 *
 * Supabase Auth signInWithPassword → public.users (auth_id) → 사이트 권한 체크
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const loginId: string = (body.loginId || '').trim();
    const password: string = body.password || '';
    // const keepLogin: boolean = !!body.keepLogin; // (현재 미사용 — Supabase 세션 만료 정책 사용)

    if (!loginId || !password) {
      return NextResponse.json({ error: '아이디와 비밀번호를 입력하세요.' }, { status: 400 });
    }

    const fakeEmail = `${loginId}@daehantool.dev`;

    // Supabase Auth로 로그인
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: fakeEmail,
      password,
    });
    if (authError || !authData?.user || !authData?.session) {
      return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    // public.users에서 추가 정보 조회 (auth_id 매핑, is_active 체크)
    const { data: pubUser, error: pubErr } = await supabase
      .from('users')
      .select('id, name, login_id, role, is_active')
      .eq('auth_id', authData.user.id)
      .single();
    if (pubErr || !pubUser) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 403 });
    }
    if (!pubUser.is_active) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: '비활성화된 계정입니다.' }, { status: 403 });
    }

    // daehan 사이트 권한 체크
    const { data: access } = await supabase
      .from('user_site_access')
      .select('site_id, sites!inner(code)')
      .eq('user_id', pubUser.id)
      .eq('sites.code', 'daehan')
      .maybeSingle();
    if (!access) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: '대한플랫폼 접속 권한이 없습니다.' }, { status: 403 });
    }

    // last_login_at 갱신 (fire-and-forget — 응답 지연 방지)
    if (supabaseAdmin && pubUser.id) {
      supabaseAdmin
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', pubUser.id)
        .then(({ error }) => {
          if (error) console.error('[login] last_login_at update failed:', error);
        });
    }

    return NextResponse.json({
      token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
      expires_at: authData.session.expires_at,
      user: {
        id: pubUser.id,
        name: pubUser.name,
        loginId: pubUser.login_id,
        role: pubUser.role,
      },
    });
  } catch (e: any) {
    console.error('login error:', e);
    return NextResponse.json({ error: '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
