import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { selectItem } from '@/lib/erp';

export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Product {
  code: string;
  name: string;
  supplyPrice?: number;
  [key: string]: unknown;
}

function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR');
}

/**
 * 메시지에서 제품 매칭
 * 우선순위: code 정확 포함 → 단어가 code에 포함 → 단어가 name에 포함
 */
function matchProducts(message: string, products: Product[]): Product[] {
  const msgLower = message.toLowerCase();
  const words = message.split(/\s+/).filter(w => w.length > 0);

  // 1) code가 메시지에 정확히 포함 (대소문자 무시)
  const exactCode = products.filter(p =>
    p.code && msgLower.includes(p.code.toLowerCase())
  );
  if (exactCode.length > 0) return exactCode.slice(0, 3);

  // 2) 메시지 단어가 code에 포함
  const codeMatch = products.filter(p =>
    p.code && words.some(w => p.code.toLowerCase().includes(w.toLowerCase()))
  );
  if (codeMatch.length > 0) return codeMatch.slice(0, 3);

  // 3) 메시지 단어가 name에 포함
  const nameMatch = products.filter(p =>
    p.name && words.some(w => p.name.includes(w))
  );
  if (nameMatch.length > 0) return nameMatch.slice(0, 3);

  return [];
}

export async function POST(request: NextRequest) {
  try {
    // 인증 체크
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

    // Supabase에서 mw_products 가져오기
    const { data, error } = await supabase
      .from('app_data')
      .select('value')
      .eq('key', 'mw_products')
      .single();

    if (error || !data) {
      console.error('[bot/stock] mw_products 조회 실패:', error);
      return NextResponse.json({
        success: false,
        reply: null,
        matched: 0,
        product: null,
      });
    }

    const products: Product[] = Array.isArray(data.value) ? data.value : [];

    // 제품 매칭
    const matched = matchProducts(message, products);

    // 0건 매칭
    if (matched.length === 0) {
      return NextResponse.json({
        success: true,
        reply: null,
        matched: 0,
        product: null,
      });
    }

    // 2~3건 매칭
    if (matched.length >= 2) {
      const lines = matched.map((p, i) => `${i + 1}. ${p.code} - ${p.name}`);
      const reply = `말씀하신 제품이 아래 중 어떤 제품인지 확인부탁드립니다.\n${lines.join('\n')}`;
      return NextResponse.json({
        success: true,
        reply,
        matched: matched.length,
        product: null,
      });
    }

    // 1건 매칭 → ERP 재고 조회
    const product = matched[0];
    const price = product.supplyPrice ? formatNumber(Number(product.supplyPrice)) : '0';

    let hasStock = false;
    try {
      const erpResults = await selectItem(product.code);
      if (erpResults.length > 0) {
        const jego = parseInt(erpResults[0].JEGO || '0', 10);
        hasStock = jego > 0;
      }
    } catch (erpErr) {
      console.error('[bot/stock] ERP 재고조회 실패:', erpErr);
      // ERP 실패 시 재고 없음으로 처리
    }

    let reply: string;
    if (hasStock) {
      reply = `${product.code}\n가격은 ${price}원입니다.\n재고 있습니다.`;
    } else {
      reply = `${product.code}\n가격은 ${price}원입니다.\n현재 품절입니다. 입고일정 확인후 말씀드리겠습니다.`;
    }

    return NextResponse.json({
      success: true,
      reply,
      matched: 1,
      product: { code: product.code, name: product.name },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[bot/stock] 에러:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
