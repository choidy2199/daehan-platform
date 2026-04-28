import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { recalcInvoiceTotals } from '@/lib/import-invoice-calc';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '500', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // [트랙 C] 모델명 배지 표시를 위해 import_invoice_items의 line_no/name/qty/is_pallet_line도 가져옴
    // count는 클라가 items 배열 길이로 산출 (별도 count() 불필요)
    let query = supabase
      .from('import_invoices')
      .select('*, import_invoice_items(line_no, name, qty, is_pallet_line)', { count: 'exact' })
      .order('invoice_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    // batch_no + batch_id 2nd query — PostgREST 다중 embed 충돌 회피 (d33059d 패턴)
    // [B-3-2-1] batch_id 추가: 인보이스V2 통관비 UI가 linked batch의 id로 API 호출
    const invoiceIds = (data || []).map((d: Record<string, unknown>) => d.id as string).filter(Boolean);
    const batchMap = new Map<string, { id: string; batch_no: string }>();
    if (invoiceIds.length > 0) {
      const { data: batches } = await supabase
        .from('import_batches')
        .select('id, linked_invoice_id, batch_no')
        .in('linked_invoice_id', invoiceIds);
      for (const b of (batches || []) as Array<{ id: string; linked_invoice_id: string; batch_no: string }>) {
        if (b.linked_invoice_id) batchMap.set(b.linked_invoice_id, { id: b.id, batch_no: b.batch_no });
      }
    }

    type ItemBadge = { line_no: number | null; name: string | null; qty: number | null; is_pallet_line: boolean | null };
    const shaped = (data || []).map((row: Record<string, unknown>) => {
      const itemsArr = (row.import_invoice_items as ItemBadge[] | null) || [];
      // 팔렛 라인 제외 + line_no 정렬
      const realItems = itemsArr
        .filter(it => !it.is_pallet_line)
        .sort((a, b) => (Number(a.line_no || 0) - Number(b.line_no || 0)));
      const linked = batchMap.get(row.id as string);
      return {
        ...row,
        item_count: realItems.length,
        // 모델명 배지용 — name(첫 토큰) + qty 페어
        items_for_badge: realItems.map(it => ({
          name: it.name || '',
          qty: Number(it.qty || 0),
        })),
        batch_no: linked?.batch_no || null,
        batch_id: linked?.id || (row.batch_id as string | null) || null,
      };
    });

    return NextResponse.json({ success: true, data: shaped, total: count ?? shaped.length });
  } catch (err) {
    const msg = err instanceof Error
      ? err.message
      : (err && typeof err === 'object')
        ? JSON.stringify(err)
        : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { invoice_no, batch_id, factory_name, factory_code, invoice_date, payment_terms, memo, customer_code, customer_name } = body || {};
    if (!invoice_no || !invoice_date) {
      return NextResponse.json({ success: false, error: '인보이스 번호, 인보이스 일자는 필수입니다' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('import_invoices')
      .insert({
        invoice_no: String(invoice_no).trim(),
        batch_id: batch_id || null,
        factory_name: factory_name ? String(factory_name).trim() : null,
        factory_code: factory_code?.trim() || null,
        invoice_date,
        payment_terms: payment_terms?.trim() || null,
        memo: memo?.trim() || null,
        customer_code: customer_code ?? null,
        customer_name: customer_name ?? null,
      })
      .select('*')
      .single();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: false, error: '이미 등록된 인보이스 번호입니다', code: 'DUPLICATE' }, { status: 409 });
      }
      throw error;
    }

    // 1:1 자동 생성: body에 batch_id가 없을 때만 수입건(import_batches) 생성
    // batch_no: IMP-YYYY-NN 형식 (기존 2자리 순번 유지) + 23505 재시도 최대 3회
    if (!batch_id && data?.id) {
      const year = new Date().getFullYear();
      const prefix = `IMP-${year}-`;
      let batchInsertError: unknown = null;
      let batchData: unknown = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        // 현재 연도 최대 batch_no 조회
        const { data: last } = await supabase
          .from('import_batches')
          .select('batch_no')
          .like('batch_no', `${prefix}%`)
          .order('batch_no', { ascending: false })
          .limit(1);
        let nextNum = 1;
        if (last && last.length > 0 && last[0].batch_no) {
          const match = String(last[0].batch_no).match(/IMP-\d{4}-(\d+)/);
          if (match) nextNum = parseInt(match[1], 10) + attempt + 1;
          else nextNum = attempt + 1;
        } else {
          nextNum = attempt + 1;
        }
        const batchNo = `${prefix}${String(nextNum).padStart(2, '0')}`;

        const { data: b, error: bErr } = await supabase
          .from('import_batches')
          .insert({
            batch_no: batchNo,
            batch_name: data.factory_name || data.invoice_no,
            linked_invoice_id: data.id,
            status: 'planning',
          })
          .select('*')
          .single();

        if (!bErr && b) { batchData = b; batchInsertError = null; break; }
        if (bErr && bErr.code === '23505') {
          batchInsertError = bErr;
          continue; // batch_no 또는 linked_invoice_id unique 충돌 → 재시도
        }
        batchInsertError = bErr; // 비-23505 에러 즉시 탈출
        break;
      }

      if (batchInsertError) {
        // 롤백: 방금 생성된 invoice 삭제
        const { error: delErr } = await supabase.from('import_invoices').delete().eq('id', data.id);
        if (delErr) console.error('[invoice POST rollback] invoice delete failed:', delErr);
        const msg = (batchInsertError instanceof Error) ? batchInsertError.message : String((batchInsertError as { message?: string } | null)?.message || batchInsertError);
        return NextResponse.json(
          { success: false, error: '수입건 자동 생성 실패, 인보이스도 취소됨: ' + msg },
          { status: 500 }
        );
      }

      // 응답에 생성된 batch 정보 포함
      return NextResponse.json({ success: true, data, batch: batchData });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...fields } = body || {};
    if (!id) return NextResponse.json({ success: false, error: 'id 필수' }, { status: 400 });

    const allowed = ['invoice_no', 'batch_id', 'factory_name', 'factory_code', 'invoice_date', 'payment_terms', 'memo', 'subtotal_usd', 'discount_usd', 'pallets_usd', 'final_amount_usd', 'weighted_avg_rate', 'status', 'discount_rate', 'discount_amount_usd', 'pallet_count', 'pallet_unit_price_usd', 'pallet_total_usd', 'final_total_usd', 'customer_code', 'customer_name'];
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (k in fields) {
        const v = (fields as Record<string, unknown>)[k];
        if (typeof v === 'string') payload[k] = v.trim() || null;
        else payload[k] = v;
      }
    }

    const { data, error } = await supabase
      .from('import_invoices')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: false, error: '이미 등록된 인보이스 번호입니다', code: 'DUPLICATE' }, { status: 409 });
      }
      throw error;
    }

    // discount_rate 또는 pallet_unit_price_usd 변경 시 전체 재계산
    const needsRecalc = 'discount_rate' in fields || 'pallet_unit_price_usd' in fields;
    if (needsRecalc) {
      await recalcInvoiceTotals(supabase, id);
      const { data: refreshed } = await supabase.from('import_invoices').select('*').eq('id', id).single();
      if (refreshed) return NextResponse.json({ success: true, data: refreshed });
    }
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'id 필수' }, { status: 400 });

    // 1) 연결된 PO 자동 복원 (status='confirmed', linked_invoice_id=null)
    const { data: linkedPOs, error: poQueryErr } = await supabase
      .from('import_po_headers')
      .select('id')
      .eq('linked_invoice_id', id);
    if (poQueryErr) console.error('[invoice DELETE] PO query error:', poQueryErr);
    const restoredCount = (linkedPOs || []).length;
    if (restoredCount > 0) {
      const { error: restoreErr } = await supabase
        .from('import_po_headers')
        .update({ status: 'confirmed', linked_invoice_id: null })
        .eq('linked_invoice_id', id);
      if (restoreErr) {
        return NextResponse.json({ success: false, error: 'PO 복원 실패: ' + restoreErr.message }, { status: 500 });
      }
    }

    // 2) 연결된 수입건(import_batches) 삭제 — 1:1 관계, linked_invoice_id 고아 방지
    const { error: batchDelErr } = await supabase
      .from('import_batches')
      .delete()
      .eq('linked_invoice_id', id);
    if (batchDelErr) console.error('[invoice DELETE] batch delete error:', batchDelErr);

    // 3) 인보이스 삭제 (import_invoice_items는 FK cascade 기대, 미설정이면 명시 삭제)
    const { error } = await supabase.from('import_invoices').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true, restoredPOCount: restoredCount });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
