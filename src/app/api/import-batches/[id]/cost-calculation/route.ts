import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Item = {
  id: string;
  invoice_id: string;
  invoice_no: string;
  factory_name: string;
  factory_code: string | null;
  model: string;
  name: string | null;
  qty: number;
  fob_usd: number;
  fob_krw: number | null;
  is_pallet_line: boolean;
  weighted_avg_rate: number | null;
};

type CalcItem = Item & {
  ratio: number | null;
  cost_alloc: number | null;
  vat_alloc: number | null;
  supply_price: number | null;
  unit_cost: number | null;
  is_overflow_absorber: boolean;
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await context.params;

    // 연결된 인보이스 + 제품 라인 + 통관비 로드
    const [{ data: invoices, error: iErr }, { data: customs, error: cErr }, { data: payments, error: pErr }] = await Promise.all([
      supabase
        .from('import_invoices')
        .select('id, invoice_no, factory_name, factory_code, weighted_avg_rate, status, import_invoice_items(*)')
        .eq('batch_id', batchId),
      supabase
        .from('import_customs_costs')
        .select('*')
        .eq('batch_id', batchId)
        .order('item_order', { ascending: true }),
      supabase
        .from('import_payments')
        .select('invoice_id, total_paid_krw, status')
        .in('invoice_id',
          ((await supabase.from('import_invoices').select('id').eq('batch_id', batchId)).data || []).map((x: { id: string }) => x.id)
        ),
    ]);
    if (iErr) throw iErr;
    if (cErr) throw cErr;
    if (pErr) throw pErr;

    const warnings: string[] = [];
    const unpaidInvoices: string[] = [];

    // 모든 item 수집 (is_pallet_line=false만 배분 대상)
    const items: Item[] = [];
    (invoices || []).forEach((inv: Record<string, unknown>) => {
      const status = inv.status as string;
      const invNo = inv.invoice_no as string;
      const weightedAvg = inv.weighted_avg_rate as number | null;
      if (status !== 'paid' || weightedAvg == null) {
        unpaidInvoices.push(`${invNo} (${inv.factory_name})`);
      }
      const rawItems = (inv.import_invoice_items as Array<Record<string, unknown>>) || [];
      rawItems
        .filter(it => !it.is_pallet_line)
        .forEach(it => {
          const fobUsd = Number(it.fob_usd || 0);
          // 할인·팔렛 반영된 순 FOB (Phase 2 개편). 비어있으면(구데이터) amount_usd 사용
          const netFobUsd = Number(it.net_fob_usd || 0) > 0 ? Number(it.net_fob_usd) : Number(it.amount_usd || 0);
          const fobKrw = weightedAvg != null ? Math.round(netFobUsd * Number(weightedAvg)) : null;
          items.push({
            id: it.id as string,
            invoice_id: inv.id as string,
            invoice_no: invNo,
            factory_name: inv.factory_name as string,
            factory_code: inv.factory_code as string | null,
            model: String(it.model || ''),
            name: (it.name as string) || null,
            qty: Number(it.qty || 0),
            fob_usd: fobUsd,
            fob_krw: fobKrw,
            is_pallet_line: false,
            weighted_avg_rate: weightedAvg,
          });
        });
    });

    const costTotal = (customs || [])
      .filter((c: { classification: string }) => c.classification === 'cost')
      .reduce((s: number, c: { amount_krw: number }) => s + Number(c.amount_krw || 0), 0);
    const vatTotal = (customs || [])
      .filter((c: { classification: string }) => c.classification === 'vat')
      .reduce((s: number, c: { amount_krw: number }) => s + Number(c.amount_krw || 0), 0);

    // 미납 인보이스 있으면 배분 불가 — 원시 데이터만 반환
    if (unpaidInvoices.length > 0) {
      warnings.push('연결된 인보이스 중 송금 미완료 건이 있습니다: ' + unpaidInvoices.join(', '));
      const calcItems: CalcItem[] = items.map(it => ({
        ...it,
        ratio: null,
        cost_alloc: null,
        vat_alloc: null,
        supply_price: null,
        unit_cost: null,
        is_overflow_absorber: false,
      }));
      const totalFobUsd = items.reduce((s, it) => s + it.fob_usd, 0);
      return NextResponse.json({
        success: true,
        data: {
          items: calcItems,
          totals: {
            fob_usd: Number(totalFobUsd.toFixed(2)),
            fob_krw: null,
            cost_alloc: costTotal,
            vat_alloc: vatTotal,
            supply_price: null,
            total_paid: null,
          },
          can_calculate: false,
          warnings,
        },
      });
    }

    // 전부 paid — 배분 계산
    const totalFobKrw = items.reduce((s, it) => s + Number(it.fob_krw || 0), 0);
    if (items.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          items: [],
          totals: { fob_usd: 0, fob_krw: 0, cost_alloc: costTotal, vat_alloc: vatTotal, supply_price: 0, total_paid: costTotal + vatTotal },
          can_calculate: true,
          warnings: ['배분할 제품이 없습니다'],
        },
      });
    }

    // 가장 큰 FOB 원화 제품 인덱스 (동률 시 첫 번째)
    let maxIdx = 0;
    for (let i = 1; i < items.length; i++) {
      if ((items[i].fob_krw || 0) > (items[maxIdx].fob_krw || 0)) maxIdx = i;
    }

    const calcItems: CalcItem[] = items.map((it, i) => {
      const ratio = totalFobKrw > 0 ? Number(it.fob_krw || 0) / totalFobKrw : 0;
      return {
        ...it,
        ratio,
        cost_alloc: i === maxIdx ? null : Math.round(costTotal * ratio),
        vat_alloc: i === maxIdx ? null : Math.round(vatTotal * ratio),
        supply_price: null,
        unit_cost: null,
        is_overflow_absorber: i === maxIdx,
      };
    });
    // 최대 제품이 나머지 배분
    const otherCostSum = calcItems.filter((_, i) => i !== maxIdx).reduce((s, it) => s + Number(it.cost_alloc || 0), 0);
    const otherVatSum = calcItems.filter((_, i) => i !== maxIdx).reduce((s, it) => s + Number(it.vat_alloc || 0), 0);
    calcItems[maxIdx].cost_alloc = costTotal - otherCostSum;
    calcItems[maxIdx].vat_alloc = vatTotal - otherVatSum;
    // 공급가 · 단가 계산
    calcItems.forEach(it => {
      const fobKrw = Number(it.fob_krw || 0);
      const cost = Number(it.cost_alloc || 0);
      it.supply_price = fobKrw + cost;
      it.unit_cost = it.qty > 0 ? Math.round(it.supply_price / it.qty) : 0;
    });

    // 합계
    const totalFobUsd = items.reduce((s, it) => s + it.fob_usd, 0);
    const totalSupplyPrice = calcItems.reduce((s, it) => s + Number(it.supply_price || 0), 0);
    const totalPaymentKrw = (payments || [])
      .filter((p: { status: string }) => p.status === 'completed')
      .reduce((s: number, p: { total_paid_krw: number }) => s + Number(p.total_paid_krw || 0), 0);
    const totalPaid = totalPaymentKrw + costTotal + vatTotal;

    return NextResponse.json({
      success: true,
      data: {
        items: calcItems,
        totals: {
          fob_usd: Number(totalFobUsd.toFixed(2)),
          fob_krw: totalFobKrw,
          cost_alloc: costTotal,
          vat_alloc: vatTotal,
          supply_price: totalSupplyPrice,
          total_paid: totalPaid,
        },
        can_calculate: true,
        warnings,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
