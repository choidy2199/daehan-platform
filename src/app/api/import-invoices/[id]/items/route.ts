import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function recalcInvoiceTotals(invoiceId: string): Promise<void> {
  const { data: items, error: qErr } = await supabase
    .from('import_invoice_items')
    .select('qty, fob_usd, is_pallet_line')
    .eq('invoice_id', invoiceId);
  if (qErr) throw qErr;
  let subtotal = 0;
  let pallets = 0;
  (items || []).forEach((it: { qty: number; fob_usd: number; is_pallet_line: boolean }) => {
    const amt = Number(it.qty || 0) * Number(it.fob_usd || 0);
    if (it.is_pallet_line) pallets += amt;
    else subtotal += amt;
  });
  const { data: inv, error: iErr } = await supabase
    .from('import_invoices')
    .select('discount_usd')
    .eq('id', invoiceId)
    .single();
  if (iErr) throw iErr;
  const discount = Number((inv as { discount_usd: number }).discount_usd || 0);
  const final = Number((subtotal - discount + pallets).toFixed(2));
  await supabase
    .from('import_invoices')
    .update({
      subtotal_usd: Number(subtotal.toFixed(2)),
      pallets_usd: Number(pallets.toFixed(2)),
      final_amount_usd: final,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId);
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
    const { line_no, model, name, qty, fob_usd, pallets, is_pallet_line, memo } = body || {};
    if (!model) {
      return NextResponse.json({ success: false, error: '모델은 필수입니다' }, { status: 400 });
    }
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
        pallets: Number(pallets) || 0,
        is_pallet_line: !!is_pallet_line,
        memo: memo?.trim() || null,
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
    const allowed = ['line_no', 'model', 'name', 'qty', 'fob_usd', 'pallets', 'is_pallet_line', 'memo'];
    for (const k of allowed) {
      if (k in fields) {
        const v = (fields as Record<string, unknown>)[k];
        if (k === 'qty' || k === 'fob_usd' || k === 'pallets' || k === 'line_no') payload[k] = Number(v) || 0;
        else if (k === 'is_pallet_line') payload[k] = !!v;
        else if (typeof v === 'string') payload[k] = v.trim() || null;
        else payload[k] = v;
      }
    }
    // amount_usd recompute if qty or fob changes
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
