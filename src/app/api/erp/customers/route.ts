import { NextResponse } from 'next/server';
import { parseTablesFromXml } from '@/lib/erp';

export const maxDuration = 60;

const ERP_URL = process.env.ERP_URL || 'https://drws20.softcity.co.kr:1448/WS_shop.asmx';
const ERP_USER_KEY = process.env.ERP_USER_KEY || '';

/**
 * POST /api/erp/customers
 * 경영박사 SelectGuraeUrlEnc로 전체 거래처 조회
 */
export async function POST() {
  try {
    if (!ERP_USER_KEY) {
      return NextResponse.json({ error: 'ERP_USER_KEY 환경변수가 설정되지 않았습니다' }, { status: 500 });
    }

    const fieldEnc = encodeURIComponent('*');
    const whereEnc = encodeURIComponent('1=1');

    console.log('[ERP Customers] 거래처 전체 조회 시작');

    const response = await fetch(`${ERP_URL}/SelectGuraeUrlEnc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `cUserKey=${encodeURIComponent(ERP_USER_KEY)}&UrlEnc_FIELD=${fieldEnc}&UrlEnc_WHERE=${whereEnc}`,
    });

    if (!response.ok) {
      throw new Error(`ERP HTTP ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();
    const rows = parseTablesFromXml(xml);
    console.log(`[ERP Customers] 파싱: ${rows.length}건`);

    const customers = rows.map(r => ({
      code: r.CODE || '',
      manageCode: (r.CODE2 || '').trim(),
      name: r.NAME || '',
      ceo: r.MAN || '',
      manager: r.MAN2 || '',
      bizNo: r.SAUP || '',
      phone: r.TEL || '',
      mobile: r.BEEP || '',
      fax: r.FAX || '',
      zip: r.ZIP || '',
      address: r.JUSO || '',
      bizType: r.UP || '',
      bizItem: r.JONG || '',
      email: r.BIGO3 || '',
      bankName: r.BANK || '',
      bankAccount: r.BANKNO || '',
      bankHolder: r.BANKMAN || '',
      kind: parseInt(r.KIND || '0', 10),
      priceGrade: parseInt(r.DANGA || '0', 10),
      balance: parseFloat(r.JAN || '0'),
      createdDate: r.GENDATE || '',
    }));

    return NextResponse.json({ customers, total: customers.length });
  } catch (err: any) {
    console.error('[ERP Customers]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
