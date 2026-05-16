import crypto from 'node:crypto';
import type { ApiKeys } from './api-keys';

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

// === Step 3-D 추가 ===

export interface NaverAdgroup {
  nccAdgroupId: string;
  nccCampaignId: string;
  name: string;
  status?: string;
}

export interface NaverKeyword {
  nccKeywordId: string;
  nccAdgroupId: string;
  keyword: string;
  bidAmt?: number;
  useGroupBidAmt?: boolean;
  status?: string;
  qualityIndex?: number;
  regTm?: string;
  editTm?: string;
}

export async function fetchAdgroupsByCampaign(
  nccCampaignId: string,
  keys: ApiKeys['naverAd'],
): Promise<NaverAdgroup[]> {
  const result = await adGet<NaverAdgroup[]>(
    `/ncc/adgroups?nccCampaignId=${nccCampaignId}`,
    keys,
  );
  return result || [];
}

export async function fetchKeywordsByAdgroup(
  nccAdgroupId: string,
  keys: ApiKeys['naverAd'],
): Promise<NaverKeyword[]> {
  try {
    const result = await adGet<NaverKeyword[]>(
      `/ncc/adkeywords?nccAdgroupId=${nccAdgroupId}`,
      keys,
    );
    return result || [];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('404')) {
      const result = await adGet<NaverKeyword[]>(
        `/ncc/keywords?nccAdgroupId=${nccAdgroupId}`,
        keys,
      );
      return result || [];
    }
    throw err;
  }
}
