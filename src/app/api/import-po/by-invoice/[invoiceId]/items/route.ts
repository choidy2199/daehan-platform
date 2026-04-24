import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// [Stage 4 Phase B-2] PO 통합 엔드포인트
// 인보이스V2 진입 시 기존 2단계 직렬 호출을 1회로 통합:
//   1) GET /api/import-po?linked_invoice_id=<id>  → poId 획득
//   2) GET /api/import-po/<poId>/items            → items 획득
// → GET /api/import-po/by-invoice/<invoiceId>/items 단일 호출
//
// 응답: { success, data: { po: {…} | null, items: [] } }
// - po가 null이면 연결된 PO 없음 (items = [])
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const { invoiceId } = await context.params;
    if (!invoiceId) {
      return NextResponse.json({ success: false, error: 'invoiceId 필수' }, { status: 400 });
    }

    // 1) PO 헤더 단건 조회 (linked_invoice_id 기준, 가장 최근 1건)
    const { data: poHeaders, error: hErr } = await supabase
      .from('import_po_headers')
      .select('*')
      .eq('linked_invoice_id', invoiceId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (hErr) throw hErr;
    const po = poHeaders && poHeaders.length > 0 ? poHeaders[0] : null;

    if (!po) {
      return NextResponse.json({ success: true, data: { po: null, items: [] } });
    }

    // 2) PO items 조회 (같은 호출에서)
    const { data: items, error: iErr } = await supabase
      .from('import_po_items')
      .select('*')
      .eq('po_id', po.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (iErr) throw iErr;

    return NextResponse.json({ success: true, data: { po, items: items || [] } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
