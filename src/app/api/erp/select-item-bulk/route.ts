import { NextRequest, NextResponse } from 'next/server';
import { selectItem } from '@/lib/erp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CHUNK_SIZE = 100;

/**
 * POST /api/erp/select-item-bulk
 * Body: { code2List: string[] }
 *
 * 100건씩 청크 분할 → selectItem("'c1','c2',...") 순차 호출
 * 응답의 CODE2로 매칭하여 입력 순서대로 결과 반환
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const code2List = body?.code2List;

    if (!Array.isArray(code2List) || code2List.length === 0) {
      return NextResponse.json({ error: 'code2List가 비어있습니다' }, { status: 400 });
    }
    if (code2List.length > 5000) {
      return NextResponse.json({ error: '최대 5000건까지 가능합니다' }, { status: 400 });
    }

    // 정규화 + 빈 값 제거 + 중복 제거 (입력 순서 유지)
    const codes: string[] = [];
    const seen = new Set<string>();
    for (const c of code2List) {
      const s = String(c ?? '').trim();
      if (!s || seen.has(s)) continue;
      seen.add(s);
      codes.push(s);
    }
    if (codes.length === 0) {
      return NextResponse.json({ error: '유효한 코드가 없습니다' }, { status: 400 });
    }

    // 100건씩 청크 분할
    const chunks: string[][] = [];
    for (let i = 0; i < codes.length; i += CHUNK_SIZE) {
      chunks.push(codes.slice(i, i + CHUNK_SIZE));
    }

    const parsedMap = new Map<string, Record<string, string>>();

    // 청크 순차 처리 (병렬 X — ERP 부하 방지)
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      // 'c1','c2','c3' 형식 (홑따옴표 이스케이프)
      const search = chunk.map((c) => `'${c.replace(/'/g, "''")}'`).join(',');
      try {
        console.log(`[select-item-bulk] chunk ${i + 1}/${chunks.length} (${chunk.length}건)`);
        const rows = await selectItem(search);
        console.log(`[select-item-bulk] chunk ${i + 1} 응답 ${rows.length}건`);
        for (const row of rows) {
          const code2 = (row.CODE2 || '').trim();
          if (code2) parsedMap.set(code2, row);
        }
      } catch (err: any) {
        console.error(`[select-item-bulk] chunk ${i + 1} 실패:`, err?.message || err);
        // 실패 청크는 결과에 추가하지 않음 → 그 청크의 코드들은 found:false로 표시됨
      }
    }

    const results = codes.map((code2) => {
      const parsed = parsedMap.get(code2);
      if (parsed) return { code2, found: true, parsed };
      return { code2, found: false };
    });

    return NextResponse.json({
      ok: true,
      total: codes.length,
      found_count: results.filter((r) => r.found).length,
      results,
    });
  } catch (err: any) {
    console.error('[select-item-bulk Error]', err);
    return NextResponse.json({ error: err?.message || 'unknown error' }, { status: 500 });
  }
}
