'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const DEFAULT_NAVER_FEE = 0.0663;

/**
 * 네이버 채널 수수료율 hook
 * Supabase app_data 테이블의 key='mw_settings' → value.naverFee 읽기.
 * 값 없거나 에러 시 기본값 0.0663 (네이버 6.63%).
 *
 * 출처 매핑: public/manager/app.js:1072 getMarketFeeRate('naver') 와 동일 진실값.
 */
export function useFeeRate(): {
  feeRate: number;
  loading: boolean;
  error: string | null;
} {
  const [feeRate, setFeeRate] = useState<number>(DEFAULT_NAVER_FEE);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchFeeRate() {
      try {
        const { data, error: fetchError } = await supabase
          .from('app_data')
          .select('value')
          .eq('key', 'mw_settings')
          .single();

        if (cancelled) return;

        if (fetchError) {
          setError(fetchError.message);
          setFeeRate(DEFAULT_NAVER_FEE);
        } else {
          const value = data?.value as { naverFee?: number } | null;
          const fee = value?.naverFee;
          setFeeRate(typeof fee === 'number' ? fee : DEFAULT_NAVER_FEE);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setFeeRate(DEFAULT_NAVER_FEE);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchFeeRate();
    return () => {
      cancelled = true;
    };
  }, []);

  return { feeRate, loading, error };
}
