import { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultClient } from './supabase';

// ========== 타입 정의 ==========

export type DocType = 'sales' | 'purchase' | 'quote';
export type TransactionStatus = 'draft' | 'saved' | 'erp_sent' | 'cancelled';

export interface Transaction {
  id: string;
  doc_type: DocType;
  doc_number: string | null;
  customer_code: string;
  customer_name: string;
  transaction_date: string;
  manager: string | null;
  memo: string | null;
  supply_amount: number;
  vat_amount: number;
  total_amount: number;
  status: TransactionStatus;
  erp_sent_at: string | null;
  converted_from_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  line_no: number;
  product_code: string;
  product_name: string;
  spec: string | null;
  quantity: number;
  unit_price: number;
  supply_amount: number;
  vat_amount: number;
  memo: string | null;
}

export interface TransactionWithItems extends Transaction {
  items: TransactionItem[];
}

export interface TransactionItemInput {
  line_no: number;
  product_code: string;
  product_name: string;
  spec?: string | null;
  quantity: number;
  unit_price: number;
  supply_amount: number;
  vat_amount?: number;
  memo?: string | null;
}

export interface TransactionInput {
  doc_type: DocType;
  doc_number?: string | null;
  customer_code: string;
  customer_name: string;
  transaction_date: string;
  manager?: string | null;
  memo?: string | null;
  supply_amount: number;
  vat_amount: number;
  total_amount: number;
  status?: TransactionStatus;
  converted_from_id?: string | null;
  created_by: string;
  items: TransactionItemInput[];
}

export interface ListFilters {
  doc_type?: DocType;
  status?: TransactionStatus;
  customer_code?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface CustomerStats {
  totalCount: number;
  totalAmount: number;
  topProducts: Array<{ product_code: string; product_name: string; count: number; totalQty: number }>;
}

// ========== 헬퍼 ==========

type Client = SupabaseClient;

function getClient(client?: Client): Client {
  return client || (defaultClient as unknown as Client);
}

function mapItems(transactionId: string, items: TransactionItemInput[]) {
  return items.map((it) => ({
    transaction_id: transactionId,
    line_no: it.line_no,
    product_code: it.product_code,
    product_name: it.product_name,
    spec: it.spec ?? null,
    quantity: it.quantity,
    unit_price: it.unit_price,
    supply_amount: it.supply_amount,
    vat_amount: it.vat_amount ?? 0,
    memo: it.memo ?? null,
  }));
}

// ========== 1. createTransaction ==========

export async function createTransaction(
  data: TransactionInput,
  client?: Client
): Promise<TransactionWithItems> {
  const sb = getClient(client);
  try {
    const { items, ...header } = data;

    const { data: inserted, error: headerErr } = await sb
      .from('dh_transactions')
      .insert(header)
      .select()
      .single();

    if (headerErr) throw headerErr;
    if (!inserted) throw new Error('헤더 insert 실패 — 데이터 없음');

    const transactionId = inserted.id as string;

    if (items && items.length > 0) {
      const rows = mapItems(transactionId, items);
      const { error: itemsErr } = await sb.from('dh_transaction_items').insert(rows);

      if (itemsErr) {
        await sb.from('dh_transactions').delete().eq('id', transactionId);
        throw itemsErr;
      }
    }

    const result = await getTransactionById(transactionId, sb);
    if (!result) throw new Error(`생성된 전표 조회 실패: ${transactionId}`);
    return result;
  } catch (err: any) {
    throw new Error(`createTransaction 실패: ${err.message || err}`);
  }
}

// ========== 2. updateTransaction ==========

export async function updateTransaction(
  id: string,
  data: Partial<TransactionInput>,
  client?: Client
): Promise<TransactionWithItems> {
  const sb = getClient(client);
  try {
    const { items, ...headerPatch } = data;

    if (Object.keys(headerPatch).length > 0) {
      const { error: updErr } = await sb
        .from('dh_transactions')
        .update(headerPatch)
        .eq('id', id);

      if (updErr) throw updErr;
    }

    if (items !== undefined) {
      const { error: delErr } = await sb
        .from('dh_transaction_items')
        .delete()
        .eq('transaction_id', id);
      if (delErr) throw delErr;

      if (items.length > 0) {
        const rows = mapItems(id, items);
        const { error: insErr } = await sb.from('dh_transaction_items').insert(rows);
        if (insErr) throw insErr;
      }
    }

    const result = await getTransactionById(id, sb);
    if (!result) throw new Error(`업데이트된 전표 조회 실패: ${id}`);
    return result;
  } catch (err: any) {
    throw new Error(`updateTransaction 실패: ${err.message || err}`);
  }
}

// ========== 3. deleteTransaction ==========

export async function deleteTransaction(id: string, client?: Client): Promise<void> {
  const sb = getClient(client);
  try {
    const { error } = await sb.from('dh_transactions').delete().eq('id', id);
    if (error) throw error;
  } catch (err: any) {
    throw new Error(`deleteTransaction 실패: ${err.message || err}`);
  }
}

// ========== 4. getTransactionById ==========

export async function getTransactionById(
  id: string,
  client?: Client
): Promise<TransactionWithItems | null> {
  const sb = getClient(client);
  try {
    const { data: header, error: headerErr } = await sb
      .from('dh_transactions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (headerErr) throw headerErr;
    if (!header) return null;

    const { data: items, error: itemsErr } = await sb
      .from('dh_transaction_items')
      .select('*')
      .eq('transaction_id', id)
      .order('line_no', { ascending: true });

    if (itemsErr) throw itemsErr;

    return { ...(header as Transaction), items: (items || []) as TransactionItem[] };
  } catch (err: any) {
    throw new Error(`getTransactionById 실패: ${err.message || err}`);
  }
}

// ========== 5. listTransactions ==========

export async function listTransactions(
  filters: ListFilters = {},
  client?: Client
): Promise<Transaction[]> {
  const sb = getClient(client);
  try {
    let q = sb.from('dh_transactions').select('*');

    if (filters.doc_type) q = q.eq('doc_type', filters.doc_type);
    if (filters.status) q = q.eq('status', filters.status);
    if (filters.customer_code) q = q.eq('customer_code', filters.customer_code);
    if (filters.dateFrom) q = q.gte('transaction_date', filters.dateFrom);
    if (filters.dateTo) q = q.lte('transaction_date', filters.dateTo);

    q = q.order('transaction_date', { ascending: false }).order('created_at', { ascending: false });

    const limit = filters.limit ?? 100;
    const offset = filters.offset ?? 0;
    q = q.range(offset, offset + limit - 1);

    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as Transaction[];
  } catch (err: any) {
    throw new Error(`listTransactions 실패: ${err.message || err}`);
  }
}

// ========== 6. getRecentTransactionsByCustomer ==========

export async function getRecentTransactionsByCustomer(
  customerCode: string,
  limit: number = 10,
  client?: Client
): Promise<TransactionWithItems[]> {
  const sb = getClient(client);
  try {
    const { data: headers, error: headerErr } = await sb
      .from('dh_transactions')
      .select('*')
      .eq('customer_code', customerCode)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (headerErr) throw headerErr;
    if (!headers || headers.length === 0) return [];

    const ids = headers.map((h: any) => h.id as string);
    const { data: allItems, error: itemsErr } = await sb
      .from('dh_transaction_items')
      .select('*')
      .in('transaction_id', ids)
      .order('line_no', { ascending: true });

    if (itemsErr) throw itemsErr;

    const itemsByTx = new Map<string, TransactionItem[]>();
    for (const it of (allItems || []) as TransactionItem[]) {
      if (!itemsByTx.has(it.transaction_id)) itemsByTx.set(it.transaction_id, []);
      itemsByTx.get(it.transaction_id)!.push(it);
    }

    return (headers as Transaction[]).map((h) => ({
      ...h,
      items: itemsByTx.get(h.id) || [],
    }));
  } catch (err: any) {
    throw new Error(`getRecentTransactionsByCustomer 실패: ${err.message || err}`);
  }
}

// ========== 7. getLastUnitPrice ==========

export async function getLastUnitPrice(
  customerCode: string,
  productCode: string,
  client?: Client
): Promise<number | null> {
  const sb = getClient(client);
  try {
    const { data: headers, error: hErr } = await sb
      .from('dh_transactions')
      .select('id')
      .eq('customer_code', customerCode)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);

    if (hErr) throw hErr;
    if (!headers || headers.length === 0) return null;

    const ids = headers.map((h: any) => h.id as string);

    const { data: items, error: iErr } = await sb
      .from('dh_transaction_items')
      .select('unit_price, transaction_id')
      .eq('product_code', productCode)
      .in('transaction_id', ids);

    if (iErr) throw iErr;
    if (!items || items.length === 0) return null;

    const orderMap = new Map<string, number>();
    (headers as any[]).forEach((h, i) => orderMap.set(h.id as string, i));

    let bestIdx = Infinity;
    let bestPrice: number | null = null;
    for (const it of items as any[]) {
      const idx = orderMap.get(it.transaction_id);
      if (idx !== undefined && idx < bestIdx) {
        bestIdx = idx;
        bestPrice = Number(it.unit_price);
      }
    }

    return bestPrice;
  } catch (err: any) {
    throw new Error(`getLastUnitPrice 실패: ${err.message || err}`);
  }
}

// ========== 8. getCustomerStats ==========

export async function getCustomerStats(
  customerCode: string,
  months: number = 6,
  client?: Client
): Promise<CustomerStats> {
  const sb = getClient(client);
  try {
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    const sinceStr = since.toISOString().slice(0, 10);

    const { data: headers, error: hErr } = await sb
      .from('dh_transactions')
      .select('id, total_amount')
      .eq('customer_code', customerCode)
      .gte('transaction_date', sinceStr);

    if (hErr) throw hErr;

    const totalCount = headers?.length || 0;
    const totalAmount = (headers || []).reduce(
      (s: number, h: any) => s + Number(h.total_amount || 0),
      0
    );

    if (totalCount === 0) {
      return { totalCount: 0, totalAmount: 0, topProducts: [] };
    }

    const ids = (headers || []).map((h: any) => h.id as string);
    const { data: items, error: iErr } = await sb
      .from('dh_transaction_items')
      .select('product_code, product_name, quantity')
      .in('transaction_id', ids);

    if (iErr) throw iErr;

    const byProduct = new Map<
      string,
      { product_code: string; product_name: string; count: number; totalQty: number }
    >();
    for (const it of (items || []) as any[]) {
      const key = it.product_code;
      if (!byProduct.has(key)) {
        byProduct.set(key, {
          product_code: it.product_code,
          product_name: it.product_name,
          count: 0,
          totalQty: 0,
        });
      }
      const entry = byProduct.get(key)!;
      entry.count += 1;
      entry.totalQty += Number(it.quantity || 0);
    }

    const topProducts = Array.from(byProduct.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { totalCount, totalAmount, topProducts };
  } catch (err: any) {
    throw new Error(`getCustomerStats 실패: ${err.message || err}`);
  }
}
