import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = 'product-images';

// POST 핸들러 제거됨 (옵션 B-1: 클라이언트 직접 업로드로 전환).
// 이전 라우트는 Vercel Function(iad1) ↔ Supabase(Sydney) 왕복으로 4초 소요 →
// 클라(서울) ↔ Supabase(Sydney) 1-hop 직접 호출로 ~500~800ms로 단축.

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const url = String(body?.url || '');
    if (!url) {
      return NextResponse.json({ ok: false, error: 'url 필요' }, { status: 400 });
    }

    const marker = `/${BUCKET}/`;
    const idx = url.lastIndexOf(marker);
    if (idx < 0) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 url' }, { status: 400 });
    }
    const fileName = url.slice(idx + marker.length).split('?')[0];
    if (!fileName) {
      return NextResponse.json({ ok: false, error: '파일명 추출 실패' }, { status: 400 });
    }

    const { error: rmErr } = await supabaseAdmin.storage.from(BUCKET).remove([fileName]);
    if (rmErr) {
      console.error('[products/upload] remove error:', rmErr);
      return NextResponse.json({ ok: false, error: rmErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[products/upload] DELETE exception:', e);
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
