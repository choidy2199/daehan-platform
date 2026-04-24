import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { recalcInvoiceTotals as sharedRecalc } from '@/lib/import-invoice-calc';

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
  pallet_qty?: number;
  is_pallet_line?: boolean;
  memo?: string | null;
  management_code?: string | null;
};

async function recalcInvoiceTotals(invoiceId: string): Promise<void> {
  return sharedRecalc(supabase, invoiceId);
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
          pallet_qty: Number(r.pallet_qty) || 0,
          pallets: Number(r.pallets) || 0,
          is_pallet_line: !!r.is_pallet_line,
          memo: r.memo ? String(r.memo).trim() || null : null,
          management_code: r.management_code ? String(r.management_code).trim() || null : null,
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
