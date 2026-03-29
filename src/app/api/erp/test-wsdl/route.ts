import { NextResponse } from 'next/server';

const ERP_URL = process.env.ERP_URL || '';

export async function GET() {
  try {
    const res = await fetch(ERP_URL + '?WSDL');
    const wsdl = await res.text();

    // NewOrderOut 파라미터 추출
    const newOrderOutMatch = wsdl.match(/<s:element name="NewOrderOut">([\s\S]*?)<\/s:element>/i);
    const params = newOrderOutMatch
      ? [...newOrderOutMatch[1].matchAll(/<s:element[^>]*name="(\w+)"/g)].map(m => m[1])
      : [];

    // NewOrderIn 파라미터도 확인
    const newOrderInMatch = wsdl.match(/<s:element name="NewOrderIn">([\s\S]*?)<\/s:element>/i);
    const inParams = newOrderInMatch
      ? [...newOrderInMatch[1].matchAll(/<s:element[^>]*name="(\w+)"/g)].map(m => m[1])
      : [];

    return NextResponse.json({
      NewOrderOut: params,
      NewOrderIn: inParams,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
