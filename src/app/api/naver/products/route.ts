import { NextRequest, NextResponse } from 'next/server';
import { getNaverProducts, updateNaverPrice } from '@/lib/naver';

// GET /api/naver/products?page=1&size=100
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
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
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { originProductNo, newPrice } = body;

    if (!originProductNo || !newPrice) {
      return NextResponse.json(
        { success: false, error: 'originProductNo와 newPrice가 필요합니다' },
        { status: 400 }
      );
    }

    await updateNaverPrice(String(originProductNo), Number(newPrice));

    return NextResponse.json({
      success: true,
      message: '가격 수정 성공',
      originProductNo,
      newPrice: Number(newPrice),
    });
  } catch (error: any) {
    console.error('네이버 가격 수정 실패:', error);
    return NextResponse.json(
      { success: false, error: error.message || '가격 수정 실패' },
      { status: 500 }
    );
  }
}
