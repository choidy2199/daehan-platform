/**
 * [Stage 4-2 Phase B] 인보이스V2 진입 전용 통합 엔드포인트
 *
 * 배경: Stage 4 Phase B-2까지 4회 RTT (invoice-single + invoice-items + po-by-invoice + customs-costs)
 *       각 Vercel serverless cold start + 네트워크 오버헤드 누적 → TOTAL 3,463ms
 * 개선: 서버 내부 Promise.all 병렬 → 1회 RTT. Cold start 1회만 발생.
 *
 * 기존 4개 API는 **전부 유지** — FOB 편집 후 items 재조회, 송금 CRUD,
 * 수입건V2의 customs 사용 등 독립 사용처 다수.
 *
 * 응답 스키마:
 *   { success: true, data: {
 *       invoice: import_invoices 단건 (+ batch: { id, batch_no } | null),
 *       items:   import_invoice_items 배열 (line_no 오름차순),
 *       po:      { header, items } | { header: null, items: [] },
 *       customs: import_customs_costs 배열 (item_order 오름차순),
 *       payments: import_payments 배열 (seq 오름차순)
 *     }
 *   }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// [Stage 4-3] Node → Edge 전환. Cold start 1,000~1,500ms → ~50ms 기대.
// 롤백: runtime = 'nodejs' 복구 후 재배포.
// 호환성: @supabase/supabase-js v2 = fetch 기반 (edge OK), next/server = edge 지원.
export const runtime = 'edge';
export const dynamic = 'force-dynamic';  // invoice는 실시간 데이터 — 캐시 방지

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
    if (!invoiceId) {
      return NextResponse.json({ success: false, error: 'id 필수' }, { status: 400 });
    }

    // Phase 1: 5개 쿼리 완전 병렬 (상호 의존 없음)
    const [invoiceRes, itemsRes, poHeaderRes, paymentsRes, batchRes] = await Promise.all([
      supabase.from('import_invoices').select('*').eq('id', invoiceId).maybeSingle(),
      supabase.from('import_invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('line_no', { ascending: true }),
      supabase.from('import_po_headers')
        .select('*')
        .eq('linked_invoice_id', invoiceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('import_payments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('seq', { ascending: true }),
      supabase.from('import_batches')
        .select('id, batch_no')
        .eq('linked_invoice_id', invoiceId)
        .maybeSingle(),
    ]);

    if (invoiceRes.error) throw invoiceRes.error;
    if (itemsRes.error) throw itemsRes.error;
    if (poHeaderRes.error) throw poHeaderRes.error;
    if (paymentsRes.error) throw paymentsRes.error;
    if (batchRes.error) throw batchRes.error;

    const invoice = invoiceRes.data as Record<string, unknown> | null;
    if (!invoice) {
      return NextResponse.json(
        { success: false, error: '인보이스를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    const poHeader = poHeaderRes.data as { id: string } | null;
    const batch = batchRes.data as { id: string; batch_no: string } | null;
    // batch_id: linked_invoice_id 역참조 > invoice.batch_id fallback (invoice-single route와 동일 패턴)
    const batchId = batch?.id || (invoice.batch_id as string | null) || null;

    // Phase 2: po_items + customs 병렬 (의존성: po_header.id, batch_id)
    const [poItemsRes, customsRes] = await Promise.all([
      poHeader?.id
        ? supabase
            .from('import_po_items')
            .select('*')
            .eq('po_id', poHeader.id)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      batchId
        ? supabase
            .from('import_customs_costs')
            .select('*')
            .eq('batch_id', batchId)
            .order('item_order', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (poItemsRes.error) throw poItemsRes.error;
    if (customsRes.error) throw customsRes.error;

    // invoice 응답 shape: batch 정보 포함 (invoice-single route 호환)
    const invoiceShaped = {
      ...invoice,
      batch_id: batchId,
      batch_no: batch?.batch_no || null,
      batch: batch || null,
    };

    return NextResponse.json({
      success: true,
      data: {
        invoice: invoiceShaped,
        items: itemsRes.data || [],
        po: {
          header: poHeader || null,
          items: poItemsRes.data || [],
        },
        customs: customsRes.data || [],
        payments: paymentsRes.data || [],
      },
    });
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : err && typeof err === 'object'
          ? JSON.stringify(err)
          : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
