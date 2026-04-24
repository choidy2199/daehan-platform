import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { recalcInvoiceTotals as sharedRecalc } from '@/lib/import-invoice-calc';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function recalcInvoiceTotals(invoiceId: string): Promise<void> {
  return sharedRecalc(supabase, invoiceId);
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { data, error } = await supabase
      .from('import_invoice_items')
      .select('*')
      .eq('invoice_id', id)
      .order('line_no', { ascending: true });
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
    const { id: invoiceId } = await context.params;
    const body = await request.json();
    const { line_no, model, name, qty, fob_usd, pallet_qty, pallets, is_pallet_line, memo, management_code } = body || {};
    if (!model) return NextResponse.json({ success: false, error: '모델은 필수입니다' }, { status: 400 });
    const qtyN = Number(qty) || 0;
    const fobN = Number(fob_usd) || 0;
    const amount = Number((qtyN * fobN).toFixed(2));
    const { data, error } = await supabase
      .from('import_invoice_items')
      .insert({
        invoice_id: invoiceId,
        line_no: Number(line_no) || 1,
        model: String(model).trim(),
        name: name?.trim() || null,
        qty: qtyN,
        fob_usd: fobN,
        amount_usd: amount,
        pallet_qty: Number(pallet_qty) || 0,
        pallets: Number(pallets) || 0,
        is_pallet_line: !!is_pallet_line,
        memo: memo?.trim() || null,
        management_code: management_code?.trim() || null,
      })
      .select('*')
      .single();
    if (error) throw error;
    await recalcInvoiceTotals(invoiceId);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await context.params;
    const body = await request.json();
    const { id, ...fields } = body || {};
    if (!id) return NextResponse.json({ success: false, error: 'id 필수' }, { status: 400 });

    const payload: Record<string, unknown> = {};
    const allowed = ['line_no', 'model', 'name', 'qty', 'fob_usd', 'pallet_qty', 'pallets', 'is_pallet_line', 'memo', 'management_code'];
    for (const k of allowed) {
      if (k in fields) {
        const v = (fields as Record<string, unknown>)[k];
        if (k === 'qty' || k === 'fob_usd' || k === 'pallet_qty' || k === 'pallets' || k === 'line_no') payload[k] = Number(v) || 0;
        else if (k === 'is_pallet_line') payload[k] = !!v;
        else if (typeof v === 'string') payload[k] = v.trim() || null;
        else payload[k] = v;
      }
    }
    // amount_usd는 recalc에서 다시 계산. 여기선 qty/fob 변경만 선반영해도 무관.
    if ('qty' in payload || 'fob_usd' in payload) {
      const { data: cur } = await supabase
        .from('import_invoice_items')
        .select('qty, fob_usd')
        .eq('id', id)
        .single();
      const q = 'qty' in payload ? (payload.qty as number) : Number((cur as { qty: number } | null)?.qty || 0);
      const f = 'fob_usd' in payload ? (payload.fob_usd as number) : Number((cur as { fob_usd: number } | null)?.fob_usd || 0);
      payload.amount_usd = Number((q * f).toFixed(2));
    }

    const { data, error } = await supabase
      .from('import_invoice_items')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    await recalcInvoiceTotals(invoiceId);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await context.params;
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('id');
    if (!itemId) return NextResponse.json({ success: false, error: 'id 필수' }, { status: 400 });
    const { error } = await supabase.from('import_invoice_items').delete().eq('id', itemId);
    if (error) throw error;
    await recalcInvoiceTotals(invoiceId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
