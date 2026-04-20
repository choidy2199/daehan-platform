import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCustomerStats } from '@/lib/transactions';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerCode = searchParams.get('customerCode');
    const monthsStr = searchParams.get('months');

    if (!customerCode) {
      return NextResponse.json({ error: 'customerCode 파라미터가 필요합니다' }, { status: 400 });
    }

    const months = monthsStr ? Math.max(1, parseInt(monthsStr, 10)) : 6;
    const data = await getCustomerStats(customerCode, months, supabase);

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[Transactions Stats GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
