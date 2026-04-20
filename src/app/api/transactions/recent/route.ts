import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRecentTransactionsByCustomer } from '@/lib/transactions';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerCode = searchParams.get('customerCode');
    const limitStr = searchParams.get('limit');

    if (!customerCode) {
      return NextResponse.json({ error: 'customerCode 파라미터가 필요합니다' }, { status: 400 });
    }

    const limit = limitStr ? Math.max(1, parseInt(limitStr, 10)) : 10;
    const data = await getRecentTransactionsByCustomer(customerCode, limit, supabase);

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[Transactions Recent GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
