import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// [B-3-2-2e] 인보이스 단건 조회 — 목록 GET 응답 구조와 동일한 단일 item 반환.
// 2-2d까지는 /api/import-invoices 전체 목록을 받고 find(id)로 추출 (1,723ms 병목).
// 이 엔드포인트로 단건만 조회해서 로딩 속도 대폭 개선.
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ success: false, error: 'id 필수' }, { status: 400 });

    // 인보이스 + 제품 라인 수 (목록 GET과 동일 패턴)
    const { data, error } = await supabase
      .from('import_invoices')
      .select('*, import_invoice_items(count)')
      .eq('id', id)
      .single();
    if (error) {
      if ((error as { code?: string }).code === 'PGRST116') {
        return NextResponse.json({ success: false, error: '인보이스를 찾을 수 없습니다' }, { status: 404 });
      }
      throw error;
    }

    // batch_no + batch_id 2nd query (목록 GET과 동일 패턴)
    const { data: batch } = await supabase
      .from('import_batches')
      .select('id, batch_no')
      .eq('linked_invoice_id', id)
      .maybeSingle();

    const row = data as Record<string, unknown>;
    const itemsArr = row.import_invoice_items as Array<{ count: number }> | null;
    const itemCount = itemsArr && itemsArr.length > 0 ? itemsArr[0].count : 0;

    const shaped = {
      ...row,
      item_count: itemCount,
      batch_no: batch?.batch_no || null,
      batch_id: batch?.id || (row.batch_id as string | null) || null,
    };

    return NextResponse.json({ success: true, data: shaped });
  } catch (err) {
    const msg = err instanceof Error
      ? err.message
      : (err && typeof err === 'object')
        ? JSON.stringify(err)
        : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
