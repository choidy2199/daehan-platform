import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/logout
 * Header: Authorization: Bearer <access_token>
 * 서버 측 세션 무효화 (Supabase Admin API)
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (token && supabaseAdmin) {
      const { data } = await supabaseAdmin.auth.getUser(token);
      if (data?.user) {
        // 해당 access_token이 가리키는 세션을 서버 측에서 무효화
        await supabaseAdmin.auth.admin.signOut(token);
      }
    }
    return NextResponse.json({ ok: true });
  } catch {
    // 로그아웃은 실패해도 클라이언트가 토큰 지우면 사실상 로그아웃됨
    return NextResponse.json({ ok: true });
  }
}
