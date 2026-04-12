import { NextRequest, NextResponse } from 'next/server';
import { getSsgProductList, findSsgProductByCode } from '@/lib/ssg';

// GET /api/ssg/products           → SSG 전체 상품 목록
// GET /api/ssg/products?code=XXX  → 코드 단건 매칭
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (code) {
      const product = await findSsgProductByCode(code);
      if (!product) {
        return NextResponse.json(
          { success: false, error: '해당 코드의 SSG 상품을 찾을 수 없습니다', code },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, product });
    }

    const products = await getSsgProductList();
    return NextResponse.json({
      success: true,
      products,
      total: products.length,
    });
  } catch (error: any) {
    console.error('SSG 상품 조회 실패:', error);
    return NextResponse.json(
      { success: false, error: error.message || '상품 조회 실패' },
      { status: 500 }
    );
  }
}
