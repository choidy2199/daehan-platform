import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// camelCase(app.js) → snake_case(기존 products 테이블) 변환
// orderNum, ttiNum, ttiStock, inDate, raisedPrice, raiseRate → memo JSON에 저장
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

// snake_case(DB) → camelCase(app.js) 변환
function toApp(row: any) {
  let extra: any = {};
  try { if (row.memo) extra = JSON.parse(row.memo); } catch {}

  return {
    id: row.id,
    code: row.part_code || '',
    manageCode: row.erp_code || '',
    category: row.category || '',
    subcategory: row.mid_code || '',
    detail: row.small_code || '',
    orderNum: extra.orderNum || '',
    ttiNum: extra.ttiNum || '',
    model: row.item_name || '',
    description: row.spec || '',
    supplyPrice: row.supply_price || 0,
    productDC: row.product_dc || 0,
    cost: row.calculated_cost || 0,
    priceA: row.out_price_a || 0,
    priceRetail: row.out_price_base || 0,
    priceNaver: row.out_price_b || 0,
    priceOpen: row.out_price_c || 0,
    raisedPrice: extra.raisedPrice || 0,
    raiseRate: extra.raiseRate || 0,
    discontinued: row.is_active === false ? '단종' : '',
    ttiStock: extra.ttiStock || '',
    inDate: extra.inDate || '',
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
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, product } = body;
    if (!id) return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 });

    const dbRow = toDb(product);
    delete (dbRow as any).product_type;

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
 * DELETE /api/products
 * Body: { id } — 1건 삭제
 * Body: { deleteAll: true, productType: 'milwaukee' } — 전체 삭제
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();

    // 전체 삭제
    if (body.deleteAll && body.productType) {
      const { data, error } = await supabase
        .from('products')
        .delete()
        .eq('product_type', body.productType)
        .select('id');
      if (error) throw error;
      const count = data ? data.length : 0;
      console.log(`[Products DELETE ALL] ${body.productType}: ${count}건 삭제`);
      return NextResponse.json({ success: true, deleted: count });
    }

    // 1건 삭제
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 });

    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Products DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
