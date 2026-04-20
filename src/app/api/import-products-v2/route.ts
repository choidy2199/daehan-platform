import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || searchParams.get('search') || '').trim();
    if (q) {
      const { data, error } = await supabase
        .from('import_products_v2')
        .select('*')
        .or(`model.ilike.%${q}%,product_name.ilike.%${q}%`)
        .order('brand', { ascending: true })
        .order('model', { ascending: true })
        .limit(20);
      if (error) throw error;
      return NextResponse.json({ success: true, data: data || [] });
    }
    const { data, error } = await supabase
      .from('import_products_v2')
      .select('*')
      .order('brand', { ascending: true })
      .order('model', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ success: true, data: data || [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brand, model, product_name, spec, pallet_qty, base_fob_usd, memo } = body || {};
    if (!brand || !model) {
      return NextResponse.json({ success: false, error: '브랜드, 모델은 필수입니다' }, { status: 400 });
    }
    const baseFob = Math.max(0, Number(base_fob_usd) || 0);
    const { data, error } = await supabase
      .from('import_products_v2')
      .insert({
        brand: String(brand).trim(),
        model: String(model).trim(),
        product_name: product_name?.trim() || null,
        spec: spec?.trim() || null,
        pallet_qty: Number(pallet_qty) || 0,
        base_fob_usd: baseFob,
        memo: memo?.trim() || null,
      })
      .select('*')
      .single();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: false, error: '이미 등록된 제품입니다', code: 'DUPLICATE' }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, brand, model, product_name, spec, pallet_qty, base_fob_usd, memo } = body || {};
    if (!id) return NextResponse.json({ success: false, error: 'id 필수' }, { status: 400 });
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (brand !== undefined) payload.brand = String(brand).trim();
    if (model !== undefined) payload.model = String(model).trim();
    if (product_name !== undefined) payload.product_name = product_name?.trim() || null;
    if (spec !== undefined) payload.spec = spec?.trim() || null;
    if (pallet_qty !== undefined) payload.pallet_qty = Number(pallet_qty) || 0;
    if (base_fob_usd !== undefined) payload.base_fob_usd = Math.max(0, Number(base_fob_usd) || 0);
    if (memo !== undefined) payload.memo = memo?.trim() || null;
    const { data, error } = await supabase
      .from('import_products_v2')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: false, error: '이미 등록된 제품입니다', code: 'DUPLICATE' }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'id 필수' }, { status: 400 });
    const { error } = await supabase.from('import_products_v2').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
