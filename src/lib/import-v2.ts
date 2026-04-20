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

export async function createInvoice(data: Partial<Invoice>): Promise<string> {
  // TODO Step 3: insert into import_invoices, return new id
  void supabase; void data;
  throw new Error('createInvoice: not implemented (Phase 1 Step 3)');
}

export async function listInvoices(batchId?: string): Promise<Invoice[]> {
  // TODO Step 3: select * from import_invoices [where batch_id = ...] order by invoice_date desc
  void supabase; void batchId;
  return [];
}

export async function getInvoice(id: string): Promise<Invoice> {
  // TODO Step 3: select * from import_invoices where id = ...
  void supabase; void id;
  throw new Error('getInvoice: not implemented (Phase 1 Step 3)');
}

export async function updateInvoice(id: string, data: Partial<Invoice>): Promise<void> {
  // TODO Step 3: update import_invoices set ... where id = ...
  void supabase; void id; void data;
}

export async function deleteInvoice(id: string): Promise<void> {
  // TODO Step 3: delete from import_invoices where id = ...
  void supabase; void id;
}

// ========== InvoiceItem (인보이스 제품 라인) ==========

export async function createInvoiceItem(data: Partial<InvoiceItem>): Promise<string> {
  // TODO Step 3: insert into import_invoice_items, return new id
  void supabase; void data;
  throw new Error('createInvoiceItem: not implemented (Phase 1 Step 3)');
}

export async function listInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
  // TODO Step 3: select * from import_invoice_items where invoice_id = ... order by line_no
  void supabase; void invoiceId;
  return [];
}

export async function updateInvoiceItem(id: string, data: Partial<InvoiceItem>): Promise<void> {
  // TODO Step 3: update import_invoice_items set ... where id = ...
  void supabase; void id; void data;
}

export async function deleteInvoiceItem(id: string): Promise<void> {
  // TODO Step 3: delete from import_invoice_items where id = ...
  void supabase; void id;
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
