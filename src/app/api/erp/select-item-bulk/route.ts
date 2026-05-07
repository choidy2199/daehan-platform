import { NextRequest, NextResponse } from 'next/server';
import { parseTablesFromXml } from '@/lib/erp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ERP_URL = process.env.ERP_URL || 'https://drws20.softcity.co.kr:1448/WS_shop.asmx';
const ERP_USER_KEY = process.env.ERP_USER_KEY || '';

const CHUNK_SIZE = 100;

/**
 * POST /api/erp/select-item-bulk
 * Body: { code2List: string[] }
 *
 * 단가 동기화 전용 — SelectItemUrlEncPrice 호출
 * (ERP는 ITEM/GYU/PARTCODE 등 텍스트 마스터 read API 미제공.
 *  단가 5개 + 재고만 노출되어 단가 동기화 용도로만 사용.)
 *
 * 응답 필드명 prefix `it` (itCODE2/itINPR/itOUTA 등) → 표준 키로 변환하여 반환
 * 100건씩 청크 분할 → cUserKey + UrlEnc_WHERE form-urlencoded
 */
export async function POST(request: NextRequest) {
  try {
    if (!ERP_URL || !ERP_USER_KEY) {
      return NextResponse.json(
        { ok: false, error: 'ERP_URL 또는 ERP_USER_KEY 환경변수 누락' },
        { status: 500 }
      );
    }

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
      // 'c1','c2','c3' 형식 (매뉴얼 §8)
      const whereValue = chunk.map((c) => `'${c.replace(/'/g, "''")}'`).join(',');
      const formBody =
        `cUserKey=${encodeURIComponent(ERP_USER_KEY)}` +
        `&UrlEnc_WHERE=${encodeURIComponent(whereValue)}`;

      try {
        const response = await fetch(`${ERP_URL}/SelectItemUrlEncPrice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formBody,
        });

        if (!response.ok) {
          throw new Error(`ERP HTTP ${response.status} ${response.statusText}`);
        }

        const responseText = await response.text();

        if (responseText.startsWith('Error:')) {
          console.error(
            `[select-item-bulk] chunk ${i + 1} ERP Error: ${responseText.substring(0, 200)}`
          );
          continue;
        }

        const tables = parseTablesFromXml(responseText);
        console.log(
          `[select-item-bulk] chunk ${i + 1}/${chunks.length} req=${chunk.length}건 res=${tables.length}건`
        );

        // SelectItemUrlEncPrice 응답은 it* prefix → 프론트 호환을 위해 표준 키로 변환
        for (const row of tables) {
          const code2 = (row.itCODE2 || '').trim();
          if (!code2) continue;
          const normalized: Record<string, string> = {
            CODE2: row.itCODE2 || '',
            INPR: row.itINPR || '',
            OUTPR: row.itOUTPR || '',
            OUTA: row.itOUTA || '',
            OUTB: row.itOUTB || '',
            OUTC: row.itOUTC || '',
            OUTD: row.itOUTD || '',
            OUTE: row.itOUTE || '',
            OUTF: row.itOUTF || '',
            OUTG: row.itOUTG || '',
            OUTH: row.itOUTH || '',
            OUTI: row.itOUTI || '',
          };
          parsedMap.set(code2, normalized);
        }
      } catch (err: any) {
        console.error(
          `[select-item-bulk] chunk ${i + 1} 실패:`,
          err?.message || err
        );
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
