import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getTransactionById,
  updateTransaction,
  deleteTransaction,
} from '@/lib/transactions';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await getTransactionById(id, supabase);
    if (!data) {
      return NextResponse.json({ error: '전표를 찾을 수 없습니다' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[Transactions GET by id]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = await updateTransaction(id, body, supabase);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[Transactions PUT]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteTransaction(id, supabase);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Transactions DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
