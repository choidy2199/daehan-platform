import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// email = "loginId|passwordHash"
function parseEmail(email: string) {
  const idx = email.indexOf('|');
  if (idx < 0) return { loginId: '', hash: '' };
  return { loginId: email.substring(0, idx), hash: email.substring(idx + 1) };
}

/** GET /api/auth/users */
export async function GET() {
  try {
    const { data, error } = await supabase.from('users').select('*').order('id', { ascending: true });
    if (error) throw error;

    const users = (data || []).map(u => {
      const { loginId } = parseEmail(u.email || '');
      return {
        id: u.id,
        name: u.name,
        loginId,
        role: u.role,
        isActive: u.is_active,
        lastLogin: u.updated_at,
        createdAt: u.created_at,
      };
    });

    return NextResponse.json({ users });
  } catch (err: any) {
    console.error('[Users GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** POST /api/auth/users — 추가 */
export async function POST(request: NextRequest) {
  try {
    const { name, loginId, password, role, isActive } = await request.json();
    if (!name || !loginId || !password) {
      return NextResponse.json({ error: '이름, 아이디, 비밀번호를 입력하세요' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: '비밀번호는 6자 이상이어야 합니다' }, { status: 400 });
    }

    // 중복 체크
    const { data: existing } = await supabase.from('users').select('id, email');
    const dup = (existing || []).some(u => parseEmail(u.email || '').loginId === loginId);
    if (dup) {
      return NextResponse.json({ error: '이미 존재하는 아이디입니다' }, { status: 409 });
    }

    const hash = bcrypt.hashSync(password, 10);
    const emailField = `${loginId}|${hash}`;

    const { data, error } = await supabase
      .from('users')
      .insert({ name, email: emailField, role: role || 'staff', is_active: isActive !== false })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, user: { id: data.id, name: data.name, loginId, role: data.role } });
  } catch (err: any) {
    console.error('[Users POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** PUT /api/auth/users — 수정 */
export async function PUT(request: NextRequest) {
  try {
    const { id, name, loginId, password, role, isActive } = await request.json();
    if (!id) return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 });

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;
    if (isActive !== undefined) updates.is_active = isActive;

    // loginId나 password 변경 시 email 필드 재구성
    if (loginId !== undefined || (password && password.length >= 6)) {
      const { data: current } = await supabase.from('users').select('email').eq('id', id).single();
      const parsed = parseEmail(current?.email || '');
      const newLoginId = loginId !== undefined ? loginId : parsed.loginId;
      const newHash = password && password.length >= 6 ? bcrypt.hashSync(password, 10) : parsed.hash;
      updates.email = `${newLoginId}|${newHash}`;
    }

    const { error } = await supabase.from('users').update(updates).eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Users PUT]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** DELETE /api/auth/users */
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 });
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Users DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
