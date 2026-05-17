import { NextRequest, NextResponse } from 'next/server';
import { getSsgShppDirectionList } from '@/lib/ssg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ListRequestBody {
  perdType?: '01' | '02' | '03';
  perdStrDts: string;   // YYYYMMDD
  perdEndDts: string;   // YYYYMMDD
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ListRequestBody;
    if (!body.perdStrDts || !body.perdEndDts) {
      return NextResponse.json(
        { error: 'perdStrDts and perdEndDts required (YYYYMMDD)' },
        { status: 400 }
      );
    }
    const data = await getSsgShppDirectionList({
      perdType: body.perdType ?? '01',
      perdStrDts: body.perdStrDts,
      perdEndDts: body.perdEndDts,
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error('[ssg/orders/list]', err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
