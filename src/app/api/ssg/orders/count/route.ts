import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ count: 0, error: 'admin_unavailable' }, { status: 500 });
    }
    const { count, error } = await supabaseAdmin
      .from('ssg_orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new');
    if (error) throw error;
    return NextResponse.json({ count: count || 0 });
  } catch (err) {
    console.error('[ssg/orders/count]', err);
    return NextResponse.json({ count: 0, error: String(err) }, { status: 500 });
  }
}
