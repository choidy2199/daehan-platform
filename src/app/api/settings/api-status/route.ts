import { NextRequest, NextResponse } from 'next/server';
import { soapCall } from '@/lib/erp';
import { getAccessToken } from '@/lib/naver';

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
      status: checkEnvStatus(['NAVER_CLIENT_ID', 'NAVER_CLIENT_SECRET']),
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
        // ERP SOAP 호출 테스트 (간단한 품목 조회)
        if (!process.env.ERP_USER_KEY || !process.env.ERP_URL) {
          return NextResponse.json({ success: false, message: 'ERP 환경변수 미설정' });
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
          await soapCall('SelectItemUrlEnc', { pSearchText: 'TEST', pSearchGubun: '0' });
          clearTimeout(timeout);
          return NextResponse.json({ success: true, message: 'ERP 연결 성공' });
        } catch (e: unknown) {
          clearTimeout(timeout);
          const msg = e instanceof Error ? e.message : String(e);
          return NextResponse.json({ success: false, message: `ERP 연결 실패: ${msg}` });
        }
      }

      case 'naver': {
        // 네이버 토큰 발급 테스트
        if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
          return NextResponse.json({ success: false, message: '네이버 환경변수 미설정' });
        }
        try {
          await getAccessToken();
          return NextResponse.json({ success: true, message: '네이버 API 연결 성공 (토큰 발급 완료)' });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          return NextResponse.json({ success: false, message: `네이버 연결 실패: ${msg}` });
        }
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
