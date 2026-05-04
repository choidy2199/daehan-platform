import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/check
 * Header: Authorization: Bearer <access_token>
 * Supabase Admin API로 토큰 유효성 + public.users 활성 상태 검증
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return NextResponse.json({ valid: false, reason: 'no_token' }, { status: 401 });
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ valid: false, reason: 'admin_unavailable' }, { status: 500 });
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      return NextResponse.json({ valid: false, reason: 'invalid_token' }, { status: 401 });
    }

    const { data: pubUser } = await supabase
      .from('users')
      .select('id, name, login_id, role, is_active')
      .eq('auth_id', data.user.id)
      .single();
    if (!pubUser || !pubUser.is_active) {
      return NextResponse.json({ valid: false, reason: 'inactive' }, { status: 401 });
    }

    return NextResponse.json({
      valid: true,
      user: {
        id: pubUser.id,
        name: pubUser.name,
        loginId: pubUser.login_id,
        role: pubUser.role,
      },
    });
  } catch {
    return NextResponse.json({ valid: false, reason: 'server_error' }, { status: 500 });
  }
}
