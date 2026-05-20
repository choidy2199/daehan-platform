import { NextResponse } from 'next/server';
import { getApiKeys } from '@/lib/api-keys';
import { adGet } from '@/lib/naver-ad';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ReqProduct {
  id: number;
  product_name: string;
  category?: string;
}

interface NccKeyword {
  relKeyword: string;
  monthlyPcQcCnt: number;
  monthlyMobileQcCnt: number;
  monthlyAvePcClkCnt: number;
  monthlyAveMobileClkCnt: number;
  monthlyAvePcCtr: number;
  monthlyAveMobileCtr: number;
  plAvgDepth: number;
  compIdx: '낮음' | '중간' | '높음';
}

interface NccKeywordsResponse {
  keywordList?: NccKeyword[];
}

function toNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function calcRecommendScore(kw: NccKeyword): number {
  let score = 0;

  if (kw.compIdx === '낮음') score += 5;
  else if (kw.compIdx === '중간') score += 2;
  else score -= 3;

  const total = toNumber(kw.monthlyPcQcCnt) + toNumber(kw.monthlyMobileQcCnt);
  if (total >= 100 && total <= 3000) score += 3;
  else if ((total >= 50 && total < 100) || (total > 3000 && total <= 10000)) score += 1;
  else if (total > 10000) score -= 1;

  const avgCtr = (toNumber(kw.monthlyAvePcCtr) + toNumber(kw.monthlyAveMobileCtr)) / 2;
  if (avgCtr >= 2) score += 2;
  else if (avgCtr >= 1) score += 1;

  return score;
}

export async function POST(req: Request) {
  const body = (await req.json()) as { products?: ReqProduct[] };
  const products = body.products ?? [];

  if (products.length === 0) {
    return NextResponse.json(
      { success: false, error: 'products 배열이 비어있습니다' },
      { status: 400 },
    );
  }

  let keys;
  try {
    keys = await getApiKeys();
  } catch {
    return NextResponse.json(
      { success: false, error: 'API 자격증명 조회 실패' },
      { status: 401 },
    );
  }

  const allKeywords = new Map<string, NccKeyword>();

  try {
    for (const p of products) {
      const name = (p.product_name ?? '').trim();
      if (!name) continue;
      const uri = `/keywordstool?hintKeywords=${encodeURIComponent(name)}&showDetail=1`;
      const res = await adGet<NccKeywordsResponse>(uri, keys.naverAd);
      const list = res.keywordList ?? [];
      for (const kw of list) {
        if (!kw.relKeyword) continue;
        if (!allKeywords.has(kw.relKeyword)) {
          allKeywords.set(kw.relKeyword, kw);
        }
      }
    }
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : 'NCC API 호출 실패',
      },
      { status: 500 },
    );
  }

  const totalFetched = allKeywords.size;
  let filteredOut = 0;
  const accepted: Array<{
    keyword: string;
    monthlySearchVolume: number;
    compIdx: '낮음' | '중간' | '높음';
    clickRate: number;
    recommendScore: number;
  }> = [];

  for (const kw of allKeywords.values()) {
    const volume = toNumber(kw.monthlyPcQcCnt) + toNumber(kw.monthlyMobileQcCnt);
    if (volume < 50) {
      filteredOut += 1;
      continue;
    }
    const clickRate =
      (toNumber(kw.monthlyAvePcCtr) + toNumber(kw.monthlyAveMobileCtr)) / 2;
    accepted.push({
      keyword: kw.relKeyword,
      monthlySearchVolume: volume,
      compIdx: kw.compIdx,
      clickRate: Math.round(clickRate * 100) / 100,
      recommendScore: calcRecommendScore(kw),
    });
  }

  accepted.sort((a, b) => b.recommendScore - a.recommendScore);

  return NextResponse.json({
    success: true,
    keywords: accepted,
    totalFetched,
    filteredOut,
  });
}
