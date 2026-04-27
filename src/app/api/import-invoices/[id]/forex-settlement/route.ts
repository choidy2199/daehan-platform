/**
 * [트랙 B] 환차 정산 메모 API
 *
 * 사장님이 장구공사(수입대행)에 입금한 KRW를 메모용으로 저장.
 * 자동 산출(차익/실 정산 통관비)은 클라가 _ipinv2Payments + _ipinv2Customs 메모리로 처리.
 * 본 API는 단순 GET/PUT만.
 *
 * GET  /api/import-invoices/{id}/forex-settlement
 *   응답: { success, payments: [{ seq, my_deposit_krw, my_deposit_date }, ...] }
 *
 * PUT  /api/import-invoices/{id}/forex-settlement
 *   Body: { payments: [{ seq, my_deposit_krw, my_deposit_date }, ...] }
 *   응답: { success }
 *
 * ⚠️ 본 라우트는 import_payments.my_deposit_krw / my_deposit_date 2개 컬럼만 UPDATE.
 *    seq / actual_date / total_paid_krw 등 기존 컬럼 절대 변경 X.
 *    인보이스V2 본 화면(다크바/송금/통관/제품최종원가/검증/경영박사 전송) 절대 영향 X.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await context.params;
    if (!invoiceId || !UUID_REGEX.test(invoiceId)) {
      return NextResponse.json({ success: false, error: '잘못된 인보이스 ID' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('import_payments')
      .select('seq, my_deposit_krw, my_deposit_date')
      .eq('invoice_id', invoiceId)
      .order('seq', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      payments: (data || []).map(r => ({
        seq: r.seq,
        my_deposit_krw: r.my_deposit_krw != null ? Number(r.my_deposit_krw) : null,
        my_deposit_date: r.my_deposit_date || null,
      })),
    });
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
    if (!invoiceId || !UUID_REGEX.test(invoiceId)) {
      return NextResponse.json({ success: false, error: '잘못된 인보이스 ID' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const payments = Array.isArray(body?.payments) ? body.payments : [];
    if (payments.length === 0) {
      return NextResponse.json({ success: false, error: 'payments 배열이 필요합니다' }, { status: 400 });
    }

    // seq별로 my_deposit_krw / my_deposit_date 만 UPDATE (다른 컬럼 절대 X)
    const errors: string[] = [];
    for (const p of payments) {
      const seq = Number(p?.seq);
      if (!Number.isFinite(seq) || seq < 1) continue;
      const krw = p?.my_deposit_krw == null || p?.my_deposit_krw === '' ? null : Number(p.my_deposit_krw);
      const date = p?.my_deposit_date == null || p?.my_deposit_date === '' ? null : String(p.my_deposit_date);

      const { error } = await supabase
        .from('import_payments')
        .update({ my_deposit_krw: krw, my_deposit_date: date })
        .eq('invoice_id', invoiceId)
        .eq('seq', seq);

      if (error) errors.push(`seq=${seq}: ${error.message}`);
    }

    if (errors.length > 0) {
      return NextResponse.json({ success: false, error: errors.join(' / ') }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
