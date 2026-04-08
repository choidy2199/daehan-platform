// 네이버 커머스 API 공통 함수
import crypto from 'crypto';

const BASE_URL = 'https://api.commerce.naver.com/external';

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
 * HMAC-SHA256 서명 생성 (네이버 커머스 API 인증용)
 */
function generateSignature(timestamp: string): string {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error('NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 설정되지 않았습니다');
  }
  const message = `${clientId}_${timestamp}`;
  return crypto
    .createHmac('sha256', clientSecret)
    .update(message)
    .digest('base64');
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

  const resp = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

  const resp = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
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
