import { NextRequest, NextResponse } from 'next/server';
import { findSsgProductByCode, getSsgPrice, updateSsgPrice } from '@/lib/ssg';

// GET /api/ssg/price?code=XXX → 코드로 SSG 상품 가격 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    if (!code) {
      return NextResponse.json(
        { success: false, error: 'code 파라미터가 필요합니다' },
        { status: 400 }
      );
    }
    const product = await findSsgProductByCode(code);
    if (!product) {
      return NextResponse.json(
        { success: false, error: '해당 코드의 SSG 상품을 찾을 수 없습니다', code },
        { status: 404 }
      );
    }
    const price = await getSsgPrice(product.itemId);
    return NextResponse.json({
      success: true,
      code,
      itemId: product.itemId,
      itemNm: product.itemNm,
      price,
    });
  } catch (error: any) {
    console.error('SSG 가격 조회 실패:', error);
    return NextResponse.json(
      { success: false, error: error.message || '가격 조회 실패' },
      { status: 500 }
    );
  }
}

// POST /api/ssg/price
// body: { code, sellprc, splprc, mrgrt }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, sellprc, splprc, mrgrt } = body || {};

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'code가 필요합니다' },
        { status: 400 }
      );
    }
    if (sellprc == null || splprc == null || mrgrt == null) {
      return NextResponse.json(
        { success: false, error: 'sellprc, splprc, mrgrt가 모두 필요합니다' },
        { status: 400 }
      );
    }

    const product = await findSsgProductByCode(String(code));
    if (!product) {
      return NextResponse.json(
        { success: false, error: '해당 코드의 SSG 상품을 찾을 수 없습니다', code },
        { status: 404 }
      );
    }

    const result = await updateSsgPrice(
      product.itemId,
      Number(sellprc),
      Number(splprc),
      Number(mrgrt)
    );

    return NextResponse.json({
      success: result.success,
      message: result.message,
      code,
      itemId: product.itemId,
    });
  } catch (error: any) {
    console.error('SSG 가격 수정 실패:', error);
    return NextResponse.json(
      { success: false, error: error.message || '가격 수정 실패' },
      { status: 500 }
    );
  }
}
