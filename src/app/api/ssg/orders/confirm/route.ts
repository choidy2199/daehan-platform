import { NextRequest, NextResponse } from 'next/server';
import { updateSsgOrderConfirm } from '@/lib/ssg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ConfirmRequestBody {
  shppNo: string;
  shppSeq: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ConfirmRequestBody;
    if (!body.shppNo || body.shppSeq == null) {
      return NextResponse.json(
        { error: 'shppNo and shppSeq required' },
        { status: 400 }
      );
    }
    const data = await updateSsgOrderConfirm({
      shppNo: body.shppNo,
      shppSeq: body.shppSeq,
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error('[ssg/orders/confirm]', err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
