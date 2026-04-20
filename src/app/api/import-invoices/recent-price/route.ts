import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const model = (searchParams.get('model') || '').trim();
    if (!model) return NextResponse.json({ success: true, data: null });

    const { data, error } = await supabase
      .from('import_invoice_items')
      .select('fob_usd, import_invoices!inner(invoice_no, invoice_date)')
      .eq('model', model)
      .order('invoice_date', { foreignTable: 'import_invoices', ascending: false })
      .limit(20);
    if (error) throw error;

    type InvRef = { invoice_no: string; invoice_date: string };
    type Row = { fob_usd: number; import_invoices: InvRef | InvRef[] | null };
    const rows = (data || []) as unknown as Row[];
    if (rows.length === 0) return NextResponse.json({ success: true, data: null });

    const pick = (inv: Row['import_invoices']): InvRef | null => Array.isArray(inv) ? (inv[0] || null) : inv;
    const sorted = rows.sort((a, b) => {
      const da = pick(a.import_invoices)?.invoice_date || '';
      const db = pick(b.import_invoices)?.invoice_date || '';
      return db.localeCompare(da);
    });
    const latest = sorted[0];
    const lp = pick(latest.import_invoices);
    return NextResponse.json({
      success: true,
      data: {
        unit_price_usd: Number(latest.fob_usd || 0),
        invoice_no: lp?.invoice_no || null,
        invoice_date: lp?.invoice_date || null,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
