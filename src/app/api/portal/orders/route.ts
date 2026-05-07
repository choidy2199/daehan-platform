import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireCustomer } from '@/lib/auth-guard';
import {
  findProductByCode,
  getGenBrand,
  nextOrderNo,
  PORTAL_BRANDS,
  priceForGrade,
  type Grade,
} from '@/lib/portal-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/portal/orders — 본인 주문 내역 (최신순) */
export async function GET(request: NextRequest) {
  const guard = await requireCustomer(request);
  if (guard instanceof NextResponse) return guard;
  if (!supabaseAdmin) return NextResponse.json({ error: 'service_role 키 없음' }, { status: 500 });

  const { data, error } = await supabaseAdmin
    .from('customer_orders')
    .select('id, order_no, status, ship_type, total_amount, total_qty, ship_tracking_no, created_at, shipped_at, completed_at')
    .eq('customer_id', guard.customer.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}

type ItemInput = { code: string; quantity: number };
type Body = {
  items: ItemInput[];
  ship_type?: 'normal' | 'direct';
  customer_note?: string;
  ship_recipient_name?: string;
  ship_recipient_phone?: string;
  ship_zip?: string;
  ship_addr1?: string;
  ship_addr2?: string;
  ship_addr_verified?: boolean;
  ship_note?: string;
};

/**
 * POST /api/portal/orders
 * 서버에서 등급가/브랜드 화이트리스트/파렛 차단 모두 재검증.
 */
export async function POST(request: NextRequest) {
  const guard = await requireCustomer(request);
  if (guard instanceof NextResponse) return guard;
  if (!supabaseAdmin) return NextResponse.json({ error: 'service_role 키 없음' }, { status: 500 });

  const body = await request.json().catch(() => null) as Body | null;
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: '품목이 비어있습니다.' }, { status: 400 });
  }
  const grade = guard.customer.dropship_price_grade as Grade;
  const shipType = body.ship_type === 'direct' ? 'direct' : 'normal';

  // 직송 주소 검증
  if (shipType === 'direct') {
    if (!body.ship_addr_verified || !body.ship_recipient_name || !body.ship_recipient_phone || !body.ship_zip || !body.ship_addr1 || !body.ship_addr2) {
      return NextResponse.json({ error: '직송 정보가 불완전합니다.' }, { status: 422 });
    }
  }

  // 라인별 검증/재계산
  const lines: {
    line_no: number;
    product_code: string;
    product_name: string;
    brand: string;
    category: string;
    unit_price: number;
    quantity: number;
  }[] = [];
  let totalAmount = 0;
  let totalQty = 0;
  let lineNo = 0;

  for (const it of body.items) {
    const code = (it.code || '').trim();
    const qty = Math.floor(Number(it.quantity) || 0);
    if (!code) return NextResponse.json({ error: '제품 코드 누락' }, { status: 400 });
    if (qty <= 0) return NextResponse.json({ error: `${code}: 수량 오류` }, { status: 400 });

    const p = await findProductByCode(code);
    if (!p) return NextResponse.json({ error: `${code}: 제품 없음` }, { status: 422 });

    const brand = getGenBrand(p);
    if (!(PORTAL_BRANDS as readonly string[]).includes(brand)) {
      return NextResponse.json({ error: `${code}: 주문 가능 브랜드 아님` }, { status: 422 });
    }

    const { price, minQty, isPalletOnly } = priceForGrade(p, grade);
    if (isPalletOnly) {
      return NextResponse.json({ error: `${code}: 파렛 단가는 별도 문의` }, { status: 422 });
    }
    if (price <= 0) {
      return NextResponse.json({ error: `${code}: 등급가 미설정` }, { status: 422 });
    }
    if (qty < minQty) {
      return NextResponse.json({ error: `${code}: 최소 주문 수량 ${minQty}` }, { status: 422 });
    }

    lineNo++;
    const amount = price * qty;
    totalAmount += amount;
    totalQty += qty;
    lines.push({
      line_no: lineNo,
      product_code: p.code,
      product_name: p.model || p.description || p.code,
      brand,
      category: p.category || '',
      unit_price: price,
      quantity: qty,
    });
  }

  // 주문번호
  const orderNo = await nextOrderNo();

  // 헤더 insert
  const { data: order, error: oErr } = await supabaseAdmin
    .from('customer_orders')
    .insert({
      order_no: orderNo,
      customer_id: guard.customer.id,
      customer_code: guard.customer.erp_code || '',
      customer_name: guard.customer.name,
      status: 'waiting',
      ship_type: shipType,
      ship_recipient_name: body.ship_recipient_name || null,
      ship_recipient_phone: body.ship_recipient_phone || null,
      ship_zip: body.ship_zip || null,
      ship_addr1: body.ship_addr1 || null,
      ship_addr2: body.ship_addr2 || null,
      ship_addr_verified: !!body.ship_addr_verified,
      ship_note: body.ship_note || null,
      price_grade: grade,
      total_amount: totalAmount,
      total_qty: totalQty,
      customer_note: body.customer_note || null,
    })
    .select('id, order_no')
    .single();
  if (oErr || !order) return NextResponse.json({ error: '주문 생성 실패: ' + (oErr?.message || '') }, { status: 500 });

  // 라인 bulk insert
  const { error: iErr } = await supabaseAdmin
    .from('customer_order_items')
    .insert(lines.map((l) => ({ ...l, order_id: order.id })));
  if (iErr) {
    await supabaseAdmin.from('customer_orders').delete().eq('id', order.id);
    return NextResponse.json({ error: '품목 저장 실패: ' + iErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: order.id, order_no: order.order_no });
}
