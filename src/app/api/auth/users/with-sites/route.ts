import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/auth/users/with-sites — 사용자 목록 + 각 사이트 권한 배열 */
export async function GET(_request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'service_role 키가 설정되지 않았습니다.' }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select(`
      id, login_id, name, email, role, is_active, created_at, updated_at,
      user_site_access!user_site_access_user_id_fkey (
        site_id,
        access_level,
        sites ( code )
      )
    `)
    .eq('is_active', true)
    .order('id', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const users = (data || []).map((u: any) => ({
    id: u.id,
    loginId: u.login_id,
    name: u.name,
    email: u.email,
    role: u.role,
    isActive: u.is_active,
    lastLoginAt: u.updated_at,
    createdAt: u.created_at,
    sites: (u.user_site_access || [])
      .map((a: any) => a.sites?.code)
      .filter((c: string | null | undefined): c is string => !!c),
  }));

  return NextResponse.json(users);
}
