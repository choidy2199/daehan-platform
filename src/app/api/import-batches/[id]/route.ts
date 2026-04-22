import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/import-batches/[id]
 * 단일 수입건 상세 조회 (1:1 연결된 인보이스 정보 포함).
 *
 * 응답:
 *   {
 *     success: true,
 *     data: {
 *       ...batch 전체 필드 (id, batch_no, batch_name, container_no, customs_date,
 *                           status, erp_sent_at, linked_invoice_id, created_at, updated_at),
 *       linked_invoice: {
 *         id, invoice_no, factory_name, factory_code, invoice_date,
 *         customer_code, customer_name, status,
 *         final_amount_usd, subtotal_usd, weighted_avg_rate
 *       } | null
 *     }
 *   }
 *
 * Stage A 범위: linked_invoice_id (1:1) join만 추가. batch_id 역참조는 이번에 다루지 않음.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { data: batch, error } = await supabase
      .from('import_batches')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if ((error as { code?: string }).code === 'PGRST116') {
        return NextResponse.json({ success: false, error: '수입건을 찾을 수 없습니다' }, { status: 404 });
      }
      throw error;
    }

    // linked_invoice (1:1) 별도 조회
    let linkedInvoice: unknown = null;
    if (batch && batch.linked_invoice_id) {
      const { data: inv } = await supabase
        .from('import_invoices')
        .select('id, invoice_no, factory_name, factory_code, invoice_date, customer_code, customer_name, status, final_amount_usd, subtotal_usd, weighted_avg_rate')
        .eq('id', batch.linked_invoice_id)
        .maybeSingle();
      linkedInvoice = inv || null;
    }

    return NextResponse.json({ success: true, data: { ...batch, linked_invoice: linkedInvoice } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : (typeof err === 'object' ? JSON.stringify(err) : String(err));
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
