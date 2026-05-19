'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  getUserPreference,
  setUserPreference,
} from '@/lib/userPreferences';

export type ColumnKey =
  | 'model'
  | 'cost'
  | 'priceNaver'
  | 'marginRate'
  | 'breakEvenRoas'
  | 'actualRoas'
  | 'bid'
  | 'budget'
  | 'automation'
  | 'status';

export type ColumnWidthMap = Record<ColumnKey, number | null>;

export const DEFAULT_RATIOS: Record<ColumnKey, number> = {
  model: 28,
  cost: 9,
  priceNaver: 9,
  marginRate: 6,
  breakEvenRoas: 12,
  actualRoas: 9,
  bid: 7,
  budget: 7,
  automation: 7,
  status: 6,
};

const MIN_WIDTH_PX = 40;
const PREF_KEY = 'adlab:column_widths';

const DEFAULT_WIDTH_MAP: ColumnWidthMap = {
  model: null,
  cost: null,
  priceNaver: null,
  marginRate: null,
  breakEvenRoas: null,
  actualRoas: null,
  bid: null,
  budget: null,
  automation: null,
  status: null,
};

function getLoginId(): string {
  if (typeof window === 'undefined') return 'anon';
  try {
    const raw = localStorage.getItem('current_user');
    if (!raw) return 'anon';
    const user = JSON.parse(raw);
    return user?.loginId ?? 'anon';
  } catch {
    return 'anon';
  }
}

interface UseColumnWidthsResult {
  widths: ColumnWidthMap;
  ratios: Record<ColumnKey, number>;
  setColumnWidth: (key: ColumnKey, px: number) => void;
  resetColumn: (key: ColumnKey) => void;
  resetAll: () => void;
  minWidth: number;
  loading: boolean;
}

export function useColumnWidths(): UseColumnWidthsResult {
  const [widths, setWidths] = useState<ColumnWidthMap>(DEFAULT_WIDTH_MAP);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loginId = getLoginId();

    (async () => {
      try {
        const fromServer = await getUserPreference<Partial<ColumnWidthMap>>(loginId, PREF_KEY);
        if (cancelled) return;
        if (fromServer && typeof fromServer === 'object') {
          setWidths({ ...DEFAULT_WIDTH_MAP, ...fromServer });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const persist = useCallback((next: ColumnWidthMap) => {
    setWidths(next);
    const loginId = getLoginId();
    void setUserPreference(loginId, PREF_KEY, next).catch(err => {
      console.error('useColumnWidths persist failed:', err);
    });
  }, []);

  const setColumnWidth = useCallback((key: ColumnKey, px: number) => {
    const clamped = Math.max(MIN_WIDTH_PX, Math.round(px));
    setWidths(prev => {
      const next = { ...prev, [key]: clamped };
      const loginId = getLoginId();
      void setUserPreference(loginId, PREF_KEY, next).catch(err => {
        console.error('useColumnWidths persist failed:', err);
      });
      return next;
    });
  }, []);

  const resetColumn = useCallback((key: ColumnKey) => {
    setWidths(prev => {
      const next = { ...prev, [key]: null };
      const loginId = getLoginId();
      void setUserPreference(loginId, PREF_KEY, next).catch(err => {
        console.error('useColumnWidths persist failed:', err);
      });
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    persist(DEFAULT_WIDTH_MAP);
  }, [persist]);

  return {
    widths,
    ratios: DEFAULT_RATIOS,
    setColumnWidth,
    resetColumn,
    resetAll,
    minWidth: MIN_WIDTH_PX,
    loading,
  };
}
