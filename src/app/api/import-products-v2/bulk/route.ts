import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type UpsertRow = {
  brand: string;
  model: string;
  product_name?: string | null;
  spec?: string | null;
  pallet_qty?: number;
  memo?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawRows: UpsertRow[] = Array.isArray(body?.rows) ? body.rows : [];
    const errors: Array<{ row: number; reason: string }> = [];
    const valid: UpsertRow[] = [];
    rawRows.forEach((r, idx) => {
      const brand = String(r?.brand ?? '').trim();
      const model = String(r?.model ?? '').trim();
      if (!brand || !model) {
        errors.push({ row: idx + 2, reason: '브랜드/모델 필수' });
        return;
      }
      const palletRaw = r?.pallet_qty;
      const pallet = typeof palletRaw === 'number' ? palletRaw : parseInt(String(palletRaw ?? '0').replace(/[^0-9-]/g, ''), 10);
      valid.push({
        brand,
        model,
        product_name: r?.product_name ? String(r.product_name).trim() || null : null,
        spec: r?.spec ? String(r.spec).trim() || null : null,
        pallet_qty: Number.isFinite(pallet) ? pallet : 0,
        memo: r?.memo ? String(r.memo).trim() || null : null,
      });
    });
    if (valid.length === 0) {
      return NextResponse.json({ success: true, data: { created: 0, updated: 0, errors } });
    }
    const { data: existing, error: qErr } = await supabase
      .from('import_products_v2')
      .select('brand, model');
    if (qErr) throw qErr;
    const key = (b: string, m: string) => `${b}\u0000${m}`;
    const existingSet = new Set((existing || []).map((r: { brand: string; model: string }) => key(r.brand, r.model)));
    let created = 0;
    let updated = 0;
    for (const r of valid) {
      if (existingSet.has(key(r.brand, r.model))) updated++;
      else created++;
    }
    const payload = valid.map(r => ({
      ...r,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from('import_products_v2')
      .upsert(payload, { onConflict: 'brand,model' });
    if (error) throw error;
    return NextResponse.json({ success: true, data: { created, updated, errors } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
