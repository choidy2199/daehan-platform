import { supabaseAdmin } from '@/lib/supabase';

export const PORTAL_BRANDS = ['콜라보', '비트맨'] as const;
export type PortalBrand = (typeof PORTAL_BRANDS)[number];

export type Grade = 'in' | 'out' | 'pallet';

export type GenProduct = {
  code: string;
  manageCode?: string;
  category?: string;       // '브랜드-...' 형식
  model?: string;
  description?: string;
  cost?: number;
  inQty?: number;
  inPrice?: number;
  outQty?: number;
  outPrice?: number;
  palletQty?: number;
  palletPrice?: number;
  memo?: string;
};

export type CatalogItem = {
  code: string;
  name: string;
  brand: string;
  category: string;
  unit_price: number;     // 등급가
  min_qty: number;        // 등급별 최소 단위
  is_pallet_only: boolean;
  stock_label: 'plenty' | 'low' | 'out';
};

export function getGenBrand(p: GenProduct): string {
  const cat = (p.category || '').trim();
  if (!cat) return '';
  return cat.split('-')[0] || '';
}

export function priceForGrade(p: GenProduct, grade: Grade): { price: number; minQty: number; isPalletOnly: boolean } {
  if (grade === 'pallet') {
    return { price: p.palletPrice || 0, minQty: p.palletQty || 1, isPalletOnly: true };
  }
  if (grade === 'in') {
    return { price: p.inPrice || 0, minQty: p.inQty || 1, isPalletOnly: false };
  }
  // 'out'
  return { price: p.outPrice || 0, minQty: p.outQty || 1, isPalletOnly: false };
}

/**
 * 거래처 포털용 카탈로그 로드 (콜라보/비트맨만).
 * mw_gen_products(jsonb 배열) → 화이트리스트 브랜드 필터 + 등급가 적용.
 */
export async function loadCatalog(grade: Grade, brand?: string): Promise<CatalogItem[]> {
  if (!supabaseAdmin) throw new Error('service_role 키 없음');
  const { data, error } = await supabaseAdmin
    .from('app_data')
    .select('value')
    .eq('key', 'mw_gen_products')
    .maybeSingle();
  if (error) throw new Error(error.message);

  const products: GenProduct[] = Array.isArray(data?.value) ? (data!.value as GenProduct[]) : [];
  const items: CatalogItem[] = [];
  for (const p of products) {
    const b = getGenBrand(p);
    if (!PORTAL_BRANDS.includes(b as PortalBrand)) continue;
    if (brand && b !== brand) continue;
    const { price, minQty, isPalletOnly } = priceForGrade(p, grade);
    items.push({
      code: p.code,
      name: p.model || p.description || p.code,
      brand: b,
      category: p.category || '',
      unit_price: price,
      min_qty: minQty,
      is_pallet_only: isPalletOnly,
      stock_label: 'plenty',
    });
  }
  return items;
}

export async function findProductByCode(code: string): Promise<GenProduct | null> {
  if (!supabaseAdmin) throw new Error('service_role 키 없음');
  const { data } = await supabaseAdmin
    .from('app_data').select('value').eq('key', 'mw_gen_products').maybeSingle();
  const products: GenProduct[] = Array.isArray(data?.value) ? (data!.value as GenProduct[]) : [];
  return products.find((p) => p.code === code) || null;
}

/** 'DH-YYYYMMDD-NNN' 채번. NNN은 같은 날짜 주문 카운트+1. */
export async function nextOrderNo(): Promise<string> {
  if (!supabaseAdmin) throw new Error('service_role 키 없음');
  const today = new Date();
  const yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, '');
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const { count } = await supabaseAdmin
    .from('customer_orders')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startOfDay);
  const seq = String((count || 0) + 1).padStart(3, '0');
  return `DH-${yyyymmdd}-${seq}`;
}
