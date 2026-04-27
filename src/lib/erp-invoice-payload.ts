/**
 * [Stage 6 Phase B-2 Step 1] 인보이스V2 → 경영박사 매입전표 페이로드 빌더
 *
 * erp-preview/route.ts 인라인 매핑 로직을 lib로 추출 + newOrderIn 페이로드 추가.
 * 1원 오차 방지를 위해 round 위치/순서/blockers 산출을 100% 동일하게 유지.
 *
 * 호출처: erp-preview (표시용 — newOrderIn 제외 spread), erp-send (dry-run/실 전송).
 *
 * 응답 형태(already_sent 등)는 인보이스V2 미리보기 모달(public/manager/app.js)
 * 호환을 위해 nested 객체 구조 유지.
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type RawItem = {
  id: string;
  management_code: string | null;
  model: string | null;          // ※ 실제 brand 값이 들어감
  name: string | null;           // ※ 실제 모델명이 들어감
  qty: number | null;
  fob_usd: number | null;
  net_fob_usd: number | null;
  amount_usd: number | null;
  is_pallet_line: boolean | null;
  line_no: number | null;
};

export type InvoicePayloadResult = {
  header: {
    customer_code: string;          // '' 가능 (기존 erp-preview와 동일)
    customer_name: string;          // '' 가능
    memo: string;
    invoice_number: string;
    invoice_date: string;
    weighted_avg_rate: number;      // null이면 0 (기존 동일)
  };
  items: Array<{
    no: number;
    code: string | null;            // management_code
    model: string;
    qty: number;
    price: number;                  // round(supply_price / qty)
    amount: number;                 // supply_price (= fob_krw + cost_alloc)
    has_code: boolean;
  }>;
  totals: { qty_sum: number; amount_sum: number };
  blockers: string[];
  can_send: boolean;
  already_sent: {
    sent: boolean;
    sent_at: string | null;
    order_no: string | null;
  };
  // erp-send 전용 — erp-preview 응답에서는 제외 (spread 시 의도적으로 제거)
  newOrderIn: {
    info: string;                   // "{customer_code}|{memo}|{YY.MM.DD KST today}|"
    items: string;                  // "{code}${qty}${price}${amount}$0$|..."
    ibgum: string;                  // "" (매입만)
  };
};

export class InvoiceNotFoundError extends Error {
  constructor(message = '인보이스를 찾을 수 없습니다') {
    super(message);
    this.name = 'InvoiceNotFoundError';
  }
}

/**
 * KST 기준 today를 YY.MM.DD 형식으로 반환.
 * Vercel 서버는 UTC라서 new Date()의 로컬 메서드로는 KST를 얻을 수 없음 → UTC+9 보정 후 UTC 메서드 사용.
 * Korea는 DST 미적용(1988년 이후) → UTC+9 고정.
 */
function ymdShortKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const yy = String(kst.getUTCFullYear()).slice(2);
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  return `${yy}.${mm}.${dd}`;
}

export async function buildInvoicePayload(invoiceId: string): Promise<InvoicePayloadResult> {
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
    throw new InvoiceNotFoundError();
  }

  // 통관비는 batch 단위 — linked_invoice_id 매핑된 batch가 있으면 그 batch_id로 조회
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
  // Stage 5-4 정규화 cost 계산 (erp-preview 인라인 로직 1:1 이식 — 1원 오차 방지)
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
    // [Hot-fix] DB의 model 컬럼에는 brand 값이 들어가고, 실제 모델명은 name 컬럼에 저장됨
    model: it.raw.name || it.raw.model || '',
    qty: it.qty,
    price: it.unit_cost,
    amount: it.supply_price,
    has_code: !!(it.raw.management_code && String(it.raw.management_code).trim()),
  }));

  const qtySum = previewItems.reduce((s, it) => s + it.qty, 0);
  const amountSum = previewItems.reduce((s, it) => s + it.amount, 0);

  // ─────────────────────────────────────────────────
  // blockers (erp-preview 인라인 로직 1:1 이식)
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

  // ─────────────────────────────────────────────────
  // newOrderIn 페이로드 빌드
  // info  : "{customer_code}|{memo}|{today YY.MM.DD KST}|"  (마지막 |는 자동채번 자리)
  // items : 라인별 "{code}${qty}${price}${amount}$0$" 를 |로 join
  //         · 다섯 번째 필드(부가세)는 항상 0
  //         · 여섯 번째 필드(비고)는 빈 문자열 (= $0$ 뒤에 그대로 끝)
  //         · 라인 0개면 빈 문자열
  // ibgum : "" (D4 — 매입만, 출금 없음)
  // ─────────────────────────────────────────────────
  const today = ymdShortKST();
  const info = `${customerCode}|${memo}|${today}|`;
  const itemsStr = previewItems
    .map(it => `${it.code || ''}$${it.qty}$${it.price}$${it.amount}$0$`)
    .join('|');
  const ibgum = '';

  return {
    header: {
      customer_code: customerCode,
      customer_name: customerName,
      memo,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      weighted_avg_rate: wAvg,
    },
    items: previewItems,
    totals: { qty_sum: qtySum, amount_sum: amountSum },
    blockers,
    can_send: canSend,
    already_sent: {
      sent: alreadySent,
      sent_at: erpSentAt,
      order_no: erpOrderNo,
    },
    newOrderIn: {
      info,
      items: itemsStr,
      ibgum,
    },
  };
}
