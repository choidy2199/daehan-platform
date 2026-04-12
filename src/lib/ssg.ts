// SSG Open API 공통 함수 (NAS 프록시 경유)
// 기본 URL: ${NAVER_PROXY_URL}/ssg
// 인증: Authorization 헤더에 SSG_API_KEY 값
// 프록시 인증: X-API-Key 헤더에 NAVER_PROXY_API_KEY 값

const SSG_DIRECT_URL = 'https://openapi.ssg.com';

function getBaseUrl(): string {
  const proxyUrl = process.env.NAVER_PROXY_URL;
  return proxyUrl ? `${proxyUrl}/ssg` : SSG_DIRECT_URL;
}

function getProxyHeaders(): Record<string, string> {
  const proxyKey = process.env.NAVER_PROXY_API_KEY;
  return proxyKey ? { 'X-API-Key': proxyKey } : {};
}

function getApiKey(): string {
  return process.env.SSG_API_KEY || '';
}

export interface SsgProduct {
  itemId: string;
  itemNm: string;
  sellStatCd?: string;
  siteNm?: string;
  splVenItemId?: string; // 협력업체 상품코드 (mw_products.code와 매칭)
  [key: string]: any;
}

export interface SsgPriceInfo {
  splprc?: number;   // 공급가
  sellprc?: number;  // 판매가
  mrgrt?: number;    // 마진율
  aplStrtDt?: string; // 적용 시작일
  [key: string]: any;
}

/**
 * SSG API 공통 호출 함수
 */
export async function ssgApi(method: string, path: string, body?: any): Promise<any> {
  const t0 = Date.now();
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('SSG_API_KEY가 설정되지 않았습니다');

  const url = `${getBaseUrl()}${path}`;
  const resp = await fetch(url, {
    method,
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...getProxyHeaders(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t1 = Date.now();

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`SSG API ${method} ${path} 실패: ${resp.status} ${errText}`);
  }

  const contentType = resp.headers.get('content-type') || '';
  const result = contentType.includes('application/json') ? await resp.json() : await resp.text();
  console.log(`[PERF ssgApi] ${method} ${path} — fetch:${t1-t0}ms total:${Date.now()-t0}ms`);
  return result;
}

/**
 * SSG 상품 목록 조회 (전체 페이지 순회)
 * GET /item/0.1/getItemList.ssg?sellStatCd=20&페이지=N&페이지크기=100
 */
export async function getSsgProductList(): Promise<SsgProduct[]> {
  const all: SsgProduct[] = [];
  const pageSize = 100;
  let page = 1;
  while (true) {
    const qs = new URLSearchParams({
      sellStatCd: '20', // 판매중
      '페이지': String(page),
      '페이지크기': String(pageSize),
    });
    const data = await ssgApi('GET', `/item/0.1/getItemList.ssg?${qs.toString()}`);
    // SSG 응답 구조: result.items[].item[] (items는 배열, 각 요소에 item 배열)
    const groups = data?.result?.items;
    const items: SsgProduct[] = Array.isArray(groups)
      ? groups.flatMap((g: any) => g?.item || [])
      : (groups?.item || []);
    if (!items.length) break;
    all.push(...items);
    if (items.length < pageSize) break;
    page++;
    if (page > 200) break; // safety cap (최대 20,000건)
  }
  console.log('[SSG] 전체 상품 캐시 완료:', all.length, '건, 페이지:', page);
  return all;
}

/**
 * SSG 단건 가격 조회
 * GET /item/0.1/online/{itemId}/price
 */
export async function getSsgPrice(itemId: string): Promise<SsgPriceInfo> {
  const data = await ssgApi('GET', `/item/0.1/online/${encodeURIComponent(itemId)}/price`);
  const priceObj = data?.result?.price?.itemPrices || {};
  return priceObj as SsgPriceInfo;
}

/**
 * SSG 가격 수정
 * POST /item/0.1/online/{itemId}/price
 */
export async function updateSsgPrice(
  itemId: string,
  sellprc: number,
  splprc: number,
  mrgrt: number
): Promise<{ success: boolean; message: string }> {
  const body = {
    online_updatePrice: {
      price: {
        itemPrices: {
          splprc,
          sellprc,
          mrgrt,
        },
      },
    },
  };
  try {
    const data = await ssgApi('POST', `/item/0.1/online/${encodeURIComponent(itemId)}/price`, body);
    const resultCode = data?.result?.resultCode ?? data?.resultCode;
    const resultMsg = data?.result?.resultMsg ?? data?.resultMsg ?? '';
    if (String(resultCode) === '00') {
      return { success: true, message: '가격 수정 성공' };
    }
    return { success: false, message: `가격 수정 실패 (code: ${resultCode}) ${resultMsg}` };
  } catch (err: any) {
    console.error('[SSG updateSsgPrice] 실패:', err);
    return { success: false, message: err?.message || '가격 수정 실패' };
  }
}

/**
 * SSG 전체 상품 캐시
 * TODO: getItemList 응답에 splVenItemId가 포함되지 않을 수 있음.
 *       포함되면 splVenItemId → 상품 매핑으로 정확 매칭.
 *       미포함이면 itemNm 기반으로 폴백(부분 매칭, 정확도 낮음).
 */
let _ssgProductCache: Map<string, SsgProduct> | null = null;
let _ssgCacheTime = 0;
const SSG_CACHE_TTL = 10 * 60 * 1000; // 10분

async function _ensureSsgCache(): Promise<Map<string, SsgProduct>> {
  if (_ssgProductCache && (Date.now() - _ssgCacheTime) < SSG_CACHE_TTL) {
    console.log(`[PERF ssgCache] HIT (${_ssgProductCache.size}개, age ${Date.now() - _ssgCacheTime}ms)`);
    return _ssgProductCache;
  }
  console.log('[PERF ssgCache] MISS — 전체 로드');
  const t0 = Date.now();
  const products = await getSsgProductList();
  const map = new Map<string, SsgProduct>();
  let withSplVen = 0;
  for (const p of products) {
    const splVen = String(p.splVenItemId || '').trim();
    if (splVen) {
      map.set(splVen, p);
      withSplVen++;
    }
  }
  // splVenItemId가 하나도 없으면 itemNm 폴백 경고
  if (withSplVen === 0 && products.length > 0) {
    console.warn('[SSG] getItemList 응답에 splVenItemId 미포함 — itemNm 기반 폴백 필요 (TODO)');
  }
  console.log(`[PERF ssgCache] 로드 완료 ${Date.now() - t0}ms — ${products.length}개 상품 (splVenItemId 보유: ${withSplVen}개)`);
  _ssgProductCache = map;
  _ssgCacheTime = Date.now();
  return map;
}

/**
 * mw_products.code로 SSG 상품 조회 (정확 매칭, 캐시 사용)
 */
export async function findSsgProductByCode(code: string): Promise<SsgProduct | null> {
  const trimmed = String(code).trim();
  const map = await _ensureSsgCache();
  const matched = map.get(trimmed);
  if (!matched) {
    console.log(`[findSsgProduct] 매칭 없음 (코드: ${trimmed})`);
    return null;
  }
  console.log(`[findSsgProduct] 매칭: "${matched.itemNm}", itemId: ${matched.itemId}, splVenItemId: ${matched.splVenItemId}`);
  return matched;
}
