import { NextRequest, NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/auth-guard';
import { loadCatalog, PORTAL_BRANDS } from '@/lib/portal-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/portal/catalog?brand=콜라보|비트맨
 * 응답: { brands, items }
 */
export async function GET(request: NextRequest) {
  const guard = await requireCustomer(request);
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(request.url);
  const brand = searchParams.get('brand') || undefined;
  if (brand && !(PORTAL_BRANDS as readonly string[]).includes(brand)) {
    return NextResponse.json({ error: '허용되지 않은 브랜드' }, { status: 422 });
  }

  const items = await loadCatalog(guard.customer.dropship_price_grade as 'in' | 'out' | 'pallet', brand);
  return NextResponse.json({
    brands: PORTAL_BRANDS,
    grade: guard.customer.dropship_price_grade,
    items,
  });
}
