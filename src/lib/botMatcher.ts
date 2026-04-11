/**
 * botMatcher.ts — 제품 매칭 공유 모듈
 * /api/bot/stock + /api/bot/message 양쪽에서 사용
 */

// ─── 타입 ───

export interface Product {
  code: string;
  model?: string;
  name?: string;
  description?: string;
  manageCode?: string;
  supplyPrice?: number;
  ttiStock?: string;
  stock?: number;
  [key: string]: unknown;
}

export interface MatchedProduct {
  model: string;
  code: string;
  name: string;
  price: number;
  stock: string;  // "있음" | "없음" | "발주가능"
  label: string;  // "세트(배터리포함)" | "베어툴(본체만)" | "액세서리" | ""
}

export interface MatchResult {
  keyword: string;
  matched: boolean;
  products: MatchedProduct[];
  count: number;
}

// ─── 유틸리티 ───

export function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR');
}

export function labelProduct(modelCode: string): string {
  if (/^\d+-\d+-\d+/.test(modelCode.trim())) return '액세서리';
  const lastHyphen = modelCode.lastIndexOf('-');
  if (lastHyphen > 0 && lastHyphen < modelCode.length - 1) {
    const afterHyphen = modelCode.substring(lastHyphen + 1).trim();
    if (afterHyphen.startsWith('0')) return '베어툴(본체만)';
    if (/^\d/.test(afterHyphen)) return '세트(배터리포함)';
  }
  return '';
}

function startsWithModelPrefix(text: string): boolean {
  return /^[MC]\d/i.test(text.trim());
}

function getSearchText(p: Product): string {
  if (p.description && p.description.length > 3) {
    return `${p.model || ''} ${p.description}`;
  }
  return p.model || p.name || p.code;
}

export function getModelCode(p: Product): string {
  if (p.description && p.description.length > 3) {
    const parts = p.description.split('/').map(s => s.trim());
    return parts[0] || p.description;
  }
  const model = p.model || p.name || p.code;
  const parts = model.split('/').map(s => s.trim());
  if (parts.length >= 1 && startsWithModelPrefix(parts[0])) return parts[0];
  if (parts.length >= 2) {
    const mPart = parts.find(pt => startsWithModelPrefix(pt));
    if (mPart) return `${parts[0]} (${mPart})`;
  }
  return parts[0];
}

function getStockStatus(p: Product): string {
  if (p.ttiStock !== undefined) {
    if (p.ttiStock === '●') return '있음';
    if (p.ttiStock === '▲') return '발주가능';
    return '없음';
  }
  if (p.stock !== undefined) {
    return Number(p.stock) > 0 ? '있음' : '없음';
  }
  return '없음';
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

function tokenize(keyword: string): { enTokens: string[]; koTokens: string[] } {
  const enMatches = keyword.match(/[A-Za-z0-9][\w-]*/g) || [];
  const enTokens = enMatches.map(t => t.toUpperCase());
  const koMatches = keyword.match(/[가-힣]{2,}/g) || [];
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

/** 단일 키워드로 제품 매칭 (최대 5건) */
export function matchProduct(keyword: string, allProducts: Product[]): MatchResult {
  const { enTokens, koTokens } = tokenize(keyword);

  if (enTokens.length === 0 && koTokens.length === 0) {
    return { keyword, matched: false, products: [], count: 0 };
  }

  let results: Product[] = [];

  // 영문토큰 AND 매칭
  if (enTokens.length >= 1) {
    results = allProducts.filter(p => {
      const text = getSearchText(p).toUpperCase();
      return enTokens.every(t => text.includes(t));
    });
    // 6건 이상이고 한국어토큰 있으면 추가 필터
    if (results.length >= 6 && koTokens.length > 0) {
      const filtered = results.filter(p => {
        const text = getSearchText(p);
        return koTokens.every(t => text.includes(t));
      });
      if (filtered.length > 0) results = filtered;
    }
  }

  // 영문 매칭 실패 + 한국어만
  if (results.length === 0 && koTokens.length > 0) {
    results = allProducts.filter(p => {
      const text = getSearchText(p);
      return koTokens.every(t => text.includes(t));
    });
    if (results.length === 0) {
      const longest = [...koTokens].sort((a, b) => b.length - a.length)[0];
      results = allProducts.filter(p => getSearchText(p).includes(longest));
    }
  }

  if (results.length === 0) {
    return { keyword, matched: false, products: [], count: 0 };
  }

  const sorted = sortByRelevance(results).slice(0, 5);
  const mapped: MatchedProduct[] = sorted.map(p => ({
    model: getModelCode(p),
    code: p.code,
    name: getSearchText(p),
    price: Number(p.supplyPrice) || 0,
    stock: getStockStatus(p),
    label: labelProduct(getModelCode(p)),
  }));

  return { keyword, matched: true, products: mapped, count: mapped.length };
}

// ─── 응답 포맷 ───

export function formatProductResponse(results: MatchResult[]): string {
  const validResults = results.filter(r => r.matched || !r.matched); // 모든 결과 포함
  if (validResults.length === 0) return '';

  const isSingle = validResults.length === 1;
  const lines: string[] = [];

  for (const r of validResults) {
    // 복수 제품일 때 키워드 헤더
    if (!isSingle) lines.push(`[${r.keyword}]`);

    if (!r.matched) {
      if (isSingle) {
        lines.push(`"${r.keyword}" 제품은 정확한 모델명 확인부탁드립니다.`);
      } else {
        lines.push(`해당 제품은 정확한 모델명 확인부탁드립니다.`);
      }
      continue;
    }

    if (r.count === 1) {
      const p = r.products[0];
      const stockText = p.stock === '있음' ? '재고있습니다.'
        : p.stock === '발주가능' ? '재고는 없지만 발주 가능합니다. 주문시 내일 출고됩니다.'
        : '품절입니다. 입고일정 확인후 말씀드리겠습니다.';
      lines.push(`모델 : ${p.model}`);
      lines.push(`가격 : ${formatNumber(p.price)}원`);
      lines.push(stockText);
    } else {
      // 후보 여러개
      if (isSingle) {
        lines.push('말씀하신 제품이 아래 중 어떤 제품인지 확인부탁드립니다.');
        lines.push('');
      }
      r.products.forEach((p, i) => {
        const stockMark = p.stock === '있음' ? '재고있습니다' : p.stock === '발주가능' ? '발주가능' : '품절';
        lines.push(`${i + 1}. ${p.model} ${formatNumber(p.price)}원 ${stockMark}`);
      });
    }

    if (!isSingle) lines.push(''); // 제품 간 공백
  }

  // 마지막 빈 줄 제거
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

  return lines.join('\n');
}
