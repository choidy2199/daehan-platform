import type { SupabaseClient } from '@supabase/supabase-js';

type ItemForCalc = {
  id: string;
  qty: number;
  fob_usd: number;
  pallet_qty: number;
  amount_usd: number;
};

/**
 * 인보이스 합계/배분 재계산
 * - amount_usd = qty × fob_usd (per item)
 * - grossFob = Σ amount_usd
 * - discount = round(grossFob × rate/100, 2)
 * - palletCount = Σ pallet_qty, palletTotal = palletCount × palletUnitPrice
 * - discount_share_i: amount_i / grossFob 비율 (최대 amount 제품이 잔차 흡수)
 * - afterDiscount_i = amount_i - discount_share_i
 * - pallet_share_i: afterDiscount_i / Σ afterDiscount 비율 (최대 amount 제품이 잔차 흡수)
 * - net_fob_i = amount_i - discount_share_i + pallet_share_i
 * - Σ net_fob = grossFob - discount + palletTotal = final_total_usd (1원 오차 없음)
 */
export async function recalcInvoiceTotals(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<void> {
  const { data: inv, error: iErr } = await supabase
    .from('import_invoices')
    .select('discount_rate, pallet_unit_price_usd')
    .eq('id', invoiceId)
    .single();
  if (iErr) throw iErr;
  const invRow = inv as { discount_rate: number; pallet_unit_price_usd: number };
  const discountRate = Number(invRow.discount_rate || 0);
  const palletUnitPrice = Number(invRow.pallet_unit_price_usd || 0);

  const { data: rawItems, error: itErr } = await supabase
    .from('import_invoice_items')
    .select('id, qty, fob_usd, pallet_qty')
    .eq('invoice_id', invoiceId)
    .order('line_no', { ascending: true });
  if (itErr) throw itErr;

  const items: ItemForCalc[] = (rawItems || []).map((r: { id: string; qty: number; fob_usd: number; pallet_qty: number }) => {
    const qty = Number(r.qty || 0);
    const fob = Number(r.fob_usd || 0);
    const pq = Number(r.pallet_qty || 0);
    return { id: r.id, qty, fob_usd: fob, pallet_qty: pq, amount_usd: Number((qty * fob).toFixed(2)) };
  });

  const grossFob = Number(items.reduce((s, it) => s + it.amount_usd, 0).toFixed(2));
  const discountAmount = Number((grossFob * (discountRate / 100)).toFixed(2));
  const palletCount = items.reduce((s, it) => s + it.pallet_qty, 0);
  const palletTotal = Number((palletCount * palletUnitPrice).toFixed(2));
  const finalTotal = Number((grossFob - discountAmount + palletTotal).toFixed(2));

  let maxIdx = 0;
  for (let i = 1; i < items.length; i++) if (items[i].amount_usd > items[maxIdx].amount_usd) maxIdx = i;

  if (items.length > 0) {
    // 센트 단위로 계산하여 오차 흡수
    const amountCents = items.map(it => Math.round(it.amount_usd * 100));
    const grossCents = amountCents.reduce((s, c) => s + c, 0);
    const discountCents = Math.round(discountAmount * 100);
    const palletTotalCents = Math.round(palletTotal * 100);

    const discShares = new Array<number>(items.length);
    const afterDiscounts = new Array<number>(items.length);
    const palletShares = new Array<number>(items.length);
    const netFobs = new Array<number>(items.length);

    let discSum = 0;
    items.forEach((_it, i) => {
      if (i === maxIdx) { discShares[i] = 0; return; }
      discShares[i] = grossCents > 0 ? Math.round(discountCents * amountCents[i] / grossCents) : 0;
      discSum += discShares[i];
    });
    discShares[maxIdx] = discountCents - discSum;

    items.forEach((_it, i) => { afterDiscounts[i] = amountCents[i] - discShares[i]; });
    const sumAfterDiscount = afterDiscounts.reduce((s, c) => s + c, 0);

    let palletSum = 0;
    items.forEach((_it, i) => {
      if (i === maxIdx) { palletShares[i] = 0; return; }
      palletShares[i] = sumAfterDiscount > 0 ? Math.round(palletTotalCents * afterDiscounts[i] / sumAfterDiscount) : 0;
      palletSum += palletShares[i];
    });
    palletShares[maxIdx] = palletTotalCents - palletSum;

    items.forEach((_it, i) => { netFobs[i] = amountCents[i] - discShares[i] + palletShares[i]; });

    const updates = items.map((it, i) => ({
      id: it.id,
      amount_usd: Number((amountCents[i] / 100).toFixed(2)),
      discount_share_usd: Number((discShares[i] / 100).toFixed(2)),
      pallet_share_usd: Number((palletShares[i] / 100).toFixed(2)),
      net_fob_usd: Number((netFobs[i] / 100).toFixed(2)),
    }));
    await Promise.all(updates.map(u =>
      supabase.from('import_invoice_items').update({
        amount_usd: u.amount_usd,
        discount_share_usd: u.discount_share_usd,
        pallet_share_usd: u.pallet_share_usd,
        net_fob_usd: u.net_fob_usd,
      }).eq('id', u.id)
    ));
  }

  await supabase
    .from('import_invoices')
    .update({
      subtotal_usd: grossFob,
      discount_amount_usd: discountAmount,
      discount_usd: discountAmount,
      pallet_count: palletCount,
      pallet_total_usd: palletTotal,
      pallets_usd: palletTotal,
      final_total_usd: finalTotal,
      final_amount_usd: finalTotal,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId);
}
