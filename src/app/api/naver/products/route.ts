import { NextRequest, NextResponse } from 'next/server';
import { getNaverProducts, updateNaverPrice, findNaverProductByCode } from '@/lib/naver';

// GET /api/naver/products?page=1&size=100
// GET /api/naver/products?code=21815 (판매자관리코드로 단건 조회)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    // 판매자관리코드로 단건 조회
    if (code) {
      const product = await findNaverProductByCode(code);
      if (!product) {
        return NextResponse.json({ success: false, error: '해당 코드의 상품을 찾을 수 없습니다', code }, { status: 404 });
      }
      return NextResponse.json({ success: true, product });
    }

    // 전체 목록 조회
    const page = Number(searchParams.get('page') || '1');
    const size = Number(searchParams.get('size') || '100');

    const data = await getNaverProducts(page, size);

    return NextResponse.json({
      success: true,
      products: data.contents || [],
      total: data.totalElements ?? data.total ?? 0,
      page,
      size,
    });
  } catch (error: any) {
    console.error('네이버 상품 조회 실패:', error);
    return NextResponse.json(
      { success: false, error: error.message || '상품 조회 실패' },
      { status: 500 }
    );
  }
}

// PUT /api/naver/products
// 단건 전송 최적화: { code, newPrice }만 보내면 서버에서 조회→수정 한 번에 처리
// 기존 호환: { originProductNo, newPrice, channelProductNo } 도 지원
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, originProductNo, newPrice, channelProductNo } = body;

    console.log('[DEBUG PUT] 요청 body:', JSON.stringify(body));

    if (!newPrice) {
      return NextResponse.json(
        { success: false, error: 'newPrice가 필요합니다' },
        { status: 400 }
      );
    }

    // code로 단건 전송 (신규 최적화 경로 — 클라이언트 왕복 1회)
    if (code && !originProductNo) {
      const product = await findNaverProductByCode(String(code));
      if (!product) {
        return NextResponse.json(
          { success: false, error: '해당 코드의 네이버 상품을 찾을 수 없습니다', code },
          { status: 404 }
        );
      }
      const result = await updateNaverPrice(
        String(product.originProductNo),
        Number(newPrice),
        product.channelProductNo ? Number(product.channelProductNo) : undefined
      );
      return NextResponse.json({
        success: true,
        message: '가격 수정 성공',
        code,
        originProductNo: product.originProductNo,
        newPrice: Number(newPrice),
        channelProductNo: result?.channelProductNo,
      });
    }

    // 기존 호환 경로: originProductNo + channelProductNo
    if (!originProductNo) {
      return NextResponse.json(
        { success: false, error: 'code 또는 originProductNo가 필요합니다' },
        { status: 400 }
      );
    }
    const result = await updateNaverPrice(String(originProductNo), Number(newPrice), channelProductNo ? Number(channelProductNo) : undefined);
    console.log('[DEBUG PUT] updateNaverPrice 결과 keys:', result ? Object.keys(result) : 'null');

    return NextResponse.json({
      success: true,
      message: '가격 수정 성공',
      originProductNo,
      newPrice: Number(newPrice),
      channelProductNo: result?.channelProductNo,
    });
  } catch (error: any) {
    console.error('네이버 가격 수정 실패:', error);
    return NextResponse.json(
      { success: false, error: error.message || '가격 수정 실패' },
      { status: 500 }
    );
  }
}
