// 경박 재고 자동동기화 서버 래퍼
// 기존 수동 재고연동(public/manager/app.js::syncInventory + /api/erp/stock)과 동일한 방식 사용

import { createClient } from '@supabase/supabase-js';
import { parseTablesFromXml } from './erp';

const ERP_URL = process.env.ERP_URL || 'https://drws20.softcity.co.kr:1448/WS_shop.asmx';
const ERP_USER_KEY = process.env.ERP_USER_KEY || '';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface StockSyncResult {
  success: boolean;
  totalRequested: number;
  mwSuccess: number;
  mwFailed: number;
  genSuccess: number;
  genFailed: number;
  errors: string[];              // 최대 10개
  durationMs: number;
  startedAt: string;
  finishedAt: string;
}

// 기존 /api/erp/stock route와 동일한 ERP 호출 로직 (200건 단위)
async function fetchStockBatch(codes: string[]): Promise<Record<string, number>> {
  const cleanCodes = codes.map(c => c.trim()).filter(c => c && c !== '-');
  if (!cleanCodes.length) return {};

  const whereValue = cleanCodes.map(c => `'${c}'`).join(',');
  const formBody = `cUserKey=${encodeURIComponent(ERP_USER_KEY)}&UrlEnc_WHERE=${encodeURIComponent(whereValue)}`;

  console.log(`[stockSync] POST SelectItemUrlEnc: ${cleanCodes.length}건, body길이: ${formBody.length}`);

  const response = await fetch(`${ERP_URL}/SelectItemUrlEnc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody,
  });

  if (!response.ok) {
    throw new Error(`ERP HTTP ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  const rows = parseTablesFromXml(xml);

  const stockMap: Record<string, number> = {};
  for (const row of rows) {
    const code2 = (row.CODE2 || '').trim();
    if (code2) {
      stockMap[code2] = parseInt(row.JEGO || '0', 10);
    }
  }
  return stockMap;
}

async function loadAppData<T>(key: string, defaultValue: T): Promise<T> {
  const { data, error } = await supabaseAdmin
    .from('app_data')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  if (!data) return defaultValue;
  const v = data.value;
  if (typeof v === 'string') {
    try { return JSON.parse(v) as T; } catch { return defaultValue; }
  }
  return (v as T) ?? defaultValue;
}

async function saveAppData(key: string, value: unknown): Promise<void> {
  const { error } = await supabaseAdmin
    .from('app_data')
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  if (error) throw error;
}

/**
 * 전체 재고 자동동기화
 * 1. Supabase에서 mw_products, mw_gen_products 로드
 * 2. 각 배열의 manageCode 수집 (trim, '-' 제외)
 * 3. 200건 배치로 ERP 호출 (배치 간 100ms 대기, 배치 실패 시 다음 계속)
 * 4. CODE2 → JEGO Map 병합
 * 5. 각 제품의 stock, lastFetchedAt 덮어쓰기
 * 6. Supabase 저장
 */
export async function syncAllStock(): Promise<StockSyncResult> {
  const startedAt = new Date();
  const errors: string[] = [];

  if (!ERP_USER_KEY) {
    throw new Error('ERP_USER_KEY 환경변수가 설정되지 않았습니다');
  }

  // 1) Supabase 로드
  const mwProducts = await loadAppData<any[]>('mw_products', []);
  const genProducts = await loadAppData<any[]>('mw_gen_products', []);

  const mwList: any[] = Array.isArray(mwProducts) ? mwProducts : [];
  const genList: any[] = Array.isArray(genProducts) ? genProducts : [];

  // 2) 관리코드 수집
  type Item = { source: 'mw' | 'gen'; manageCode: string; index: number };
  const allItems: Item[] = [];
  mwList.forEach((p: any, i: number) => {
    const mc = (p?.manageCode || '').trim();
    if (mc && mc !== '-') allItems.push({ source: 'mw', manageCode: mc, index: i });
  });
  genList.forEach((p: any, i: number) => {
    const mc = (p?.manageCode || '').trim();
    if (mc && mc !== '-') allItems.push({ source: 'gen', manageCode: mc, index: i });
  });

  console.log(`[stockSync] 수집: 총 ${allItems.length}건 (mw ${mwList.length} / gen ${genList.length})`);

  // 3) 200건 배치 순차 호출 (배치 간 100ms 대기)
  const BATCH = 200;
  const stockMap: Record<string, number> = {};
  const batches: Item[][] = [];
  for (let b = 0; b < allItems.length; b += BATCH) {
    batches.push(allItems.slice(b, b + BATCH));
  }

  for (let i = 0; i < batches.length; i++) {
    try {
      const codes = batches[i].map(it => it.manageCode);
      const batchMap = await fetchStockBatch(codes);
      Object.assign(stockMap, batchMap);
      console.log(`[stockSync] 배치 ${i + 1}/${batches.length} OK — 누적 stockMap ${Object.keys(stockMap).length}건`);
    } catch (err: any) {
      const msg = `배치 ${i + 1} 실패: ${err?.message || String(err)}`;
      console.error('[stockSync]', msg);
      if (errors.length < 10) errors.push(msg);
    }
    if (i < batches.length - 1) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  // 4) 각 제품의 stock, lastFetchedAt 덮어쓰기
  const nowIso = new Date().toISOString();
  let mwSuccess = 0, mwFailed = 0, genSuccess = 0, genFailed = 0;

  for (const p of mwList) {
    const mc = (p?.manageCode || '').trim();
    if (!mc || mc === '-') continue;
    if (Object.prototype.hasOwnProperty.call(stockMap, mc)) {
      p.stock = stockMap[mc];
      p.lastFetchedAt = nowIso;
      mwSuccess++;
    } else {
      mwFailed++;
    }
  }
  for (const p of genList) {
    const mc = (p?.manageCode || '').trim();
    if (!mc || mc === '-') continue;
    if (Object.prototype.hasOwnProperty.call(stockMap, mc)) {
      p.stock = stockMap[mc];
      p.lastFetchedAt = nowIso;
      genSuccess++;
    } else {
      genFailed++;
    }
  }

  // 5) Supabase 저장
  await saveAppData('mw_products', mwList);
  await saveAppData('mw_gen_products', genList);

  const finishedAt = new Date();
  const result: StockSyncResult = {
    success: errors.length === 0,
    totalRequested: allItems.length,
    mwSuccess,
    mwFailed,
    genSuccess,
    genFailed,
    errors,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
  };

  console.log(`[stockSync] 완료 —`, {
    total: result.totalRequested,
    mw: `${mwSuccess}/${mwSuccess + mwFailed}`,
    gen: `${genSuccess}/${genSuccess + genFailed}`,
    errors: errors.length,
    durationMs: result.durationMs,
  });

  return result;
}
