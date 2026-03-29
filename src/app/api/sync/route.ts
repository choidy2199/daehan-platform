import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/sync — 전체 앱 데이터 조회
 * products 테이블에 product_type='app_data' 행들로 저장
 * 각 행: part_code='_data_{key}', memo=JSON 데이터
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('part_code, memo')
      .eq('product_type', 'app_data');

    if (error) throw error;

    const result: Record<string, any> = {};
    (data || []).forEach(row => {
      const key = (row.part_code || '').replace('_data_', '');
      try { result[key] = JSON.parse(row.memo || '[]'); } catch { result[key] = []; }
    });

    return NextResponse.json({ data: result, keys: Object.keys(result) });
  } catch (err: any) {
    console.error('[Sync GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/sync — 앱 데이터 업로드 (key-value 방식)
 * Body: { key: 'mw_products', value: [...] }
 * 또는 { bulk: { mw_products: [...], mw_settings: {...}, ... } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 벌크 업로드
    if (body.bulk) {
      const keys = Object.keys(body.bulk);
      let saved = 0;

      for (const key of keys) {
        const value = body.bulk[key];
        const partCode = '_data_' + key;
        const memo = JSON.stringify(value);

        // upsert 시뮬레이션: 기존 행 삭제 → 새로 삽입
        await supabase
          .from('products')
          .delete()
          .eq('part_code', partCode)
          .eq('product_type', 'app_data');

        const { error } = await supabase
          .from('products')
          .insert({
            part_code: partCode,
            product_type: 'app_data',
            item_name: key,
            memo: memo,
          });

        if (error) {
          console.error(`[Sync POST] ${key} 실패:`, error);
        } else {
          saved++;
          console.log(`[Sync POST] ${key} 저장: ${memo.length}자`);
        }
      }

      return NextResponse.json({ success: true, saved, total: keys.length });
    }

    // 단일 업로드
    const { key, value } = body;
    if (!key) return NextResponse.json({ error: 'key가 필요합니다' }, { status: 400 });

    const partCode = '_data_' + key;
    const memo = JSON.stringify(value);

    await supabase
      .from('products')
      .delete()
      .eq('part_code', partCode)
      .eq('product_type', 'app_data');

    const { error } = await supabase
      .from('products')
      .insert({
        part_code: partCode,
        product_type: 'app_data',
        item_name: key,
        memo: memo,
      });

    if (error) throw error;

    return NextResponse.json({ success: true, key, size: memo.length });
  } catch (err: any) {
    console.error('[Sync POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
