import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: '파일이 필요합니다' }, { status: 400 });
    }

    // 파일명 생성: timestamp + 원본명
    const ext = file.name.split('.').pop() || 'png';
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = `images/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error } = await supabase.storage
      .from('notices')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (error) throw error;

    // Public URL 생성
    const { data: urlData } = supabase.storage
      .from('notices')
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      fileName: fileName
    });
  } catch (err: any) {
    console.error('[Notices Upload]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
