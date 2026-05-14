'use client';
import { useState, useCallback } from 'react';
import { type ColumnId, DEFAULT_VISIBLE, COLUMNS } from './columnConfig';

export interface StoredConfig {
  order: ColumnId[];
  hidden: ColumnId[];
}

const STORAGE_KEY = 'ip_visible_cols_';

function getStorageKey(): string {
  if (typeof window === 'undefined') return STORAGE_KEY + 'anon';
  try {
    const raw = localStorage.getItem('current_user');
    if (raw) {
      const user = JSON.parse(raw);
      return STORAGE_KEY + (user?.loginId || 'anon');
    }
  } catch {}
  return STORAGE_KEY + 'anon';
}

function loadConfig(): StoredConfig {
  if (typeof window === 'undefined') {
    return { order: DEFAULT_VISIBLE, hidden: [] };
  }
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (!raw) return { order: DEFAULT_VISIBLE, hidden: [] };
    const parsed = JSON.parse(raw) as StoredConfig;
    const validIds = new Set(COLUMNS.map(c => c.id));
    const order = parsed.order.filter((id): id is ColumnId => validIds.has(id as ColumnId));
    const hidden = (parsed.hidden || []).filter((id): id is ColumnId => validIds.has(id as ColumnId));
    // 필수 컬럼은 무조건 order에 포함
    const requiredIds = COLUMNS.filter(c => c.required).map(c => c.id);
    for (const rid of requiredIds) {
      if (!order.includes(rid)) order.unshift(rid);
    }
    return { order, hidden };
  } catch {
    return { order: DEFAULT_VISIBLE, hidden: [] };
  }
}

export function useColumnConfig() {
  const [config, setConfig] = useState<StoredConfig>(() => loadConfig());

  const save = useCallback((next: StoredConfig) => {
    setConfig(next);
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(next));
    } catch {}
  }, []);

  const reset = useCallback(() => {
    save({ order: DEFAULT_VISIBLE, hidden: [] });
  }, [save]);

  return { config, save, reset };
}
