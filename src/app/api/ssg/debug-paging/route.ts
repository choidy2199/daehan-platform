import { NextResponse } from 'next/server';
import { ssgApi } from '@/lib/ssg';

// 임시 디버그: 여러 페이지 파라미터 조합으로 page1 vs page2 첫 itemId 비교
// 목표: 페이지네이션이 실제로 동작하는 파라미터 키를 식별
export async function GET() {
  const combos: Array<{ name: string; p: string; s: string }> = [
    { name: 'A', p: 'pageNo', s: 'pageSize' },
    { name: 'B', p: 'page', s: 'pageSize' },
    { name: 'C', p: 'page', s: 'size' },
    { name: 'D-KO', p: '페이지', s: '페이지크기' }, // 현재 (대조군)
  ];

  async function fetchFirst(pKey: string, sKey: string, pageNum: number) {
    const qs = new URLSearchParams({
      sellStatCd: '20',
      [pKey]: String(pageNum),
      [sKey]: '10', // 작은 페이지로 빠르게 테스트
    });
    try {
      const data = await ssgApi('GET', `/item/0.1/getItemList.ssg?${qs.toString()}`);
      const groups = data?.result?.items;
      const items: any[] = Array.isArray(groups)
        ? groups.flatMap((g: any) => g?.item || [])
        : (groups?.item || []);
      return {
        count: items.length,
        firstItemId: items[0]?.itemId ?? null,
        firstSplVen: items[0]?.splVenItemId ?? null,
      };
    } catch (e: any) {
      return { error: e?.message || String(e) };
    }
  }

  const results: any[] = [];
  for (const c of combos) {
    const p1 = await fetchFirst(c.p, c.s, 1);
    const p2 = await fetchFirst(c.p, c.s, 2);
    const works =
      p1 && p2 &&
      !('error' in p1) && !('error' in p2) &&
      p1.firstItemId != null &&
      p2.firstItemId != null &&
      p1.firstItemId !== p2.firstItemId;
    results.push({ combo: c.name, keys: `${c.p}/${c.s}`, page1: p1, page2: p2, paginationWorks: works });
  }

  return NextResponse.json({ success: true, results });
}
