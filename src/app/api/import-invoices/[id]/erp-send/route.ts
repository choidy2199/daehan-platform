/**
 * [Stage 6 Phase B-2] 인보이스V2 → 경영박사 매입전표 전송 API
 *
 * Step 1 (1e9ea69): dry-run 페이로드만 응답.
 * Step 2 (이번): dryRun=false → 실제 callNewOrderIn 호출 + DB 갱신 + 로그 기록.
 *
 * POST /api/import-invoices/{id}/erp-send
 *   Body: { dryRun: boolean, sentBy?: string }
 *
 * 응답:
 *   - dryRun=true  → 200 + validation/payload/formBody (cUserKey 마스킹)
 *   - dryRun=false → 200 success + erpOrderNo (정상)
 *                  → 200 success + warning  (ERP 성공 / DB UPDATE 실패 — 운영자 수동 복구)
 *                  → 502 failure            (ERP 실패 — 로그만 기록)
 *   - 에러         → 400 / 404 / 409 / 500
 *
 * 멱등성: result.already_sent.sent === true → 409. 추가로 ERP 호출 직전에 한 번 더
 *   erp_sent_at SELECT (race 차단). 재전송은 admin이 Supabase에서 수동 리셋해야만 가능.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildInvoicePayload, InvoiceNotFoundError } from '@/lib/erp-invoice-payload';
import { callNewOrderIn } from '@/lib/erp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    const sentBy = (body && typeof body.sentBy === 'string' && body.sentBy.trim())
      ? body.sentBy.trim()
      : 'admin';

    let result;
    try {
      result = await buildInvoicePayload(invoiceId);
    } catch (err) {
      if (err instanceof InvoiceNotFoundError) {
        return NextResponse.json({ error: '인보이스를 찾을 수 없습니다' }, { status: 404 });
      }
      throw err;
    }

    // [Stage 6 Phase B-2 Step 3 보정 6] 멱등성(409) 제거 — 같은 인보이스 여러 번 전송 가능
    // 클라이언트가 _ipinv2ConfirmSendErp에서 재전송 confirm 다이얼로그로 안전망 처리.
    // 검증 실패 — 거래처/품목 코드 누락은 blockers에 이미 포함 (DRY)
    if (result.blockers.length > 0) {
      return NextResponse.json(
        { error: `검증 실패: ${result.blockers.join(', ')}` },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────────────
    // dryRun=true → 페이로드/formBody만 반환 (실 호출 없음)
    // ─────────────────────────────────────────────────
    if (dryRun) {
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
    }

    // ─────────────────────────────────────────────────
    // dryRun=false → 실 ERP 호출 (Phase B-2 Step 2)
    // [Stage 6 Phase B-2 Step 3 보정 6] race 재확인 SELECT + 409 제거 — 멱등성 완전 해제
    // 같은 인보이스 여러 번 전송 가능. 클라이언트 confirm 다이얼로그가 중복 방지 안전망.
    // ─────────────────────────────────────────────────

    // ERP 호출 (callNewOrderIn — Error: 검사는 호출자 책임)
    const requestPayload = {
      info: result.newOrderIn.info,
      items: result.newOrderIn.items,
      ibgum: result.newOrderIn.ibgum,
    };

    let responseText = '';
    let erpOrderNo: string | null = null;
    let errorMsg: string | null = null;
    let isSuccess = false;

    try {
      responseText = await callNewOrderIn(
        requestPayload.info,
        requestPayload.items,
        requestPayload.ibgum
      );
      const trimmed = responseText.trim();
      if (trimmed.startsWith('Error:')) {
        errorMsg = trimmed;
      } else {
        erpOrderNo = trimmed;
        isSuccess = !!erpOrderNo;
        if (!isSuccess) {
          errorMsg = '경영박사 응답이 비어 있습니다 (전표번호 없음)';
        }
      }
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
    }

    // 3. 결과 분기
    if (isSuccess && erpOrderNo) {
      const sentAt = new Date().toISOString();

      // 3-a. import_invoices UPDATE
      const { error: updateError } = await supabase
        .from('import_invoices')
        .update({ erp_sent_at: sentAt, erp_order_no: erpOrderNo })
        .eq('id', invoiceId);

      // 3-b. erp_invoice_send_logs INSERT — UPDATE 결과와 무관하게 기록
      //      (ERP 성공 + DB UPDATE 실패 시 운영자가 수동 복구할 정보 보존)
      await supabase.from('erp_invoice_send_logs').insert({
        invoice_id: invoiceId,
        sent_by: sentBy,
        status: 'success',
        erp_order_no: erpOrderNo,
        request_payload: requestPayload,
        response_text: responseText,
      });

      if (updateError) {
        return NextResponse.json(
          {
            success: true,
            dryRun: false,
            erpOrderNo,
            sentAt,
            warning: `ERP 전송은 성공했으나 DB 갱신에 실패했습니다. 운영자에게 알려주세요. 전표번호: ${erpOrderNo}, 에러: ${updateError.message}`,
          },
          { status: 200 }
        );
      }

      return NextResponse.json({
        success: true,
        dryRun: false,
        erpOrderNo,
        sentAt,
        message: `경영박사 전송 완료 (전표번호: ${erpOrderNo})`,
      });
    }

    // 실패 — DB UPDATE 안 함, 로그만 기록
    await supabase.from('erp_invoice_send_logs').insert({
      invoice_id: invoiceId,
      sent_by: sentBy,
      status: 'failure',
      request_payload: requestPayload,
      response_text: responseText || null,
      error_message: errorMsg || '알 수 없는 오류',
    });

    return NextResponse.json(
      {
        success: false,
        error: `경영박사 전송 실패: ${errorMsg || '알 수 없는 오류'}`,
      },
      { status: 502 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
