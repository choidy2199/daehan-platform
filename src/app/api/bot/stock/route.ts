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
  model?: string;
  name?: string;
  description?: string;
  supplyPrice?: number;
  [key: string]: unknown;
}

function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR');
}

// ─── 모델코드 추출 ───

/** model이 밀워키 모델코드(M/C + 숫자)로 시작하는지 */
function startsWithModelPrefix(text: string): boolean {
  return /^[MC]\d/i.test(text.trim());
}

/** 제품의 검색 대상 텍스트 (밀워키: model, 일반: description || model) */
function getSearchText(p: Product): string {
  // 일반제품은 model이 브랜드명(HPT 등)이고 description에 실제 제품명이 있음
  if (p.description && p.description.length > 3) {
    return `${p.model || ''} ${p.description}`;
  }
  return p.model || p.name || p.code;
}

/**
 * model 필드에서 모델코드 추출 (표시용)
 * - "M18 FPD3-502X / 18V / ..." → "M18 FPD3-502X"
 * - "49-16-2953 / M18 FID3 보호 커버" → "49-16-2953 (M18 FID3 보호 커버)"
 * - 일반제품: description의 첫 공백 기준 모델코드 or 전체
 */
function getModelCode(p: Product): string {
  // 일반제품 (description 있음)
  if (p.description && p.description.length > 3) {
    const parts = p.description.split('/').map(s => s.trim());
    return parts[0] || p.description;
  }

  const model = p.model || p.name || p.code;
  const parts = model.split('/').map(s => s.trim());

  if (parts.length >= 1 && startsWithModelPrefix(parts[0])) {
    return parts[0];
  }
  if (parts.length >= 2) {
    const mPart = parts.find(pt => startsWithModelPrefix(pt));
    if (mPart) return `${parts[0]} (${mPart})`;
  }
  return parts[0];
}

// ─── 토큰화 + Stopwords ───

const STOPWORDS = [
  '가격', '얼마', '재고', '있나요', '있어요', '없나요', '부탁', '드립니다',
  '확인', '문의', '주세요', '합니다', '금액', '단가', '원', '알려', '보내',
  '요', '좀', '개',
];

function isStopword(token: string): boolean {
  return STOPWORDS.some(sw => token.includes(sw) || sw.includes(token));
}

function tokenize(message: string): { enTokens: string[]; koTokens: string[] } {
  const enMatches = message.match(/[A-Za-z0-9][\w-]*/g) || [];
  const enTokens = enMatches.map(t => t.toUpperCase());

  const koMatches = message.match(/[가-힣]{2,}/g) || [];
  const koTokens = koMatches.filter(t => !isStopword(t));

  return { enTokens, koTokens };
}

// ─── 매칭 ───

function sortByRelevance(products: Product[]): Product[] {
  return [...products].sort((a, b) => {
    const aIs = startsWithModelPrefix(a.model || '');
    const bIs = startsWithModelPrefix(b.model || '');
    if (aIs && !bIs) return -1;
    if (!aIs && bIs) return 1;
    return 0;
  });
}

function matchProducts(message: string, products: Product[]): Product[] {
  const { enTokens, koTokens } = tokenize(message);

  // 토큰 없으면 매칭 불가
  if (enTokens.length === 0 && koTokens.length === 0) return [];

  // === 3-1: 영문토큰 AND 매칭 ===
  if (enTokens.length >= 1) {
    let results = products.filter(p => {
      const text = getSearchText(p).toUpperCase();
      return enTokens.every(t => text.includes(t));
    });

    // === 3-2: 결과가 6건 이상이고 한국어토큰 있으면 추가 필터 ===
    if (results.length >= 6 && koTokens.length > 0) {
      const filtered = results.filter(p => {
        const text = getSearchText(p);
        return koTokens.every(t => text.includes(t));
      });
      if (filtered.length > 0) results = filtered;
    }

    if (results.length > 0) return sortByRelevance(results).slice(0, 5);
  }

  // === 3-3: 한국어만 매칭 (영문토큰 0개) ===
  if (koTokens.length > 0) {
    // AND 매칭
    const koAnd = products.filter(p => {
      const text = getSearchText(p);
      return koTokens.every(t => text.includes(t));
    });
    if (koAnd.length > 0) return sortByRelevance(koAnd).slice(0, 5);

    // 가장 긴 한국어토큰 1개로 검색
    const longest = [...koTokens].sort((a, b) => b.length - a.length)[0];
    const koSingle = products.filter(p => getSearchText(p).includes(longest));
    if (koSingle.length > 0) return sortByRelevance(koSingle).slice(0, 5);
  }

  return [];
}

// ─── API Handler ───

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

    // Supabase에서 mw_products + mw_gen_products 가져오기
    const [mwRes, genRes] = await Promise.all([
      supabase.from('app_data').select('value').eq('key', 'mw_products').single(),
      supabase.from('app_data').select('value').eq('key', 'mw_gen_products').single(),
    ]);

    const mwProducts: Product[] = Array.isArray(mwRes.data?.value) ? mwRes.data.value : [];
    const genProducts: Product[] = Array.isArray(genRes.data?.value) ? genRes.data.value : [];
    const products = [...mwProducts, ...genProducts];

    if (products.length === 0) {
      console.error('[bot/stock] 제품 데이터 없음');
      return NextResponse.json({ success: false, reply: null, matched: 0, product: null });
    }

    // 제품 매칭
    const matched = matchProducts(message, products);

    // 0건 매칭
    if (matched.length === 0) {
      return NextResponse.json({ success: true, reply: null, matched: 0, product: null });
    }

    // 2건 이상 매칭
    if (matched.length >= 2) {
      const lines = matched.map((p, i) => `${i + 1}. ${getModelCode(p)}`);
      const reply = `말씀하신 제품이 아래 중 어떤 제품인지 확인부탁드립니다.\n${lines.join('\n')}`;
      const products = matched.map(p => getModelCode(p));
      return NextResponse.json({ success: true, reply, matched: matched.length, product: null, products });
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
