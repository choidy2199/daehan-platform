import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await context.params;

    const { data: batch, error: bErr } = await supabase
      .from('import_batches')
      .select('*')
      .eq('id', batchId)
      .single();
    if (bErr) throw bErr;

    const [{ data: invoices, error: iErr }, { data: customs, error: cErr }] = await Promise.all([
      supabase
        .from('import_invoices')
        .select('id, invoice_no, factory_name, factory_code, weighted_avg_rate, status, import_invoice_items(*)')
        .eq('batch_id', batchId),
      supabase
        .from('import_customs_costs')
        .select('*')
        .eq('batch_id', batchId),
    ]);
    if (iErr) throw iErr;
    if (cErr) throw cErr;

    const warnings: string[] = [];
    const unpaid: string[] = [];

    type Item = {
      model: string;
      qty: number;
      fob_krw: number;
      cost_alloc: number;
      vat_alloc: number;
      supply_price: number;
      unit_cost: number;
      factory_code: string | null;
      factory_name: string;
      invoice_no: string;
      weighted_avg_rate: number;
    };
    const items: Item[] = [];
    (invoices || []).forEach((inv: Record<string, unknown>) => {
      const status = inv.status as string;
      const weightedAvg = inv.weighted_avg_rate as number | null;
      if (status !== 'paid' || weightedAvg == null) {
        unpaid.push(`${inv.invoice_no} (${inv.factory_name})`);
      }
      const raws = (inv.import_invoice_items as Array<Record<string, unknown>>) || [];
      raws
        .filter(it => !it.is_pallet_line)
        .forEach(it => {
          const fobUsd = Number(it.fob_usd || 0);
          const fobKrw = weightedAvg != null ? Math.round(fobUsd * Number(weightedAvg)) : 0;
          items.push({
            model: String(it.model || ''),
            qty: Number(it.qty || 0),
            fob_krw: fobKrw,
            cost_alloc: 0,
            vat_alloc: 0,
            supply_price: 0,
            unit_cost: 0,
            factory_code: (inv.factory_code as string | null) || null,
            factory_name: inv.factory_name as string,
            invoice_no: inv.invoice_no as string,
            weighted_avg_rate: Number(weightedAvg || 0),
          });
        });
    });

    const canSend = unpaid.length === 0 && items.length > 0;
    if (unpaid.length > 0) warnings.push(...unpaid.map(u => `${u}의 송금이 완료되지 않았습니다`));

    if (!canSend) {
      return NextResponse.json({ success: true, data: { invoices_erp: [], can_send: false, warnings } });
    }

    const costTotal = (customs || []).filter((c: { classification: string }) => c.classification === 'cost').reduce((s: number, c: { amount_krw: number }) => s + Number(c.amount_krw || 0), 0);
    const vatTotal = (customs || []).filter((c: { classification: string }) => c.classification === 'vat').reduce((s: number, c: { amount_krw: number }) => s + Number(c.amount_krw || 0), 0);

    const totalFobKrw = items.reduce((s, it) => s + it.fob_krw, 0);
    let maxIdx = 0;
    for (let i = 1; i < items.length; i++) if (items[i].fob_krw > items[maxIdx].fob_krw) maxIdx = i;

    items.forEach((it, i) => {
      if (i === maxIdx) return;
      const ratio = totalFobKrw > 0 ? it.fob_krw / totalFobKrw : 0;
      it.cost_alloc = Math.round(costTotal * ratio);
      it.vat_alloc = Math.round(vatTotal * ratio);
    });
    const otherCostSum = items.filter((_, i) => i !== maxIdx).reduce((s, it) => s + it.cost_alloc, 0);
    const otherVatSum = items.filter((_, i) => i !== maxIdx).reduce((s, it) => s + it.vat_alloc, 0);
    items[maxIdx].cost_alloc = costTotal - otherCostSum;
    items[maxIdx].vat_alloc = vatTotal - otherVatSum;
    items.forEach(it => {
      it.supply_price = it.fob_krw + it.cost_alloc;
      it.unit_cost = it.qty > 0 ? Math.round(it.supply_price / it.qty) : 0;
    });

    // 공장별 그룹핑
    const byFactory = new Map<string, Item[]>();
    items.forEach(it => {
      const key = (it.factory_code || '') + '::' + it.factory_name;
      if (!byFactory.has(key)) byFactory.set(key, []);
      byFactory.get(key)!.push(it);
    });

    const today = new Date();
    const dateStr = today.getFullYear() + '.' + String(today.getMonth() + 1).padStart(2, '0') + '.' + String(today.getDate()).padStart(2, '0');

    const invoices_erp: Array<{ factory_code: string | null; factory_name: string; items: string; memo: string; total_supply: number; total_vat: number }> = [];
    byFactory.forEach((list, key) => {
      const [codePart, ...rest] = key.split('::');
      const factoryCode = codePart || null;
      const factoryName = rest.join('::');
      const itemsStr = list
        .map(it => [it.model, it.qty, it.unit_cost, it.supply_price, it.vat_alloc, ''].join('$'))
        .join('|');
      const totalSupply = list.reduce((s, it) => s + it.supply_price, 0);
      const totalVat = list.reduce((s, it) => s + it.vat_alloc, 0);
      const wAvg = list[0].weighted_avg_rate || 0;
      const memo = [
        (batch as { batch_no: string }).batch_no,
        '가중평균환율 ' + Number(wAvg).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
        dateStr,
      ].join(' · ');
      invoices_erp.push({ factory_code: factoryCode, factory_name: factoryName, items: itemsStr, memo, total_supply: totalSupply, total_vat: totalVat });
    });

    return NextResponse.json({ success: true, data: { invoices_erp, can_send: true, warnings } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
