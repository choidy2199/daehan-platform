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
    const { id: batchId } = await context.params;
    const { data, error } = await supabase
      .from('import_customs_costs')
      .select('*')
      .eq('batch_id', batchId)
      .order('item_order', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ success: true, data: data || [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await context.params;
    const body = await request.json();
    const { item_order, item_name, amount_krw, classification } = body || {};
    if (!item_name) return NextResponse.json({ success: false, error: '비용 항목명 필수' }, { status: 400 });
    const { data, error } = await supabase
      .from('import_customs_costs')
      .insert({
        batch_id: batchId,
        item_order: Number(item_order) || 1,
        item_name: String(item_name).trim(),
        amount_krw: Number(amount_krw) || 0,
        classification: classification === 'vat' ? 'vat' : 'cost',
      })
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...fields } = body || {};
    if (!id) return NextResponse.json({ success: false, error: 'id 필수' }, { status: 400 });
    const allowed = ['item_order', 'item_name', 'amount_krw', 'classification'];
    const payload: Record<string, unknown> = {};
    for (const k of allowed) {
      if (k in fields) {
        const v = (fields as Record<string, unknown>)[k];
        if (k === 'item_order') payload[k] = Number(v) || 0;
        else if (k === 'amount_krw') payload[k] = Number(v) || 0;
        else if (k === 'classification') payload[k] = v === 'vat' ? 'vat' : 'cost';
        else if (typeof v === 'string') payload[k] = v.trim() || null;
        else payload[k] = v;
      }
    }
    const { data, error } = await supabase
      .from('import_customs_costs')
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
    const { error } = await supabase.from('import_customs_costs').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
