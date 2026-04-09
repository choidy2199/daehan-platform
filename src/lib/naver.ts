// 네이버 커머스 API 공통 함수
import bcrypt from 'bcryptjs';

const NAVER_DIRECT_URL = 'https://api.commerce.naver.com/external';

function getBaseUrl(): string {
  const proxyUrl = process.env.NAVER_PROXY_URL;
  return proxyUrl ? `${proxyUrl}/naver` : NAVER_DIRECT_URL;
}

function getProxyHeaders(): Record<string, string> {
  const proxyKey = process.env.NAVER_PROXY_API_KEY;
  return proxyKey ? { 'X-API-Key': proxyKey } : {};
}

// 환경변수를 런타임에 읽음 (Vercel의 $ 문자 이스케이프 문제 방지)
function getClientId(): string {
  return process.env.NAVER_CLIENT_ID || '';
}
function getClientSecret(): string {
  const b64 = process.env.NAVER_CLIENT_SECRET_B64;
  if (b64) return Buffer.from(b64, 'base64').toString('utf-8');
  return process.env.NAVER_CLIENT_SECRET || '';
}

// Rate limit: 초당 2회 제한 대응
let lastCallTime = 0;
const MIN_INTERVAL = 550; // ms (초당 2회 → 500ms + 여유 50ms)

async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < MIN_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_INTERVAL - elapsed));
  }
  lastCallTime = Date.now();
}

/**
 * bcrypt 전자서명 생성 (네이버 커머스 API 인증용)
 * password = clientId_timestamp → bcrypt.hashSync(password, clientSecret) → base64
 */
function generateSignature(timestamp: string): string {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error('NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 설정되지 않았습니다');
  }
  const password = `${clientId}_${timestamp}`;
  const hashed = bcrypt.hashSync(password, clientSecret);
  return Buffer.from(hashed).toString('base64');
}

/**
 * OAuth 토큰 발급
 */
export async function getAccessToken(): Promise<string> {
  const timestamp = String(Date.now());
  const signature = generateSignature(timestamp);

  const params = new URLSearchParams({
    client_id: getClientId(),
    timestamp,
    client_secret_sign: signature,
    grant_type: 'client_credentials',
    type: 'SELF',
  });

  const resp = await fetch(`${getBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...getProxyHeaders() },
    body: params.toString(),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`네이버 토큰 발급 실패: ${resp.status} ${err}`);
  }

  const data = await resp.json();
  return data.access_token;
}

/**
 * 네이버 커머스 API 공통 호출 함수 (Rate limit 자동 적용)
 */
export async function naverApi(
  method: string,
  path: string,
  body?: any
): Promise<any> {
  await rateLimit();

  const token = await getAccessToken();

  const resp = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...getProxyHeaders(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`네이버 API ${method} ${path} 실패: ${resp.status} ${errText}`);
  }

  const contentType = resp.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return resp.json();
  }
  return resp.text();
}

/**
 * 네이버 상품 목록 조회
 */
export async function getNaverProducts(page = 1, size = 100) {
  return naverApi('POST', '/v1/products/search', {
    page,
    size,
    statusTypes: ['SALE', 'SUSPENSION', 'OUTOFSTOCK'],
  });
}

/**
 * 판매자관리코드로 네이버 상품 조회 (sellerManagementCode 직접 필터)
 */
export async function findNaverProductByCode(sellerCode: string) {
  const trimmed = String(sellerCode).trim();
  const result = await naverApi('POST', '/v1/products/search', {
    sellerManagementCode: trimmed,
    page: 1,
    size: 50,
  });

  const contents = result?.contents || [];
  console.log(`[findNaverProduct] 코드: "${trimmed}", 결과: ${contents.length}건`);

  if (contents.length === 0) return null;

  // sellerManagementCode 정확 매칭 확인
  const exact = contents.find((p: any) => {
    const code = String(p.channelProducts?.[0]?.sellerManagementCode || '').trim();
    return code === trimmed;
  });

  const matched = exact || contents[0];
  const cp = matched.channelProducts?.[0];
  console.log(`[findNaverProduct] 매칭: "${cp?.name}", originNo: ${matched.originProductNo}, sellerCode: ${cp?.sellerManagementCode}`);

  return {
    originProductNo: matched.originProductNo,
    channelProductNo: cp?.channelProductNo,
    salePrice: cp?.salePrice,
    name: cp?.name,
    sellerManagementCode: cp?.sellerManagementCode,
  };
}

/**
 * 네이버 단건 가격 수정
 */
export async function updateNaverPrice(originProductNo: string, newPrice: number) {
  // 1단계: 상품 검색으로 channelProductNo 확인
  const searchResult = await naverApi('POST', '/v1/products/search', {
    page: 1,
    size: 1,
    originProductNos: [Number(originProductNo)],
  });

  const product = searchResult?.contents?.[0];
  const channelProductNo = product?.channelProducts?.[0]?.channelProductNo;

  if (!channelProductNo) {
    throw new Error(`channelProductNo를 찾을 수 없습니다. originProductNo: ${originProductNo}`);
  }

  // 2단계: 채널상품 전체 정보 조회 (v2)
  const fullProduct = await naverApi('GET', `/v2/products/channel-products/${channelProductNo}`);

  if (!fullProduct?.originProduct) {
    throw new Error(`상품 상세 조회 실패. channelProductNo: ${channelProductNo}`);
  }

  // 3단계: 가격만 변경 (나머지 필드 유지)
  console.log('[DEBUG updateNaverPrice] 변경 전 originProduct.salePrice:', fullProduct.originProduct.salePrice);
  console.log('[DEBUG updateNaverPrice] 변경할 newPrice:', newPrice, '타입:', typeof newPrice);
  fullProduct.originProduct.salePrice = newPrice;

  // channelProducts 배열에서도 salePrice 변경
  if (fullProduct.originProduct.channelProducts) {
    fullProduct.originProduct.channelProducts.forEach((cp: any) => {
      console.log('[DEBUG updateNaverPrice] channelProduct 변경 전 salePrice:', cp.salePrice);
      cp.salePrice = newPrice;
      // discountedPrice, mobileDiscountedPrice도 동일하게 변경 (할인 없는 경우)
      if (cp.discountedPrice) cp.discountedPrice = newPrice;
      if (cp.mobileDiscountedPrice) cp.mobileDiscountedPrice = newPrice;
    });
  }

  // detailContent는 null로 보내면 기존값 유지됨
  if (fullProduct.originProduct.detailContent) {
    fullProduct.originProduct.detailContent = null;
  }
  // detailContent 내부의 대형 필드도 null 처리
  if (fullProduct.originProduct.detailAttribute?.purchaseQuantityInfo?.minPurchaseQuantity === 0) {
    // 유지
  }

  // 4단계: 전체 데이터를 PUT으로 전송
  console.log('[DEBUG updateNaverPrice] PUT 전송 channelProductNo:', channelProductNo);
  console.log('[DEBUG updateNaverPrice] 전송 salePrice:', fullProduct.originProduct.salePrice);
  const result = await naverApi('PUT', `/v2/products/channel-products/${channelProductNo}`, fullProduct);
  console.log('[DEBUG updateNaverPrice] PUT 응답 status/keys:', result ? Object.keys(result) : 'null');

  // 검증: 수정 후 재조회하여 실제 반영 확인
  const verify = await naverApi('GET', `/v2/products/channel-products/${channelProductNo}`);
  const verifyPrice = verify?.originProduct?.salePrice;
  const verifyChPrice = verify?.originProduct?.channelProducts?.[0]?.salePrice;
  console.log('[DEBUG updateNaverPrice] 검증 — originProduct.salePrice:', verifyPrice, 'channelProduct.salePrice:', verifyChPrice, '기대값:', newPrice, '일치:', verifyPrice === newPrice);

  return {
    success: true,
    channelProductNo,
    originProductNo,
    newPrice,
    result,
  };
}
