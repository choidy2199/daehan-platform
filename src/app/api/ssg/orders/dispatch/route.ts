import { NextRequest, NextResponse } from 'next/server';
import { saveSsgWblNo, saveSsgWhOutComplete } from '@/lib/ssg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface DispatchRequestBody {
  shppNo: string;
  shppSeq: number;
  wblNo: string;
  delicoVenId: string;
  shppTypeCd: string;
  shppTypeDtlCd: string;
  procItemQty: number;
}

export async function POST(req: NextRequest) {
  let waybillResult: any = null;
  try {
    const body = (await req.json()) as DispatchRequestBody;

    const required: (keyof DispatchRequestBody)[] = [
      'shppNo', 'shppSeq', 'wblNo', 'delicoVenId',
      'shppTypeCd', 'shppTypeDtlCd', 'procItemQty',
    ];
    for (const k of required) {
      if (body[k] == null || body[k] === '') {
        return NextResponse.json(
          { error: `${k} required` },
          { status: 400 }
        );
      }
    }

    // 1. 운송장등록
    waybillResult = await saveSsgWblNo({
      shppNo: body.shppNo,
      shppSeq: body.shppSeq,
      wblNo: body.wblNo,
      delicoVenId: body.delicoVenId,
      shppTypeCd: body.shppTypeCd,
      shppTypeDtlCd: body.shppTypeDtlCd,
    });

    const waybillCode = waybillResult?.result?.resultCode;
    if (waybillCode !== '00') {
      return NextResponse.json(
        {
          stage: 'waybill',
          error: 'Waybill registration failed',
          ssg: waybillResult,
        },
        { status: 502 }
      );
    }

    // 2. 출고처리 (운송장등록 성공 시에만)
    const dispatchResult = await saveSsgWhOutComplete({
      shppNo: body.shppNo,
      shppSeq: body.shppSeq,
      procItemQty: body.procItemQty,
    });

    const dispatchCode = dispatchResult?.result?.resultCode;
    if (dispatchCode !== '00') {
      return NextResponse.json(
        {
          stage: 'dispatch',
          error: 'Dispatch failed after waybill registered',
          warning: 'Waybill is registered on SSG. Manual dispatch needed.',
          waybill: waybillResult,
          ssg: dispatchResult,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      waybill: waybillResult,
      dispatch: dispatchResult,
    });
  } catch (err) {
    console.error('[ssg/orders/dispatch]', err);
    return NextResponse.json(
      {
        error: String(err),
        waybillResult,
      },
      { status: 500 }
    );
  }
}
