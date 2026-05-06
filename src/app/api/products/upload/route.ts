import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = 'product-images';

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  try {
    const arrayBuffer = await req.arrayBuffer();
    const t1 = Date.now();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return NextResponse.json({ ok: false, error: '빈 본문' }, { status: 400 });
    }
    const buffer = Buffer.from(arrayBuffer);

    const fileName = `product_${Date.now()}.png`;
    const t2 = Date.now();

    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(fileName, buffer, { contentType: 'image/png', upsert: true });
    const t3 = Date.now();
    if (upErr) {
      console.error('[products/upload] upload error:', upErr);
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(fileName);
    const t4 = Date.now();
    const newUrl = urlData?.publicUrl;
    if (!newUrl || newUrl.startsWith('blob:')) {
      console.error('[products/upload] invalid public url:', newUrl);
      return NextResponse.json({ ok: false, error: 'public URL 생성 실패' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, url: newUrl, fileName, _timing: { arrayBuffer: t1 - t0, prep: t2 - t1, upload: t3 - t2, getUrl: t4 - t3, total: t4 - t0 } });
  } catch (e: any) {
    console.error('[products/upload] POST exception:', e);
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

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
