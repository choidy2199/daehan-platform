import { NextResponse } from 'next/server';
import { getStats } from '@/lib/naver-ad';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 5-D-1 임시 디버그 라우트 — NCC /stats 응답 shape 확인용.
// 5-D-2에서 /api/ad/stats/sync 로 흡수 예정 → 그때 이 파일 삭제.
// 인증/RLS 검증 없음 (임시).

// A-2에서 확보한 활성 ncc_product_id 5개 (기본값)
const DEFAULT_IDS = [
  'nad-a001-02-000000318502735',
  'nad-a001-02-000000321850472',
  'nad-a001-02-000000318788251',
  'nad-a001-02-000000318518628',
  'nad-a001-02-000000318518610',
];

// KST 기준 어제 (YYYY-MM-DD)
function yesterdayKST(): string {
  const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  kst.setDate(kst.getDate() - 1);
  return kst.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get('ids');
  const ids = idsParam
    ? idsParam.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_IDS;
  const y = yesterdayKST();
  const since = searchParams.get('since') || y;
  const until = searchParams.get('until') || y;
  const timeIncrement = (searchParams.get('timeIncrement') as '1' | 'allDays') || 'allDays';
  const fields = ['impCnt', 'clkCnt', 'salesAmt', 'ccnt', 'convAmt', 'ror'];

  try {
    const raw = await getStats({ ids, fields, timeRange: { since, until }, timeIncrement });
    console.log('[ad/stats/test] raw:', JSON.stringify(raw, null, 2));
    return NextResponse.json({
      ok: true,
      raw,
      requestEcho: { ids, fields, timeRange: { since, until }, timeIncrement },
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
      { status: 500 },
    );
  }
}
