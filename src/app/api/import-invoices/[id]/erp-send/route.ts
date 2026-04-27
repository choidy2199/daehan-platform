/**
 * [Stage 6 Phase B-2 Step 1] 인보이스V2 → 경영박사 매입전표 전송 API (dry-run 단계)
 *
 * 이번 단계(1단계)는 dry-run 페이로드만 응답. 실 ERP 호출은 다음 단계(2단계)에서 활성화.
 *
 * POST /api/import-invoices/{id}/erp-send
 *   Body: { dryRun: boolean }
 *
 * 응답:
 *   - dryRun=true  → 200 success + validation/payload/formBody (cUserKey 마스킹)
 *   - dryRun=false → 501 (2단계 미구현)
 *   - 검증 실패    → 400/404/409 (아래 에러 표 참고)
 *
 * 멱등성: result.already_sent.sent === true → 409. 재전송은 admin이 Supabase에서
 *   erp_sent_at = NULL 수동 리셋해야만 가능.
 */
import { NextRequest, NextResponse } from 'next/server';
import { buildInvoicePayload, InvoiceNotFoundError } from '@/lib/erp-invoice-payload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await context.params;

    if (!invoiceId || !UUID_REGEX.test(invoiceId)) {
      return NextResponse.json({ error: '잘못된 인보이스 ID' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const dryRun = body && body.dryRun === true;

    let result;
    try {
      result = await buildInvoicePayload(invoiceId);
    } catch (err) {
      if (err instanceof InvoiceNotFoundError) {
        return NextResponse.json({ error: '인보이스를 찾을 수 없습니다' }, { status: 404 });
      }
      throw err;
    }

    // 멱등성 — 이미 전송된 인보이스는 admin 수동 리셋 필요
    if (result.already_sent.sent) {
      const orderNo = result.already_sent.order_no || '없음';
      return NextResponse.json(
        { error: `이미 전송된 인보이스입니다 (전표번호: ${orderNo})` },
        { status: 409 }
      );
    }

    // 검증 실패 — 거래처/품목 코드 누락은 blockers에 이미 포함 (DRY)
    if (result.blockers.length > 0) {
      return NextResponse.json(
        { error: `검증 실패: ${result.blockers.join(', ')}` },
        { status: 400 }
      );
    }

    // dryRun=false → 다음 단계까지 호출 차단
    if (!dryRun) {
      return NextResponse.json(
        { error: 'Phase B-2 Step 2 미구현 — 1단계 검증 PASS 후 활성화 예정' },
        { status: 501 }
      );
    }

    // ─────────────────────────────────────────────────
    // dryRun=true 응답 빌드
    // formBody는 callNewOrderIn이 실제로 보낼 form-urlencoded body와 동일 구조.
    // cUserKey만 보안상 *** 마스킹.
    // ─────────────────────────────────────────────────
    const params = new URLSearchParams();
    params.append('cUserKey', '***');
    params.append('info', result.newOrderIn.info);
    params.append('items', result.newOrderIn.items);
    params.append('ibgum', result.newOrderIn.ibgum);
    const formBody = params.toString();

    return NextResponse.json({
      success: true,
      dryRun: true,
      validation: {
        invoiceId,
        invoiceNo: result.header.invoice_number,
        customerCode: result.header.customer_code,
        customerName: result.header.customer_name,
        itemCount: result.items.length,
        totalKrw: result.totals.amount_sum,
        alreadySent: result.already_sent.sent,
        verificationOk: result.blockers.length === 0,
        blockers: result.blockers,
      },
      payload: {
        info: result.newOrderIn.info,
        items: result.newOrderIn.items,
        ibgum: result.newOrderIn.ibgum,
      },
      formBody,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
