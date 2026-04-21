import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { data, error } = await supabase
      .from('import_po_items')
      .select('*')
      .eq('po_id', id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ success: true, data: data || [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST: 제품V2 기반 벌크 INSERT
// body: { products: [{ id, brand, model, product_name, spec, pallet_qty, base_fob_usd, internal_code, management_code }] }
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: poId } = await context.params;
    const body = await request.json();
    const products = Array.isArray(body?.products) ? body.products : [];
    if (products.length === 0) {
      return NextResponse.json({ success: true, data: { inserted: 0 } });
    }
    const payload = products.map((p: Record<string, unknown>, idx: number) => ({
      po_id: poId,
      brand: p?.brand ? String(p.brand).trim() || null : null,
      model: p?.model ? String(p.model).trim() || null : null,
      product_name: p?.product_name ? String(p.product_name).trim() || null : null,
      spec: p?.spec ? String(p.spec).trim() || null : null,
      internal_code: p?.internal_code ? String(p.internal_code).trim() || null : null,
      management_code: p?.management_code ? String(p.management_code).trim() || null : null,
      pallet_qty: Number(p?.pallet_qty) || 0,
      quantity: 0,
      fob_usd: Math.max(0, Number(p?.base_fob_usd) || 0),
      sort_order: idx,
    }));
    const { data, error } = await supabase
      .from('import_po_items')
      .insert(payload)
      .select('*');
    if (error) throw error;
    return NextResponse.json({ success: true, data: data || [], inserted: payload.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// DELETE: 해당 PO의 모든 아이템 삭제 (브랜드 변경 시)
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: poId } = await context.params;
    const { error } = await supabase
      .from('import_po_items')
      .delete()
      .eq('po_id', poId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
