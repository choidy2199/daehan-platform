/**
 * [Stage 6 Phase B-1] 인보이스V2 → 경영박사 매입전표 미리보기 API
 *
 * 인보이스 단위 (1 invoice → 1 매입전표) 매핑.
 * Stage 5-4 정규화 적용 (cost-calculation/route.ts와 동일 로직, invoice 단건 버전).
 *
 * 매입전표 lines 매핑 (NewOrderIn items: 품목CODE2$수량$단가$금액$부가세$비고)
 * - 품목CODE2 = import_invoice_items.management_code
 * - 수량      = items[].qty
 * - 단가      = unit_cost (= round(supply_price/qty))
 * - 금액      = supply_price (Stage 5-4 정규화 후 = fob_krw + cost_alloc)
 * - 부가세    = 0  (Q6 결정: 매입전표에 안 보냄)
 * - 비고      = items[].model
 *
 * 헤더 memo: "INV-NN · 가중평균환율 X.XX · YYYY-MM-DD"  (Q3)
 * 헤더 date: 전송 시점 today YY.MM.DD                  (Q4 — 본 응답에는 invoice_date 그대로 반환, 클라가 today 사용)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type RawItem = {
  id: string;
  management_code: string | null;
  model: string | null;
  qty: number | null;
  fob_usd: number | null;
  net_fob_usd: number | null;
  amount_usd: number | null;
  is_pallet_line: boolean | null;
  line_no: number | null;
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await context.params;
    if (!invoiceId) {
      return NextResponse.json({ success: false, error: 'id 필수' }, { status: 400 });
    }

    const [invoiceRes, itemsRes, paymentsRes, customsBatchRes] = await Promise.all([
      supabase.from('import_invoices').select('*').eq('id', invoiceId).maybeSingle(),
      supabase.from('import_invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('line_no', { ascending: true }),
      supabase.from('import_payments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('seq', { ascending: true }),
      supabase.from('import_batches')
        .select('id')
        .eq('linked_invoice_id', invoiceId)
        .maybeSingle(),
    ]);

    if (invoiceRes.error) throw invoiceRes.error;
    if (itemsRes.error) throw itemsRes.error;
    if (paymentsRes.error) throw paymentsRes.error;
    if (customsBatchRes.error) throw customsBatchRes.error;

    const invoice = invoiceRes.data as Record<string, unknown> | null;
    if (!invoice) {
      return NextResponse.json({ success: false, error: '인보이스를 찾을 수 없습니다' }, { status: 404 });
    }

    // 통관비는 batch 단위 — linked_invoice_id 매핑된 batch 있으면 그 batch_id로 조회
    const linkedBatchId = customsBatchRes.data ? (customsBatchRes.data as { id: string }).id : null;
    let customs: Array<Record<string, unknown>> = [];
    if (linkedBatchId) {
      const customsRes = await supabase.from('import_customs_costs')
        .select('*')
        .eq('batch_id', linkedBatchId)
        .order('item_order', { ascending: true });
      if (customsRes.error) throw customsRes.error;
      customs = (customsRes.data || []) as Array<Record<string, unknown>>;
    }

    // ─────────────────────────────────────────────────
    // Stage 5-4 정규화 적용 cost 계산 (cost-calculation/route.ts와 1:1 일치, invoice 단건 버전)
    // ─────────────────────────────────────────────────
    const weightedAvg = invoice.weighted_avg_rate as number | null;
    const status = invoice.status as string;
    const payments = (paymentsRes.data || []) as Array<Record<string, unknown>>;
    const rawItems = ((itemsRes.data || []) as RawItem[]).filter(it => !it.is_pallet_line);

    const sumActualUsd = payments
      .filter(p => (p.status as string) === 'completed')
      .reduce((s, p) => s + Number((p.actual_usd as number) || 0), 0);

    const totalPaymentKrw = payments
      .filter(p => (p.status as string) === 'completed')
      .reduce((s, p) => s + Number((p.total_paid_krw as number) || 0), 0);

    const sumNetFobUsd = rawItems.reduce((s, it) => {
      const n = Number(it.net_fob_usd || 0) > 0 ? Number(it.net_fob_usd) : Number(it.amount_usd || 0);
      return s + n;
    }, 0);
    const fobNormalizeRatio = (sumActualUsd > 0 && sumNetFobUsd > 0) ? sumActualUsd / sumNetFobUsd : 1;

    type CalcItem = {
      raw: RawItem;
      qty: number;
      fob_krw: number;
      cost_alloc: number;
      vat_alloc: number;
      supply_price: number;
      unit_cost: number;
      is_overflow_absorber: boolean;
    };

    const items: CalcItem[] = rawItems.map(it => {
      const netFobUsd = Number(it.net_fob_usd || 0) > 0 ? Number(it.net_fob_usd) : Number(it.amount_usd || 0);
      const fobKrw = weightedAvg != null ? Math.round(netFobUsd * fobNormalizeRatio * Number(weightedAvg)) : 0;
      return {
        raw: it,
        qty: Number(it.qty || 0),
        fob_krw: fobKrw,
        cost_alloc: 0,
        vat_alloc: 0,
        supply_price: 0,
        unit_cost: 0,
        is_overflow_absorber: false,
      };
    });

    const costTotal = customs
      .filter(c => (c.classification as string) === 'cost')
      .reduce((s, c) => s + Number((c.amount_krw as number) || 0), 0);
    const vatTotal = customs
      .filter(c => (c.classification as string) === 'vat')
      .reduce((s, c) => s + Number((c.amount_krw as number) || 0), 0);

    const canCalculate = status === 'paid' && weightedAvg != null && items.length > 0;

    if (canCalculate) {
      // maxIdx: 가장 큰 fob_krw
      let maxIdx = 0;
      for (let i = 1; i < items.length; i++) {
        if (items[i].fob_krw > items[maxIdx].fob_krw) maxIdx = i;
      }
      // fob round 잔차 흡수 (Σ fob_krw = paymentsTotal 보장)
      const sumFobKrwNormalized = items.reduce((s, it) => s + it.fob_krw, 0);
      const fobRoundDelta = totalPaymentKrw - sumFobKrwNormalized;
      if (fobRoundDelta !== 0 && totalPaymentKrw > 0) {
        items[maxIdx].fob_krw += fobRoundDelta;
      }
      items[maxIdx].is_overflow_absorber = true;

      const totalFobKrw = items.reduce((s, it) => s + it.fob_krw, 0);
      // ratio + cost_alloc/vat_alloc
      items.forEach((it, i) => {
        const ratio = totalFobKrw > 0 ? it.fob_krw / totalFobKrw : 0;
        if (i !== maxIdx) {
          it.cost_alloc = Math.round(costTotal * ratio);
          it.vat_alloc = Math.round(vatTotal * ratio);
        }
      });
      const otherCostSum = items.filter((_, i) => i !== maxIdx).reduce((s, it) => s + it.cost_alloc, 0);
      const otherVatSum = items.filter((_, i) => i !== maxIdx).reduce((s, it) => s + it.vat_alloc, 0);
      items[maxIdx].cost_alloc = costTotal - otherCostSum;
      items[maxIdx].vat_alloc = vatTotal - otherVatSum;
      items.forEach(it => {
        it.supply_price = it.fob_krw + it.cost_alloc;
        it.unit_cost = it.qty > 0 ? Math.round(it.supply_price / it.qty) : 0;
      });
    }

    // ─────────────────────────────────────────────────
    // 매입전표 lines + 헤더
    // ─────────────────────────────────────────────────
    const customerCode = (invoice.customer_code as string | null) || '';
    const customerName = (invoice.customer_name as string | null) || '';
    const invoiceNumber = (invoice.invoice_no as string) || '';
    const invoiceDate = (invoice.invoice_date as string) || '';
    const wAvg = Number(weightedAvg || 0);

    const memo = [
      invoiceNumber,
      '가중평균환율 ' + wAvg.toFixed(2),
      invoiceDate,
    ].join(' · ');

    const previewItems = items.map((it, idx) => ({
      no: idx + 1,
      code: it.raw.management_code || null,
      model: it.raw.model || '',
      qty: it.qty,
      price: it.unit_cost,
      amount: it.supply_price,
      has_code: !!(it.raw.management_code && String(it.raw.management_code).trim()),
    }));

    const qtySum = previewItems.reduce((s, it) => s + it.qty, 0);
    const amountSum = previewItems.reduce((s, it) => s + it.amount, 0);

    // ─────────────────────────────────────────────────
    // blockers 산출
    // ─────────────────────────────────────────────────
    const blockers: string[] = [];
    if (!canCalculate) {
      if (status !== 'paid' || weightedAvg == null) blockers.push('송금 미완료 (검증 뱃지 ≠ ok)');
      if (items.length === 0) blockers.push('품목이 없습니다');
    }
    if (!customerCode || !String(customerCode).trim()) {
      blockers.push('거래처 관리코드(CODE2) 누락');
    }
    const missingCodeCount = previewItems.filter(it => !it.has_code).length;
    if (missingCodeCount > 0) {
      blockers.push(`품목 ${missingCodeCount}건의 관리코드 누락`);
    }
    // 검증 뱃지 ok 확인 — paymentsTotal + customsTotal vs supply_price + vat_alloc
    if (canCalculate) {
      const customsTotal = costTotal + vatTotal;
      const totalSupplyPrice = items.reduce((s, it) => s + it.supply_price, 0);
      const totalVatAlloc = items.reduce((s, it) => s + it.vat_alloc, 0);
      const leftSide = totalPaymentKrw + customsTotal;
      const rightSide = totalSupplyPrice + totalVatAlloc;
      const diff = Math.abs(leftSide - rightSide);
      if (customs.length > 0 && customsTotal === 0) {
        blockers.push('통관비 입력 대기 (검증 뱃지 = pending_customs)');
      } else if (diff >= 10) {
        blockers.push(`검증 오차 ${diff.toLocaleString()}원 (검증 뱃지 = error)`);
      }
    }

    const erpSentAt = (invoice.erp_sent_at as string | null) || null;
    const erpOrderNo = (invoice.erp_order_no as string | null) || null;
    const alreadySent = erpSentAt !== null;

    const canSend = blockers.length === 0 && !alreadySent;

    return NextResponse.json({
      success: true,
      can_send: canSend,
      blockers,
      header: {
        customer_code: customerCode,
        customer_name: customerName,
        memo,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        weighted_avg_rate: wAvg,
      },
      items: previewItems,
      totals: {
        qty_sum: qtySum,
        amount_sum: amountSum,
      },
      already_sent: {
        sent: alreadySent,
        sent_at: erpSentAt,
        order_no: erpOrderNo,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
