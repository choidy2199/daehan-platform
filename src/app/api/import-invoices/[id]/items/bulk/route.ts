import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ItemInput = {
  line_no?: number;
  model: string;
  name?: string | null;
  qty?: number;
  fob_usd?: number;
  pallets?: number;
  is_pallet_line?: boolean;
  memo?: string | null;
};

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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await context.params;
    const body = await request.json();
    const rawItems: ItemInput[] = Array.isArray(body?.items) ? body.items : [];

    // 현재 최대 line_no 조회 → 뒤에 이어 붙임
    const { data: existingItems, error: eErr } = await supabase
      .from('import_invoice_items')
      .select('line_no')
      .eq('invoice_id', invoiceId)
      .order('line_no', { ascending: false })
      .limit(1);
    if (eErr) throw eErr;
    const nextStart = existingItems && existingItems.length > 0 ? Number((existingItems[0] as { line_no: number }).line_no) + 1 : 1;

    const payload = rawItems
      .filter(r => r && r.model)
      .map((r, idx) => {
        const qty = Number(r.qty) || 0;
        const fob = Number(r.fob_usd) || 0;
        return {
          invoice_id: invoiceId,
          line_no: r.line_no != null ? Number(r.line_no) : nextStart + idx,
          model: String(r.model).trim(),
          name: r.name ? String(r.name).trim() || null : null,
          qty,
          fob_usd: fob,
          amount_usd: Number((qty * fob).toFixed(2)),
          pallets: Number(r.pallets) || 0,
          is_pallet_line: !!r.is_pallet_line,
          memo: r.memo ? String(r.memo).trim() || null : null,
        };
      });

    if (payload.length === 0) {
      return NextResponse.json({ success: true, data: { created: 0, items: [] } });
    }

    const { data, error } = await supabase
      .from('import_invoice_items')
      .insert(payload)
      .select('*');
    if (error) throw error;
    await recalcInvoiceTotals(invoiceId);
    return NextResponse.json({ success: true, data: { created: (data || []).length, items: data || [] } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
