import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function generateNextPoNumber(year: number): Promise<string> {
  const prefix = `PO-${year}-`;
  const { data, error } = await supabase
    .from('import_po_headers')
    .select('po_number')
    .like('po_number', `${prefix}%`)
    .order('po_number', { ascending: false })
    .limit(1);
  if (error) throw error;
  const lastSeqStr = data && data[0] ? String(data[0].po_number).split('-')[2] : '000';
  const lastSeq = parseInt(lastSeqStr, 10);
  const nextSeq = String((Number.isFinite(lastSeq) ? lastSeq : 0) + 1).padStart(3, '0');
  return `${prefix}${nextSeq}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    let q = supabase.from('import_po_headers').select('*').order('created_at', { ascending: false });
    if (status && status !== 'all') q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;

    // display_brand 폴백: headers.brand가 비었으면 items[0].brand 집계하여 주입
    const headers = (data || []) as Array<Record<string, unknown>>;
    const nullBrandIds = headers
      .filter(h => !h.brand)
      .map(h => h.id as string);
    const firstBrandByPo: Record<string, string> = {};
    if (nullBrandIds.length > 0) {
      const { data: itemBrands } = await supabase
        .from('import_po_items')
        .select('po_id, brand, sort_order')
        .in('po_id', nullBrandIds)
        .order('sort_order', { ascending: true });
      (itemBrands || []).forEach((r: { po_id: string; brand: string | null }) => {
        if (r.brand && !firstBrandByPo[r.po_id]) firstBrandByPo[r.po_id] = r.brand;
      });
    }
    headers.forEach(h => {
      const id = h.id as string;
      h.display_brand = (h.brand as string) || firstBrandByPo[id] || '';
    });

    return NextResponse.json({ success: true, data: headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { brand, factory_code, factory_name, po_date, memo } = body || {};

    const year = new Date().getFullYear();
    // 동시성 대비: UNIQUE 충돌 시 최대 3회 재시도
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const poNumber = await generateNextPoNumber(year);
      const insertPayload = {
        po_number: poNumber,
        po_date: po_date || new Date().toISOString().substring(0, 10),
        brand: brand ? String(brand).trim() || null : null,
        factory_code: factory_code ? String(factory_code).trim() || null : null,
        factory_name: factory_name ? String(factory_name).trim() || null : null,
        status: 'draft',
        total_quantity: 0,
        total_fob_usd: 0,
        memo: memo ? String(memo).trim() || null : null,
      };
      const { data, error } = await supabase
        .from('import_po_headers')
        .insert(insertPayload)
        .select('*')
        .single();
      if (!error) return NextResponse.json({ success: true, data });
      if (error.code === '23505') { lastErr = error; continue; } // UNIQUE 충돌 → 재시도
      throw error;
    }
    const msg = lastErr instanceof Error ? lastErr.message : 'PO 번호 UNIQUE 충돌이 3회 반복되었습니다';
    return NextResponse.json({ success: false, error: msg, code: 'PO_NUMBER_CONFLICT' }, { status: 500 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, po_date, brand, factory_code, factory_name, status, linked_invoice_id, memo } = body || {};
    if (!id) return NextResponse.json({ success: false, error: 'id 필수' }, { status: 400 });
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (po_date !== undefined) payload.po_date = po_date;
    if (brand !== undefined) payload.brand = brand ? String(brand).trim() || null : null;
    if (factory_code !== undefined) payload.factory_code = factory_code ? String(factory_code).trim() || null : null;
    if (factory_name !== undefined) payload.factory_name = factory_name ? String(factory_name).trim() || null : null;
    if (status !== undefined) {
      if (!['draft', 'confirmed', 'linked', 'completed'].includes(status)) {
        return NextResponse.json({ success: false, error: 'status 값 오류' }, { status: 400 });
      }
      payload.status = status;
    }
    if (linked_invoice_id !== undefined) payload.linked_invoice_id = linked_invoice_id || null;
    if (memo !== undefined) payload.memo = memo ? String(memo).trim() || null : null;
    const { data, error } = await supabase
      .from('import_po_headers')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
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
    const { error } = await supabase.from('import_po_headers').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
