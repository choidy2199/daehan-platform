import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  createTransaction,
  listTransactions,
  DocType,
  TransactionStatus,
} from '@/lib/transactions';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const doc_type = searchParams.get('doc_type') as DocType | null;
    const status = searchParams.get('status') as TransactionStatus | null;
    const customer_code = searchParams.get('customer_code');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const data = await listTransactions(
      {
        doc_type: doc_type || undefined,
        status: status || undefined,
        customer_code: customer_code || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
      },
      supabase
    );

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[Transactions GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      doc_type,
      doc_number,
      customer_code,
      customer_name,
      transaction_date,
      manager,
      memo,
      supply_amount,
      vat_amount,
      total_amount,
      status,
      converted_from_id,
      created_by,
      items,
    } = body;

    if (!doc_type || !customer_code || !customer_name || !transaction_date || !created_by) {
      return NextResponse.json(
        { error: 'doc_type, customer_code, customer_name, transaction_date, created_by는 필수입니다' },
        { status: 400 }
      );
    }
    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'items는 배열이어야 합니다' }, { status: 400 });
    }

    const data = await createTransaction(
      {
        doc_type,
        doc_number: doc_number ?? null,
        customer_code,
        customer_name,
        transaction_date,
        manager: manager ?? null,
        memo: memo ?? null,
        supply_amount: Number(supply_amount) || 0,
        vat_amount: Number(vat_amount) || 0,
        total_amount: Number(total_amount) || 0,
        status: status ?? 'draft',
        converted_from_id: converted_from_id ?? null,
        created_by,
        items,
      },
      supabase
    );

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[Transactions POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
