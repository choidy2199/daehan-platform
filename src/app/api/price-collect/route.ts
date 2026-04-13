import { NextRequest, NextResponse } from 'next/server';
import { getAllNaverProductsMap } from '@/lib/naver';
import { getSsgProductList } from '@/lib/ssg';

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
          const results: Record<string, { price: number | null; status: string }> = {};
          for (const p of products) {
            const code = String(p.splVenItemId || '').trim();
            if (!code) continue;
            // sellprc가 목록에 포함되면 사용, 없으면 null (개별 조회 timeout 방지)
            const rawPrice = (p as any).sellprc;
            const price = rawPrice != null ? Number(rawPrice) : null;
            const status = String(p.sellStatCd ?? '');
            results[code] = { price, status };
          }
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
