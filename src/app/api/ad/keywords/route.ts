import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data, error } = await supabase
      .from('ad_keywords')
      .select('*')
      .order('bid_amt', { ascending: false, nullsFirst: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      count: data?.length ?? 0,
      keywords: data ?? [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ad/keywords]', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
