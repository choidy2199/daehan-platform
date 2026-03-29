import { NextRequest, NextResponse } from 'next/server';
import { soapCall, parseTablesFromXml } from '@/lib/erp';

// Vercel Serverless 타임아웃 설정 (30초)
export const maxDuration = 30;

/**
 * POST /api/erp/stock
 * Body: { codes: string[] }  — 관리코드 배열 (최대 500개)
 * Response: { results: { code: string, stock: number }[], errors: string[] }
 *
 * 경영박사 SelectItemUrlEnc의 UrlEnc_WHERE에 관리코드를 일괄 전달
 * 형식: '코드1','코드2','코드3'
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const codes: string[] = body.codes;

    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json({ error: '관리코드 배열(codes)이 필요합니다' }, { status: 400 });
    }

    if (codes.length > 500) {
      return NextResponse.json({ error: '최대 500개까지 조회 가능합니다' }, { status: 400 });
    }

    const results: { code: string; stock: number }[] = [];
    const errors: string[] = [];

    try {
      // 관리코드를 '코드1','코드2','코드3' 형태로 조합
      const whereValue = codes.map(c => `'${c}'`).join(',');
      const encoded = encodeURIComponent(whereValue);

      console.log(`[ERP Stock] 일괄 조회: ${codes.length}건`);

      const xml = await soapCall('SelectItemUrlEnc', { UrlEnc_WHERE: encoded });
      const rows = parseTablesFromXml(xml);

      console.log(`[ERP Stock] 응답: ${rows.length}건`);

      // CODE2(관리코드) → JEGO(현재고) 매핑
      const stockMap: Record<string, number> = {};
      for (const row of rows) {
        const code2 = (row.CODE2 || '').trim();
        if (code2) {
          stockMap[code2] = parseInt(row.JEGO || '0', 10);
        }
      }

      // 요청한 각 코드에 대해 결과 생성
      for (const code of codes) {
        if (code in stockMap) {
          results.push({ code, stock: stockMap[code] });
        } else {
          // ERP에 해당 품목 없음 — 재고 0으로 처리
          results.push({ code, stock: 0 });
        }
      }
    } catch (err: any) {
      console.error('[ERP Stock] SOAP 호출 실패:', err.message);
      errors.push(err.message);
    }

    return NextResponse.json({ results, errors });
  } catch (err: any) {
    console.error('[ERP Stock API Error]', err);
    return NextResponse.json({ error: err.message || '서버 오류' }, { status: 500 });
  }
}
