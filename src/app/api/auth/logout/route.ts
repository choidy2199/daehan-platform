import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/auth/logout
 * Body: { token }
 */
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    if (!token) return NextResponse.json({ success: true });

    const { data: users } = await supabase
      .from('users')
      .select('id, customer_id')
      .like('customer_id', `${token}|%`);

    if (users && users.length > 0) {
      await supabase
        .from('users')
        .update({ customer_id: null })
        .eq('id', users[0].id);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Auth Logout]', err);
    return NextResponse.json({ success: true });
  }
}
