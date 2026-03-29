import { NextRequest, NextResponse } from 'next/server';
import { callNewOrderOut } from '@/lib/erp';

export const maxDuration = 60;

/**
 * POST /api/erp/order-out
 * Body: { customerCode, memo, date, items: [{ code, qty, price, amount, vat, memo }] }
 *
 * 경영박사 NewOrderOut 매출 전표 등록
 * info: "거래처CODE2|비고|YY.MM.DD|"
 * items: "품목CODE2$수량$단가$금액$부가세$비고|..."
 * ibgum: "0|||"
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerCode, memo, date, items } = body;

    if (!customerCode) {
      return NextResponse.json({ error: '거래처 코드가 필요합니다' }, { status: 400 });
    }
    if (!items || !items.length) {
      return NextResponse.json({ error: '품목이 필요합니다' }, { status: 400 });
    }

    // info: 거래처CODE2|비고|YY.MM.DD|전표번호(빈값=자동채번)
    const info = `${customerCode}|${memo || ''}|${date || ''}|`;

    // items: 품목CODE2$수량$단가$금액$부가세$비고 를 |로 연결
    const itemsStr = items.map((it: any) =>
      `${it.code || ''}$${it.qty || 0}$${it.price || 0}$${it.amount || 0}$${it.vat || 0}$${it.memo || ''}`
    ).join('|');

    // ibgum: 입금금액|입금방법|입금메모|
    const ibgum = '0|||';

    console.log(`[NewOrderOut] info: ${info}`);
    console.log(`[NewOrderOut] items: ${itemsStr.substring(0, 200)}`);

    const xml = await callNewOrderOut(info, itemsStr, ibgum);

    console.log(`[NewOrderOut] 응답 길이: ${xml.length}`);

    // 응답에서 결과 추출
    const resultMatch = xml.match(/<NewOrderOutResult>([^<]*)<\/NewOrderOutResult>/) ||
                         xml.match(/<string[^>]*>([^<]*)<\/string>/);
    const result = resultMatch ? resultMatch[1].trim() : xml.substring(0, 200);

    console.log(`[NewOrderOut] 결과: ${result}`);

    if (result.startsWith('Error') || result.includes('오류')) {
      return NextResponse.json({ error: result }, { status: 500 });
    }

    return NextResponse.json({ success: true, result, orderNo: result });
  } catch (err: any) {
    console.error('[NewOrderOut Error]', err);
    return NextResponse.json({ error: err.message, detail: String(err) }, { status: 500 });
  }
}
