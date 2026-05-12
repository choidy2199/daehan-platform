import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/import-pricing/drafts?tab_type=pricing
// 책정안 목록 조회 (메타 테이블). tab_type 미지정 시 전체.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tabType = searchParams.get('tab_type');

    let query = supabase
      .from('import_pricing_draft_meta')
      .select('*')
      .order('created_at', { ascending: false });

    if (tabType === 'pricing' || tabType === 'promotion') {
      query = query.eq('tab_type', tabType);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err: unknown) {
    console.error('[ImportPricing Drafts GET]', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST /api/import-pricing/drafts
// body: { tab_type: 'pricing'|'promotion', created_by: string, draft_name?: string }
// → DB 함수 generate_draft_no 호출로 원자적 번호 생성 + 메타 INSERT, 새 행 반환
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const tab_type = body?.tab_type;
    const created_by = body?.created_by;
    const draft_name = body?.draft_name ?? null;

    if (tab_type !== 'pricing' && tab_type !== 'promotion') {
      return NextResponse.json(
        { success: false, error: "tab_type must be 'pricing' or 'promotion'" },
        { status: 400 }
      );
    }
    if (!created_by || typeof created_by !== 'string') {
      return NextResponse.json(
        { success: false, error: 'created_by required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc('generate_draft_no', {
      p_tab_type: tab_type,
      p_created_by: created_by,
      p_draft_name: draft_name,
    });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    console.error('[ImportPricing Drafts POST]', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
