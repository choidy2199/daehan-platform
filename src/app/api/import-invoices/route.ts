import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { recalcInvoiceTotals } from '@/lib/import-invoice-calc';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '500', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // 인보이스 목록 + 제품 라인 수 + 배치 번호
    let query = supabase
      .from('import_invoices')
      .select('*, import_invoice_items(count), import_batches(batch_no)', { count: 'exact' })
      .order('invoice_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    const shaped = (data || []).map((row: Record<string, unknown>) => {
      const itemsArr = row.import_invoice_items as Array<{ count: number }> | null;
      const itemCount = itemsArr && itemsArr.length > 0 ? itemsArr[0].count : 0;
      const batch = row.import_batches as { batch_no: string } | null;
      return { ...row, item_count: itemCount, batch_no: batch ? batch.batch_no : null };
    });

    return NextResponse.json({ success: true, data: shaped, total: count ?? shaped.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { invoice_no, batch_id, factory_name, factory_code, invoice_date, payment_terms, memo } = body || {};
    if (!invoice_no || !factory_name || !invoice_date) {
      return NextResponse.json({ success: false, error: '인보이스 번호, 공장명, 인보이스 일자는 필수입니다' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('import_invoices')
      .insert({
        invoice_no: String(invoice_no).trim(),
        batch_id: batch_id || null,
        factory_name: String(factory_name).trim(),
        factory_code: factory_code?.trim() || null,
        invoice_date,
        payment_terms: payment_terms?.trim() || null,
        memo: memo?.trim() || null,
      })
      .select('*')
      .single();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: false, error: '이미 등록된 인보이스 번호입니다', code: 'DUPLICATE' }, { status: 409 });
      }
      throw error;
    }
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

    const allowed = ['invoice_no', 'batch_id', 'factory_name', 'factory_code', 'invoice_date', 'payment_terms', 'memo', 'subtotal_usd', 'discount_usd', 'pallets_usd', 'final_amount_usd', 'weighted_avg_rate', 'status', 'discount_rate', 'discount_amount_usd', 'pallet_count', 'pallet_unit_price_usd', 'pallet_total_usd', 'final_total_usd'];
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (k in fields) {
        const v = (fields as Record<string, unknown>)[k];
        if (typeof v === 'string') payload[k] = v.trim() || null;
        else payload[k] = v;
      }
    }

    const { data, error } = await supabase
      .from('import_invoices')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: false, error: '이미 등록된 인보이스 번호입니다', code: 'DUPLICATE' }, { status: 409 });
      }
      throw error;
    }

    // discount_rate 또는 pallet_unit_price_usd 변경 시 전체 재계산
    const needsRecalc = 'discount_rate' in fields || 'pallet_unit_price_usd' in fields;
    if (needsRecalc) {
      await recalcInvoiceTotals(supabase, id);
      const { data: refreshed } = await supabase.from('import_invoices').select('*').eq('id', id).single();
      if (refreshed) return NextResponse.json({ success: true, data: refreshed });
    }
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
    const { error } = await supabase.from('import_invoices').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
