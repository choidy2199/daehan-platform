import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

interface PlatformStatus {
  id: string;
  name: string;
  status: 'connected' | 'not_configured' | 'error';
  message?: string;
}

// 환경변수 존재 여부로 상태 판단
function checkEnvStatus(keys: string[]): 'connected' | 'not_configured' {
  const allPresent = keys.every(k => {
    const val = process.env[k];
    return val !== undefined && val !== '';
  });
  return allPresent ? 'connected' : 'not_configured';
}

// GET — 전체 플랫폼 상태 일괄 조회 (환경변수 기반)
export async function GET() {
  const platforms: PlatformStatus[] = [
    {
      id: 'erp',
      name: '경영박사 ERP',
      status: checkEnvStatus(['ERP_USER_KEY', 'ERP_URL']),
    },
    {
      id: 'naver',
      name: '네이버 커머스',
      status: (process.env.NAVER_CLIENT_ID && (process.env.NAVER_CLIENT_SECRET_B64 || process.env.NAVER_CLIENT_SECRET)) ? 'connected' : 'not_configured',
    },
    {
      id: 'coupang',
      name: '쿠팡 마켓플레이스',
      status: checkEnvStatus(['COUPANG_ACCESS_KEY', 'COUPANG_SECRET_KEY']),
    },
    {
      id: 'ssg',
      name: 'SSG.COM',
      status: checkEnvStatus(['SSG_API_KEY']),
    },
    {
      id: 'gmarket',
      name: 'G마켓/옥션 (ESM)',
      status: checkEnvStatus(['GMARKET_API_KEY']),
    },
    {
      id: 'kakao',
      name: '카카오 알림톡',
      status: checkEnvStatus(['KAKAO_REST_API_KEY']),
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

  try {
    switch (platformId) {
      case 'erp': {
        // ERP CheckService SOAP 호출 (cUserKey 파라미터 사용)
        const userKey = process.env.ERP_USER_KEY;
        const erpUrl = process.env.ERP_URL;
        if (!userKey || !erpUrl) {
          return NextResponse.json({ success: false, message: 'ERP 환경변수 미설정' });
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
        // 디버그: Vercel에서 환경변수 실제 값 확인
        const _id = process.env.NAVER_CLIENT_ID || '';
        const _secret = process.env.NAVER_CLIENT_SECRET || '';
        const _b64 = process.env.NAVER_CLIENT_SECRET_B64 || '';
        const _b64dec = _b64 ? Buffer.from(_b64, 'base64').toString('utf-8') : '';
        return NextResponse.json({
          success: false,
          message: `DEBUG: ID=${_id.length}자[${_id.substring(0,4)}...${_id.substring(_id.length-4)}], SECRET=${_secret.length}자[${_secret.substring(0,6)}...${_secret.substring(Math.max(0,_secret.length-4))}], B64=${_b64.length}자, B64dec=${_b64dec.length}자[${_b64dec.substring(0,6)}...${_b64dec.substring(Math.max(0,_b64dec.length-4))}]`
        });
      }

      case 'coupang': {
        // 쿠팡: 키 존재 + 형식 검증 (vendorId는 선택)
        const accessKey = process.env.COUPANG_ACCESS_KEY;
        const secretKey = process.env.COUPANG_SECRET_KEY;
        if (!accessKey || !secretKey) {
          return NextResponse.json({ success: false, message: '쿠팡 API 키 미등록' });
        }
        // HMAC 서명 방식 — 키가 있으면 형식만 검증
        if (accessKey.length < 10 || secretKey.length < 10) {
          return NextResponse.json({ success: false, message: '쿠팡 API 키 형식 오류 (너무 짧음)' });
        }
        return NextResponse.json({ success: true, message: '쿠팡 API 키 등록됨 (연결 테스트는 실제 호출 시 확인)' });
      }

      case 'ssg': {
        // SSG: 키 존재 여부 확인 (IP 등록 필요할 수 있음)
        const ssgKey = process.env.SSG_API_KEY;
        if (!ssgKey) {
          return NextResponse.json({ success: false, message: 'SSG API 키 미등록' });
        }
        return NextResponse.json({ success: true, message: 'SSG API 키 등록됨 (IP 등록 필요)' });
      }

      case 'gmarket': {
        // G마켓: 키 존재 여부
        const gmKey = process.env.GMARKET_API_KEY;
        if (!gmKey) {
          return NextResponse.json({ success: false, message: 'G마켓 API 키 미등록' });
        }
        return NextResponse.json({ success: true, message: 'G마켓 API 키 등록됨' });
      }

      case 'kakao': {
        // 카카오: 키 형식 검증
        const kakaoKey = process.env.KAKAO_REST_API_KEY;
        if (!kakaoKey) {
          return NextResponse.json({ success: false, message: '카카오 REST API 키 미등록' });
        }
        if (kakaoKey.length < 10) {
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
