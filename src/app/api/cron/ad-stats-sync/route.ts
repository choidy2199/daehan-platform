import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/cron/ad-stats-sync — Vercel Cron 전용 엔드포인트 (5-D-4)
 * 인증: Authorization: Bearer ${CRON_SECRET} (Vercel이 자동 주입)
 * 스케줄: vercel.json의 crons 참조 (UTC 18:00 = KST 03:00 매일 1회)
 * 동작: /api/ad/stats/sync 를 self-fetch (어제 1일치). sync route 무수정 재사용.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const origin = new URL(req.url).origin;
  const res = await fetch(`${origin}/api/ad/stats/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const result = await res.json();
  console.log('[cron/ad-stats-sync]', JSON.stringify(result));
  return NextResponse.json(result);
}
