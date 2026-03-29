import { NextRequest, NextResponse } from 'next/server';
import { parseTablesFromXml } from '@/lib/erp';

export const maxDuration = 60;

const ERP_URL = process.env.ERP_URL || 'https://drws20.softcity.co.kr:1448/WS_shop.asmx';
const ERP_USER_KEY = process.env.ERP_USER_KEY || '';

/**
 * POST /api/erp/stock
 * Body: { codes: string[] }  — 관리코드 배열 (최대 500개)
 * Response: { results: { code: string, stock: number }[], errors: string[] }
 *
 * 경영박사 SelectItemUrlEnc를 HTTP POST (form-urlencoded) 방식으로 호출
 * GET은 URL 길이 제한(~8000자)으로 대량 조회 시 404 발생
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

    if (!ERP_USER_KEY) {
      return NextResponse.json({ error: 'ERP_USER_KEY 환경변수가 설정되지 않았습니다' }, { status: 500 });
    }

    const results: { code: string; stock: number }[] = [];
    const errors: string[] = [];

    try {
      // 관리코드 trim + 빈 값 제외
      const cleanCodes = codes.map(c => c.trim()).filter(c => c && c !== '-');
      if (!cleanCodes.length) {
        console.log('[ERP Stock] 유효한 관리코드 없음');
        return NextResponse.json({ results: [], errors: [] });
      }

      // 관리코드를 '코드1','코드2','코드3' 형태로 조합
      const whereValue = cleanCodes.map(c => `'${c}'`).join(',');

      // HTTP POST form-urlencoded 방식 (URL 길이 제한 없음)
      const formBody = `cUserKey=${encodeURIComponent(ERP_USER_KEY)}&UrlEnc_WHERE=${encodeURIComponent(whereValue)}`;

      console.log(`[ERP Stock] POST 호출: ${cleanCodes.length}건 (원본 ${codes.length}건), body길이: ${formBody.length}`);

      const response = await fetch(`${ERP_URL}/SelectItemUrlEnc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody,
      });

      if (!response.ok) {
        throw new Error(`ERP HTTP ${response.status} ${response.statusText}`);
      }

      const xml = await response.text();
      console.log(`[ERP Stock] XML 응답 길이: ${xml.length}자`);

      const rows = parseTablesFromXml(xml);
      console.log(`[ERP Stock] 파싱된 행: ${rows.length}건`);

      if (rows.length > 0) {
        console.log(`[ERP Stock] 첫 행 필드:`, Object.keys(rows[0]).join(', '));
      }

      // CODE2(관리코드) → JEGO(현재고) 매핑
      const stockMap: Record<string, number> = {};
      for (const row of rows) {
        const code2 = (row.CODE2 || '').trim();
        if (code2) {
          stockMap[code2] = parseInt(row.JEGO || '0', 10);
        }
      }

      console.log(`[ERP Stock] stockMap 키 수: ${Object.keys(stockMap).length}`);

      // 요청한 각 코드에 대해 결과 생성 (trim 매칭)
      for (const code of codes) {
        const trimmed = code.trim();
        if (trimmed in stockMap) {
          results.push({ code, stock: stockMap[trimmed] });
        } else {
          results.push({ code, stock: 0 });
        }
      }

    } catch (err: any) {
      console.error('[ERP Stock] 호출 실패:', err.message);
      errors.push(err.message);
    }

    console.log(`[ERP Stock] 최종 결과: ${results.length}건, 오류: ${errors.length}건`);
    return NextResponse.json({ results, errors });
  } catch (err: any) {
    console.error('[ERP Stock API Error]', err);
    return NextResponse.json({ error: err.message || '서버 오류' }, { status: 500 });
  }
}
