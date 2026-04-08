import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/naver';
import { getApiKeys, saveApiKeys, ApiKeys } from '@/lib/api-keys';

function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 6) return '***';
  return key.substring(0, 3) + '***' + key.substring(key.length - 3);
}

// GET — 전체 플랫폼 상태 + 키 조회
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get('raw') === 'true';
  const keys = await getApiKeys();

  const platforms = [
    {
      id: 'erp',
      name: '경영박사 ERP',
      status: (keys.erp.userKey && keys.erp.url) ? 'connected' as const : 'not_configured' as const,
      keys: [
        { label: 'ERP_USER_KEY', value: raw ? keys.erp.userKey : maskKey(keys.erp.userKey) },
        { label: 'ERP_URL', value: raw ? keys.erp.url : maskKey(keys.erp.url) },
      ],
    },
    {
      id: 'naver',
      name: '네이버 커머스',
      status: (keys.naver.clientId && keys.naver.clientSecret) ? 'connected' as const : 'not_configured' as const,
      keys: [
        { label: 'NAVER_CLIENT_ID', value: raw ? keys.naver.clientId : maskKey(keys.naver.clientId) },
        { label: 'NAVER_CLIENT_SECRET', value: raw ? keys.naver.clientSecret : maskKey(keys.naver.clientSecret) },
      ],
    },
    {
      id: 'coupang',
      name: '쿠팡 마켓플레이스',
      status: (keys.coupang.accessKey && keys.coupang.secretKey) ? 'connected' as const : 'not_configured' as const,
      keys: [
        { label: 'COUPANG_ACCESS_KEY', value: raw ? keys.coupang.accessKey : maskKey(keys.coupang.accessKey) },
        { label: 'COUPANG_SECRET_KEY', value: raw ? keys.coupang.secretKey : maskKey(keys.coupang.secretKey) },
      ],
    },
    {
      id: 'ssg',
      name: 'SSG.COM',
      status: keys.ssg.apiKey ? 'connected' as const : 'not_configured' as const,
      keys: [
        { label: 'SSG_API_KEY', value: raw ? keys.ssg.apiKey : maskKey(keys.ssg.apiKey) },
      ],
    },
    {
      id: 'gmarket',
      name: 'G마켓/옥션 (ESM)',
      status: keys.gmarket.apiKey ? 'connected' as const : 'not_configured' as const,
      keys: [
        { label: 'GMARKET_API_KEY', value: raw ? keys.gmarket.apiKey : maskKey(keys.gmarket.apiKey) },
      ],
    },
    {
      id: 'kakao',
      name: '카카오 알림톡',
      status: keys.kakao.apiKey ? 'connected' as const : 'not_configured' as const,
      keys: [
        { label: 'KAKAO_REST_API_KEY', value: raw ? keys.kakao.apiKey : maskKey(keys.kakao.apiKey) },
      ],
    },
  ];

  return NextResponse.json({ platforms });
}

// POST — 개별 플랫폼 연결 테스트
export async function POST(req: NextRequest) {
  const { platformId } = await req.json();

  if (!platformId) {
    return NextResponse.json({ success: false, message: 'platformId 필수' }, { status: 400 });
  }

  const keys = await getApiKeys();

  try {
    switch (platformId) {
      case 'erp': {
        const userKey = keys.erp.userKey;
        const erpUrl = keys.erp.url;
        if (!userKey || !erpUrl) {
          return NextResponse.json({ success: false, message: 'ERP API 키 미설정' });
        }
        try {
          const soapEnv = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <CheckService xmlns="http://tempuri.org/">
      <cUserKey>${userKey}</cUserKey>
    </CheckService>
  </soap:Body>
</soap:Envelope>`;
          const resp = await fetch(erpUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/xml; charset=utf-8',
              'SOAPAction': 'http://tempuri.org/CheckService',
            },
            body: soapEnv,
          });
          if (!resp.ok) {
            return NextResponse.json({ success: false, message: `ERP 응답 오류: ${resp.status}` });
          }
          const xml = await resp.text();
          if (xml.includes('Service Ok')) {
            return NextResponse.json({ success: true, message: 'ERP 연결 성공' });
          }
          return NextResponse.json({ success: false, message: 'ERP 응답 이상' });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          return NextResponse.json({ success: false, message: `ERP 연결 실패: ${msg}` });
        }
      }

      case 'naver': {
        if (!keys.naver.clientId || !keys.naver.clientSecret) {
          return NextResponse.json({ success: false, message: '네이버 API 키 미설정' });
        }
        try {
          const token = await getAccessToken();
          if (token) {
            return NextResponse.json({ success: true, message: '네이버 API 연결 성공 (토큰 발급 완료)' });
          }
          return NextResponse.json({ success: false, message: '네이버 토큰 발급 실패 (토큰 없음)' });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          return NextResponse.json({ success: false, message: `네이버 연결 실패: ${msg}` });
        }
      }

      case 'coupang': {
        const accessKey = keys.coupang.accessKey;
        const secretKey = keys.coupang.secretKey;
        if (!accessKey || !secretKey) {
          return NextResponse.json({ success: false, message: '쿠팡 API 키 미등록' });
        }
        if (accessKey.length < 10 || secretKey.length < 10) {
          return NextResponse.json({ success: false, message: '쿠팡 API 키 형식 오류 (너무 짧음)' });
        }
        return NextResponse.json({ success: true, message: '쿠팡 API 키 등록됨 (연결 테스트는 실제 호출 시 확인)' });
      }

      case 'ssg': {
        if (!keys.ssg.apiKey) {
          return NextResponse.json({ success: false, message: 'SSG API 키 미등록' });
        }
        return NextResponse.json({ success: true, message: 'SSG API 키 등록됨 (IP 등록 필요)' });
      }

      case 'gmarket': {
        if (!keys.gmarket.apiKey) {
          return NextResponse.json({ success: false, message: 'G마켓 API 키 미등록' });
        }
        return NextResponse.json({ success: true, message: 'G마켓 API 키 등록됨' });
      }

      case 'kakao': {
        if (!keys.kakao.apiKey) {
          return NextResponse.json({ success: false, message: '카카오 REST API 키 미등록' });
        }
        if (keys.kakao.apiKey.length < 10) {
          return NextResponse.json({ success: false, message: '카카오 API 키 형식 오류' });
        }
        return NextResponse.json({ success: true, message: '카카오 API 키 등록됨' });
      }

      default:
        return NextResponse.json({ success: false, message: `알 수 없는 플랫폼: ${platformId}` }, { status: 400 });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message: `연결 테스트 오류: ${msg}` }, { status: 500 });
  }
}

// PUT — API 키 저장
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const keys = body.keys as ApiKeys;

    if (!keys || typeof keys !== 'object') {
      return NextResponse.json({ success: false, message: '잘못된 데이터 형식' }, { status: 400 });
    }

    const result = await saveApiKeys(keys);
    if (result) {
      return NextResponse.json({ success: true, message: 'API 키 저장 완료' });
    }
    return NextResponse.json({ success: false, message: 'Supabase 저장 실패' }, { status: 500 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message: `저장 실패: ${msg}` }, { status: 500 });
  }
}
