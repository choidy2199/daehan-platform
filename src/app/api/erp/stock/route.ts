import { NextRequest, NextResponse } from 'next/server';
import { selectItem } from '@/lib/erp';

/**
 * POST /api/erp/stock
 * Body: { codes: string[] }  — 관리코드 배열 (최대 50개)
 * Response: { results: { code: string, stock: number }[], errors: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const codes: string[] = body.codes;

    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json({ error: '관리코드 배열(codes)이 필요합니다' }, { status: 400 });
    }

    if (codes.length > 50) {
      return NextResponse.json({ error: '최대 50개까지 조회 가능합니다' }, { status: 400 });
    }

    const results: { code: string; stock: number }[] = [];
    const errors: string[] = [];

    // 각 관리코드별로 ERP 조회
    for (const code of codes) {
      try {
        const items = await selectItem(code);

        if (items.length > 0) {
          // JEGO 필드에서 현재고 추출
          const stock = parseInt(items[0].JEGO || '0', 10);
          results.push({ code, stock });
        } else {
          // ERP에 해당 품목 없음 — 에러가 아니라 재고 0으로 처리
          results.push({ code, stock: 0 });
        }
      } catch (err: any) {
        errors.push(`${code}: ${err.message}`);
      }
    }

    return NextResponse.json({ results, errors });
  } catch (err: any) {
    console.error('[ERP Stock API Error]', err);
    return NextResponse.json({ error: err.message || '서버 오류' }, { status: 500 });
  }
}
