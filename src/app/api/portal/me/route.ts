import { NextRequest, NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/auth-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const guard = await requireCustomer(request);
  if (guard instanceof NextResponse) return guard;
  return NextResponse.json({
    user: { id: guard.user.id, name: guard.user.name, loginId: guard.user.login_id },
    customer: {
      id: guard.customer.id,
      erp_code: guard.customer.erp_code,
      name: guard.customer.name,
      dropship_price_grade: guard.customer.dropship_price_grade,
    },
  });
}
