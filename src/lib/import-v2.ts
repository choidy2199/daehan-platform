import { supabase } from './supabase';

// ========== 타입 정의 ==========

export type BatchStatus = 'draft' | 'in_progress' | 'customs_done' | 'erp_sent';
export type InvoiceStatus = 'draft' | 'partial_paid' | 'paid' | 'customs_done';
export type PaymentStatus = 'planned' | 'completed';
export type CustomsClassification = 'cost' | 'vat';

export interface Batch {
  id: string;
  batch_no: string;
  batch_name: string | null;
  container_no: string | null;
  customs_date: string | null;
  status: BatchStatus;
  erp_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  invoice_no: string;
  batch_id: string | null;
  factory_name: string;
  factory_code: string | null;
  invoice_date: string;
  payment_terms: string | null;
  memo: string | null;
  subtotal_usd: number;
  discount_usd: number;
  pallets_usd: number;
  final_amount_usd: number;
  weighted_avg_rate: number | null;
  status: InvoiceStatus;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  line_no: number;
  model: string;
  name: string | null;
  qty: number;
  fob_usd: number;
  amount_usd: number;
  pallets: number;
  is_pallet_line: boolean;
  memo: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  seq: number;
  planned_date: string | null;
  planned_usd: number;
  planned_ratio: number;
  planned_krw: number;
  actual_date: string | null;
  actual_usd: number;
  exchange_rate: number;
  remittance_krw: number;
  fee_krw: number;
  telegram_fee_krw: number;
  total_paid_krw: number;
  effective_rate: number;
  diff_krw: number;
  status: PaymentStatus;
  created_at: string;
}

export interface CustomsCost {
  id: string;
  batch_id: string;
  item_order: number;
  item_name: string;
  amount_krw: number;
  classification: CustomsClassification;
  created_at: string;
}

export interface ProductV2 {
  id: string;
  brand: string;
  model: string;
  product_name: string | null;
  spec: string | null;
  pallet_qty: number;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductV2Upsertable {
  brand: string;
  model: string;
  product_name?: string | null;
  spec?: string | null;
  pallet_qty?: number;
  memo?: string | null;
}

export interface BulkUpsertResult {
  created: number;
  updated: number;
}

export interface ExcelImportResult {
  created: number;
  updated: number;
  errors: Array<{ row: number; reason: string }>;
}

// ========== ProductV2 (제품V2) ==========

export async function listProductsV2(): Promise<ProductV2[]> {
  const { data, error } = await supabase
    .from('import_products_v2')
    .select('*')
    .order('brand', { ascending: true })
    .order('model', { ascending: true });
  if (error) throw error;
  return (data || []) as ProductV2[];
}

export async function getProductV2(id: string): Promise<ProductV2> {
  const { data, error } = await supabase
    .from('import_products_v2')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as ProductV2;
}

export async function createProductV2(data: ProductV2Upsertable): Promise<string> {
  const { data: row, error } = await supabase
    .from('import_products_v2')
    .insert({
      brand: data.brand,
      model: data.model,
      product_name: data.product_name ?? null,
      spec: data.spec ?? null,
      pallet_qty: data.pallet_qty ?? 0,
      memo: data.memo ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return (row as { id: string }).id;
}

export async function updateProductV2(id: string, data: Partial<ProductV2Upsertable>): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.brand !== undefined) payload.brand = data.brand;
  if (data.model !== undefined) payload.model = data.model;
  if (data.product_name !== undefined) payload.product_name = data.product_name;
  if (data.spec !== undefined) payload.spec = data.spec;
  if (data.pallet_qty !== undefined) payload.pallet_qty = data.pallet_qty;
  if (data.memo !== undefined) payload.memo = data.memo;
  const { error } = await supabase.from('import_products_v2').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteProductV2(id: string): Promise<void> {
  const { error } = await supabase.from('import_products_v2').delete().eq('id', id);
  if (error) throw error;
}

export async function searchProductsByModel(keyword: string): Promise<ProductV2[]> {
  const q = (keyword || '').trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from('import_products_v2')
    .select('*')
    .or(`model.ilike.%${q}%,product_name.ilike.%${q}%`)
    .order('brand', { ascending: true })
    .order('model', { ascending: true })
    .limit(20);
  if (error) throw error;
  return (data || []) as ProductV2[];
}

export async function bulkUpsertProductsV2(rows: ProductV2Upsertable[]): Promise<BulkUpsertResult> {
  if (!rows || rows.length === 0) return { created: 0, updated: 0 };
  const { data: existing, error: qErr } = await supabase
    .from('import_products_v2')
    .select('brand, model');
  if (qErr) throw qErr;
  const key = (b: string, m: string) => `${b}\u0000${m}`;
  const existingSet = new Set((existing || []).map((r: { brand: string; model: string }) => key(r.brand, r.model)));
  const payload = rows.map(r => ({
    brand: r.brand,
    model: r.model,
    product_name: r.product_name ?? null,
    spec: r.spec ?? null,
    pallet_qty: r.pallet_qty ?? 0,
    memo: r.memo ?? null,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from('import_products_v2')
    .upsert(payload, { onConflict: 'brand,model' });
  if (error) throw error;
  let created = 0;
  let updated = 0;
  for (const r of rows) {
    if (existingSet.has(key(r.brand, r.model))) updated++;
    else created++;
  }
  return { created, updated };
}

export async function exportProductsV2ToExcel(): Promise<Blob> {
  // xlsx는 브라우저 글로벌로 로드됨. 서버사이드에서 호출되면 throw.
  const XLSX = (globalThis as unknown as { XLSX?: unknown }).XLSX as {
    utils: { aoa_to_sheet: (d: unknown[][]) => unknown; book_new: () => unknown; book_append_sheet: (wb: unknown, ws: unknown, name: string) => void };
    write: (wb: unknown, opts: { type: string; bookType: string }) => ArrayBuffer;
  } | undefined;
  if (!XLSX) throw new Error('exportProductsV2ToExcel: XLSX (browser) 미로드');
  const rows = await listProductsV2();
  const header = ['브랜드', '모델', '품명', '규격', '팔렛당 수량', '비고'];
  const data: unknown[][] = [header];
  rows.forEach(r => {
    data.push([r.brand, r.model, r.product_name ?? '', r.spec ?? '', r.pallet_qty ?? 0, r.memo ?? '']);
  });
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '제품V2');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function importProductsV2FromExcel(file: File): Promise<ExcelImportResult> {
  const XLSX = (globalThis as unknown as { XLSX?: unknown }).XLSX as {
    read: (buf: ArrayBuffer, opts: { type: string }) => { SheetNames: string[]; Sheets: Record<string, unknown> };
    utils: { sheet_to_json: (ws: unknown, opts: { header: number }) => unknown[][] };
  } | undefined;
  if (!XLSX) throw new Error('importProductsV2FromExcel: XLSX (browser) 미로드');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
  const errors: Array<{ row: number; reason: string }> = [];
  const valid: ProductV2Upsertable[] = [];
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i] as unknown[];
    if (!r || r.length === 0) continue;
    const brand = String(r[0] ?? '').trim();
    const model = String(r[1] ?? '').trim();
    if (!brand || !model) {
      if (brand || model || (r.length > 2 && r.some(c => String(c ?? '').trim()))) {
        errors.push({ row: i + 1, reason: '브랜드/모델 필수' });
      }
      continue;
    }
    const palletRaw = r[4];
    const pallet = typeof palletRaw === 'number' ? palletRaw : parseInt(String(palletRaw ?? '0').replace(/[^0-9-]/g, ''), 10);
    valid.push({
      brand,
      model,
      product_name: String(r[2] ?? '').trim() || null,
      spec: String(r[3] ?? '').trim() || null,
      pallet_qty: Number.isFinite(pallet) ? pallet : 0,
      memo: String(r[5] ?? '').trim() || null,
    });
  }
  const { created, updated } = await bulkUpsertProductsV2(valid);
  return { created, updated, errors };
}

// ========== Batch (수입 건) ==========

export async function createBatch(data: Partial<Batch>): Promise<string> {
  // TODO Step 4: insert into import_batches, return new id
  void supabase; void data;
  throw new Error('createBatch: not implemented (Phase 1 Step 4)');
}

export async function listBatches(): Promise<Batch[]> {
  // TODO Step 4: select * from import_batches order by created_at desc
  void supabase;
  return [];
}

export async function getBatch(id: string): Promise<Batch> {
  // TODO Step 4: select * from import_batches where id = ...
  void supabase; void id;
  throw new Error('getBatch: not implemented (Phase 1 Step 4)');
}

export async function updateBatch(id: string, data: Partial<Batch>): Promise<void> {
  // TODO Step 4: update import_batches set ... where id = ...
  void supabase; void id; void data;
}

export async function deleteBatch(id: string): Promise<void> {
  // TODO Step 4: delete from import_batches where id = ...
  void supabase; void id;
}

// ========== Invoice (인보이스) ==========

export type InvoiceV2 = Invoice;
export type InvoiceItemV2 = InvoiceItem;

export async function createInvoice(data: Partial<Invoice>): Promise<string> {
  if (!data.invoice_no || !data.factory_name || !data.invoice_date) {
    throw new Error('invoice_no, factory_name, invoice_date는 필수입니다');
  }
  const { data: row, error } = await supabase
    .from('import_invoices')
    .insert({
      invoice_no: data.invoice_no,
      batch_id: data.batch_id ?? null,
      factory_name: data.factory_name,
      factory_code: data.factory_code ?? null,
      invoice_date: data.invoice_date,
      payment_terms: data.payment_terms ?? null,
      memo: data.memo ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return (row as { id: string }).id;
}

export async function listInvoices(statusFilter?: string): Promise<Invoice[]> {
  let query = supabase
    .from('import_invoices')
    .select('*')
    .order('invoice_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (statusFilter && statusFilter !== 'all') query = query.eq('status', statusFilter);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Invoice[];
}

export async function getInvoice(id: string): Promise<Invoice> {
  const { data, error } = await supabase
    .from('import_invoices')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as Invoice;
}

export async function updateInvoice(id: string, data: Partial<Invoice>): Promise<void> {
  const allowed: (keyof Invoice)[] = ['invoice_no', 'batch_id', 'factory_name', 'factory_code', 'invoice_date', 'payment_terms', 'memo', 'subtotal_usd', 'discount_usd', 'pallets_usd', 'final_amount_usd', 'weighted_avg_rate', 'status'];
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of allowed) {
    if (k in data) payload[k] = (data as Record<string, unknown>)[k];
  }
  const { error } = await supabase.from('import_invoices').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await supabase.from('import_invoices').delete().eq('id', id);
  if (error) throw error;
}

// ========== InvoiceItem (인보이스 제품 라인) ==========

export async function createInvoiceItem(data: Partial<InvoiceItem>): Promise<string> {
  if (!data.invoice_id || !data.model) throw new Error('invoice_id, model은 필수입니다');
  const qty = Number(data.qty ?? 0);
  const fob = Number(data.fob_usd ?? 0);
  const { data: row, error } = await supabase
    .from('import_invoice_items')
    .insert({
      invoice_id: data.invoice_id,
      line_no: data.line_no ?? 1,
      model: data.model,
      name: data.name ?? null,
      qty,
      fob_usd: fob,
      amount_usd: Number((qty * fob).toFixed(2)),
      pallets: data.pallets ?? 0,
      is_pallet_line: data.is_pallet_line ?? false,
      memo: data.memo ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  await recalcInvoiceTotals(data.invoice_id);
  return (row as { id: string }).id;
}

export async function listInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
  const { data, error } = await supabase
    .from('import_invoice_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('line_no', { ascending: true });
  if (error) throw error;
  return (data || []) as InvoiceItem[];
}

export async function updateInvoiceItem(id: string, data: Partial<InvoiceItem>): Promise<void> {
  const allowed: (keyof InvoiceItem)[] = ['line_no', 'model', 'name', 'qty', 'fob_usd', 'pallets', 'is_pallet_line', 'memo'];
  const payload: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in data) payload[k] = (data as Record<string, unknown>)[k];
  }
  if ('qty' in payload || 'fob_usd' in payload) {
    const { data: cur } = await supabase.from('import_invoice_items').select('qty, fob_usd, invoice_id').eq('id', id).single();
    const q = 'qty' in payload ? Number(payload.qty) : Number((cur as { qty: number } | null)?.qty || 0);
    const f = 'fob_usd' in payload ? Number(payload.fob_usd) : Number((cur as { fob_usd: number } | null)?.fob_usd || 0);
    payload.amount_usd = Number((q * f).toFixed(2));
  }
  const { data: updated, error } = await supabase
    .from('import_invoice_items')
    .update(payload)
    .eq('id', id)
    .select('invoice_id')
    .single();
  if (error) throw error;
  const invoiceId = (updated as { invoice_id: string } | null)?.invoice_id;
  if (invoiceId) await recalcInvoiceTotals(invoiceId);
}

export async function deleteInvoiceItem(id: string): Promise<void> {
  const { data: existing } = await supabase
    .from('import_invoice_items')
    .select('invoice_id')
    .eq('id', id)
    .single();
  const invoiceId = (existing as { invoice_id: string } | null)?.invoice_id || null;
  const { error } = await supabase.from('import_invoice_items').delete().eq('id', id);
  if (error) throw error;
  if (invoiceId) await recalcInvoiceTotals(invoiceId);
}

export async function bulkCreateInvoiceItems(
  invoiceId: string,
  items: Array<Partial<InvoiceItem>>
): Promise<{ created: number; items: InvoiceItem[] }> {
  if (!items || items.length === 0) return { created: 0, items: [] };
  const { data: existing } = await supabase
    .from('import_invoice_items')
    .select('line_no')
    .eq('invoice_id', invoiceId)
    .order('line_no', { ascending: false })
    .limit(1);
  const nextStart = existing && existing.length > 0 ? Number((existing[0] as { line_no: number }).line_no) + 1 : 1;
  const payload = items
    .filter(it => !!it.model)
    .map((it, idx) => {
      const qty = Number(it.qty ?? 0);
      const fob = Number(it.fob_usd ?? 0);
      return {
        invoice_id: invoiceId,
        line_no: it.line_no ?? nextStart + idx,
        model: it.model as string,
        name: it.name ?? null,
        qty,
        fob_usd: fob,
        amount_usd: Number((qty * fob).toFixed(2)),
        pallets: it.pallets ?? 0,
        is_pallet_line: it.is_pallet_line ?? false,
        memo: it.memo ?? null,
      };
    });
  if (payload.length === 0) return { created: 0, items: [] };
  const { data, error } = await supabase.from('import_invoice_items').insert(payload).select('*');
  if (error) throw error;
  await recalcInvoiceTotals(invoiceId);
  return { created: (data || []).length, items: (data || []) as InvoiceItem[] };
}

export async function recalcInvoiceTotals(invoiceId: string): Promise<void> {
  const { data: items, error: qErr } = await supabase
    .from('import_invoice_items')
    .select('qty, fob_usd, is_pallet_line')
    .eq('invoice_id', invoiceId);
  if (qErr) throw qErr;
  let subtotal = 0;
  let pallets = 0;
  (items || []).forEach((it: { qty: number; fob_usd: number; is_pallet_line: boolean }) => {
    const amt = Number(it.qty || 0) * Number(it.fob_usd || 0);
    if (it.is_pallet_line) pallets += amt;
    else subtotal += amt;
  });
  const { data: inv, error: iErr } = await supabase
    .from('import_invoices')
    .select('discount_usd')
    .eq('id', invoiceId)
    .single();
  if (iErr) throw iErr;
  const discount = Number((inv as { discount_usd: number }).discount_usd || 0);
  const final = Number((subtotal - discount + pallets).toFixed(2));
  await supabase
    .from('import_invoices')
    .update({
      subtotal_usd: Number(subtotal.toFixed(2)),
      pallets_usd: Number(pallets.toFixed(2)),
      final_amount_usd: final,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId);
}

// ========== Payment (송금 스케줄) ==========

export async function createPayment(data: Partial<Payment>): Promise<string> {
  // TODO Step 3: insert into import_payments, return new id
  void supabase; void data;
  throw new Error('createPayment: not implemented (Phase 1 Step 3)');
}

export async function listPayments(invoiceId: string): Promise<Payment[]> {
  // TODO Step 3: select * from import_payments where invoice_id = ... order by seq
  void supabase; void invoiceId;
  return [];
}

export async function updatePayment(id: string, data: Partial<Payment>): Promise<void> {
  // TODO Step 3: update import_payments set ... where id = ...
  void supabase; void id; void data;
}

export async function deletePayment(id: string): Promise<void> {
  // TODO Step 3: delete from import_payments where id = ...
  void supabase; void id;
}

// ========== CustomsCost (통관 비용) ==========

export async function listCustomsCosts(batchId: string): Promise<CustomsCost[]> {
  // TODO Step 4: select * from import_customs_costs where batch_id = ... order by item_order
  void supabase; void batchId;
  return [];
}

export async function updateCustomsCost(id: string, data: Partial<CustomsCost>): Promise<void> {
  // TODO Step 4: update import_customs_costs set ... where id = ...
  void supabase; void id; void data;
}
