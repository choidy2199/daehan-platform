import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { matchProduct, formatNumber, getModelCode, type Product } from '../../../../lib/botMatcher';

export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── API Handler (기존 인터페이스 유지) ───

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== process.env.BOT_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { message, room, sender } = body;

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    console.log(`[bot/stock] room=${room}, sender=${sender}, message=${message}`);

    // Supabase에서 제품 데이터
    const [mwRes, genRes] = await Promise.all([
      supabase.from('app_data').select('value').eq('key', 'mw_products').single(),
      supabase.from('app_data').select('value').eq('key', 'mw_gen_products').single(),
    ]);

    const mwProducts: Product[] = Array.isArray(mwRes.data?.value) ? mwRes.data.value : [];
    const genProducts: Product[] = Array.isArray(genRes.data?.value) ? genRes.data.value : [];
    const allProducts = [...mwProducts, ...genProducts];

    if (allProducts.length === 0) {
      console.error('[bot/stock] 제품 데이터 없음');
      return NextResponse.json({ success: false, reply: null, matched: 0, product: null });
    }

    // botMatcher로 매칭
    const result = matchProduct(message, allProducts);

    // 0건 매칭
    if (!result.matched) {
      return NextResponse.json({ success: true, reply: null, matched: 0, product: null });
    }

    // 2건 이상 매칭 (기존 호환: products 배열 반환)
    if (result.count >= 2) {
      const lines = result.products.map((p, i) => `${i + 1}. ${p.model}`);
      const reply = `말씀하신 제품이 아래 중 어떤 제품인지 확인부탁드립니다.\n${lines.join('\n')}`;
      const products = result.products.map(p => p.model);
      return NextResponse.json({ success: true, reply, matched: result.count, product: null, products });
    }

    // 1건 매칭
    const p = result.products[0];
    const price = formatNumber(p.price);
    const stockText = p.stock === '있음' ? '재고있습니다.'
      : p.stock === '발주가능' ? '재고는 없지만 발주 가능합니다. 주문시 내일 출고됩니다.'
      : '현재 품절입니다. 입고일정 확인후 말씀드리겠습니다.';

    const reply = `모델 : ${p.model}\n가격 : ${price}원\n${stockText}`;

    return NextResponse.json({
      success: true,
      reply,
      matched: 1,
      product: { code: p.code, name: p.model },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[bot/stock] 에러:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
