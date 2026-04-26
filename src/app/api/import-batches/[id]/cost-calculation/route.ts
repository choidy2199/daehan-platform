/**
 * @deprecated 2026-04-24 (Stage 4 Phase B-2) — 인보이스V2에서 더 이상 호출되지 않음.
 *
 * 클라이언트 계산 엔진으로 전환됨. 동일 로직(1:1 포팅) 참조:
 *   public/manager/app.js의 _ipinv2CalcCostLocal
 *
 * 인보이스V2 진입 시 TOTAL 로딩 속도 개선(2,917~5,525ms → 목표 1,000ms 이내) 목적.
 * cost-calculation API의 Supabase 4 RTT 호출을 제거하여 가장 큰 병목 해소.
 *
 * 즉시 삭제 금지 — 수입건V2(_ipbat2*) 등 다른 화면에서 사용 중일 가능성 있음.
 * 사용처 grep 확인 후 완전 제거는 별도 Stage에서 결정.
 */
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
        .select('invoice_id, total_paid_krw, status, actual_usd')
        .in('invoice_id',
          ((await supabase.from('import_invoices').select('id').eq('batch_id', batchId)).data || []).map((x: { id: string }) => x.id)
        ),
    ]);
    if (iErr) throw iErr;
    if (cErr) throw cErr;
    if (pErr) throw pErr;

    const warnings: string[] = [];
    const unpaidInvoices: string[] = [];

    // [Stage 5-4 Phase B] 인보이스별 sumActualUsd 맵 산출 (status='completed' 필터)
    // 정규화 비율: fobNormalizeRatio = sumActualUsd / sumNetFobUsd (인보이스 단위)
    const actualUsdByInvoice = new Map<string, number>();
    (payments || []).forEach((p: Record<string, unknown>) => {
      if ((p.status as string) !== 'completed') return;
      const invId = p.invoice_id as string;
      const cur = actualUsdByInvoice.get(invId) || 0;
      actualUsdByInvoice.set(invId, cur + Number(p.actual_usd || 0));
    });

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
      const filteredRaw = rawItems.filter(it => !it.is_pallet_line);

      // [Stage 5-4 Phase B] 인보이스별 fob_krw 정규화 비율 산출
      const sumNetFobUsd = filteredRaw.reduce((s, it) => {
        const n = Number(it.net_fob_usd || 0) > 0 ? Number(it.net_fob_usd) : Number(it.amount_usd || 0);
        return s + n;
      }, 0);
      const sumActualUsd = actualUsdByInvoice.get(inv.id as string) || 0;
      const fobNormalizeRatio = (sumActualUsd > 0 && sumNetFobUsd > 0) ? sumActualUsd / sumNetFobUsd : 1;

      filteredRaw.forEach(it => {
        const fobUsd = Number(it.fob_usd || 0);
        // 할인·팔렛 반영된 순 FOB (Phase 2 개편). 비어있으면(구데이터) amount_usd 사용
        const netFobUsd = Number(it.net_fob_usd || 0) > 0 ? Number(it.net_fob_usd) : Number(it.amount_usd || 0);
        // [Stage 5-4 Phase B] fob_krw 산출 시 정규화 적용 — Σ fob_krw ≈ paymentsTotal 보장
        const fobKrw = weightedAvg != null ? Math.round(netFobUsd * fobNormalizeRatio * Number(weightedAvg)) : null;
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

    // [Stage 5-4 Phase B] fob_krw round 잔차도 maxIdx 항목에 흡수 — Σ fob_krw = paymentsTotal 정확 일치 보장
    const totalPaymentKrwForFobAbsorb = (payments || [])
      .filter((p: { status: string }) => p.status === 'completed')
      .reduce((s: number, p: { total_paid_krw: number }) => s + Number(p.total_paid_krw || 0), 0);
    const sumFobKrwNormalized = items.reduce((s, it) => s + Number(it.fob_krw || 0), 0);
    const fobRoundDelta = totalPaymentKrwForFobAbsorb - sumFobKrwNormalized;
    if (fobRoundDelta !== 0 && totalPaymentKrwForFobAbsorb > 0) {
      items[maxIdx].fob_krw = Number(items[maxIdx].fob_krw || 0) + fobRoundDelta;
    }
    // 잔차 흡수 후 totalFobKrw 재계산 (ratio 산출 기준)
    const totalFobKrw = items.reduce((s, it) => s + Number(it.fob_krw || 0), 0);

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
