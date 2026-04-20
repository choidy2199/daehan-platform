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

    if (rows.length > 0) {
      const pick = (inv: Row['import_invoices']): InvRef | null => Array.isArray(inv) ? (inv[0] || null) : inv;
      const sorted = rows.sort((a, b) => {
        const da = pick(a.import_invoices)?.invoice_date || '';
        const db = pick(b.import_invoices)?.invoice_date || '';
        return db.localeCompare(da);
      });
      const latest = sorted[0];
      const price = Number(latest.fob_usd || 0);
      if (price > 0) {
        const lp = pick(latest.import_invoices);
        return NextResponse.json({
          success: true,
          data: {
            source: 'invoice',
            unit_price_usd: price,
            invoice_no: lp?.invoice_no || null,
            invoice_date: lp?.invoice_date || null,
          },
        });
      }
    }

    // 폴백: import_products_v2.base_fob_usd 조회
    const { data: prod, error: prodErr } = await supabase
      .from('import_products_v2')
      .select('base_fob_usd')
      .eq('model', model)
      .limit(1)
      .maybeSingle();
    if (prodErr && prodErr.code !== 'PGRST116') throw prodErr;
    const basePrice = Number((prod as { base_fob_usd: number } | null)?.base_fob_usd || 0);
    if (basePrice > 0) {
      return NextResponse.json({
        success: true,
        data: { source: 'product', unit_price_usd: basePrice, from: '제품 기본 단가' },
      });
    }

    return NextResponse.json({ success: true, data: { source: null, unit_price_usd: null } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
