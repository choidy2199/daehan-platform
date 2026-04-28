/**
 * [트랙 C] 입고날짜 인라인 수정 API
 *
 * 사장님 결정 Q1 (A): 입고날짜 = erp_sent_at 그대로 사용.
 * 따라서 본 PATCH 라우트는 erp_sent_at만 UPDATE한다.
 *
 * PATCH /api/import-invoices/{id}/received-date
 *   Body: { received_date: "YYYY-MM-DD" }
 *   응답: { success, erp_sent_at }
 *
 * ⚠️ erp_order_no / status / 다른 컬럼 절대 변경 X.
 *    received_date를 KST 자정(00:00:00 +09:00) timestamptz로 변환.
 *    null/'' 입력 시 erp_sent_at = NULL (입고 취소)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await context.params;
    if (!invoiceId || !UUID_REGEX.test(invoiceId)) {
      return NextResponse.json({ success: false, error: '잘못된 인보이스 ID' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const dateRaw = body?.received_date;
    let erpSentAt: string | null = null;

    if (dateRaw == null || dateRaw === '') {
      erpSentAt = null;
    } else if (typeof dateRaw === 'string' && DATE_REGEX.test(dateRaw)) {
      // KST 자정 → UTC ISO (KST 00:00 = UTC 전일 15:00)
      erpSentAt = `${dateRaw}T00:00:00+09:00`;
    } else {
      return NextResponse.json({ success: false, error: 'received_date 형식은 YYYY-MM-DD' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('import_invoices')
      .update({ erp_sent_at: erpSentAt })
      .eq('id', invoiceId)
      .select('erp_sent_at')
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, erp_sent_at: data?.erp_sent_at || null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
