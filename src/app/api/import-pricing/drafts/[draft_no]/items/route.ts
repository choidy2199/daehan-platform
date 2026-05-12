import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/import-pricing/drafts/[draft_no]/items
// 특정 책정안의 items 전체를 sort_order ASC로 반환.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ draft_no: string }> }
) {
  try {
    const { draft_no } = await params;

    const { data, error } = await supabase
      .from('import_pricing_drafts')
      .select('*')
      .eq('draft_no', draft_no)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err: unknown) {
    console.error('[ImportPricing Items GET]', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST /api/import-pricing/drafts/[draft_no]/items
// body: { items: [{ source_code, management_code?, category?, name, spec?, photo_url?, cost? }, ...] }
// 기존 max sort_order 이후로 순차 부여하여 일괄 insert.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ draft_no: string }> }
) {
  try {
    const { draft_no } = await params;
    const body = await request.json().catch(() => ({}));
    const items = body?.items;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'items array required' },
        { status: 400 }
      );
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it?.source_code || !it?.name) {
        return NextResponse.json(
          { success: false, error: `source_code/name required at index ${i}` },
          { status: 400 }
        );
      }
    }

    const { data: maxRow, error: maxErr } = await supabase
      .from('import_pricing_drafts')
      .select('sort_order')
      .eq('draft_no', draft_no)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxErr) throw maxErr;

    const startOrder = (maxRow?.sort_order ?? -1) + 1;

    const rows = items.map((it: Record<string, unknown>, i: number) => ({
      draft_no,
      sort_order: startOrder + i,
      source_code: it.source_code,
      management_code: it.management_code ?? null,
      category: it.category ?? null,
      name: it.name,
      spec: it.spec ?? null,
      photo_url: it.photo_url ?? null,
      cost: it.cost ?? null,
      price_a: null,
      price_b: null,
      price_c: null,
      price_market: null,
      gift_id: null,
      gift_type: null,
      gift_percent: null,
      remark: null,
    }));

    const { data, error } = await supabase
      .from('import_pricing_drafts')
      .insert(rows)
      .select();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data ?? [],
      inserted_count: data?.length ?? 0,
    });
  } catch (err: unknown) {
    console.error('[ImportPricing Items POST]', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// PATCH /api/import-pricing/drafts/[draft_no]/items
// body: { id: number, field: 'price_a'|'price_b'|'price_c'|'price_market'|'management_code'|'remark', value: number|string|null }
// 단일 item 인라인 편집. draft_no 일치 확인 후 update.
const ALLOWED_FIELDS = ['price_a', 'price_b', 'price_c', 'price_market', 'management_code', 'remark'] as const;
const PRICE_FIELDS = new Set(['price_a', 'price_b', 'price_c', 'price_market']);
const TEXT_FIELDS = new Set(['management_code', 'remark']);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ draft_no: string }> }
) {
  try {
    const { draft_no } = await params;
    const body = await request.json().catch(() => ({}));
    const { id, field, value } = body ?? {};

    if (id == null) {
      return NextResponse.json(
        { success: false, error: 'id required' },
        { status: 400 }
      );
    }

    if (!ALLOWED_FIELDS.includes(field)) {
      return NextResponse.json(
        { success: false, error: `field not allowed: ${field}` },
        { status: 400 }
      );
    }

    if (PRICE_FIELDS.has(field)) {
      if (value !== null && typeof value !== 'number') {
        return NextResponse.json(
          { success: false, error: `${field} must be number or null` },
          { status: 400 }
        );
      }
    } else if (TEXT_FIELDS.has(field)) {
      if (value !== null && typeof value !== 'string') {
        return NextResponse.json(
          { success: false, error: `${field} must be string or null` },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from('import_pricing_drafts')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('draft_no', draft_no)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'item not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    console.error('[ImportPricing Items PATCH]', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/import-pricing/drafts/[draft_no]/items
// body: { id: number }
// 단일 item 삭제. draft_no 일치 확인 후 delete.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ draft_no: string }> }
) {
  try {
    const { draft_no } = await params;
    const body = await request.json().catch(() => ({}));
    const id = body?.id;

    if (typeof id !== 'number') {
      return NextResponse.json(
        { success: false, error: 'id (number) required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('import_pricing_drafts')
      .delete()
      .eq('id', id)
      .eq('draft_no', draft_no)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'item not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    console.error('[ImportPricing Items DELETE]', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
