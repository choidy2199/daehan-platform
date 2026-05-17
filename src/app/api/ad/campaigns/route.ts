import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('ad_campaigns')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      count: data?.length ?? 0,
      campaigns: data ?? [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ad/campaigns]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
