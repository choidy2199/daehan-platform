import { NextRequest, NextResponse } from 'next/server';
import { getAllNaverProductsMap } from '@/lib/naver';
import { getSsgProductList, getSsgPrice } from '@/lib/ssg';

// GET /api/price-collect?channels=naver,ssg
// 응답: { naver: { total, results: { [code]: { price, status } } }, ssg: {...}, timestamp }
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channelsParam = searchParams.get('channels') || 'naver,ssg';
    const channels = channelsParam.split(',').map(s => s.trim()).filter(Boolean);

    const tasks: Array<{ name: string; promise: Promise<any> }> = [];

    if (channels.includes('naver')) {
      tasks.push({
        name: 'naver',
        promise: (async () => {
          const map = await getAllNaverProductsMap();
          const results: Record<string, { price: number; status: string }> = {};
          for (const [code, p] of map) {
            const cp = p?.channelProducts?.[0];
            if (!cp) continue;
            const price = Number(cp.salePrice) || 0;
            const status = String(cp.statusType || '');
            results[code] = { price, status };
          }
          return { total: map.size, results };
        })(),
      });
    }

    if (channels.includes('ssg')) {
      tasks.push({
        name: 'ssg',
        promise: (async () => {
          const products = await getSsgProductList();
          // 1) splVenItemId → {itemId, status} 매핑
          const ssgMap: Record<string, { itemId: string; status: string }> = {};
          for (const p of products) {
            const code = String(p.splVenItemId || '').trim();
            const itemId = String(p.itemId || '').trim();
            if (!code || !itemId) continue;
            ssgMap[code] = { itemId, status: String(p.sellStatCd ?? '') };
          }
          // 2) 배치 단위 getSsgPrice 병렬 조회
          const BATCH_SIZE = 20;
          const BATCH_DELAY = 200; // ms
          const codes = Object.keys(ssgMap);
          const results: Record<string, { price: number | null; status: string }> = {};
          const tBatch0 = Date.now();
          for (let i = 0; i < codes.length; i += BATCH_SIZE) {
            const batch = codes.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.allSettled(
              batch.map(async (code) => {
                const { itemId, status } = ssgMap[code];
                try {
                  const priceData = await getSsgPrice(itemId);
                  const price = priceData?.sellprc != null ? Number(priceData.sellprc) : null;
                  return { code, price, status };
                } catch {
                  return { code, price: null, status };
                }
              })
            );
            for (const r of batchResults) {
              if (r.status === 'fulfilled') {
                const { code, price, status } = r.value;
                results[code] = { price, status };
              }
            }
            if (i + BATCH_SIZE < codes.length) {
              await new Promise(res => setTimeout(res, BATCH_DELAY));
            }
          }
          console.log(`[SSG price batch] ${codes.length}건 조회 완료 ${Date.now() - tBatch0}ms`);
          return { total: products.length, results };
        })(),
      });
    }

    const settled = await Promise.allSettled(tasks.map(t => t.promise));
    const resp: Record<string, any> = { timestamp: new Date().toISOString() };
    settled.forEach((r, i) => {
      const name = tasks[i].name;
      if (r.status === 'fulfilled') {
        resp[name] = r.value;
      } else {
        resp[name] = { total: 0, results: {}, error: String(r.reason?.message || r.reason) };
      }
    });

    return NextResponse.json(resp);
  } catch (error: any) {
    console.error('[price-collect] 오류:', error);
    return NextResponse.json(
      { error: error?.message || '가격 수집 실패' },
      { status: 500 }
    );
  }
}
