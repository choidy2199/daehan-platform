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
  name?: string;
  model?: string;
  supplyPrice?: number;
  [key: string]: unknown;
}

function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR');
}

/** model이 밀워키 모델코드(M숫자)로 시작하는지 확인 */
function startsWithModelPrefix(text: string): boolean {
  return /^[MC]\d/i.test(text.trim());
}

/**
 * model 필드에서 모델코드 추출
 * - "M18 FPD3-502X / 18V / ..." → "M18 FPD3-502X"
 * - "49-16-2953 / M18 FID3 보호 커버" → "M18 FID3 보호 커버" (부품번호가 아닌 뒷부분)
 */
function getModelCode(p: Product): string {
  const model = p.model || p.name || p.code;
  const parts = model.split('/').map(s => s.trim());

  // 첫 파트가 밀워키 모델코드면 그대로 사용
  if (parts.length >= 1 && startsWithModelPrefix(parts[0])) {
    return parts[0];
  }

  // 첫 파트가 부품번호(숫자-숫자)면, 뒤에서 밀워키 모델 찾기
  if (parts.length >= 2) {
    const mPart = parts.find(pt => startsWithModelPrefix(pt));
    if (mPart) return `${parts[0]} (${mPart})`;
  }

  return parts[0];
}

const STOPWORDS = [
  '가격', '얼마', '재고', '있나요', '있어요', '없나요', '부탁', '드립니다',
  '확인', '문의', '주세요', '합니다', '요', '좀', '개', '알려', '보내',
];

/** 한국어 토큰이 stopword를 포함하거나 stopword에 포함되면 제거 */
function isStopword(token: string): boolean {
  return STOPWORDS.some(sw => token.includes(sw) || sw.includes(token));
}

/**
 * 메시지에서 토큰 추출 (stopwords 제거)
 */
function tokenize(message: string): { enTokens: string[]; koTokens: string[] } {
  // 영문+숫자+하이픈 토큰
  const enMatches = message.match(/[A-Za-z0-9][A-Za-z0-9\-]*/g) || [];
  const enTokens = enMatches.map(t => t.toUpperCase());

  // 한국어 토큰 (2글자 이상, stopwords 제외)
  const koMatches = message.match(/[가-힣]+/g) || [];
  const koTokens = koMatches.filter(t => t.length >= 2 && !isStopword(t));

  return { enTokens, koTokens };
}

/** 본체(모델코드 시작) 우선, 액세서리(부품번호 시작) 후순위 정렬 */
function sortByRelevance(products: Product[]): Product[] {
  return [...products].sort((a, b) => {
    const aIsModel = startsWithModelPrefix(a.model || '');
    const bIsModel = startsWithModelPrefix(b.model || '');
    if (aIsModel && !bIsModel) return -1;
    if (!aIsModel && bIsModel) return 1;
    return 0;
  });
}

/**
 * 제품 매칭 — model 필드 대상으로만 매칭
 */
function matchProducts(message: string, products: Product[]): Product[] {
  const { enTokens, koTokens } = tokenize(message);
  const allTokens = [...enTokens, ...koTokens];

  if (allTokens.length === 0) return [];

  // === 1단계: AND 매칭 (모든 유효 토큰이 model에 포함) ===
  const andMatch = products.filter(p => {
    const model = (p.model || '').toUpperCase();
    return allTokens.every(t => model.includes(t.toUpperCase()));
  });
  if (andMatch.length > 0) return sortByRelevance(andMatch).slice(0, 5);

  // === 2단계: 가장 긴 토큰 1개로 부분 매칭 (3글자 이상) ===
  const longTokens = allTokens.filter(t => t.length >= 3).sort((a, b) => b.length - a.length);
  if (longTokens.length > 0) {
    const best = longTokens[0].toUpperCase();
    const partial = products.filter(p => {
      const model = (p.model || '').toUpperCase();
      return model.includes(best);
    });
    if (partial.length > 0) return sortByRelevance(partial).slice(0, 5);
  }

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

    // 2건 이상 매칭
    if (matched.length >= 2) {
      const lines = matched.map((p, i) => `${i + 1}. ${getModelCode(p)}`);
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
    const modelCode = getModelCode(product);
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
      reply = `모델 : ${modelCode}\n가격 : ${price}원\n재고있습니다.`;
    } else {
      reply = `모델 : ${modelCode}\n가격 : ${price}원\n현재 품절입니다. 입고일정 확인후 말씀드리겠습니다.`;
    }

    return NextResponse.json({
      success: true,
      reply,
      matched: 1,
      product: { code: product.code, name: getModelCode(product) },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[bot/stock] 에러:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
