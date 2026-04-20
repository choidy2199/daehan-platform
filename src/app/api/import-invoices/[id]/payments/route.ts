import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type PaymentRow = {
  id: string;
  invoice_id: string;
  actual_date: string | null;
  actual_usd: number;
  exchange_rate: number;
  remittance_krw: number;
  fee_krw: number;
  telegram_fee_krw: number;
  fee_vat_included: boolean;
  fee_vat_krw: number;
  total_paid_krw: number;
  effective_rate: number;
  planned_krw: number;
  diff_krw: number;
  status: 'planned' | 'completed';
};

function computeDerived(p: Partial<PaymentRow>): Partial<PaymentRow> {
  const remittance = Number(p.remittance_krw || 0);
  const fee = Number(p.fee_krw || 0);
  const tele = Number(p.telegram_fee_krw || 0);
  const vatIncluded = !!p.fee_vat_included;
  const vat = vatIncluded ? Math.round((fee + tele) * 0.1) : 0;
  const total = remittance + fee + tele + vat;
  const actualUsd = Number(p.actual_usd || 0);
  const effective = actualUsd > 0 ? Number((total / actualUsd).toFixed(4)) : 0;
  const plannedKrw = Number(p.planned_krw || 0);
  const diff = plannedKrw - total;
  return {
    fee_vat_krw: vat,
    total_paid_krw: total,
    effective_rate: effective,
    diff_krw: diff,
  };
}

function deriveStatus(p: Partial<PaymentRow>): 'planned' | 'completed' {
  // 실제 송금 정보가 모두 채워지면 completed
  const hasActualDate = !!p.actual_date;
  const hasActualUsd = Number(p.actual_usd || 0) > 0;
  const hasRate = Number(p.exchange_rate || 0) > 0;
  const hasRemittance = Number(p.remittance_krw || 0) > 0;
  return hasActualDate && hasActualUsd && hasRate && hasRemittance ? 'completed' : 'planned';
}

async function recalcInvoiceStatus(invoiceId: string): Promise<void> {
  const { data: payments, error } = await supabase
    .from('import_payments')
    .select('status, actual_usd, total_paid_krw')
    .eq('invoice_id', invoiceId);
  if (error) throw error;
  const list = (payments || []) as Array<{ status: string; actual_usd: number; total_paid_krw: number }>;

  // 현재 invoice status 확인
  const { data: inv, error: iErr } = await supabase
    .from('import_invoices')
    .select('status')
    .eq('id', invoiceId)
    .single();
  if (iErr) throw iErr;
  const curStatus = (inv as { status: string }).status;

  // customs_done은 건드리지 않음
  if (curStatus === 'customs_done') return;

  let newStatus: 'draft' | 'partial_paid' | 'paid';
  let weightedAvg: number | null = null;

  if (list.length === 0) {
    newStatus = 'draft';
  } else {
    const completed = list.filter(p => p.status === 'completed');
    if (completed.length === 0) {
      newStatus = 'draft';
    } else if (completed.length < list.length) {
      newStatus = 'partial_paid';
    } else {
      newStatus = 'paid';
      const sumKrw = completed.reduce((s, p) => s + Number(p.total_paid_krw || 0), 0);
      const sumUsd = completed.reduce((s, p) => s + Number(p.actual_usd || 0), 0);
      weightedAvg = sumUsd > 0 ? Number((sumKrw / sumUsd).toFixed(4)) : null;
    }
  }

  const patch: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
  if (newStatus === 'paid') patch.weighted_avg_rate = weightedAvg;
  else patch.weighted_avg_rate = null;
  await supabase.from('import_invoices').update(patch).eq('id', invoiceId);
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { data, error } = await supabase
      .from('import_payments')
      .select('*')
      .eq('invoice_id', id)
      .order('seq', { ascending: true });
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
    const { seq, planned_date, planned_usd, planned_ratio, planned_krw } = body || {};
    const insertPayload = {
      invoice_id: invoiceId,
      seq: Number(seq) || 1,
      planned_date: planned_date || null,
      planned_usd: Number(planned_usd) || 0,
      planned_ratio: Number(planned_ratio) || 0,
      planned_krw: Number(planned_krw) || 0,
      status: 'planned' as const,
    };
    const { data, error } = await supabase
      .from('import_payments')
      .insert(insertPayload)
      .select('*')
      .single();
    if (error) throw error;
    await recalcInvoiceStatus(invoiceId);
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

    const allowed = ['seq', 'planned_date', 'planned_usd', 'planned_ratio', 'planned_krw', 'actual_date', 'actual_usd', 'exchange_rate', 'remittance_krw', 'fee_krw', 'telegram_fee_krw', 'fee_vat_included'];
    const payload: Record<string, unknown> = {};
    for (const k of allowed) {
      if (k in fields) {
        const v = (fields as Record<string, unknown>)[k];
        if (['seq'].includes(k)) payload[k] = Number(v) || 0;
        else if (['planned_usd', 'planned_ratio', 'planned_krw', 'actual_usd', 'exchange_rate', 'remittance_krw', 'fee_krw', 'telegram_fee_krw'].includes(k)) {
          payload[k] = Number(v) || 0;
        } else if (k === 'fee_vat_included') payload[k] = !!v;
        else if (k === 'planned_date' || k === 'actual_date') payload[k] = v || null;
      }
    }

    // 현재 값 + 패치 값으로 derived 재계산
    const { data: cur, error: cErr } = await supabase
      .from('import_payments')
      .select('*')
      .eq('id', id)
      .single();
    if (cErr) throw cErr;
    const merged = { ...(cur as PaymentRow), ...payload } as PaymentRow;
    const derived = computeDerived(merged);
    Object.assign(payload, derived);
    // status 자동 전환
    payload.status = deriveStatus(merged);

    const { data, error } = await supabase
      .from('import_payments')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    await recalcInvoiceStatus(invoiceId);
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
    const paymentId = searchParams.get('id');
    if (!paymentId) return NextResponse.json({ success: false, error: 'id 필수' }, { status: 400 });
    const { error } = await supabase.from('import_payments').delete().eq('id', paymentId);
    if (error) throw error;
    await recalcInvoiceStatus(invoiceId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
