import { NextResponse } from 'next/server';
import { parseTablesFromXml } from '@/lib/erp';

export const maxDuration = 60;

const ERP_URL = process.env.ERP_URL || 'https://drws20.softcity.co.kr:1448/WS_shop.asmx';
const ERP_USER_KEY = process.env.ERP_USER_KEY || '';

/**
 * GET /api/customers/search?q=<검색어>&limit=<숫자>
 * 경영박사 SelectGuraeUrlEnc로 전체 거래처 조회 후 name 필터링.
 * 응답: { customers: [{ code2: string, name: string }] }
 * - code2 = 경영박사 관리코드 (CODE2). 빈 값인 거래처는 결과에서 제외 (매입전표 전송 불가)
 * - q 빈 문자열 → { customers: [] }
 * - limit 기본 10, 최대 20으로 clamp
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    const limitRaw = parseInt(url.searchParams.get('limit') ?? '10', 10);
    const limit = Math.min(Math.max(isNaN(limitRaw) ? 10 : limitRaw, 1), 20);

    if (!q) {
      return NextResponse.json(
        { customers: [] },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (!ERP_USER_KEY) {
      return NextResponse.json(
        { error: 'ERP_USER_KEY 환경변수가 설정되지 않았습니다', customers: [] },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const fieldEnc = encodeURIComponent('*');
    const whereEnc = encodeURIComponent('1=1');

    let xml: string;
    try {
      const response = await fetch(`${ERP_URL}/SelectGuraeUrlEnc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `cUserKey=${encodeURIComponent(ERP_USER_KEY)}&UrlEnc_FIELD=${fieldEnc}&UrlEnc_WHERE=${whereEnc}`,
      });
      if (!response.ok) throw new Error(`ERP HTTP ${response.status} ${response.statusText}`);
      xml = await response.text();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Customers Search] ERP fetch failed:', msg);
      return NextResponse.json(
        { error: '경영박사 조회 실패: ' + msg, customers: [] },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const rows = parseTablesFromXml(xml);
    const qLower = q.toLowerCase();

    const customers = rows
      .filter(r => {
        const name = (r.NAME || '').trim();
        const code2 = (r.CODE2 || '').trim();
        if (!name || !code2) return false;
        return name.toLowerCase().includes(qLower);
      })
      .map(r => ({ code2: (r.CODE2 || '').trim(), name: (r.NAME || '').trim() }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
      .slice(0, limit);

    console.log(`[Customers Search] q='${q}' limit=${limit} total=${rows.length} returned=${customers.length}`);

    return NextResponse.json(
      { customers },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Customers Search] unexpected error:', err);
    return NextResponse.json(
      { error: msg, customers: [] },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
