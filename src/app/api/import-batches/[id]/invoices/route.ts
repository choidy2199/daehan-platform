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
      .from('import_invoices')
      .select('*, import_invoice_items(qty)')
      .eq('batch_id', batchId)
      .order('invoice_date', { ascending: true });
    if (error) throw error;
    const shaped = (data || []).map((row: Record<string, unknown>) => {
      const items = (row.import_invoice_items as Array<{ qty: number }> | null) || [];
      const totalQty = items.reduce((s, i) => s + Number(i.qty || 0), 0);
      return { ...row, item_count: items.length, total_qty: totalQty };
    });
    return NextResponse.json({ success: true, data: shaped });
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
    const { invoice_id } = body || {};
    if (!invoice_id) return NextResponse.json({ success: false, error: 'invoice_id 필수' }, { status: 400 });
    const { error } = await supabase.from('import_invoices').update({ batch_id: batchId, updated_at: new Date().toISOString() }).eq('id', invoice_id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  _context: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get('invoice_id');
    if (!invoiceId) return NextResponse.json({ success: false, error: 'invoice_id 필수' }, { status: 400 });
    const { error } = await supabase.from('import_invoices').update({ batch_id: null, updated_at: new Date().toISOString() }).eq('id', invoiceId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
