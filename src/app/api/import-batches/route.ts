import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    let query = supabase
      .from('import_batches')
      .select('*', { count: 'exact' })
      .order('customs_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (status && status !== 'all') query = query.eq('status', status);

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    const rows = (data || []) as Array<Record<string, unknown>>;

    // linked_invoice (1:1) 배치 조회 — PostgREST 다중 embed 대신 2nd query
    const linkedIds = rows
      .map(r => r.linked_invoice_id as string | null)
      .filter((v): v is string => !!v);
    const linkedMap: Record<string, unknown> = {};
    if (linkedIds.length > 0) {
      const { data: linked } = await supabase
        .from('import_invoices')
        .select('id, invoice_no, factory_name, factory_code, invoice_date, customer_code, customer_name, status, final_amount_usd')
        .in('id', linkedIds);
      (linked || []).forEach((inv: { id: string }) => { linkedMap[inv.id] = inv; });
    }

    // batch_id 방향 인보이스 조회 (레거시 1:N, invoice_count/total_usd 계산용)
    // — PostgREST 다중 embed 대신 2nd query (5587c8b와 동일 패턴)
    const batchIds = rows.map(r => r.id as string).filter(Boolean);
    const invoiceByBatchMap = new Map<string, Array<{ final_amount_usd: number }>>();
    if (batchIds.length > 0) {
      const { data: invs } = await supabase
        .from('import_invoices')
        .select('id, batch_id, final_amount_usd')
        .in('batch_id', batchIds);
      for (const inv of (invs || []) as Array<{ id: string; batch_id: string; final_amount_usd: number }>) {
        if (!inv.batch_id) continue;
        if (!invoiceByBatchMap.has(inv.batch_id)) invoiceByBatchMap.set(inv.batch_id, []);
        invoiceByBatchMap.get(inv.batch_id)!.push({ final_amount_usd: inv.final_amount_usd });
      }
    }

    const shaped = rows.map(row => {
      const invs = invoiceByBatchMap.get(row.id as string) || [];
      const total = invs.reduce((s, i) => s + Number(i.final_amount_usd || 0), 0);
      const linkId = row.linked_invoice_id as string | null;
      return {
        ...row,
        invoice_count: invs.length,
        total_usd: Number(total.toFixed(2)),
        linked_invoice: linkId && linkedMap[linkId] ? linkedMap[linkId] : null,
      };
    });

    return NextResponse.json({ success: true, data: shaped, total: count ?? shaped.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : (typeof err === 'object' ? JSON.stringify(err) : String(err));
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { batch_no, batch_name, container_no, customs_date } = body || {};
    if (!batch_no) return NextResponse.json({ success: false, error: '수입 건 번호는 필수입니다' }, { status: 400 });
    const { data, error } = await supabase
      .from('import_batches')
      .insert({
        batch_no: String(batch_no).trim(),
        batch_name: batch_name?.trim() || null,
        container_no: container_no?.trim() || null,
        customs_date: customs_date || null,
      })
      .select('*')
      .single();
    if (error) {
      if (error.code === '23505') return NextResponse.json({ success: false, error: '이미 등록된 수입 건 번호입니다', code: 'DUPLICATE' }, { status: 409 });
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
    const allowed = ['batch_no', 'batch_name', 'container_no', 'customs_date', 'status', 'erp_sent_at'];
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (k in fields) {
        const v = (fields as Record<string, unknown>)[k];
        if (typeof v === 'string') payload[k] = v.trim() || null;
        else payload[k] = v;
      }
    }
    const { data, error } = await supabase
      .from('import_batches')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      if (error.code === '23505') return NextResponse.json({ success: false, error: '이미 등록된 수입 건 번호입니다', code: 'DUPLICATE' }, { status: 409 });
      throw error;
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
    const { error } = await supabase.from('import_batches').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
