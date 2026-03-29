import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function toDb(p: any) {
  const extra: any = {};
  if (p.orderNum) extra.orderNum = p.orderNum;
  if (p.ttiNum) extra.ttiNum = p.ttiNum;
  if (p.ttiStock) extra.ttiStock = p.ttiStock;
  if (p.inDate) extra.inDate = p.inDate;
  if (p.raisedPrice) extra.raisedPrice = p.raisedPrice;
  if (p.raiseRate) extra.raiseRate = p.raiseRate;

  return {
    part_code: p.code || '',
    erp_code: p.manageCode || '',
    category: p.category || '',
    mid_code: p.subcategory || '',
    small_code: p.detail || '',
    item_name: p.model || '',
    spec: p.description || '',
    supply_price: p.supplyPrice || 0,
    product_dc: p.productDC || 0,
    calculated_cost: p.cost || 0,
    out_price_a: p.priceA || 0,
    out_price_base: p.priceRetail || 0,
    out_price_b: p.priceNaver || 0,
    out_price_c: p.priceOpen || 0,
    is_active: !p.discontinued || p.discontinued === '' || p.discontinued === 'N',
    memo: Object.keys(extra).length > 0 ? JSON.stringify(extra) : null,
    product_type: 'milwaukee',
  };
}

/**
 * POST /api/products/bulk
 * Body: { products: [...], mode: 'replace' | 'merge' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const products: any[] = body.products || [];
    const mode: string = body.mode || 'merge';

    if (!products.length) {
      return NextResponse.json({ error: '제품 데이터가 없습니다' }, { status: 400 });
    }

    console.log(`[Products Bulk] 요청: ${products.length}건, mode=${mode}, 첫번째 code=${products[0]?.code || 'N/A'}`);

    const dbRows = products.map(toDb);
    let result = { inserted: 0, deleted: 0 };

    // 기존 milwaukee 제품 삭제
    const { data: delData, error: delError } = await supabase
      .from('products')
      .delete()
      .eq('product_type', 'milwaukee')
      .select('id');

    if (delError) {
      console.error('[Products Bulk] 삭제 실패:', delError);
      throw delError;
    }
    result.deleted = delData ? delData.length : 0;
    console.log(`[Products Bulk] 기존 삭제: ${result.deleted}건`);

    // 500개씩 배치 insert
    for (let i = 0; i < dbRows.length; i += 500) {
      const batch = dbRows.slice(i, i + 500);
      const { error } = await supabase.from('products').insert(batch);
      if (error) {
        console.error(`[Products Bulk] insert 배치 ${i/500+1} 실패:`, error);
        throw error;
      }
      result.inserted += batch.length;
      console.log(`[Products Bulk] insert 배치 ${i/500+1}: ${batch.length}건 성공`);
    }

    console.log('[Products Bulk] 완료:', JSON.stringify(result));
    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    console.error('[Products Bulk]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
