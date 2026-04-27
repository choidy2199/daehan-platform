/**
 * [Stage 6 Phase B-1] 인보이스V2 → 경영박사 매입전표 미리보기 API
 *
 * Stage 6 Phase B-2 Step 1에서 매핑 로직을 src/lib/erp-invoice-payload.ts로 추출.
 * 본 라우트는 lib 호출 결과에서 newOrderIn(전송 전용) 필드만 제외하고 응답.
 * 응답 JSON 구조는 기존과 100% 동일 (인보이스V2 미리보기 모달 호환).
 */
import { NextRequest, NextResponse } from 'next/server';
import { buildInvoicePayload, InvoiceNotFoundError } from '@/lib/erp-invoice-payload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await context.params;
    if (!invoiceId) {
      return NextResponse.json({ success: false, error: 'id 필수' }, { status: 400 });
    }

    let result;
    try {
      result = await buildInvoicePayload(invoiceId);
    } catch (err) {
      if (err instanceof InvoiceNotFoundError) {
        return NextResponse.json({ success: false, error: '인보이스를 찾을 수 없습니다' }, { status: 404 });
      }
      throw err;
    }

    return NextResponse.json({
      success: true,
      can_send: result.can_send,
      blockers: result.blockers,
      header: result.header,
      items: result.items,
      totals: result.totals,
      already_sent: result.already_sent,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
