import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// camelCase(app.js) ↔ snake_case(DB) 변환
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

function toApp(row: any) {
  return {
    id: row.id,
    code: row.code || '',
    manageCode: row.manage_code || '',
    category: row.category || '',
    subcategory: row.subcategory || '',
    detail: row.detail || '',
    orderNum: row.order_num || '',
    ttiNum: row.tti_num || '',
    model: row.model || '',
    description: row.description || '',
    supplyPrice: row.supply_price || 0,
    productDC: row.product_dc || 0,
    cost: row.cost || 0,
    priceA: row.price_a || 0,
    priceRetail: row.price_retail || 0,
    priceNaver: row.price_naver || 0,
    priceOpen: row.price_open || 0,
    raisedPrice: row.raised_price || 0,
    raiseRate: row.raise_rate || 0,
    discontinued: row.discontinued || '',
    ttiStock: row.tti_stock || '',
    inDate: row.in_date || '',
  };
}

/**
 * GET /api/products — 밀워키 제품 전체 조회
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('product_type', 'milwaukee')
      .order('id', { ascending: true });

    if (error) throw error;

    const products = (data || []).map(toApp);
    return NextResponse.json({ products });
  } catch (err: any) {
    console.error('[Products GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/products — 제품 1건 등록
 * Body: { product: {...} }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const dbRow = toDb(body.product);

    const { data, error } = await supabase
      .from('products')
      .insert(dbRow)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ product: toApp(data) });
  } catch (err: any) {
    console.error('[Products POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PUT /api/products — 제품 1건 수정
 * Body: { id, product: {...} }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, product } = body;

    if (!id) {
      return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 });
    }

    const dbRow = toDb(product);
    delete (dbRow as any).product_type; // product_type은 변경 안 함

    const { data, error } = await supabase
      .from('products')
      .update(dbRow)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ product: toApp(data) });
  } catch (err: any) {
    console.error('[Products PUT]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/products — 제품 1건 삭제
 * Body: { id }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 });
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Products DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
