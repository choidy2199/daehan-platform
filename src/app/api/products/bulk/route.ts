import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 30;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function toDb(p: any) {
  return {
    code: p.code || '',
    manage_code: p.manageCode || '',
    category: p.category || '',
    subcategory: p.subcategory || '',
    detail: p.detail || '',
    order_num: p.orderNum || '',
    tti_num: p.ttiNum || '',
    model: p.model || '',
    description: p.description || '',
    supply_price: p.supplyPrice || 0,
    product_dc: p.productDC || 0,
    cost: p.cost || 0,
    price_a: p.priceA || 0,
    price_retail: p.priceRetail || 0,
    price_naver: p.priceNaver || 0,
    price_open: p.priceOpen || 0,
    raised_price: p.raisedPrice || 0,
    raise_rate: p.raiseRate || 0,
    discontinued: p.discontinued || '',
    tti_stock: p.ttiStock || '',
    in_date: p.inDate || '',
    product_type: 'milwaukee',
  };
}

/**
 * POST /api/products/bulk
 * Body: { products: [...], mode: 'replace' | 'merge' }
 *
 * replace: 기존 milwaukee 전체 삭제 후 새로 등록
 * merge: code 기준 upsert (있으면 수정, 없으면 등록)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const products: any[] = body.products || [];
    const mode: string = body.mode || 'merge';

    if (!products.length) {
      return NextResponse.json({ error: '제품 데이터가 없습니다' }, { status: 400 });
    }

    const dbRows = products.map(toDb);
    let result = { inserted: 0, updated: 0, deleted: 0 };

    if (mode === 'replace') {
      // 기존 milwaukee 제품 전체 삭제
      const { error: delError } = await supabase
        .from('products')
        .delete()
        .eq('product_type', 'milwaukee');

      if (delError) throw delError;

      // 500개씩 배치 insert
      for (let i = 0; i < dbRows.length; i += 500) {
        const batch = dbRows.slice(i, i + 500);
        const { error } = await supabase.from('products').insert(batch);
        if (error) throw error;
        result.inserted += batch.length;
      }
    } else {
      // merge: code 기준 upsert (500개씩 배치)
      for (let i = 0; i < dbRows.length; i += 500) {
        const batch = dbRows.slice(i, i + 500);
        const { error } = await supabase
          .from('products')
          .upsert(batch, { onConflict: 'code,product_type' });
        if (error) throw error;
        result.inserted += batch.length;
      }
    }

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    console.error('[Products Bulk]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
