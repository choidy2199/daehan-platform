import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getLastUnitPrice } from '@/lib/transactions';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerCode = searchParams.get('customerCode');
    const productCode = searchParams.get('productCode');
    const specParam = searchParams.get('spec');
    const spec = specParam && specParam.length > 0 ? specParam : undefined;

    if (!customerCode || !productCode) {
      return NextResponse.json(
        { error: 'customerCode, productCode 파라미터가 필요합니다' },
        { status: 400 }
      );
    }

    const price = await getLastUnitPrice(customerCode, productCode, spec, supabase);

    return NextResponse.json({ success: true, data: { unit_price: price } });
  } catch (err: any) {
    console.error('[Transactions LastPrice GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
