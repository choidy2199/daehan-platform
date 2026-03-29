import { DB, findProduct, findStock, findPromo, KEYS, save } from './db';

// Formatters - EXACT same as original
export const comma = (n: number): string => {
  const s = String(Math.round(n));
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};
export const fmt = (n: number | null | undefined): string => {
  if (n == null || isNaN(n as number) || n === 0) return '-';
  return comma(n as number);
};
export const fmtN = fmt;
export const fmtPrice = (n: number | null | undefined): string => {
  if (n == null || isNaN(n as number)) return '-';
  return comma(n as number);
};
export const pct = (n: number | null | undefined): string => {
  if (n == null || isNaN(n as number)) return '-';
  return ((n as number) * 100).toFixed(1) + '%';
};

// Cost calculation - EXACT same as original
export function calcCost(supplyPrice: number, productDC: number): number {
  if (!supplyPrice) return 0;
  const s = DB.settings;
  const sp = supplyPrice;
  let arTotal = sp * s.quarterDC + sp * s.yearDC;
  (s.arPromos || []).forEach(ap => { if (ap.rate > 0) arTotal += sp * (ap.rate / 100); });
  let volPct = 0;
  (s.volPromos || []).forEach(vp => { if (vp.rate > 0) volPct += vp.rate; });
  volPct += (productDC || 0) * 100;
  return (sp - arTotal) / (1 + volPct / 100);
}

// Margin calculation
export function calcMargin(price: number, cost: number, feeRate: number) {
  if (!price || !cost) return null;
  const vat = price / 11;
  const fee = price * feeRate;
  const profit = price - vat - fee - cost;
  const rate = (profit / price) * 100;
  return { profit: Math.round(profit), rate };
}

export function marginBadge(price: number | undefined, cost: number | undefined, feeRate: number): string {
  if (!price || !cost) return '';
  const m = calcMargin(price, cost, feeRate);
  if (!m) return '';
  const color = m.profit >= 0 ? '#1D9E75' : '#CC2222';
  return `<div style="font-size:10px;color:${color};line-height:1.2;margin-top:2px">${m.rate.toFixed(1)}% ${m.profit >= 0 ? '+' : ''}${fmt(m.profit)}원</div>`;
}

// Sort order
const SUBCAT_ORDER = [
  '12V FUEL','12V 브러쉬리스','12V 브러쉬','12V 기타',
  '18V FUEL','18V 브러쉬리스','18V 브러쉬','18V 기타',
  'MX FUEL','MX','측정공구','작업공구','안전장비','비트',
  '드릴비트 SDS +','드릴비트 SDS MAX','블레이드','소켓',
  '파워툴 전용 액세서리','엠파이어','툴박스','스토리지','벽걸이',
  '소프트 백','L4','유선','IR','기타'
];

export function getSubcatOrder(subcat: string | undefined): number {
  if (!subcat) return 999;
  const idx = SUBCAT_ORDER.indexOf(subcat);
  if (idx >= 0) return idx;
  let best = -1, bestLen = 0;
  for (let i = 0; i < SUBCAT_ORDER.length; i++) {
    if (subcat.includes(SUBCAT_ORDER[i]) && SUBCAT_ORDER[i].length > bestLen) {
      best = i; bestLen = SUBCAT_ORDER[i].length;
    }
    if (SUBCAT_ORDER[i].includes(subcat) && subcat.length > bestLen) {
      best = i; bestLen = subcat.length;
    }
  }
  return best >= 0 ? best : 998;
}

export function sortProducts(list: any[]): any[] {
  return [...list].sort((a, b) => {
    const oa = getSubcatOrder(a.subcategory);
    const ob = getSubcatOrder(b.subcategory);
    if (oa !== ob) return oa - ob;
    return String(a.model || '').localeCompare(String(b.model || ''));
  });
}

// Recalculate all product prices
export function recalcAll() {
  const s = DB.settings;
  const naverFee = s.naverFee || 0.0663;
  const openElecFee = s.openElecFee || 0.13;
  const openHandFee = s.openHandFee || 0.176;

  DB.products.forEach(p => {
    if (!p.supplyPrice) return;
    const cost = calcCost(p.supplyPrice, p.productDC || 0);
    p.cost = Math.round(cost);
    p.priceA = Math.ceil(cost * (1 + (s.mkDomae || 1) / 100) / 100) * 100;
    p.priceRetail = Math.ceil(cost * (1 + (s.mkRetail || 15) / 100) / 1000) * 1000;
    const naverDenom = 10/11 - naverFee - (s.mkNaver || 1) / 100;
    p.priceNaver = naverDenom > 0 ? Math.ceil(cost / naverDenom / 100) * 100 : 0;
    const isElec = (p.category === '파워툴');
    const openFee = isElec ? openElecFee : openHandFee;
    const openRate = isElec ? (s.mkOpenElec || 0.5) : (s.mkOpenHand || 0.5);
    const openDenom = 10/11 - openFee - openRate / 100;
    p.priceOpen = openDenom > 0 ? Math.ceil(cost / openDenom / 100) * 100 : 0;
  });

  DB.promotions.forEach(pr => {
    if (pr.promoPrice && pr.promoPrice > 0) {
      const prod = pr.code ? findProduct(pr.code) : null;
      const pdc = prod ? (prod.productDC || 0) : 0;
      pr.cost = Math.round(calcCost(pr.promoPrice, pdc));
    }
  });

  DB.saveProducts();
  DB.savePromotions();
  DB.saveInventory();
}

// Get effective cost (promo or regular)
export function getEffectiveCost(code: string) {
  const promo = findPromo(code);
  if (promo && promo.cost && promo.cost > 0) return { cost: promo.cost, isPromo: true, promoName: promo.promoName || '' };
  const p = findProduct(code);
  if (p) return { cost: p.cost || 0, isPromo: false, promoName: '' };
  return { cost: 0, isPromo: false, promoName: '' };
}
