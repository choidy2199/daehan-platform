import crypto from 'node:crypto';
import type { ApiKeys } from './api-keys';
import { getApiKeys } from './api-keys';

export const NAVER_AD_BASE_URL = 'https://api.naver.com';

export function generateSignature(
  timestamp: string,
  method: string,
  uri: string,
  secretKey: string,
): string {
  const message = `${timestamp}.${method}.${uri}`;
  return crypto.createHmac('sha256', secretKey).update(message).digest('base64');
}

export function buildAdHeaders(
  method: string,
  uri: string,
  keys: ApiKeys['naverAd'],
): Record<string, string> {
  const timestamp = Date.now().toString();
  const signature = generateSignature(timestamp, method, uri, keys.secretKey);
  return {
    'X-Timestamp': timestamp,
    'X-API-KEY': keys.apiKey,
    'X-Customer': keys.customerId,
    'X-Signature': signature,
    'Content-Type': 'application/json; charset=UTF-8',
  };
}

export async function adGet<T = unknown>(
  uri: string,
  keys: ApiKeys['naverAd'],
): Promise<T> {
  const signUri = uri.includes('?') ? uri.slice(0, uri.indexOf('?')) : uri;
  const headers = buildAdHeaders('GET', signUri, keys);
  const response = await fetch(NAVER_AD_BASE_URL + uri, { method: 'GET', headers });
  if (!response.ok) {
    throw new Error(`Naver Ad API ${response.status}: ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

export async function adPost<T = unknown>(
  uri: string,
  body: object,
  keys: ApiKeys['naverAd'],
): Promise<T> {
  const signUri = uri.includes('?') ? uri.slice(0, uri.indexOf('?')) : uri;
  const headers = buildAdHeaders('POST', signUri, keys);
  const response = await fetch(NAVER_AD_BASE_URL + uri, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Naver Ad API ${response.status}: ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

// NCC /stats 실시간 통계 (5-D-1) — 응답 shape 미확정이라 unknown 반환
export async function getStats(params: {
  ids: string[];           // ncc_product_id 배열
  fields: string[];        // ['impCnt', 'clkCnt', 'salesAmt', 'ccnt', 'convAmt', 'ror']
  timeRange: { since: string; until: string };  // 'YYYY-MM-DD'
  timeIncrement?: '1' | 'allDays';              // 기본값 'allDays'
}): Promise<unknown> {
  const { ids, fields, timeRange, timeIncrement = 'allDays' } = params;
  const keys = await getApiKeys();
  const query =
    'ids=' + ids.map((id) => encodeURIComponent(id)).join(',') +
    '&fields=' + encodeURIComponent(JSON.stringify(fields)) +
    '&timeRange=' + encodeURIComponent(JSON.stringify(timeRange)) +
    '&timeIncrement=' + encodeURIComponent(timeIncrement);
  return adGet<unknown>('/stats?' + query, keys.naverAd);
}
