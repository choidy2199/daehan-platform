import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type UpsertRow = {
  brand: string;
  model: string;
  product_name?: string | null;
  spec?: string | null;
  pallet_qty?: unknown;
  base_fob_usd?: unknown;
  erp_code?: string | null;
  memo?: string | null;
};

type NormalizedRow = {
  brand: string;
  model: string;
  product_name: string | null;
  spec: string | null;
  pallet_qty: number;
  base_fob_usd: number;
  erp_code: string | null;
  memo: string | null;
};

function jsonError(status: number, error: string, extras?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error, ...(extras || {}) }, { status });
}

export async function POST(request: NextRequest) {
  let body: unknown = null;
  try {
    // body 파싱 방어
    try {
      body = await request.json();
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      console.error('[bulk] body parse error:', msg);
      return jsonError(400, '요청 형식이 올바르지 않습니다 (JSON 파싱 실패)', { code: 'INVALID_BODY', details: msg });
    }

    const b = body as { rows?: unknown };
    if (!b || typeof b !== 'object') {
      return jsonError(400, '요청 body는 객체여야 합니다', { code: 'INVALID_BODY' });
    }
    if (!('rows' in b) || !Array.isArray(b.rows)) {
      return jsonError(400, 'rows 필드는 배열이어야 합니다', { code: 'INVALID_BODY' });
    }
    const rawRows = b.rows as UpsertRow[];
    if (rawRows.length === 0) {
      return jsonError(400, '업로드할 데이터가 없습니다', { code: 'EMPTY_BODY' });
    }

    // 행별 파싱 (try/catch 로 개별 실패 격리)
    const errors: Array<{ row: number; reason: string }> = [];
    const valid: NormalizedRow[] = [];
    rawRows.forEach((r, idx) => {
      try {
        const brand = String(r?.brand ?? '').trim();
        const model = String(r?.model ?? '').trim();
        if (!brand || !model) {
          errors.push({ row: idx + 2, reason: '브랜드/모델 필수' });
          return;
        }
        const palletRaw = r?.pallet_qty;
        let pallet: number;
        if (typeof palletRaw === 'number' && Number.isFinite(palletRaw)) {
          pallet = Math.trunc(palletRaw);
        } else if (palletRaw == null || palletRaw === '') {
          pallet = 0;
        } else {
          const parsed = parseInt(String(palletRaw).replace(/[^0-9-]/g, ''), 10);
          pallet = Number.isFinite(parsed) ? parsed : 0;
        }
        const baseFobRaw = r?.base_fob_usd;
        let baseFob: number;
        if (typeof baseFobRaw === 'number' && Number.isFinite(baseFobRaw)) baseFob = baseFobRaw;
        else if (baseFobRaw == null || baseFobRaw === '') baseFob = 0;
        else {
          const parsed = parseFloat(String(baseFobRaw).replace(/[^0-9.-]/g, ''));
          baseFob = Number.isFinite(parsed) ? parsed : 0;
        }
        if (baseFob < 0) baseFob = 0;
        valid.push({
          brand,
          model,
          product_name: r?.product_name ? String(r.product_name).trim() || null : null,
          spec: r?.spec ? String(r.spec).trim() || null : null,
          pallet_qty: pallet,
          base_fob_usd: baseFob,
          erp_code: r?.erp_code ? String(r.erp_code).trim() || null : null,
          memo: r?.memo ? String(r.memo).trim() || null : null,
        });
      } catch (rowErr) {
        const m = rowErr instanceof Error ? rowErr.message : String(rowErr);
        errors.push({ row: idx + 2, reason: '행 파싱 오류: ' + m });
      }
    });

    if (valid.length === 0) {
      return NextResponse.json({ success: true, data: { created: 0, updated: 0, errors } });
    }

    // 기존 제품 조회 (신규/수정 집계)
    const { data: existing, error: qErr } = await supabase
      .from('import_products_v2')
      .select('brand, model');
    if (qErr) {
      console.error('[bulk] select existing error:', qErr);
      return jsonError(500, 'DB 조회 실패: ' + (qErr.message || qErr.code || '알 수 없는 오류'), {
        code: qErr.code || 'DB_SELECT',
        details: qErr.details || qErr.hint || null,
      });
    }
    const key = (b: string, m: string) => `${b}\u0000${m}`;
    const existingSet = new Set(
      (existing || []).map((r: { brand: string; model: string }) => key(r.brand, r.model))
    );
    let created = 0;
    let updated = 0;
    for (const r of valid) {
      if (existingSet.has(key(r.brand, r.model))) updated++;
      else created++;
    }

    // Upsert
    const payload = valid.map(r => ({ ...r, updated_at: new Date().toISOString() }));
    const { error: upErr } = await supabase
      .from('import_products_v2')
      .upsert(payload, { onConflict: 'brand,model' });
    if (upErr) {
      console.error('[bulk] upsert error:', upErr, 'payload_sample:', payload.slice(0, 2));
      // Postgres 23505 = unique violation (onConflict 있어도 드물게 발생 가능)
      if (upErr.code === '23505') {
        return jsonError(409, '일부 제품이 중복되어 저장에 실패했습니다', {
          code: 'DUPLICATE',
          details: upErr.details || upErr.message || null,
        });
      }
      return jsonError(500, 'DB 저장 실패: ' + (upErr.message || upErr.code || '알 수 없는 오류'), {
        code: upErr.code || 'DB_UPSERT',
        details: upErr.details || upErr.hint || null,
      });
    }

    return NextResponse.json({ success: true, data: { created, updated, errors } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('[bulk] unhandled error:', msg);
    if (stack) console.error('[bulk] stack:', stack);
    try {
      console.error('[bulk] body:', JSON.stringify(body));
    } catch {
      console.error('[bulk] body: <unserializable>');
    }
    return jsonError(500, '서버 내부 오류: ' + msg, { code: 'INTERNAL' });
  }
}
