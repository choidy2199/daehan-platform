'use client';

import { useCallback, useState } from 'react';
import type { ProductRow } from './types';
import { calcMargin } from './calcMargin';

const DEFAULT_AD_COST_RATIO = 0.05;

export interface RegisteredItem {
  product_id: string;
  ncc_campaign_id: string | null;
  ncc_keyword_ids: string[];
  status: 'success' | 'failed' | 'dry_run';
  error_message?: string;
}

export interface RegisterResult {
  success: boolean;
  dry_run: boolean;
  registered: RegisteredItem[];
}

interface UseNccRegisterResult {
  loading: boolean;
  error: string | null;
  result: RegisterResult | null;
  registerProducts: (
    products: ProductRow[],
    keywords: string[],
    dryRun: boolean,
  ) => Promise<RegisterResult>;
  resetResult: () => void;
}

export function useNccRegister(feeRate: number): UseNccRegisterResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RegisterResult | null>(null);

  const registerProducts = useCallback(
    async (
      products: ProductRow[],
      keywords: string[],
      dryRun: boolean,
    ): Promise<RegisterResult> => {
      setLoading(true);
      setError(null);
      try {
        const payload = {
          products: products.map(p => {
            const m =
              p.priceNaver != null && p.cost != null
                ? calcMargin(p.priceNaver, p.cost, feeRate)
                : null;
            const marginRate = m ? m.rate / 100 : 0;
            const marginAmount = (p.priceNaver ?? 0) * marginRate;
            const recommended_bid = Math.round(marginAmount * DEFAULT_AD_COST_RATIO);
            const daily_budget = Math.round(recommended_bid * 50);
            return {
              id: String(p.id),
              product_code: p.product_code ?? '',
              product_name: p.model ?? '',
              recommended_bid,
              daily_budget,
            };
          }),
          keywords,
          dry_run: dryRun,
        };
        const res = await fetch('/api/ad/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          throw new Error(`등록 실패: HTTP ${res.status}`);
        }
        const data = (await res.json()) as RegisterResult;
        setResult(data);
        return data;
      } catch (e) {
        const msg = e instanceof Error ? e.message : '알 수 없는 오류';
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [feeRate],
  );

  const resetResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { loading, error, result, registerProducts, resetResult };
}
