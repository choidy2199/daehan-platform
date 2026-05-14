"use client";

import { useEffect, useState } from "react";
import {
  getUserPreference,
  setUserPreference,
} from "@/lib/userPreferences";
import { COLUMNS } from "./columnConfig";

const PREF_KEY = "import_pricing:col_widths";
const MIN_WIDTH = 30;
const MAX_WIDTH = 600;

export type ColumnWidths = Record<string, number>;

function getLoginId(): string {
  if (typeof window === "undefined") return "anon";
  try {
    const raw = localStorage.getItem("current_user");
    if (!raw) return "anon";
    const user = JSON.parse(raw);
    return user?.loginId ?? "anon";
  } catch {
    return "anon";
  }
}

function getDefaults(): ColumnWidths {
  const result: ColumnWidths = {};
  for (const col of COLUMNS) {
    result[col.id] = col.width;
  }
  return result;
}

function clamp(n: number): number {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, n));
}

export function useColumnWidths() {
  const [widths, setWidths] = useState<ColumnWidths>(getDefaults);

  // mount 시 Supabase에서 저장된 값 로드
  useEffect(() => {
    let cancelled = false;
    const loginId = getLoginId();

    (async () => {
      const fromServer = await getUserPreference<ColumnWidths>(loginId, PREF_KEY);
      if (cancelled) return;
      if (fromServer && typeof fromServer === "object") {
        // 기본값과 머지 (저장된 값 우선, 빠진 컬럼은 기본값)
        setWidths(prev => ({ ...prev, ...fromServer }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // 드래그 종료 시 호출 (mouseup)
  const persistWidth = (colId: string, width: number): void => {
    const clamped = clamp(width);
    setWidths(prev => {
      const next = { ...prev, [colId]: clamped };
      const loginId = getLoginId();
      void setUserPreference(loginId, PREF_KEY, next).catch(err => {
        console.error("persistWidth failed:", err);
      });
      return next;
    });
  };

  // 드래그 중 호출 (mousemove) — 즉시 setState, 저장 안 함
  const updateWidth = (colId: string, width: number): void => {
    const clamped = clamp(width);
    setWidths(prev => ({ ...prev, [colId]: clamped }));
  };

  return { widths, updateWidth, persistWidth };
}
