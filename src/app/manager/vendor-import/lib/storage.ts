import type { Client, GenProduct, VendorOrder } from './types';

// localStorage 안전 읽기
function safeParseArray<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function loadClients(): Client[] {
  return safeParseArray<Client>('mw_clients');
}

export function loadGenProducts(): GenProduct[] {
  return safeParseArray<GenProduct>('mw_gen_products');
}

// 브랜드 추출 (app.js getGenBrand 헬퍼 React 포팅)
// category 형식: "HPT-전동공구(디월트)" → "HPT"
//                "비트맨-드라이버" → "비트맨"
//                "콜라보" (대시 없으면 그대로) → "콜라보"
export function getGenBrand(product: GenProduct): string {
  const cat = product.category || '';
  const idx = cat.indexOf('-');
  if (idx === -1) return cat.trim();
  return cat.slice(0, idx).trim();
}

// 모든 브랜드 distinct 목록 (sub-tab 표시용)
export function getAllBrands(products: GenProduct[]): string[] {
  const set = new Set<string>();
  products.forEach((p) => {
    const b = getGenBrand(p);
    if (b) set.add(b);
  });
  return Array.from(set).sort();
}

// 특정 브랜드 제품만 필터
export function filterByBrand(products: GenProduct[], brand: string): GenProduct[] {
  if (!brand) return products;
  return products.filter((p) => getGenBrand(p) === brand);
}

// 발주 이력 (Phase 6에서 본격 사용)
export function loadVendorImports(): VendorOrder[] {
  return safeParseArray<VendorOrder>('mw_vendor_imports');
}

export function saveVendorImports(orders: VendorOrder[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('mw_vendor_imports', JSON.stringify(orders));
  } catch (err) {
    console.error('saveVendorImports failed:', err);
  }
}

// 자동 단가 결정 (palletQty 이상 → pallet, outQty 이상 → out, 그 외 → in)
export function decidePriceTier(
  product: GenProduct,
  quantity: number
): { tier: 'in' | 'out' | 'pallet'; unitPrice: number } {
  if (product.palletQty > 0 && quantity >= product.palletQty) {
    return { tier: 'pallet', unitPrice: product.palletPrice };
  }
  if (product.outQty > 0 && quantity >= product.outQty) {
    return { tier: 'out', unitPrice: product.outPrice };
  }
  return { tier: 'in', unitPrice: product.inPrice };
}

// 거래처 검색 매칭 (name + ceo + bizNo + manageCode 4개 필드 부분 일치, 대소문자 무시)
export function matchClient(query: string, client: Client): boolean {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return true;  // 빈 쿼리는 모두 매칭

  const fields = [
    client.name || '',
    client.ceo || '',
    client.bizNo || '',
    client.manageCode || '',
  ];

  for (const f of fields) {
    if (f.toLowerCase().indexOf(q) !== -1) return true;
  }
  return false;
}

// 거래처 필터링 (검색 + 최대 표시 개수)
export function filterClients(
  query: string,
  clients: Client[],
  max: number = 20
): Client[] {
  if (!clients || clients.length === 0) return [];
  const filtered: Client[] = [];
  for (const c of clients) {
    if (!c || !c.name) continue;
    if (matchClient(query, c)) {
      filtered.push(c);
      if (filtered.length >= max) break;
    }
  }
  return filtered;
}
