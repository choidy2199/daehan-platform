export type BackorderProductType = 'milwaukee' | 'general' | 'import';
export type BackorderStatus = 'waiting' | 'partial' | 'done' | 'cancelled';

export interface Backorder {
  id: number;
  product_code: string;
  product_name: string;
  product_type: BackorderProductType;
  model: string;
  customer_name: string;
  customer_code: string;
  quantity: number;
  shipped_qty: number;
  status: BackorderStatus;
  note: string | null;
  author: string;
  created_at: string;
  completed_at: string | null;
}

export interface BackordersResponse {
  success: boolean;
  data: Backorder[];
}
