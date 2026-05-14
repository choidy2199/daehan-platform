'use client';
import { useEffect, useState } from 'react';
import { type ColumnId, DEFAULT_VISIBLE } from './columnConfig';
import {
  getUserPreference,
  setUserPreference,
  deleteUserPreference,
} from '@/lib/userPreferences';

export interface StoredConfig {
  order: ColumnId[];
  hidden: ColumnId[];
}

const STORAGE_KEY = 'ip_visible_cols_';
const PREF_KEY = 'import_pricing:visible_cols';
const DEFAULT: StoredConfig = { order: DEFAULT_VISIBLE, hidden: [] };

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

function isValidConfig(c: any): c is StoredConfig {
  return !!c && Array.isArray(c.order) && Array.isArray(c.hidden);
}

export function useColumnConfig() {
  const [config, setConfig] = useState<StoredConfig>(DEFAULT);

  useEffect(() => {
    let cancelled = false;
    const loginId = getLoginId();

    (async () => {
      // 1. Supabase에서 먼저 조회
      const fromServer = await getUserPreference<StoredConfig>(loginId, PREF_KEY);
      if (cancelled) return;

      if (fromServer && isValidConfig(fromServer)) {
        setConfig(fromServer);
        return;
      }

      // 2. localStorage 마이그 시도
      if (typeof window === 'undefined') return;
      const localKey = getStorageKey();
      const localRaw = localStorage.getItem(localKey);
      if (!localRaw) return; // 마이그할 게 없음

      try {
        const parsed = JSON.parse(localRaw) as StoredConfig;
        if (!isValidConfig(parsed)) {
          localStorage.removeItem(localKey);
          return;
        }
        // Supabase에 옮기기
        const ok = await setUserPreference(loginId, PREF_KEY, parsed);
        if (cancelled) return;
        if (ok) {
          localStorage.removeItem(localKey);
          setConfig(parsed);
        }
      } catch {
        // 파싱 실패 시 그냥 제거
        localStorage.removeItem(localKey);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const save = (next: StoredConfig): void => {
    setConfig(next); // 낙관적 갱신
    const loginId = getLoginId();
    void setUserPreference(loginId, PREF_KEY, next).catch(err => {
      console.error('save column config failed:', err);
    });
  };

  const reset = (): void => {
    setConfig(DEFAULT);
    const loginId = getLoginId();
    void deleteUserPreference(loginId, PREF_KEY).catch(err => {
      console.error('reset column config failed:', err);
    });
  };

  return { config, save, reset };
}
