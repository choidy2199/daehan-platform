import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/auth/users — 목록 (email 노출 X) */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, login_id, role, is_active, auth_id, created_at, updated_at')
      .order('id', { ascending: true });
    if (error) throw error;

    const users = (data || []).map((u: any) => ({
      id: u.id,
      name: u.name,
      loginId: u.login_id || '',
      role: u.role,
      isActive: u.is_active,
      lastLogin: u.updated_at,
      createdAt: u.created_at,
    }));

    return NextResponse.json({ users });
  } catch (err: any) {
    console.error('[Users GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** POST /api/auth/users — 추가 (Supabase Admin API) */
export async function POST(request: NextRequest) {
  try {
    const guard = await requireAdmin(request);
    if (guard instanceof NextResponse) return guard;
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'service_role 키가 설정되지 않았습니다.' }, { status: 500 });
    }
    const { name, loginId, password, role, isActive } = await request.json();
    if (!name || !loginId || !password) {
      return NextResponse.json({ error: '이름, 아이디, 비밀번호를 입력하세요' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: '비밀번호는 6자 이상이어야 합니다' }, { status: 400 });
    }

    // 중복 체크
    const { data: dup } = await supabase
      .from('users')
      .select('id')
      .eq('login_id', loginId)
      .maybeSingle();
    if (dup) {
      return NextResponse.json({ error: '이미 존재하는 아이디입니다' }, { status: 409 });
    }

    const fakeEmail = `${loginId}@daehantool.dev`;

    // auth.users 생성
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: fakeEmail,
      password,
      email_confirm: true,
      user_metadata: { name, role: role || 'staff', login_id: loginId },
    });
    if (authErr || !authUser?.user) {
      return NextResponse.json(
        { error: 'Auth 사용자 생성 실패: ' + (authErr?.message || '') },
        { status: 500 }
      );
    }

    // public.users 동기화
    const { data: inserted, error: insErr } = await supabase
      .from('users')
      .insert({
        name,
        login_id: loginId,
        email: fakeEmail,
        role: role || 'staff',
        auth_id: authUser.user.id,
        is_active: isActive !== false,
      })
      .select()
      .single();

    if (insErr) {
      // 롤백
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json({ error: 'DB 동기화 실패: ' + insErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user: { id: inserted.id, name: inserted.name, loginId, role: inserted.role },
    });
  } catch (err: any) {
    console.error('[Users POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** PUT /api/auth/users — 수정 (비번 변경 시 Supabase Admin API) */
export async function PUT(request: NextRequest) {
  try {
    const guard = await requireAdmin(request);
    if (guard instanceof NextResponse) return guard;
    const { id, name, loginId, password, role, isActive } = await request.json();
    if (!id) return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 });

    const { data: current, error: curErr } = await supabase
      .from('users')
      .select('id, auth_id, login_id, email')
      .eq('id', id)
      .single();
    if (curErr || !current) {
      return NextResponse.json({ error: '대상 사용자를 찾을 수 없습니다' }, { status: 404 });
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;
    if (isActive !== undefined) updates.is_active = isActive;

    // loginId 변경 시 email/login_id 업데이트 + auth.users 이메일도 변경
    if (loginId !== undefined && loginId !== current.login_id) {
      const newEmail = `${loginId}@daehantool.dev`;
      updates.login_id = loginId;
      updates.email = newEmail;
      if (current.auth_id && supabaseAdmin) {
        const { error: emailErr } = await supabaseAdmin.auth.admin.updateUserById(
          current.auth_id,
          { email: newEmail }
        );
        if (emailErr) {
          return NextResponse.json(
            { error: 'Auth 이메일 변경 실패: ' + emailErr.message },
            { status: 500 }
          );
        }
      }
    }

    // 비번 변경
    if (password && password.length >= 6) {
      if (!current.auth_id || !supabaseAdmin) {
        return NextResponse.json(
          { error: 'auth_id가 없거나 service_role 키가 설정되지 않았습니다.' },
          { status: 500 }
        );
      }
      const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(
        current.auth_id,
        { password }
      );
      if (pwErr) {
        return NextResponse.json(
          { error: '비밀번호 변경 실패: ' + pwErr.message },
          { status: 500 }
        );
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error: updErr } = await supabase.from('users').update(updates).eq('id', id);
      if (updErr) throw updErr;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Users PUT]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** DELETE /api/auth/users — 삭제 (auth.users + public.users) */
export async function DELETE(request: NextRequest) {
  try {
    const guard = await requireAdmin(request);
    if (guard instanceof NextResponse) return guard;
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 });

    const { data: current } = await supabase
      .from('users')
      .select('id, auth_id')
      .eq('id', id)
      .single();

    if (current?.auth_id && supabaseAdmin) {
      await supabaseAdmin.auth.admin.deleteUser(current.auth_id);
    }

    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Users DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
