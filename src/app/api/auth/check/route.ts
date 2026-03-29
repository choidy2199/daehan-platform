import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/check
 * Body: { token }
 * 토큰 형식: "uuid|expiresISO"
 * 클라이언트 측 세션 검증 (서버 DB 조회 없이 토큰 만료만 확인)
 */
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    if (!token) return NextResponse.json({ valid: false });

    const parts = token.split('|');
    if (parts.length < 2) return NextResponse.json({ valid: false });

    const expires = new Date(parts[1]);
    if (new Date() > expires) {
      return NextResponse.json({ valid: false, error: '세션이 만료되었습니다' });
    }

    // 사용자 정보는 localStorage의 current_user에서 복원
    return NextResponse.json({ valid: true });
  } catch (err: any) {
    return NextResponse.json({ valid: false, error: err.message });
  }
}
