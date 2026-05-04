import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '../../route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/auth/users/[id]/sites — 특정 사용자의 사이트 권한 배열 (검증용) */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'service_role 키가 없습니다.' }, { status: 500 });
  }

  const userId = parseInt(params.id, 10);
  if (isNaN(userId)) {
    return NextResponse.json({ error: 'invalid user id' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('user_site_access')
    .select('site_id, access_level, sites!inner(id, code)')
    .eq('user_id', userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sites = (data || []).map((r: any) => ({
    siteId: r.site_id,
    code: r.sites?.code,
    accessLevel: r.access_level,
  }));

  return NextResponse.json({ userId, sites });
}

/** PUT /api/auth/users/[id]/sites — 사이트 권한 통째 교체 (delta INSERT/DELETE) */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin(request);
  if (guard instanceof NextResponse) return guard;

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'service_role 키가 없습니다.' }, { status: 500 });
  }

  const userId = parseInt(params.id, 10);
  if (isNaN(userId)) {
    return NextResponse.json({ error: 'invalid user id' }, { status: 400 });
  }

  const body = await request.json();
  const requestedCodes: string[] = Array.isArray(body.sites) ? body.sites : [];

  // 자물쇠: admin 자기 daehan 권한은 회수 불가
  const requesterUserId = (guard as any).user?.id;
  if (requesterUserId === userId && !requestedCodes.includes('daehan')) {
    return NextResponse.json(
      { error: '본인의 대한플랫폼 권한은 제거할 수 없습니다.' },
      { status: 403 }
    );
  }

  // 1. sites 코드 → site_id 매핑
  const { data: allSites, error: siteErr } = await supabaseAdmin
    .from('sites')
    .select('id, code');
  if (siteErr) {
    return NextResponse.json({ error: siteErr.message }, { status: 500 });
  }
  const codeToId: Record<string, number> = {};
  (allSites || []).forEach((s: any) => {
    codeToId[s.code] = s.id;
  });

  const requestedSiteIds = requestedCodes
    .map((c) => codeToId[c])
    .filter((id): id is number => typeof id === 'number');

  // 2. 현재 권한 조회
  const { data: current, error: curErr } = await supabaseAdmin
    .from('user_site_access')
    .select('site_id')
    .eq('user_id', userId);
  if (curErr) {
    return NextResponse.json({ error: curErr.message }, { status: 500 });
  }
  const currentIds = new Set((current || []).map((r: any) => r.site_id));
  const requestedIds = new Set(requestedSiteIds);

  // 3. delta 계산
  const toAdd = [...requestedIds].filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !requestedIds.has(id));

  // INSERT
  if (toAdd.length > 0) {
    const rows = toAdd.map((sid) => ({
      user_id: userId,
      site_id: sid,
      access_level: 'user',
    }));
    const { error: insErr } = await supabaseAdmin
      .from('user_site_access')
      .insert(rows);
    if (insErr) {
      return NextResponse.json(
        { error: 'INSERT 실패: ' + insErr.message },
        { status: 500 }
      );
    }
  }

  // DELETE
  if (toRemove.length > 0) {
    const { error: delErr } = await supabaseAdmin
      .from('user_site_access')
      .delete()
      .eq('user_id', userId)
      .in('site_id', toRemove);
    if (delErr) {
      return NextResponse.json(
        { error: 'DELETE 실패: ' + delErr.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    userId,
    added: toAdd.length,
    removed: toRemove.length,
    finalSites: requestedCodes,
  });
}
